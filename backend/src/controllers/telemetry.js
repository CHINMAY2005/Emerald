import crypto from 'crypto';
import { z } from 'zod';
import pool from '../config/db.js';
import stripe from '../config/stripe.js';
import logger from '../config/logger.js';

const TELEMETRY_SECRET = process.env.TELEMETRY_SECRET || 'telemetry_placeholder_secret';

const telemetrySchema = z.object({
  session_id: z.string().uuid('Invalid session ID (booking UUID)'),
  current_power_kw: z.number().nonnegative('Current power must be non-negative'),
  accumulated_kwh: z.number().nonnegative('Accumulated kWh must be non-negative'),
  event: z.string().optional(),
});

/**
 * Capture payment intent helper to settle transfers
 */
const captureStripePayment = async (paymentIntentId, amountCents = null) => {
  try {
    const captureOpts = {};
    if (amountCents !== null) {
      captureOpts.amount_to_capture = amountCents;
    }
    
    logger.info(`⚡ Stripe Capture: capturing PaymentIntent ${paymentIntentId}`, { amount_to_capture: amountCents });
    const captureResult = await stripe.paymentIntents.capture(paymentIntentId, captureOpts);
    logger.info(`✔ Stripe Capture: captured successfully`, { id: captureResult.id, status: captureResult.status });
    return captureResult;
  } catch (stripeError) {
    logger.error(`❌ Stripe Capture: Capture failed for ${paymentIntentId}`, { error: stripeError.message });
    // In production, we log the failure, but we may want to flag the booking as pending manual settlement
    throw stripeError;
  }
};

/**
 * Handle incoming hardware telemetry webhook
 */
export const handleHardwareWebhook = async (req, res) => {
  const sig = req.headers['x-emerald-signature'];

  try {
    // 1. Signature Verification
    if (!sig) {
      logger.warn('⚡ Telemetry Webhook: Missing signature header');
      return res.status(401).json({ success: false, error: 'Unauthorized: Missing signature header' });
    }

    const hmac = crypto.createHmac('sha256', TELEMETRY_SECRET);
    // req.body must be the raw buffer here
    const computedSig = hmac.update(req.body).digest('hex');

    if (sig !== computedSig) {
      logger.warn('⚡ Telemetry Webhook: Cryptographic signature mismatch', { sig, computed: computedSig });
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid signature' });
    }

    // 2. Parse and Validate Payload
    let payload;
    try {
      payload = JSON.parse(req.body.toString('utf-8'));
    } catch (parseError) {
      logger.warn('⚡ Telemetry Webhook: Failed to parse raw body as JSON', { error: parseError.message });
      return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
    }

    const validation = telemetrySchema.safeParse(payload);
    if (!validation.success) {
      logger.warn('⚡ Telemetry Webhook: Validation failed', { errors: validation.error.format() });
      return res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.format() });
    }

    const { session_id, current_power_kw, accumulated_kwh, event } = validation.data;

    logger.info('⚡ Telemetry Webhook: Payload parsed successfully', { session_id, current_power_kw, accumulated_kwh, event });

    // 3. Process Booking State Machine inside transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch and lock booking row
      const bookingResult = await client.query(
        `SELECT id, driver_id, total_kwh, total_price, status, stripe_payment_intent_id 
         FROM bookings 
         WHERE id = $1 FOR UPDATE`,
        [session_id]
      );

      if (bookingResult.rowCount === 0) {
        await client.query('ROLLBACK');
        logger.warn(`⚡ Telemetry Webhook: Booking ${session_id} not found`);
        return res.status(404).json({ success: false, error: 'Booking session not found' });
      }

      const booking = bookingResult.rows[0];

      // Ensure booking is in an active billing state
      if (!['confirmed', 'paid'].includes(booking.status)) {
        await client.query('ROLLBACK');
        logger.info(`⚡ Telemetry Webhook: Booking ${session_id} is in status '${booking.status}', ignoring telemetry packet.`);
        return res.status(200).json({ 
          success: true, 
          message: `Booking session is already completed or cancelled (status: ${booking.status})` 
        });
      }

      const totalKwhAllocation = Number(booking.total_kwh);
      const originalTotalPrice = Number(booking.total_price);
      const isLimitReached = accumulated_kwh >= totalKwhAllocation;
      const isDisconnected = event === 'charger_disconnected';

      if (isLimitReached || isDisconnected) {
        let finalKwh = accumulated_kwh;
        let finalPrice = originalTotalPrice;
        let captureAmountCents = null;

        // If premature charger disconnection, calculate fractional consumption
        if (isDisconnected && !isLimitReached) {
          finalKwh = Number(accumulated_kwh.toFixed(2));
          // Pro-rate price. Handle boundary totalKwhAllocation = 0
          const fraction = totalKwhAllocation > 0 ? (accumulated_kwh / totalKwhAllocation) : 0;
          finalPrice = Number((fraction * originalTotalPrice).toFixed(2));

          // Stripe amount to capture (minimum 50 cents standard limit or 0)
          captureAmountCents = Math.max(Math.round(finalPrice * 100), 0);
          logger.info(`⚡ Telemetry Webhook: Charger disconnected early. Recalculating billing`, {
            session_id,
            originalKwh: totalKwhAllocation,
            actualKwh: finalKwh,
            originalPrice: originalTotalPrice,
            proRatedPrice: finalPrice,
            captureAmountCents
          });
        } else {
          logger.info(`⚡ Telemetry Webhook: Energy allocation limit met or exceeded. Completing session`, {
            session_id,
            allocation: totalKwhAllocation,
            accumulated: accumulated_kwh
          });
        }

        // Settle payment transfer via Stripe
        if (booking.stripe_payment_intent_id) {
          try {
            await captureStripePayment(booking.stripe_payment_intent_id, captureAmountCents);
          } catch (stripeCapError) {
            // Log the error but proceed with database updates to avoid transaction hang.
            logger.error(`🚨 Telemetry Webhook: Stripe capture failed. Status remains incomplete on Stripe Connect`, {
              session_id,
              intent_id: booking.stripe_payment_intent_id,
              error: stripeCapError.message
            });
          }
        } else {
          logger.warn(`⚡ Telemetry Webhook: Booking ${session_id} has no Stripe PaymentIntent ID. Marking as completed without capture.`, { session_id });
        }

        // Update database row to completed
        const updateResult = await client.query(
          `UPDATE bookings 
           SET status = 'completed', total_kwh = $1, total_price = $2 
           WHERE id = $3 
           RETURNING id, status, total_kwh, total_price`,
          [finalKwh, finalPrice, session_id]
        );

        await client.query('COMMIT');

        logger.info(`✔ Telemetry Webhook: Booking ${session_id} completed successfully`, { 
          booking: updateResult.rows[0] 
        });

        return res.status(200).json({
          success: true,
          status: 'completed',
          booking: updateResult.rows[0]
        });
      }

      // Normal telemetry packet (charging session active)
      // We can update the database with current metrics if desired, or simply acknowledge the packet.
      await client.query('COMMIT');
      logger.debug('⚡ Telemetry Webhook: Ingested telemetry heartbeat packet', { session_id, current_power_kw, accumulated_kwh });
      return res.status(200).json({
        success: true,
        status: booking.status,
        message: 'Telemetry packet logged.'
      });

    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

  } catch (error) {
    // Primary backend process resilience: catches all database errors, parser bugs, Stripe timeouts, signature anomalies, etc.
    logger.error('🚨 Telemetry Webhook Crash Safeguard triggered:', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Internal telemetry integration error occurred. Webhook captured safely.',
    });
  }
};

/**
 * Simulate telemetry (Local Helper)
 * Signs a telemetry payload and dispatches it directly to the hardware webhook endpoint
 */
export const simulateTelemetry = async (req, res, next) => {
  const { booking_id, current_power_kw, accumulated_kwh, event } = req.body;

  try {
    if (!booking_id) {
      return res.status(400).json({ success: false, error: 'booking_id is required' });
    }

    const payloadObj = {
      session_id: booking_id,
      current_power_kw: Number(current_power_kw || 0),
      accumulated_kwh: Number(accumulated_kwh || 0),
    };

    if (event) {
      payloadObj.event = event;
    }

    const rawBody = Buffer.from(JSON.stringify(payloadObj));
    const hmac = crypto.createHmac('sha256', TELEMETRY_SECRET);
    const signature = hmac.update(rawBody).digest('hex');

    // Invoke handleHardwareWebhook directly with mocked request and response
    const mockReq = {
      headers: {
        'x-emerald-signature': signature,
      },
      body: rawBody, // Raw buffer
    };

    let statusVal = 200;
    let jsonVal = null;

    const mockRes = {
      status(code) {
        statusVal = code;
        return this;
      },
      json(data) {
        jsonVal = data;
        return this;
      },
    };

    await handleHardwareWebhook(mockReq, mockRes);
    return res.status(statusVal).json(jsonVal);
  } catch (error) {
    logger.error('🚨 Telemetry Simulation failed:', error);
    return res.status(500).json({
      success: false,
      error: `Telemetry simulation failed: ${error.message}`,
    });
  }
};

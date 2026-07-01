import { z } from 'zod';
import stripe from '../config/stripe.js';
import { query } from '../config/db.js';

export const createIntentSchema = {
  body: z.object({
    booking_id: z.string().uuid('Invalid booking ID format'),
  }),
};

/**
 * Create or retrieve a Stripe Connect Express account for the host user.
 * Generates an onboarding link for the host.
 */
export const connectAccount = async (req, res, next) => {
  const hostId = req.user.id;

  try {
    // 1. Get host's current stripe details
    const userResult = await query(
      'SELECT stripe_connect_id, stripe_onboarding_complete FROM users WHERE id = $1',
      [hostId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found.',
      });
    }

    let stripeConnectId = userResult.rows[0].stripe_connect_id;

    // 2. Create Stripe Express account if they don't have one
    if (!stripeConnectId) {
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: 'Emerald Hosting Marketplace',
        },
        metadata: {
          host_id: hostId,
          platform: 'Emerald Network',
        },
      });

      stripeConnectId = account.id;

      // Save to database
      await query(
        'UPDATE users SET stripe_connect_id = $1, stripe_onboarding_complete = false WHERE id = $2',
        [stripeConnectId, hostId]
      );
    }

    // 3. Generate Onboarding Link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const accountLink = await stripe.accountLinks.create({
      account: stripeConnectId,
      refresh_url: `${frontendUrl}/payment/refresh`,
      return_url: `${frontendUrl}/payment/return`,
      type: 'account_onboarding',
    });

    return res.status(200).json({
      success: true,
      stripe_connect_id: stripeConnectId,
      url: accountLink.url,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Check Stripe account status and update db onboarding status if completed
 */
export const getAccountStatus = async (req, res, next) => {
  const hostId = req.user.id;

  try {
    const userResult = await query(
      'SELECT stripe_connect_id FROM users WHERE id = $1',
      [hostId]
    );

    if (userResult.rowCount === 0 || !userResult.rows[0].stripe_connect_id) {
      return res.status(400).json({
        success: false,
        error: 'No Stripe Connect account associated with this user. Call connect-account first.',
      });
    }

    const stripeConnectId = userResult.rows[0].stripe_connect_id;

    // Retrieve account info from Stripe
    const account = await stripe.accounts.retrieve(stripeConnectId);

    const complete = account.charges_enabled && account.payouts_enabled;

    if (complete) {
      await query(
        'UPDATE users SET stripe_onboarding_complete = true WHERE id = $1',
        [hostId]
      );
    }

    return res.status(200).json({
      success: true,
      stripe_connect_id: stripeConnectId,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      stripe_onboarding_complete: complete,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Create Stripe PaymentIntent with split payments (application fee + transfer destination)
 */
export const createPaymentIntent = async (req, res, next) => {
  const { booking_id } = req.body;
  const callerId = req.user.id;

  try {
    // 1. Fetch booking, driver check, and host's Stripe status
    const bookingResult = await query(
      `SELECT b.id, b.driver_id, b.total_price, b.status, 
              u.stripe_connect_id, u.stripe_onboarding_complete
       FROM bookings b
       JOIN chargers c ON b.charger_id = c.id
       JOIN users u ON c.host_id = u.id
       WHERE b.id = $1`,
      [booking_id]
    );

    if (bookingResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found.',
      });
    }

    const booking = bookingResult.rows[0];

    // Ensure only the driver who booked (or admin) can pay
    if (booking.driver_id !== callerId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. You do not have permission to pay for this booking.',
      });
    }

    if (booking.status === 'paid' || booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'This booking has already been paid.',
      });
    }

    if (!booking.stripe_connect_id || !booking.stripe_onboarding_complete) {
      return res.status(400).json({
        success: false,
        error: 'The charger host has not completed their Stripe onboarding. Split payments cannot be routed.',
      });
    }

    // 2. Monetary calculations: convert float to integer cents
    // Example: total_price = 13.50 -> 1350 cents
    const amountInCents = Math.round(Number(booking.total_price) * 100);
    
    // Flat 10% platform fee in cents
    const applicationFeeInCents = Math.round(amountInCents * 0.1);

    // 3. Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      payment_method_types: ['card'],
      application_fee_amount: applicationFeeInCents,
      transfer_data: {
        destination: booking.stripe_connect_id,
      },
      metadata: {
        booking_id: booking.id,
      },
    });

    // 4. Save PaymentIntent ID and application fee to database
    await query(
      `UPDATE bookings 
       SET stripe_payment_intent_id = $1, application_fee_amount = $2 
       WHERE id = $3`,
      [paymentIntent.id, applicationFeeInCents, booking.id]
    );

    return res.status(200).json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount_cents: amountInCents,
      application_fee_cents: applicationFeeInCents,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get Stripe publishable key configuration
 */
export const getConfig = async (req, res, next) => {
  return res.status(200).json({
    success: true,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
  });
};

/**
 * Verify payment status with Stripe directly
 */
export const verifyPayment = async (req, res, next) => {
  const { booking_id } = req.body;
  const callerId = req.user.id;

  try {
    // 1. Fetch booking
    const bookingResult = await query(
      `SELECT id, driver_id, status, stripe_payment_intent_id 
       FROM bookings WHERE id = $1`,
      [booking_id]
    );

    if (bookingResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }

    const booking = bookingResult.rows[0];

    // Ensure authorization
    if (booking.driver_id !== callerId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    // If already paid/completed, return success immediately
    if (['paid', 'completed'].includes(booking.status)) {
      return res.status(200).json({ success: true, status: booking.status });
    }

    if (!booking.stripe_payment_intent_id) {
      return res.status(400).json({ success: false, error: 'No Stripe transaction associated with this booking.' });
    }

    // 2. Query Stripe for the PaymentIntent status
    const paymentIntent = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);

    if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture') {
      // Update database status to 'paid'
      await query(
        "UPDATE bookings SET status = 'paid' WHERE id = $1",
        [booking_id]
      );
      return res.status(200).json({ success: true, status: 'paid' });
    } else {
      return res.status(200).json({ 
        success: false, 
        status: booking.status,
        stripe_status: paymentIntent.status, 
        error: 'Stripe transaction has not succeeded yet.' 
      });
    }
  } catch (error) {
    return next(error);
  }
};

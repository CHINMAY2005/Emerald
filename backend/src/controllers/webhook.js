import stripe from '../config/stripe.js';
import { query } from '../config/db.js';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';

/**
 * Handle Stripe cryptographic webhooks.
 * Validates request payload using raw buffer.
 */
export const handleWebhook = async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // req.body must be the raw buffer here
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`⚡ Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({
      success: false,
      error: `Webhook Error: ${err.message}`,
    });
  }

  // Handle events
  try {
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const paymentIntentId = paymentIntent.id;
      const bookingId = paymentIntent.metadata?.booking_id;

      console.log(`💰 PaymentIntent succeeded: ${paymentIntentId} (booking: ${bookingId})`);

      // Update booking status to 'paid' in DB
      let updateResult;
      if (bookingId) {
        updateResult = await query(
          "UPDATE bookings SET status = 'paid' WHERE id = $1 RETURNING id, status",
          [bookingId]
        );
      } else {
        updateResult = await query(
          "UPDATE bookings SET status = 'paid' WHERE stripe_payment_intent_id = $1 RETURNING id, status",
          [paymentIntentId]
        );
      }

      if (updateResult && updateResult.rowCount > 0) {
        console.log(`✔ Booking ${updateResult.rows[0].id} updated to status 'paid'`);
      } else {
        console.warn(`⚠ Booking matching payment intent ${paymentIntentId} could not be found to update status.`);
      }
    }

    return res.status(200).json({ received: true });
  } catch (dbError) {
    console.error('❌ Webhook processing database error:', dbError);
    return next(dbError);
  }
};

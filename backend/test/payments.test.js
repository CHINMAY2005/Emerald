import { jest } from '@jest/globals';
import stripe from '../src/config/stripe.js';
import pool from '../src/config/db.js';
import { connectAccount, getAccountStatus, createPaymentIntent } from '../src/controllers/payments.js';
import { handleWebhook } from '../src/controllers/webhook.js';

// Spy on pool methods
const spyQuery = jest.spyOn(pool, 'query');
const spyConnect = jest.spyOn(pool, 'connect');

// Mock Stripe library calls
jest.spyOn(stripe.accounts, 'create').mockImplementation(() => Promise.resolve({ id: 'acct_mock123' }));
jest.spyOn(stripe.accountLinks, 'create').mockImplementation(() => Promise.resolve({ url: 'https://connect.stripe.com/setup/mock' }));
jest.spyOn(stripe.accounts, 'retrieve').mockImplementation(() => Promise.resolve({
  id: 'acct_mock123',
  charges_enabled: true,
  payouts_enabled: true,
}));
jest.spyOn(stripe.paymentIntents, 'create').mockImplementation(() => Promise.resolve({
  id: 'pi_mock123',
  client_secret: 'pi_mock123_secret',
}));
jest.spyOn(stripe.webhooks, 'constructEvent').mockImplementation(() => ({
  type: 'payment_intent.succeeded',
  data: {
    object: {
      id: 'pi_mock123',
      metadata: { booking_id: 'b1111111-1111-1111-1111-111111111111' },
    },
  },
}));

describe('Stripe Connect Payments Service', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('connectAccount should create Stripe account & link for host user', async () => {
    req = {
      user: { id: 'host-user-id', role: 'host' },
    };

    // Mock User has no stripe ID yet
    spyQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ stripe_connect_id: null, stripe_onboarding_complete: false }],
    });

    // Mock database updates
    spyQuery.mockResolvedValueOnce({}); // Update stripe connect ID

    await connectAccount(req, res, next);

    expect(stripe.accounts.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'express' }));
    expect(stripe.accountLinks.create).toHaveBeenCalledWith(expect.objectContaining({ account: 'acct_mock123' }));
    expect(spyQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users SET stripe_connect_id'),
      ['acct_mock123', 'host-user-id']
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      stripe_connect_id: 'acct_mock123',
      url: 'https://connect.stripe.com/setup/mock',
    }));
  });

  test('getAccountStatus should verify completed onboarding state and update user DB record', async () => {
    req = {
      user: { id: 'host-user-id', role: 'host' },
    };

    spyQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ stripe_connect_id: 'acct_mock123' }],
    });

    spyQuery.mockResolvedValueOnce({}); // Update completed status flag

    await getAccountStatus(req, res, next);

    expect(stripe.accounts.retrieve).toHaveBeenCalledWith('acct_mock123');
    expect(spyQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users SET stripe_onboarding_complete = true'),
      ['host-user-id']
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      stripe_onboarding_complete: true,
    }));
  });

  test('createPaymentIntent should calculate 10% platform fee in integer cents and call Stripe PI', async () => {
    req = {
      user: { id: 'driver-id', role: 'driver' },
      body: { booking_id: 'b1111111-1111-1111-1111-111111111111' },
    };

    // Mock Booking fetch
    spyQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        id: 'b1111111-1111-1111-1111-111111111111',
        driver_id: 'driver-id',
        total_price: '19.95', // $19.95
        status: 'confirmed',
        stripe_connect_id: 'acct_mock123',
        stripe_onboarding_complete: true,
      }],
    });

    spyQuery.mockResolvedValueOnce({}); // Save intent to bookings DB

    await createPaymentIntent(req, res, next);

    // 19.95 * 100 = 1995 cents
    // application fee = 1995 * 0.1 = 199.5 -> rounded to 200 cents
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({
      amount: 1995,
      application_fee_amount: 200,
      transfer_data: { destination: 'acct_mock123' },
    }));

    expect(spyQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('stripe_payment_intent_id = $1'),
      ['pi_mock123', 200, 'b1111111-1111-1111-1111-111111111111']
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      client_secret: 'pi_mock123_secret',
      amount_cents: 1995,
      application_fee_cents: 200,
    }));
  });

  test('handleWebhook should verify signature and mark matching Booking as paid on succeeded event', async () => {
    req = {
      headers: { 'stripe-signature': 'sig_mock_header' },
      body: Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded' })),
    };

    spyQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'b1111111-1111-1111-1111-111111111111', status: 'paid' }],
    });

    await handleWebhook(req, res, next);

    expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(req.body, 'sig_mock_header', expect.any(String));
    expect(spyQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE bookings SET status = 'paid' WHERE id = $1"),
      ['b1111111-1111-1111-1111-111111111111']
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});

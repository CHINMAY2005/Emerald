import crypto from 'crypto';
import { jest } from '@jest/globals';
import stripe from '../src/config/stripe.js';
import pool from '../src/config/db.js';
import logger from '../src/config/logger.js';
import { handleHardwareWebhook } from '../src/controllers/telemetry.js';

// Spy on pool and winston methods
const spyQuery = jest.spyOn(pool, 'query');
const spyConnect = jest.spyOn(pool, 'connect');
const spyLoggerWarn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
const spyLoggerError = jest.spyOn(logger, 'error').mockImplementation(() => {});
const spyLoggerInfo = jest.spyOn(logger, 'info').mockImplementation(() => {});

// Mock Stripe library captures
jest.spyOn(stripe.paymentIntents, 'capture').mockImplementation(() => Promise.resolve({ id: 'pi_mock123', status: 'succeeded' }));

const TELEMETRY_SECRET = 'telemetry_placeholder_secret';

const generateSignature = (payload) => {
  const hmac = crypto.createHmac('sha256', TELEMETRY_SECRET);
  return hmac.update(JSON.stringify(payload)).digest('hex');
};

describe('Hardware Telemetry Service Integration', () => {
  let req, res, mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    spyConnect.mockResolvedValue(mockClient);
  });

  test('should return 401 when signature header is missing', async () => {
    req = {
      headers: {},
      body: Buffer.from(JSON.stringify({})),
    };

    await handleHardwareWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Missing signature'),
    }));
  });

  test('should return 401 when signature check fails', async () => {
    req = {
      headers: { 'x-emerald-signature': 'invalid_signature_hex' },
      body: Buffer.from(JSON.stringify({ session_id: 'b1111111-1111-1111-1111-111111111111' })),
    };

    await handleHardwareWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Invalid signature'),
    }));
  });

  test('should return 400 when payload is not valid JSON', async () => {
    const badPayloadStr = '{ session_id: "not-json" ';
    const hmac = crypto.createHmac('sha256', TELEMETRY_SECRET);
    const sig = hmac.update(Buffer.from(badPayloadStr)).digest('hex');

    req = {
      headers: { 'x-emerald-signature': sig },
      body: Buffer.from(badPayloadStr),
    };

    await handleHardwareWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Invalid JSON payload',
    }));
  });

  test('should return 400 when payload schema validation fails', async () => {
    const badPayload = {
      session_id: 'not-a-uuid',
      current_power_kw: -5.0, // negative power invalid
      accumulated_kwh: 12.0,
    };

    req = {
      headers: { 'x-emerald-signature': generateSignature(badPayload) },
      body: Buffer.from(JSON.stringify(badPayload)),
    };

    await handleHardwareWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Validation failed',
    }));
  });

  test('should transition to completed and capture Stripe PI in full when allocation limit is met', async () => {
    const payload = {
      session_id: 'b1111111-1111-1111-1111-111111111111',
      current_power_kw: 7.2,
      accumulated_kwh: 30.5, // matches/exceeds allocation
    };

    req = {
      headers: { 'x-emerald-signature': generateSignature(payload) },
      body: Buffer.from(JSON.stringify(payload)),
    };

    // Mock DB queries
    mockClient.query.mockResolvedValueOnce({}); // BEGIN
    mockClient.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        id: 'b1111111-1111-1111-1111-111111111111',
        total_kwh: '30.00', // allocated limit
        total_price: '13.50',
        status: 'paid',
        stripe_payment_intent_id: 'pi_mock123',
      }],
    }); // SELECT FOR UPDATE
    mockClient.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'b1111111-1111-1111-1111-111111111111', status: 'completed' }],
    }); // UPDATE bookings SET status = completed
    mockClient.query.mockResolvedValueOnce({}); // COMMIT

    await handleHardwareWebhook(req, res);

    expect(stripe.paymentIntents.capture).toHaveBeenCalledWith('pi_mock123', {});
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'completed'"),
      [30.5, 13.50, 'b1111111-1111-1111-1111-111111111111']
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      status: 'completed',
    }));
  });

  test('should handle early charger disconnection, pro-rate price, and capture fractional Stripe Connect Connect balance', async () => {
    const payload = {
      session_id: 'b1111111-1111-1111-1111-111111111111',
      current_power_kw: 0.0,
      accumulated_kwh: 15.0, // half of allocation
      event: 'charger_disconnected',
    };

    req = {
      headers: { 'x-emerald-signature': generateSignature(payload) },
      body: Buffer.from(JSON.stringify(payload)),
    };

    // Mock DB queries
    mockClient.query.mockResolvedValueOnce({}); // BEGIN
    mockClient.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        id: 'b1111111-1111-1111-1111-111111111111',
        total_kwh: '30.00',
        total_price: '13.50', // original price
        status: 'paid',
        stripe_payment_intent_id: 'pi_mock123',
      }],
    }); // SELECT FOR UPDATE
    mockClient.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        id: 'b1111111-1111-1111-1111-111111111111',
        status: 'completed',
        total_kwh: 15,
        total_price: 6.75, // pro-rated: (15 / 30) * 13.50 = 6.75
      }],
    }); // UPDATE bookings
    mockClient.query.mockResolvedValueOnce({}); // COMMIT

    await handleHardwareWebhook(req, res);

    // pro-rated capture: 6.75 * 100 = 675 cents
    expect(stripe.paymentIntents.capture).toHaveBeenCalledWith('pi_mock123', { amount_to_capture: 675 });
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'completed'"),
      [15.0, 6.75, 'b1111111-1111-1111-1111-111111111111']
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      status: 'completed',
      booking: expect.objectContaining({
        total_price: 6.75,
      }),
    }));
  });

  test('should log database crash via winston and return 500 without crashing process', async () => {
    const payload = {
      session_id: 'b1111111-1111-1111-1111-111111111111',
      current_power_kw: 7.2,
      accumulated_kwh: 5.0,
    };

    req = {
      headers: { 'x-emerald-signature': generateSignature(payload) },
      body: Buffer.from(JSON.stringify(payload)),
    };

    // Force DB client retrieval to crash
    spyConnect.mockRejectedValueOnce(new Error('Fatal database pool failure'));

    await handleHardwareWebhook(req, res);

    expect(spyLoggerError).toHaveBeenCalledWith(
      expect.stringContaining('Telemetry Webhook Crash Safeguard triggered'),
      expect.any(Object)
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal telemetry integration error occurred. Webhook captured safely.',
    });
  });
});

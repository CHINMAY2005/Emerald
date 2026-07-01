import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';

if (!process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ STRIPE_SECRET_KEY is missing in production environment!');
}

let stripeInstance;

// Determine if we should run in mock mode
const isPlaceholder = stripeSecretKey.includes('placeholder') || stripeSecretKey === 'sk_test_placeholder' || !stripeSecretKey.startsWith('sk_');

if (isPlaceholder) {
  console.log('⚡ Stripe Config: Using mock Stripe interface due to placeholder/missing secret key');
  stripeInstance = {
    accounts: {
      create: async (params) => {
        console.log('[MOCK STRIPE] Create Account:', params);
        return {
          id: 'acct_mock_' + Math.random().toString(36).substring(2, 11),
          type: 'express',
          business_profile: { name: params?.business_profile?.name || 'Emerald Host' },
          metadata: params?.metadata || {},
          charges_enabled: true,
          payouts_enabled: true,
        };
      },
      retrieve: async (id) => {
        console.log('[MOCK STRIPE] Retrieve Account:', id);
        return {
          id,
          charges_enabled: true,
          payouts_enabled: true,
        };
      }
    },
    accountLinks: {
      create: async (params) => {
        console.log('[MOCK STRIPE] Create Account Link:', params);
        return {
          url: params.return_url || 'http://localhost:3000/payment/return',
        };
      }
    },
    paymentIntents: {
      create: async (params) => {
        console.log('[MOCK STRIPE] Create Payment Intent:', params);
        return {
          id: 'pi_mock_' + Math.random().toString(36).substring(2, 11),
          client_secret: 'pi_mock_secret_' + Math.random().toString(36).substring(2, 11),
          amount: params.amount,
          currency: params.currency,
          status: 'requires_capture',
          metadata: params.metadata || {},
        };
      },
      capture: async (id, params) => {
        console.log('[MOCK STRIPE] Capture Payment Intent:', id, params);
        return {
          id,
          status: 'succeeded',
        };
      },
      retrieve: async (id) => {
        console.log('[MOCK STRIPE] Retrieve Payment Intent:', id);
        return {
          id,
          status: 'succeeded',
        };
      }
    },
    webhooks: {
      constructEvent: (body, sig, secret) => {
        console.log('[MOCK STRIPE] Construct Webhook Event');
        try {
          // Allow raw JSON body simulation
          const parsed = JSON.parse(body.toString('utf-8'));
          return parsed;
        } catch (e) {
          console.error('[MOCK STRIPE] Webhook parse error:', e);
          throw new Error('Invalid JSON for mock webhook event');
        }
      }
    }
  };
} else {
  stripeInstance = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
  });
}

export default stripeInstance;


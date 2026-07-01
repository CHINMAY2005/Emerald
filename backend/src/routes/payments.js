import express from 'express';
import { connectAccount, getAccountStatus, createPaymentIntent, getConfig, verifyPayment, createIntentSchema } from '../controllers/payments.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

// Onboarding endpoints (Authenticated, Host/Admin roles)
router.post(
  '/connect-account',
  authenticate,
  requireRole(['host', 'admin']),
  connectAccount
);

router.get(
  '/account-status',
  authenticate,
  requireRole(['host', 'admin']),
  getAccountStatus
);

// Configuration endpoint (Authenticated, anyone)
router.get(
  '/config',
  authenticate,
  getConfig
);

// Checkout endpoint (Authenticated, Driver/Admin roles)
router.post(
  '/create-intent',
  authenticate,
  requireRole(['driver', 'admin']),
  validate(createIntentSchema),
  createPaymentIntent
);

// Verification endpoint (Authenticated, anyone)
router.post(
  '/verify',
  authenticate,
  verifyPayment
);

export default router;

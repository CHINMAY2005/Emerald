import express from 'express';
import { handleHardwareWebhook, simulateTelemetry } from '../controllers/telemetry.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// POST /api/telemetry/hardware-webhook
// Raw buffer body is checked at app level for signature validation
router.post('/hardware-webhook', handleHardwareWebhook);

// POST /api/telemetry/simulate
// Internal proxy helper that signs and forwards the simulation requests
router.post('/simulate', authenticate, simulateTelemetry);

export default router;

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import chargerRoutes from './routes/chargers.js';
import bookingRoutes from './routes/bookings.js';
import hostRoutes from './routes/hosts.js';
import paymentRoutes from './routes/payments.js';
import telemetryRoutes from './routes/telemetry.js';
import { handleWebhook } from './controllers/webhook.js';
import { handleHardwareWebhook } from './controllers/telemetry.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetsPath = path.resolve(__dirname, '../../Assets');

// Serve static assets
app.use(express.static(assetsPath));

// 1. Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // Adjust for production environments
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 1.5 Stripe Webhook (Raw Buffer Endpoint)
app.post('/api/v1/emerald/payments/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// 1.6 Telemetry Webhook (Raw Buffer Endpoint)
app.post('/api/v1/emerald/telemetry/hardware-webhook', express.raw({ type: 'application/json' }), handleHardwareWebhook);

// 2. Body Parser
app.use(express.json({ limit: '10kb' })); // Restrict payload size to prevent DOS

// 3. Rate Limiting Middleware
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit login/register requests to 50 per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

// Apply rate limiting
app.use('/api/v1/emerald/', generalLimiter);
app.use('/api/v1/emerald/auth/', authLimiter);

// 4. API Routes
app.use('/api/v1/emerald/auth', authRoutes);
app.use('/api/v1/emerald/chargers', chargerRoutes);
app.use('/api/v1/emerald/bookings', bookingRoutes);
app.use('/api/v1/emerald/hosts', hostRoutes);
app.use('/api/v1/emerald/payments', paymentRoutes);
app.use('/api/v1/emerald/telemetry', telemetryRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Catch-all route for frontend fallback (SPA support)
app.get('*', (req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: `API Route not found: ${req.method} ${req.originalUrl}`
    });
  }
  res.sendFile(path.join(assetsPath, 'index.html'));
});

// 6. Global Error Handler
app.use(errorHandler);

export default app;

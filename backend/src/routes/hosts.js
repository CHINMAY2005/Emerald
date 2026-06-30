import { Router } from 'express';
import { getHostEarnings, hostEarningsSchema } from '../controllers/hosts.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// GET /api/hosts/earnings - Fetch monthly revenue metrics for host
router.get(
  '/earnings',
  authenticate,
  requireRole(['host', 'admin']),
  validate(hostEarningsSchema),
  getHostEarnings
);

export default router;

import { Router } from 'express';
import { getNearbyChargers, createCharger, updateCharger, getChargersSchema, createChargerSchema, updateChargerSchema } from '../controllers/chargers.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// GET /api/chargers - Query available chargers near coordinates
router.get('/', validate(getChargersSchema), getNearbyChargers);

// POST /api/chargers - Create a new charger listing (Host only)
router.post('/', authenticate, requireRole(['host', 'admin']), validate(createChargerSchema), createCharger);

// PUT /api/chargers/:id - Update an existing charger listing (Host/Admin only)
router.put('/:id', authenticate, requireRole(['host', 'admin']), validate(updateChargerSchema), updateCharger);

export default router;

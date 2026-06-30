import { Router } from 'express';
import { createBooking, getMyBookings, createBookingSchema } from '../controllers/bookings.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Apply authentication to all booking endpoints
router.use(authenticate);

// POST /api/bookings - Book a charger slot
router.post('/', validate(createBookingSchema), createBooking);

// GET /api/bookings - Get user-related bookings (driver's own or host's chargers)
router.get('/', getMyBookings);

export default router;

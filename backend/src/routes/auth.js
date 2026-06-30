import { Router } from 'express';
import { register, login, registerSchema, loginSchema } from '../controllers/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// POST /api/auth/register
router.post('/register', validate(registerSchema), register);

// POST /api/auth/login
router.post('/login', validate(loginSchema), login);

export default router;

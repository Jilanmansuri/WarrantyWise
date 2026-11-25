import { Router } from 'express';
import {
  forgotPassword,
  forgotPasswordSchema,
  getMe,
  getNotificationPreferences,
  login,
  loginSchema,
  notificationPrefSchema,
  register,
  registerSchema,
  resetPassword,
  resetPasswordSchema,
  updateMe,
  updateNotificationPreferences,
  updateProfileSchema,
} from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

router.post('/register', validateBody(registerSchema), register);
router.post('/login', validateBody(loginSchema), login);
router.post('/forgot-password', validateBody(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validateBody(resetPasswordSchema), resetPassword);

router.get('/me', requireAuth, getMe);
router.put('/me', requireAuth, validateBody(updateProfileSchema), updateMe);
router.get('/notifications', requireAuth, getNotificationPreferences);
router.put(
  '/notifications',
  requireAuth,
  validateBody(notificationPrefSchema),
  updateNotificationPreferences
);

export default router;

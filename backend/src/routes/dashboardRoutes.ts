import { Router } from 'express';
import { getDashboardStats, getUpcomingExpiries } from '../controllers/dashboardController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/stats', getDashboardStats);
router.get('/upcoming-expiries', getUpcomingExpiries);

export default router;

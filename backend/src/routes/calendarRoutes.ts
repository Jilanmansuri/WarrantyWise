import { Router } from 'express';
import { getCalendarEvents } from '../controllers/calendarController';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', getCalendarEvents);

export default router;

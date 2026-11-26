import { Router } from 'express';
import {
  createAmc,
  createAmcSchema,
  deleteAmc,
  getAmcs,
  logAmcVisit,
  updateAmc,
  updateAmcSchema,
} from '../controllers/amcController';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();
router.use(requireAuth);

router.post('/', validateBody(createAmcSchema), createAmc);
router.get('/', getAmcs);
router.put('/:id', validateBody(updateAmcSchema), updateAmc);
router.post('/:id/visit', logAmcVisit);
router.delete('/:id', deleteAmc);

export default router;

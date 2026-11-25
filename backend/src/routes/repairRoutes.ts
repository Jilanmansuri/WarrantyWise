import { Router } from 'express';
import {
  createRepair,
  createRepairSchema,
  deleteRepair,
  getAllRepairs,
  getRepairsByProduct,
  updateRepair,
  updateRepairSchema,
} from '../controllers/repairController';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

router.use(requireAuth);

router.post('/', validateBody(createRepairSchema), createRepair);
router.get('/', getAllRepairs);
router.get('/:productId', getRepairsByProduct);
router.put('/:id', validateBody(updateRepairSchema), updateRepair);
router.delete('/:id', deleteRepair);

export default router;

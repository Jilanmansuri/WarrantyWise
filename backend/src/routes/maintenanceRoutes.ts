import { Router } from 'express';
import {
  completeMaintenance,
  completeMaintenanceSchema,
  createMaintenance,
  createMaintenanceSchema,
  deleteMaintenance,
  getMaintenances,
  updateMaintenance,
  updateMaintenanceSchema,
} from '../controllers/maintenanceController';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();
router.use(requireAuth);

router.post('/', validateBody(createMaintenanceSchema), createMaintenance);
router.get('/', getMaintenances);
router.put('/:id', validateBody(updateMaintenanceSchema), updateMaintenance);
router.post('/:id/complete', validateBody(completeMaintenanceSchema), completeMaintenance);
router.delete('/:id', deleteMaintenance);

export default router;

import { Router } from 'express';
import {
  assignProductToMember,
  createFamilyMember,
  deleteFamilyMember,
  familyMemberSchema,
  getFamilyDashboard,
  updateFamilyMember,
  updateFamilyMemberSchema,
} from '../controllers/familyController';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();
router.use(requireAuth);

router.get('/', getFamilyDashboard);
router.post('/members', validateBody(familyMemberSchema), createFamilyMember);
router.put('/members/:id', validateBody(updateFamilyMemberSchema), updateFamilyMember);
router.delete('/members/:id', deleteFamilyMember);
router.post('/assign', assignProductToMember);

export default router;

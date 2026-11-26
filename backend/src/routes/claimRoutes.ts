import { Router } from 'express';
import {
  createClaim,
  createClaimSchema,
  deleteClaim,
  getClaimPreparation,
  getClaims,
  updateClaim,
  updateClaimSchema,
} from '../controllers/claimController';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();
router.use(requireAuth);

router.post('/', validateBody(createClaimSchema), createClaim);
router.get('/', getClaims);
router.get('/prepare/:productId', getClaimPreparation);
router.put('/:id', validateBody(updateClaimSchema), updateClaim);
router.delete('/:id', deleteClaim);

export default router;

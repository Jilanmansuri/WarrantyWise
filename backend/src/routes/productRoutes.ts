import { Router } from 'express';
import {
  createProduct,
  createProductSchema,
  deleteProduct,
  getProductById,
  getProductCostAnalysis,
  getProductHealthScore,
  getProductLifecycle,
  getProducts,
  getResaleSummary,
  lookupProductByQrToken,
  regenerateQrToken,
  updateProduct,
  updateProductSchema,
} from '../controllers/productController';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

router.use(requireAuth);

router.post('/', validateBody(createProductSchema), createProduct);
router.get('/', getProducts);
router.get('/qr/:qrToken', lookupProductByQrToken);
router.get('/:id', getProductById);
router.get('/:id/lifecycle', getProductLifecycle);
router.get('/:id/cost-analysis', getProductCostAnalysis);
router.get('/:id/health-score', getProductHealthScore);
router.get('/:id/resale-summary', getResaleSummary);
router.post('/:id/qr/regenerate', regenerateQrToken);
router.put('/:id', validateBody(updateProductSchema), updateProduct);
router.delete('/:id', deleteProduct);

export default router;

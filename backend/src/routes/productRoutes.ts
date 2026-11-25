import { Router } from 'express';
import {
  createProduct,
  createProductSchema,
  deleteProduct,
  getProductById,
  getProducts,
  updateProduct,
  updateProductSchema,
} from '../controllers/productController';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

router.use(requireAuth);

router.post('/', validateBody(createProductSchema), createProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.put('/:id', validateBody(updateProductSchema), updateProduct);
router.delete('/:id', deleteProduct);

export default router;

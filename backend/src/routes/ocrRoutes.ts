import { Router } from 'express';
import { parseInvoiceImage } from '../controllers/ocrController';
import { requireAuth } from '../middleware/auth';
import { uploadMiddleware } from '../middleware/upload';

const router = Router();

router.use(requireAuth);

router.post('/parse-invoice', uploadMiddleware.single('image'), parseInvoiceImage);

export default router;

import { Router } from 'express';
import {
  deleteDocument,
  downloadDocument,
  getDocuments,
  uploadDocument,
} from '../controllers/documentController';
import { requireAuth } from '../middleware/auth';
import { uploadMiddleware } from '../middleware/upload';

const router = Router();

router.use(requireAuth);

router.post('/', uploadMiddleware.single('file'), uploadDocument);
router.get('/', getDocuments);
router.get('/:id/download', downloadDocument);
router.delete('/:id', deleteDocument);

export default router;

import fs from 'fs';
import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middleware';
import { AMC } from '../models/AMC';
import { DOCUMENT_TYPES, DocumentModel, DocumentType } from '../models/Document';
import { Product } from '../models/Product';
import { Repair } from '../models/Repair';
import { WarrantyClaim } from '../models/WarrantyClaim';
import { resolveProductAccess } from '../services/familyAccessService';
import {
  deleteFileFromStorage,
  resolveLocalFilePath,
  uploadFileToStorage,
} from '../services/storageService';
import { AppError } from '../utils';

export async function uploadDocument(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const file = req.file;
    if (!file) {
      throw new AppError('Document file is required.', 400, 'FILE_REQUIRED');
    }

    const rawType = String(req.body.type || 'Purchase Invoice');
    const type: DocumentType = DOCUMENT_TYPES.includes(rawType as DocumentType)
      ? (rawType as DocumentType)
      : 'Other';
    const title = String(req.body.title || file.originalname || 'Uploaded Document').trim();
    const productId = req.body.productId ? String(req.body.productId) : undefined;
    const repairId = req.body.repairId ? String(req.body.repairId) : undefined;
    const amcId = req.body.amcId ? String(req.body.amcId) : undefined;
    const claimId = req.body.claimId ? String(req.body.claimId) : undefined;

    if (productId) {
      const ownedProduct = await Product.findOne({ _id: productId, userId });
      if (!ownedProduct) {
        throw new AppError('Associated product not found.', 404, 'PRODUCT_NOT_FOUND');
      }
    }

    if (repairId) {
      const ownedRepair = await Repair.findOne({ _id: repairId, userId });
      if (!ownedRepair) {
        throw new AppError('Associated repair record not found.', 404, 'REPAIR_NOT_FOUND');
      }
    }

    if (amcId) {
      const ownedAmc = await AMC.findOne({ _id: amcId, userId });
      if (!ownedAmc) {
        throw new AppError('Associated AMC contract not found.', 404, 'AMC_NOT_FOUND');
      }
    }

    if (claimId) {
      const ownedClaim = await WarrantyClaim.findOne({ _id: claimId, userId });
      if (!ownedClaim) {
        throw new AppError('Associated warranty claim not found.', 404, 'CLAIM_NOT_FOUND');
      }
    }

    const stored = await uploadFileToStorage({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      userId,
      subFolder: type.toLowerCase().replace(/\s+/g, '-'),
    });

    const doc = await DocumentModel.create({
      userId,
      productId,
      repairId,
      amcId,
      claimId,
      title,
      type,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      storageProvider: stored.storageProvider,
      url: stored.url,
      publicId: stored.publicId,
      resourceType: stored.resourceType,
    });

    if (productId && type === 'Purchase Invoice') {
      await Product.updateOne(
        {
          _id: productId,
          userId,
          $or: [{ invoiceDocumentId: { $exists: false } }, { invoiceDocumentId: null }],
        },
        { $set: { invoiceDocumentId: doc._id } }
      );
    }

    res.status(201).json({
      success: true,
      data: doc,
    });
  } catch (err) {
    next(err);
  }
}

export async function getDocuments(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { productId, type, search } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = { userId };
    if (productId) filter.productId = productId;
    if (type && type !== 'All') filter.type = type;
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ title: new RegExp(escaped, 'i') }, { fileName: new RegExp(escaped, 'i') }];
    }

    const documents = await DocumentModel.find(filter)
      .populate('productId', 'productName brand')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: documents,
    });
  } catch (err) {
    next(err);
  }
}

export async function downloadDocument(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const doc = await DocumentModel.findById(req.params.id);

    if (!doc) {
      throw new AppError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
    }

    if (doc.userId.toString() !== userId) {
      if (!doc.productId) {
        throw new AppError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
      }
      const access = await resolveProductAccess(doc.productId.toString(), userId);
      if (!access.canViewDocuments) {
        throw new AppError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
      }
    }

    if (doc.storageProvider === 'local') {
      const filePath = resolveLocalFilePath(doc.publicId);
      if (!fs.existsSync(filePath)) {
        throw new AppError('Document file is missing from storage.', 404, 'FILE_NOT_FOUND');
      }
      res.setHeader('Content-Type', doc.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`);
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    res.redirect(doc.url);
  } catch (err) {
    next(err);
  }
}

export async function deleteDocument(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const doc = await DocumentModel.findOne({ _id: req.params.id, userId });

    if (!doc) {
      throw new AppError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
    }

    await deleteFileFromStorage(doc.storageProvider, doc.publicId, doc.resourceType);

    await Promise.all([
      Product.updateMany(
        { userId, invoiceDocumentId: doc._id },
        { $unset: { invoiceDocumentId: '' } }
      ),
      Product.updateMany(
        { userId, productImageDocumentId: doc._id },
        { $unset: { productImageDocumentId: '', productImageUrl: '' } }
      ),
      Repair.updateMany(
        { userId, repairInvoiceDocumentId: doc._id },
        { $unset: { repairInvoiceDocumentId: '', repairInvoiceUrl: '' } }
      ),
      AMC.updateMany(
        { userId, contractDocumentId: doc._id },
        { $unset: { contractDocumentId: '' } }
      ),
      WarrantyClaim.updateMany(
        { userId, supportingDocumentIds: doc._id },
        { $pull: { supportingDocumentIds: doc._id } }
      ),
      DocumentModel.deleteOne({ _id: doc._id, userId }),
    ]);

    res.json({
      success: true,
      data: { message: 'Document deleted.' },
    });
  } catch (err) {
    next(err);
  }
}

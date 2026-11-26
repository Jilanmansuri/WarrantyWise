import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware';
import { DocumentModel } from '../models/Document';
import { Product } from '../models/Product';
import { REPAIR_STATUSES, Repair } from '../models/Repair';
import { resolveProductAccess } from '../services/familyAccessService';
import { recordProductEvent } from '../services/productAnalyticsService';
import { AppError, toUtcDateOnly } from '../utils';

export const createRepairSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  repairDate: z.string().min(1, 'Repair date is required'),
  problemDescription: z.string().trim().min(2, 'Problem description is required').max(1000),
  repairCenter: z.string().trim().min(2, 'Repair center is required').max(150),
  repairCost: z.coerce.number().min(0).default(0),
  repairStatus: z.enum(REPAIR_STATUSES).default('Pending'),
  repairInvoiceDocumentId: z.string().trim().optional(),
  repairInvoiceUrl: z.string().trim().optional(),
  additionalNotes: z.string().trim().max(1500).optional(),
});

export const updateRepairSchema = createRepairSchema.omit({ productId: true }).partial();

export async function createRepair(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const body = req.body as z.infer<typeof createRepairSchema>;

    const product = await Product.findOne({ _id: body.productId, userId });
    if (!product) {
      throw new AppError('Product not found or access denied.', 404, 'PRODUCT_NOT_FOUND');
    }

    let invoiceDoc = null;
    if (body.repairInvoiceDocumentId) {
      invoiceDoc = await DocumentModel.findOne({ _id: body.repairInvoiceDocumentId, userId });
      if (!invoiceDoc) {
        throw new AppError('Referenced repair invoice document not found.', 404, 'DOCUMENT_NOT_FOUND');
      }
    }

    const repair = await Repair.create({
      userId,
      productId: product._id,
      repairDate: toUtcDateOnly(body.repairDate),
      problemDescription: body.problemDescription,
      repairCenter: body.repairCenter,
      repairCost: body.repairCost ?? 0,
      repairStatus: body.repairStatus,
      repairInvoiceDocumentId: invoiceDoc?._id,
      repairInvoiceUrl: body.repairInvoiceUrl || invoiceDoc?.url,
      additionalNotes: body.additionalNotes,
    });

    if (invoiceDoc) {
      invoiceDoc.productId = product._id;
      invoiceDoc.repairId = repair._id;
      await invoiceDoc.save();
    }

    await recordProductEvent({
      userId,
      productId: product._id,
      eventType: 'REPAIR_LOGGED',
      title: `Repair Logged: ${body.problemDescription}`,
      description: `${body.repairCenter} • ${body.repairStatus}`,
      amount: body.repairCost ?? 0,
      eventDate: repair.repairDate,
    });

    res.status(201).json({
      success: true,
      data: repair,
    });
  } catch (err) {
    next(err);
  }
}

export async function getRepairsByProduct(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { productId } = req.params;

    const access = await resolveProductAccess(productId, userId);

    const repairs = await Repair.find({ productId: access.product._id }).sort({
      repairDate: -1,
      createdAt: -1,
    });
    res.json({
      success: true,
      data: repairs,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAllRepairs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const repairs = await Repair.find({ userId })
      .populate('productId', 'productName brand modelNumber')
      .sort({ repairDate: -1, createdAt: -1 });

    res.json({
      success: true,
      data: repairs,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateRepair(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const body = req.body as z.infer<typeof updateRepairSchema>;

    const repair = await Repair.findOne({ _id: req.params.id, userId });
    if (!repair) {
      throw new AppError('Repair record not found.', 404, 'REPAIR_NOT_FOUND');
    }

    if (body.repairDate !== undefined) repair.repairDate = toUtcDateOnly(body.repairDate);
    if (body.problemDescription !== undefined) repair.problemDescription = body.problemDescription;
    if (body.repairCenter !== undefined) repair.repairCenter = body.repairCenter;
    if (body.repairCost !== undefined) repair.repairCost = body.repairCost;
    if (body.repairStatus !== undefined) repair.repairStatus = body.repairStatus;
    if (body.additionalNotes !== undefined) repair.additionalNotes = body.additionalNotes;
    if (body.repairInvoiceUrl !== undefined) repair.repairInvoiceUrl = body.repairInvoiceUrl;

    if (body.repairInvoiceDocumentId) {
      const doc = await DocumentModel.findOne({ _id: body.repairInvoiceDocumentId, userId });
      if (!doc) {
        throw new AppError('Referenced repair invoice document not found.', 404, 'DOCUMENT_NOT_FOUND');
      }
      repair.repairInvoiceDocumentId = doc._id;
      repair.repairInvoiceUrl = doc.url;
      doc.productId = repair.productId;
      doc.repairId = repair._id;
      await doc.save();
    }

    await repair.save();

    res.json({
      success: true,
      data: repair,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteRepair(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const repair = await Repair.findOneAndDelete({ _id: req.params.id, userId });

    if (!repair) {
      throw new AppError('Repair record not found.', 404, 'REPAIR_NOT_FOUND');
    }

    res.json({
      success: true,
      data: { message: 'Repair record deleted.' },
    });
  } catch (err) {
    next(err);
  }
}

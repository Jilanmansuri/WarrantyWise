import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { AMC, AmcStatus } from '../models/AMC';
import { DocumentModel } from '../models/Document';
import { Product } from '../models/Product';
import { recordProductEvent } from '../services/lifecycleService';
import { AppError } from '../utils/AppError';
import { addMonthsUtc, diffCalendarDays, toUtcDateOnly } from '../utils/dateUtils';

export const createAmcSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  contractNumber: z.string().trim().max(80).optional(),
  providerName: z.string().trim().min(2, 'Provider name is required').max(140),
  providerPhone: z.string().trim().max(30).optional(),
  providerEmail: z.string().trim().email().or(z.literal('')).optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'Expiry date is required'),
  cost: z.coerce.number().min(0).default(0),
  visitFrequencyMonths: z.coerce.number().int().min(1).max(24).default(6),
  scheduledVisitsCount: z.coerce.number().int().min(0).default(2),
  completedVisitsCount: z.coerce.number().int().min(0).default(0),
  nextVisitDate: z.string().optional(),
  contractDocumentId: z.string().trim().optional(),
  notes: z.string().trim().max(1500).optional(),
});

export const updateAmcSchema = createAmcSchema
  .omit({ productId: true })
  .extend({
    statusOverride: z.enum(['Active', 'Cancelled']).optional(),
  })
  .partial();

export function computeAmcStatus(amc: InstanceType<typeof AMC>, refDate = new Date()): {
  status: AmcStatus;
  remainingDays: number;
} {
  if (amc.statusOverride === 'Cancelled') {
    return { status: 'Cancelled', remainingDays: 0 };
  }
  const days = diffCalendarDays(refDate, amc.endDate);
  const status: AmcStatus =
    days < 0 ? 'Expired' : days <= 30 ? 'Expiring Soon' : 'Active';
  return { status, remainingDays: Math.max(0, days) };
}

function serializeAmc(amc: InstanceType<typeof AMC>) {
  const computed = computeAmcStatus(amc);
  return {
    ...amc.toObject(),
    status: computed.status,
    remainingDays: computed.remainingDays,
  };
}

export async function createAmc(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const body = req.body as z.infer<typeof createAmcSchema>;

    const product = await Product.findOne({ _id: body.productId, userId });
    if (!product) {
      throw new AppError('Product not found or access denied.', 404, 'PRODUCT_NOT_FOUND');
    }

    const startDate = toUtcDateOnly(body.startDate);
    const endDate = toUtcDateOnly(body.endDate);
    if (endDate.getTime() < startDate.getTime()) {
      throw new AppError('AMC end date cannot be earlier than start date.', 400, 'INVALID_DATES');
    }

    let docId = undefined;
    if (body.contractDocumentId) {
      const doc = await DocumentModel.findOne({ _id: body.contractDocumentId, userId });
      if (!doc) {
        throw new AppError('Contract document not found.', 404, 'DOCUMENT_NOT_FOUND');
      }
      doc.productId = product._id;
      docId = doc._id;
      await doc.save();
    }

    const nextVisitDate = body.nextVisitDate
      ? toUtcDateOnly(body.nextVisitDate)
      : addMonthsUtc(startDate, body.visitFrequencyMonths);

    const amc = await AMC.create({
      userId,
      productId: product._id,
      contractNumber: body.contractNumber,
      providerName: body.providerName,
      providerPhone: body.providerPhone,
      providerEmail: body.providerEmail || undefined,
      startDate,
      endDate,
      cost: body.cost,
      visitFrequencyMonths: body.visitFrequencyMonths,
      scheduledVisitsCount: body.scheduledVisitsCount,
      completedVisitsCount: body.completedVisitsCount,
      nextVisitDate,
      contractDocumentId: docId,
      notes: body.notes,
    });

    if (docId) {
      await DocumentModel.updateOne({ _id: docId, userId }, { $set: { amcId: amc._id } });
    }

    await recordProductEvent({
      userId,
      productId: product._id,
      eventType: 'AMC_ADDED',
      title: `AMC Contract Added (${body.providerName})`,
      description: `Coverage from ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`,
      amount: body.cost,
      eventDate: startDate,
    });

    res.status(201).json({
      success: true,
      data: serializeAmc(amc),
    });
  } catch (err) {
    next(err);
  }
}

export async function getAmcs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { productId, status } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = { userId };
    if (productId) filter.productId = productId;

    const list = await AMC.find(filter)
      .populate('productId', 'productName brand modelNumber category')
      .populate('contractDocumentId', 'title fileName url mimeType')
      .sort({ endDate: 1 });

    let serialized = list.map(serializeAmc);
    if (status && status !== 'All') {
      serialized = serialized.filter((item) => item.status === status);
    }

    res.json({
      success: true,
      data: serialized,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAmc(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const body = req.body as z.infer<typeof updateAmcSchema>;
    const amc = await AMC.findOne({ _id: req.params.id, userId });

    if (!amc) {
      throw new AppError('AMC contract not found.', 404, 'AMC_NOT_FOUND');
    }

    if (body.startDate !== undefined) amc.startDate = toUtcDateOnly(body.startDate);
    if (body.endDate !== undefined) amc.endDate = toUtcDateOnly(body.endDate);
    if (amc.endDate.getTime() < amc.startDate.getTime()) {
      throw new AppError('AMC end date cannot be earlier than start date.', 400, 'INVALID_DATES');
    }

    if (body.contractNumber !== undefined) amc.contractNumber = body.contractNumber;
    if (body.providerName !== undefined) amc.providerName = body.providerName;
    if (body.providerPhone !== undefined) amc.providerPhone = body.providerPhone;
    if (body.providerEmail !== undefined) amc.providerEmail = body.providerEmail || undefined;
    if (body.cost !== undefined) amc.cost = body.cost;
    if (body.visitFrequencyMonths !== undefined) amc.visitFrequencyMonths = body.visitFrequencyMonths;
    if (body.scheduledVisitsCount !== undefined) amc.scheduledVisitsCount = body.scheduledVisitsCount;
    if (body.completedVisitsCount !== undefined) amc.completedVisitsCount = body.completedVisitsCount;
    if (body.nextVisitDate !== undefined) {
      amc.nextVisitDate = body.nextVisitDate ? toUtcDateOnly(body.nextVisitDate) : undefined;
    }
    if (body.statusOverride !== undefined) amc.statusOverride = body.statusOverride;
    if (body.notes !== undefined) amc.notes = body.notes;

    if (body.contractDocumentId) {
      const doc = await DocumentModel.findOne({ _id: body.contractDocumentId, userId });
      if (!doc) {
        throw new AppError('Contract document not found.', 404, 'DOCUMENT_NOT_FOUND');
      }
      amc.contractDocumentId = doc._id;
      doc.productId = amc.productId;
      doc.amcId = amc._id;
      await doc.save();
    }

    await amc.save();

    res.json({
      success: true,
      data: serializeAmc(amc),
    });
  } catch (err) {
    next(err);
  }
}

export async function logAmcVisit(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const amc = await AMC.findOne({ _id: req.params.id, userId });
    if (!amc) {
      throw new AppError('AMC contract not found.', 404, 'AMC_NOT_FOUND');
    }

    amc.completedVisitsCount += 1;
    const candidateNext = addMonthsUtc(new Date(), amc.visitFrequencyMonths);
    amc.nextVisitDate =
      candidateNext.getTime() <= amc.endDate.getTime() ? candidateNext : undefined;
    await amc.save();

    await recordProductEvent({
      userId,
      productId: amc.productId,
      eventType: 'MAINTENANCE_LOGGED',
      title: `AMC Visit Completed (${amc.providerName})`,
      description: `Visit ${amc.completedVisitsCount} of ${amc.scheduledVisitsCount}`,
      eventDate: new Date(),
    });

    res.json({
      success: true,
      data: serializeAmc(amc),
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAmc(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const amc = await AMC.findOneAndDelete({ _id: req.params.id, userId });
    if (!amc) {
      throw new AppError('AMC contract not found.', 404, 'AMC_NOT_FOUND');
    }
    await DocumentModel.updateMany(
      { userId, amcId: amc._id },
      { $unset: { amcId: '' } }
    );
    res.json({
      success: true,
      data: { message: 'AMC contract deleted.' },
    });
  } catch (err) {
    next(err);
  }
}

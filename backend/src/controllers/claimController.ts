import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { DocumentModel } from '../models/Document';
import { Product } from '../models/Product';
import { CLAIM_STATUSES, IClaimChecklistEntry, WarrantyClaim } from '../models/WarrantyClaim';
import { recordProductEvent } from '../services/lifecycleService';
import { computeWarrantyMetrics } from '../services/warrantyService';
import { AppError } from '../utils/AppError';

export const CLAIM_ASSISTANT_DISCLAIMER =
  'WarrantyWise helps organize your claim documents and checklist, and does not guarantee manufacturer or retailer claim approval.';

export const createClaimSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  claimReferenceNumber: z.string().trim().max(80).optional(),
  manufacturerOrCenter: z.string().trim().min(2, 'Manufacturer or service center is required').max(160),
  contactPhone: z.string().trim().max(30).optional(),
  contactEmail: z.string().trim().email().or(z.literal('')).optional(),
  issueSummary: z.string().trim().min(3, 'Issue summary is required').max(1200),
  status: z.enum(CLAIM_STATUSES).default('Not Started'),
  supportingDocumentIds: z.array(z.string()).optional(),
  checklist: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        required: z.boolean(),
        completed: z.boolean(),
      })
    )
    .optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateClaimSchema = createClaimSchema.omit({ productId: true }).partial();

async function buildDefaultClaimChecklist(
  productId: string,
  userId: string
): Promise<IClaimChecklistEntry[]> {
  const [product, docs] = await Promise.all([
    Product.findOne({ _id: productId, userId }),
    DocumentModel.find({ userId, productId }),
  ]);

  const hasInvoice = Boolean(
    product?.invoiceDocumentId || docs.some((d) => d.type === 'Purchase Invoice')
  );
  const hasWarrantyCert = docs.some((d) => d.type === 'Warranty Certificate');
  const hasSerial = Boolean(product?.serialNumber && product.serialNumber.trim().length > 0);
  const metrics = product
    ? computeWarrantyMetrics(
        product.warrantyStartDate,
        product.warrantyEndDate,
        new Date(),
        product.extendedWarrantyStartDate,
        product.extendedWarrantyEndDate
      )
    : null;
  const warrantyActive = metrics ? metrics.warrantyStatus !== 'Expired' : false;

  return [
    {
      key: 'purchase_invoice',
      label: 'Original Purchase Invoice attached',
      required: true,
      completed: hasInvoice,
    },
    {
      key: 'serial_number',
      label: 'Device Serial / IMEI number recorded',
      required: true,
      completed: hasSerial,
    },
    {
      key: 'warranty_active',
      label: 'Verify warranty coverage is active',
      required: true,
      completed: warrantyActive,
    },
    {
      key: 'warranty_card',
      label: 'Warranty Certificate / Extended Plan document',
      required: false,
      completed: hasWarrantyCert || Boolean(product?.extendedWarrantyProvider),
    },
    {
      key: 'issue_photos',
      label: 'Photos/evidence of defect or issue attached',
      required: false,
      completed: false,
    },
  ];
}

export async function createClaim(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const body = req.body as z.infer<typeof createClaimSchema>;

    const product = await Product.findOne({ _id: body.productId, userId });
    if (!product) {
      throw new AppError('Product not found or access denied.', 404, 'PRODUCT_NOT_FOUND');
    }

    const checklist =
      body.checklist && body.checklist.length > 0
        ? body.checklist
        : await buildDefaultClaimChecklist(product._id.toString(), userId);

    const supportingDocumentIds: string[] = [];
    if (body.supportingDocumentIds && body.supportingDocumentIds.length > 0) {
      const ownedDocs = await DocumentModel.find({
        _id: { $in: body.supportingDocumentIds },
        userId,
      }).select('_id');
      supportingDocumentIds.push(...ownedDocs.map((d) => d._id.toString()));
    }

    const claim = await WarrantyClaim.create({
      userId,
      productId: product._id,
      claimReferenceNumber: body.claimReferenceNumber,
      manufacturerOrCenter: body.manufacturerOrCenter,
      contactPhone: body.contactPhone,
      contactEmail: body.contactEmail || undefined,
      issueSummary: body.issueSummary,
      status: body.status,
      submittedAt: body.status === 'Submitted' ? new Date() : undefined,
      checklist,
      supportingDocumentIds,
      notes: body.notes,
    });

    if (supportingDocumentIds.length > 0) {
      await DocumentModel.updateMany(
        { _id: { $in: supportingDocumentIds }, userId },
        { $set: { productId: product._id, claimId: claim._id } }
      );
    }

    await recordProductEvent({
      userId,
      productId: product._id,
      eventType: 'CLAIM_UPDATED',
      title: `Warranty Claim Created (${body.status})`,
      description: `${body.manufacturerOrCenter}: ${body.issueSummary}`,
      eventDate: new Date(),
    });

    res.status(201).json({
      success: true,
      data: claim,
      disclaimer: CLAIM_ASSISTANT_DISCLAIMER,
    });
  } catch (err) {
    next(err);
  }
}

export async function getClaims(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { productId, status } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = { userId };
    if (productId) filter.productId = productId;
    if (status && status !== 'All') filter.status = status;

    const claims = await WarrantyClaim.find(filter)
      .populate('productId', 'productName brand modelNumber serialNumber warrantyStartDate warrantyEndDate extendedWarrantyEndDate')
      .populate('supportingDocumentIds', 'title type fileName mimeType url')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: claims,
      disclaimer: CLAIM_ASSISTANT_DISCLAIMER,
    });
  } catch (err) {
    next(err);
  }
}

export async function getClaimPreparation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { productId } = req.params;
    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    }

    const metrics = computeWarrantyMetrics(
      product.warrantyStartDate,
      product.warrantyEndDate,
      new Date(),
      product.extendedWarrantyStartDate,
      product.extendedWarrantyEndDate
    );
    const checklist = await buildDefaultClaimChecklist(productId, userId);

    res.json({
      success: true,
      data: {
        productId: product._id.toString(),
        productName: product.productName,
        brand: product.brand,
        warrantyMetrics: metrics,
        requiredDocuments: [
          'Original Purchase Invoice / Receipt',
          'Product Serial Number or IMEI proof',
          'Warranty Certificate / Extended Plan (if applicable)',
          'Supporting defect photos or diagnostic notes',
        ],
        checklist,
        disclaimer: CLAIM_ASSISTANT_DISCLAIMER,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateClaim(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const body = req.body as z.infer<typeof updateClaimSchema>;
    const claim = await WarrantyClaim.findOne({ _id: req.params.id, userId });
    if (!claim) {
      throw new AppError('Warranty claim not found.', 404, 'CLAIM_NOT_FOUND');
    }

    const previousStatus = claim.status;
    if (body.claimReferenceNumber !== undefined) claim.claimReferenceNumber = body.claimReferenceNumber;
    if (body.manufacturerOrCenter !== undefined) claim.manufacturerOrCenter = body.manufacturerOrCenter;
    if (body.contactPhone !== undefined) claim.contactPhone = body.contactPhone;
    if (body.contactEmail !== undefined) claim.contactEmail = body.contactEmail || undefined;
    if (body.issueSummary !== undefined) claim.issueSummary = body.issueSummary;
    if (body.notes !== undefined) claim.notes = body.notes;
    if (body.checklist !== undefined) claim.checklist = body.checklist;
    if (body.status !== undefined) {
      claim.status = body.status;
      if (body.status === 'Submitted' && !claim.submittedAt) {
        claim.submittedAt = new Date();
      }
      if ((body.status === 'Resolved' || body.status === 'Approved') && !claim.resolvedAt) {
        claim.resolvedAt = new Date();
      }
    }

    if (body.supportingDocumentIds) {
      const ownedDocs = await DocumentModel.find({
        _id: { $in: body.supportingDocumentIds },
        userId,
      }).select('_id');
      claim.supportingDocumentIds = ownedDocs.map((d) => d._id);
      await DocumentModel.updateMany(
        { _id: { $in: claim.supportingDocumentIds }, userId },
        { $set: { productId: claim.productId, claimId: claim._id } }
      );
    }

    await claim.save();

    if (body.status && body.status !== previousStatus) {
      await recordProductEvent({
        userId,
        productId: claim.productId,
        eventType: 'CLAIM_UPDATED',
        title: `Claim Status: ${body.status}`,
        description: `${claim.manufacturerOrCenter}${claim.claimReferenceNumber ? ` • Ref #${claim.claimReferenceNumber}` : ''}`,
        eventDate: new Date(),
      });
    }

    const populated = await WarrantyClaim.findById(claim._id)
      .populate('productId', 'productName brand modelNumber serialNumber warrantyStartDate warrantyEndDate extendedWarrantyEndDate')
      .populate('supportingDocumentIds', 'title type fileName mimeType url');

    res.json({
      success: true,
      data: populated,
      disclaimer: CLAIM_ASSISTANT_DISCLAIMER,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteClaim(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const claim = await WarrantyClaim.findOneAndDelete({ _id: req.params.id, userId });
    if (!claim) {
      throw new AppError('Warranty claim not found.', 404, 'CLAIM_NOT_FOUND');
    }
    await DocumentModel.updateMany(
      { userId, claimId: claim._id },
      { $unset: { claimId: '' } }
    );
    res.json({ success: true, data: { message: 'Warranty claim deleted.' } });
  } catch (err) {
    next(err);
  }
}

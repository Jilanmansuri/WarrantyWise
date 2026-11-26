import crypto from 'crypto';
import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { AMC } from '../models/AMC';
import { DocumentModel } from '../models/Document';
import { FamilyMember } from '../models/FamilyMember';
import { Maintenance } from '../models/Maintenance';
import {
  IProduct,
  LIFECYCLE_STATUSES,
  PRODUCT_CATEGORIES,
  Product,
} from '../models/Product';
import { ProductEvent } from '../models/ProductEvent';
import { Repair } from '../models/Repair';
import { WarrantyClaim } from '../models/WarrantyClaim';
import { evaluateClaimReadiness } from '../services/claimReadinessService';
import { analyzeProductOwnershipCost } from '../services/costAnalyzerService';
import { resolveProductAccess } from '../services/familyAccessService';
import { computeProductHealthScore } from '../services/healthScoreService';
import {
  buildProductLifecycleTimeline,
  recordProductEvent,
} from '../services/lifecycleService';
import { deleteFileFromStorage } from '../services/storageService';
import {
  calculateExtendedWarrantyDates,
  calculateWarrantyDates,
  computeWarrantyMetrics,
} from '../services/warrantyService';
import { AppError } from '../utils/AppError';
import { diffCalendarDays, toUtcDateOnly } from '../utils/dateUtils';

export const createProductSchema = z.object({
  productName: z.string().trim().min(1, 'Product name is required').max(140),
  brand: z.string().trim().min(1, 'Brand is required').max(80),
  modelNumber: z.string().trim().max(80).optional(),
  serialNumber: z.string().trim().max(100).optional(),
  category: z.enum(PRODUCT_CATEGORIES).default('Other'),
  purchaseDate: z.string().min(1, 'Purchase date is required'),
  purchasePrice: z.coerce.number().min(0).optional(),
  currency: z.string().trim().max(10).default('USD'),
  sellerName: z.string().trim().max(120).optional(),
  invoiceNumber: z.string().trim().max(80).optional(),
  warrantyDurationMonths: z.coerce.number().int().min(0).max(600),
  warrantyStartDate: z.string().optional(),
  warrantyEndDate: z.string().optional(),
  // Extended warranty
  extendedWarrantyProvider: z.string().trim().max(120).optional(),
  extendedWarrantyMonths: z.coerce.number().int().min(0).max(600).optional(),
  extendedWarrantyCost: z.coerce.number().min(0).optional(),
  extendedWarrantyStartDate: z.string().optional(),
  extendedWarrantyEndDate: z.string().optional(),
  extendedWarrantyNotes: z.string().trim().max(1000).optional(),
  // Transfer & Lifecycle
  warrantyTransferable: z.boolean().optional(),
  transferredToName: z.string().trim().max(100).optional(),
  transferredToEmail: z.string().trim().email().or(z.literal('')).optional(),
  transferredAt: z.string().optional(),
  lifecycleStatus: z.enum(LIFECYCLE_STATUSES).optional(),
  resalePrice: z.coerce.number().min(0).optional(),
  resaleDate: z.string().optional(),
  resaleBuyerName: z.string().trim().max(100).optional(),
  disposalDate: z.string().optional(),
  disposalMethod: z.string().trim().max(120).optional(),
  disposalNotes: z.string().trim().max(1000).optional(),
  // Family Vault
  familyMemberId: z.string().trim().optional().nullable(),
  sharedWithFamily: z.boolean().optional(),
  // Offline sync
  clientMutationId: z.string().trim().max(100).optional(),
  version: z.coerce.number().int().optional(),
  // Attachments & Notes
  productImageUrl: z.string().trim().optional(),
  productImageDocumentId: z.string().trim().optional(),
  invoiceDocumentId: z.string().trim().optional(),
  additionalNotes: z.string().trim().max(2000).optional(),
});

export const updateProductSchema = createProductSchema.partial();

export function maskSerialNumber(serial?: string): string {
  if (!serial || !serial.trim()) return '';
  const trimmed = serial.trim();
  if (trimmed.length <= 4) return '••••';
  return `${'•'.repeat(trimmed.length - 4)}${trimmed.slice(-4)}`;
}

export function serializeProduct(
  product: IProduct,
  options?: { hasLinkedPurchaseInvoiceDoc?: boolean }
) {
  const metrics = computeWarrantyMetrics(
    product.warrantyStartDate,
    product.warrantyEndDate,
    new Date(),
    product.extendedWarrantyStartDate,
    product.extendedWarrantyEndDate
  );
  const claimReadiness = evaluateClaimReadiness(
    product,
    metrics,
    Boolean(options?.hasLinkedPurchaseInvoiceDoc)
  );

  return {
    id: product._id.toString(),
    userId: product.userId.toString(),
    productName: product.productName,
    brand: product.brand,
    modelNumber: product.modelNumber || '',
    serialNumber: product.serialNumber || '',
    category: product.category,
    purchaseDate: product.purchaseDate,
    purchasePrice: product.purchasePrice,
    currency: product.currency,
    sellerName: product.sellerName || '',
    invoiceNumber: product.invoiceNumber || '',
    warrantyDurationMonths: product.warrantyDurationMonths,
    warrantyStartDate: product.warrantyStartDate,
    warrantyEndDate: product.warrantyEndDate,
    extendedWarrantyProvider: product.extendedWarrantyProvider || '',
    extendedWarrantyMonths: product.extendedWarrantyMonths,
    extendedWarrantyCost: product.extendedWarrantyCost,
    extendedWarrantyStartDate: product.extendedWarrantyStartDate,
    extendedWarrantyEndDate: product.extendedWarrantyEndDate,
    extendedWarrantyNotes: product.extendedWarrantyNotes || '',
    warrantyTransferable: Boolean(product.warrantyTransferable),
    transferredToName: product.transferredToName || '',
    transferredToEmail: product.transferredToEmail || '',
    transferredAt: product.transferredAt,
    lifecycleStatus: product.lifecycleStatus || 'Active',
    resalePrice: product.resalePrice,
    resaleDate: product.resaleDate,
    resaleBuyerName: product.resaleBuyerName || '',
    disposalDate: product.disposalDate,
    disposalMethod: product.disposalMethod || '',
    disposalNotes: product.disposalNotes || '',
    familyMemberId: product.familyMemberId?.toString(),
    sharedWithFamily: Boolean(product.sharedWithFamily),
    qrToken: product.qrToken || '',
    qrGeneratedAt: product.qrGeneratedAt,
    version: product.version || 1,
    productImageUrl: product.productImageUrl || '',
    productImageDocumentId: product.productImageDocumentId?.toString(),
    invoiceDocumentId: product.invoiceDocumentId?.toString(),
    additionalNotes: product.additionalNotes || '',
    warrantyMetrics: metrics,
    claimReadiness,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

async function verifyOwnedDocument(docId: string | undefined, userId: string) {
  if (!docId) return null;
  const doc = await DocumentModel.findOne({ _id: docId, userId });
  if (!doc) {
    throw new AppError('Referenced document does not exist or access is denied.', 404, 'DOCUMENT_NOT_FOUND');
  }
  return doc;
}

export async function createProduct(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as z.infer<typeof createProductSchema>;
    const userId = req.userId!;

    if (body.clientMutationId) {
      const duplicate = await Product.findOne({ userId, clientMutationId: body.clientMutationId });
      if (duplicate) {
        res.status(200).json({
          success: true,
          data: serializeProduct(duplicate, { hasLinkedPurchaseInvoiceDoc: Boolean(duplicate.invoiceDocumentId) }),
          deduplicated: true,
        });
        return;
      }
    }

    const dates = calculateWarrantyDates({
      purchaseDate: body.purchaseDate,
      warrantyDurationMonths: body.warrantyDurationMonths,
      warrantyStartDate: body.warrantyStartDate,
      warrantyEndDate: body.warrantyEndDate,
    });

    const extDates = calculateExtendedWarrantyDates({
      standardEndDate: dates.warrantyEndDate,
      extendedWarrantyMonths: body.extendedWarrantyMonths,
      extendedWarrantyStartDate: body.extendedWarrantyStartDate,
      extendedWarrantyEndDate: body.extendedWarrantyEndDate,
    });

    if (body.familyMemberId) {
      const member = await FamilyMember.findOne({ _id: body.familyMemberId, userId });
      if (!member) {
        throw new AppError('Referenced family member not found.', 404, 'MEMBER_NOT_FOUND');
      }
    }

    const invoiceDoc = await verifyOwnedDocument(body.invoiceDocumentId, userId);
    const imageDoc = await verifyOwnedDocument(body.productImageDocumentId, userId);

    const product = await Product.create({
      userId,
      productName: body.productName,
      brand: body.brand,
      modelNumber: body.modelNumber,
      serialNumber: body.serialNumber,
      category: body.category,
      purchaseDate: dates.purchaseDate,
      purchasePrice: body.purchasePrice,
      currency: body.currency || 'USD',
      sellerName: body.sellerName,
      invoiceNumber: body.invoiceNumber,
      warrantyDurationMonths: dates.warrantyDurationMonths,
      warrantyStartDate: dates.warrantyStartDate,
      warrantyEndDate: dates.warrantyEndDate,
      extendedWarrantyProvider: body.extendedWarrantyProvider,
      extendedWarrantyMonths: extDates.extendedWarrantyMonths,
      extendedWarrantyCost: body.extendedWarrantyCost,
      extendedWarrantyStartDate: extDates.extendedWarrantyStartDate,
      extendedWarrantyEndDate: extDates.extendedWarrantyEndDate,
      extendedWarrantyNotes: body.extendedWarrantyNotes,
      warrantyTransferable: Boolean(body.warrantyTransferable),
      familyMemberId: body.familyMemberId || undefined,
      sharedWithFamily: Boolean(body.sharedWithFamily && body.familyMemberId),
      lifecycleStatus: body.lifecycleStatus || 'Active',
      clientMutationId: body.clientMutationId,
      productImageUrl: body.productImageUrl || imageDoc?.url,
      productImageDocumentId: imageDoc?._id,
      invoiceDocumentId: invoiceDoc?._id,
      additionalNotes: body.additionalNotes,
    });

    const docIdsToLink = [invoiceDoc?._id, imageDoc?._id].filter(Boolean);
    if (docIdsToLink.length > 0) {
      await DocumentModel.updateMany(
        { _id: { $in: docIdsToLink }, userId },
        { $set: { productId: product._id } }
      );
    }

    await recordProductEvent({
      userId,
      productId: product._id,
      eventType: 'PURCHASED',
      title: `${product.brand} ${product.productName} Registered`,
      description: product.sellerName ? `Purchased from ${product.sellerName}` : 'Added to WarrantyWise',
      amount: product.purchasePrice,
      eventDate: product.purchaseDate,
    });

    res.status(201).json({
      success: true,
      data: serializeProduct(product, { hasLinkedPurchaseInvoiceDoc: Boolean(invoiceDoc) }),
    });
  } catch (err) {
    next(err);
  }
}

export async function getProducts(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { search, category, status, familyMemberId, sort = 'purchaseDate_desc' } =
      req.query as Record<string, string>;

    const filter: Record<string, unknown> = { userId };

    if (category && category !== 'All') {
      filter.category = category;
    }
    if (familyMemberId && familyMemberId !== 'All') {
      filter.familyMemberId = familyMemberId;
    }

    if (search && search.trim().length > 0) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { productName: regex },
        { brand: regex },
        { modelNumber: regex },
        { serialNumber: regex },
        { sellerName: regex },
        { invoiceNumber: regex },
      ];
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      purchaseDate_desc: { purchaseDate: -1, createdAt: -1 },
      purchaseDate_asc: { purchaseDate: 1, createdAt: 1 },
      expiry_asc: { warrantyEndDate: 1 },
      recent: { createdAt: -1 },
    };

    const products = await Product.find(filter).sort(sortMap[sort] || sortMap.purchaseDate_desc);

    const productIds = products.map((p) => p._id);
    const invoiceDocs = await DocumentModel.find({
      userId,
      productId: { $in: productIds },
      type: 'Purchase Invoice',
    }).select('productId');
    const invoiceProductIdSet = new Set(invoiceDocs.map((d) => d.productId?.toString()));

    let serialized = products.map((product) =>
      serializeProduct(product, {
        hasLinkedPurchaseInvoiceDoc: invoiceProductIdSet.has(product._id.toString()),
      })
    );

    if (status && status !== 'All') {
      serialized = serialized.filter((p) => p.warrantyMetrics.warrantyStatus === status);
    }

    res.json({
      success: true,
      data: serialized,
    });
  } catch (err) {
    next(err);
  }
}

export async function getProductById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const access = await resolveProductAccess(req.params.id, userId);
    const product = access.product;

    // Backfill qrToken lazily for pre-existing records migrated from earlier schema
    if (!product.qrToken) {
      product.qrToken = `WW-${crypto.randomBytes(12).toString('hex')}`;
      product.qrGeneratedAt = new Date();
      await product.save();
    }

    const [repairs, documents, amcs, maintenances, claims, lifecycle] = await Promise.all([
      Repair.find({ productId: product._id }).sort({ repairDate: -1, createdAt: -1 }),
      access.canViewDocuments
        ? DocumentModel.find({ productId: product._id }).sort({ createdAt: -1 })
        : Promise.resolve([]),
      AMC.find({ productId: product._id }).sort({ endDate: 1 }),
      Maintenance.find({ productId: product._id }).sort({ nextServiceDate: 1 }),
      WarrantyClaim.find({ productId: product._id }).sort({ updatedAt: -1 }),
      buildProductLifecycleTimeline(product),
    ]);

    const hasPurchaseInvoice =
      Boolean(product.invoiceDocumentId) || documents.some((d) => d.type === 'Purchase Invoice');

    const healthScore = computeProductHealthScore({
      product,
      repairs,
      maintenances,
      claims,
    });

    const costAnalysis = analyzeProductOwnershipCost({
      product,
      repairs,
      maintenances,
      amcs,
    });

    res.json({
      success: true,
      data: {
        ...serializeProduct(product, { hasLinkedPurchaseInvoiceDoc: hasPurchaseInvoice }),
        isOwner: access.isOwner,
        canViewDocuments: access.canViewDocuments,
        repairs,
        documents,
        amcs,
        maintenances,
        claims,
        lifecycle,
        healthScore,
        costAnalysis,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const body = req.body as z.infer<typeof updateProductSchema>;
    const existing = await Product.findOne({ _id: req.params.id, userId });

    if (!existing) {
      throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    }

    if (body.version !== undefined && body.version < existing.version) {
      throw new AppError(
        'Sync conflict: this product was updated more recently on the server.',
        409,
        'SYNC_CONFLICT',
        { serverProduct: serializeProduct(existing) }
      );
    }

    const invoiceDoc = await verifyOwnedDocument(body.invoiceDocumentId, userId);
    const imageDoc = await verifyOwnedDocument(body.productImageDocumentId, userId);

    const needsDateRecalc =
      body.purchaseDate !== undefined ||
      body.warrantyDurationMonths !== undefined ||
      body.warrantyStartDate !== undefined ||
      body.warrantyEndDate !== undefined;

    if (needsDateRecalc) {
      const dates = calculateWarrantyDates({
        purchaseDate: body.purchaseDate ?? existing.purchaseDate,
        warrantyDurationMonths: body.warrantyDurationMonths ?? existing.warrantyDurationMonths,
        warrantyStartDate:
          body.warrantyStartDate ?? (body.purchaseDate ? undefined : existing.warrantyStartDate),
        warrantyEndDate: body.warrantyEndDate,
      });
      existing.purchaseDate = dates.purchaseDate;
      existing.warrantyStartDate = dates.warrantyStartDate;
      existing.warrantyEndDate = dates.warrantyEndDate;
      existing.warrantyDurationMonths = dates.warrantyDurationMonths;
    }

    const needsExtRecalc =
      body.extendedWarrantyMonths !== undefined ||
      body.extendedWarrantyStartDate !== undefined ||
      body.extendedWarrantyEndDate !== undefined;

    if (needsExtRecalc) {
      if (body.extendedWarrantyMonths === 0 && !body.extendedWarrantyEndDate) {
        existing.extendedWarrantyMonths = undefined;
        existing.extendedWarrantyStartDate = undefined;
        existing.extendedWarrantyEndDate = undefined;
      } else {
        const ext = calculateExtendedWarrantyDates({
          standardEndDate: existing.warrantyEndDate,
          extendedWarrantyMonths:
            body.extendedWarrantyMonths ?? existing.extendedWarrantyMonths,
          extendedWarrantyStartDate:
            body.extendedWarrantyStartDate ?? existing.extendedWarrantyStartDate,
          extendedWarrantyEndDate: body.extendedWarrantyEndDate,
        });
        existing.extendedWarrantyMonths = ext.extendedWarrantyMonths;
        existing.extendedWarrantyStartDate = ext.extendedWarrantyStartDate;
        existing.extendedWarrantyEndDate = ext.extendedWarrantyEndDate;
      }
    }

    if (body.productName !== undefined) existing.productName = body.productName;
    if (body.brand !== undefined) existing.brand = body.brand;
    if (body.modelNumber !== undefined) existing.modelNumber = body.modelNumber;
    if (body.serialNumber !== undefined) existing.serialNumber = body.serialNumber;
    if (body.category !== undefined) existing.category = body.category;
    if (body.purchasePrice !== undefined) existing.purchasePrice = body.purchasePrice;
    if (body.currency !== undefined) existing.currency = body.currency;
    if (body.sellerName !== undefined) existing.sellerName = body.sellerName;
    if (body.invoiceNumber !== undefined) existing.invoiceNumber = body.invoiceNumber;
    if (body.additionalNotes !== undefined) existing.additionalNotes = body.additionalNotes;
    if (body.productImageUrl !== undefined) existing.productImageUrl = body.productImageUrl;

    if (body.extendedWarrantyProvider !== undefined) {
      existing.extendedWarrantyProvider = body.extendedWarrantyProvider;
    }
    if (body.extendedWarrantyCost !== undefined) {
      existing.extendedWarrantyCost = body.extendedWarrantyCost;
    }
    if (body.extendedWarrantyNotes !== undefined) {
      existing.extendedWarrantyNotes = body.extendedWarrantyNotes;
    }
    if (body.warrantyTransferable !== undefined) {
      existing.warrantyTransferable = body.warrantyTransferable;
    }
    if (body.transferredToName !== undefined) {
      existing.transferredToName = body.transferredToName;
    }
    if (body.transferredToEmail !== undefined) {
      existing.transferredToEmail = body.transferredToEmail || undefined;
    }
    if (body.transferredAt !== undefined) {
      existing.transferredAt = body.transferredAt ? toUtcDateOnly(body.transferredAt) : undefined;
    }

    const prevLifecycle = existing.lifecycleStatus;
    if (body.lifecycleStatus !== undefined) existing.lifecycleStatus = body.lifecycleStatus;
    if (body.resalePrice !== undefined) existing.resalePrice = body.resalePrice;
    if (body.resaleDate !== undefined) {
      existing.resaleDate = body.resaleDate ? toUtcDateOnly(body.resaleDate) : undefined;
    }
    if (body.resaleBuyerName !== undefined) existing.resaleBuyerName = body.resaleBuyerName;
    if (body.disposalDate !== undefined) {
      existing.disposalDate = body.disposalDate ? toUtcDateOnly(body.disposalDate) : undefined;
    }
    if (body.disposalMethod !== undefined) existing.disposalMethod = body.disposalMethod;
    if (body.disposalNotes !== undefined) existing.disposalNotes = body.disposalNotes;

    if (body.familyMemberId !== undefined) {
      if (body.familyMemberId) {
        const member = await FamilyMember.findOne({ _id: body.familyMemberId, userId });
        if (!member) {
          throw new AppError('Family member not found.', 404, 'MEMBER_NOT_FOUND');
        }
        existing.familyMemberId = member._id;
      } else {
        existing.familyMemberId = undefined;
        existing.sharedWithFamily = false;
      }
    }
    if (body.sharedWithFamily !== undefined) {
      existing.sharedWithFamily = Boolean(body.sharedWithFamily && existing.familyMemberId);
    }

    if (imageDoc) {
      existing.productImageDocumentId = imageDoc._id;
      existing.productImageUrl = imageDoc.url;
      imageDoc.productId = existing._id;
      await imageDoc.save();
    }
    if (invoiceDoc) {
      existing.invoiceDocumentId = invoiceDoc._id;
      invoiceDoc.productId = existing._id;
      await invoiceDoc.save();
    }

    existing.version = (existing.version || 1) + 1;
    await existing.save();

    if (body.lifecycleStatus && body.lifecycleStatus !== prevLifecycle) {
      if (body.lifecycleStatus === 'Resold') {
        await recordProductEvent({
          userId,
          productId: existing._id,
          eventType: 'RESOLD',
          title: 'Product Marked as Resold',
          description: existing.resaleBuyerName ? `Buyer: ${existing.resaleBuyerName}` : undefined,
          amount: existing.resalePrice,
          eventDate: existing.resaleDate || new Date(),
        });
      } else if (body.lifecycleStatus === 'Disposed') {
        await recordProductEvent({
          userId,
          productId: existing._id,
          eventType: 'DISPOSED',
          title: 'Product Disposed',
          description: existing.disposalMethod,
          eventDate: existing.disposalDate || new Date(),
        });
      }
    }

    const hasPurchaseInvoice = Boolean(
      existing.invoiceDocumentId ||
        (await DocumentModel.exists({
          userId,
          productId: existing._id,
          type: 'Purchase Invoice',
        }))
    );

    res.json({
      success: true,
      data: serializeProduct(existing, { hasLinkedPurchaseInvoiceDoc: hasPurchaseInvoice }),
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const product = await Product.findOne({ _id: req.params.id, userId });

    if (!product) {
      throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    }

    const linkedDocs = await DocumentModel.find({ userId, productId: product._id });
    for (const doc of linkedDocs) {
      await deleteFileFromStorage(doc.storageProvider, doc.publicId, doc.resourceType);
    }

    await Promise.all([
      Repair.deleteMany({ userId, productId: product._id }),
      AMC.deleteMany({ userId, productId: product._id }),
      Maintenance.deleteMany({ userId, productId: product._id }),
      WarrantyClaim.deleteMany({ userId, productId: product._id }),
      ProductEvent.deleteMany({ userId, productId: product._id }),
      DocumentModel.deleteMany({ userId, productId: product._id }),
      Product.deleteOne({ _id: product._id, userId }),
    ]);

    res.json({
      success: true,
      data: { message: 'Product and associated records deleted.' },
    });
  } catch (err) {
    next(err);
  }
}

export async function getProductLifecycle(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const access = await resolveProductAccess(req.params.id, req.userId!);
    const timeline = await buildProductLifecycleTimeline(access.product);
    res.json({ success: true, data: timeline });
  } catch (err) {
    next(err);
  }
}

export async function getProductCostAnalysis(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const access = await resolveProductAccess(req.params.id, req.userId!);
    const product = access.product;
    const [repairs, maintenances, amcs] = await Promise.all([
      Repair.find({ productId: product._id }),
      Maintenance.find({ productId: product._id }),
      AMC.find({ productId: product._id }),
    ]);

    const analysis = analyzeProductOwnershipCost({
      product,
      repairs,
      maintenances,
      amcs,
    });
    res.json({ success: true, data: analysis });
  } catch (err) {
    next(err);
  }
}

export async function getProductHealthScore(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const access = await resolveProductAccess(req.params.id, req.userId!);
    const product = access.product;
    const [repairs, maintenances, claims] = await Promise.all([
      Repair.find({ productId: product._id }),
      Maintenance.find({ productId: product._id }),
      WarrantyClaim.find({ productId: product._id }),
    ]);

    const report = computeProductHealthScore({
      product,
      repairs,
      maintenances,
      claims,
    });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function getResaleSummary(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const access = await resolveProductAccess(req.params.id, req.userId!);
    const product = access.product;

    const [repairs, maintenances, documents] = await Promise.all([
      Repair.find({ productId: product._id }).sort({ repairDate: -1 }),
      Maintenance.find({ productId: product._id }),
      access.canViewDocuments
        ? DocumentModel.find({ productId: product._id }).select('title type fileName createdAt')
        : Promise.resolve([]),
    ]);

    const metrics = computeWarrantyMetrics(
      product.warrantyStartDate,
      product.warrantyEndDate,
      new Date(),
      product.extendedWarrantyStartDate,
      product.extendedWarrantyEndDate
    );
    const ageDays = Math.max(0, diffCalendarDays(product.purchaseDate, new Date()));

    res.json({
      success: true,
      data: {
        product: {
          id: product._id.toString(),
          productName: product.productName,
          brand: product.brand,
          modelNumber: product.modelNumber || '',
          serialNumber: maskSerialNumber(product.serialNumber),
          category: product.category,
          purchaseDate: product.purchaseDate,
          purchasePrice: product.purchasePrice,
          currency: product.currency,
          sellerName: product.sellerName || '',
          warrantyTransferable: Boolean(product.warrantyTransferable),
          lifecycleStatus: product.lifecycleStatus,
        },
        productAgeDays: ageDays,
        productAgeMonths: Math.floor(ageDays / 30.44),
        warrantyMetrics: metrics,
        repairs,
        maintenances,
        attachedInvoices: documents,
        disclaimer:
          'This resale report summarizes owner-recorded product, warranty, maintenance, and repair history. WarrantyWise does not certify physical or technical condition.',
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function regenerateQrToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await Product.findOne({ _id: req.params.id, userId: req.userId! });
    if (!product) {
      throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    }

    product.qrToken = `WW-${crypto.randomBytes(12).toString('hex')}`;
    product.qrGeneratedAt = new Date();
    await product.save();

    res.json({
      success: true,
      data: {
        qrToken: product.qrToken,
        qrGeneratedAt: product.qrGeneratedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function lookupProductByQrToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { qrToken } = req.params;
    const product = await Product.findOne({ qrToken });

    if (!product) {
      throw new AppError('QR Product Identity not found.', 404, 'QR_NOT_FOUND');
    }

    // Enforce authorization: only owner or explicitly shared family member
    await resolveProductAccess(product._id.toString(), userId);

    const repairs = await Repair.find({ productId: product._id })
      .select('repairDate problemDescription repairCenter repairStatus')
      .sort({ repairDate: -1 });

    const metrics = computeWarrantyMetrics(
      product.warrantyStartDate,
      product.warrantyEndDate,
      new Date(),
      product.extendedWarrantyStartDate,
      product.extendedWarrantyEndDate
    );

    // Strictly omit private invoices, purchase prices, and owner PII
    res.json({
      success: true,
      data: {
        id: product._id.toString(),
        productName: product.productName,
        brand: product.brand,
        modelNumber: product.modelNumber || '—',
        maskedSerialNumber: maskSerialNumber(product.serialNumber) || 'Not recorded',
        category: product.category,
        purchaseDate: product.purchaseDate,
        warrantyStatus: metrics.warrantyStatus,
        remainingDays: metrics.remainingDays,
        warrantyEndDate: product.extendedWarrantyEndDate || product.warrantyEndDate,
        repairs,
      },
    });
  } catch (err) {
    next(err);
  }
}

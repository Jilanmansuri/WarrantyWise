import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { DocumentModel } from '../models/Document';
import { IProduct, PRODUCT_CATEGORIES, Product } from '../models/Product';
import { Repair } from '../models/Repair';
import { evaluateClaimReadiness } from '../services/claimReadinessService';
import { deleteFileFromStorage } from '../services/storageService';
import { calculateWarrantyDates, computeWarrantyMetrics } from '../services/warrantyService';
import { AppError } from '../utils/AppError';

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
  productImageUrl: z.string().trim().optional(),
  productImageDocumentId: z.string().trim().optional(),
  invoiceDocumentId: z.string().trim().optional(),
  additionalNotes: z.string().trim().max(2000).optional(),
});

export const updateProductSchema = createProductSchema.partial();

export function serializeProduct(
  product: IProduct,
  options?: { hasLinkedPurchaseInvoiceDoc?: boolean }
) {
  const metrics = computeWarrantyMetrics(product.warrantyStartDate, product.warrantyEndDate);
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

    const dates = calculateWarrantyDates({
      purchaseDate: body.purchaseDate,
      warrantyDurationMonths: body.warrantyDurationMonths,
      warrantyStartDate: body.warrantyStartDate,
      warrantyEndDate: body.warrantyEndDate,
    });

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
    const { search, category, status, sort = 'purchaseDate_desc' } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = { userId };

    if (category && category !== 'All') {
      filter.category = category;
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
    const product = await Product.findOne({ _id: req.params.id, userId });

    if (!product) {
      throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    }

    const [repairs, documents] = await Promise.all([
      Repair.find({ userId, productId: product._id }).sort({ repairDate: -1, createdAt: -1 }),
      DocumentModel.find({ userId, productId: product._id }).sort({ createdAt: -1 }),
    ]);

    const hasPurchaseInvoice = documents.some((d) => d.type === 'Purchase Invoice');

    res.json({
      success: true,
      data: {
        ...serializeProduct(product, { hasLinkedPurchaseInvoiceDoc: hasPurchaseInvoice }),
        repairs,
        documents,
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
        warrantyStartDate: body.warrantyStartDate ?? (body.purchaseDate ? undefined : existing.warrantyStartDate),
        warrantyEndDate: body.warrantyEndDate,
      });
      existing.purchaseDate = dates.purchaseDate;
      existing.warrantyStartDate = dates.warrantyStartDate;
      existing.warrantyEndDate = dates.warrantyEndDate;
      existing.warrantyDurationMonths = dates.warrantyDurationMonths;
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

    await existing.save();

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

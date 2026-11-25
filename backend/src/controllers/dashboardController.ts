import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { DocumentModel } from '../models/Document';
import { Product } from '../models/Product';
import { Repair } from '../models/Repair';
import { serializeProduct } from './productController';

export async function getDashboardStats(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const [products, recentRepairs, totalDocuments] = await Promise.all([
      Product.find({ userId }).sort({ createdAt: -1 }),
      Repair.find({ userId })
        .populate('productId', 'productName brand modelNumber category')
        .sort({ repairDate: -1, updatedAt: -1 })
        .limit(5),
      DocumentModel.countDocuments({ userId }),
    ]);

    const invoiceDocs = await DocumentModel.find({
      userId,
      type: 'Purchase Invoice',
    }).select('productId');
    const invoiceProductSet = new Set(invoiceDocs.map((d) => d.productId?.toString()));

    const serialized = products.map((product) =>
      serializeProduct(product, {
        hasLinkedPurchaseInvoiceDoc: invoiceProductSet.has(product._id.toString()),
      })
    );

    let activeWarranties = 0;
    let expiringSoon = 0;
    let expiredWarranties = 0;

    for (const p of serialized) {
      if (p.warrantyMetrics.warrantyStatus === 'Active') activeWarranties += 1;
      else if (p.warrantyMetrics.warrantyStatus === 'Expiring Soon') expiringSoon += 1;
      else expiredWarranties += 1;
    }

    const recentlyAddedProducts = serialized.slice(0, 5);
    const upcomingExpiries = serialized
      .filter((p) => p.warrantyMetrics.warrantyStatus !== 'Expired')
      .sort((a, b) => a.warrantyMetrics.daysUntilExpiry - b.warrantyMetrics.daysUntilExpiry)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        stats: {
          totalProducts: serialized.length,
          activeWarranties,
          expiringSoon,
          expiredWarranties,
          totalDocuments,
          totalRepairs: recentRepairs.length,
        },
        recentlyAddedProducts,
        upcomingExpiries,
        recentlyRepairedProducts: recentRepairs,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getUpcomingExpiries(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const daysParam = Number(req.query.days || 30);
    const windowDays = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 30;

    const products = await Product.find({ userId }).sort({ warrantyEndDate: 1 });
    const serialized = products
      .map((p) => serializeProduct(p))
      .filter(
        (p) =>
          p.warrantyMetrics.daysUntilExpiry >= 0 &&
          p.warrantyMetrics.daysUntilExpiry <= windowDays
      )
      .sort((a, b) => a.warrantyMetrics.daysUntilExpiry - b.warrantyMetrics.daysUntilExpiry);

    res.json({
      success: true,
      data: serialized,
    });
  } catch (err) {
    next(err);
  }
}

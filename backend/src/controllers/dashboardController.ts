import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AMC } from '../models/AMC';
import { DocumentModel } from '../models/Document';
import { Maintenance } from '../models/Maintenance';
import { Product } from '../models/Product';
import { ProductEvent } from '../models/ProductEvent';
import { Repair } from '../models/Repair';
import { WarrantyClaim } from '../models/WarrantyClaim';
import { diffCalendarDays } from '../utils/dateUtils';
import { computeAmcStatus } from './amcController';
import { serializeProduct } from './productController';

export async function getDashboardStats(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const [products, recentRepairs, totalDocuments, amcs, maintenances, claims, recentEvents] =
      await Promise.all([
        Product.find({ userId }).sort({ createdAt: -1 }),
        Repair.find({ userId })
          .populate('productId', 'productName brand modelNumber category')
          .sort({ repairDate: -1, updatedAt: -1 })
          .limit(5),
        DocumentModel.countDocuments({ userId }),
        AMC.find({ userId }).populate('productId', 'productName brand'),
        Maintenance.find({ userId }).populate('productId', 'productName brand'),
        WarrantyClaim.find({ userId }),
        ProductEvent.find({ userId })
          .populate('productId', 'productName brand')
          .sort({ createdAt: -1 })
          .limit(8),
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

    const activeAmcContracts = amcs.filter((a) => {
      const s = computeAmcStatus(a).status;
      return s === 'Active' || s === 'Expiring Soon';
    }).length;

    const pendingClaims = claims.filter(
      (c) => c.status !== 'Resolved' && c.status !== 'Approved' && c.status !== 'Rejected'
    ).length;

    const now = new Date();
    const upcomingMaintenanceList = maintenances
      .filter((m) => m.status === 'Scheduled')
      .map((m) => ({
        id: m._id.toString(),
        title: m.title,
        productId:
          typeof m.productId === 'object' && m.productId
            ? String((m.productId as unknown as { _id: unknown })._id)
            : String(m.productId),
        productName:
          typeof m.productId === 'object' && m.productId
            ? `${(m.productId as unknown as { brand: string; productName: string }).brand} ${(m.productId as unknown as { productName: string }).productName}`
            : 'Product',
        nextServiceDate: m.nextServiceDate,
        daysUntilDue: diffCalendarDays(now, m.nextServiceDate),
      }))
      .filter((m) => m.daysUntilDue <= 30)
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    const recentlyAddedProducts = serialized.slice(0, 5);
    const upcomingExpiries = serialized
      .filter((p) => p.warrantyMetrics.warrantyStatus !== 'Expired')
      .sort((a, b) => a.warrantyMetrics.daysUntilExpiry - b.warrantyMetrics.daysUntilExpiry)
      .slice(0, 5);

    const warrantyAlerts = serialized
      .filter((p) => p.warrantyMetrics.warrantyStatus === 'Expiring Soon')
      .map((p) => ({
        id: `wa-${p.id}`,
        productId: p.id,
        title: `${p.brand} ${p.productName}`,
        message: `Warranty expires in ${p.warrantyMetrics.remainingDays} day(s)`,
        severity: p.warrantyMetrics.remainingDays <= 7 ? 'high' : 'medium',
      }));

    const maintenanceAlerts = upcomingMaintenanceList
      .filter((m) => m.daysUntilDue <= 14)
      .map((m) => ({
        id: `ma-${m.id}`,
        productId: m.productId,
        title: `${m.title} (${m.productName})`,
        message:
          m.daysUntilDue < 0
            ? `Overdue by ${Math.abs(m.daysUntilDue)} day(s)`
            : m.daysUntilDue === 0
              ? 'Service due today'
              : `Service due in ${m.daysUntilDue} day(s)`,
        severity: m.daysUntilDue <= 0 ? 'high' : 'medium',
      }));

    const upcomingEvents = [
      ...upcomingExpiries.map((p) => ({
        id: `ev-w-${p.id}`,
        date: p.extendedWarrantyEndDate || p.warrantyEndDate,
        type: 'warranty_expiry',
        title: `${p.brand} ${p.productName} Warranty Expires`,
        productId: p.id,
      })),
      ...upcomingMaintenanceList.slice(0, 5).map((m) => ({
        id: `ev-m-${m.id}`,
        date: m.nextServiceDate,
        type: 'maintenance',
        title: `${m.title} (${m.productName})`,
        productId: m.productId,
      })),
      ...amcs
        .filter((a) => computeAmcStatus(a).status !== 'Cancelled' && diffCalendarDays(now, a.endDate) >= 0)
        .slice(0, 4)
        .map((a) => ({
          id: `ev-a-${a._id}`,
          date: a.endDate,
          type: 'amc_expiry',
          title: `AMC Renewal: ${a.providerName}`,
          productId:
            typeof a.productId === 'object' && a.productId
              ? String((a.productId as unknown as { _id: unknown })._id)
              : String(a.productId),
        })),
    ]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 6);

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
          activeAmcContracts,
          pendingClaims,
          upcomingMaintenance: upcomingMaintenanceList.length,
        },
        recentlyAddedProducts,
        upcomingExpiries,
        recentlyRepairedProducts: recentRepairs,
        upcomingEvents,
        recentProductActivity: recentEvents,
        warrantyAlerts,
        maintenanceAlerts,
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

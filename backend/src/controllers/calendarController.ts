import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AMC } from '../models/AMC';
import { Maintenance } from '../models/Maintenance';
import { Product } from '../models/Product';
import { computeAmcStatus } from './amcController';

export type CalendarEventType = 'warranty_expiry' | 'extended_expiry' | 'maintenance' | 'amc_expiry' | 'amc_visit';

export interface CalendarEventItem {
  id: string;
  date: string; // YYYY-MM-DD
  type: CalendarEventType;
  title: string;
  subtitle: string;
  productId: string;
  referenceId: string;
  status?: string;
}

export async function getCalendarEvents(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { from, to } = req.query as { from?: string; to?: string };

    const [products, maintenances, amcs] = await Promise.all([
      Product.find({ userId }),
      Maintenance.find({ userId }).populate('productId', 'productName brand'),
      AMC.find({ userId }).populate('productId', 'productName brand'),
    ]);

    const events: CalendarEventItem[] = [];

    for (const p of products) {
      events.push({
        id: `std-exp-${p._id}`,
        date: p.warrantyEndDate.toISOString().slice(0, 10),
        type: 'warranty_expiry',
        title: `${p.brand} ${p.productName} Warranty Expires`,
        subtitle: 'Standard manufacturer warranty end date',
        productId: p._id.toString(),
        referenceId: p._id.toString(),
      });

      if (p.extendedWarrantyEndDate) {
        events.push({
          id: `ext-exp-${p._id}`,
          date: p.extendedWarrantyEndDate.toISOString().slice(0, 10),
          type: 'extended_expiry',
          title: `${p.brand} ${p.productName} Extended Warranty Expires`,
          subtitle: p.extendedWarrantyProvider || 'Extended protection plan',
          productId: p._id.toString(),
          referenceId: p._id.toString(),
        });
      }
    }

    for (const m of maintenances) {
      if (m.status === 'Skipped') continue;
      const prodObj = typeof m.productId === 'object' && m.productId ? (m.productId as unknown as { _id: unknown; productName: string; brand: string }) : null;
      const pid = prodObj ? String(prodObj._id) : String(m.productId);
      const label = prodObj ? `${prodObj.brand} ${prodObj.productName}` : 'Product';
      events.push({
        id: `maint-${m._id}`,
        date: m.nextServiceDate.toISOString().slice(0, 10),
        type: 'maintenance',
        title: `${m.title} (${label})`,
        subtitle: `${m.serviceType} • ${m.status}`,
        productId: pid,
        referenceId: m._id.toString(),
        status: m.status,
      });
    }

    for (const a of amcs) {
      const amcStatus = computeAmcStatus(a).status;
      if (amcStatus === 'Cancelled') continue;
      const prodObj = typeof a.productId === 'object' && a.productId ? (a.productId as unknown as { _id: unknown; productName: string; brand: string }) : null;
      const pid = prodObj ? String(prodObj._id) : String(a.productId);
      const label = prodObj ? `${prodObj.brand} ${prodObj.productName}` : 'Product';

      events.push({
        id: `amc-exp-${a._id}`,
        date: a.endDate.toISOString().slice(0, 10),
        type: 'amc_expiry',
        title: `AMC Renewal Due: ${label}`,
        subtitle: `${a.providerName} • ${amcStatus}`,
        productId: pid,
        referenceId: a._id.toString(),
        status: amcStatus,
      });

      if (a.nextVisitDate) {
        events.push({
          id: `amc-visit-${a._id}`,
          date: a.nextVisitDate.toISOString().slice(0, 10),
          type: 'amc_visit',
          title: `AMC Scheduled Visit: ${label}`,
          subtitle: a.providerName,
          productId: pid,
          referenceId: a._id.toString(),
        });
      }
    }

    const filtered = events
      .filter((e) => {
        if (from && e.date < from) return false;
        if (to && e.date > to) return false;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      data: filtered,
    });
  } catch (err) {
    next(err);
  }
}

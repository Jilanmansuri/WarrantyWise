import { Types } from 'mongoose';
import { AMC } from '../models/AMC';
import { Maintenance } from '../models/Maintenance';
import { IProduct } from '../models/Product';
import { ProductEvent, ProductEventType } from '../models/ProductEvent';
import { Repair } from '../models/Repair';
import { WarrantyClaim } from '../models/WarrantyClaim';

export interface LifecycleTimelineItem {
  id: string;
  eventType: ProductEventType | 'WARRANTY_EXPIRY';
  title: string;
  description: string;
  date: Date;
  amount?: number;
  badge?: string;
}

export async function recordProductEvent(params: {
  userId: string | Types.ObjectId;
  productId: string | Types.ObjectId;
  eventType: ProductEventType;
  title: string;
  description?: string;
  amount?: number;
  eventDate?: Date;
  metadata?: Record<string, unknown>;
}) {
  return ProductEvent.create({
    userId: params.userId,
    productId: params.productId,
    eventType: params.eventType,
    title: params.title,
    description: params.description,
    amount: params.amount,
    eventDate: params.eventDate || new Date(),
    metadata: params.metadata,
  });
}

export async function buildProductLifecycleTimeline(
  product: IProduct
): Promise<LifecycleTimelineItem[]> {
  const [events, repairs, maintenances, amcs, claims] = await Promise.all([
    ProductEvent.find({ productId: product._id }).sort({ eventDate: -1 }),
    Repair.find({ productId: product._id }).sort({ repairDate: -1 }),
    Maintenance.find({ productId: product._id }),
    AMC.find({ productId: product._id }).sort({ startDate: -1 }),
    WarrantyClaim.find({ productId: product._id }).sort({ updatedAt: -1 }),
  ]);

  const items: LifecycleTimelineItem[] = [];

  items.push({
    id: `purchase-${product._id}`,
    eventType: 'PURCHASED',
    title: 'Product Purchased',
    description: product.sellerName
      ? `Purchased from ${product.sellerName}${product.invoiceNumber ? ` (Inv #${product.invoiceNumber})` : ''}`
      : 'Initial purchase recorded',
    date: product.purchaseDate,
    amount: product.purchasePrice,
    badge: 'Purchase',
  });

  items.push({
    id: `warranty-start-${product._id}`,
    eventType: 'WARRANTY_STARTED',
    title: 'Standard Warranty Started',
    description: `${product.warrantyDurationMonths} month(s) coverage`,
    date: product.warrantyStartDate,
    badge: 'Warranty',
  });

  if (product.extendedWarrantyEndDate) {
    items.push({
      id: `ext-warranty-${product._id}`,
      eventType: 'EXTENDED_WARRANTY_ADDED',
      title: 'Extended Warranty Coverage',
      description: `${product.extendedWarrantyProvider || 'Extended Plan'} (${product.extendedWarrantyMonths || 0} months)`,
      date: product.extendedWarrantyStartDate || product.warrantyEndDate,
      amount: product.extendedWarrantyCost,
      badge: 'Extended',
    });
  }

  for (const r of repairs) {
    items.push({
      id: `repair-${r._id}`,
      eventType: 'REPAIR_LOGGED',
      title: `Repair: ${r.problemDescription}`,
      description: `${r.repairCenter} • Status: ${r.repairStatus}`,
      date: r.repairDate,
      amount: r.repairCost,
      badge: 'Repair',
    });
  }

  for (const m of maintenances) {
    for (const h of m.history || []) {
      items.push({
        id: `maint-${m._id}-${h._id || h.completedAt.getTime()}`,
        eventType: 'MAINTENANCE_LOGGED',
        title: `Maintenance: ${m.title}`,
        description: h.serviceProvider
          ? `${h.serviceProvider}${h.notes ? ` — ${h.notes}` : ''}`
          : h.notes || 'Routine maintenance completed',
        date: h.completedAt,
        amount: h.cost,
        badge: 'Maintenance',
      });
    }
  }

  for (const a of amcs) {
    items.push({
      id: `amc-${a._id}`,
      eventType: 'AMC_ADDED',
      title: `AMC Contract: ${a.providerName}`,
      description: `${a.completedVisitsCount}/${a.scheduledVisitsCount} visits completed`,
      date: a.startDate,
      amount: a.cost,
      badge: 'AMC',
    });
  }

  for (const c of claims) {
    items.push({
      id: `claim-${c._id}`,
      eventType: 'CLAIM_UPDATED',
      title: `Warranty Claim (${c.status})`,
      description: `${c.manufacturerOrCenter}${c.claimReferenceNumber ? ` • Ref #${c.claimReferenceNumber}` : ''}`,
      date: c.submittedAt || c.createdAt,
      badge: 'Claim',
    });
  }

  if (product.transferredAt) {
    items.push({
      id: `transfer-${product._id}`,
      eventType: 'WARRANTY_TRANSFERRED',
      title: 'Warranty Transferred',
      description: `Transferred to ${product.transferredToName || product.transferredToEmail || 'new owner'}`,
      date: product.transferredAt,
      badge: 'Transfer',
    });
  }

  if (product.lifecycleStatus === 'Resold' && product.resaleDate) {
    items.push({
      id: `resold-${product._id}`,
      eventType: 'RESOLD',
      title: 'Product Resold',
      description: product.resaleBuyerName
        ? `Sold to ${product.resaleBuyerName}`
        : 'Marked as resold',
      date: product.resaleDate,
      amount: product.resalePrice,
      badge: 'Resale',
    });
  }

  if (product.lifecycleStatus === 'Disposed' && product.disposalDate) {
    items.push({
      id: `disposed-${product._id}`,
      eventType: 'DISPOSED',
      title: 'Product Disposed / Recycled',
      description: product.disposalMethod || 'Lifecycle ended',
      date: product.disposalDate,
      badge: 'Disposed',
    });
  }

  // Include any custom ProductEvents not already represented above
  for (const ev of events) {
    if (
      ev.eventType === 'WARRANTY_TRANSFERRED' ||
      ev.eventType === 'RESOLD' ||
      ev.eventType === 'DISPOSED'
    ) {
      continue;
    }
    if (
      ev.eventType !== 'PURCHASED' &&
      ev.eventType !== 'REPAIR_LOGGED' &&
      ev.eventType !== 'MAINTENANCE_LOGGED' &&
      ev.eventType !== 'AMC_ADDED' &&
      ev.eventType !== 'CLAIM_UPDATED'
    ) {
      items.push({
        id: `ev-${ev._id}`,
        eventType: ev.eventType,
        title: ev.title,
        description: ev.description || '',
        date: ev.eventDate,
        amount: ev.amount,
        badge: 'Event',
      });
    }
  }

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

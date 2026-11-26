import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { MAINTENANCE_STATUSES, Maintenance } from '../models/Maintenance';
import { Product } from '../models/Product';
import { recordProductEvent } from '../services/lifecycleService';
import { AppError } from '../utils/AppError';
import { addMonthsUtc, diffCalendarDays, toUtcDateOnly } from '../utils/dateUtils';

export const createMaintenanceSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  title: z.string().trim().min(2, 'Title is required').max(140),
  serviceType: z.string().trim().max(100).default('Routine Servicing'),
  frequencyMonths: z.coerce.number().int().min(0).max(60).default(6),
  lastServiceDate: z.string().optional(),
  nextServiceDate: z.string().min(1, 'Next service date is required'),
  serviceProvider: z.string().trim().max(140).optional(),
  estimatedCost: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(1500).optional(),
  clientMutationId: z.string().trim().max(100).optional(),
});

export const updateMaintenanceSchema = createMaintenanceSchema
  .omit({ productId: true })
  .extend({
    status: z.enum(MAINTENANCE_STATUSES).optional(),
    version: z.coerce.number().int().optional(),
  })
  .partial();

export const completeMaintenanceSchema = z.object({
  completedAt: z.string().optional(),
  cost: z.coerce.number().min(0).default(0),
  serviceProvider: z.string().trim().max(140).optional(),
  notes: z.string().trim().max(1000).optional(),
  clientMutationId: z.string().trim().max(100).optional(),
});

function serializeMaintenance(m: InstanceType<typeof Maintenance>) {
  const daysUntilDue = diffCalendarDays(new Date(), m.nextServiceDate);
  const isOverdue = m.status === 'Scheduled' && daysUntilDue < 0;
  return {
    ...m.toObject(),
    daysUntilDue,
    isOverdue,
  };
}

export async function createMaintenance(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const body = req.body as z.infer<typeof createMaintenanceSchema>;

    // Deduplicate offline retries by clientMutationId
    if (body.clientMutationId) {
      const existingDup = await Maintenance.findOne({
        userId,
        clientMutationId: body.clientMutationId,
      });
      if (existingDup) {
        res.status(200).json({ success: true, data: serializeMaintenance(existingDup), deduplicated: true });
        return;
      }
    }

    const product = await Product.findOne({ _id: body.productId, userId });
    if (!product) {
      throw new AppError('Product not found or access denied.', 404, 'PRODUCT_NOT_FOUND');
    }

    const maintenance = await Maintenance.create({
      userId,
      productId: product._id,
      title: body.title,
      serviceType: body.serviceType || 'Routine Servicing',
      frequencyMonths: body.frequencyMonths,
      lastServiceDate: body.lastServiceDate ? toUtcDateOnly(body.lastServiceDate) : undefined,
      nextServiceDate: toUtcDateOnly(body.nextServiceDate),
      serviceProvider: body.serviceProvider,
      estimatedCost: body.estimatedCost,
      notes: body.notes,
      clientMutationId: body.clientMutationId,
    });

    res.status(201).json({
      success: true,
      data: serializeMaintenance(maintenance),
    });
  } catch (err) {
    next(err);
  }
}

export async function getMaintenances(
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

    const items = await Maintenance.find(filter)
      .populate('productId', 'productName brand modelNumber category')
      .sort({ nextServiceDate: 1 });

    res.json({
      success: true,
      data: items.map(serializeMaintenance),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMaintenance(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const body = req.body as z.infer<typeof updateMaintenanceSchema>;
    const m = await Maintenance.findOne({ _id: req.params.id, userId });
    if (!m) {
      throw new AppError('Maintenance schedule not found.', 404, 'MAINTENANCE_NOT_FOUND');
    }

    if (body.version !== undefined && body.version < m.version) {
      throw new AppError(
        'Sync conflict: this maintenance record was modified more recently on the server.',
        409,
        'SYNC_CONFLICT',
        { serverRecord: serializeMaintenance(m) }
      );
    }

    if (body.title !== undefined) m.title = body.title;
    if (body.serviceType !== undefined) m.serviceType = body.serviceType;
    if (body.frequencyMonths !== undefined) m.frequencyMonths = body.frequencyMonths;
    if (body.lastServiceDate !== undefined) {
      m.lastServiceDate = body.lastServiceDate ? toUtcDateOnly(body.lastServiceDate) : undefined;
    }
    if (body.nextServiceDate !== undefined) {
      m.nextServiceDate = toUtcDateOnly(body.nextServiceDate);
    }
    if (body.serviceProvider !== undefined) m.serviceProvider = body.serviceProvider;
    if (body.estimatedCost !== undefined) m.estimatedCost = body.estimatedCost;
    if (body.status !== undefined) m.status = body.status;
    if (body.notes !== undefined) m.notes = body.notes;
    m.version += 1;

    await m.save();
    res.json({ success: true, data: serializeMaintenance(m) });
  } catch (err) {
    next(err);
  }
}

export async function completeMaintenance(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const body = req.body as z.infer<typeof completeMaintenanceSchema>;
    const m = await Maintenance.findOne({ _id: req.params.id, userId });
    if (!m) {
      throw new AppError('Maintenance schedule not found.', 404, 'MAINTENANCE_NOT_FOUND');
    }

    if (
      body.clientMutationId &&
      m.history.some((h) => h.clientMutationId === body.clientMutationId)
    ) {
      res.json({ success: true, data: serializeMaintenance(m), deduplicated: true });
      return;
    }

    const completedAt = body.completedAt ? toUtcDateOnly(body.completedAt) : toUtcDateOnly(new Date());
    m.history.unshift({
      completedAt,
      cost: body.cost,
      serviceProvider: body.serviceProvider || m.serviceProvider,
      notes: body.notes,
      clientMutationId: body.clientMutationId,
    });
    m.lastServiceDate = completedAt;

    if (m.frequencyMonths > 0) {
      m.nextServiceDate = addMonthsUtc(completedAt, m.frequencyMonths);
      m.status = 'Scheduled';
    } else {
      m.status = 'Completed';
    }
    if (body.notes) {
      m.notes = body.notes;
    }
    m.version += 1;
    await m.save();

    await recordProductEvent({
      userId,
      productId: m.productId,
      eventType: 'MAINTENANCE_LOGGED',
      title: `Maintenance: ${m.title}`,
      description: body.notes || `Completed via ${body.serviceProvider || m.serviceProvider || 'service log'}`,
      amount: body.cost,
      eventDate: completedAt,
    });

    res.json({ success: true, data: serializeMaintenance(m) });
  } catch (err) {
    next(err);
  }
}

export async function deleteMaintenance(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const m = await Maintenance.findOneAndDelete({ _id: req.params.id, userId });
    if (!m) {
      throw new AppError('Maintenance schedule not found.', 404, 'MAINTENANCE_NOT_FOUND');
    }
    res.json({ success: true, data: { message: 'Maintenance schedule deleted.' } });
  } catch (err) {
    next(err);
  }
}

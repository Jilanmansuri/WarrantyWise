import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { FAMILY_RELATIONSHIPS, FamilyMember } from '../models/FamilyMember';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { computeWarrantyMetrics } from '../services/warrantyService';
import { AppError } from '../utils/AppError';

export const familyMemberSchema = z.object({
  name: z.string().trim().min(2, 'Member name is required').max(80),
  relationship: z.enum(FAMILY_RELATIONSHIPS).default('Other'),
  email: z.string().trim().email('Invalid email').toLowerCase().or(z.literal('')).optional(),
  permissions: z
    .object({
      canViewWarranties: z.boolean().default(true),
      canViewDocuments: z.boolean().default(false),
      canReceiveReminders: z.boolean().default(true),
    })
    .optional(),
  notes: z.string().trim().max(500).optional(),
});

export const updateFamilyMemberSchema = familyMemberSchema.partial();

export async function createFamilyMember(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const body = req.body as z.infer<typeof familyMemberSchema>;
    const normalizedEmail = body.email ? body.email.trim().toLowerCase() : undefined;

    let linkedUserId = undefined;
    if (normalizedEmail) {
      const matchedUser = await User.findOne({ email: normalizedEmail }).select('_id');
      if (matchedUser && matchedUser._id.toString() !== userId) {
        linkedUserId = matchedUser._id;
      }
    }

    const member = await FamilyMember.create({
      userId,
      name: body.name,
      relationship: body.relationship,
      email: normalizedEmail,
      linkedUserId,
      permissions: body.permissions || {
        canViewWarranties: true,
        canViewDocuments: false,
        canReceiveReminders: true,
      },
      notes: body.notes,
    });

    res.status(201).json({ success: true, data: member });
  } catch (err) {
    next(err);
  }
}

export async function getFamilyDashboard(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const [members, ownProducts, sharedLinks] = await Promise.all([
      FamilyMember.find({ userId }).sort({ name: 1 }),
      Product.find({ userId }).sort({ createdAt: -1 }),
      FamilyMember.find({ linkedUserId: userId, 'permissions.canViewWarranties': true }),
    ]);

    const memberSummaries = members.map((m) => {
      const assigned = ownProducts.filter(
        (p) => p.familyMemberId?.toString() === m._id.toString()
      );
      const metricsList = assigned.map((p) =>
        computeWarrantyMetrics(
          p.warrantyStartDate,
          p.warrantyEndDate,
          new Date(),
          p.extendedWarrantyStartDate,
          p.extendedWarrantyEndDate
        )
      );
      return {
        ...m.toObject(),
        productCount: assigned.length,
        activeWarranties: metricsList.filter((w) => w.warrantyStatus === 'Active').length,
        expiringSoon: metricsList.filter((w) => w.warrantyStatus === 'Expiring Soon').length,
        products: assigned.map((p, idx) => ({
          id: p._id.toString(),
          productName: p.productName,
          brand: p.brand,
          category: p.category,
          sharedWithFamily: p.sharedWithFamily,
          warrantyEndDate: p.warrantyEndDate,
          extendedWarrantyEndDate: p.extendedWarrantyEndDate,
          warrantyMetrics: metricsList[idx],
        })),
      };
    });

    // Products explicitly shared WITH this user by other family vault owners (single query)
    const sharedProducts: Array<Record<string, unknown>> = [];
    if (sharedLinks.length > 0) {
      const linkMap = new Map(sharedLinks.map((l) => [l._id.toString(), l]));
      const ownerProducts = await Product.find({
        sharedWithFamily: true,
        $or: sharedLinks.map((link) => ({
          userId: link.userId,
          familyMemberId: link._id,
        })),
      }).populate('userId', 'name');

      for (const p of ownerProducts) {
        const link = p.familyMemberId ? linkMap.get(p.familyMemberId.toString()) : undefined;
        if (!link) continue;
        const metrics = computeWarrantyMetrics(
          p.warrantyStartDate,
          p.warrantyEndDate,
          new Date(),
          p.extendedWarrantyStartDate,
          p.extendedWarrantyEndDate
        );
        sharedProducts.push({
          id: p._id.toString(),
          productName: p.productName,
          brand: p.brand,
          category: p.category,
          purchaseDate: p.purchaseDate,
          warrantyEndDate: p.warrantyEndDate,
          extendedWarrantyEndDate: p.extendedWarrantyEndDate,
          warrantyMetrics: metrics,
          canViewDocuments: link.permissions.canViewDocuments,
          canReceiveReminders: link.permissions.canReceiveReminders,
          ownerName:
            typeof p.userId === 'object' && p.userId && 'name' in p.userId
              ? (p.userId as { name: string }).name
              : 'Family Owner',
        });
      }
    }

    const totalAssigned = ownProducts.filter((p) => Boolean(p.familyMemberId)).length;
    const allFamilyMetrics = ownProducts.map((p) =>
      computeWarrantyMetrics(
        p.warrantyStartDate,
        p.warrantyEndDate,
        new Date(),
        p.extendedWarrantyStartDate,
        p.extendedWarrantyEndDate
      )
    );

    res.json({
      success: true,
      data: {
        summary: {
          memberCount: members.length,
          assignedProductsCount: totalAssigned,
          unassignedProductsCount: ownProducts.length - totalAssigned,
          activeFamilyWarranties: allFamilyMetrics.filter((m) => m.warrantyStatus === 'Active').length,
          expiringFamilyWarranties: allFamilyMetrics.filter(
            (m) => m.warrantyStatus === 'Expiring Soon'
          ).length,
          sharedWithMeCount: sharedProducts.length,
        },
        members: memberSummaries,
        sharedWithMe: sharedProducts,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateFamilyMember(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const body = req.body as z.infer<typeof updateFamilyMemberSchema>;
    const member = await FamilyMember.findOne({ _id: req.params.id, userId });
    if (!member) {
      throw new AppError('Family member not found.', 404, 'MEMBER_NOT_FOUND');
    }

    if (body.name !== undefined) member.name = body.name;
    if (body.relationship !== undefined) member.relationship = body.relationship;
    if (body.notes !== undefined) member.notes = body.notes;
    if (body.permissions !== undefined) {
      member.permissions = { ...member.permissions, ...body.permissions };
    }
    if (body.email !== undefined) {
      const normalized = body.email.trim().toLowerCase();
      member.email = normalized || undefined;
      if (normalized) {
        const matched = await User.findOne({ email: normalized }).select('_id');
        member.linkedUserId =
          matched && matched._id.toString() !== userId ? matched._id : undefined;
      } else {
        member.linkedUserId = undefined;
      }
    }

    await member.save();
    res.json({ success: true, data: member });
  } catch (err) {
    next(err);
  }
}

export async function assignProductToMember(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { productId, familyMemberId, sharedWithFamily } = req.body as {
      productId: string;
      familyMemberId?: string | null;
      sharedWithFamily?: boolean;
    };

    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    }

    if (familyMemberId) {
      const member = await FamilyMember.findOne({ _id: familyMemberId, userId });
      if (!member) {
        throw new AppError('Family member not found.', 404, 'MEMBER_NOT_FOUND');
      }
      product.familyMemberId = member._id;
      product.sharedWithFamily = Boolean(sharedWithFamily);
    } else {
      product.familyMemberId = undefined;
      product.sharedWithFamily = false;
    }

    await product.save();
    res.json({ success: true, data: { productId: product._id.toString(), familyMemberId: product.familyMemberId?.toString(), sharedWithFamily: product.sharedWithFamily } });
  } catch (err) {
    next(err);
  }
}

export async function deleteFamilyMember(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const member = await FamilyMember.findOneAndDelete({ _id: req.params.id, userId });
    if (!member) {
      throw new AppError('Family member not found.', 404, 'MEMBER_NOT_FOUND');
    }

    await Product.updateMany(
      { userId, familyMemberId: member._id },
      { $unset: { familyMemberId: '' }, $set: { sharedWithFamily: false } }
    );

    res.json({ success: true, data: { message: 'Family member removed.' } });
  } catch (err) {
    next(err);
  }
}

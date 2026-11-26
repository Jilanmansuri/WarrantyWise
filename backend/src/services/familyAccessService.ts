import { FamilyMember, IFamilyMember } from '../models/FamilyMember';
import { IProduct, Product } from '../models/Product';
import { AppError } from '../utils';

export interface ProductAccessResult {
  product: IProduct;
  isOwner: boolean;
  canViewDocuments: boolean;
  sharedViaMember?: IFamilyMember;
}

/**
 * Resolves whether `userId` can access `productId` either as the product owner
 * or as an authorized linked FamilyMember on a shared product.
 */
export async function resolveProductAccess(
  productId: string,
  userId: string
): Promise<ProductAccessResult> {
  const product = await Product.findById(productId);
  if (!product) {
    throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
  }

  if (product.userId.toString() === userId) {
    return {
      product,
      isOwner: true,
      canViewDocuments: true,
    };
  }

  if (product.sharedWithFamily && product.familyMemberId) {
    const member = await FamilyMember.findOne({
      _id: product.familyMemberId,
      userId: product.userId,
      linkedUserId: userId,
    });

    if (member && member.permissions.canViewWarranties) {
      return {
        product,
        isOwner: false,
        canViewDocuments: Boolean(member.permissions.canViewDocuments),
        sharedViaMember: member,
      };
    }
  }

  throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
}

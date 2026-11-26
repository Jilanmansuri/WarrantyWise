import crypto from 'crypto';
import mongoose, { Document as MongooseDocument, Schema, Types } from 'mongoose';

export const PRODUCT_CATEGORIES = [
  'Smartphones',
  'Laptops & Computers',
  'Tablets & Wearables',
  'TVs & Audio',
  'Home Appliances',
  'Kitchen Appliances',
  'Gaming & Cameras',
  'Other',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const LIFECYCLE_STATUSES = [
  'Active',
  'Listed for Resale',
  'Resold',
  'Disposed',
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export interface IProduct extends MongooseDocument {
  userId: Types.ObjectId;
  productName: string;
  brand: string;
  modelNumber?: string;
  serialNumber?: string;
  category: ProductCategory;
  purchaseDate: Date;
  purchasePrice?: number;
  currency: string;
  sellerName?: string;
  invoiceNumber?: string;
  warrantyDurationMonths: number;
  warrantyStartDate: Date;
  warrantyEndDate: Date;
  // Extended Warranty
  extendedWarrantyProvider?: string;
  extendedWarrantyMonths?: number;
  extendedWarrantyCost?: number;
  extendedWarrantyStartDate?: Date;
  extendedWarrantyEndDate?: Date;
  extendedWarrantyNotes?: string;
  // Warranty Transfer & Resale / Disposal Lifecycle
  warrantyTransferable: boolean;
  transferredToName?: string;
  transferredToEmail?: string;
  transferredAt?: Date;
  lifecycleStatus: LifecycleStatus;
  resalePrice?: number;
  resaleDate?: Date;
  resaleBuyerName?: string;
  disposalDate?: Date;
  disposalMethod?: string;
  disposalNotes?: string;
  // Family Vault Assignment
  familyMemberId?: Types.ObjectId;
  sharedWithFamily: boolean;
  // QR Product Identity
  qrToken: string;
  qrGeneratedAt: Date;
  // Offline Sync & Conflict Tracking
  clientMutationId?: string;
  version: number;
  // Media & Notes
  productImageUrl?: string;
  productImageDocumentId?: Types.ObjectId;
  invoiceDocumentId?: Types.ObjectId;
  additionalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [140, 'Product name cannot exceed 140 characters'],
    },
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true,
      maxlength: [80, 'Brand cannot exceed 80 characters'],
    },
    modelNumber: {
      type: String,
      trim: true,
      maxlength: [80, 'Model number cannot exceed 80 characters'],
    },
    serialNumber: {
      type: String,
      trim: true,
      maxlength: [100, 'Serial number cannot exceed 100 characters'],
    },
    category: {
      type: String,
      enum: PRODUCT_CATEGORIES,
      default: 'Other',
      required: true,
    },
    purchaseDate: {
      type: Date,
      required: [true, 'Purchase date is required'],
    },
    purchasePrice: {
      type: Number,
      min: [0, 'Purchase price cannot be negative'],
    },
    currency: {
      type: String,
      default: 'USD',
      trim: true,
      maxlength: 10,
    },
    sellerName: {
      type: String,
      trim: true,
      maxlength: [120, 'Seller name cannot exceed 120 characters'],
    },
    invoiceNumber: {
      type: String,
      trim: true,
      maxlength: [80, 'Invoice number cannot exceed 80 characters'],
    },
    warrantyDurationMonths: {
      type: Number,
      required: [true, 'Warranty duration is required'],
      min: [0, 'Warranty duration cannot be negative'],
      max: [600, 'Warranty duration cannot exceed 600 months'],
    },
    warrantyStartDate: {
      type: Date,
      required: [true, 'Warranty start date is required'],
    },
    warrantyEndDate: {
      type: Date,
      required: [true, 'Warranty end date is required'],
    },
    extendedWarrantyProvider: {
      type: String,
      trim: true,
      maxlength: [120, 'Extended warranty provider cannot exceed 120 characters'],
    },
    extendedWarrantyMonths: {
      type: Number,
      min: [0, 'Extended warranty months cannot be negative'],
      max: [600, 'Extended warranty months cannot exceed 600'],
    },
    extendedWarrantyCost: {
      type: Number,
      min: [0, 'Extended warranty cost cannot be negative'],
    },
    extendedWarrantyStartDate: {
      type: Date,
    },
    extendedWarrantyEndDate: {
      type: Date,
    },
    extendedWarrantyNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Extended warranty notes cannot exceed 1000 characters'],
    },
    warrantyTransferable: {
      type: Boolean,
      default: false,
    },
    transferredToName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    transferredToEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    transferredAt: {
      type: Date,
    },
    lifecycleStatus: {
      type: String,
      enum: LIFECYCLE_STATUSES,
      default: 'Active',
    },
    resalePrice: {
      type: Number,
      min: 0,
    },
    resaleDate: {
      type: Date,
    },
    resaleBuyerName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    disposalDate: {
      type: Date,
    },
    disposalMethod: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    disposalNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    familyMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'FamilyMember',
      index: true,
    },
    sharedWithFamily: {
      type: Boolean,
      default: false,
    },
    qrToken: {
      type: String,
      unique: true,
      sparse: true,
      default: () => `WW-${crypto.randomBytes(12).toString('hex')}`,
    },
    qrGeneratedAt: {
      type: Date,
      default: () => new Date(),
    },
    clientMutationId: {
      type: String,
      trim: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    productImageUrl: {
      type: String,
      trim: true,
    },
    productImageDocumentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
    },
    invoiceDocumentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
    },
    additionalNotes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
    },
  },
  { timestamps: true }
);

productSchema.index({ userId: 1, purchaseDate: -1 });
productSchema.index({ userId: 1, warrantyEndDate: 1 });
productSchema.index({ userId: 1, category: 1 });
productSchema.index({ userId: 1, createdAt: -1 });
productSchema.index({ userId: 1, familyMemberId: 1 });
productSchema.index({ userId: 1, clientMutationId: 1 }, { sparse: true });

export const Product = mongoose.model<IProduct>('Product', productSchema);

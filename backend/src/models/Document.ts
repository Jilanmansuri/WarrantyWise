import mongoose, { Document as MongooseDocument, Schema, Types } from 'mongoose';

export const DOCUMENT_TYPES = [
  'Purchase Invoice',
  'Warranty Certificate',
  'Repair Invoice',
  'AMC Contract',
  'Claim Document',
  'Other',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface IDocumentRecord extends MongooseDocument {
  userId: Types.ObjectId;
  productId?: Types.ObjectId;
  repairId?: Types.ObjectId;
  amcId?: Types.ObjectId;
  claimId?: Types.ObjectId;
  title: string;
  type: DocumentType;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageProvider: 'cloudinary' | 'local';
  url: string;
  publicId: string;
  resourceType: 'image' | 'raw';
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocumentRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      index: true,
    },
    repairId: {
      type: Schema.Types.ObjectId,
      ref: 'Repair',
    },
    amcId: {
      type: Schema.Types.ObjectId,
      ref: 'AMC',
    },
    claimId: {
      type: Schema.Types.ObjectId,
      ref: 'WarrantyClaim',
    },
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
      maxlength: [150, 'Document title cannot exceed 150 characters'],
    },
    type: {
      type: String,
      enum: DOCUMENT_TYPES,
      default: 'Purchase Invoice',
      required: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0,
    },
    storageProvider: {
      type: String,
      enum: ['cloudinary', 'local'],
      required: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    publicId: {
      type: String,
      required: true,
      trim: true,
    },
    resourceType: {
      type: String,
      enum: ['image', 'raw'],
      default: 'image',
    },
  },
  { timestamps: true }
);

documentSchema.index({ userId: 1, type: 1, createdAt: -1 });
documentSchema.index({ userId: 1, productId: 1 });

export const DocumentModel = mongoose.model<IDocumentRecord>('Document', documentSchema);

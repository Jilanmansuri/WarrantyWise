import mongoose, { Document as MongooseDocument, Schema, Types } from 'mongoose';

export const AMC_STATUSES = ['Active', 'Expiring Soon', 'Expired', 'Cancelled'] as const;
export type AmcStatus = (typeof AMC_STATUSES)[number];

export interface IAMC extends MongooseDocument {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  contractNumber?: string;
  providerName: string;
  providerPhone?: string;
  providerEmail?: string;
  startDate: Date;
  endDate: Date;
  cost: number;
  visitFrequencyMonths: number;
  scheduledVisitsCount: number;
  completedVisitsCount: number;
  nextVisitDate?: Date;
  contractDocumentId?: Types.ObjectId;
  statusOverride?: 'Active' | 'Cancelled';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const amcSchema = new Schema<IAMC>(
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
      required: true,
      index: true,
    },
    contractNumber: {
      type: String,
      trim: true,
      maxlength: [80, 'Contract number cannot exceed 80 characters'],
    },
    providerName: {
      type: String,
      required: [true, 'AMC provider name is required'],
      trim: true,
      maxlength: [140, 'Provider name cannot exceed 140 characters'],
    },
    providerPhone: {
      type: String,
      trim: true,
      maxlength: [30, 'Provider phone cannot exceed 30 characters'],
    },
    providerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [120, 'Provider email cannot exceed 120 characters'],
    },
    startDate: {
      type: Date,
      required: [true, 'AMC start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'AMC expiry date is required'],
    },
    cost: {
      type: Number,
      min: [0, 'AMC cost cannot be negative'],
      default: 0,
    },
    visitFrequencyMonths: {
      type: Number,
      min: [1, 'Visit frequency must be at least 1 month'],
      max: [24, 'Visit frequency cannot exceed 24 months'],
      default: 6,
    },
    scheduledVisitsCount: {
      type: Number,
      min: 0,
      default: 2,
    },
    completedVisitsCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    nextVisitDate: {
      type: Date,
    },
    contractDocumentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
    },
    statusOverride: {
      type: String,
      enum: ['Active', 'Cancelled'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1500, 'Notes cannot exceed 1500 characters'],
    },
  },
  { timestamps: true }
);

amcSchema.index({ userId: 1, endDate: 1 });
amcSchema.index({ userId: 1, productId: 1 });

export const AMC = mongoose.model<IAMC>('AMC', amcSchema);

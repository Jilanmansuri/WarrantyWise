import mongoose, { Document as MongooseDocument, Schema, Types } from 'mongoose';

export const CLAIM_STATUSES = [
  'Not Started',
  'Documents Pending',
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected',
  'Resolved',
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export interface IClaimChecklistEntry {
  key: string;
  label: string;
  required: boolean;
  completed: boolean;
}

export interface IWarrantyClaim extends MongooseDocument {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  claimReferenceNumber?: string;
  manufacturerOrCenter: string;
  contactPhone?: string;
  contactEmail?: string;
  issueSummary: string;
  status: ClaimStatus;
  submittedAt?: Date;
  resolvedAt?: Date;
  checklist: IClaimChecklistEntry[];
  supportingDocumentIds: Types.ObjectId[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const checklistSchema = new Schema<IClaimChecklistEntry>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    required: { type: Boolean, default: true },
    completed: { type: Boolean, default: false },
  },
  { _id: false }
);

const warrantyClaimSchema = new Schema<IWarrantyClaim>(
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
    claimReferenceNumber: {
      type: String,
      trim: true,
      maxlength: [80, 'Claim reference number cannot exceed 80 characters'],
    },
    manufacturerOrCenter: {
      type: String,
      required: [true, 'Manufacturer or service center is required'],
      trim: true,
      maxlength: [160, 'Manufacturer or center name cannot exceed 160 characters'],
    },
    contactPhone: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    issueSummary: {
      type: String,
      required: [true, 'Issue summary is required'],
      trim: true,
      maxlength: [1200, 'Issue summary cannot exceed 1200 characters'],
    },
    status: {
      type: String,
      enum: CLAIM_STATUSES,
      default: 'Not Started',
      required: true,
    },
    submittedAt: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
    },
    checklist: {
      type: [checklistSchema],
      default: [],
    },
    supportingDocumentIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Document' }],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
    },
  },
  { timestamps: true }
);

warrantyClaimSchema.index({ userId: 1, status: 1, updatedAt: -1 });
warrantyClaimSchema.index({ userId: 1, productId: 1 });

export const WarrantyClaim = mongoose.model<IWarrantyClaim>('WarrantyClaim', warrantyClaimSchema);

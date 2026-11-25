import mongoose, { Document as MongooseDocument, Schema, Types } from 'mongoose';

export const REPAIR_STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled'] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export interface IRepair extends MongooseDocument {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  repairDate: Date;
  problemDescription: string;
  repairCenter: string;
  repairCost?: number;
  repairStatus: RepairStatus;
  repairInvoiceDocumentId?: Types.ObjectId;
  repairInvoiceUrl?: string;
  additionalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const repairSchema = new Schema<IRepair>(
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
    repairDate: {
      type: Date,
      required: [true, 'Repair date is required'],
    },
    problemDescription: {
      type: String,
      required: [true, 'Problem description is required'],
      trim: true,
      maxlength: [1000, 'Problem description cannot exceed 1000 characters'],
    },
    repairCenter: {
      type: String,
      required: [true, 'Repair center is required'],
      trim: true,
      maxlength: [150, 'Repair center cannot exceed 150 characters'],
    },
    repairCost: {
      type: Number,
      min: [0, 'Repair cost cannot be negative'],
      default: 0,
    },
    repairStatus: {
      type: String,
      enum: REPAIR_STATUSES,
      default: 'Pending',
      required: true,
    },
    repairInvoiceDocumentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
    },
    repairInvoiceUrl: {
      type: String,
      trim: true,
    },
    additionalNotes: {
      type: String,
      trim: true,
      maxlength: [1500, 'Additional notes cannot exceed 1500 characters'],
    },
  },
  { timestamps: true }
);

repairSchema.index({ userId: 1, productId: 1, repairDate: -1 });
repairSchema.index({ userId: 1, updatedAt: -1 });

export const Repair = mongoose.model<IRepair>('Repair', repairSchema);

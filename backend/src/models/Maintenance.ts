import mongoose, { Document as MongooseDocument, Schema, Types } from 'mongoose';

export const MAINTENANCE_STATUSES = ['Scheduled', 'Completed', 'Skipped'] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export interface IMaintenanceHistoryEntry {
  _id?: Types.ObjectId;
  completedAt: Date;
  cost: number;
  serviceProvider?: string;
  notes?: string;
  clientMutationId?: string;
}

export interface IMaintenance extends MongooseDocument {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  title: string;
  serviceType: string;
  frequencyMonths: number; // 0 = one-time, >0 = recurring
  lastServiceDate?: Date;
  nextServiceDate: Date;
  serviceProvider?: string;
  estimatedCost: number;
  status: MaintenanceStatus;
  notes?: string;
  history: IMaintenanceHistoryEntry[];
  clientMutationId?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const historyEntrySchema = new Schema<IMaintenanceHistoryEntry>(
  {
    completedAt: { type: Date, required: true },
    cost: { type: Number, min: 0, default: 0 },
    serviceProvider: { type: String, trim: true, maxlength: 140 },
    notes: { type: String, trim: true, maxlength: 1000 },
    clientMutationId: { type: String, trim: true },
  },
  { _id: true }
);

const maintenanceSchema = new Schema<IMaintenance>(
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
    title: {
      type: String,
      required: [true, 'Maintenance title is required'],
      trim: true,
      maxlength: [140, 'Title cannot exceed 140 characters'],
    },
    serviceType: {
      type: String,
      trim: true,
      default: 'Routine Servicing',
      maxlength: [100, 'Service type cannot exceed 100 characters'],
    },
    frequencyMonths: {
      type: Number,
      min: [0, 'Frequency cannot be negative'],
      max: [60, 'Frequency cannot exceed 60 months'],
      default: 6,
    },
    lastServiceDate: {
      type: Date,
    },
    nextServiceDate: {
      type: Date,
      required: [true, 'Next service date is required'],
    },
    serviceProvider: {
      type: String,
      trim: true,
      maxlength: [140, 'Service provider cannot exceed 140 characters'],
    },
    estimatedCost: {
      type: Number,
      min: [0, 'Cost cannot be negative'],
      default: 0,
    },
    status: {
      type: String,
      enum: MAINTENANCE_STATUSES,
      default: 'Scheduled',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1500, 'Notes cannot exceed 1500 characters'],
    },
    history: {
      type: [historyEntrySchema],
      default: [],
    },
    clientMutationId: {
      type: String,
      trim: true,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

maintenanceSchema.index({ userId: 1, nextServiceDate: 1 });
maintenanceSchema.index({ userId: 1, productId: 1 });
maintenanceSchema.index({ userId: 1, clientMutationId: 1 }, { sparse: true });

export const Maintenance = mongoose.model<IMaintenance>('Maintenance', maintenanceSchema);

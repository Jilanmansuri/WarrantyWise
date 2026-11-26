import mongoose, { Document as MongooseDocument, Schema, Types } from 'mongoose';

export const PRODUCT_EVENT_TYPES = [
  'PURCHASED',
  'WARRANTY_STARTED',
  'EXTENDED_WARRANTY_ADDED',
  'MAINTENANCE_LOGGED',
  'REPAIR_LOGGED',
  'AMC_ADDED',
  'CLAIM_UPDATED',
  'WARRANTY_TRANSFERRED',
  'RESOLD',
  'DISPOSED',
] as const;

export type ProductEventType = (typeof PRODUCT_EVENT_TYPES)[number];

export interface IProductEvent extends MongooseDocument {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  eventType: ProductEventType;
  title: string;
  description?: string;
  amount?: number;
  eventDate: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const productEventSchema = new Schema<IProductEvent>(
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
    eventType: {
      type: String,
      enum: PRODUCT_EVENT_TYPES,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    amount: {
      type: Number,
      min: 0,
    },
    eventDate: {
      type: Date,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

productEventSchema.index({ userId: 1, productId: 1, eventDate: -1 });
productEventSchema.index({ userId: 1, createdAt: -1 });

export const ProductEvent = mongoose.model<IProductEvent>('ProductEvent', productEventSchema);

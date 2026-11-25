import mongoose, { Document as MongooseDocument, Schema, Types } from 'mongoose';

export interface INotificationPreference extends MongooseDocument {
  userId: Types.ObjectId;
  enabled: boolean;
  remind30Days: boolean;
  remind7Days: boolean;
  remind1Day: boolean;
  notifyNewProduct: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    remind30Days: {
      type: Boolean,
      default: true,
    },
    remind7Days: {
      type: Boolean,
      default: true,
    },
    remind1Day: {
      type: Boolean,
      default: true,
    },
    notifyNewProduct: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const NotificationPreference = mongoose.model<INotificationPreference>(
  'NotificationPreference',
  notificationPreferenceSchema
);

import mongoose, { Document as MongooseDocument, Schema, Types } from 'mongoose';

export const FAMILY_RELATIONSHIPS = [
  'Spouse',
  'Partner',
  'Child',
  'Parent',
  'Sibling',
  'Other',
] as const;

export type FamilyRelationship = (typeof FAMILY_RELATIONSHIPS)[number];

export interface IFamilyMember extends MongooseDocument {
  userId: Types.ObjectId; // Vault owner
  name: string;
  relationship: FamilyRelationship;
  email?: string;
  linkedUserId?: Types.ObjectId;
  permissions: {
    canViewWarranties: boolean;
    canViewDocuments: boolean;
    canReceiveReminders: boolean;
  };
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const familyMemberSchema = new Schema<IFamilyMember>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Family member name is required'],
      trim: true,
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    relationship: {
      type: String,
      enum: FAMILY_RELATIONSHIPS,
      default: 'Other',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    linkedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    permissions: {
      canViewWarranties: { type: Boolean, default: true },
      canViewDocuments: { type: Boolean, default: false },
      canReceiveReminders: { type: Boolean, default: true },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  { timestamps: true }
);

familyMemberSchema.index({ userId: 1, name: 1 });
familyMemberSchema.index({ email: 1 });

export const FamilyMember = mongoose.model<IFamilyMember>('FamilyMember', familyMemberSchema);

import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';
import { DocumentSubmissionStatus } from '../../../../shared/constants/documentStatuses';

export interface DriverDocumentSubmissionDocument {
  _id: Types.ObjectId;
  driverId: Types.ObjectId;
  requirementId: Types.ObjectId;
  status: DocumentSubmissionStatus;
  referenceNumber?: string | null;
  expiryDate?: Date | null;
  fileUrl?: string | null;
  fileMimeType?: string | null;
  verifiedBy?: Types.ObjectId | null;
  verifiedAt?: Date | null;
  rejectionReason?: string | null;
  uploadedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const driverDocumentSubmissionSchema = new Schema(
  {
    driverId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requirementId: {
      type: Types.ObjectId,
      ref: 'DocumentRequirement',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(DocumentSubmissionStatus),
      default: DocumentSubmissionStatus.MISSING,
    },
    referenceNumber: { type: String, default: null },
    expiryDate: { type: Date, default: null },
    fileUrl: { type: String, default: null },
    fileMimeType: { type: String, default: null },
    verifiedBy: { type: Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    uploadedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

driverDocumentSubmissionSchema.index(
  { driverId: 1, requirementId: 1 },
  { unique: true }
);

export const DriverDocumentSubmissionModel = createScopedModel<DriverDocumentSubmissionDocument>(
  'DriverDocumentSubmission',
  driverDocumentSubmissionSchema
);

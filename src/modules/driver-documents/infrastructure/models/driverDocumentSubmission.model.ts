import mongoose from 'mongoose';
import { DocumentSubmissionStatus } from '../../../../shared/constants/documentStatuses';

const driverDocumentSubmissionSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requirementId: {
      type: mongoose.Schema.Types.ObjectId,
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
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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

export const DriverDocumentSubmissionModel = mongoose.model(
  'DriverDocumentSubmission',
  driverDocumentSubmissionSchema
);

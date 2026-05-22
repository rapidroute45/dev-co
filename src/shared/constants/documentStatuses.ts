export enum DocumentSubmissionStatus {
  MISSING = 'missing',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  EXPIRING_SOON = 'expiring_soon',
}

export const DOCUMENT_SUBMISSION_STATUSES = Object.values(DocumentSubmissionStatus);

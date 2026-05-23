export enum DeliveryVerification {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export const DELIVERY_VERIFICATIONS = Object.values(DeliveryVerification);

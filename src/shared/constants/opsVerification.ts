/** Two-step ops review: dispatch team → dispatch manager. */
export enum OpsVerificationStatus {
  PENDING = 'pending',
  TEAM_VERIFIED = 'team_verified',
  MANAGER_VERIFIED = 'manager_verified',
  REJECTED = 'rejected',
}

export const OPS_VERIFICATION_STATUSES = Object.values(OpsVerificationStatus);

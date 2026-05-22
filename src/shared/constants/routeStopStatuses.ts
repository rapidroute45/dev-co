export enum RouteStopStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  RETURNED = 'returned',
}

export const RETURN_REASON_PRESETS = [
  'wrong_address',
  'customer_refusal',
  'package_damage',
  'retry_return',
  'customer_not_access',
  'business_closed',
  'custom',
] as const;

export type ReturnReasonPreset = (typeof RETURN_REASON_PRESETS)[number];

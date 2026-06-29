/** Normalize Mongo / JSON date values for location monitoring. */
export function asLocationDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed);
  }
  return null;
}

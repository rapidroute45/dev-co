/** Auto store ID: {PREFIX}-{0001} e.g. WALMART-0001 */
export function buildStoreIdPrefix(storeName: string): string {
  const normalized = storeName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return normalized || 'STORE';
}

export function formatStoreId(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}

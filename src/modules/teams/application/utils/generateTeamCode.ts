/** Builds auto team code: {NAME}-{0001} e.g. RB-0001 */
export function buildTeamCodePrefix(name: string): string {
  const normalized = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized || 'TEAM';
}

export function formatTeamCode(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}

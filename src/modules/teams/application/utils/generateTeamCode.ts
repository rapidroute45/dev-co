/** Builds auto team code: {NAME}-{0001} e.g. RB-0001 */
export function buildTeamCodePrefix(name: string): string {
  const normalized = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized || 'TEAM';
}

export function formatTeamCode(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}

/** Spacing between auto-assigned team numbers (1000, 2000, 3000, ...). */
export const TEAM_NUMBER_STEP = 1000;

/** Next team number based on the current highest. 0 -> 1000, 1000 -> 2000. */
export function nextTeamNumber(currentMax: number): number {
  if (!currentMax || currentMax < TEAM_NUMBER_STEP) {
    return TEAM_NUMBER_STEP;
  }
  // Snap to the next clean multiple of the step in case of legacy gaps.
  return (Math.floor(currentMax / TEAM_NUMBER_STEP) + 1) * TEAM_NUMBER_STEP;
}

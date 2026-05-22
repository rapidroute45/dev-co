/**
 * True if [startA, endA) overlaps [startB, endB) (exclusive end optional via strict inequality).
 * Adjacent slots (end === other start) do NOT overlap.
 */
export function timesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && startB < endA;
}

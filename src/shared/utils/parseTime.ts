import { AppError } from '../errors/app-error';

/** Parses "HH:mm" or "H:mm" (24h) to minutes since midnight. */
export function parseTimeToMinutes(time: string): number {
  const trimmed = time?.trim();
  if (!trimmed) {
    throw new AppError('Time is required (format HH:mm).', 400);
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new AppError(`Invalid time format "${time}". Use HH:mm (e.g. 09:30).`, 400);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    throw new AppError(`Invalid time "${time}". Hours must be 0-23 and minutes 0-59.`, 400);
  }

  return hours * 60 + minutes;
}

export function formatMinutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

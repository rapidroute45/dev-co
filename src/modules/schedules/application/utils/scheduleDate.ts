import { AppError } from '../../../../shared/errors/app-error';

/** Normalizes YYYY-MM-DD to UTC start-of-day Date. */
export function parseScheduleDate(input: string): Date {
  const trimmed = input?.trim();
  if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new AppError('Invalid schedule date. Use YYYY-MM-DD format.', 400);
  }

  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('Invalid schedule date.', 400);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (date < today) {
    throw new AppError('Schedule date cannot be in the past.', 400);
  }

  return date;
}

export function formatScheduleDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

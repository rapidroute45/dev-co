import { AppError } from '../../../../shared/errors/app-error';

/**
 * Normalizes YYYY-MM-DD to UTC start-of-day Date.
 * Use for reading/listing — past dates are allowed so history is viewable.
 */
export function parseScheduleDate(input: string): Date {
  const trimmed = input?.trim();
  if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new AppError('Invalid schedule date. Use YYYY-MM-DD format.', 400);
  }

  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('Invalid schedule date.', 400);
  }

  return date;
}

/**
 * Same as parseScheduleDate but rejects past dates.
 * Use only when creating/moving a schedule — you cannot schedule into the past.
 *
 * Compares YYYY-MM-DD strings with a one-day cushion behind UTC today so clients
 * in timezones behind UTC (e.g. US evening) can still pick their local "today".
 */
export function parseFutureScheduleDate(input: string): Date {
  const trimmed = input?.trim();
  const date = parseScheduleDate(input);

  if (!isScheduleDateAllowedForCreate(trimmed, minFutureScheduleDate())) {
    throw new AppError('Schedule date cannot be in the past.', 400);
  }

  return date;
}

/** Pure calendar-string check used by parseFutureScheduleDate (testable without clock mocks). */
export function isScheduleDateAllowedForCreate(
  isoDate: string,
  minAllowedIso: string
): boolean {
  return isoDate.trim() >= minAllowedIso;
}

export function formatScheduleDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Earliest YYYY-MM-DD allowed when creating a schedule (UTC today − 1 day for US/local TZ). */
export function minFutureScheduleDate(referenceDate: Date = new Date()): string {
  const today = parseScheduleDate(formatScheduleDate(referenceDate));
  today.setUTCDate(today.getUTCDate() - 1);
  return formatScheduleDate(today);
}

/** Latest YYYY-MM-DD allowed for payroll period end (UTC today + 1 day for client TZ ahead of UTC). */
export function maxPayrollPeriodEndDate(): string {
  const today = parseScheduleDate(formatScheduleDate(new Date()));
  today.setUTCDate(today.getUTCDate() + 1);
  return formatScheduleDate(today);
}

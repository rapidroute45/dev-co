import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../../shared/errors/app-error';
import {
  isScheduleDateAllowedForCreate,
  minFutureScheduleDate,
  parseFutureScheduleDate,
} from './scheduleDate';

const UTC_JULY_1 = new Date('2026-07-01T15:00:00.000Z');

test('minFutureScheduleDate returns UTC today minus one calendar day', () => {
  assert.equal(minFutureScheduleDate(UTC_JULY_1), '2026-06-30');
});

test('isScheduleDateAllowedForCreate allows UTC today and one day before (US local today)', () => {
  const minAllowed = '2026-06-30';
  assert.equal(isScheduleDateAllowedForCreate('2026-07-01', minAllowed), true);
  assert.equal(isScheduleDateAllowedForCreate('2026-06-30', minAllowed), true);
});

test('isScheduleDateAllowedForCreate rejects dates before the cushion', () => {
  const minAllowed = '2026-06-30';
  assert.equal(isScheduleDateAllowedForCreate('2026-06-29', minAllowed), false);
});

test('isScheduleDateAllowedForCreate allows future dates', () => {
  const minAllowed = '2026-06-30';
  assert.equal(isScheduleDateAllowedForCreate('2026-07-15', minAllowed), true);
});

test('parseFutureScheduleDate rejects clearly past dates', () => {
  assert.throws(
    () => parseFutureScheduleDate('2000-01-01'),
    (err: unknown) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.message, 'Schedule date cannot be in the past.');
      assert.equal(err.statusCode, 400);
      return true;
    }
  );
});

test('parseFutureScheduleDate accepts min allowed and future dates relative to real clock', () => {
  const minAllowed = minFutureScheduleDate();
  const futureDate = (() => {
    const d = new Date(`${minAllowed}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  })();

  assert.doesNotThrow(() => parseFutureScheduleDate(minAllowed));
  assert.doesNotThrow(() => parseFutureScheduleDate(futureDate));
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { UserRole } from '../constants/roles';
import {
  enforceActorState,
  resolveGlobalLocationQuery,
} from './cityScope.service';

test('resolveGlobalLocationQuery passes state and city through for admin', () => {
  const result = resolveGlobalLocationQuery(
    { role: UserRole.ADMIN },
    { state: 'TX', city: 'Dallas', date: '2026-06-23' }
  );
  assert.deepEqual(result, { state: 'TX', city: 'Dallas', date: '2026-06-23' });
});

test('resolveGlobalLocationQuery passes state and city through for dispatch manager', () => {
  const result = resolveGlobalLocationQuery(
    { role: UserRole.DISPATCH_MANAGER },
    { state: 'CA', city: 'Los Angeles' }
  );
  assert.deepEqual(result, { state: 'CA', city: 'Los Angeles' });
});

test('resolveGlobalLocationQuery keeps state and city for dispatch team', () => {
  const result = resolveGlobalLocationQuery(
    { role: UserRole.DISPATCH_TEAM, assignedCities: ['Dallas', 'Houston'] },
    { state: 'TX', city: 'Dallas' }
  );
  assert.deepEqual(result, { state: 'TX', city: 'Dallas' });
});

test('resolveGlobalLocationQuery strips state and city for team lead', () => {
  const result = resolveGlobalLocationQuery(
    { role: UserRole.TEAM_LEAD },
    { state: 'TX', city: 'Dallas' }
  );
  assert.deepEqual(result, {});
});

test('resolveGlobalLocationQuery strips state and city for driver', () => {
  const result = resolveGlobalLocationQuery(
    { role: UserRole.DRIVER },
    { state: 'TX', city: 'Dallas' }
  );
  assert.deepEqual(result, {});
});

test('enforceActorState allows dispatch team and managers', () => {
  assert.doesNotThrow(() =>
    enforceActorState({ role: UserRole.ADMIN }, 'TX')
  );
  assert.doesNotThrow(() =>
    enforceActorState(
      { role: UserRole.DISPATCH_TEAM, assignedCities: ['Dallas'] },
      'TX'
    )
  );
});

test('enforceActorState rejects state filter for team lead', () => {
  assert.throws(
    () => enforceActorState({ role: UserRole.TEAM_LEAD }, 'TX'),
    /State filter is not allowed/
  );
});

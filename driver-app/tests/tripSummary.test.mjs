import assert from 'node:assert/strict';
import test from 'node:test';
import { canAutoDismissFinishedTrip, finishedTripDismissalKey, finishedTripReceipt } from '../src/lib/tripSummary.ts';
import { isNavigationApp, navigationStorageKey } from '../src/lib/navigationPreference.ts';

test('a slow payment stays visible past the eight-second summary timeout', () => {
  for (const status of [undefined, 'unpaid', 'pending', 'requires_action', 'failed', 'expired']) {
    assert.equal(canAutoDismissFinishedTrip({ payment_status: status }), false);
  }
  assert.equal(canAutoDismissFinishedTrip(null), false);
  assert.equal(canAutoDismissFinishedTrip({ payment_status: 'paid' }), true);
  assert.equal(canAutoDismissFinishedTrip({ payment_status: 'paid' }, false), false);
});

test('manually closing a pending trip still allows its paid earnings to appear', () => {
  const pending = { trip_id: 'trip-123', payment_status: 'pending' };
  const dismissal = finishedTripReceipt(pending);
  assert.equal(finishedTripReceipt({ ...pending, payment_status: 'requires_action' }), dismissal);
  assert.notEqual(finishedTripReceipt({ ...pending, payment_status: 'paid' }), dismissal);
  assert.notEqual(finishedTripReceipt({ trip_id: 'trip-456', payment_status: 'pending' }), dismissal);
});

test('two drivers on one device have independent preferences and dismissals', () => {
  const cache = new Map([[navigationStorageKey('driver-a'), 'waze']]);
  assert.equal(cache.get(navigationStorageKey('driver-b')), undefined);
  assert.notEqual(finishedTripDismissalKey('driver-a'), finishedTripDismissalKey('driver-b'));
  assert.notEqual(navigationStorageKey('driver-a'), 'driver_navigation_app');
});

test('only supported navigation applications can be used', () => {
  for (const value of ['google', 'waze', 'apple']) assert.equal(isNavigationApp(value), true);
  for (const value of [null, undefined, '', 'arbitrary://', {}, 'Google']) assert.equal(isNavigationApp(value), false);
});

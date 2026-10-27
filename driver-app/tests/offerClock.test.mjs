import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectedOfferTime } from '../src/lib/offerClock.ts';

test('countdown uses the server sample and monotonic elapsed time', () => {
  const server = '2026-10-26T10:00:00Z';
  const deadline = Date.parse('2026-10-26T10:00:30Z');
  assert.equal((deadline - projectedOfferTime(server, 100, 15100)) / 1000, 15);
  assert.equal((deadline - projectedOfferTime(server, 100, 30100)) / 1000, 0);
});
test('missing server clock stays unknown instead of manufacturing 30 seconds', () => {
  assert.equal(projectedOfferTime(undefined, 100, 500), null);
  assert.equal(projectedOfferTime('invalid', 100, 500), null);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { parseVoiceIntent } from '../src/lib/voiceIntent.ts';

test('accepts a trip on clear Norwegian and English phrases', () => {
  for (const phrase of ['Godta turen', 'aksepter', 'Ja, jeg tar den', 'Accept']) {
    assert.equal(parseVoiceIntent(phrase), 'accept', phrase);
  }
});

test('negated accept phrases decline and never accept', () => {
  for (const phrase of ['Ikke godta', 'Nei takk', 'Avslå turen', 'nei, ikke ta turen', 'skip this one']) {
    assert.equal(parseVoiceIntent(phrase), 'decline', phrase);
  }
});

test('shift, call and navigation commands', () => {
  assert.equal(parseVoiceIntent('Gå online'), 'online');
  assert.equal(parseVoiceIntent('Logg av nå'), 'offline');
  assert.equal(parseVoiceIntent('Ta pause'), 'offline');
  assert.equal(parseVoiceIntent('Ring kunden'), 'call');
  assert.equal(parseVoiceIntent('Start navigasjon'), 'navigate');
});

test('unrelated speech does nothing', () => {
  for (const phrase of ['', 'Hva er klokka?', 'Det regner i dag']) {
    assert.equal(parseVoiceIntent(phrase), 'unknown', phrase);
  }
});

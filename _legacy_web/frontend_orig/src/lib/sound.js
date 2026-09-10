/**
 * Play a short pleasant notification sound for the driver (new trip).
 * Uses WebAudio to synthesize a two-note "ping" — no asset file needed.
 * Falls back silently if audio context can't start (browsers may block autoplay).
 */
let ctx = null;

function getCtx() {
  if (ctx) return ctx;
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq, startAt, durationMs, gain = 0.15) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const t0 = c.currentTime + startAt;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.02);
}

/** Play the KJAPP "new trip" chime: a rising two-note ping. */
export function playNewTripPing() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") { c.resume().catch(() => {}); }
  tone(660, 0, 220, 0.18);   // E5
  tone(880, 0.14, 260, 0.22); // A5
}

/**
 * Try to unlock/prime the audio context on first user gesture so
 * subsequent programmatic plays actually make sound (mobile Safari & Chrome).
 */
export function primeAudioOnUserGesture() {
  const unlock = () => {
    const c = getCtx();
    if (c && c.state === "suspended") c.resume().catch(() => {});
    window.removeEventListener("click", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("click", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
}

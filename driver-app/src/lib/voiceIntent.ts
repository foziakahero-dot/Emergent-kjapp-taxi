export type VoiceIntent = 'accept' | 'decline' | 'call' | 'navigate' | 'online' | 'offline' | 'unknown';

const normalize = (text: string) =>
  ` ${text.toLowerCase().replace(/[.,!?;:"'()]/g, ' ').replace(/\s+/g, ' ').trim()} `;

const hasAny = (haystack: string, needles: string[]) => needles.some((n) => haystack.includes(n));

// Order matters: negated/decline phrases are checked before accept so
// "ikke godta" or "nei, ikke ta turen" never accepts a trip.
export function parseVoiceIntent(text: string): VoiceIntent {
  const t = normalize(text);
  if (t.trim() === '') return 'unknown';

  if (hasAny(t, [' avslå', ' avvis', ' nei takk', ' ikke godta', ' ikke ta ', ' hopp over', ' decline', ' reject', ' skip '])) return 'decline';
  if (hasAny(t, [' gå offline', ' logg av', ' avslutt vakt', ' stopp vakt', ' ta pause', ' go offline', ' offline '])) return 'offline';
  if (hasAny(t, [' gå online', ' logg på', ' start vakt', ' begynn vakt', ' go online', ' online '])) return 'online';
  if (hasAny(t, [' godta', ' aksepter', ' ta turen', ' jeg tar den', ' accept'])) return 'accept';
  if (hasAny(t, [' ring ', ' ring kunden', ' ringe', ' call'])) return 'call';
  if (hasAny(t, [' naviger', ' navigasjon', ' vis vei', ' kjør meg', ' navigate', ' directions'])) return 'navigate';
  return 'unknown';
}

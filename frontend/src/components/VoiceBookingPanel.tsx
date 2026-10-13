import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from './Typography';
import { colors, font } from '@/src/theme';
import { aiApi, tripsApi } from '@/src/lib/api';
import { apiError, kr } from '@/src/lib/format';

const vehicles = [{ id: 'ai-first', name: 'SNAR' }, { id: 'trygg', name: 'SNAR XL' }, { id: 'premium', name: 'Premium' }];
const needLabels: Record<string, string> = { wheelchair: 'rullestol', large_luggage: 'stor bagasje', pet: 'kjæledyr', hearing_impaired: 'hørselsassistanse', visual_impaired: 'synsassistanse', child_seat: 'barnesete' };

export function VoiceBookingPanel({ result, onEdit }: { result: any; onEdit: () => void }) {
  const router = useRouter();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pickupId, setPickupId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [vehicle, setVehicle] = useState(result.recommended_vehicle_type || 'ai-first');
  const [proposal, setProposal] = useState<any>(null);
  const [waitingAccepted, setWaitingAccepted] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const card = { padding: 16, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, gap: 12 } as const;
  const text = { color: colors.text, fontFamily: font.medium, fontSize: 14 } as const;
  const button = { minHeight: 48, borderRadius: 14, padding: 12, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' } as const;
  const calculate = async () => {
    if (lock.current || !pickupId || !destinationId) return;
    lock.current = true; setBusy(true); setError('');
    setProposal(null); setWaitingAccepted(false); setAttempted(false);
    try {
      setProposal(await aiApi.voiceProposal({ session_id: result.session_id, pickup_id: pickupId, destination_id: destinationId, vehicle_type: vehicle }));
    } catch (e) { setError(apiError(e)); }
    finally { lock.current = false; setBusy(false); }
  };
  const confirm = async () => {
    if (lock.current || attempted || !waitingAccepted || !proposal) return;
    if (Date.parse(proposal.expires_at) <= Date.now()) { setError('Pristilbudet er utløpt. Beregn på nytt.'); return; }
    lock.current = true; setBusy(true); setAttempted(true); setError('');
    try {
      const trip = await aiApi.voiceConfirm(proposal.proposal_id);
      if (!trip?.trip_id) throw new Error('Bestillingsstatus kunne ikke bekreftes.');
      router.push(`/booking/${encodeURIComponent(trip.trip_id)}`);
    } catch (e: any) {
      setError(apiError(e));
      if (e?.response?.status === 402) router.push('/payment-methods');
    } finally { lock.current = false; setBusy(false); }
  };
  const recover = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const trip = await tripsApi.active();
      if (trip?.trip_id) router.push(`/booking/${encodeURIComponent(trip.trip_id)}`);
      else setError('Ingen aktiv tur ble funnet. Start et nytt forslag før du bestiller igjen.');
    } catch (e) { setError(apiError(e)); }
    finally { lock.current = false; setBusy(false); }
  };
  if (result.status === 'clarification') return <View style={card}><Text style={text}>{result.message}</Text><Pressable accessibilityRole="button" onPress={onEdit} style={button}><Text style={{ color: colors.accentOn }}>Endre bestillingen</Text></Pressable></View>;
  return <View style={card} testID="voice-booking-panel">
    <Text style={text}>Jeg hørte: {result.transcript}</Text>
    {!proposal ? <>
      {(['pickup', 'destination'] as const).map(kind => <View key={kind} style={{ gap: 6 }}>
        <Text style={text}>{kind === 'pickup' ? 'Velg hentested' : 'Velg destinasjon'}</Text>
        {(result[kind + '_candidates'] || []).map((place: any) => {
          const selected = (kind === 'pickup' ? pickupId : destinationId) === place.id;
          return <Pressable key={place.id} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: busy }} testID={`voice-${kind}-${place.id}`} onPress={() => kind === 'pickup' ? setPickupId(place.id) : setDestinationId(place.id)} style={{ padding: 12, minHeight: 48, borderRadius: 12, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.accent : colors.line }}><Text style={text}>{place.name}</Text></Pressable>;
        })}
      </View>)}
      <Text style={text}>Velg bil · anbefalt: {vehicles.find(v => v.id === result.recommended_vehicle_type)?.name}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>{vehicles.map(v => <Pressable key={v.id} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: vehicle === v.id, disabled: busy }} onPress={() => setVehicle(v.id)} style={{ flex: 1, minHeight: 48, padding: 10, borderRadius: 12, borderWidth: vehicle === v.id ? 2 : 1, borderColor: vehicle === v.id ? colors.accent : colors.line }}><Text style={text}>{v.name}</Text></Pressable>)}</View>
      <Pressable accessibilityRole="button" testID="voice-calculate" disabled={busy || !pickupId || !destinationId} onPress={calculate} style={[button, (busy || !pickupId || !destinationId) && { opacity: .5 }]}><Text style={{ color: colors.accentOn }}>Beregn pris</Text></Pressable>
    </> : <>
      <Text style={text}>{proposal.pickup.name} → {proposal.destination.name}</Text>
      <Text style={text}>{vehicles.find(v => v.id === proposal.vehicle_type)?.name} · {kr(proposal.estimated_price)}</Text>
      <Text style={text}>{proposal.distance_km} km · {proposal.duration_min} min kjøretid</Text>
      {proposal.intent.passenger_count != null ? <Text style={text}>{proposal.intent.passenger_count} passasjerer</Text> : null}
      {proposal.intent.luggage != null ? <Text style={text}>{proposal.intent.luggage} kolli{proposal.intent.large_luggage ? ' stor bagasje' : ' bagasje'}</Text> : null}
      {proposal.intent.special_requirements?.length ? <Text style={text}>Tilleggsbehov: {proposal.intent.special_requirements.map((need: string) => needLabels[need] || 'assistanse').join(', ')}</Text> : null}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: waitingAccepted, disabled: busy || attempted }} testID="voice-waiting-consent" disabled={busy || attempted} onPress={() => setWaitingAccepted(v => !v)} style={{ padding: 12, minHeight: 48, borderWidth: 1, borderColor: waitingAccepted ? colors.accent : colors.line, borderRadius: 12 }}>
        <Text style={text}>{waitingAccepted ? '✓ ' : '○ '}Jeg godtar ventetid og kortreservasjon.</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{proposal.waiting_policy.free_minutes} min gratis ventetid, deretter {kr(proposal.waiting_policy.per_minute)} per minutt, inntil {proposal.waiting_policy.max_billable_minutes} betalbare minutter.</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Maks ventetidsgebyr: {kr(proposal.waiting_policy.max_fee)}. Maks reservasjon: {kr(proposal.estimated_price + proposal.waiting_policy.max_fee)}.</Text>
      </Pressable>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>Ingen tur opprettes før du bekrefter.</Text>
      <Pressable accessibilityRole="button" testID="voice-confirm" disabled={busy || attempted || !waitingAccepted} onPress={confirm} style={[button, (busy || attempted || !waitingAccepted) && { opacity: .5 }]}><Text style={{ color: colors.accentOn }}>Bekreft bestilling</Text></Pressable>
      {attempted ? <Pressable accessibilityRole="button" disabled={busy} onPress={recover} style={button}><Text style={{ color: colors.accentOn }}>Åpne aktiv tur</Text></Pressable> : <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setProposal(null); setWaitingAccepted(false); }}><Text style={text}>Endre adresser eller bil</Text></Pressable>}
    </>}
    <Pressable accessibilityRole="button" disabled={busy} onPress={onEdit}><Text style={text}>Endre talebestillingen</Text></Pressable>
    {busy ? <ActivityIndicator color={colors.accent} /> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
  </View>;
}

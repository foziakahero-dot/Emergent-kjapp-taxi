import React, { useRef, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Text, TextInput } from '@/src/components/Typography';
import { V10Action, V10Group, V10Row, v10 } from '@/src/components/V10UI';
import { travelApi } from '@/src/lib/api';
import { kr } from '@/src/lib/format';
import { osloDay } from '@/src/lib/osloCalendar';
import { colors } from '@/src/theme';

type Point = { lat: number; lng: number };
type TravelEvent = { id: string; title: string; location: string; start: number };
type FlightLookup = { number: string; day: string; direction: 'A' | 'D' };
const zone = 'Europe/Oslo';
const travelModes: Record<string, string> = { bus: 'Buss', tram: 'Trikk', metro: 'T-bane', rail: 'Tog', water: 'Båt', coach: 'Ekspressbuss', cableway: 'Taubane', funicular: 'Bane' };
const flightStatuses: Record<string, string> = { A: 'Landet', C: 'Innstilt', D: 'Avreist', E: 'Ny tid', N: 'Oppdatert informasjon' };
const ruterTickets = 'https://ruter.no/billetter/enkeltbillett';
const avinorFlights = 'https://www.avinor.no/flyplass/oslo/flytider/';
const clock = (time: number | string) => new Date(time).toLocaleTimeString('nb-NO', { timeZone: zone, hour: '2-digit', minute: '2-digit' });
const dateAndTime = (time: number | string) => new Date(time).toLocaleString('nb-NO', { timeZone: zone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function atGardermoen(point: Point) {
  return Math.hypot((point.lat - 60.1976) * 111, (point.lng - 11.1004) * 55.3) < 3;
}

function FlightContext({ direction, userId }: { direction: 'A' | 'D'; userId?: string }) {
  const [number, setNumber] = useState('');
  const [tomorrow, setTomorrow] = useState(false);
  const [lookup, setLookup] = useState<FlightLookup>();
  const normalized = number.trim().toUpperCase().replace(/\s/g, '');
  const today = new Date(`${osloDay(Date.now())}T12:00:00Z`);
  if (tomorrow) today.setUTCDate(today.getUTCDate() + 1);
  const day = today.toISOString().slice(0, 10);
  const query = useQuery({
    queryKey: ['flight-information', userId, lookup],
    queryFn: () => travelApi.flight(lookup!.number, lookup!.direction, lookup!.day),
    enabled: !!lookup, staleTime: 180000, retry: false,
  });
  const flight = query.data?.flight;
  const flightStatus = flight?.delayed && !['A', 'C', 'D'].includes(flight.status_code)
    ? 'Forsinket'
    : flightStatuses[flight?.status_code] || 'Planlagt';
  const submit = () => {
    if (!day || !/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(normalized)) return;
    if (lookup?.number === normalized && lookup?.day === day) void query.refetch();
    else setLookup({ number: normalized, day, direction });
  };
  return <View style={{ gap: 6, marginTop: 12 }}>
    <Text style={v10.body}>Flystatus · Oslo lufthavn</Text>
    <Text style={v10.caption}>{direction === 'A' ? 'Søk etter ankomstflyet før du velger hentetid.' : 'Sjekk flyavgangen før du bestiller til flyplassen.'}</Text>
    <TextInput autoCapitalize="characters" autoCorrect={false} accessibilityLabel="Flynr." testID="travel-flight-number"
      value={number} maxLength={12} placeholder="F.eks. SK404" placeholderTextColor={colors.textMuted}
      onChangeText={value => { setNumber(value); setLookup(undefined); }} onSubmitEditing={submit}
      style={[v10.body, { minHeight: 48, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.cardSubtle }]} />
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <V10Action small kind="soft" label={tomorrow ? 'I morgen' : 'I dag'} onPress={() => { setTomorrow(!tomorrow); setLookup(undefined); }} testID="travel-flight-day" />
      <V10Action small kind="soft" label="Sjekk fly" onPress={submit} disabled={!day || !/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(normalized)}
        busy={query.isFetching} testID="travel-flight-search" />
    </View>
    {lookup && query.isError ? <Text style={v10.caption}>Flystatus er midlertidig utilgjengelig.</Text> : null}
    {lookup && query.isSuccess && !flight ? <Text style={v10.caption}>Fant ikke flyet denne dagen. Sjekk flynummeret og datoen.</Text> : null}
    {lookup && flight ? <View testID="travel-flight-result" style={{ gap: 4 }}>
      <Text style={v10.body}>{flight.requested_number || flight.number} · {flightStatus} · {flight.other_airport || 'OSL'}</Text>
      {flight.requested_number && flight.requested_number !== flight.number ? <Text style={v10.caption}>Operativt flynummer {flight.number}</Text> : null}
      <Text style={v10.secondary}>Rutetid {clock(flight.scheduled_at)}{flight.estimated_at ? ` · ${flight.status_code === 'A' || flight.status_code === 'D' ? 'Faktisk' : 'Oppdatert'} ${dateAndTime(flight.estimated_at)}` : ''}</Text>
      {direction === 'A' && flight.status_code !== 'C' ? <Text style={v10.caption}>Beregn tid til bagasje og utgang etter landing før du bestiller.</Text> : null}
      {direction === 'D' && flight.status_code === 'E' ? <Text style={v10.caption}>Sjekk innsjekkingsfristen hos flyselskapet før du endrer avreisetiden.</Text> : null}
      {query.data?.as_of ? <Text style={v10.caption}>Hentet {dateAndTime(query.data.as_of)}</Text> : null}
    </View> : null}
    <V10Action small kind="ghost" label="Flydata fra Avinor" onPress={() => void Linking.openURL(avinorFlights).catch(() => {})} />
  </View>;
}

function CalendarContext({ driveMinutes, destination }: { driveMinutes: number; destination: string }) {
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<TravelEvent[]>();
  const [selected, setSelected] = useState<TravelEvent>();
  const [message, setMessage] = useState('');
  const busyRef = useRef(false);
  const read = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setEvents(undefined); setSelected(undefined); setMessage('');
    try {
      const calendar = await import('expo-calendar');
      if (!(await calendar.isAvailableAsync())) throw new Error('Kalender er utilgjengelig på denne enheten.');
      const permission = await calendar.requestCalendarPermissions();
      if (!permission.granted) throw new Error('Kalendertilgang mangler. Gi tilgang i telefonens innstillinger for å bruke planlegging.');
      const calendars = await calendar.getCalendars(calendar.EntityTypes.EVENT);
      const now = new Date(), end = new Date(now.getTime() + 7 * 86400000);
      const records = calendars.length ? await calendar.listEvents(calendars, now, end) : [];
      const next = records.flatMap(event => {
        const start = new Date(event.startDate).getTime(), location = event.location?.trim();
        return !event.allDay && location && start > now.getTime() && start < end.getTime()
          ? [{ id: event.id, title: event.title || 'Kalenderavtale', location, start }] : [];
      }).sort((a, b) => a.start - b.start).slice(0, 8);
      setEvents(next);
      if (!next.length) setMessage('Fant ingen kommende avtaler med sted de neste sju dagene.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Kunne ikke åpne kalenderen.');
    } finally { busyRef.current = false; setBusy(false); }
  };
  const leaveAt = selected ? selected.start - (Math.ceil(driveMinutes) + 15) * 60000 : null;
  return <View style={{ gap: 6, marginTop: 12 }}>
    <V10Action kind="soft" small label="Planlegg med kalender" onPress={() => void read()} busy={busy} testID="travel-calendar-open" />
    {message ? <Text style={v10.caption}>{message}</Text> : null}
    {events?.map((event, index) => <V10Row key={`${event.id}:${event.start}`} title={event.title} border={index > 0}
      subtitle={`${dateAndTime(event.start)} · ${event.location}`} onPress={() => setSelected(event)} testID={`travel-calendar-event-${index}`} />)}
    {selected && leaveAt !== null ? <View style={{ gap: 4 }} testID="travel-calendar-suggestion">
      <Text style={v10.body}>{leaveAt > Date.now() ? `Foreslått avreise ${dateAndTime(leaveAt)}` : 'Dra så snart du er klar'}</Text>
      <Text style={v10.caption}>Til {destination} har vi regnet med dagens kjøretid og 15 minutter ekstra. Sjekk at reisemålet stemmer med {selected.location}.</Text>
    </View> : null}
  </View>;
}

export function RideTravelContext({ userId, pickup, destination, driveMinutes, price, allowTransit }: {
  userId?: string; pickup: Point; destination: Point & { name: string }; driveMinutes: number | null;
  price?: number | null; allowTransit: boolean;
}) {
  const [compare, setCompare] = useState(false);
  const lat = Math.round(pickup.lat * 100) / 100, lng = Math.round(pickup.lng * 100) / 100;
  const weather = useQuery({ queryKey: ['travel-weather', userId, lat, lng], queryFn: () => travelApi.weather(lat, lng),
    enabled: !!userId, staleTime: 30 * 60000, retry: false });
  const transit = useQuery({ queryKey: ['travel-transit', userId, pickup.lat, pickup.lng, destination.lat, destination.lng],
    queryFn: () => travelApi.transit({ lat: pickup.lat, lng: pickup.lng }, { lat: destination.lat, lng: destination.lng }),
    enabled: !!userId && compare && allowTransit, staleTime: 30000, retry: false });
  const direction = atGardermoen(pickup) ? 'A' : atGardermoen(destination) ? 'D' : null;
  const forecast = weather.data?.weather;
  const precipitation = /sleet/.test(forecast?.symbol || '') ? 'Sludd' : /snow/.test(forecast?.symbol || '') ? 'Snø' : /rain/.test(forecast?.symbol || '') ? 'Regn' : null;
  const alternatives = (transit.data?.options || []).filter((option: any) => Date.parse(option.departure_at) > Date.now());
  const estimatedDrive = typeof driveMinutes === 'number' && Number.isFinite(driveMinutes) && driveMinutes > 0;
  return <V10Group style={{ marginBottom: 12, padding: 12, gap: 6, backgroundColor: colors.cardSubtle, boxShadow: 'none' }}>
    {forecast && precipitation ? <Text style={v10.caption} testID="travel-weather">{precipitation} ved hentestedet den neste timen · {forecast.degrees_c} °C · MET Norge</Text> : null}
    {allowTransit ? <V10Action small kind="soft" label={compare ? 'Oppdater kollektivruter' : 'Sammenlign med kollektivtransport'} busy={transit.isFetching}
      onPress={() => { if (compare) void transit.refetch(); else setCompare(true); }} testID="travel-transit-compare" /> : null}
    {compare && transit.isError ? <Text style={v10.caption}>Entur er midlertidig utilgjengelig.</Text> : null}
    {compare && transit.isSuccess && !alternatives.length ? <Text style={v10.caption}>Fant ingen avganger for denne ruten. Prøv igjen.</Text> : null}
    {compare && alternatives.slice(0, 2).map((option: any) => <View key={`${option.departure_at}:${option.line}:${option.arrival_at}`} style={{ gap: 2 }}>
      <Text style={v10.body}>{travelModes[option.mode] || 'Kollektiv'} {option.line || ''} · kl. {clock(option.departure_at)}</Text>
      <Text style={v10.caption}>{option.departure_stop || 'Valgt rute'} · fremme kl. {clock(option.arrival_at)}{option.transfers ? ` · ${option.transfers} ${option.transfers === 1 ? 'bytte' : 'bytter'}` : ''} · {option.realtime ? 'Sanntid' : 'Rutetid'} fra Entur</Text>
    </View>)}
    {compare && !!alternatives.length ? <>
      {estimatedDrive && typeof price === 'number' ? <Text style={v10.secondary}>SNAR · {Math.ceil(driveMinutes)} min kjøring · {kr(price)}</Text> : null}
      <V10Action small kind="ghost" label="Se billettpris hos Ruter" onPress={() => void Linking.openURL(ruterTickets).catch(() => {})} />
    </> : null}
    {direction ? <FlightContext key={direction} direction={direction} userId={userId} /> : null}
    {Platform.OS !== 'web' && estimatedDrive ? <CalendarContext driveMinutes={driveMinutes} destination={destination.name} /> : null}
  </V10Group>;
}

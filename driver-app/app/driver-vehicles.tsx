import React, { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { driverApi, apiError } from '@/src/lib/api';
import { vehicleMeta } from '@/src/lib/format';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Badge, V10Group, V10Header, V10Screen, V10Section, V10State, v10 } from '@/src/components/V10UI';
import { Loader } from '@/src/components/ui';
import { colors, font } from '@/src/theme';

type AssignedVehicle = { id: string; car?: string; plate?: string; vehicle_type?: string; active?: boolean; selected?: boolean; busy?: boolean };
export default function DriverVehicles() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const lock = useRef(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const queryKey = ['driver-vehicles', user?.id];
  const query = useQuery({ queryKey, queryFn: driverApi.vehicles, enabled: !!user?.id });
  const vehicles: AssignedVehicle[] = Array.isArray(query.data?.vehicles) ? query.data.vehicles : [];
  const selected = vehicles.find(vehicle => vehicle.selected);
  const select = async (vehicle: AssignedVehicle) => {
    if (lock.current || vehicle.selected || vehicle.active === false || vehicle.busy || !vehicle.id) return;
    lock.current = true; setBusyId(vehicle.id); setError('');
    try {
      const response = await driverApi.selectVehicle(vehicle.id);
      if (response?.vehicle_id !== vehicle.id || response?.selected !== true) throw new Error('Bilvalget ble ikke bekreftet av serveren.');
      qc.setQueryData(queryKey, (previous: any) => ({ ...previous, selected_vehicle_id: vehicle.id, vehicles: (previous?.vehicles || []).map((item: AssignedVehicle) => ({ ...item, selected: item.id === vehicle.id })) }));
      await refresh();
      await qc.invalidateQueries({ queryKey: ['me'] });
      await query.refetch();
    } catch (e) { setError(apiError(e)); }
    finally { lock.current = false; setBusyId(''); }
  };
  return <V10Screen testID="driver-vehicles-screen"><V10Header title="Kjøretøy" onBack={() => router.back()} />
    {query.isPending ? <Loader label="Henter tildelte biler…" /> : query.isError ? <V10State icon="wifiOff" warning title="Kunne ikke hente kjøretøyene" body="Sjekk forbindelsen og prøv igjen." action="Prøv igjen" onAction={() => void query.refetch()} /> : !vehicles.length ?
      <V10State icon="vehicle" title="Ingen biler tildelt" body="Be løyvehaveren tildele en registrert bil i Fleet før du går online." action="Til fleet" onAction={() => router.replace('/driver-fleet')} /> : <>
      <View style={{ height: 180, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <V10Icon name="vehicle" size={64} color={colors.textMuted} /><Text style={v10.caption}>Kjøretøybilde ikke tilgjengelig</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 16 }}>
        <View style={{ flex: 1 }}><Text style={v10.title}>{selected?.car || 'Velg kjøretøy'}</Text><Text style={v10.secondary}>{selected ? vehicleMeta(selected.vehicle_type || 'ai-first').name : 'Velg blant biler tildelt deg'}</Text></View>
        {selected?.plate ? <Text style={{ color: colors.text, fontFamily: font.semibold, fontSize: 16, lineHeight: 22, letterSpacing: .96, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.text }}>{selected.plate}</Text> : null}
      </View>
      {selected ? <View style={{ marginTop: 12 }}><V10Badge tone="positive">Tildelt deg</V10Badge></View> : null}
      <V10Section title="Tilgjengelige i fleeten"><V10Group>{vehicles.map((vehicle, index) => {
        const disabled = vehicle.active === false || vehicle.busy || !!busyId;
        return <Pressable key={vehicle.id} testID={`driver-vehicle-${vehicle.id}`} accessibilityRole="radio" aria-checked={!!vehicle.selected} accessibilityState={{ checked: !!vehicle.selected, selected: !!vehicle.selected, disabled: !!disabled }} disabled={!!disabled || vehicle.selected} onPress={() => void select(vehicle)}
          style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, opacity: vehicle.active === false || vehicle.busy ? .55 : 1 }}>
          {index ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: colors.line }} /> : null}
          <View style={{ width: 56, height: 38, borderRadius: 10, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="vehicle" size={24} /></View>
          <View style={{ flex: 1 }}><Text style={v10.body}>{vehicle.plate || 'Uten skilt'}</Text><Text style={v10.caption}>{vehicle.car || 'Bil uten modellnavn'}{vehicle.active === false ? ' · Parkert' : vehicle.busy ? ' · I bruk' : ''}</Text></View>
          {busyId === vehicle.id ? <Loader /> : <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: vehicle.selected ? 7 : 1.5, borderColor: vehicle.selected ? colors.text : colors.lineStrong }} />}
        </Pressable>;
      })}</V10Group></V10Section>
      <Text style={[v10.caption, { marginTop: 12, marginHorizontal: 4 }]}>Gå offline og avslutt aktiv tur før du bytter bil.</Text>
      {error ? <Text accessibilityRole="alert" testID="driver-vehicle-error" style={[v10.secondary, { marginTop: 12, color: colors.danger }]}>{error}</Text> : null}
    </>}
  </V10Screen>;
}

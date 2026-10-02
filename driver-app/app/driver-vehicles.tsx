import { Text } from '@/src/components/Typography';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Loader } from '@/src/components/ui';
import { driverApi, apiError } from '@/src/lib/api';
import { vehicleMeta } from '@/src/lib/format';
import { useAuth } from '@/src/context/AuthContext';

type AssignedVehicle = {
  id: string;
  car?: string;
  plate?: string;
  vehicle_type?: string;
  active?: boolean;
  selected?: boolean;
};

export default function DriverVehicles() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
  const [busyId, setBusyId] = useState('');
  const [err, setErr] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['driver-vehicles'],
    queryFn: driverApi.vehicles,
  });

  const vehicles: AssignedVehicle[] = data?.vehicles || [];

  const select = async (vehicle: AssignedVehicle) => {
    if (!vehicle.id || vehicle.selected || vehicle.active === false || busyId) return;
    setBusyId(vehicle.id);
    setErr('');
    try {
      await driverApi.selectVehicle(vehicle.id);
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await refetch();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusyId('');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.driverBg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: 20 }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.back} testID="driver-vehicles-back">
            <Icon name="arrow-left" size={20} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Mine biler</Text>
            <Text style={s.subtitle}>Kun biler tildelt av løyvehaveren</Text>
          </View>
        </View>

        <View style={s.info}>
          <Icon name="car" size={20} color={colors.online} />
          <Text style={s.infoText}>Velg bilen du skal bruke før du går online. Bilbytte er blokkert mens du er online eller har en aktiv tur.</Text>
        </View>

        {isLoading ? (
          <View style={{ paddingVertical: 60 }}><Loader label="Henter tildelte biler…" /></View>
        ) : vehicles.length ? (
          <View style={{ gap: 12 }}>
            {vehicles.map((v) => {
              const meta = vehicleMeta(v.vehicle_type || 'ai-first');
              const disabled = v.active === false || !!busyId;
              return (
                <Pressable
                  key={v.id}
                  testID={`driver-vehicle-${v.id}`}
                  onPress={() => void select(v)}
                  disabled={disabled || v.selected}
                  style={({ pressed }) => [
                    s.card,
                    v.selected && s.cardSelected,
                    v.active === false && { opacity: 0.55 },
                    pressed && !v.selected && !disabled && { opacity: 0.82 },
                  ]}
                >
                  <View style={s.carIcon}><Icon name="car" size={22} color={v.selected ? colors.online : colors.textSecondary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.carName}>{v.car || 'Bil uten modellnavn'}</Text>
                    <Text style={s.plate}>{v.plate || 'Uten skilt'} · {meta.name}</Text>
                    {v.active === false ? <Text style={s.parked}>Parkert av løyvehaver</Text> : null}
                  </View>
                  {busyId === v.id ? <Loader /> : v.selected ? (
                    <View style={s.selectedBadge}><Icon name="check" size={14} color={colors.accentOn} /><Text style={s.selectedText}>Aktiv</Text></View>
                  ) : (
                    <Icon name="chevron-right" size={19} color={colors.textMuted} />
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={s.empty}>
            <Icon name="car" size={28} color={colors.textMuted} />
            <Text style={s.emptyTitle}>Ingen biler tildelt</Text>
            <Text style={s.emptyText}>Be løyvehaveren tildele en registrert bil i Fleet før du går online.</Text>
          </View>
        )}

        {err ? <Text style={s.error}>{err}</Text> : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  title: { color: c.text, fontFamily: font.display, fontSize: 26 },
  subtitle: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 18, backgroundColor: c.onlineSoft, borderWidth: 1, borderColor: c.line, marginBottom: 18 },
  infoText: { flex: 1, color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  card: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, backgroundColor: c.driverCard, borderWidth: 1, borderColor: c.line },
  cardSelected: { borderColor: c.online, backgroundColor: c.onlineSoft },
  carIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle },
  carName: { color: c.text, fontFamily: font.semibold, fontSize: 16 },
  plate: { color: c.textMuted, fontSize: 13, marginTop: 4 },
  parked: { color: c.warning, fontSize: 12, marginTop: 5 },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: c.online, paddingHorizontal: 10, paddingVertical: 6 },
  selectedText: { color: c.accentOn, fontFamily: font.semibold, fontSize: 11 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 54, paddingHorizontal: 24, borderRadius: 20, borderWidth: 1, borderColor: c.line, backgroundColor: c.driverCard },
  emptyTitle: { color: c.text, fontFamily: font.display, fontSize: 19 },
  emptyText: { color: c.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  error: { color: c.danger, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 16 },
}));


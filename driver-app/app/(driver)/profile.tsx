import React, { useEffect, useRef, useState } from 'react';
import { AppState, Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, font } from '@/src/theme';
import { Text } from '@/src/components/Typography';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { DesignToggle } from '@/src/components/DesignToggle';
import { Icon, type IconName } from '@/src/components/Icon';
import { Loader } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { authApi, authenticatedFileSource, driverApi, settingsApi, apiError } from '@/src/lib/api';
import { storage } from '@/src/utils/storage';
import { kr, vehicleMeta } from '@/src/lib/format';

export default function DriverProfile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, logout, refresh } = useAuth();
  const vehicleLock = useRef(false);
  const notificationLock = useRef(false);
  const active = useRef(true);
  const [busyId, setBusyId] = useState('');
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [error, setError] = useState('');
  const [notificationValue, setNotificationValue] = useState<boolean | null>(null);
  const me = useQuery({ queryKey: ['me'], queryFn: authApi.me });
  const ratings = useQuery({ queryKey: ['driver-ratings'], queryFn: driverApi.ratings });
  const vehicles = useQuery({ queryKey: ['driver-vehicles'], queryFn: driverApi.vehicles });
  const summary = useQuery({ queryKey: ['driver-summary'], queryFn: driverApi.summary });
  const payouts = useQuery({ queryKey: ['driver-payouts'], queryFn: driverApi.payouts });
  const notificationSettings = useQuery({ queryKey: ['driver-notification-settings', user?.id], queryFn: settingsApi.get, enabled: !!user?.id });
  const notificationData = notificationSettings.data?.settings || notificationSettings.data;
  const u = { ...(user || {}), ...(me.data || {}) } as any;
  const profilePhoto = useQuery({ queryKey: ['driver-profile-photo-source', u.profile_photo_path], queryFn: () => authenticatedFileSource(u.profile_photo_path), enabled: !!u.profile_photo_path });
  const verified = u.identity_verification_status === 'verified';
  const initials = (u.fullName || 'S').split(' ').map((part: string) => part[0]).slice(0, 2).join('').toUpperCase();
  useEffect(() => {
    active.current = true;
    const load = () => Notifications.getPermissionsAsync().then(result => { if (active.current) setNotificationValue(result.granted); }).catch(() => {});
    void load();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { active.current = false; listener.remove(); };
  }, []);

  const setOfferNotifications = async (enabled: boolean) => {
    if (!user?.id || notificationLock.current) return;
    notificationLock.current = true;
    setNotificationSaving(true); setError('');
    try {
      if (enabled && notificationValue !== true) {
        const permission = await Notifications.requestPermissionsAsync();
        if (!active.current) return;
        setNotificationValue(permission.granted);
        if (!permission.granted) {
          setError('Tillat varsler i telefonens innstillinger for å få nye turforespørsler.');
          return;
        }
      }
      if (!active.current) return;
      const response = await settingsApi.update({ notif_requests: enabled });
      const confirmed = response?.settings || response;
      if (confirmed?.notif_requests !== enabled) throw new Error('Kunne ikke bekrefte varselvalget. Prøv igjen.');
      if (!active.current) return;
      qc.setQueryData(['driver-notification-settings', user.id], confirmed);
      await storage.setItem('driver_notif_requests', String(enabled)).catch(() => {});
    } catch (e) { if (active.current) setError(apiError(e)); }
    finally { notificationLock.current = false; if (active.current) setNotificationSaving(false); }
  };

  const selectVehicle = async (v: any) => {
    if (!v.id || v.selected || v.active === false || vehicleLock.current) return;
    vehicleLock.current = true;
    setBusyId(v.id); setError('');
    try {
      await driverApi.selectVehicle(v.id);
      await refresh();
      await qc.invalidateQueries({ queryKey: ['me'] });
      await vehicles.refetch();
    } catch (e) { setError(apiError(e)); }
    finally { vehicleLock.current = false; setBusyId(''); }
  };

  const docs = [
    { label: 'Førerkort', path: u.drivers_license_path },
    { label: 'Kjøreseddel', path: u.taxi_license_path },
    { label: 'Profilbilde', path: u.profile_photo_path },
  ];
  return <View style={{ flex: 1 }}>
    <FigmaGradient angle={180} colors={['#FFFFFF', '#F2F5FA']} style={StyleSheet.absoluteFill} />
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 112, paddingHorizontal: 28 }}>
      <Text style={s.title}>Min profil</Text>
      <View style={s.account}>
        <Pressable onPress={() => router.push('/driver-profile-photo')} testID="driver-profile-photo-open" accessibilityRole="button" accessibilityLabel="Endre profilbilde" style={s.avatarWrap}>
          <FigmaGradient angle={135} colors={['#012A54', '#001F3F']} style={s.avatar}>
            {profilePhoto.data ? <Image source={profilePhoto.data} style={{ width: 64, height: 64 }} /> : <Text style={s.avatarText}>{initials}</Text>}
          </FigmaGradient>
          {verified && <View style={s.verifiedBadge}><Icon name="check" size={14} color="#FFFFFF" /></View>}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{u.fullName || 'Sjåfør'}</Text>
          <Text style={s.sub}>{[u.phone, u.email].filter(Boolean).join(' · ')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Icon name="star" size={14} color={colors.warning} />
            <Text style={[s.sub, { color: colors.warning, fontFamily: font.semibold }]}>{ratings.data?.count ? `${ratings.data.average} · ${u.trip_count ?? ratings.data.count} turer` : ratings.isError ? 'Vurderinger utilgjengelige' : 'Ingen vurderinger'}</Text>
          </View>
        </View>
      </View>
      <Outline label="Endre passord" onPress={() => router.push('/forgot-password')} />
      <Section>Du kjører for</Section>
      <View style={s.row} testID="driver-fleet-card">
        <FigmaGradient angle={135} colors={['#012A54', '#001F3F']} style={s.fleetIcon}><Icon name="shield" size={20} color="#FFFFFF" /></FigmaGradient>
        <View style={{ flex: 1 }}><Text style={s.label}>{u.fleet_name || 'Ikke tilknyttet'}</Text><Text style={s.sub}>Org.nr {u.fleet_org_number || '—'}</Text></View>
        {!!u.fleet_id && <Badge label="Tilknyttet" />}
      </View>
      <Section>Kjøretøy</Section>
      <Text style={[s.sub, { marginTop: 4 }]}>Velg blant kjøretøy tildelt av flåteeier.</Text>
      <View style={{ gap: 8, marginTop: 12 }}>
        {vehicles.isLoading ? <Loader /> : vehicles.isError ? <Text style={s.error}>Kunne ikke hente tildelte kjøretøy.</Text> : (vehicles.data?.vehicles || []).map((v: any) => <Pressable key={v.id} testID={`driver-profile-vehicle-${v.id}`} accessibilityRole="radio" accessibilityState={{ selected: !!v.selected, disabled: v.active === false || !!busyId }} disabled={v.active === false || !!busyId || v.selected} onPress={() => void selectVehicle(v)} style={[s.row, { marginTop: 0, borderColor: v.selected ? colors.accent : colors.lineStrong, boxShadow: v.selected ? '0 0 0 4px rgba(255,0,0,0.1)' : undefined, opacity: v.active === false ? 0.55 : 1 }]}>
          <View style={[s.roundIcon, { backgroundColor: v.selected ? colors.accentSoft : colors.cardSubtle }]}><Icon name="car" size={20} color={v.selected ? colors.accent : colors.textSecondary} /></View>
          <View style={{ flex: 1 }}><Text style={s.label}>{v.car || 'Bil uten modellnavn'}</Text><Text style={s.sub}>{v.plate || 'Uten skilt'} · {vehicleMeta(v.vehicle_type || 'ai-first').name}{v.active === false ? ' · Parkert' : ''}</Text></View>
          {busyId === v.id ? <Loader /> : v.selected ? <View style={s.selected}><Icon name="check" size={14} color="#FFFFFF" /></View> : <Text style={s.vehicleClass}>{vehicleMeta(v.vehicle_type || 'ai-first').name}</Text>}
        </Pressable>)}
        {!vehicles.isLoading && !vehicles.isError && !vehicles.data?.vehicles?.length && <Outline label="Ingen biler tildelt" onPress={() => router.push('/driver-vehicles')} />}
      </View>
      {error ? <Text style={s.error} accessibilityRole="alert">{error}</Text> : null}
      <Section>Identitet</Section>
      <Pressable style={s.row} onPress={() => router.push('/driver-identity')} testID="profile-identity">
        <View style={[s.roundIcon, { backgroundColor: verified ? 'rgba(76,175,80,0.12)' : colors.cardSubtle }]}><Icon name="user" size={20} color={verified ? colors.success : colors.textSecondary} /></View>
        <View style={{ flex: 1 }}><Text style={s.label}>{verified ? 'Identitet verifisert' : u.identity_verification_status === 'pending_review' ? 'Til kontroll' : 'Identitetskontroll'}</Text><Text style={s.sub}>{verified ? 'Identitetskontrollen er godkjent' : 'Se status og ta en ny selfie'}</Text></View>
        {verified ? <Badge label="Verifisert" /> : <Icon name="chevron-right" size={16} color={colors.textMuted} />}
      </Pressable>
      <Section>Dokumenter</Section>
      <View style={[s.card, { marginTop: 12, gap: 8 }]}>
        {docs.map(d => <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: d.path ? colors.success : colors.warning }} />
          <Text style={{ flex: 1, fontSize: 12, fontFamily: font.medium }}>{d.label}</Text>
          <Text style={[s.sub, { color: d.path ? colors.success : colors.warning }]}>{d.path ? 'Mottatt' : 'Mangler'}</Text>
        </View>)}
      </View>
      <Section>Inntekter og utbetalinger</Section>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <Stat label="I dag" value={summary.data ? kr(summary.data.income) : '—'} color={colors.success} />
        <Stat label="Siste 7 dager" value={payouts.data ? kr(payouts.data.earned_net_7d) : '—'} color={colors.accent} />
      </View>
      <Pressable style={s.row} onPress={() => router.push('/(driver)/earnings')}>
        <View style={{ flex: 1 }}><Text style={s.label}>Neste utbetaling til flåten</Text><Text style={s.sub}>{payouts.data?.next_payout_date ? new Date(payouts.data.next_payout_date).toLocaleDateString('nb-NO') : 'Ingen bekreftet dato'}</Text></View>
        <Icon name="chevron-right" size={16} color={colors.textMuted} />
      </Pressable>
      <Outline label="Se detaljerte inntektsrapporter" onPress={() => router.push('/(driver)/earnings')} />
      <Section>Sikkerhet og vurderinger</Section>
      <Pressable style={s.row} onPress={() => router.push('/driver-settings')}>
        <View style={[s.roundIcon, { backgroundColor: 'rgba(76,175,80,0.12)' }]}><Icon name="shield" size={20} color={colors.success} /></View>
        <View style={{ flex: 1 }}><Text style={s.label}>Sikkerhetsprofil</Text><Text style={s.sub}>{verified ? 'Verifisert sjåfør' : 'Kontroller identitetsstatusen din'}</Text></View>
        <Icon name="chevron-right" size={16} color={colors.textMuted} />
      </Pressable>
      <Section>Appinnstillinger</Section>
      <View style={{ marginTop: 12, gap: 12 }}>
        <Setting icon="car" label="Kjøremodus" sub="Ikke forstyrr under kjøring" onPress={() => void Linking.openSettings()} />
        <View style={[s.row, { marginTop: 0 }]}>
          <View style={s.settingIcon}><Icon name="bell" size={20} color={colors.textSecondary} /></View>
          <View style={{ flex: 1 }}><Text style={s.label}>Push for nye turer</Text><Text style={s.sub}>Varsel ved forespørsel i nærheten</Text></View>
          <DesignToggle label="Push for nye turer" value={notificationValue === true && !!notificationData && notificationData.notif_requests !== false} disabled={notificationValue === null || !notificationData || notificationSaving} onChange={value => void setOfferNotifications(value)} testID="profile-push-toggle" />
        </View>
        <Setting icon="globe" label="Språk" sub="Norsk (bokmål)" onPress={() => router.push('/driver-settings')} />
        <Setting icon="user" label="Tilgjengelighet" sub="Stor tekst · Høykontrast" onPress={() => void Linking.openSettings()} />
        <Outline label="Mine turer" onPress={() => router.push('/driver-trips')} style={{ marginTop: 0 }} />
        <Outline label="Innstillinger" onPress={() => router.push('/driver-settings')} style={{ marginTop: 0 }} />
      </View>
      <Pressable style={s.logout} onPress={logout} testID="driver-logout"><Text style={{ color: colors.danger, fontSize: 14, fontFamily: font.semibold }}>Logg ut</Text></Pressable>
    </ScrollView>
  </View>;
}
function Section({ children }: { children: React.ReactNode }) { return <Text style={s.section}>{children}</Text>; }
function Badge({ label }: { label: string }) { return <View style={s.badge}><Text style={{ color: '#FFFFFF', fontSize: 10, fontFamily: font.semibold }}>{label}</Text></View>; }
function Outline({ label, onPress, style }: { label: string; onPress: () => void; style?: object }) { return <Pressable style={[s.outline, style]} onPress={onPress}><Text style={{ color: colors.accent, fontSize: 14, fontFamily: font.semibold }}>{label}</Text></Pressable>; }
function Setting({ icon, label, sub, onPress }: { icon: IconName; label: string; sub: string; onPress: () => void }) { return <Pressable style={[s.row, { marginTop: 0 }]} onPress={onPress}><View style={s.settingIcon}><Icon name={icon} size={20} color={colors.textSecondary} /></View><View style={{ flex: 1 }}><Text style={s.label}>{label}</Text><Text style={s.sub}>{sub}</Text></View><Icon name="chevron-right" size={16} color={colors.textMuted} /></Pressable>; }
function Stat({ label, value, color }: { label: string; value: string; color: string }) { return <View style={[s.card, { flex: 1, boxShadow: '0 2px 6px rgba(11,14,20,0.04)' }]}><Text style={{ fontFamily: font.mono, fontSize: 9, letterSpacing: 1.8, color: colors.textMuted, textTransform: 'uppercase' }}>{label}</Text><Text style={{ marginTop: 8, fontFamily: font.semibold, fontSize: 24, letterSpacing: -0.48, color }}>{value.endsWith(' kr') ? <>{value.slice(0, -3)}<Text style={{ fontFamily: font.body, fontSize: 12, color: colors.textSecondary }}> kr</Text></> : value}</Text></View>; }
const s = StyleSheet.create({
  title: { fontFamily: font.semibold, fontSize: 24, letterSpacing: -0.48, color: colors.text },
  account: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 24, padding: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  avatarWrap: { width: 64, height: 64 }, avatar: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.semibold, fontSize: 24, color: '#FFFFFF', letterSpacing: -0.48 },
  verifiedBadge: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.success, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: font.semibold, fontSize: 18, letterSpacing: -0.36, color: colors.text },
  label: { fontFamily: font.semibold, fontSize: 14, color: colors.text }, sub: { fontSize: 12, color: colors.textSecondary },
  section: { marginTop: 28, fontFamily: font.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 16 },
  row: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 16 },
  roundIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  fleetIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  settingIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' },
  badge: { backgroundColor: colors.success, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  selected: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  vehicleClass: { fontSize: 10, fontFamily: font.semibold, color: colors.textSecondary, backgroundColor: colors.cardSubtle, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  outline: { marginTop: 12, borderRadius: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  error: { fontSize: 12, color: colors.danger, marginTop: 8 },
  logout: { marginTop: 20, borderRadius: 16, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(244,67,54,0.25)' },
});

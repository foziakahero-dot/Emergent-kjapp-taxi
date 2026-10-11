import { ChatSheet } from '@/src/components/ChatSheet';
import { Icon } from '@/src/components/Icon';
import { Text } from '@/src/components/Typography';
import { useAuth } from '@/src/context/AuthContext';
import { tripsApi } from '@/src/lib/api';
import { colors, font, makeStyles } from '@/src/theme';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ActiveTripSummary = {
  trip_id: string;
  status: string;
  driver_id?: string | null;
  driver?: { name?: string };
};

const chatStatuses = new Set(['driver_on_way', 'at_pickup', 'in_trip']);

export default function CustomerMessages() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const activeTripQuery = useQuery<ActiveTripSummary | null>({
    queryKey: ['customer-active-trip', user?.id],
    queryFn: async () => {
      const trip = await tripsApi.active();
      return trip?.trip_id ? trip : null;
    },
    enabled: !!user?.id,
    retry: 1,
  });
  const trip = activeTripQuery.data;
  const canChat = !!trip?.driver_id && chatStatuses.has(trip.status);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>SNAR</Text>
        <Text accessibilityRole="header" style={styles.title}>Meldinger</Text>
        <Text style={styles.subtitle}>Samtaler knyttet til den aktive reisen din.</Text>

        {activeTripQuery.isPending ? (
          <View style={styles.stateCard} accessibilityLabel="Henter aktive reiser">
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.stateText}>Henter reisestatus …</Text>
          </View>
        ) : activeTripQuery.isError ? (
          <View style={styles.stateCard}>
            <Icon name="message" size={24} color={colors.textMuted} />
            <Text style={styles.cardTitle}>Kunne ikke hente reisestatus</Text>
            <Text style={styles.stateText}>Meldinger vises først når serveren har bekreftet en aktiv reise.</Text>
            <Pressable accessibilityRole="button" onPress={() => void activeTripQuery.refetch()} style={styles.action}>
              <Text style={styles.actionText}>Prøv igjen</Text>
            </Pressable>
          </View>
        ) : canChat ? (
          <View style={styles.tripCard}>
            <View style={styles.iconWrap}><Icon name="message" size={22} color={colors.accent} /></View>
            <View style={styles.tripCopy}>
              <Text style={styles.cardTitle}>{trip?.driver?.name || 'Sjåføren din'}</Text>
              <Text style={styles.stateText}>Meldinger for den aktive reisen</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Åpne meldinger med sjåføren"
              onPress={() => setChatOpen(true)}
              style={styles.openButton}
            >
              <Icon name="chevron-right" size={20} color={colors.text} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.stateCard}>
            <View style={styles.iconWrap}><Icon name="message" size={22} color={colors.textMuted} /></View>
            <Text style={styles.cardTitle}>Ingen aktive samtaler</Text>
            <Text style={styles.stateText}>
              {trip && ['searching', 'booking', 'payment_authorizing'].includes(trip.status)
                ? 'Meldinger blir tilgjengelige når en sjåfør er tildelt.'
                : 'Meldinger er tilgjengelige under en aktiv reise med tildelt sjåfør.'}
            </Text>
          </View>
        )}
      </ScrollView>
      {canChat && trip ? (
        <ChatSheet
          tripId={trip.trip_id}
          role="passenger"
          visible={chatOpen}
          onClose={() => setChatOpen(false)}
          peerName={trip.driver?.name || 'Din sjåfør'}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(c => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 28 },
  eyebrow: { color: c.accent, fontFamily: font.semibold, fontSize: 11, lineHeight: 16, letterSpacing: 1.4 },
  title: { color: c.text, fontFamily: font.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.8, marginTop: 6 },
  subtitle: { color: c.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: 26 },
  stateCard: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 22, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, padding: 22 },
  tripCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, padding: 14 },
  iconWrap: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft },
  tripCopy: { flex: 1, gap: 3 },
  cardTitle: { color: c.text, fontFamily: font.semibold, fontSize: 16, lineHeight: 21, textAlign: 'center' },
  stateText: { color: c.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  openButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 14, backgroundColor: c.accent, marginTop: 4 },
  actionText: { color: c.accentOn, fontFamily: font.semibold, fontSize: 14 },
}));

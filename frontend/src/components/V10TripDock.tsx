import React, { type RefObject } from 'react';
import { View } from 'react-native';
import { Dock } from './snar10/Dock';
export function V10TripDock({ target, active = 'driver', onDriver, onMessage, onSafety, onTrip }: {
  target?: RefObject<View | null>; active?: 'driver' | 'message' | 'safety' | 'trip';
  onDriver: () => void; onMessage: () => void; onSafety: () => void; onTrip: () => void;
}) {
  const actions: Record<string, () => void> = { driver: onDriver, message: onMessage, safety: onSafety, trip: onTrip };
  return <Dock testID="trip-dock" target={target} active={active} items={[
    { id: 'driver', label: 'Sjåfør', icon: 'driver' }, { id: 'message', label: 'Melding', icon: 'message' },
    { id: 'safety', label: 'Sikkerhet', icon: 'safety' }, { id: 'trip', label: 'Tur', icon: 'trip' },
  ].map(item => ({ ...item, testID: `trip-dock-${item.id}` }))} onSelect={id => actions[id]?.()} />;
}

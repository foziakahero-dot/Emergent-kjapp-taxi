import React, { useMemo, useRef } from 'react';
import { PanResponder, View } from 'react-native';

/** Original 80x28 sheet handle: tap or deliberate downward swipe minimizes. */
export function V10MinimizeHandle({ onMinimize }: { onMinimize: () => void }) {
  const action = useRef(onMinimize);
  action.current = onMinimize;
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderRelease: (_event, gesture) => {
      if ((gesture.dy > 24 && gesture.dy > Math.abs(gesture.dx)) || (Math.abs(gesture.dx) < 8 && Math.abs(gesture.dy) < 8)) action.current();
    },
    onPanResponderTerminationRequest: () => true,
  }), []);
  return <View {...pan.panHandlers} testID="trip-minimize-handle" accessible accessibilityRole="button" accessibilityLabel="Minimer tur"
    accessibilityActions={[{ name: 'activate', label: 'Minimer tur' }]} onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'activate') action.current(); }}
    style={{ position: 'absolute', top: 0, left: '50%', width: 80, height: 28, transform: [{ translateX: -40 }], zIndex: 1 }} />;
}

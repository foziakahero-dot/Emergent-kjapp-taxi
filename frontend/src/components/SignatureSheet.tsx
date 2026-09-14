import React, { ReactNode, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Keyboard,
  PanResponder,
  Pressable,
  StyleProp,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/src/theme';

export type SignatureSheetSnap = 'peek' | 'half' | 'full';

const SNAP_ORDER: SignatureSheetSnap[] = ['full', 'half', 'peek'];

export function SignatureSheet({
  children,
  snap,
  onSnapChange,
  peekHeight = 164,
  halfRatio = 0.48,
  fullRatio = 0.86,
  bottomOffset = 76,
  style,
  testID,
}: {
  children: ReactNode;
  snap: SignatureSheetSnap;
  onSnapChange: (snap: SignatureSheetSnap) => void;
  peekHeight?: number;
  halfRatio?: number;
  fullRatio?: number;
  bottomOffset?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { height } = useWindowDimensions();
  const availableHeight = Math.max(480, height - bottomOffset - 8);
  const maxHeight = Math.max(420, Math.round(availableHeight * fullRatio));
  const snapOffsets = useMemo(
    () => ({
      full: 0,
      half: Math.max(0, maxHeight - Math.round(availableHeight * halfRatio)),
      peek: Math.max(0, maxHeight - peekHeight),
    }),
    [availableHeight, maxHeight, halfRatio, peekHeight],
  );

  const translateY = useRef(new Animated.Value(snapOffsets[snap])).current;
  const startY = useRef(snapOffsets[snap]);

  const animateTo = (next: SignatureSheetSnap, haptic = false) => {
    if (haptic) Haptics.selectionAsync().catch(() => {});
    if (next === 'peek') Keyboard.dismiss();
    Animated.spring(translateY, {
      toValue: snapOffsets[next],
      useNativeDriver: true,
      stiffness: 280,
      damping: 30,
      mass: 0.85,
    }).start();
    onSnapChange(next);
  };

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: snapOffsets[snap],
      useNativeDriver: true,
      stiffness: 280,
      damping: 30,
      mass: 0.85,
    }).start();
  }, [snap, snapOffsets.full, snapOffsets.half, snapOffsets.peek, translateY]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
    onPanResponderGrant: () => {
      translateY.stopAnimation((value) => { startY.current = value; });
    },
    onPanResponderMove: (_e, g) => {
      const next = Math.max(snapOffsets.full, Math.min(snapOffsets.peek, startY.current + g.dy));
      translateY.setValue(next);
    },
    onPanResponderRelease: (_e, g) => {
      const projected = Math.max(
        snapOffsets.full,
        Math.min(snapOffsets.peek, startY.current + g.dy + g.vy * 90),
      );
      const next = SNAP_ORDER.reduce((best, candidate) =>
        Math.abs(snapOffsets[candidate] - projected) < Math.abs(snapOffsets[best] - projected)
          ? candidate
          : best,
      'half' as SignatureSheetSnap);
      animateTo(next, true);
    },
    onPanResponderTerminate: () => animateTo(snap),
  }), [snap, snapOffsets.full, snapOffsets.half, snapOffsets.peek, translateY]);

  return (
    <Animated.View
      testID={testID}
      style={[
        {
          position: 'absolute',
          left: 10,
          right: 10,
          bottom: bottomOffset,
          height: maxHeight,
          borderRadius: 30,
          overflow: 'hidden',
          backgroundColor: 'rgba(12,18,22,0.97)',
          borderWidth: 1,
          borderColor: colors.lineStrong,
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: -8 },
          elevation: 18,
          transform: [{ translateY }],
        },
        style,
      ]}
    >
      <View {...pan.panHandlers} style={{ height: 30, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable
          accessibilityRole="adjustable"
          onPress={() => animateTo(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek', true)}
          hitSlop={12}
          style={{ width: 66, height: 22, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ width: 42, height: 4, borderRadius: 99, backgroundColor: colors.lineStrong }} />
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Animated.View>
  );
}

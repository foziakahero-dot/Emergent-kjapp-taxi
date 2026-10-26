import React, { useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/src/components/Typography';
import { V10Icon as Icon } from '@/src/components/V10Icon';
import { colors, font, useColorTheme } from '@/src/theme';
import { animation, dock, dockBottom } from '@/src/theme/snar10';
import { Glass } from './Glass';

export type DockItem = {
  id: string;
  label: string;
  icon: string;
  ai?: boolean;
  dot?: boolean;
  testID?: string;
  accessibilityLabel?: string;
};

type DockButtonProps = {
  item: DockItem;
  selected: boolean;
  reduceMotion: boolean;
  onSelect: (id: string) => void;
  onLongPress?: (id: string) => void;
};

function DockButton({ item, selected, reduceMotion, onSelect, onLongPress }: DockButtonProps) {
  useColorTheme();
  const pressScale = useRef(new Animated.Value(1)).current;
  const selectedProgress = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const pulseValues = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    if (reduceMotion) {
      selectedProgress.setValue(selected ? 1 : 0);
      return;
    }
    Animated.timing(selectedProgress, {
      toValue: selected ? 1 : 0,
      duration: animation.component,
      easing: Easing.bezier(...animation.easeOut),
      useNativeDriver: false,
    }).start();
  }, [reduceMotion, selected, selectedProgress]);

  useEffect(() => {
    if (!item.ai || !selected || reduceMotion) {
      breathe.stopAnimation();
      breathe.setValue(0);
      pulseValues.forEach(value => {
        value.stopAnimation();
        value.setValue(0);
      });
      return;
    }

    const breatheLoop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));

    const pulseLoops = pulseValues.map((value, index) => Animated.sequence([
      Animated.delay(index * animation.aiStagger),
      Animated.loop(Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: animation.aiPulse, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])),
    ]));

    breatheLoop.start();
    pulseLoops.forEach(loop => loop.start());
    return () => {
      breatheLoop.stop();
      pulseLoops.forEach(loop => loop.stop());
    };
  }, [breathe, item.ai, pulseValues, reduceMotion, selected]);

  const pressIn = () => {
    if (reduceMotion) return;
    Animated.timing(pressScale, {
      toValue: animation.pressScale,
      duration: animation.pressIn,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    if (reduceMotion) {
      pressScale.setValue(1);
      return;
    }
    Animated.spring(pressScale, {
      toValue: 1,
      stiffness: 340,
      damping: 22,
      mass: .7,
      useNativeDriver: true,
    }).start();
  };

  const select = () => {
    if (Platform.OS !== 'web') {
      const feedback = item.ai
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        : Haptics.selectionAsync();
      void feedback.catch(() => undefined);
    }
    onSelect(item.id);
  };

  if (item.ai) {
    const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
    return (
      <Pressable
        key={item.id}
        testID={item.testID ?? `tab-${item.id}`}
        accessibilityRole="tab"
        accessibilityLabel={item.accessibilityLabel ?? item.label}
        accessibilityState={{ selected }}
        onPress={select}
        onLongPress={() => onLongPress?.(item.id)}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.aiPressable}
      >
        <Animated.View style={{ alignItems: 'center', transform: [{ translateY: -dock.aiLift }, { scale: pressScale }] }}>
          <View style={{ width: dock.aiHaloSize, height: dock.aiHaloSize, alignItems: 'center', justifyContent: 'center' }}>
            <View pointerEvents="none" style={styles.aiIdleHalo} />
            {pulseValues.map((value, index) => (
              <Animated.View
                key={`pulse-${index}`}
                pointerEvents="none"
                style={[
                  styles.aiPulseRing,
                  {
                    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [.28, 0] }),
                    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, 1.65] }) }],
                  },
                ]}
              />
            ))}
            <Animated.View style={[styles.aiButton, { transform: [{ scale: breatheScale }] }]}>
              <Icon name={item.icon} size={25} color={colors.accentOn} />
            </Animated.View>
          </View>
          <Text style={styles.aiLabel}>{item.label}</Text>
        </Animated.View>
      </Pressable>
    );
  }

  const activeBackground = selectedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', colors.accentSoft],
  });
  const activeScale = selectedProgress.interpolate({ inputRange: [0, 1], outputRange: [.94, 1] });
  const color = selected ? colors.accent : colors.textMuted;

  return (
    <Pressable
      key={item.id}
      testID={item.testID ?? `tab-${item.id}`}
      accessibilityRole="tab"
      accessibilityLabel={item.accessibilityLabel ?? item.label}
      accessibilityState={{ selected }}
      onPress={select}
      onLongPress={() => onLongPress?.(item.id)}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={{ width: dock.itemWidth, height: dock.itemHeight }}
    >
      <Animated.View
        testID={selected ? `dock-active-${item.id}` : undefined}
        style={{
          flex: 1,
          borderRadius: dock.itemRadius,
          backgroundColor: activeBackground,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          transform: [{ scale: Animated.multiply(pressScale, activeScale) }],
        }}
      >
        <Icon name={item.icon} size={22} color={color} />
        <Text style={{ color, fontFamily: font.medium, fontSize: dock.labelSize, lineHeight: dock.labelLineHeight }}>
          {item.label}
        </Text>
        {item.dot ? (
          <View
            testID={`dock-unread-${item.id}`}
            style={{
              position: 'absolute',
              top: 6,
              right: 10,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.accent,
              boxShadow: `0 0 0 2px ${colors.surface}`,
            }}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

export function Dock({ items, active, onSelect, onLongPress, target, testID }: {
  items: DockItem[];
  active?: string;
  onSelect: (id: string) => void;
  onLongPress?: (id: string) => void;
  target?: RefObject<View | null>;
  testID?: string;
}) {
  useColorTheme();
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return (
    <View
      testID={testID}
      style={{
        position: 'absolute',
        left: dock.inset,
        right: dock.inset,
        bottom: dockBottom(insets.bottom),
        height: dock.height,
        borderRadius: dock.radius,
        boxShadow: colors.elevation2,
        zIndex: 40,
      }}
    >
      <View pointerEvents="none" style={styles.glassClip}>
        <Glass target={target} />
      </View>
      <View style={styles.itemsRow}>
        {items.map(item => (
          <DockButton
            key={item.id}
            item={item}
            selected={item.id === active}
            reduceMotion={reduceMotion}
            onSelect={onSelect}
            onLongPress={onLongPress}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glassClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderRadius: dock.radius,
    borderWidth: 1,
    borderColor: colors.glassLine,
  },
  itemsRow: {
    flex: 1,
    paddingHorizontal: dock.padding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    overflow: 'visible',
  },
  aiPressable: {
    width: dock.aiHaloSize,
    height: dock.height + dock.aiLift,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  aiIdleHalo: {
    position: 'absolute',
    width: dock.aiHaloSize,
    height: dock.aiHaloSize,
    borderRadius: dock.aiHaloSize / 2,
    backgroundColor: colors.accentGlow,
    opacity: .42,
  },
  aiPulseRing: {
    position: 'absolute',
    width: dock.aiSize,
    height: dock.aiSize,
    borderRadius: dock.aiRadius,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  aiButton: {
    width: dock.aiSize,
    height: dock.aiSize,
    borderRadius: dock.aiRadius,
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 20px -8px rgba(224,0,0,.55)',
  },
  aiLabel: {
    marginTop: dock.aiLabelGap,
    color: colors.accent,
    fontFamily: font.medium,
    fontSize: dock.labelSize,
    lineHeight: dock.labelLineHeight,
  },
});

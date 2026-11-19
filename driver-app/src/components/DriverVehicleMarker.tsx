import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useReducedMotion } from './Motion';

const SIZE = 56;
const parked = require('../../assets/markers/snar-parked.png');
const driving = require('../../assets/markers/snar-exhaust.webp');

export function DriverVehicleMarker({ heading, speed, point }: {
  heading: number;
  speed?: number | null; // GPS speed in metres per second
  point?: { x: number; y: number };
}) {
  const reducedMotion = useReducedMotion();
  const moving = !reducedMotion && (speed ?? 0) >= 1.5;
  return (
    <View pointerEvents="none" style={[
      { width: SIZE, height: SIZE, transform: [{ rotate: `${heading}deg` }] },
      point && { position: 'absolute', left: point.x - SIZE / 2, top: point.y - SIZE / 2 },
    ]}>
      <Image
        source={moving ? driving : parked}
        style={{ width: SIZE, height: SIZE }}
        contentFit="contain"
        useAppleWebpCodec={false}
        accessibilityLabel="Din bil og kjøreretning"
      />
    </View>
  );
}

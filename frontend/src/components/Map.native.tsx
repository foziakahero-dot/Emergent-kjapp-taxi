import React from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { InteractiveMap } from './InteractiveMap';
import { NativeMap } from './NativeMap';

export function Map(props: any) {
  const nativeGoogleConfigured = Boolean((Constants.expoConfig?.extra as any)?.googleMapsNative);
  if (Platform.OS === 'ios' || (Platform.OS === 'android' && nativeGoogleConfigured)) {
    return <NativeMap {...props} />;
  }
  return <InteractiveMap {...props} />;
}

export const InteractiveMapComponent = InteractiveMap;
export default Map;

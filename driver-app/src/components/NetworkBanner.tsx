import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';

export function NetworkBanner() {
  const net = useNetInfo();
  const offline = net.isConnected === false || net.isInternetReachable === false;
  if (!offline) return null;

  return (
    <View pointerEvents="none" style={styles.banner}>
      <Text style={styles.text}>Ingen nettforbindelse · prøver igjen automatisk</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10000,
    elevation: 10000,
    minHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#5B1A1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

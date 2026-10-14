import React from 'react';
import { colors, useColorTheme } from '@/src/theme';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

export function AppleSignInButton({
  loading = false,
  disabled = false,
  onPress,
}: {
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void | Promise<void>;
}) {
  const theme = useColorTheme();
  if (Platform.OS !== 'ios') return null;

  return (
    <View style={styles.wrap} pointerEvents={loading || disabled ? 'none' : 'auto'}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={theme.effective === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={16}
        style={styles.button}
        onPress={() => void onPress()}
      />
      {loading ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 56,
    position: 'relative',
  },
  button: {
    width: '100%',
    height: 56,
  },
  loading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
});

import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { colors, useColorTheme } from '@/src/theme';

export function AppleSignInButton({
  loading,
  disabled,
  onPress,
}: {
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void | Promise<void>;
}) {
  const theme = useColorTheme();
  if (loading) {
    return (
      <View
        style={{
          
          width: '100%',
          height: 56,
          borderRadius: 16,
          backgroundColor: colors.text,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.surface} />
      </View>
    );
  }

  return (
    <View pointerEvents={disabled ? 'none' : 'auto'} style={{ width: '100%', opacity: disabled ? .5 : 1 }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={theme.effective === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={16}
        style={{ width: '100%', height: 56 }}
        onPress={onPress}
      />
    </View>
  );
}


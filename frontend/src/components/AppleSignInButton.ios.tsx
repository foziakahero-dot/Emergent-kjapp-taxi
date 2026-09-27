import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { colors } from '@/src/theme';

export function AppleSignInButton({
  loading,
  onPress,
}: {
  loading?: boolean;
  onPress: () => void | Promise<void>;
}) {
  if (loading) {
    return (
      <View
        style={{
          marginTop: 10,
          width: '100%',
          height: 54,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.lineStrong,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={{ marginTop: 10, width: '100%' }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
        cornerRadius={14}
        style={{ width: '100%', height: 54 }}
        onPress={onPress}
      />
    </View>
  );
}

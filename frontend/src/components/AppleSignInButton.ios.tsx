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
          
          width: '100%',
          height: 50,
          borderRadius: 27,
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
    <View style={{  width: '100%' }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={27}
        style={{ width: '100%', height: 50 }}
        onPress={onPress}
      />
    </View>
  );
}


import React from 'react';
import Svg, { Path } from 'react-native-svg';

export function GoogleIcon() {
  return <Svg width={20} height={20} viewBox="0 0 24 24" accessibilityElementsHidden>
    <Path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 01-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
    <Path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3 0-5.6-2-6.5-4.8H1.5v3C3.5 21.4 7.4 24 12 24z" />
    <Path fill="#FBBC05" d="M5.5 14.5A7.2 7.2 0 015.1 12c0-.9.2-1.7.4-2.5v-3H1.5A12 12 0 000 12c0 1.9.5 3.8 1.5 5.5l4-3z" />
    <Path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.5 2.6 1.5 6.5l4 3C6.4 6.7 9 4.8 12 4.8z" />
  </Svg>;
}

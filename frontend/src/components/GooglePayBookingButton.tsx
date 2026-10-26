import React from 'react';
import { V10Action } from './V10UI';

export function GooglePayBookingButton(_: { disabled: boolean; onPress: () => void }) {
  return <V10Action label="Google Pay krever Android-appen" disabled onPress={() => {}} />;
}

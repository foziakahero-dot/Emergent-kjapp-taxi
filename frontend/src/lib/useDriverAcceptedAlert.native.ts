import { useEffect, useRef } from 'react';
import { Vibration } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { registerBookingAlert } from './acceptanceAlertState';

export function useDriverAcceptedAlert(key: string) {
  const player = useAudioPlayer(require('../../assets/driver-accepted.wav'));
  const status = useAudioPlayerStatus(player);
  const played = useRef('');
  useEffect(registerBookingAlert, []);
  useEffect(() => {
    if (!key || !status.isLoaded || played.current === key) return;
    played.current = key;
    Vibration.vibrate([0, 220, 140, 220]);
    void player.seekTo(0).then(() => player.play()).catch(() => {});
  }, [key, status.isLoaded, player]);
}

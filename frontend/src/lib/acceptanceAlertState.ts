// Foreground booking supplies its own sound; background pushes keep OS sound.
let active = 0;
export const bookingAlertActive = () => active > 0;
export function registerBookingAlert() { active++; return () => { active = Math.max(0, active - 1); }; }

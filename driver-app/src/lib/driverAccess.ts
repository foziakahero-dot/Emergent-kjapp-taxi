type DriverSession = {
  role?: string;
  approved?: boolean;
  driver_onboarding_allowed?: boolean;
};

export function isPendingDriver(user?: DriverSession | null): boolean {
  return user?.role === 'driver' && user.approved === false && user.driver_onboarding_allowed === true;
}

export function canKeepDriverSession(user?: DriverSession | null): boolean {
  return user?.role === 'driver' && (user.approved === true || isPendingDriver(user));
}

const onboardingScreens = new Set(['index', 'driver-approval', 'driver-identity', 'driver-legal-consent']);

export function canOpenDriverScreen(user: DriverSession | null | undefined, screen: string): boolean {
  return !isPendingDriver(user) || onboardingScreens.has(screen);
}

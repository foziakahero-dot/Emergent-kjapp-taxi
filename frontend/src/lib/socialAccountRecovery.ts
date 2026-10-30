export type SocialProvider = 'google' | 'apple';

export function socialProvider(value: unknown): SocialProvider | null {
  return value === 'google' || value === 'apple' ? value : null;
}

/** Other conflicts, including MFA, must keep their own recovery path. */
export function requiresAccountLink(error: any): boolean {
  return error?.response?.status === 409
    && error?.response?.data?.detail === 'Logg inn på den eksisterende SNAR-kontoen og koble identiteten under Konto.';
}

export function accountLinkInstructions(provider: SocialProvider): string {
  const name = provider === 'google' ? 'Google' : 'Apple';
  return `Du har allerede en SNAR-konto med denne e-postadressen. Logg inn med e-post og passord først. Velg deretter «Koble ${name}-konto» under Konto. Du trenger bare å gjøre dette én gang.`;
}

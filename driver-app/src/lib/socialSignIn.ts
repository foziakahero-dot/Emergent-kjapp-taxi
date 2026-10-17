// Web does not load native sign-in modules. Password login remains available.
export async function googleIdentity(_: { google_web_client_id: string; google_ios_client_id?: string }, _action: 'signin' | 'link' = 'signin'): Promise<string | { session: any } | null> {
  throw new Error('Bruk SNAR-appen for Google-innlogging.');
}
export async function appleIdentity(): Promise<string | null> { return null; }

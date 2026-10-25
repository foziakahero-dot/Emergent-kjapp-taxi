export type WalletKind = 'apple' | 'google';
export function usePlatformWallet(_accountId?: string, _onSaved?: () => Promise<void> | void) {
  return { kind: null as WalletKind | null, ready: false, busy: false, error: '', addWallet: async () => false };
}

// Web keeps the existing Checkout flow; native resolves nativePayment.native.ts.
export async function payNative(_tripId: string): Promise<null> { return null; }
export type NativeWallet = { kind: 'google' | 'apple'; label: string };
export async function nativeWalletAvailability(_config?: any): Promise<NativeWallet | null> { return null; }
export async function setupNativePaymentMethod(_walletRequired = false): Promise<any | null> { throw new Error('Bruk SNAR-appen for enhetsbetaling.'); }

import { paymentApi } from './api';

let loading: Promise<void> | undefined;
export async function approveReservation(detail: { client_secret: string; payment_method_id: string }): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!(window as any).Stripe) {
    loading ||= new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Kunne ikke åpne sikker kortgodkjenning.'));
      document.head.appendChild(script);
    });
    await loading;
  }
  const config = await paymentApi.nativeConfig();
  if (!config.publishable_key) throw new Error('Kortgodkjenning er midlertidig utilgjengelig.');
  const stripe = (window as any).Stripe(config.publishable_key);
  const result = await stripe.confirmCardPayment(detail.client_secret, { payment_method: detail.payment_method_id });
  if (result.error) throw new Error(result.error.message);
  return result.paymentIntent?.status === 'requires_capture';
}

import React, { useEffect, useRef, useState } from 'react';
import { loadStripe, type StripeExpressCheckoutElement } from '@stripe/stripe-js';
import { paymentApi } from '@/src/lib/api';
import { useAuth } from '@/src/context/AuthContext';
import { apiError } from '@/src/lib/format';

/** Stripe-hosted wallet UI: SNAR never reads PAN, CVC or wallet payloads. */
export function WebWalletSetup({ disabled, onSaved }: { disabled?: boolean; onSaved: (card: any) => void | Promise<void> }) {
  const { user } = useAuth();
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onSaved); callback.current = onSaved;
  const disabledRef = useRef(disabled); disabledRef.current = disabled;
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let disposed = false, inFlight = false;
    let element: StripeExpressCheckoutElement | undefined;
    const start = async () => {
      const config = await paymentApi.nativeConfig();
      if (disposed || !container.current || !config.enabled || !config.web_wallets_enabled) return;
      if (window.location.protocol !== 'https:') throw new Error('Wallet-betaling krever HTTPS.');
      const stripe = await loadStripe(config.publishable_key);
      if (disposed || !container.current) return;
      if (!stripe) throw new Error('Kunne ikke starte sikker Stripe-betaling.');
      const elements = stripe.elements({ mode: 'setup', currency: 'nok' });
      element = elements.create('expressCheckout', {
        buttonHeight: 48, layout: { maxColumns: 1, maxRows: 2 },
        paymentMethods: { applePay: 'auto', googlePay: config.google_pay_enabled ? 'auto' : 'never', link: 'never', paypal: 'never', amazonPay: 'never', klarna: 'never' },
      });
      element.on('ready', ({ availablePaymentMethods }) => {
        if (!disposed) setMessage(availablePaymentMethods?.applePay || availablePaymentMethods?.googlePay ? '' : 'Apple Pay eller Google Pay er ikke tilgjengelig i denne nettleseren. Du kan legge til kort.');
      });
      element.on('loaderror', () => { if (!disposed) setMessage('Kunne ikke laste lommeboken. Prøv igjen eller legg til kort.'); });
      element.on('confirm', async event => {
        if (inFlight || disabledRef.current || disposed) { event.paymentFailed({ reason: 'fail' }); return; }
        inFlight = true; setBusy(true); setMessage('');
        try {
          const wallet = event.expressPaymentType;
          if (wallet !== 'apple_pay' && wallet !== 'google_pay') throw new Error('Velg Apple Pay eller Google Pay.');
          const submitted = await elements.submit();
          if (submitted.error) throw new Error(submitted.error.message);
          const setup = await paymentApi.nativeSetup(wallet, 'web');
          if (!setup.client_secret || !setup.setup_intent_id) throw new Error('Stripe svarte uten kortverifisering.');
          const confirmed = await stripe.confirmSetup({ elements, clientSecret: setup.client_secret,
            confirmParams: { return_url: window.location.origin + '/payment-methods' }, redirect: 'if_required' });
          if (confirmed.error) throw new Error(confirmed.error.message);
          const status = await paymentApi.nativeSetupStatus(setup.setup_intent_id);
          if (!status.ready || !status.verified || status.card?.wallet !== wallet) throw new Error('Stripe har ikke bekreftet den valgte lommeboken. Oppdater betalingsmåter.');
          if (!disposed) { await callback.current(status.card); if (!disposed) setMessage('Lommeboken er verifisert og valgt for neste tur.'); }
        } catch (error) {
          event.paymentFailed({ reason: 'fail' });
          if (!disposed) setMessage(apiError(error));
        } finally { inFlight = false; if (!disposed) setBusy(false); }
      });
      element.mount(container.current);
      setEnabled(true);
    };
    void start().catch(error => { if (!disposed) setMessage(apiError(error)); });
    return () => { disposed = true; element?.destroy(); };
  }, [user?.id]);
  return <div data-testid="web-wallet-setup" style={{ marginTop: 16 }}>
    {enabled ? <p style={{ fontSize: 12 }}>Ved å lagre betalingsmåten godkjenner du at SNAR reserverer avtalt beløp når du bestiller, og trekker det endelige turbeløpet etter turen. Ingen betaling trekkes når du lagrer.</p> : null}
    <div ref={container} style={{ pointerEvents: busy || disabled ? 'none' : 'auto', opacity: busy ? .6 : 1 }} />
    {busy ? <p role="status">Bekrefter lommeboken med Stripe…</p> : null}
    {message ? <p role="status" style={{ fontSize: 12 }}>{message}</p> : null}
  </div>;
}

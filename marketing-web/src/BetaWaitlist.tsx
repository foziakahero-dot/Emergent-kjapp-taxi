import { FormEvent, useEffect, useRef, useState } from 'react';

type BetaRole = 'passenger' | 'driver' | 'fleet_owner';

type Props = {
  open: boolean;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  city: string;
  role: BetaRole;
  website: string;
};

const initialForm: FormState = {
  name: '',
  email: '',
  phone: '',
  city: 'Oslo',
  role: 'passenger',
  website: '',
};

function validate(form: FormState) {
  if (form.name.trim().length < 2) return 'Skriv inn navnet ditt.';
  if (!/^[+\d ()-]{8,30}$/.test(form.phone.trim())) return 'Skriv inn et gyldig telefonnummer.';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Skriv inn en gyldig e-postadresse.';
  if (form.city.trim().length < 2) return 'Skriv inn byen din.';
  return '';
}

export default function BetaWaitlist({ open, onClose, returnFocusTo }: Props) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    setStatus('idle');
    setMessage('');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => nameRef.current?.focus(), 20);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]',
        ),
      ).filter((node) => node.tabIndex !== -1);

      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      window.setTimeout(() => returnFocusTo?.focus(), 0);
    };
  }, [open, onClose, returnFocusTo]);

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;

    const validationError = validate(form);
    if (validationError) {
      setStatus('error');
      setMessage(validationError);
      return;
    }

    setStatus('submitting');
    setMessage('');

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          city: form.city.trim(),
          role: form.role,
          website: form.website,
        }),
      });

      const data = await response.json().catch(() => ({} as { error?: string }));
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Kunne ikke sende forespørselen akkurat nå. Prøv igjen.');
      }

      setStatus('success');
      setMessage('Takk! Interessen din er registrert. Vi kontakter deg når betaen åpner for din gruppe.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error && error.message
        ? error.message
        : 'Kunne ikke sende forespørselen akkurat nå. Prøv igjen.');
    }
  }

  return (
    <div
      className="mk-beta-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="mk-beta-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="beta-title"
        aria-describedby="beta-description"
        ref={dialogRef}
      >
        <button type="button" className="mk-beta-close" onClick={onClose} aria-label="Lukk beta-påmelding">×</button>
        <span className="mk-beta-kicker">SNAR BETA</span>
        <h2 id="beta-title">Få tilgang til beta</h2>
        <p id="beta-description">Meld interesse som passasjer, sjåfør eller løyvehaver. Vi bruker opplysningene kun for å følge opp beta-tilgang.</p>

        {status === 'success' ? (
          <div className="mk-beta-success" role="status">
            <strong>Registrert ✓</strong>
            <p>{message}</p>
            <button type="button" className="mk-pill mk-pill-primary" onClick={onClose}>Ferdig</button>
          </div>
        ) : (
          <form className="mk-beta-form" onSubmit={submit} noValidate>
            <label>
              <span>Navn</span>
              <input
                ref={nameRef}
                autoComplete="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                maxLength={100}
                required
              />
            </label>
            <label>
              <span>Telefon</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                maxLength={30}
                required
              />
            </label>
            <label>
              <span>E-post <small>valgfritt</small></span>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                maxLength={254}
              />
            </label>
            <label>
              <span>By</span>
              <input
                autoComplete="address-level2"
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
                maxLength={100}
                required
              />
            </label>
            <label>
              <span>Jeg er</span>
              <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as BetaRole })}>
                <option value="passenger">Passasjer</option>
                <option value="driver">Sjåfør</option>
                <option value="fleet_owner">Løyvehaver / flåte</option>
              </select>
            </label>
            <label className="mk-beta-honeypot" aria-hidden="true">
              <span>Nettside</span>
              <input
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
              />
            </label>

            {message && (
              <p className={status === 'error' ? 'mk-beta-error' : 'mk-beta-message'} role="alert" aria-live="polite">
                {message}
              </p>
            )}

            <button className="mk-pill mk-pill-primary mk-beta-submit" type="submit" disabled={status === 'submitting'}>
              {status === 'submitting' ? 'Sender…' : 'Meld interesse'}
            </button>
            <p className="mk-beta-privacy">Ved å sende inn ber du SNAR kontakte deg om beta. Spørsmål om personvern: <a href="mailto:privacy@kjappapp.no">privacy@kjappapp.no</a>.</p>
          </form>
        )}
      </div>
    </div>
  );
}

import { NextRequest, NextResponse } from 'next/server';

type WaitlistPayload = {
  name?: string;
  phone?: string;
  email?: string;
  role?: string;
  city?: string;
};

const allowedRoles = new Set(['Passasjer', 'Sjåfør', 'Løyvehaver']);

export async function POST(request: NextRequest) {
  let body: WaitlistPayload;

  try {
    body = (await request.json()) as WaitlistPayload;
  } catch {
    return NextResponse.json({ ok: false, message: 'Ugyldig forespørsel.' }, { status: 400 });
  }

  const name = body.name?.trim();
  const phone = body.phone?.trim();
  const email = body.email?.trim() || '';
  const role = body.role?.trim();
  const city = body.city?.trim();

  if (!name || !phone || !city || !role || !allowedRoles.has(role)) {
    return NextResponse.json(
      { ok: false, message: 'Fyll ut navn, telefon, rolle og by.' },
      { status: 422 },
    );
  }

  const webhook = process.env.KJAPP_WAITLIST_WEBHOOK_URL?.trim();
  const position = 1200 + Math.floor(Math.random() * 1601);

  if (!webhook && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json(
      { ok: false, message: 'Ventelisten åpnes snart. Prøv igjen om litt.' },
      { status: 503 },
    );
  }

  if (webhook) {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, phone, email, role, city, position, source: 'kjappapp.no' }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, message: 'Ventelisten kunne ikke lagres akkurat nå. Prøv igjen.' },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ ok: true, position });
}

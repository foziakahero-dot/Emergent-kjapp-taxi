import { NextResponse } from 'next/server';
const roles = new Set(['passenger','driver','fleet_owner']);
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 4096) return NextResponse.json({error:'For stor forespørsel.'},{status:413});
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') return NextResponse.json({error:'Ugyldig skjema.'},{status:400});
    const fields = body as Record<string,unknown>;
    const name = typeof fields.name === 'string' ? fields.name.trim() : '';
    const phone = typeof fields.phone === 'string' ? fields.phone.trim() : '';
    const email = typeof fields.email === 'string' ? fields.email.trim() : '';
    const city = typeof fields.city === 'string' ? fields.city.trim() : '';
    const role = fields.role;
    if (name.length < 2 || name.length > 100 || !/^[+\d ()-]{8,30}$/.test(phone) || city.length < 2 || city.length > 100 || !roles.has(String(role)) || (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))) return NextResponse.json({error:'Kontroller feltene og prøv igjen.'},{status:400});
    const endpoint = process.env.WAITLIST_WEBHOOK_URL;
    const key = process.env.WAITLIST_WEBHOOK_SECRET;
    if (!endpoint || !key) return NextResponse.json({error:'Ventelisten er ikke tilgjengelig akkurat nå. Kontakt support@kjappapp.no.'},{status:503});
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return NextResponse.json({error:'Ventelisten er ikke tilgjengelig akkurat nå.'},{status:503});
    const response = await fetch(url, { method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`}, body:JSON.stringify({name,phone,email,city,role}),cache:'no-store',signal:AbortSignal.timeout(8000) });
    if (!response.ok) return NextResponse.json({error:'Påmeldingen kunne ikke lagres. Prøv igjen senere.'},{status:502});
    return NextResponse.json({ok:true},{status:201});
  } catch { return NextResponse.json({error:'Påmeldingen kunne ikke lagres. Prøv igjen senere.'},{status:400}); }
}

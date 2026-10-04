import type { Metadata } from 'next';
import './globals.css';
import './legacy.css';
import './legacy-v2.css';
export const metadata: Metadata = { metadataBase:new URL('https://kjappapp.no'), title:'KJAPP — Norsk taxi, uten omveier | Beta', description:'KJAPP er en norsk taxi-app i beta. Skriv eller si hvor du skal, velg bil og se estimat før bestilling. Meld interesse for beta.', openGraph:{title:'KJAPP — Norsk taxi, uten omveier',description:'Meld interesse for KJAPP beta. Norsk taxi med tekst eller stemme.',type:'website',locale:'nb_NO',images:[{url:'/og-image.svg',width:1200,height:630,alt:'KJAPP — Norsk taxi, uten omveier'}]}, robots:{index:true,follow:true} };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="nb"><body>{children}</body></html>; }

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DM_Serif_Display, Inter } from 'next/font/google';
import './globals.css';

const display = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://kjappapp.no'),
  title: 'KJAPP – Norsk taxi. Uten omveier.',
  description:
    'KJAPP er en norsk taxi-app i beta. Bestill med tekst eller stemme, velg bil, se prisestimat og følg reisen live.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'nb_NO',
    url: 'https://kjappapp.no',
    siteName: 'KJAPP',
    title: 'KJAPP – Norsk taxi. Uten omveier.',
    description:
      'Bestill norsk taxi med tekst eller stemme. KJAPP er i beta og testes i Oslo.',
    images: [
      {
        url: '/assets/figma/heroMap.png',
        width: 1200,
        height: 630,
        alt: 'KJAPP taxi-app med kart og voice booking',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KJAPP – Norsk taxi. Uten omveier.',
    description: 'Norsk taxi-app i beta med voice booking og tydelig prisestimat.',
    images: ['/assets/figma/heroMap.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="nb" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}

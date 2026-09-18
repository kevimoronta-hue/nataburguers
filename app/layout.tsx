import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { BUSINESS, SITE_URL } from '@/lib/config';

const display = localFont({
  src: [
    { path: './fonts/BarlowCondensed-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/BarlowCondensed-700.woff2', weight: '700', style: 'normal' },
    { path: './fonts/BarlowCondensed-700Italic.woff2', weight: '700', style: 'italic' },
  ],
  variable: '--font-display',
  display: 'swap',
  fallback: ['Oswald', 'Arial Narrow', 'sans-serif'],
});

const ui = localFont({
  src: [{ path: './fonts/Manrope-Variable.woff2', weight: '400 800', style: 'normal' }],
  variable: '--font-ui',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

const description =
  'Hamburguesas, pechurina, club sandwich, batidas y jugos naturales en Plaza Satélite Duarte. Arma tu pedido y envíalo por WhatsApp al 809-685-9204.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${BUSINESS.name} | Hamburguesas y comida rápida en Plaza Satélite Duarte`,
  description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'es_DO',
    url: SITE_URL,
    siteName: BUSINESS.name,
    title: `${BUSINESS.name} | Hamburguesas y comida rápida en Plaza Satélite Duarte`,
    description,
    images: [
      {
        url: '/images/hamburguesa-clasica.png',
        width: 1200,
        height: 900,
        alt: 'Hamburguesa Clásica con doble queso y tocino, servida con papas fritas',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BUSINESS.name} | Comida rápida de calidad`,
    description,
    images: ['/images/hamburguesa-clasica.png'],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#080706',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-DO" className={`${display.variable} ${ui.variable}`}>
      <body className="bg-bg-base text-ink antialiased">{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Surco Health — Software para consultorios',
  description: 'Historia clínica electrónica, agenda y pacientes para consultorios médicos, dentales y psicológicos en LATAM',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'Surco Health — La HCE de tu consultorio, simple y segura',
    description: 'Historia clínica, agenda, odontograma, CIE-10 y FHIR. Cumple Habeas Data. Prueba 14 días.',
    type: 'website',
    locale: 'es_CO',
    images: [{ url: '/og.svg', width: 1200, height: 630, alt: 'Surco Health' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Surco Health',
    description: 'Software clínico para consultorios en LATAM. Prueba 14 días.',
    images: ['/og.svg'],
  },
};

export const viewport: Viewport = {
  themeColor: '#0d9488',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}

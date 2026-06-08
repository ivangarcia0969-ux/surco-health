import Link from 'next/link';

export const metadata = {
  title: 'Precios — Surco Health',
  description: 'Planes y precios de Surco Health para consultorios médicos, dentales y psicológicos.',
};

// NOTA: ajusta estos valores a tu estrategia comercial. Precios en COP/mes.
// Para venta concierge, estos son referencia; puedes negociar por cliente.
const PLANS = [
  {
    tier: 'FREE',
    name: 'Free',
    price: '$0',
    period: 'para siempre',
    tagline: 'Para probar la plataforma',
    cta: 'Empezar gratis',
    highlight: false,
    features: [
      '1 profesional',
      '30 citas / mes',
      'Historia clínica electrónica',
      'Agenda básica',
      'CIE-10 + odontograma',
      'Cumplimiento Habeas Data',
    ],
  },
  {
    tier: 'PRO',
    name: 'Pro',
    price: '$89.000',
    period: 'COP / mes',
    tagline: 'Para consultorios independientes',
    cta: 'Empezar 14 días gratis',
    highlight: false,
    features: [
      'Hasta 5 profesionales',
      'Citas ilimitadas',
      'Todo lo de Free, más:',
      'Notas SOAP cifradas (psicología)',
      'Tests psicométricos (PHQ-9, GAD-7, BDI-II)',
      'Plan de tratamiento dental',
      'Facturación electrónica',
      'Teleconsulta',
    ],
  },
  {
    tier: 'CLINICA',
    name: 'Clínica',
    price: '$189.000',
    period: 'COP / mes',
    tagline: 'Para clínicas con varias sedes',
    cta: 'Hablar con ventas',
    highlight: true,
    features: [
      'Hasta 20 profesionales',
      'Todo lo de Pro, más:',
      'Multi-sede',
      'Exportación FHIR R4',
      'Hasta 5 bots de WhatsApp',
      'Soporte prioritario',
      'Flujo ARCO (Habeas Data)',
    ],
  },
  {
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    price: 'A medida',
    period: 'contáctanos',
    tagline: 'Para redes y franquicias',
    cta: 'Hablar con ventas',
    highlight: false,
    features: [
      'Profesionales ilimitados',
      'Todo lo de Clínica, más:',
      'Hasta 50 bots de WhatsApp',
      'Dominio propio',
      'Onboarding dedicado',
      'SLA personalizado',
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="text-center">
        <Link href="/" className="text-sm text-brand-600 hover:underline">← Volver al inicio</Link>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900">Planes y precios</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-gray-600">
          Elige el plan según el tamaño de tu consultorio. Sin permanencia. Cancela cuando quieras.
          Todos los planes cumplen Habeas Data (Ley 1581) y Resolución 1995/1999.
        </p>
        <p className="mt-2 text-sm text-gray-500">Precio por profesional. Pago mensual o anual (2 meses gratis al año).</p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <div
            key={p.tier}
            className={
              'flex flex-col rounded-2xl border bg-white p-6 shadow-sm ' +
              (p.highlight ? 'border-brand-500 ring-2 ring-brand-200 relative' : 'border-gray-200')
            }
          >
            {p.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                Más popular
              </span>
            )}
            <h3 className="text-lg font-bold text-gray-900">{p.name}</h3>
            <p className="mt-1 text-sm text-gray-500">{p.tagline}</p>
            <div className="mt-4">
              <span className="text-3xl font-bold text-gray-900">{p.price}</span>
              <span className="ml-1 text-sm text-gray-500">{p.period}</span>
            </div>
            <ul className="mt-6 flex-1 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-0.5 text-brand-600">✓</span>
                  <span className={f.endsWith('más:') ? 'font-medium text-gray-700' : 'text-gray-600'}>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={p.tier === 'FREE' || p.tier === 'PRO' ? '/register' : 'https://wa.me/57XXXXXXXXXX'}
              className={
                'mt-6 rounded-lg px-4 py-2.5 text-center text-sm font-medium transition ' +
                (p.highlight
                  ? 'bg-brand-600 text-white hover:bg-brand-700'
                  : 'border border-gray-300 text-gray-800 hover:bg-gray-50')
              }
            >
              {p.cta}
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
        <p className="font-medium text-gray-800">¿Tienes dudas sobre qué plan necesitas?</p>
        <p className="mt-1">
          Escríbenos por WhatsApp y te ayudamos a elegir. También ofrecemos demo guiada y
          acompañamiento en la migración de tus datos.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-gray-500">
          <Link href="/legal/privacidad" className="hover:underline">Política de privacidad</Link>
          <span>·</span>
          <Link href="/legal/terminos" className="hover:underline">Términos y condiciones</Link>
        </div>
      </div>
    </main>
  );
}

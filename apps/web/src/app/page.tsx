import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-10 px-6 py-12 text-center">
      <div className="text-sm font-semibold uppercase tracking-widest text-brand-600">Surco Health</div>
      <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
        El software de tu <span className="text-brand-600">consultorio</span>
      </h1>
      <p className="max-w-2xl text-lg text-gray-600">
        Historia clínica electrónica, agenda y pacientes — diseñado para clínicas dentales,
        psicológicas y médicas en LATAM. Implementa los lineamientos de Habeas Data y Resolución
        1995/1999 (Colombia) y exporta a FHIR R4.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/register" className="rounded-lg bg-brand-600 px-6 py-3 text-white shadow hover:bg-brand-700">
          Empezar gratis · 14 días
        </Link>
        <Link href="/precios" className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-gray-800 hover:bg-gray-50">
          Ver planes y precios
        </Link>
        <Link href="/login" className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-gray-800 hover:bg-gray-50">
          Iniciar sesión
        </Link>
      </div>

      <div className="grid w-full grid-cols-1 gap-5 pt-10 md:grid-cols-3">
        <Feature icon="🦷" title="Odontograma digital"
                 body="Mapa dental interactivo con notación FDI. Plan de tratamiento por pieza." />
        <Feature icon="🧠" title="Notas SOAP encriptadas"
                 body="Para psicología: notas con cifrado at-rest y bloqueo de privacidad." />
        <Feature icon="💊" title="HCE con CIE-10"
                 body="Anamnesis, signos vitales y diagnóstico CIE-10 con autocompletar." />
        <Feature icon="📅" title="Agenda multi-profesional"
                 body="Cada profesional gestiona su agenda. Sin choques de horario." />
        <Feature icon="💬" title="WhatsApp Business multi-bot"
                 body="Conecta uno o varios números de Meta para enviar mensajes desde la app (disponible desde plan Pro)." />
        <Feature icon="🔒" title="Compliance Habeas Data"
                 body="Habeas Data Ley 1581/2012, HCE append-only con adendas (Res 1995/1999) y audit log de accesos." />
      </div>

      <p className="pt-8 text-xs text-gray-500">
        Diseñado en Colombia · Compliance Colombia certificado · Soporte multi-país México,
        Argentina, Chile y Perú (homologación normativa local en proceso)
      </p>
    </main>
  );
}

function Feature({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm">
      <div className="mb-2 text-2xl" aria-hidden>{icon}</div>
      <h3 className="mb-1 font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600">{body}</p>
    </div>
  );
}

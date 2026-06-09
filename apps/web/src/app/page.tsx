import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-gray-800">
      {/* ===== NAV ===== */}
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="hidden items-center gap-8 text-sm text-gray-600 md:flex">
            <a href="#especialidades" className="transition hover:text-care-600">Especialidades</a>
            <a href="#funciones" className="transition hover:text-care-600">Funciones</a>
            <a href="#seguridad" className="transition hover:text-care-600">Seguridad</a>
            <Link href="/precios" className="transition hover:text-care-600">Precios</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-medium text-gray-600 transition hover:text-care-600 sm:block">
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-care-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-care-700"
            >
              Prueba gratis
            </Link>
          </div>
        </nav>
      </header>

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden bg-gradient-to-b from-care-50 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
          <div className="text-center md:text-left">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-care-100 px-4 py-1.5 text-xs font-medium text-care-700">
              🩺 Software clínico para LATAM
            </span>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-gray-900 md:text-5xl">
              La historia clínica de tu <span className="text-care-600">consultorio</span>, simple y segura
            </h1>
            <p className="mt-5 max-w-lg text-lg text-gray-600">
              Historia clínica electrónica, agenda y pacientes para clínicas médicas, dentales y
              psicológicas. Cumple Habeas Data y Resolución 1995/1999, y exporta a FHIR R4.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row md:justify-start">
              <Link
                href="/register"
                className="rounded-full bg-care-600 px-8 py-3.5 text-center font-semibold text-white shadow-md shadow-care-600/20 transition hover:bg-care-700"
              >
                Probar 14 días gratis
              </Link>
              <Link
                href="/precios"
                className="rounded-full border border-gray-300 bg-white px-8 py-3.5 text-center font-semibold text-gray-700 transition hover:border-care-500 hover:text-care-700"
              >
                Ver planes
              </Link>
            </div>
            <p className="mt-5 text-xs text-gray-500">
              Sin tarjeta · Sin permanencia · Cifrado de datos sensibles
            </p>
          </div>

          {/* Widget de consulta (mockup) */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-care-900/5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-care-100 text-care-700">JP</div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Juan Pérez</div>
                    <div className="text-xs text-gray-500">CC 1.023.456.789 · 34 años</div>
                  </div>
                </div>
                <span className="rounded-full bg-care-50 px-2.5 py-1 text-[10px] font-medium text-care-700">Activo</span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-care-50/60 p-3">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-care-700">Próxima cita</div>
                  <div className="mt-0.5 text-sm font-medium text-gray-900">Hoy · 3:00 PM — Control general</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[['T°', '36.6'], ['FC', '72'], ['TA', '120/80']].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-gray-100 p-2 text-center">
                      <div className="text-[10px] text-gray-500">{k}</div>
                      <div className="text-sm font-semibold text-gray-900">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-gray-100 p-3">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Diagnóstico (CIE-10)</div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-gray-800">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">J00</span>
                    Rinofaringitis aguda
                  </div>
                </div>
              </div>
              <button className="mt-4 w-full rounded-xl bg-care-600 py-2.5 text-sm font-semibold text-white">
                Firmar consulta
              </button>
            </div>
            <div className="absolute -left-3 -top-3 rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-care-700 shadow-md ring-1 ring-care-100">
              🔒 Cifrado at-rest
            </div>
          </div>
        </div>
      </section>

      {/* ===== ESPECIALIDADES ===== */}
      <section id="especialidades" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 text-center">
          <span className="text-sm font-semibold text-care-600">Multi-especialidad</span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Hecho para tu tipo de consultorio
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {[
            ['🦷', 'Odontología'],
            ['🧠', 'Psicología'],
            ['🩺', 'Medicina general'],
            ['👶', 'Pediatría'],
            ['✨', 'Estética'],
          ].map(([icon, name]) => (
            <div key={name} className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm transition hover:border-care-200 hover:shadow-md">
              <span className="text-3xl">{icon}</span>
              <span className="text-sm font-medium text-gray-700">{name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FUNCIONES ===== */}
      <section id="funciones" className="bg-care-50/50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <span className="text-sm font-semibold text-care-600">Todo en una plataforma</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
              Funciones clínicas que sí necesitas
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[
              ['🦷', 'Odontograma digital', 'Mapa dental interactivo con notación FDI y plan de tratamiento por pieza.'],
              ['🧠', 'Notas SOAP cifradas', 'Para psicología: notas con cifrado at-rest y bloqueo de privacidad.'],
              ['💊', 'HCE con CIE-10', 'Anamnesis, signos vitales y diagnóstico CIE-10 con autocompletar.'],
              ['📅', 'Agenda multi-profesional', 'Cada profesional gestiona su agenda, sin choques de horario.'],
              ['💬', 'Recordatorios WhatsApp', 'Conecta uno o varios números de Meta y reduce inasistencias (plan Pro).'],
              ['🔄', 'Exportación FHIR R4', 'Interoperabilidad estándar: exporta la HCE de tus pacientes en FHIR.'],
            ].map(([icon, title, body]) => (
              <div key={title} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-care-100 text-xl">{icon}</div>
                <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SEGURIDAD / COMPLIANCE ===== */}
      <section id="seguridad" className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <span className="text-sm font-semibold text-care-600">Seguridad y cumplimiento</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
              Tus datos clínicos, protegidos y en regla
            </h2>
            <p className="mt-4 text-gray-600">
              Diseñado desde cero para cumplir la normativa colombiana de datos de salud.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Habeas Data — Ley 1581/2012 con flujo de consentimiento y derechos ARCO',
                'HCE append-only con adendas firmadas (Res 1995/1999)',
                'Cifrado at-rest de notas y datos sensibles (pgcrypto)',
                'Registro de auditoría inmutable de accesos a la historia clínica',
                'Retención de la HCE por 15 años (Res 839/2017)',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-care-100 text-xs text-care-700">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-care-600 to-care-700 p-8 text-white shadow-xl">
            <div className="text-5xl">🔒</div>
            <h3 className="mt-4 text-xl font-bold">Privacidad por diseño</h3>
            <p className="mt-2 text-sm text-care-50/90">
              Como proveedor somos <strong>Encargado</strong> del tratamiento; tu clínica es la
              Responsable. Firmamos contrato y anexo de datos (DPA) con cada cliente, dejando
              claras las responsabilidades legales.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/20 pt-6 text-center">
              <div><div className="text-2xl font-bold">15 años</div><div className="text-[10px] uppercase tracking-wide text-care-100/80">retención HCE</div></div>
              <div><div className="text-2xl font-bold">FHIR R4</div><div className="text-[10px] uppercase tracking-wide text-care-100/80">interoperable</div></div>
              <div><div className="text-2xl font-bold">Audit</div><div className="text-[10px] uppercase tracking-wide text-care-100/80">log inmutable</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="bg-care-50/50 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Moderniza tu consultorio hoy
          </h2>
          <p className="mt-4 text-gray-600">
            Prueba Surco Health 14 días gratis. Sin tarjeta, sin compromiso. Te acompañamos en la
            migración de tus datos.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/register" className="rounded-full bg-care-600 px-8 py-3.5 font-semibold text-white shadow-md transition hover:bg-care-700">
              Crear mi cuenta gratis
            </Link>
            <Link href="/precios" className="rounded-full border border-gray-300 bg-white px-8 py-3.5 font-semibold text-gray-700 transition hover:border-care-500">
              Ver precios
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-gray-100 bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-gray-500 sm:flex-row">
          <Logo />
          <div className="flex gap-6">
            <Link href="/precios" className="transition hover:text-care-600">Precios</Link>
            <Link href="/legal/privacidad" className="transition hover:text-care-600">Privacidad</Link>
            <Link href="/legal/terminos" className="transition hover:text-care-600">Términos</Link>
            <Link href="/login" className="transition hover:text-care-600">Ingresar</Link>
          </div>
          <span className="text-xs">Diseñado en Colombia · Compliance CO · Multi-país en homologación</span>
        </div>
      </footer>
    </main>
  );
}

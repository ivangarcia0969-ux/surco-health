import Link from 'next/link';

export const metadata = {
  title: 'Términos y condiciones — Surco Health',
  description: 'Condiciones de uso del servicio de historia clínica electrónica.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-brand-600 hover:underline">
        ← Volver al inicio
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">Términos y condiciones</h1>
      <p className="mt-2 text-sm text-gray-500">Versión v1.0 · Vigente desde mayo 2026</p>

      <div className="mt-8 space-y-6 text-gray-800">
        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">1. Aceptación</h2>
          <p>
            Al crear una cuenta o utilizar Surco Health (en adelante, &quot;la Plataforma&quot;)
            aceptas íntegramente estos términos. Si no estás de acuerdo, debes abstenerte de usar
            el servicio.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">2. Descripción del servicio</h2>
          <p>
            Surco Health provee software de historia clínica electrónica, agenda clínica, gestión
            de pacientes, odontograma digital, notas SOAP, exportación FHIR y otras herramientas
            para consultorios médicos, dentales y psicológicos. El servicio se ofrece bajo
            suscripción mensual o anual.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">3. Responsabilidades del cliente</h2>
          <ul className="list-disc pl-6">
            <li>
              Registrar la base de datos personales ante la SIC (RNBD) cuando aplique según
              normativa local.
            </li>
            <li>Obtener autorización Habeas Data de cada paciente al primer contacto.</li>
            <li>
              Cumplir con la normativa sanitaria local (Res 1995/1999 Colombia, NOM-024 México,
              Ley 26.529 Argentina, Ley 20.584 Chile, Ley 29733 Perú).
            </li>
            <li>Mantener confidenciales las credenciales de acceso de profesionales y staff.</li>
            <li>No usar el servicio para actividades ilícitas o que vulneren derechos de terceros.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">4. Datos sensibles</h2>
          <p>
            Surco Health actúa como <strong>encargado del tratamiento</strong>. La Clínica es la
            responsable. La Plataforma aplica medidas técnicas razonables (cifrado en tránsito y
            at-rest, audit log, control de acceso por rol, copias de seguridad cifradas). El
            detalle está en la{' '}
            <Link href="/legal/privacidad" className="text-brand-600 underline">
              Política de Privacidad
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">5. Disponibilidad</h2>
          <p>
            Hacemos esfuerzos razonables para mantener disponibilidad 99.5% mensual. No
            garantizamos servicio ininterrumpido. En caso de incidente notificamos al cliente y a
            las autoridades cuando la ley lo exija.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">6. Conservación y exportación</h2>
          <p>
            La historia clínica se conserva 15 años desde la última atención (Res 839/2017). Si
            cancelas la suscripción, entregamos una exportación completa en formato FHIR R4 antes
            del cierre. Después del período de gracia (90 días), procedemos a la eliminación
            segura conforme a los plazos legales.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">7. Limitación de responsabilidad</h2>
          <p>
            En la medida permitida por la ley aplicable, Surco Health no es responsable por daños
            indirectos, lucro cesante o pérdida de datos derivados del uso de la Plataforma. La
            responsabilidad agregada queda limitada al monto pagado por el cliente en los 12
            meses anteriores al evento que origina el reclamo. Surco Health no es responsable de
            decisiones clínicas, diagnósticos o prescripciones; el profesional es siempre el
            responsable del acto médico.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">8. Cancelación</h2>
          <p>
            Puedes cancelar tu suscripción en cualquier momento. La cancelación toma efecto al
            final del período facturado. Te garantizamos un período de gracia de 90 días para
            exportar tus datos.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">9. Ley aplicable</h2>
          <p>
            Estos términos se rigen por las leyes de la República de Colombia. Cualquier
            controversia se someterá a la jurisdicción ordinaria del domicilio del prestador.
          </p>
        </section>

        <p className="border-t border-gray-200 pt-4 text-xs text-gray-500">
          Surco Health se reserva el derecho de modificar estos términos. Te notificaremos cambios
          materiales con al menos 30 días de anticipación.
        </p>
      </div>
    </main>
  );
}

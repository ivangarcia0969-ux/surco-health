import Link from 'next/link';

export const metadata = {
  title: 'Política de Privacidad — Habeas Data Ley 1581/2012',
  description:
    'Política de tratamiento de datos personales y datos sensibles de salud conforme a la Ley 1581/2012 de Colombia y Resolución 1995/1999.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-brand-600 hover:underline">
        ← Volver al inicio
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">Política de Privacidad</h1>
      <p className="mt-2 text-sm text-gray-500">
        Versión v1.0 · Vigente desde mayo 2026
      </p>

      <div className="mt-8 space-y-6 text-gray-800">
        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">1. Responsable del tratamiento</h2>
          <p>
            Surco Health (en adelante, &quot;la Plataforma&quot;) opera el software de historia
            clínica electrónica, agenda y gestión clínica para consultorios médicos, dentales y
            psicológicos (en adelante, &quot;la Clínica&quot;). La Clínica es el responsable del
            tratamiento de los datos personales y sensibles de salud de sus pacientes. Surco
            Health actúa como encargado del tratamiento conforme a:
          </p>
          <ul className="mt-2 list-disc pl-6">
            <li>Ley Estatutaria 1581 de 2012 — Habeas Data</li>
            <li>Decreto Reglamentario 1377 de 2013</li>
            <li>Resolución 1995 de 1999 — Manejo de Historia Clínica</li>
            <li>Resolución 839 de 2017 — Retención de HCE 15 años</li>
            <li>Resolución 866 de 2021 — Interoperabilidad FHIR</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">2. Datos recolectados</h2>
          <ul className="list-disc pl-6">
            <li>Identificación: nombre, documento, fecha de nacimiento, sexo.</li>
            <li>Contacto: teléfono, correo, dirección, contacto de emergencia.</li>
            <li>
              <strong>Datos sensibles de salud</strong>: historia clínica, diagnósticos, exámenes,
              prescripciones, evolución, signos vitales, notas psicológicas SOAP, odontograma.
            </li>
            <li>Datos administrativos: aseguradora (EPS), plan de salud, facturación.</li>
            <li>Metadatos técnicos: IP, navegador, fecha y hora de acceso a registros.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">3. Finalidades</h2>
          <ul className="list-disc pl-6">
            <li>Prestación del servicio de salud y registro de la historia clínica.</li>
            <li>Gestión de agenda, recordatorios de cita y comunicación clínica.</li>
            <li>Facturación, glosas y recobro a aseguradoras.</li>
            <li>Cumplimiento de obligaciones legales (HCE 15 años, reportes SIVIGILA, etc.).</li>
            <li>Interoperabilidad FHIR con otros prestadores de salud, previa autorización.</li>
            <li>Estadística agregada y anonimizada para mejora del servicio.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">4. Datos sensibles de salud</h2>
          <p>
            Los datos clínicos son <strong>datos sensibles</strong> (Art. 5 Ley 1581) y requieren
            autorización <strong>previa, expresa e informada</strong>. La Clínica obtendrá esta
            autorización al primer contacto con el paciente. El paciente puede negarse a
            entregar datos sensibles, pero esto puede impedir la prestación del servicio.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">5. Medidas de seguridad</h2>
          <ul className="list-disc pl-6">
            <li>Cifrado en tránsito (HTTPS/TLS 1.2+).</li>
            <li>
              Cifrado <strong>at-rest</strong> con pgcrypto sobre campos sensibles: notas SOAP
              psicológicas, antecedentes médicos, motivos de consulta psicológica.
            </li>
            <li>
              Audit log inmutable: cada acceso a HCE queda registrado con usuario, IP, timestamp
              y registro consultado (Res 1995/1999).
            </li>
            <li>
              HCE append-only: una vez firmada digitalmente (SHA-256), no se puede editar; solo
              se crean adendas con `previousRecordId` (Res 1995/1999).
            </li>
            <li>Control de acceso por rol: Recepción no ve HCE clínica.</li>
            <li>Copias de seguridad cifradas, retenidas por 15 años.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">6. Derechos del titular (ARCO)</h2>
          <p>El paciente, como titular de sus datos, tiene derecho a:</p>
          <ul className="list-disc pl-6">
            <li>
              <strong>Acceso</strong>: conocer y obtener copia de su historia clínica (Bundle FHIR
              o PDF).
            </li>
            <li>
              <strong>Rectificación</strong>: solicitar corrección de datos inexactos. (En HCE, la
              corrección se hace por adenda — no se borra el registro original.)
            </li>
            <li>
              <strong>Cancelación / supresión</strong>: solicitar eliminación cuando no haya
              obligación legal de conservar los datos. <em>Excepción</em>: la HCE debe conservarse
              15 años desde la última atención (Res 839/2017).
            </li>
            <li>
              <strong>Oposición</strong>: revocar la autorización para usos no obligatorios
              (estudios, marketing, interoperabilidad opcional).
            </li>
            <li>
              <strong>Portabilidad</strong>: recibir tus datos en formato estándar FHIR R4.
            </li>
          </ul>
          <p className="mt-2">
            Para ejercer estos derechos, contacta a la Clínica donde recibiste atención. Si la
            respuesta no es satisfactoria, puedes radicar reclamación ante la{' '}
            <strong>Superintendencia de Industria y Comercio (SIC)</strong>.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">7. Conservación</h2>
          <p>
            La <strong>historia clínica se conserva durante 15 años</strong> desde la última
            atención, conforme a la Resolución 839 de 2017. Otros datos administrativos se
            conservan según el plazo legal aplicable (ej. facturación: 5 años — Art. 28 Decreto
            624/1989, Estatuto Tributario).
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">8. Compartición</h2>
          <p>
            No vendemos ni cedemos datos a terceros. Compartimos solo con:
          </p>
          <ul className="list-disc pl-6">
            <li>Aseguradoras (EPS/prepagada) para facturación, con autorización del titular.</li>
            <li>Otros prestadores vía FHIR cuando el titular lo autoriza expresamente.</li>
            <li>Autoridades sanitarias cuando la ley lo exige (SIVIGILA, RIPS, etc.).</li>
            <li>Proveedores tecnológicos (hosting, mensajería) bajo contrato de encargo.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">9. Contacto</h2>
          <p>
            Para consultas sobre esta política puedes escribir al correo de la Clínica donde
            recibiste atención, o a Surco Health en{' '}
            <a href="mailto:soporte@surcoapp.tech" className="text-brand-600 underline">
              soporte@surcoapp.tech
            </a>
            .
          </p>
          <p className="mt-2">
            Oficial de protección de datos:{' '}
            <a href="mailto:dpo@surcoapp.tech" className="text-brand-600 underline">
              dpo@surcoapp.tech
            </a>
          </p>
        </section>

        <p className="border-t border-gray-200 pt-4 text-xs text-gray-500">
          Esta política puede actualizarse. Los cambios materiales se notificarán al titular con
          al menos 30 días de anticipación.
        </p>
      </div>
    </main>
  );
}

/**
 * Datos de DEMOSTRACIÓN para vender a consultorios odontológicos.
 *
 * Crea (o refresca) la clínica "Clínica Dental Sonrisa" con 2 odontólogos,
 * recepción, catálogo de servicios con precios en COP, 14 pacientes con
 * odontograma, planes de tratamiento, historia clínica, abonos del mes y la
 * agenda de HOY y MAÑANA.
 *
 * Idempotente: se puede correr varias veces. En cada corrida:
 *   - clínica, usuarios, servicios y pacientes se crean solo si no existen
 *   - la historia clínica, planes y abonos se crean solo la primera vez
 *   - la agenda de hoy/mañana se REGENERA (borra citas futuras sin atender
 *     y sin historia clínica, y crea las nuevas) → correrlo la mañana de la demo
 *
 * Uso:
 *   pnpm --filter @surco/db db:seed:demo
 *   (en el VPS) docker compose ... run --rm --entrypoint sh api -c "cd /repo && pnpm --filter @surco/db db:seed:demo"
 *
 * Contraseña de todos los usuarios demo: variable DEMO_PASSWORD o "Sonrisa2026*".
 */
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

const prisma = new PrismaClient();
const PASSWORD = process.env.DEMO_PASSWORD || 'Sonrisa2026*';
const SLUG = 'sonrisa';
const DAY = 24 * 3600_000;

/** Fecha/hora local de Colombia (UTC−5) → Date UTC. */
function bogota(dayOffset: number, hh: number, mm = 0): Date {
  const nowLocal = new Date(Date.now() - 5 * 3600_000);
  const base = Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate());
  return new Date(base + dayOffset * DAY + (hh + 5) * 3600_000 + mm * 60_000);
}

function sha(o: unknown) {
  return createHash('sha256').update(JSON.stringify(o)).digest('hex');
}

const SERVICES = [
  { name: 'Consulta de valoración odontológica', durationMinutes: 30, price: 60000, cie: 'Z01.2' },
  { name: 'Profilaxis y detartraje (limpieza)', durationMinutes: 45, price: 120000, cie: 'K03.6' },
  { name: 'Resina dental (obturación) por superficie', durationMinutes: 45, price: 150000, cie: 'K02.1' },
  { name: 'Endodoncia unirradicular', durationMinutes: 90, price: 450000, cie: 'K04.0' },
  { name: 'Endodoncia multirradicular (molar)', durationMinutes: 120, price: 750000, cie: 'K04.0' },
  { name: 'Exodoncia simple (extracción)', durationMinutes: 45, price: 120000, cie: 'K08.1' },
  { name: 'Exodoncia de cordal (muela del juicio)', durationMinutes: 60, price: 350000, cie: 'K01.1' },
  { name: 'Corona en porcelana', durationMinutes: 60, price: 1200000, cie: 'K08.1' },
  { name: 'Implante dental (incluye corona)', durationMinutes: 90, price: 3500000, cie: 'K08.1' },
  { name: 'Blanqueamiento dental en consultorio', durationMinutes: 60, price: 600000, cie: null },
  { name: 'Control de ortodoncia', durationMinutes: 30, price: 150000, cie: 'K07.3' },
  { name: 'Sellantes de fosas y fisuras (por diente)', durationMinutes: 20, price: 50000, cie: 'Z29.8' },
  { name: 'Radiografía periapical', durationMinutes: 10, price: 25000, cie: null },
  { name: 'Radiografía panorámica', durationMinutes: 15, price: 70000, cie: null },
];

type Proc = {
  tooth: string; work: string; surfaces?: string[]; treatment: string; cost: number;
  status?: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
};
type Chart = Record<string, Record<string, string>>;

interface DemoPatient {
  doc: string; name: string; birth: string; gender: 'MALE' | 'FEMALE'; phone: string; email?: string;
  insurer?: string; blood?: Prisma.PatientCreateInput['bloodType']; allergies?: string; city?: string;
  chart?: Chart;
  consult?: { complaint: string; illness: string; exam: string; plan: string; dx: { code: string; desc: string }[]; daysAgo: number };
  procs?: Proc[];
  payments?: { amount: number; method: 'CASH' | 'CARD' | 'TRANSFER'; daysAgo: number; concept?: string }[];
}

const PATIENTS: DemoPatient[] = [
  {
    doc: '1116254871', name: 'María Fernanda Ospina Gil', birth: '1988-04-12', gender: 'FEMALE', phone: '3104567812',
    email: 'mafe.ospina@correo.co', insurer: 'EPS Sura', blood: 'O_POS', allergies: 'Penicilina', city: 'Tuluá',
    chart: { '16': { occlusal: 'CARIES', mesial: 'CARIES' }, '26': { whole: 'ROOT_CANAL' }, '36': { occlusal: 'FILLING_RESIN' }, '47': { occlusal: 'CARIES' }, '18': { whole: 'EXTRACTION_NEEDED' } },
    consult: { complaint: 'Dolor al masticar en el lado superior izquierdo', illness: 'Dolor pulsátil de 5 días de evolución en el 26, aumenta con el frío y al acostarse.', exam: 'Caries profunda en 26 con compromiso pulpar. Caries oclusomesial en 16 y oclusal en 47. Cordal 18 semierupcionado.', plan: 'Endodoncia 26 + corona. Resinas 16 y 47. Exodoncia 18. Control en 8 días.', dx: [{ code: 'K04.0', desc: 'Pulpitis' }, { code: 'K02.1', desc: 'Caries de la dentina' }], daysAgo: 12 },
    procs: [
      { tooth: '26', work: 'ROOT_CANAL', treatment: 'Endodoncia multirradicular (molar)', cost: 750000, status: 'COMPLETED' },
      { tooth: '26', work: 'CROWN', treatment: 'Corona en porcelana', cost: 1200000, status: 'PLANNED' },
      { tooth: '16', work: 'FILLING_RESIN', surfaces: ['OCCLUSAL', 'MESIAL'], treatment: 'Resina dental (obturación) por superficie', cost: 300000, status: 'IN_PROGRESS' },
      { tooth: '47', work: 'FILLING_RESIN', surfaces: ['OCCLUSAL'], treatment: 'Resina dental (obturación) por superficie', cost: 150000, status: 'PLANNED' },
      { tooth: '18', work: 'EXTRACTED', treatment: 'Exodoncia de cordal (muela del juicio)', cost: 350000, status: 'PLANNED' },
    ],
    payments: [{ amount: 750000, method: 'CARD', daysAgo: 12, concept: 'Pago endodoncia diente 26' }, { amount: 400000, method: 'TRANSFER', daysAgo: 3 }],
  },
  {
    doc: '94387215', name: 'Carlos Andrés Restrepo Lozano', birth: '1975-09-30', gender: 'MALE', phone: '3158890123',
    insurer: 'Nueva EPS', blood: 'A_POS', city: 'Tuluá',
    chart: { '46': { whole: 'ABSENT' }, '36': { whole: 'IMPLANT' }, '11': { whole: 'CROWN' }, '21': { whole: 'CROWN' } },
    consult: { complaint: 'Quiere reponer el diente que le falta abajo a la derecha', illness: 'Pérdida del 46 hace 2 años por caries. Implante 36 colocado en 2023, asintomático.', exam: 'Edentulismo parcial en 46, reborde adecuado. Coronas 11 y 21 en buen estado.', plan: 'Radiografía panorámica. Implante dental 46 con corona.', dx: [{ code: 'K08.1', desc: 'Pérdida de dientes debida a accidente, extracción o enfermedad periodontal local' }], daysAgo: 20 },
    procs: [
      { tooth: '46', work: 'IMPLANT', treatment: 'Implante dental (incluye corona)', cost: 3500000, status: 'IN_PROGRESS' },
      { tooth: 'GEN', work: 'HEALTHY', treatment: 'Radiografía panorámica', cost: 70000, status: 'COMPLETED' },
    ],
    payments: [{ amount: 1500000, method: 'TRANSFER', daysAgo: 20, concept: 'Primer abono implante 46' }, { amount: 1000000, method: 'CARD', daysAgo: 6, concept: 'Segundo abono implante 46' }],
  },
  {
    doc: '1116289934', name: 'Valentina Cardona Muñoz', birth: '2001-01-22', gender: 'FEMALE', phone: '3007788991',
    email: 'vale.cardona@correo.co', insurer: 'Sanitas', blood: 'B_POS', city: 'Buga',
    chart: { '14': { whole: 'EXTRACTED' }, '24': { whole: 'EXTRACTED' }, '34': { whole: 'EXTRACTED' }, '44': { whole: 'EXTRACTED' } },
    consult: { complaint: 'Control mensual de ortodoncia', illness: 'Paciente en tratamiento de ortodoncia desde hace 14 meses, extracciones de premolares por apiñamiento.', exam: 'Brackets en buen estado, higiene regular. Se cambia arco a 0.018.', plan: 'Control de ortodoncia mensual. Refuerzo de higiene.', dx: [{ code: 'K07.3', desc: 'Anomalías de la posición del diente' }], daysAgo: 28 },
    procs: [
      { tooth: 'GEN', work: 'HEALTHY', treatment: 'Control de ortodoncia', cost: 150000, status: 'COMPLETED' },
      { tooth: 'GEN', work: 'HEALTHY', treatment: 'Control de ortodoncia', cost: 150000, status: 'PLANNED' },
    ],
    payments: [{ amount: 150000, method: 'CASH', daysAgo: 28, concept: 'Control de ortodoncia' }],
  },
  {
    doc: '1115078452', name: 'Juan Sebastián Hoyos Arango', birth: '1995-07-08', gender: 'MALE', phone: '3126654320',
    insurer: 'EPS Sura', blood: 'O_NEG', city: 'Tuluá',
    chart: { '38': { whole: 'EXTRACTION_NEEDED' }, '48': { whole: 'EXTRACTION_NEEDED' }, '37': { occlusal: 'CARIES' } },
    consult: { complaint: 'Dolor en la muela del juicio inferior', illness: 'Pericoronitis recurrente en 38 y 48.', exam: 'Cordales 38 y 48 impactados parcialmente. Caries oclusal en 37.', plan: 'Exodoncia quirúrgica 38 y 48 en dos citas. Resina 37.', dx: [{ code: 'K01.1', desc: 'Dientes impactados' }, { code: 'K02.1', desc: 'Caries de la dentina' }], daysAgo: 5 },
    procs: [
      { tooth: '38', work: 'EXTRACTED', treatment: 'Exodoncia de cordal (muela del juicio)', cost: 350000, status: 'PLANNED' },
      { tooth: '48', work: 'EXTRACTED', treatment: 'Exodoncia de cordal (muela del juicio)', cost: 350000, status: 'PLANNED' },
      { tooth: '37', work: 'FILLING_RESIN', surfaces: ['OCCLUSAL'], treatment: 'Resina dental (obturación) por superficie', cost: 150000, status: 'PLANNED' },
    ],
    payments: [{ amount: 60000, method: 'CASH', daysAgo: 5, concept: 'Consulta de valoración' }],
  },
  {
    doc: '31198765', name: 'Luz Marina Quintero de Vélez', birth: '1962-11-03', gender: 'FEMALE', phone: '3165512233',
    insurer: 'Coomeva', blood: 'A_NEG', allergies: 'Ibuprofeno (AINEs)', city: 'Tuluá',
    chart: { '15': { whole: 'BRIDGE' }, '16': { whole: 'ABSENT' }, '17': { whole: 'BRIDGE' }, '31': { whole: 'MOBILITY' }, '41': { whole: 'MOBILITY' }, '25': { occlusal: 'FILLING_AMALGAM', distal: 'FILLING_AMALGAM' } },
    consult: { complaint: 'Sangrado de encías y movilidad en dientes de abajo', illness: 'Hipertensa controlada. Sangrado al cepillado hace 3 meses.', exam: 'Gingivitis generalizada, movilidad grado I en 31 y 41. Puente 15-17 en buen estado.', plan: 'Profilaxis y detartraje. Control periodontal en 1 mes.', dx: [{ code: 'K05.1', desc: 'Gingivitis crónica' }], daysAgo: 9 },
    procs: [{ tooth: 'GEN', work: 'HEALTHY', treatment: 'Profilaxis y detartraje (limpieza)', cost: 120000, status: 'COMPLETED' }],
    payments: [{ amount: 120000, method: 'CASH', daysAgo: 9, concept: 'Profilaxis y detartraje' }],
  },
  {
    doc: '1116301245', name: 'Santiago Morales Bermúdez', birth: '2012-05-17', gender: 'MALE', phone: '3187766554',
    insurer: 'Nueva EPS', blood: 'O_POS', city: 'Tuluá',
    chart: { '16': { occlusal: 'SEALANT' }, '26': { occlusal: 'SEALANT' }, '36': { occlusal: 'CARIES' }, '46': { occlusal: 'SEALANT' } },
    procs: [
      { tooth: '16', work: 'SEALANT', surfaces: ['OCCLUSAL'], treatment: 'Sellantes de fosas y fisuras (por diente)', cost: 50000, status: 'COMPLETED' },
      { tooth: '26', work: 'SEALANT', surfaces: ['OCCLUSAL'], treatment: 'Sellantes de fosas y fisuras (por diente)', cost: 50000, status: 'COMPLETED' },
      { tooth: '46', work: 'SEALANT', surfaces: ['OCCLUSAL'], treatment: 'Sellantes de fosas y fisuras (por diente)', cost: 50000, status: 'COMPLETED' },
      { tooth: '36', work: 'FILLING_RESIN', surfaces: ['OCCLUSAL'], treatment: 'Resina dental (obturación) por superficie', cost: 150000, status: 'PLANNED' },
    ],
    payments: [{ amount: 150000, method: 'CASH', daysAgo: 15, concept: 'Sellantes 16, 26 y 46' }],
  },
  {
    doc: '1144087321', name: 'Daniela Rivera Castaño', birth: '1992-02-28', gender: 'FEMALE', phone: '3014432198',
    email: 'dani.rivera@correo.co', insurer: 'Sanitas', blood: 'AB_POS', city: 'Cali',
    procs: [{ tooth: 'GEN', work: 'HEALTHY', treatment: 'Blanqueamiento dental en consultorio', cost: 600000, status: 'PLANNED' }],
    payments: [{ amount: 300000, method: 'TRANSFER', daysAgo: 1, concept: 'Abono blanqueamiento' }],
  },
  {
    doc: '16358741', name: 'Jorge Eliécer Patiño Rendón', birth: '1968-08-14', gender: 'MALE', phone: '3113345566',
    insurer: 'EPS Sura', blood: 'B_NEG', city: 'Andalucía',
    chart: { '21': { whole: 'FRACTURE' }, '22': { mesial: 'CARIES' } },
    procs: [
      { tooth: '21', work: 'ROOT_CANAL', treatment: 'Endodoncia unirradicular', cost: 450000, status: 'PLANNED' },
      { tooth: '21', work: 'CROWN', treatment: 'Corona en porcelana', cost: 1200000, status: 'PLANNED' },
      { tooth: '22', work: 'FILLING_RESIN', surfaces: ['MESIAL'], treatment: 'Resina dental (obturación) por superficie', cost: 150000, status: 'PLANNED' },
    ],
  },
  { doc: '1116276543', name: 'Camila Andrea Zapata Ríos', birth: '1998-12-09', gender: 'FEMALE', phone: '3205567788', insurer: 'Nueva EPS', city: 'Tuluá' },
  { doc: '1116198732', name: 'Andrés Felipe Gómez Salazar', birth: '1985-03-25', gender: 'MALE', phone: '3172234455', insurer: 'Coomeva', blood: 'O_POS', city: 'Tuluá' },
  { doc: '29876543', name: 'Rosa Elena Marín Toro', birth: '1957-06-19', gender: 'FEMALE', phone: '3128876655', insurer: 'Nueva EPS', allergies: 'Látex', city: 'San Pedro' },
  { doc: '1116312876', name: 'Mateo Alejandro Vargas Londoño', birth: '2015-10-02', gender: 'MALE', phone: '3159981122', insurer: 'EPS Sura', city: 'Tuluá' },
  { doc: '1112765430', name: 'Paula Andrea Henao Duque', birth: '1990-09-11', gender: 'FEMALE', phone: '3006671234', insurer: 'Sanitas', city: 'Buga' },
  { doc: '6498321', name: 'Hernán Darío Castillo Mejía', birth: '1971-01-30', gender: 'MALE', phone: '3141239876', insurer: 'EPS Sura', city: 'Tuluá' },
];

async function main() {
  console.log('🦷 Datos demo odontología — Clínica Dental Sonrisa\n');

  const plan = await prisma.plan.findUnique({ where: { tier: 'CLINICA' } });
  if (!plan) throw new Error('No existen los planes. Corre primero: pnpm --filter @surco/db db:seed');

  // ============ CLÍNICA ============
  const tenant = await prisma.tenant.upsert({
    where: { slug: SLUG },
    update: { planId: plan.id, planExpiresAt: new Date(Date.now() + 365 * DAY), isActive: true, trialEndsAt: null },
    create: {
      legalName: 'Clínica Dental Sonrisa S.A.S.',
      tradeName: 'Clínica Dental Sonrisa',
      slug: SLUG,
      taxId: '901.456.789-1',
      taxIdType: 'NIT',
      country: 'CO',
      timezone: 'America/Bogota',
      currency: 'COP',
      primarySpecialty: 'DENTAL',
      primaryColor: '#0d9488',
      planId: plan.id,
      planExpiresAt: new Date(Date.now() + 365 * DAY),
      privacyPolicyAcceptedAt: new Date(),
    },
  });
  console.log(`  ✓ Clínica: ${tenant.tradeName} (${tenant.slug})`);

  let site = await prisma.site.findFirst({ where: { tenantId: tenant.id, isMain: true } });
  if (!site) {
    site = await prisma.site.create({
      data: {
        tenantId: tenant.id, name: 'Sede Principal', isMain: true,
        address: 'Calle 27 # 26-45, Tuluá, Valle del Cauca',
        phone: '(602) 224 5678', email: 'citas@sonrisadental.co',
        rooms: { create: [{ name: 'Consultorio 1' }, { name: 'Consultorio 2' }] },
      },
    });
  }
  const rooms = await prisma.room.findMany({ where: { siteId: site.id }, orderBy: { name: 'asc' } });

  // ============ USUARIOS ============
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const mkUser = (email: string, data: Omit<Prisma.UserUncheckedCreateInput, 'email' | 'passwordHash' | 'tenantId'>) =>
    prisma.user.upsert({
      where: { email },
      update: { passwordHash, isActive: true },
      create: { email, passwordHash, tenantId: tenant.id, ...data },
    });

  await mkUser('admin@sonrisa.demo', { fullName: 'Carolina Méndez', role: 'CLINIC_OWNER', phone: '3001112233' });
  const drLaura = await mkUser('dra.valencia@sonrisa.demo', {
    fullName: 'Dra. Laura Valencia', role: 'PROFESSIONAL', specialty: 'DENTAL',
    licenseNumber: 'RO-76-2458', licenseAuthority: 'Secretaría de Salud del Valle', phone: '3002223344',
  });
  const drAndres = await mkUser('dr.rios@sonrisa.demo', {
    fullName: 'Dr. Andrés Ríos', role: 'PROFESSIONAL', specialty: 'DENTAL',
    licenseNumber: 'RO-76-3190', licenseAuthority: 'Secretaría de Salud del Valle', phone: '3003334455',
  });
  const recep = await mkUser('recepcion@sonrisa.demo', { fullName: 'Paola Cardona', role: 'RECEPTIONIST', phone: '3004445566' });
  for (const pro of [drLaura, drAndres]) {
    await prisma.professionalSite.upsert({
      where: { siteId_professionalId: { siteId: site.id, professionalId: pro.id } },
      update: {},
      create: { siteId: site.id, professionalId: pro.id },
    });
  }
  console.log('  ✓ Usuarios: admin, 2 odontólogos, recepción');

  // ============ SERVICIOS ============
  const existingServices = await prisma.clinicalService.count({ where: { tenantId: tenant.id } });
  if (existingServices === 0) {
    await prisma.clinicalService.createMany({
      data: SERVICES.map((s) => ({
        tenantId: tenant.id, name: s.name, durationMinutes: s.durationMinutes,
        priceParticular: s.price, specialty: 'DENTAL' as const, defaultCieCode: s.cie ?? undefined,
      })),
    });
  }
  const services = await prisma.clinicalService.findMany({ where: { tenantId: tenant.id } });
  const svc = (name: string) => services.find((s) => s.name === name)!;
  console.log(`  ✓ ${services.length} servicios odontológicos con precios`);

  // ============ PACIENTES + HISTORIA ============
  const patientIds: string[] = [];
  let receiptSeq = await prisma.invoice.count({ where: { tenantId: tenant.id, number: { startsWith: 'RC-' } } });
  let createdHistory = 0;

  for (const [idx, p] of PATIENTS.entries()) {
    const patient = await prisma.patient.upsert({
      where: { tenantId_documentType_documentId: { tenantId: tenant.id, documentType: p.birth > '2008' ? 'TI' : 'CC', documentId: p.doc } },
      update: {},
      create: {
        tenantId: tenant.id,
        documentType: p.birth > '2008' ? 'TI' : 'CC',
        documentId: p.doc,
        fullName: p.name,
        birthdate: new Date(`${p.birth}T12:00:00Z`),
        gender: p.gender,
        phone: p.phone,
        email: p.email,
        city: p.city,
        address: p.city ? `${p.city}, Valle del Cauca` : undefined,
        bloodType: p.blood ?? 'UNKNOWN',
        allergiesSummary: p.allergies,
        insurerName: p.insurer,
        emergencyName: 'Familiar de contacto',
        emergencyPhone: '3000000000',
        privacyAcceptedAt: new Date(Date.now() - 30 * DAY),
        privacyVersion: 'v1.0',
      },
    });
    patientIds.push(patient.id);

    const hasHistory = await prisma.clinicalRecord.count({ where: { patientId: patient.id } });
    if (hasHistory > 0) continue;

    const professional = idx % 3 === 1 ? drAndres : drLaura;

    await prisma.dentalChart.upsert({
      where: { patientId: patient.id },
      update: { state: (p.chart ?? {}) as Prisma.InputJsonValue },
      create: { patientId: patient.id, state: (p.chart ?? {}) as Prisma.InputJsonValue },
    });

    if (p.consult) {
      const c = p.consult;
      const structuredData = { chiefComplaint: c.complaint, currentIllness: c.illness, physicalExam: c.exam, plan: c.plan };
      await prisma.clinicalRecord.create({
        data: {
          tenantId: tenant.id, patientId: patient.id, professionalId: professional.id,
          type: 'CONSULTATION', structuredData,
          signedAt: new Date(Date.now() - c.daysAgo * DAY), signatureHash: sha(structuredData),
          createdAt: new Date(Date.now() - c.daysAgo * DAY),
          diagnoses: { create: c.dx.map((d, i) => ({ icd10Code: d.code, description: d.desc, isPrimary: i === 0, type: 'CONFIRMED' as const })) },
        },
      });
    }

    if (p.procs?.length) {
      const structuredData = { proceduresCount: p.procs.length, teeth: p.procs.map((x) => x.tooth), notes: 'Plan de tratamiento inicial' };
      const daysAgo = p.consult?.daysAgo ?? 10;
      await prisma.clinicalRecord.create({
        data: {
          tenantId: tenant.id, patientId: patient.id, professionalId: professional.id,
          type: 'DENTAL_TREATMENT', structuredData,
          signedAt: new Date(Date.now() - daysAgo * DAY), signatureHash: sha(structuredData),
          createdAt: new Date(Date.now() - daysAgo * DAY + 3600_000),
          dentalProcedures: {
            create: p.procs.map((x) => ({
              toothNumber: x.tooth,
              surfaces: (x.surfaces ?? []) as Prisma.DentalProcedureCreateWithoutClinicalRecordInput['surfaces'],
              condition: x.work as Prisma.DentalProcedureCreateWithoutClinicalRecordInput['condition'],
              treatment: x.treatment,
              cost: x.cost,
              status: x.status ?? 'PLANNED',
              performedAt: x.status === 'COMPLETED' ? new Date(Date.now() - daysAgo * DAY) : null,
            })),
          },
        },
      });
    }

    for (const pay of p.payments ?? []) {
      receiptSeq += 1;
      const paidAt = new Date(Date.now() - pay.daysAgo * DAY - 2 * 3600_000);
      await prisma.invoice.create({
        data: {
          tenantId: tenant.id, patientId: patient.id,
          number: `RC-${String(receiptSeq).padStart(6, '0')}`,
          subtotal: pay.amount, total: pay.amount, status: 'PAID', issuedAt: paidAt, createdAt: paidAt,
          items: { create: [{ description: pay.concept ?? 'Abono a tratamiento odontológico', quantity: 1, unitPrice: pay.amount, lineTotal: pay.amount }] },
          payments: { create: [{ tenantId: tenant.id, method: pay.method, amount: pay.amount, paidAt, createdBy: recep.id }] },
        },
      });
    }

    // Una receta de ejemplo para la primera paciente
    if (idx === 0) {
      const items = [
        { drugName: 'Clindamicina 300 mg', presentation: 'Cápsulas', dose: '1 cápsula', frequency: 'Cada 8 horas', durationDays: 7, quantity: '21 cápsulas', instructions: 'Alérgica a penicilina. Tomar con abundante agua.' },
        { drugName: 'Acetaminofén 500 mg', presentation: 'Tabletas', dose: '1 tableta', frequency: 'Cada 6 horas si hay dolor', durationDays: 3, quantity: '12 tabletas' },
        { drugName: 'Clorhexidina 0,12 %', presentation: 'Enjuague bucal', dose: '15 ml', frequency: 'Cada 12 horas', durationDays: 7, quantity: '1 frasco', instructions: 'No ingerir. No comer ni beber 30 minutos después.' },
      ];
      const structured = { diagnosis: 'Pulpitis diente 26', items: items.map(({ drugName, dose, frequency, durationDays }) => ({ drugName, dose, frequency, durationDays })) };
      const rec = await prisma.clinicalRecord.create({
        data: {
          tenantId: tenant.id, patientId: patient.id, professionalId: professional.id, type: 'PRESCRIPTION',
          structuredData: structured, signedAt: new Date(Date.now() - 12 * DAY), signatureHash: sha(structured),
          createdAt: new Date(Date.now() - 12 * DAY + 7200_000),
        },
      });
      await prisma.prescription.create({
        data: {
          tenantId: tenant.id, patientId: patient.id, professionalId: professional.id, clinicalRecordId: rec.id,
          diagnosis: 'Pulpitis diente 26', notes: 'Dieta blanda las primeras 24 horas. Volver si hay inflamación o fiebre.',
          status: 'ISSUED', issuedAt: new Date(Date.now() - 12 * DAY), signedAt: new Date(Date.now() - 12 * DAY),
          signatureHash: sha(structured), createdAt: new Date(Date.now() - 12 * DAY + 7200_000),
          items: { create: items.map((it, i) => ({ ...it, ordering: i })) },
        },
      });
    }
    createdHistory++;
  }
  console.log(`  ✓ ${PATIENTS.length} pacientes (${createdHistory} con historia, odontograma, plan y abonos nuevos)`);

  // ============ AGENDA: HOY Y MAÑANA (se regenera en cada corrida) ============
  const windowStart = bogota(0, 0);
  const windowEnd = bogota(3, 0);
  const deleted = await prisma.appointment.deleteMany({
    where: {
      tenantId: tenant.id,
      startsAt: { gte: windowStart, lt: windowEnd },
      status: { in: ['REQUESTED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'CANCELLED', 'NO_SHOW'] },
      clinicalRecords: { none: {} },
      invoice: null,
    },
  });

  type Slot = { day: number; h: number; m: number; pro: typeof drLaura; patient: number; service: string; status?: 'CHECKED_IN' | 'CONFIRMED' | 'REQUESTED'; reason?: string; room: number };
  const slots: Slot[] = [
    // HOY — Dra. Laura Valencia (Consultorio 1)
    { day: 0, h: 8, m: 0, pro: drLaura, patient: 0, service: 'Resina dental (obturación) por superficie', status: 'CHECKED_IN', reason: 'Terminar resina 16', room: 0 },
    { day: 0, h: 9, m: 0, pro: drLaura, patient: 8, service: 'Consulta de valoración odontológica', reason: 'Primera vez — sensibilidad dental', room: 0 },
    { day: 0, h: 9, m: 45, pro: drLaura, patient: 5, service: 'Resina dental (obturación) por superficie', reason: 'Resina 36', room: 0 },
    { day: 0, h: 10, m: 45, pro: drLaura, patient: 4, service: 'Profilaxis y detartraje (limpieza)', reason: 'Control periodontal', room: 0 },
    { day: 0, h: 14, m: 0, pro: drLaura, patient: 6, service: 'Blanqueamiento dental en consultorio', reason: 'Primera sesión de blanqueamiento', room: 0 },
    { day: 0, h: 15, m: 30, pro: drLaura, patient: 12, service: 'Consulta de valoración odontológica', status: 'REQUESTED', reason: 'Agendó por WhatsApp', room: 0 },
    // HOY — Dr. Andrés Ríos (Consultorio 2)
    { day: 0, h: 8, m: 30, pro: drAndres, patient: 3, service: 'Exodoncia de cordal (muela del juicio)', reason: 'Exodoncia 38', room: 1 },
    { day: 0, h: 10, m: 0, pro: drAndres, patient: 7, service: 'Endodoncia unirradicular', reason: 'Endodoncia 21 (fractura)', room: 1 },
    { day: 0, h: 11, m: 45, pro: drAndres, patient: 1, service: 'Implante dental (incluye corona)', reason: 'Control implante 46', room: 1 },
    { day: 0, h: 15, m: 0, pro: drAndres, patient: 9, service: 'Consulta de valoración odontológica', reason: 'Dolor en molar inferior', room: 1 },
    // MAÑANA
    { day: 1, h: 8, m: 0, pro: drLaura, patient: 2, service: 'Control de ortodoncia', reason: 'Control mensual', room: 0 },
    { day: 1, h: 9, m: 0, pro: drLaura, patient: 11, service: 'Sellantes de fosas y fisuras (por diente)', reason: 'Sellantes molares', room: 0 },
    { day: 1, h: 10, m: 0, pro: drLaura, patient: 10, service: 'Profilaxis y detartraje (limpieza)', room: 0 },
    { day: 1, h: 9, m: 0, pro: drAndres, patient: 3, service: 'Exodoncia de cordal (muela del juicio)', reason: 'Exodoncia 48', room: 1 },
    { day: 1, h: 11, m: 0, pro: drAndres, patient: 13, service: 'Consulta de valoración odontológica', room: 1 },
    { day: 2, h: 8, m: 30, pro: drLaura, patient: 0, service: 'Corona en porcelana', reason: 'Toma de impresión corona 26', room: 0 },
  ];

  let createdAppts = 0;
  for (const s of slots) {
    const service = svc(s.service);
    const startsAt = bogota(s.day, s.h, s.m);
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
    const clash = await prisma.appointment.count({
      where: {
        tenantId: tenant.id, professionalId: s.pro.id,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        startsAt: { lt: endsAt }, endsAt: { gt: startsAt },
      },
    });
    if (clash) continue;
    await prisma.appointment.create({
      data: {
        tenantId: tenant.id, siteId: site.id, roomId: rooms[s.room]?.id,
        patientId: patientIds[s.patient], professionalId: s.pro.id, serviceId: service.id,
        startsAt, endsAt, status: s.status ?? 'CONFIRMED', reason: s.reason, createdBy: recep.id,
      },
    });
    createdAppts++;
  }

  // Historial: citas atendidas de semanas anteriores (solo la primera vez)
  const pastCount = await prisma.appointment.count({ where: { tenantId: tenant.id, startsAt: { lt: windowStart } } });
  if (pastCount === 0) {
    const past: [number, number, typeof drLaura, number, string][] = [
      [-12, 9, drLaura, 0, 'Endodoncia multirradicular (molar)'],
      [-20, 10, drAndres, 1, 'Implante dental (incluye corona)'],
      [-28, 8, drLaura, 2, 'Control de ortodoncia'],
      [-5, 11, drAndres, 3, 'Consulta de valoración odontológica'],
      [-9, 14, drLaura, 4, 'Profilaxis y detartraje (limpieza)'],
      [-15, 15, drLaura, 5, 'Sellantes de fosas y fisuras (por diente)'],
      [-6, 9, drAndres, 1, 'Implante dental (incluye corona)'],
      [-3, 10, drLaura, 0, 'Resina dental (obturación) por superficie'],
    ];
    for (const [d, h, pro, pi, sname] of past) {
      const service = svc(sname);
      const startsAt = bogota(d, h);
      await prisma.appointment.create({
        data: {
          tenantId: tenant.id, siteId: site.id, patientId: patientIds[pi], professionalId: pro.id, serviceId: service.id,
          startsAt, endsAt: new Date(startsAt.getTime() + service.durationMinutes * 60_000),
          status: 'ATTENDED', createdBy: recep.id,
        },
      });
    }
  }
  console.log(`  ✓ Agenda regenerada: ${createdAppts} citas hoy/mañana (${deleted.count} citas viejas sin atender reemplazadas)`);

  console.log(`
✅ Demo odontológica lista.

   Web:  https://app.salud.surcoapp.tech/login
   Contraseña para todos: ${PASSWORD}

   Administradora:   admin@sonrisa.demo
   Odontóloga:       dra.valencia@sonrisa.demo
   Odontólogo:       dr.rios@sonrisa.demo
   Recepción:        recepcion@sonrisa.demo
`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

import { PrismaClient, PlanTier, UserRole, Specialty, Country, DocumentType, Gender } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Surco Health...\n');

  // ============ PLANES ============
  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { tier: PlanTier.FREE },
      update: {},
      create: {
        tier: PlanTier.FREE, name: 'Free',
        priceMonthlyUsd: 0,
        maxProfessionals: 1, maxAppointmentsPerMonth: 30, maxStorageGb: 1,
        whatsappEnabled: true, whatsappMonthlyLimit: 50,
        maxWhatsappAccounts: 1,
      },
    }),
    prisma.plan.upsert({
      where: { tier: PlanTier.PRO },
      update: {},
      create: {
        tier: PlanTier.PRO, name: 'Pro',
        priceMonthlyUsd: 29,
        maxProfessionals: 5, maxAppointmentsPerMonth: 1000, maxStorageGb: 5,
        whatsappEnabled: true, whatsappMonthlyLimit: 2000,
        maxWhatsappAccounts: 2,
        telehealthEnabled: true,
        electronicInvoiceEnabled: true,
      },
    }),
    prisma.plan.upsert({
      where: { tier: PlanTier.CLINICA },
      update: {},
      create: {
        tier: PlanTier.CLINICA, name: 'Clínica',
        priceMonthlyUsd: 49,
        maxProfessionals: 20, maxStorageGb: 50,
        whatsappEnabled: true,
        maxWhatsappAccounts: 5,
        telehealthEnabled: true,
        electronicInvoiceEnabled: true,
        fhirExportEnabled: true,
        multiSiteEnabled: true,
        prioritySupport: true,
      },
    }),
    prisma.plan.upsert({
      where: { tier: PlanTier.ENTERPRISE },
      update: {},
      create: {
        tier: PlanTier.ENTERPRISE, name: 'Enterprise',
        priceMonthlyUsd: 199,
        maxProfessionals: 200, maxStorageGb: 500,
        whatsappEnabled: true,
        maxWhatsappAccounts: 50, // marketplace-ready
        telehealthEnabled: true,
        electronicInvoiceEnabled: true,
        fhirExportEnabled: true,
        multiSiteEnabled: true,
        customDomainEnabled: true,
        prioritySupport: true,
      },
    }),
  ]);
  console.log(`  ✓ ${plans.length} planes`);

  // ============ ADMIN SaaS ============
  await prisma.user.upsert({
    where: { email: 'admin@surcohealth.local' },
    update: {},
    create: {
      email: 'admin@surcohealth.local',
      passwordHash: await bcrypt.hash('admin123', 10),
      fullName: 'Admin Surco Health',
      role: UserRole.SAAS_ADMIN,
    },
  });
  console.log('  ✓ SaaS admin: admin@surcohealth.local / admin123');

  // ============ TENANT DEMO: clínica multi-especialidad ============
  const proPlan = plans.find((p) => p.tier === PlanTier.PRO)!;
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'clinica-demo' },
    update: {},
    create: {
      legalName: 'Clínica Demo SAS',
      tradeName: 'Clínica Demo',
      slug: 'clinica-demo',
      taxId: '900123456-7',
      taxIdType: 'NIT',
      country: Country.CO,
      timezone: 'America/Bogota',
      currency: 'COP',
      primarySpecialty: Specialty.MEDICAL_GENERAL,
      planId: proPlan.id,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      privacyPolicyAcceptedAt: new Date(),
    },
  });
  console.log(`  ✓ Tenant demo: ${tenant.slug}`);

  // ============ SEDE PRINCIPAL ============
  const site = await prisma.site.upsert({
    where: { id: 'site-demo-main' },
    update: {},
    create: {
      id: 'site-demo-main',
      tenantId: tenant.id,
      name: 'Sede Principal',
      address: 'Carrera 7 #45-67, Bogotá',
      phone: '+57 1 2345678',
      email: 'contacto@clinicademo.local',
      isMain: true,
    },
  });
  await prisma.room.upsert({
    where: { id: 'room-demo-1' },
    update: {},
    create: { id: 'room-demo-1', siteId: site.id, name: 'Consultorio 1' },
  });
  await prisma.room.upsert({
    where: { id: 'room-demo-2' },
    update: {},
    create: { id: 'room-demo-2', siteId: site.id, name: 'Consultorio 2' },
  });

  // ============ USUARIOS ============
  const hash = (p: string) => bcrypt.hash(p, 10);

  await prisma.user.upsert({
    where: { email: 'owner@clinicademo.local' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'owner@clinicademo.local',
      passwordHash: await hash('owner123'),
      fullName: 'Laura Martínez',
      phone: '+57 300 1112233',
      role: UserRole.CLINIC_OWNER,
    },
  });

  const drGarcia = await prisma.user.upsert({
    where: { email: 'dr.garcia@clinicademo.local' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'dr.garcia@clinicademo.local',
      passwordHash: await hash('doctor123'),
      fullName: 'Dr. Andrés García',
      phone: '+57 300 2223344',
      role: UserRole.PROFESSIONAL,
      specialty: Specialty.MEDICAL_GENERAL,
      licenseNumber: 'RM-12345',
      licenseAuthority: 'Minsalud Colombia',
    },
  });

  const drDental = await prisma.user.upsert({
    where: { email: 'dra.lopez@clinicademo.local' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'dra.lopez@clinicademo.local',
      passwordHash: await hash('dental123'),
      fullName: 'Dra. María López',
      phone: '+57 300 3334455',
      role: UserRole.PROFESSIONAL,
      specialty: Specialty.DENTAL,
      licenseNumber: 'OD-67890',
      licenseAuthority: 'Minsalud Colombia',
    },
  });

  const drPsico = await prisma.user.upsert({
    where: { email: 'dra.ruiz@clinicademo.local' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'dra.ruiz@clinicademo.local',
      passwordHash: await hash('psico123'),
      fullName: 'Dra. Carolina Ruiz',
      phone: '+57 300 4445566',
      role: UserRole.PROFESSIONAL,
      specialty: Specialty.PSYCHOLOGY,
      licenseNumber: 'PS-11223',
      licenseAuthority: 'Colegio Colombiano de Psicólogos',
    },
  });

  await prisma.user.upsert({
    where: { email: 'recep@clinicademo.local' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'recep@clinicademo.local',
      passwordHash: await hash('recep123'),
      fullName: 'Sofía Recepción',
      role: UserRole.RECEPTIONIST,
    },
  });

  // Asignar profesionales a la sede
  for (const prof of [drGarcia, drDental, drPsico]) {
    await prisma.professionalSite.upsert({
      where: { siteId_professionalId: { siteId: site.id, professionalId: prof.id } },
      update: {},
      create: { siteId: site.id, professionalId: prof.id },
    });
  }

  console.log('  ✓ 5 usuarios creados (owner + 3 profesionales + recepción)');

  // ============ CATÁLOGO DE SERVICIOS ============
  const services = await Promise.all([
    prisma.clinicalService.create({
      data: {
        tenantId: tenant.id,
        name: 'Consulta de medicina general',
        durationMinutes: 30,
        priceParticular: 90000,
        specialty: Specialty.MEDICAL_GENERAL,
        defaultCieCode: 'Z00.0',
      },
    }),
    prisma.clinicalService.create({
      data: {
        tenantId: tenant.id,
        name: 'Consulta odontológica de primera vez',
        durationMinutes: 45,
        priceParticular: 120000,
        specialty: Specialty.DENTAL,
      },
    }),
    prisma.clinicalService.create({
      data: {
        tenantId: tenant.id,
        name: 'Limpieza dental + profilaxis',
        durationMinutes: 60,
        priceParticular: 150000,
        specialty: Specialty.DENTAL,
      },
    }),
    prisma.clinicalService.create({
      data: {
        tenantId: tenant.id,
        name: 'Sesión de psicoterapia individual',
        durationMinutes: 50,
        priceParticular: 180000,
        specialty: Specialty.PSYCHOLOGY,
      },
    }),
    prisma.clinicalService.create({
      data: {
        tenantId: tenant.id,
        name: 'Evaluación psicométrica completa',
        durationMinutes: 90,
        priceParticular: 250000,
        specialty: Specialty.PSYCHOLOGY,
      },
    }),
  ]);
  console.log(`  ✓ ${services.length} servicios clínicos`);

  // ============ TESTS PSICOMÉTRICOS BASE ============
  const tests = await Promise.all([
    prisma.psychometricTestDefinition.upsert({
      where: { code: 'PHQ-9' },
      update: {},
      create: {
        code: 'PHQ-9',
        name: 'Patient Health Questionnaire-9 (Depresión)',
        description: 'Escala de 9 ítems para detectar y medir severidad de depresión.',
        schema: {
          questions: 9,
          scale: '0-3 cada uno',
          maxScore: 27,
          interpretation: [
            { range: [0, 4], label: 'Mínima o ninguna' },
            { range: [5, 9], label: 'Depresión leve' },
            { range: [10, 14], label: 'Depresión moderada' },
            { range: [15, 19], label: 'Depresión moderadamente severa' },
            { range: [20, 27], label: 'Depresión severa' },
          ],
        },
      },
    }),
    prisma.psychometricTestDefinition.upsert({
      where: { code: 'GAD-7' },
      update: {},
      create: {
        code: 'GAD-7',
        name: 'Generalized Anxiety Disorder-7 (Ansiedad)',
        schema: {
          questions: 7, scale: '0-3', maxScore: 21,
          interpretation: [
            { range: [0, 4], label: 'Mínima' },
            { range: [5, 9], label: 'Leve' },
            { range: [10, 14], label: 'Moderada' },
            { range: [15, 21], label: 'Severa' },
          ],
        },
      },
    }),
    prisma.psychometricTestDefinition.upsert({
      where: { code: 'BDI-II' },
      update: {},
      create: {
        code: 'BDI-II',
        name: 'Inventario de Depresión de Beck II',
        schema: {
          questions: 21, scale: '0-3', maxScore: 63,
          interpretation: [
            { range: [0, 13], label: 'Mínima' },
            { range: [14, 19], label: 'Leve' },
            { range: [20, 28], label: 'Moderada' },
            { range: [29, 63], label: 'Severa' },
          ],
        },
      },
    }),
  ]);
  console.log(`  ✓ ${tests.length} tests psicométricos (PHQ-9, GAD-7, BDI-II)`);

  // ============ PACIENTE DEMO ============
  const patient = await prisma.patient.upsert({
    where: { tenantId_documentType_documentId: { tenantId: tenant.id, documentType: DocumentType.CC, documentId: '1023456789' } },
    update: {},
    create: {
      tenantId: tenant.id,
      documentType: DocumentType.CC,
      documentId: '1023456789',
      fullName: 'Juan Pablo Pérez',
      birthdate: new Date('1990-03-15'),
      gender: Gender.MALE,
      phone: '+57 310 9998877',
      email: 'juan.perez@example.com',
      city: 'Bogotá',
      privacyAcceptedAt: new Date(),
      privacyVersion: 'v1.0',
    },
  });

  // Perfiles clínicos por especialidad
  await prisma.dentalChart.upsert({
    where: { patientId: patient.id },
    update: {},
    create: { patientId: patient.id, state: {} },
  });
  await prisma.medicalProfile.upsert({
    where: { patientId: patient.id },
    update: {},
    create: { patientId: patient.id, smoker: false, alcohol: 'ocasional' },
  });

  console.log('  ✓ Paciente demo: Juan Pablo Pérez (CC 1023456789)');

  // ============ ICD-10 CODES (sample) ============
  const icd10Sample = [
    { code: 'Z00.0', description: 'Examen médico general' },
    { code: 'J00', description: 'Rinofaringitis aguda (resfriado común)' },
    { code: 'K02.9', description: 'Caries dental, no especificada' },
    { code: 'K05.30', description: 'Periodontitis crónica' },
    { code: 'F32.0', description: 'Episodio depresivo leve' },
    { code: 'F32.1', description: 'Episodio depresivo moderado' },
    { code: 'F41.1', description: 'Trastorno de ansiedad generalizada' },
    { code: 'F43.21', description: 'Trastorno adaptativo con estado de ánimo depresivo' },
    { code: 'I10', description: 'Hipertensión esencial (primaria)' },
    { code: 'E11.9', description: 'Diabetes mellitus tipo 2 sin complicaciones' },
  ];
  for (const code of icd10Sample) {
    await prisma.icd10Code.upsert({ where: { code: code.code }, update: {}, create: code });
  }
  console.log(`  ✓ ${icd10Sample.length} códigos CIE-10 de ejemplo cargados (importa el dataset completo de Minsalud en producción)`);

  console.log('\n✅ Seed completado.\n');
  console.log('Credenciales de prueba:');
  console.log('  SaaS Admin:      admin@surcohealth.local        / admin123');
  console.log('  Owner clínica:   owner@clinicademo.local        / owner123');
  console.log('  Dr. Med General: dr.garcia@clinicademo.local    / doctor123');
  console.log('  Dra. Dental:     dra.lopez@clinicademo.local    / dental123');
  console.log('  Dra. Psicología: dra.ruiz@clinicademo.local     / psico123');
  console.log('  Recepción:       recep@clinicademo.local        / recep123');
  console.log('');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

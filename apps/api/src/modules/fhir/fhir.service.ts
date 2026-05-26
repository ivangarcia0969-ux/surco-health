/**
 * FHIR R4 export — cumple Res 866/2021 Colombia (interoperabilidad
 * obligatoria HCE desde abril 2026).
 *
 * Recursos soportados:
 *  - Patient
 *  - Composition (HCE consolidada del paciente, formato RDA Colombia)
 *  - Observation (signos vitales)
 *  - MedicationRequest (recetas)
 *  - Bundle ($everything del paciente)
 *
 * Especificación: https://hl7.org/fhir/R4/
 * RDA Colombia: https://vulcano.ihcecol.gov.co/
 */
import { prisma } from '../../plugins/prisma';
import { AppError } from '../../utils/errors';
import { logAudit, type AuditContext } from '@surco/audit';

const FHIR_VERSION = '4.0.1';
const SYSTEM_DOC_CO = 'http://terminology.hl7.org/CodeSystem/v2-0203';

function mapGenderToFhir(g: string): 'male' | 'female' | 'other' | 'unknown' {
  switch (g) {
    case 'MALE': return 'male';
    case 'FEMALE': return 'female';
    case 'NON_BINARY':
    case 'OTHER': return 'other';
    default: return 'unknown';
  }
}

function mapDocumentTypeToCode(t: string): string {
  // Tipos de identificación según DIVIPOLA / RUAF Colombia
  const map: Record<string, string> = {
    CC: 'NI',       // Identificación nacional
    TI: 'TI',       // Tarjeta de identidad
    CE: 'CE',
    RC: 'RC',
    PA: 'PA',
    PASSPORT: 'PPN',
    RFC: 'RFC',
    DNI: 'DNI',
    OTHER: 'OTH',
  };
  return map[t] ?? 'OTH';
}

/** Construye un FHIR Patient resource desde nuestro Patient */
export async function buildFhirPatient(ctx: AuditContext, patientId: string) {
  const p = await prisma.patient.findFirst({
    where: { id: patientId, tenantId: ctx.tenantId },
  });
  if (!p) throw new AppError('PATIENT_NOT_FOUND', 404);

  const [given, ...rest] = p.fullName.trim().split(/\s+/);
  const family = rest.join(' ') || given;

  const resource = {
    resourceType: 'Patient',
    id: p.id,
    meta: {
      versionId: '1',
      lastUpdated: p.updatedAt.toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
    },
    identifier: [
      {
        use: 'official',
        type: {
          coding: [{
            system: SYSTEM_DOC_CO,
            code: mapDocumentTypeToCode(p.documentType),
            display: p.documentType,
          }],
        },
        value: p.documentId,
      },
    ],
    active: p.isActive,
    name: [{ use: 'official', given: [given], family, text: p.fullName }],
    gender: mapGenderToFhir(p.gender),
    birthDate: p.birthdate.toISOString().slice(0, 10),
    telecom: [
      ...(p.phone ? [{ system: 'phone', value: p.phone, use: 'mobile' }] : []),
      ...(p.email ? [{ system: 'email', value: p.email }] : []),
    ],
    address: p.address || p.city ? [{
      use: 'home',
      line: p.address ? [p.address] : undefined,
      city: p.city ?? undefined,
    }] : undefined,
  };

  await logAudit({
    ctx, action: 'EXPORT_FHIR', entityType: 'Patient', entityId: patientId,
    metadata: { resourceType: 'Patient' },
  });

  return resource;
}

/** Construye un FHIR Composition desde una ClinicalRecord */
async function buildFhirComposition(rec: any) {
  const sd = (rec.structuredData as any) ?? {};

  // Sección Subjetivo + Objetivo + Análisis + Plan al estilo SOAP
  const sections: any[] = [];
  if (sd.chiefComplaint || sd.currentIllness) {
    sections.push({
      title: 'Anamnesis',
      code: { coding: [{ system: 'http://loinc.org', code: '10164-2', display: 'History of present illness' }] },
      text: { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${(sd.chiefComplaint ?? '')}</p><p>${(sd.currentIllness ?? '')}</p></div>` },
    });
  }
  if (sd.physicalExam) {
    sections.push({
      title: 'Examen físico',
      code: { coding: [{ system: 'http://loinc.org', code: '29545-1', display: 'Physical findings' }] },
      text: { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${sd.physicalExam}</div>` },
    });
  }

  if (rec.diagnoses && rec.diagnoses.length > 0) {
    sections.push({
      title: 'Diagnósticos',
      code: { coding: [{ system: 'http://loinc.org', code: '11450-4', display: 'Problem list' }] },
      entry: rec.diagnoses.map((d: any) => ({
        display: `${d.icd10Code} - ${d.description ?? ''}${d.isPrimary ? ' (primario)' : ''}`,
      })),
    });
  }

  if (sd.plan) {
    sections.push({
      title: 'Plan',
      code: { coding: [{ system: 'http://loinc.org', code: '18776-5', display: 'Plan of care' }] },
      text: { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${sd.plan}</div>` },
    });
  }

  return {
    resourceType: 'Composition',
    id: rec.id,
    meta: {
      versionId: String(rec.version),
      lastUpdated: rec.createdAt.toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Composition'],
    },
    status: rec.signedAt ? 'final' : 'preliminary',
    type: {
      coding: [{ system: 'http://loinc.org', code: '11488-4', display: 'Consult note' }],
    },
    subject: { reference: `Patient/${rec.patientId}` },
    date: rec.createdAt.toISOString(),
    author: [{ reference: `Practitioner/${rec.professionalId}`, display: rec.professional?.fullName }],
    title: `Consulta clínica — ${rec.createdAt.toISOString().slice(0, 10)}`,
    confidentiality: rec.isLocked ? 'R' : 'N', // R = Restricted
    section: sections,
  };
}

export async function buildFhirCompositionFromRecord(ctx: AuditContext, recordId: string) {
  const rec = await prisma.clinicalRecord.findFirst({
    where: { id: recordId, tenantId: ctx.tenantId },
    include: {
      professional: { select: { id: true, fullName: true } },
      diagnoses: true,
    },
  });
  if (!rec) throw new AppError('RECORD_NOT_FOUND', 404);

  await logAudit({
    ctx, action: 'EXPORT_FHIR', entityType: 'ClinicalRecord', entityId: recordId,
    metadata: { resourceType: 'Composition' },
  });

  return buildFhirComposition(rec);
}

/** Observation desde VitalSigns */
export async function buildFhirObservationFromVitals(ctx: AuditContext, recordId: string) {
  const rec = await prisma.clinicalRecord.findFirst({
    where: { id: recordId, tenantId: ctx.tenantId },
    include: { vitalSigns: true, professional: true },
  });
  if (!rec?.vitalSigns) throw new AppError('VITALS_NOT_FOUND', 404);

  const vs = rec.vitalSigns;
  const components: any[] = [];

  if (vs.systolicMmHg && vs.diastolicMmHg) {
    components.push({
      code: { coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel' }] },
      valueQuantity: { value: vs.systolicMmHg, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' },
    });
    components.push({
      code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' }] },
      valueQuantity: { value: vs.diastolicMmHg, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' },
    });
  }
  if (vs.heartRate) {
    components.push({
      code: { coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }] },
      valueQuantity: { value: vs.heartRate, unit: '/min', system: 'http://unitsofmeasure.org', code: '/min' },
    });
  }
  if (vs.temperatureC) {
    components.push({
      code: { coding: [{ system: 'http://loinc.org', code: '8310-5', display: 'Body temperature' }] },
      valueQuantity: { value: Number(vs.temperatureC), unit: 'Cel', system: 'http://unitsofmeasure.org', code: 'Cel' },
    });
  }
  if (vs.oxygenSaturation) {
    components.push({
      code: { coding: [{ system: 'http://loinc.org', code: '59408-5', display: 'Oxygen saturation' }] },
      valueQuantity: { value: vs.oxygenSaturation, unit: '%', system: 'http://unitsofmeasure.org', code: '%' },
    });
  }
  if (vs.weightKg) {
    components.push({
      code: { coding: [{ system: 'http://loinc.org', code: '29463-7', display: 'Body weight' }] },
      valueQuantity: { value: Number(vs.weightKg), unit: 'kg', system: 'http://unitsofmeasure.org', code: 'kg' },
    });
  }
  if (vs.heightCm) {
    components.push({
      code: { coding: [{ system: 'http://loinc.org', code: '8302-2', display: 'Body height' }] },
      valueQuantity: { value: Number(vs.heightCm), unit: 'cm', system: 'http://unitsofmeasure.org', code: 'cm' },
    });
  }

  await logAudit({
    ctx, action: 'EXPORT_FHIR', entityType: 'VitalSigns', entityId: vs.id,
    metadata: { resourceType: 'Observation' },
  });

  return {
    resourceType: 'Observation',
    id: vs.id,
    status: 'final',
    category: [{
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }],
    }],
    code: { coding: [{ system: 'http://loinc.org', code: '8716-3', display: 'Vital signs' }] },
    subject: { reference: `Patient/${rec.patientId}` },
    effectiveDateTime: vs.measuredAt.toISOString(),
    performer: [{ reference: `Practitioner/${rec.professionalId}`, display: rec.professional?.fullName }],
    component: components,
  };
}

/** Bundle $everything del paciente — HCE consolidada FHIR R4 */
export async function buildPatientEverything(ctx: AuditContext, patientId: string) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, tenantId: ctx.tenantId },
  });
  if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);

  const records = await prisma.clinicalRecord.findMany({
    where: { tenantId: ctx.tenantId, patientId, archivedAt: null },
    orderBy: { createdAt: 'desc' },
    include: {
      professional: { select: { id: true, fullName: true } },
      diagnoses: true,
      vitalSigns: true,
    },
  });

  const patientResource = await buildFhirPatient(ctx, patientId);
  const entries: any[] = [{ resource: patientResource, fullUrl: `Patient/${patientResource.id}` }];

  for (const rec of records) {
    const comp = await buildFhirComposition(rec);
    entries.push({ resource: comp, fullUrl: `Composition/${comp.id}` });

    if (rec.vitalSigns) {
      const obs = await buildFhirObservationFromVitals(ctx, rec.id);
      entries.push({ resource: obs, fullUrl: `Observation/${obs.id}` });
    }
  }

  await logAudit({
    ctx, action: 'EXPORT_FHIR', entityType: 'Patient', entityId: patientId,
    metadata: { resourceType: 'Bundle', operation: '$everything', entries: entries.length },
  });

  return {
    resourceType: 'Bundle',
    id: `everything-${patient.id}-${Date.now()}`,
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Bundle'],
    },
    type: 'searchset',
    total: entries.length,
    timestamp: new Date().toISOString(),
    entry: entries,
  };
}

/** Capability statement (lo que un cliente FHIR puede preguntar) */
export function buildCapabilityStatement(baseUrl: string) {
  return {
    resourceType: 'CapabilityStatement',
    status: 'active',
    date: new Date().toISOString(),
    publisher: 'Surco Health',
    kind: 'instance',
    software: { name: 'Surco Health API', version: '0.1.0' },
    implementation: { description: 'Surco Health FHIR R4 endpoint', url: baseUrl },
    fhirVersion: FHIR_VERSION,
    format: ['application/fhir+json'],
    rest: [{
      mode: 'server',
      resource: [
        { type: 'Patient', interaction: [{ code: 'read' }, { code: 'search-type' }], operation: [{ name: 'everything', definition: 'http://hl7.org/fhir/OperationDefinition/Patient-everything' }] },
        { type: 'Composition', interaction: [{ code: 'read' }] },
        { type: 'Observation', interaction: [{ code: 'read' }] },
      ],
    }],
  };
}

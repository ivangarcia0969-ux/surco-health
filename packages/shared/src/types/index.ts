export type UserRole =
  | 'SAAS_ADMIN'
  | 'CLINIC_OWNER'
  | 'PROFESSIONAL'
  | 'RECEPTIONIST'
  | 'BILLING';

export type Specialty =
  | 'MEDICAL_GENERAL'
  | 'DENTAL'
  | 'PSYCHOLOGY'
  | 'PSYCHIATRY'
  | 'PEDIATRICS'
  | 'GYNECOLOGY'
  | 'DERMATOLOGY'
  | 'CARDIOLOGY'
  | 'NUTRITION'
  | 'PHYSIOTHERAPY'
  | 'AESTHETICS'
  | 'OPHTHALMOLOGY'
  | 'ORTHOPEDICS'
  | 'OTORHINOLARYNGOLOGY'
  | 'OTHER';

export type AppointmentStatus =
  | 'REQUESTED'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'ATTENDED'
  | 'NO_SHOW'
  | 'CANCELLED';

export type AppointmentChannel = 'IN_PERSON' | 'TELEHEALTH';

export type PlanTier = 'FREE' | 'PRO' | 'CLINICA' | 'ENTERPRISE';

export type DocumentType = 'CC' | 'TI' | 'CE' | 'RC' | 'PA' | 'RFC' | 'DNI' | 'PASSPORT' | 'OTHER';

export type Gender = 'MALE' | 'FEMALE' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY' | 'OTHER';

export type BloodType = 'A_POS' | 'A_NEG' | 'B_POS' | 'B_NEG' | 'AB_POS' | 'AB_NEG' | 'O_POS' | 'O_NEG' | 'UNKNOWN';

export type ClinicalRecordType =
  | 'CONSULTATION'
  | 'EVOLUTION_NOTE'
  | 'DENTAL_TREATMENT'
  | 'PSYCHOLOGY_SOAP'
  | 'PSYCHOMETRIC_TEST'
  | 'PEDIATRIC_CHECKUP'
  | 'AESTHETIC_PROCEDURE'
  | 'PRESCRIPTION'
  | 'LAB_ORDER'
  | 'IMAGING_ORDER'
  | 'REFERRAL'
  | 'CERTIFICATE'
  | 'AMENDMENT';

export type RiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'IMMINENT';

export interface AuthContext {
  userId: string;
  tenantId: string | null;
  role: UserRole;
  specialty?: Specialty | null;
}

export interface ApiError {
  error: string;
  message?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/** Roles que pueden ver datos clínicos (HCE) */
export const CLINICAL_ROLES: UserRole[] = ['CLINIC_OWNER', 'PROFESSIONAL'];

/** Roles administrativos (sin acceso a contenido clínico) */
export const ADMIN_ROLES: UserRole[] = ['CLINIC_OWNER', 'RECEPTIONIST', 'BILLING'];

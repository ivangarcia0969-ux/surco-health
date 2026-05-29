import bcrypt from 'bcryptjs';

// OWASP 2023 recomienda ≥12 para bcrypt en producción.
// Costo computacional: ~250ms en CPU moderna — aceptable para login.
const ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

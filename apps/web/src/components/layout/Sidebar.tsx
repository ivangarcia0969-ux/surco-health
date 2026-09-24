'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn, SPECIALTY_LABEL } from '@/lib/utils';
import { LogoMark } from '@/components/brand/Logo';

interface NavItem { href: string; label: string; icon: string }

const ownerNav: NavItem[] = [
  { href: '/dashboard', label: 'Inicio', icon: '🏠' },
  { href: '/agenda', label: 'Agenda', icon: '📅' },
  { href: '/pacientes', label: 'Pacientes', icon: '👥' },
  { href: '/caja', label: 'Caja', icon: '💵' },
  { href: '/profesionales', label: 'Profesionales', icon: '👨‍⚕️' },
  { href: '/catalogo', label: 'Servicios y precios', icon: '📋' },
  { href: '/ajustes', label: 'Ajustes', icon: '⚙️' },
];

const professionalNav: NavItem[] = [
  { href: '/dashboard', label: 'Inicio', icon: '🏠' },
  { href: '/agenda', label: 'Mi agenda', icon: '📅' },
  { href: '/pacientes', label: 'Pacientes', icon: '👥' },
  { href: '/mi-perfil', label: 'Mi perfil y firma', icon: '✍️' },
];

const receptionistNav: NavItem[] = [
  { href: '/dashboard', label: 'Inicio', icon: '🏠' },
  { href: '/agenda', label: 'Agenda', icon: '📅' },
  { href: '/pacientes', label: 'Pacientes', icon: '👥' },
  { href: '/caja', label: 'Caja', icon: '💵' },
];

const billingNav: NavItem[] = [
  { href: '/caja', label: 'Caja', icon: '💵' },
  { href: '/pacientes', label: 'Pacientes', icon: '👥' },
];

export function navForRole(role: string): NavItem[] {
  return role === 'CLINIC_OWNER' ? ownerNav
    : role === 'PROFESSIONAL' ? professionalNav
    : role === 'BILLING' ? billingNav
    : receptionistNav;
}

export function Sidebar({ role, specialty }: { role: string; specialty?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, refreshToken, clear } = useAuth();

  const items = navForRole(role);

  async function logout() {
    if (refreshToken) {
      try { await apiFetch('/api/auth/logout', { method: 'POST', body: { refreshToken }, autoRefresh: false }); } catch {/* */}
    }
    clear();
    router.replace('/login');
  }

  const initials = (user?.fullName ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-gray-100 bg-white md:flex print:hidden">
      {/* Marca */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <LogoMark className="h-9 w-9" />
        <span className="text-lg font-bold tracking-tight text-gray-900">
          Surco<span className="text-brand-600">Health</span>
        </span>
      </div>

      {/* Usuario */}
      <div className="mx-3 flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
          {initials}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900">{user?.fullName}</div>
          <div className="truncate text-xs text-gray-500">
            {specialty ? (SPECIALTY_LABEL[specialty] ?? specialty) : 'Administrador'}
          </div>
        </div>
      </div>

      <div className="px-5 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Menú</div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                    active
                      ? 'bg-brand-50 text-brand-700 shadow-[inset_0_0_0_1px] shadow-brand-100'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  )}>
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg text-base transition',
                  active ? 'bg-white shadow-sm' : 'bg-gray-100 group-hover:bg-white',
                )}
                aria-hidden
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={logout}
        className="m-3 flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
      >
        <span aria-hidden>↩</span> Cerrar sesión
      </button>
    </aside>
  );
}

/**
 * Navegación en celular: barra superior (marca + salir) y barra inferior
 * con las secciones principales. En escritorio se usa el Sidebar.
 */
export function MobileNav({ role }: { role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { refreshToken, clear } = useAuth();
  const items = navForRole(role).slice(0, 5);

  async function logout() {
    if (refreshToken) {
      try { await apiFetch('/api/auth/logout', { method: 'POST', body: { refreshToken }, autoRefresh: false }); } catch {/* */}
    }
    clear();
    router.replace('/login');
  }

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur md:hidden print:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <LogoMark className="h-8 w-8" />
          <span className="text-base font-bold tracking-tight text-gray-900">Surco<span className="text-brand-600">Health</span></span>
        </Link>
        <button onClick={logout} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600">Salir</button>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gray-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href}
                  className={cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                    active ? 'text-brand-700' : 'text-gray-500')}>
              <span className={cn('flex h-7 w-10 items-center justify-center rounded-full text-base', active && 'bg-brand-50')} aria-hidden>{item.icon}</span>
              <span className="max-w-[64px] truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn, SPECIALTY_LABEL } from '@/lib/utils';

interface NavItem { href: string; label: string; icon: string }

const ownerNav: NavItem[] = [
  { href: '/dashboard', label: 'Inicio', icon: '🏠' },
  { href: '/agenda', label: 'Agenda', icon: '📅' },
  { href: '/pacientes', label: 'Pacientes', icon: '👥' },
  { href: '/profesionales', label: 'Profesionales', icon: '👨‍⚕️' },
  { href: '/catalogo', label: 'Catálogo', icon: '📋' },
  { href: '/ajustes', label: 'Ajustes', icon: '⚙️' },
];

const professionalNav: NavItem[] = [
  { href: '/mi-agenda', label: 'Mi agenda', icon: '📅' },
  { href: '/pacientes', label: 'Pacientes', icon: '👥' },
];

const receptionistNav: NavItem[] = [
  { href: '/agenda', label: 'Agenda', icon: '📅' },
  { href: '/pacientes', label: 'Pacientes', icon: '👥' },
];

export function Sidebar({ role, specialty }: { role: string; specialty?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, refreshToken, clear } = useAuth();

  const items =
    role === 'CLINIC_OWNER' ? ownerNav
      : role === 'PROFESSIONAL' ? professionalNav
      : receptionistNav;

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
    <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-100 bg-white md:flex">
      {/* Marca */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm">✚</span>
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

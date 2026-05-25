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

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="text-sm font-semibold text-brand-600">Surco Health</div>
        <div className="mt-1 text-sm font-medium text-gray-900 truncate">{user?.fullName}</div>
        {specialty && <div className="text-xs text-gray-500">{SPECIALTY_LABEL[specialty] ?? specialty}</div>}
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                    active ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50',
                  )}>
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button onClick={logout} className="m-3 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
        Cerrar sesión
      </button>
    </aside>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { BackendSwitcher } from './backend-switcher';

export function SiteNav() {
  const pathname = usePathname();
  const isAdminLogin = pathname === '/admin/login';
  const isAdmin = pathname.startsWith('/admin');

  if (isAdminLogin) {
    return (
      <nav aria-label="Login navigation" className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold text-gray-900">
            SixBee HealthTech
          </span>
          <BackendSwitcher />
        </div>
      </nav>
    );
  }

  if (isAdmin) {
    return <AdminNav />;
  }

  return (
    <nav aria-label="Main navigation" className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-gray-900">
          SixBee HealthTech
        </Link>
        <BackendSwitcher />
      </div>
    </nav>
  );
}

function AdminNav() {
  const { logout } = useAuth();

  return (
    <nav aria-label="Admin navigation" className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <a href="/admin" className="text-lg font-semibold text-gray-900">
          SixBee HealthTech
        </a>
        <div className="flex items-center gap-3">
          <BackendSwitcher />
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

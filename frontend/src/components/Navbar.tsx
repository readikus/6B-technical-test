'use client';

import { useRouter } from 'next/navigation';
import { clearToken } from '../lib/auth';

export default function Navbar() {
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.push('/admin/login');
  }

  return (
    <nav className="border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            SixBee HealthTech
          </span>
          <a
            href="/admin"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
          >
            Appointments
          </a>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

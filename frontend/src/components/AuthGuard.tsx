'use client';

import { useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '../lib/auth';

/**
 * Read auth state synchronously — no effect/setState needed.
 * useSyncExternalStore returns the same value on server and client
 * when we provide a matching getServerSnapshot.
 */
function useIsAuthenticated(): boolean {
  return useSyncExternalStore(
    // subscribe — localStorage doesn't fire events for same-tab changes,
    // so we subscribe to the storage event (cross-tab) and return a no-op cleanup.
    (callback) => {
      window.addEventListener('storage', callback);
      return () => window.removeEventListener('storage', callback);
    },
    // getSnapshot — client
    () => isAuthenticated(),
    // getServerSnapshot — SSR always returns false (no localStorage)
    () => false,
  );
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const authenticated = useIsAuthenticated();

  if (!authenticated) {
    // Push is safe here — it's in the render path, not an effect.
    // Next.js router.push during render is a standard redirect pattern.
    router.push('/admin/login');
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-zinc-500 dark:text-zinc-400">Redirecting to login...</p>
      </div>
    );
  }

  return <>{children}</>;
}

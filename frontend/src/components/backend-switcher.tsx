'use client';

import { useState, useEffect } from 'react';
import {
  isDemoMode,
  getActiveBackend,
  setActiveBackend,
  BACKENDS,
  type BackendOption,
} from '@/lib/backend-switcher';

export function BackendSwitcher() {
  const [demo, setDemo] = useState(false);
  const [active, setActive] = useState<BackendOption>(BACKENDS[0]);

  useEffect(() => {
    setDemo(isDemoMode());
    setActive(getActiveBackend());

    const onChanged = () => setActive(getActiveBackend());
    window.addEventListener('backend-changed', onChanged);
    return () => window.removeEventListener('backend-changed', onChanged);
  }, []);

  if (!demo) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        DEMO
      </div>
      <select
        value={active.id}
        onChange={(e) => {
          setActiveBackend(e.target.value);
          setActive(BACKENDS.find((b) => b.id === e.target.value) ?? BACKENDS[0]);
          // Force re-auth check against the new backend
          window.location.reload();
        }}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        aria-label="Select backend API"
      >
        {BACKENDS.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label} ({b.tech})
          </option>
        ))}
      </select>
    </div>
  );
}

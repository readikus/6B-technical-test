'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  isDemoMode,
  enableDemoMode,
  disableDemoMode,
  BACKENDS,
  getActiveBackend,
  setActiveBackend,
} from '@/lib/backend-switcher';

export default function DemoPage() {
  const [demo, setDemo] = useState(false);
  const [active, setActive] = useState(BACKENDS[0]);
  const router = useRouter();

  useEffect(() => {
    // Visiting /demo automatically enables demo mode
    enableDemoMode();
    setDemo(true);
    setActive(getActiveBackend());
  }, []);

  function handleDisable() {
    disableDemoMode();
    setDemo(false);
    router.push('/');
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
          </span>
          <h1 className="text-2xl font-bold text-amber-900">Demo Mode Activated</h1>
        </div>

        <p className="text-amber-800 mb-6">
          You can now switch between three backend implementations using the
          dropdown in the navigation bar. All three share the same PostgreSQL
          database and the same API contract.
        </p>

        <div className="grid gap-3 mb-6">
          {BACKENDS.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                setActiveBackend(b.id);
                setActive(b);
              }}
              className={`flex items-center justify-between rounded-lg border-2 p-4 text-left transition-all ${
                active.id === b.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div>
                <div className="font-semibold text-gray-900">{b.label}</div>
                <div className="text-sm text-gray-500">{b.tech}</div>
              </div>
              <div className="text-right">
                <code className="text-xs text-gray-400">{b.url}</code>
                {active.id === b.id && (
                  <div className="mt-1 text-xs font-medium text-blue-600">Active</div>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-md bg-white p-4 border border-amber-200 mb-6">
          <h2 className="font-semibold text-gray-900 mb-2">How it works</h2>
          <ul className="text-sm text-gray-600 space-y-1.5">
            <li>
              <strong>Same frontend</strong> — this Next.js app talks to whichever
              API you select
            </li>
            <li>
              <strong>Same database</strong> — all three backends read/write the
              same PostgreSQL instance with the same encryption
            </li>
            <li>
              <strong>Same API contract</strong> — identical endpoints, request/response
              shapes, and httpOnly cookie auth
            </li>
            <li>
              <strong>AES-256-GCM compatible</strong> — the encryption byte layout is
              identical across all three, so data encrypted by one backend can be
              decrypted by another
            </li>
          </ul>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to Booking Form
          </button>
          <button
            onClick={handleDisable}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Disable Demo Mode
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Running all three backends</h3>
        <pre className="text-xs text-gray-600 bg-white rounded p-3 border overflow-x-auto">{`# Start everything
docker compose up --build

# Or individually:
docker compose up db backend              # NestJS    → :3001
docker compose up db backend-spring       # Spring    → :3002
docker compose up db backend-dotnet       # .NET      → :3004`}</pre>
      </div>
    </div>
  );
}

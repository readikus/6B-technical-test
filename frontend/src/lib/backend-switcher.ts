'use client';

export interface BackendOption {
  id: string;
  label: string;
  url: string;
  tech: string;
}

export const BACKENDS: BackendOption[] = [
  {
    id: 'nestjs',
    label: 'NestJS',
    url: 'http://localhost:3001',
    tech: 'Node.js + TypeScript',
  },
  {
    id: 'spring',
    label: 'Spring Boot',
    url: 'http://localhost:3002',
    tech: 'Java 21',
  },
  {
    id: 'dotnet',
    label: 'ASP.NET Core',
    url: 'http://localhost:3004',
    tech: '.NET 10 + C#',
  },
];

const DEMO_KEY = 'sixbee_demo_mode';
const BACKEND_KEY = 'sixbee_backend_id';

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DEMO_KEY) === 'true';
}

export function enableDemoMode(): void {
  localStorage.setItem(DEMO_KEY, 'true');
}

export function disableDemoMode(): void {
  localStorage.removeItem(DEMO_KEY);
  localStorage.removeItem(BACKEND_KEY);
}

export function getActiveBackend(): BackendOption {
  if (typeof window === 'undefined') return BACKENDS[0];
  const id = localStorage.getItem(BACKEND_KEY);
  return BACKENDS.find((b) => b.id === id) ?? BACKENDS[0];
}

export function setActiveBackend(id: string): void {
  localStorage.setItem(BACKEND_KEY, id);
  // Dispatch a custom event so all components can react
  window.dispatchEvent(new CustomEvent('backend-changed', { detail: id }));
}

export function getApiUrl(): string {
  if (!isDemoMode()) {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }
  return getActiveBackend().url;
}

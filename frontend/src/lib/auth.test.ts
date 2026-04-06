import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getToken, setToken, clearToken, isAuthenticated, authFetch } from './auth';

describe('auth helpers', () => {
  beforeEach(() => {
    clearToken();
    vi.restoreAllMocks();
  });

  describe('token management', () => {
    it('returns null when no token is stored', () => {
      // Arrange — fresh state (cleared in beforeEach)

      // Act
      const token = getToken();

      // Assert
      expect(token).toBeNull();
    });

    it('stores and retrieves a token', () => {
      // Arrange
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.test.signature';

      // Act
      setToken(jwt);

      // Assert
      expect(getToken()).toBe(jwt);
    });

    it('clears a stored token', () => {
      // Arrange
      setToken('some-token');

      // Act
      clearToken();

      // Assert
      expect(getToken()).toBeNull();
    });

    it('reports not authenticated when no token', () => {
      // Arrange — no token

      // Act & Assert
      expect(isAuthenticated()).toBe(false);
    });

    it('reports authenticated when token exists', () => {
      // Arrange
      setToken('valid-token');

      // Act & Assert
      expect(isAuthenticated()).toBe(true);
    });
  });

  describe('authFetch', () => {
    it('adds Authorization header with Bearer token', async () => {
      // Arrange
      setToken('my-jwt-token');
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 }),
      );

      // Act
      await authFetch('/api/appointments');

      // Assert
      expect(mockFetch).toHaveBeenCalledOnce();
      const [, options] = mockFetch.mock.calls[0];
      expect((options?.headers as Record<string, string>)['Authorization']).toBe(
        'Bearer my-jwt-token',
      );
    });

    it('passes through additional options', async () => {
      // Arrange
      setToken('token');
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('{}', { status: 200 }),
      );

      // Act
      await authFetch('/api/test', { method: 'PUT', body: '{"a":1}' });

      // Assert
      const [, options] = mockFetch.mock.calls[0];
      expect(options?.method).toBe('PUT');
      expect(options?.body).toBe('{"a":1}');
    });

    it('merges custom headers with auth header', async () => {
      // Arrange
      setToken('token');
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('{}', { status: 200 }),
      );

      // Act
      await authFetch('/api/test', {
        headers: { 'Content-Type': 'application/json' },
      });

      // Assert
      const [, options] = mockFetch.mock.calls[0];
      const headers = options?.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer token');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });
});

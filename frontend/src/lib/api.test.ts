import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  approveAppointment,
  declineAppointment,
  deleteAppointment,
  updateAppointment,
  fetchAuditLog,
} from './api';
import { setToken, clearToken } from './auth';

describe('appointment API actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearToken();
    setToken('test-token');
  });

  function mockResponse(body: unknown, status = 200) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  describe('approveAppointment', () => {
    it('sends PATCH to /api/appointments/:id/approve with auth', async () => {
      // Arrange
      const spy = mockResponse({ id: '1', status: 'approved' });

      // Act
      const result = await approveAppointment('1');

      // Assert
      expect(spy).toHaveBeenCalledOnce();
      const [url, options] = spy.mock.calls[0];
      expect(url).toContain('/api/appointments/1/approve');
      expect(options?.method).toBe('PATCH');
      expect((options?.headers as Record<string, string>)['Authorization']).toBe(
        'Bearer test-token',
      );
      expect(result.status).toBe('approved');
    });

    it('throws on non-OK response', async () => {
      // Arrange
      mockResponse({ message: 'Not found' }, 404);

      // Act & Assert
      await expect(approveAppointment('999')).rejects.toThrow();
    });
  });

  describe('declineAppointment', () => {
    it('sends PATCH to /api/appointments/:id/decline with auth', async () => {
      // Arrange
      const spy = mockResponse({ id: '1', status: 'declined' });

      // Act
      const result = await declineAppointment('1');

      // Assert
      const [url, options] = spy.mock.calls[0];
      expect(url).toContain('/api/appointments/1/decline');
      expect(options?.method).toBe('PATCH');
      expect(result.status).toBe('declined');
    });
  });

  describe('deleteAppointment', () => {
    it('sends DELETE to /api/appointments/:id with auth', async () => {
      // Arrange
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, { status: 204 }),
      );

      // Act
      await deleteAppointment('1');

      // Assert
      const [url, options] = spy.mock.calls[0];
      expect(url).toContain('/api/appointments/1');
      expect(options?.method).toBe('DELETE');
      expect((options?.headers as Record<string, string>)['Authorization']).toBe(
        'Bearer test-token',
      );
    });

    it('throws on non-OK response', async () => {
      // Arrange
      mockResponse({ message: 'Forbidden' }, 403);

      // Act & Assert
      await expect(deleteAppointment('1')).rejects.toThrow();
    });
  });

  describe('updateAppointment', () => {
    it('sends PUT to /api/appointments/:id with body and auth', async () => {
      // Arrange
      const updated = { id: '1', name: 'Updated Name' };
      const spy = mockResponse(updated);

      // Act
      const result = await updateAppointment('1', { name: 'Updated Name' });

      // Assert
      const [url, options] = spy.mock.calls[0];
      expect(url).toContain('/api/appointments/1');
      expect(options?.method).toBe('PUT');
      expect(JSON.parse(options?.body as string)).toEqual({ name: 'Updated Name' });
      expect((options?.headers as Record<string, string>)['Content-Type']).toBe(
        'application/json',
      );
      expect(result.name).toBe('Updated Name');
    });

    it('throws on non-OK response', async () => {
      // Arrange
      mockResponse({ message: 'Validation error' }, 422);

      // Act & Assert
      await expect(updateAppointment('1', {})).rejects.toThrow();
    });
  });

  describe('fetchAuditLog', () => {
    it('sends GET to /api/appointments/:id/audit with auth', async () => {
      // Arrange
      const logs = [{ id: 'a1', action: 'approved' }];
      const spy = mockResponse(logs);

      // Act
      const result = await fetchAuditLog('1');

      // Assert
      const [url, options] = spy.mock.calls[0];
      expect(url).toContain('/api/appointments/1/audit');
      expect((options?.headers as Record<string, string>)['Authorization']).toBe(
        'Bearer test-token',
      );
      expect(result).toEqual(logs);
    });
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppointmentsTable from './AppointmentsTable';
import { setToken, clearToken } from '../lib/auth';

const mockAppointments = [
  {
    id: '1',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '07700900123',
    description: 'Routine check-up',
    appointmentDate: '2026-04-10T09:00:00.000Z',
    status: 'pending',
    createdAt: '2026-04-01T10:00:00.000Z',
  },
  {
    id: '2',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '07700900456',
    description: 'Follow-up',
    appointmentDate: '2026-04-08T14:30:00.000Z',
    status: 'approved',
    createdAt: '2026-04-01T11:00:00.000Z',
  },
  {
    id: '3',
    name: 'Alice Brown',
    email: 'alice@example.com',
    phone: '07700900789',
    description: 'Consultation',
    appointmentDate: '2026-04-12T11:00:00.000Z',
    status: 'declined',
    createdAt: '2026-04-02T09:00:00.000Z',
  },
];

function mockFetchAppointments(data = mockAppointments, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('AppointmentsTable', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearToken();
    setToken('test-jwt-token');
  });

  describe('loading state', () => {
    it('shows loading indicator while fetching', () => {
      // Arrange
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
        () => new Promise(() => {}), // never resolves
      );

      // Act
      render(<AppointmentsTable />);

      // Assert
      expect(screen.getByText(/loading/i)).toBeDefined();
    });
  });

  describe('rendering data', () => {
    it('renders table headers', async () => {
      // Arrange
      mockFetchAppointments();

      // Act
      render(<AppointmentsTable />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Name')).toBeDefined();
        expect(screen.getByText('Email')).toBeDefined();
        expect(screen.getByText('Phone')).toBeDefined();
        expect(screen.getByText('Date & Time')).toBeDefined();
        expect(screen.getByText('Description')).toBeDefined();
        expect(screen.getByText('Status')).toBeDefined();
      });
    });

    it('renders appointment rows', async () => {
      // Arrange
      mockFetchAppointments();

      // Act
      render(<AppointmentsTable />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeDefined();
        expect(screen.getByText('John Doe')).toBeDefined();
        expect(screen.getByText('Alice Brown')).toBeDefined();
      });
    });

    it('displays all appointment fields in each row', async () => {
      // Arrange
      mockFetchAppointments();

      // Act
      render(<AppointmentsTable />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('jane@example.com')).toBeDefined();
        expect(screen.getByText('07700900123')).toBeDefined();
        expect(screen.getByText('Routine check-up')).toBeDefined();
      });
    });

    it('fetches with Authorization header', async () => {
      // Arrange
      const fetchSpy = mockFetchAppointments();

      // Act
      render(<AppointmentsTable />);

      // Assert
      await waitFor(() => {
        const [, options] = fetchSpy.mock.calls[0];
        expect((options?.headers as Record<string, string>)['Authorization']).toBe(
          'Bearer test-jwt-token',
        );
      });
    });
  });

  describe('status styling', () => {
    it('highlights approved rows with green background', async () => {
      // Arrange
      mockFetchAppointments();

      // Act
      render(<AppointmentsTable />);

      // Assert — find the approved row and check for green class
      await waitFor(() => {
        const approvedRow = screen.getByText('John Doe').closest('tr');
        expect(approvedRow?.className).toContain('green');
      });
    });

    it('highlights declined rows with red background', async () => {
      // Arrange
      mockFetchAppointments();

      // Act
      render(<AppointmentsTable />);

      // Assert
      await waitFor(() => {
        const declinedRow = screen.getByText('Alice Brown').closest('tr');
        expect(declinedRow?.className).toContain('red');
      });
    });

    it('gives pending rows no status highlight', async () => {
      // Arrange
      mockFetchAppointments();

      // Act
      render(<AppointmentsTable />);

      // Assert
      await waitFor(() => {
        const pendingRow = screen.getByText('Jane Smith').closest('tr');
        expect(pendingRow?.className).not.toContain('green');
        expect(pendingRow?.className).not.toContain('red');
      });
    });
  });

  describe('empty state', () => {
    it('shows message when no appointments exist', async () => {
      // Arrange
      mockFetchAppointments([]);

      // Act
      render(<AppointmentsTable />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/no appointments/i)).toBeDefined();
      });
    });
  });

  describe('error state', () => {
    it('shows error message when fetch fails', async () => {
      // Arrange
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      // Act
      render(<AppointmentsTable />);

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText(/failed to load appointments/i)).toBeDefined();
      });
    });
  });
});

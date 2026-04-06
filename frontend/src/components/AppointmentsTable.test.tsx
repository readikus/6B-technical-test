import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

/** Render table, wait for data, return a row-lookup helper. */
async function renderTable() {
  mockFetchAppointments();
  render(<AppointmentsTable />);
  await waitFor(() => {
    expect(screen.getByText('Jane Smith')).toBeDefined();
  });
}

/** Get the action buttons within a given appointment row. */
function rowActions(name: string) {
  const row = screen.getByText(name).closest('tr')!;
  return within(row);
}

describe('AppointmentsTable', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearToken();
    setToken('test-jwt-token');
  });

  // ── Existing rendering tests ──────────────────────────────

  describe('loading state', () => {
    it('shows loading indicator while fetching', () => {
      // Arrange
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
        () => new Promise(() => {}),
      );

      // Act
      render(<AppointmentsTable />);

      // Assert
      expect(screen.getByText(/loading/i)).toBeDefined();
    });
  });

  describe('rendering data', () => {
    it('renders table headers including Actions', async () => {
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
        expect(screen.getByText('Actions')).toBeDefined();
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

      // Assert
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

  // ── New Phase 5: Action button tests ──────────────────────

  describe('action buttons', () => {
    it('shows Approve button for pending appointments', async () => {
      // Arrange & Act
      await renderTable();

      // Assert — Jane Smith is pending, should have Approve
      expect(rowActions('Jane Smith').getByRole('button', { name: /approve/i })).toBeDefined();
    });

    it('shows Decline button for approved appointments', async () => {
      // Arrange & Act
      await renderTable();

      // Assert — John Doe is approved, should have Decline
      expect(rowActions('John Doe').getByRole('button', { name: /decline/i })).toBeDefined();
    });

    it('shows Edit and Delete buttons for every row', async () => {
      // Arrange & Act
      await renderTable();

      // Assert
      for (const name of ['Jane Smith', 'John Doe', 'Alice Brown']) {
        const row = rowActions(name);
        expect(row.getByRole('button', { name: /edit/i })).toBeDefined();
        expect(row.getByRole('button', { name: /delete/i })).toBeDefined();
      }
    });
  });

  describe('approve action', () => {
    it('calls PATCH approve and updates row to green', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderTable();
      const approved = { ...mockAppointments[0], status: 'approved' };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(approved), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      // Act — click Approve on Jane Smith (pending)
      await user.click(rowActions('Jane Smith').getByRole('button', { name: /approve/i }));

      // Assert — row should now be green
      await waitFor(() => {
        const row = screen.getByText('Jane Smith').closest('tr');
        expect(row?.className).toContain('green');
      });
    });
  });

  describe('decline action', () => {
    it('calls PATCH decline and updates row to red', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderTable();
      const declined = { ...mockAppointments[1], status: 'declined' };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(declined), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      // Act — click Decline on John Doe (approved)
      await user.click(rowActions('John Doe').getByRole('button', { name: /decline/i }));

      // Assert — row should now be red
      await waitFor(() => {
        const row = screen.getByText('John Doe').closest('tr');
        expect(row?.className).toContain('red');
      });
    });
  });

  describe('delete action', () => {
    it('shows confirmation before deleting', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderTable();

      // Act — click Delete on Jane Smith
      await user.click(rowActions('Jane Smith').getByRole('button', { name: /delete/i }));

      // Assert — confirmation dialog appears
      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeDefined();
      });
    });

    it('removes row after confirmed delete', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderTable();
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, { status: 204 }),
      );

      // Act — click Delete then Confirm
      await user.click(rowActions('Jane Smith').getByRole('button', { name: /delete/i }));
      await user.click(screen.getByRole('button', { name: /confirm/i }));

      // Assert — Jane Smith row should be gone
      await waitFor(() => {
        expect(screen.queryByText('Jane Smith')).toBeNull();
      });
    });

    it('does not delete when cancelled', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderTable();

      // Act — click Delete then Cancel
      await user.click(rowActions('Jane Smith').getByRole('button', { name: /delete/i }));
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      // Assert — Jane Smith still present
      expect(screen.getByText('Jane Smith')).toBeDefined();
    });
  });

  describe('edit action', () => {
    it('opens edit modal with appointment data', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderTable();

      // Act — click Edit on Jane Smith
      await user.click(rowActions('Jane Smith').getByRole('button', { name: /edit/i }));

      // Assert — modal with pre-populated data
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /edit appointment/i })).toBeDefined();
        expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Jane Smith');
      });
    });

    it('updates table row after saving edit', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderTable();
      const updated = { ...mockAppointments[0], name: 'Jane Updated' };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(updated), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      // Act — open edit, change name, save
      await user.click(rowActions('Jane Smith').getByRole('button', { name: /edit/i }));
      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Jane Updated');
      await user.click(screen.getByRole('button', { name: /save/i }));

      // Assert — table shows updated name
      await waitFor(() => {
        expect(screen.getByText('Jane Updated')).toBeDefined();
        expect(screen.queryByText('Jane Smith')).toBeNull();
      });
    });

    it('closes modal on cancel without changes', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderTable();

      // Act — open edit, then cancel
      await user.click(rowActions('Jane Smith').getByRole('button', { name: /edit/i }));
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      // Assert — modal gone, data unchanged
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /edit appointment/i })).toBeNull();
      });
      expect(screen.getByText('Jane Smith')).toBeDefined();
    });
  });
});

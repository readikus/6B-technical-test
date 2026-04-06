import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EditModal from './EditModal';
import type { Appointment } from '../lib/types';

const appointment: Appointment = {
  id: '1',
  name: 'Jane Smith',
  email: 'jane@example.com',
  phone: '07700900123',
  description: 'Routine check-up',
  appointmentDate: '2026-04-10T09:00:00.000Z',
  status: 'pending',
  createdAt: '2026-04-01T10:00:00.000Z',
};

describe('EditModal', () => {
  const onClose = vi.fn();
  const onSaved = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    onClose.mockClear();
    onSaved.mockClear();
  });

  describe('rendering', () => {
    it('renders a heading', () => {
      // Arrange & Act
      render(<EditModal appointment={appointment} onClose={onClose} onSaved={onSaved} />);

      // Assert
      expect(screen.getByRole('heading', { name: /edit appointment/i })).toBeDefined();
    });

    it('pre-populates fields with appointment data', () => {
      // Arrange & Act
      render(<EditModal appointment={appointment} onClose={onClose} onSaved={onSaved} />);

      // Assert
      expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Jane Smith');
      expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe(
        'jane@example.com',
      );
      expect((screen.getByLabelText(/phone/i) as HTMLInputElement).value).toBe('07700900123');
      expect((screen.getByLabelText(/description/i) as HTMLTextAreaElement).value).toBe(
        'Routine check-up',
      );
    });

    it('renders save and cancel buttons', () => {
      // Arrange & Act
      render(<EditModal appointment={appointment} onClose={onClose} onSaved={onSaved} />);

      // Assert
      expect(screen.getByRole('button', { name: /save/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDefined();
    });
  });

  describe('cancel', () => {
    it('calls onClose when cancel is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<EditModal appointment={appointment} onClose={onClose} onSaved={onSaved} />);

      // Act
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      // Assert
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe('save', () => {
    it('sends updated data via PUT and calls onSaved', async () => {
      // Arrange
      const user = userEvent.setup();
      const updated = { ...appointment, name: 'Jane Updated' };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(updated), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      render(<EditModal appointment={appointment} onClose={onClose} onSaved={onSaved} />);

      // Act — clear name and type new value
      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Jane Updated');
      await user.click(screen.getByRole('button', { name: /save/i }));

      // Assert
      await waitFor(() => {
        expect(onSaved).toHaveBeenCalledOnce();
      });
    });

    it('sends correct PUT request body', async () => {
      // Arrange
      const user = userEvent.setup();
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(appointment), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      render(<EditModal appointment={appointment} onClose={onClose} onSaved={onSaved} />);

      // Act — change description
      const descInput = screen.getByLabelText(/description/i);
      await user.clear(descInput);
      await user.type(descInput, 'Updated reason');
      await user.click(screen.getByRole('button', { name: /save/i }));

      // Assert
      await waitFor(() => {
        const [url, options] = fetchSpy.mock.calls[0];
        expect(url).toContain('/api/appointments/1');
        expect(options?.method).toBe('PUT');
        const body = JSON.parse(options?.body as string);
        expect(body.description).toBe('Updated reason');
      });
    });

    it('shows validation errors for empty fields', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<EditModal appointment={appointment} onClose={onClose} onSaved={onSaved} />);

      // Act — clear name and submit
      await user.clear(screen.getByLabelText(/name/i));
      await user.click(screen.getByRole('button', { name: /save/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeDefined();
      });
    });

    it('shows API error message on failure', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Validation failed' }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      render(<EditModal appointment={appointment} onClose={onClose} onSaved={onSaved} />);

      // Act
      await user.click(screen.getByRole('button', { name: /save/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
      });
    });
  });
});

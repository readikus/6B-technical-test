import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BookingForm from './BookingForm';

function futureIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm for datetime-local
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
  await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');
  await user.type(screen.getByLabelText(/phone number/i), '07700900123');
  await user.type(screen.getByLabelText(/reason for appointment/i), 'Routine check-up');
  fireEvent.change(screen.getByLabelText(/preferred date/i), { target: { value: futureIso() } });
}

describe('BookingForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders all required fields with labels', () => {
      // Arrange & Act
      render(<BookingForm />);

      // Assert
      expect(screen.getByLabelText(/full name/i)).toBeDefined();
      expect(screen.getByLabelText(/email address/i)).toBeDefined();
      expect(screen.getByLabelText(/phone number/i)).toBeDefined();
      expect(screen.getByLabelText(/reason for appointment/i)).toBeDefined();
      expect(screen.getByLabelText(/preferred date/i)).toBeDefined();
    });

    it('renders a submit button', () => {
      // Arrange & Act
      render(<BookingForm />);

      // Assert
      expect(screen.getByRole('button', { name: /book appointment/i })).toBeDefined();
    });
  });

  describe('validation', () => {
    it('shows validation errors on empty submit', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<BookingForm />);

      // Act
      await user.click(screen.getByRole('button', { name: /book appointment/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeDefined();
        expect(screen.getByText(/email is required/i)).toBeDefined();
        expect(screen.getByText(/phone number is required/i)).toBeDefined();
        expect(screen.getByText(/description is required/i)).toBeDefined();
        expect(screen.getByText(/date and time are required/i)).toBeDefined();
      });
    });

    it('shows email format error', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<BookingForm />);

      // Act
      await user.type(screen.getByLabelText(/email address/i), 'bad');
      await user.click(screen.getByRole('button', { name: /book appointment/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeDefined();
      });
    });

    it('shows phone format error for too-short number', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<BookingForm />);

      // Act
      await user.type(screen.getByLabelText(/phone number/i), '123');
      await user.click(screen.getByRole('button', { name: /book appointment/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/phone number too short/i)).toBeDefined();
      });
    });
  });

  describe('submission', () => {
    it('calls API and shows success on valid submit', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ id: '1' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      render(<BookingForm />);

      // Act
      await fillForm(user);
      await user.click(screen.getByRole('button', { name: /book appointment/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/booked successfully/i)).toBeDefined();
      });
    });

    it('sends correct payload to API', async () => {
      // Arrange
      const user = userEvent.setup();
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ id: '1' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      render(<BookingForm />);

      // Act
      await fillForm(user);
      await user.click(screen.getByRole('button', { name: /book appointment/i }));

      // Assert
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledOnce();
        const [url, options] = fetchSpy.mock.calls[0];
        expect(url).toContain('/api/appointments');
        expect(options?.method).toBe('POST');
        const body = JSON.parse(options?.body as string);
        expect(body.name).toBe('Jane Smith');
        expect(body.email).toBe('jane@example.com');
        expect(body.phone).toBe('07700900123');
        expect(body.date_time).toBeDefined();
      });
    });

    it('shows error alert on API failure', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Validation failed' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      render(<BookingForm />);

      // Act
      await fillForm(user);
      await user.click(screen.getByRole('button', { name: /book appointment/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
      });
    });

    it('shows error alert on network failure', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
      render(<BookingForm />);

      // Act
      await fillForm(user);
      await user.click(screen.getByRole('button', { name: /book appointment/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
      });
    });

    it('disables button while submitting', async () => {
      // Arrange
      const user = userEvent.setup();
      let resolve: (v: Response) => void;
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
        () => new Promise((r) => { resolve = r; }),
      );
      render(<BookingForm />);

      // Act
      await fillForm(user);
      await user.click(screen.getByRole('button', { name: /book appointment/i }));

      // Assert
      expect(
        (screen.getByRole('button', { name: /submitting/i }) as HTMLButtonElement).disabled,
      ).toBe(true);

      // Cleanup
      resolve!(new Response(JSON.stringify({ id: '1' }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    });

    it('resets form after successful submission', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ id: '1' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      render(<BookingForm />);

      // Act
      await fillForm(user);
      await user.click(screen.getByRole('button', { name: /book appointment/i }));

      // Assert
      await waitFor(() => {
        expect((screen.getByLabelText(/full name/i) as HTMLInputElement).value).toBe('');
      });
    });
  });
});

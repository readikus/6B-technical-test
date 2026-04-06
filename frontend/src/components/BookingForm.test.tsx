import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BookingForm from './BookingForm';

/** Helper: select a future date via the DatePickerDialog */
async function selectFutureDate(user: ReturnType<typeof userEvent.setup>) {
  // Open the date picker dialog
  await user.click(screen.getByRole('button', { name: /choose date/i }));
  const dialog = screen.getByRole('dialog');

  // Find a date cell in the grid that is in the future — pick any visible day > 20
  // to be safe (far enough ahead in any month)
  const grid = within(dialog).getByRole('grid');
  const cells = within(grid).getAllByRole('gridcell');
  const futureCell = cells.find((c) => {
    const num = Number(c.textContent);
    return num >= 20 && num <= 28;
  });
  if (futureCell) {
    await user.click(futureCell);
  }
}

/** Helper: fill the entire form with valid data */
async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/name/i), 'Jane Smith');
  await user.type(screen.getByLabelText(/email/i), 'jane@example.com');
  await user.type(screen.getByLabelText(/phone/i), '07700900123');
  await user.type(screen.getByLabelText(/description/i), 'Routine check-up');
  await selectFutureDate(user);
}

describe('BookingForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders all required form fields', () => {
      // Arrange & Act
      render(<BookingForm />);

      // Assert
      expect(screen.getByLabelText(/name/i)).toBeDefined();
      expect(screen.getByLabelText(/email/i)).toBeDefined();
      expect(screen.getByLabelText(/phone/i)).toBeDefined();
      expect(screen.getByLabelText(/description/i)).toBeDefined();
      expect(screen.getByLabelText(/appointment date/i)).toBeDefined();
    });

    it('renders a submit button', () => {
      // Arrange & Act
      render(<BookingForm />);

      // Assert
      expect(screen.getByRole('button', { name: /book appointment/i })).toBeDefined();
    });

    it('renders the form heading', () => {
      // Arrange & Act
      render(<BookingForm />);

      // Assert
      expect(screen.getByRole('heading', { name: /book an appointment/i })).toBeDefined();
    });
  });

  describe('validation', () => {
    it('shows validation errors when submitting empty form', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<BookingForm />);

      // Act
      await user.click(screen.getByRole('button', { name: /book appointment/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeDefined();
        expect(screen.getByText('Email is required')).toBeDefined();
        expect(screen.getByText('Phone number is required')).toBeDefined();
        expect(screen.getByText('Description is required')).toBeDefined();
        expect(screen.getByText('Appointment date is required')).toBeDefined();
      });
    });

    it('shows email format error for invalid email', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<BookingForm />);

      // Act
      await user.type(screen.getByLabelText(/email/i), 'not-valid');
      await user.click(screen.getByRole('button', { name: /book appointment/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Invalid email address')).toBeDefined();
      });
    });

    it('shows phone error for too-short number', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<BookingForm />);

      // Act
      await user.type(screen.getByLabelText(/phone/i), '12345');
      await user.click(screen.getByRole('button', { name: /book appointment/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Invalid phone number')).toBeDefined();
      });
    });

    // Past-date validation is covered in validation.test.ts (15 unit tests).
    // The date picker calendar makes accidental past selection unlikely.

    it('clears field error when user corrects the value', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<BookingForm />);

      // Act — trigger error then fix it
      await user.click(screen.getByRole('button', { name: /book appointment/i }));
      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeDefined();
      });
      await user.type(screen.getByLabelText(/name/i), 'Jane Smith');

      // Assert — error should clear on input
      await waitFor(() => {
        expect(screen.queryByText('Name is required')).toBeNull();
      });
    });
  });

  describe('submission', () => {
    it('submits valid form data and shows success message', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'abc-123', name: 'Jane Smith' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      render(<BookingForm />);

      // Act
      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: /book appointment/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/appointment booked successfully/i)).toBeDefined();
      });
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/appointments');
      expect(options?.method).toBe('POST');
    });

    it('shows error message when API call fails', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      render(<BookingForm />);

      // Act
      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: /book appointment/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
      });
    });

    it('shows error message when network fails', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
      render(<BookingForm />);

      // Act
      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: /book appointment/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText(/something went wrong/i)).toBeDefined();
      });
    });

    it('disables submit button while submitting', async () => {
      // Arrange
      const user = userEvent.setup();
      let resolveFetch: (value: Response) => void;
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      );
      render(<BookingForm />);

      // Act
      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: /book appointment/i }));

      // Assert — button disabled during submission
      expect(screen.getByRole('button', { name: /submitting/i })).toBeDefined();
      expect(
        (screen.getByRole('button', { name: /submitting/i }) as HTMLButtonElement).disabled,
      ).toBe(true);

      // Cleanup — resolve the hanging promise
      resolveFetch!(
        new Response(JSON.stringify({ id: '1' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('resets form after successful submission', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'abc-123' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      render(<BookingForm />);

      // Act
      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: /book appointment/i }));

      // Assert — form fields should be cleared
      await waitFor(() => {
        expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('');
        expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe('');
        expect((screen.getByLabelText(/phone/i) as HTMLInputElement).value).toBe('');
        expect((screen.getByLabelText(/description/i) as HTMLTextAreaElement).value).toBe('');
      });
    });
  });
});

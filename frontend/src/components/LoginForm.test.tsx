import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginForm from './LoginForm';
import { getToken, clearToken } from '../lib/auth';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockPush = vi.fn();

describe('LoginForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearToken();
    mockPush.mockClear();
  });

  describe('rendering', () => {
    it('renders email and password fields', () => {
      // Arrange & Act
      render(<LoginForm />);

      // Assert
      expect(screen.getByLabelText(/email/i)).toBeDefined();
      expect(screen.getByLabelText(/password/i)).toBeDefined();
    });

    it('renders a sign in button', () => {
      // Arrange & Act
      render(<LoginForm />);

      // Assert
      expect(screen.getByRole('button', { name: /sign in/i })).toBeDefined();
    });
  });

  describe('validation', () => {
    it('shows error when email is empty', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<LoginForm />);

      // Act
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeDefined();
      });
    });

    it('shows error when password is empty', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<LoginForm />);

      // Act
      await user.type(screen.getByLabelText(/email/i), 'admin@sixbee.com');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeDefined();
      });
    });
  });

  describe('submission', () => {
    it('sends credentials and stores JWT on success', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'jwt-abc-123' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      render(<LoginForm />);

      // Act
      await user.type(screen.getByLabelText(/email/i), 'admin@sixbee.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Assert
      await waitFor(() => {
        expect(getToken()).toBe('jwt-abc-123');
      });
    });

    it('redirects to /admin after successful login', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'jwt-abc-123' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      render(<LoginForm />);

      // Act
      await user.type(screen.getByLabelText(/email/i), 'admin@sixbee.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Assert
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin');
      });
    });

    it('sends correct request body', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      render(<LoginForm />);

      // Act
      await user.type(screen.getByLabelText(/email/i), 'admin@sixbee.com');
      await user.type(screen.getByLabelText(/password/i), 'secret');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Assert
      await waitFor(() => {
        const [url, options] = mockFetch.mock.calls[0];
        expect(url).toContain('/api/auth/login');
        expect(options?.method).toBe('POST');
        expect(JSON.parse(options?.body as string)).toEqual({
          email: 'admin@sixbee.com',
          password: 'secret',
        });
      });
    });

    it('shows error on 401 Unauthorized', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Invalid credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      render(<LoginForm />);

      // Act
      await user.type(screen.getByLabelText(/email/i), 'admin@sixbee.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpass');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText(/invalid credentials/i)).toBeDefined();
      });
    });

    it('shows error on network failure', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
      render(<LoginForm />);

      // Act
      await user.type(screen.getByLabelText(/email/i), 'admin@sixbee.com');
      await user.type(screen.getByLabelText(/password/i), 'password');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText(/something went wrong/i)).toBeDefined();
      });
    });

    it('disables button while submitting', async () => {
      // Arrange
      const user = userEvent.setup();
      let resolveFetch: (value: Response) => void;
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
        () => new Promise((resolve) => { resolveFetch = resolve; }),
      );
      render(<LoginForm />);

      // Act
      await user.type(screen.getByLabelText(/email/i), 'admin@sixbee.com');
      await user.type(screen.getByLabelText(/password/i), 'password');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Assert
      expect(
        (screen.getByRole('button', { name: /signing in/i }) as HTMLButtonElement).disabled,
      ).toBe(true);

      // Cleanup
      resolveFetch!(
        new Response(JSON.stringify({ access_token: 't' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
  });
});

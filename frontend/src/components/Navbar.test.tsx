import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Navbar from './Navbar';
import { setToken, clearToken, getToken } from '../lib/auth';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockPush = vi.fn();

describe('Navbar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearToken();
    mockPush.mockClear();
  });

  it('renders the app title', () => {
    // Arrange & Act
    setToken('token');
    render(<Navbar />);

    // Assert
    expect(screen.getByText(/sixbee healthtech/i)).toBeDefined();
  });

  it('renders a logout button', () => {
    // Arrange
    setToken('token');

    // Act
    render(<Navbar />);

    // Assert
    expect(screen.getByRole('button', { name: /logout/i })).toBeDefined();
  });

  it('clears token on logout', async () => {
    // Arrange
    const user = userEvent.setup();
    setToken('my-token');
    render(<Navbar />);

    // Act
    await user.click(screen.getByRole('button', { name: /logout/i }));

    // Assert
    expect(getToken()).toBeNull();
  });

  it('redirects to login page after logout', async () => {
    // Arrange
    const user = userEvent.setup();
    setToken('my-token');
    render(<Navbar />);

    // Act
    await user.click(screen.getByRole('button', { name: /logout/i }));

    // Assert
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/login');
    });
  });

  it('shows Appointments nav link', () => {
    // Arrange
    setToken('token');

    // Act
    render(<Navbar />);

    // Assert
    expect(screen.getByText(/appointments/i)).toBeDefined();
  });
});

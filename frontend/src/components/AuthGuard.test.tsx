import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuthGuard from './AuthGuard';
import { setToken, clearToken } from '../lib/auth';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('AuthGuard', () => {
  beforeEach(() => {
    clearToken();
    mockPush.mockClear();
  });

  it('redirects to login when not authenticated', async () => {
    // Arrange — no token

    // Act
    render(
      <AuthGuard>
        <p>Protected content</p>
      </AuthGuard>,
    );

    // Assert
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/login');
    });
    expect(screen.queryByText('Protected content')).toBeNull();
  });

  it('renders children when authenticated', async () => {
    // Arrange
    setToken('valid-token');

    // Act
    render(
      <AuthGuard>
        <p>Protected content</p>
      </AuthGuard>,
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Protected content')).toBeDefined();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});

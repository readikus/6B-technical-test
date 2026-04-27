import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminLoginPage from './page';

const mockPush = vi.fn();
const mockLogin = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/admin/login',
}));

vi.mock('@/lib/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useAuth: () => ({
    token: null,
    isAuthenticated: false,
    isLoading: false,
    login: mockLogin,
    logout: vi.fn(),
  }),
}));

describe('AdminLoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form with email and password fields', () => {
    // Arrange & Act
    render(<AdminLoginPage />);

    // Assert
    expect(
      screen.getByRole('heading', { name: 'Admin Login' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Sign in' }),
    ).toBeInTheDocument();
  });

  it('marks required fields with aria-required', () => {
    // Arrange & Act
    render(<AdminLoginPage />);

    // Assert
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-required',
      'true',
    );
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'aria-required',
      'true',
    );
  });

  it('shows validation error for invalid email', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<AdminLoginPage />);

    // Act
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    // Assert
    const errorMsg = await screen.findByText('Please enter a valid email address', {}, { timeout: 3000 });
    expect(errorMsg).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows validation error for empty password', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<AdminLoginPage />);

    // Act
    await user.type(screen.getByLabelText('Email'), 'admin@test.com');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('calls login with valid credentials', async () => {
    // Arrange
    const user = userEvent.setup();
    mockLogin.mockResolvedValue(undefined);
    render(<AdminLoginPage />);

    // Act
    await user.type(screen.getByLabelText('Email'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    // Assert
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@test.com', 'password123');
    });
  });

  it('displays error message on login failure', async () => {
    // Arrange
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    render(<AdminLoginPage />);

    // Act
    await user.type(screen.getByLabelText('Email'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    // Assert
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Invalid credentials',
      );
    });
  });

  it('disables submit button while submitting', async () => {
    // Arrange
    const user = userEvent.setup();
    let resolveLogin: () => void;
    mockLogin.mockImplementation(
      () => new Promise<void>((resolve) => { resolveLogin = resolve; }),
    );
    render(<AdminLoginPage />);

    // Act
    await user.type(screen.getByLabelText('Email'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    // Assert
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    });

    resolveLogin!();
  });

  it('has accessible form with aria-label', () => {
    // Arrange & Act
    render(<AdminLoginPage />);

    // Assert
    expect(screen.getByRole('form', { name: 'Login form' })).toBeInTheDocument();
  });
});

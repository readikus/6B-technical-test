import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppointmentsTable } from './appointments-table';
import type { ApiAppointment } from '@/lib/api';

function makeAppointment(
  overrides: Partial<ApiAppointment> = {},
): ApiAppointment {
  return {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+447700900000',
    description: 'Annual check-up',
    date_time: '2026-12-15T10:00:00.000Z',
    status: 'pending',
    metadata: {},
    created_at: '2026-04-06T12:00:00.000Z',
    updated_at: '2026-04-06T12:00:00.000Z',
    ...overrides,
  };
}

describe('AppointmentsTable', () => {
  it('renders empty state when no appointments', () => {
    // Arrange
    const onApprove = vi.fn();
    const onDelete = vi.fn();

    // Act
    render(
      <AppointmentsTable
        appointments={[]}
        onApprove={onApprove}
        onDelete={onDelete}
      />,
    );

    // Assert
    expect(screen.getByText('No appointments found.')).toBeInTheDocument();
  });

  it('renders appointment data in table columns', () => {
    // Arrange
    const appointment = makeAppointment();

    // Act
    render(
      <AppointmentsTable
        appointments={[appointment]}
        onApprove={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Annual check-up')).toBeInTheDocument();
    expect(screen.getByText('+447700900000')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    // Arrange & Act
    render(
      <AppointmentsTable
        appointments={[makeAppointment()]}
        onApprove={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Date & Time')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('highlights confirmed rows with green background', () => {
    // Arrange
    const confirmed = makeAppointment({
      id: 'confirmed-id',
      status: 'confirmed',
      name: 'Confirmed Patient',
    });
    const pending = makeAppointment({
      id: 'pending-id',
      status: 'pending',
      name: 'Pending Patient',
    });

    // Act
    render(
      <AppointmentsTable
        appointments={[confirmed, pending]}
        onApprove={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Assert
    const confirmedRow = screen.getByText('Confirmed Patient').closest('tr');
    const pendingRow = screen.getByText('Pending Patient').closest('tr');

    expect(confirmedRow?.className).toContain('bg-green-50');
    expect(pendingRow?.className).not.toContain('bg-green-50');
  });

  it('disables approve button for confirmed appointments', () => {
    // Arrange
    const confirmed = makeAppointment({ status: 'confirmed' });

    // Act
    render(
      <AppointmentsTable
        appointments={[confirmed]}
        onApprove={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Assert
    const approveBtn = screen.getByLabelText(
      'Approve appointment for Jane Smith',
    );
    expect(approveBtn).toBeDisabled();
  });

  it('calls onApprove when approve button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const appointment = makeAppointment();

    // Act
    render(
      <AppointmentsTable
        appointments={[appointment]}
        onApprove={onApprove}
        onDelete={vi.fn()}
      />,
    );
    await user.click(
      screen.getByLabelText('Approve appointment for Jane Smith'),
    );

    // Assert
    expect(onApprove).toHaveBeenCalledWith(appointment.id);
  });

  it('calls onDelete with confirmation dialog', async () => {
    // Arrange
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const appointment = makeAppointment();
    window.confirm = vi.fn(() => true);

    // Act
    render(
      <AppointmentsTable
        appointments={[appointment]}
        onApprove={vi.fn()}
        onDelete={onDelete}
      />,
    );
    await user.click(
      screen.getByLabelText('Delete appointment for Jane Smith'),
    );

    // Assert
    expect(window.confirm).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith(appointment.id);
  });

  it('does not call onDelete when confirmation is cancelled', async () => {
    // Arrange
    const user = userEvent.setup();
    const onDelete = vi.fn();
    window.confirm = vi.fn(() => false);

    // Act
    render(
      <AppointmentsTable
        appointments={[makeAppointment()]}
        onApprove={vi.fn()}
        onDelete={onDelete}
      />,
    );
    await user.click(
      screen.getByLabelText('Delete appointment for Jane Smith'),
    );

    // Assert
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('renders multiple appointments', () => {
    // Arrange
    const appointments = [
      makeAppointment({ id: '1', name: 'Alice' }),
      makeAppointment({ id: '2', name: 'Bob' }),
      makeAppointment({ id: '3', name: 'Charlie' }),
    ];

    // Act
    render(
      <AppointmentsTable
        appointments={appointments}
        onApprove={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });
});

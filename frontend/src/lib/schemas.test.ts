import { describe, it, expect } from 'vitest';
import { bookingSchema } from './schemas';

describe('bookingSchema', () => {
  function futureIso(): string {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString();
  }

  const valid = {
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '07700900123',
    description: 'Routine check-up',
    date_time: futureIso(),
  };

  it('accepts valid input', () => {
    // Arrange
    const data = { ...valid };

    // Act
    const result = bookingSchema.safeParse(data);

    // Assert
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    // Arrange
    const data = { ...valid, name: '' };

    // Act
    const result = bookingSchema.safeParse(data);

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    // Arrange
    const data = { ...valid, email: 'not-an-email' };

    // Act
    const result = bookingSchema.safeParse(data);

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects short phone', () => {
    // Arrange
    const data = { ...valid, phone: '123' };

    // Act
    const result = bookingSchema.safeParse(data);

    // Assert
    expect(result.success).toBe(false);
  });

  it('accepts phone with spaces and dashes', () => {
    // Arrange
    const data = { ...valid, phone: '+44 7700 900-123' };

    // Act
    const result = bookingSchema.safeParse(data);

    // Assert
    expect(result.success).toBe(true);
  });

  it('rejects empty description', () => {
    // Arrange
    const data = { ...valid, description: '' };

    // Act
    const result = bookingSchema.safeParse(data);

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects past date_time', () => {
    // Arrange
    const data = { ...valid, date_time: '2020-01-01T09:00:00.000Z' };

    // Act
    const result = bookingSchema.safeParse(data);

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects empty date_time', () => {
    // Arrange
    const data = { ...valid, date_time: '' };

    // Act
    const result = bookingSchema.safeParse(data);

    // Assert
    expect(result.success).toBe(false);
  });
});

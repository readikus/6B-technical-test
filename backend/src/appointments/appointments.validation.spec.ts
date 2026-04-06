import {
  createAppointmentSchema,
  updateAppointmentSchema,
} from './appointments.validation';

const valid = {
  name: 'Jane Smith',
  email: 'jane.smith@example.com',
  phone: '+447700900000',
  description: 'Annual health check-up',
  date_time: '2026-12-15T10:00:00.000Z',
};

describe('createAppointmentSchema', () => {
  it('accepts a valid appointment', () => {
    // Arrange / Act
    const result = createAppointmentSchema.safeParse(valid);

    // Assert
    expect(result.success).toBe(true);
  });

  it('rejects when name is missing', () => {
    // Arrange
    const { name: _, ...payload } = valid;

    // Act
    const result = createAppointmentSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects when email is missing', () => {
    // Arrange
    const { email: _, ...payload } = valid;

    // Act
    const result = createAppointmentSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects when phone is missing', () => {
    // Arrange
    const { phone: _, ...payload } = valid;

    // Act
    const result = createAppointmentSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects when description is missing', () => {
    // Arrange
    const { description: _, ...payload } = valid;

    // Act
    const result = createAppointmentSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects when date_time is missing', () => {
    // Arrange
    const { date_time: _, ...payload } = valid;

    // Act
    const result = createAppointmentSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email format', () => {
    // Arrange
    const payload = { ...valid, email: 'not-an-email' };

    // Act
    const result = createAppointmentSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid email format');
    }
  });

  it('rejects a phone number that is too short', () => {
    // Arrange
    const payload = { ...valid, phone: '123' };

    // Act
    const result = createAppointmentSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects a phone number with letters', () => {
    // Arrange
    const payload = { ...valid, phone: 'abc' };

    // Act
    const result = createAppointmentSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it('accepts phone numbers in various valid formats', () => {
    // Arrange
    const phones = [
      '+447700900000',
      '+44 7700 900000',
      '07700 900000',
      '+1-555-123-4567',
      '(555) 123-4567',
    ];

    // Act / Assert
    for (const phone of phones) {
      const result = createAppointmentSchema.safeParse({ ...valid, phone });
      expect(result.success).toBe(true);
    }
  });

  it('rejects an invalid datetime format', () => {
    // Arrange
    const payload = { ...valid, date_time: 'next tuesday' };

    // Act
    const result = createAppointmentSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects name containing a script tag (XSS)', () => {
    // Arrange
    const payload = { ...valid, name: '<script>alert("xss")</script>' };

    // Act
    const result = createAppointmentSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('HTML tags are not allowed');
    }
  });

  it('rejects description containing an img tag (XSS)', () => {
    // Arrange
    const payload = {
      ...valid,
      description: '<img src=x onerror=alert(1)>',
    };

    // Act
    const result = createAppointmentSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it('allows strings with angle brackets that are not HTML tags', () => {
    // Arrange — math comparison, not an HTML tag
    const payload = { ...valid, description: 'Blood pressure < 120/80' };

    // Act
    const result = createAppointmentSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(true);
  });

  it('rejects an empty body', () => {
    // Arrange / Act
    const result = createAppointmentSchema.safeParse({});

    // Assert
    expect(result.success).toBe(false);
  });
});

describe('updateAppointmentSchema', () => {
  it('accepts a partial update with just name', () => {
    // Arrange / Act
    const result = updateAppointmentSchema.safeParse({ name: 'Updated' });

    // Assert
    expect(result.success).toBe(true);
  });

  it('accepts a status update', () => {
    // Arrange / Act
    const result = updateAppointmentSchema.safeParse({ status: 'confirmed' });

    // Assert
    expect(result.success).toBe(true);
  });

  it('rejects an invalid status value', () => {
    // Arrange / Act
    const result = updateAppointmentSchema.safeParse({ status: 'invalid' });

    // Assert
    expect(result.success).toBe(false);
  });

  it('validates email format when email is provided', () => {
    // Arrange / Act
    const result = updateAppointmentSchema.safeParse({ email: 'bad' });

    // Assert
    expect(result.success).toBe(false);
  });

  it('accepts an empty body (no fields required)', () => {
    // Arrange / Act
    const result = updateAppointmentSchema.safeParse({});

    // Assert
    expect(result.success).toBe(true);
  });

  it('rejects HTML tags in updated name', () => {
    // Arrange / Act
    const result = updateAppointmentSchema.safeParse({
      name: '<b>bold</b>',
    });

    // Assert
    expect(result.success).toBe(false);
  });
});

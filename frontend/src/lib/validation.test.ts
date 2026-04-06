import { describe, it, expect } from 'vitest';
import { validateBookingForm, type BookingFormData, type ValidationErrors } from './validation';

describe('validateBookingForm', () => {
  const validForm: BookingFormData = {
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '07700900123',
    description: 'Routine check-up appointment',
    appointmentDate: getFutureDate(),
  };

  function getFutureDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
  }

  it('returns no errors for valid input', () => {
    // Arrange
    const data = { ...validForm };

    // Act
    const errors = validateBookingForm(data);

    // Assert
    expect(errors).toEqual({});
  });

  describe('name validation', () => {
    it('returns error when name is empty', () => {
      // Arrange
      const data = { ...validForm, name: '' };

      // Act
      const errors = validateBookingForm(data);

      // Assert
      expect(errors.name).toBe('Name is required');
    });

    it('returns error when name is only whitespace', () => {
      // Arrange
      const data = { ...validForm, name: '   ' };

      // Act
      const errors = validateBookingForm(data);

      // Assert
      expect(errors.name).toBe('Name is required');
    });
  });

  describe('email validation', () => {
    it('returns error when email is empty', () => {
      // Arrange
      const data = { ...validForm, email: '' };

      // Act
      const errors = validateBookingForm(data);

      // Assert
      expect(errors.email).toBe('Email is required');
    });

    it('returns error for invalid email format', () => {
      // Arrange
      const data = { ...validForm, email: 'not-an-email' };

      // Act
      const errors = validateBookingForm(data);

      // Assert
      expect(errors.email).toBe('Invalid email address');
    });

    it('accepts valid email formats', () => {
      // Arrange
      const data = { ...validForm, email: 'user@domain.co.uk' };

      // Act
      const errors = validateBookingForm(data);

      // Assert
      expect(errors.email).toBeUndefined();
    });
  });

  describe('phone validation', () => {
    it('returns error when phone is empty', () => {
      // Arrange
      const data = { ...validForm, phone: '' };

      // Act
      const errors = validateBookingForm(data);

      // Assert
      expect(errors.phone).toBe('Phone number is required');
    });

    it('returns error for phone with fewer than 10 digits', () => {
      // Arrange
      const data = { ...validForm, phone: '12345' };

      // Act
      const errors = validateBookingForm(data);

      // Assert
      expect(errors.phone).toBe('Invalid phone number');
    });

    it('accepts phone with spaces and dashes', () => {
      // Arrange
      const data = { ...validForm, phone: '077 009-00123' };

      // Act
      const errors = validateBookingForm(data);

      // Assert
      expect(errors.phone).toBeUndefined();
    });

    it('accepts phone with + prefix', () => {
      // Arrange
      const data = { ...validForm, phone: '+447700900123' };

      // Act
      const errors = validateBookingForm(data);

      // Assert
      expect(errors.phone).toBeUndefined();
    });
  });

  describe('description validation', () => {
    it('returns error when description is empty', () => {
      // Arrange
      const data = { ...validForm, description: '' };

      // Act
      const errors = validateBookingForm(data);

      // Assert
      expect(errors.description).toBe('Description is required');
    });
  });

  describe('appointmentDate validation', () => {
    it('returns error when date is empty', () => {
      // Arrange
      const data = { ...validForm, appointmentDate: '' };

      // Act
      const errors = validateBookingForm(data);

      // Assert
      expect(errors.appointmentDate).toBe('Appointment date is required');
    });

    it('returns error when date is in the past', () => {
      // Arrange
      const data = { ...validForm, appointmentDate: '2020-01-01T09:00' };

      // Act
      const errors = validateBookingForm(data);

      // Assert
      expect(errors.appointmentDate).toBe('Appointment must be in the future');
    });

    it('accepts a future date', () => {
      // Arrange
      const data = { ...validForm };

      // Act
      const errors = validateBookingForm(data);

      // Assert
      expect(errors.appointmentDate).toBeUndefined();
    });
  });

  it('returns multiple errors when multiple fields are invalid', () => {
    // Arrange
    const data: BookingFormData = {
      name: '',
      email: 'bad',
      phone: '',
      description: '',
      appointmentDate: '',
    };

    // Act
    const errors = validateBookingForm(data);

    // Assert
    expect(Object.keys(errors).length).toBe(5);
    expect(errors.name).toBeDefined();
    expect(errors.email).toBeDefined();
    expect(errors.phone).toBeDefined();
    expect(errors.description).toBeDefined();
    expect(errors.appointmentDate).toBeDefined();
  });
});

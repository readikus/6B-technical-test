export interface BookingFormData {
  name: string;
  email: string;
  phone: string;
  description: string;
  appointmentDate: string;
}

export type ValidationErrors = Partial<Record<keyof BookingFormData, string>>;

export function validateBookingForm(data: BookingFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  // Name
  if (!data.name.trim()) {
    errors.name = 'Name is required';
  }

  // Email
  if (!data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Invalid email address';
  }

  // Phone — strip spaces/dashes, expect 10+ digits (with optional + prefix)
  if (!data.phone.trim()) {
    errors.phone = 'Phone number is required';
  } else {
    const digits = data.phone.replace(/[\s\-()]+/g, '');
    const phonePattern = /^\+?\d{10,15}$/;
    if (!phonePattern.test(digits)) {
      errors.phone = 'Invalid phone number';
    }
  }

  // Description
  if (!data.description.trim()) {
    errors.description = 'Description is required';
  }

  // Appointment date
  if (!data.appointmentDate) {
    errors.appointmentDate = 'Appointment date is required';
  } else if (new Date(data.appointmentDate) <= new Date()) {
    errors.appointmentDate = 'Appointment must be in the future';
  }

  return errors;
}

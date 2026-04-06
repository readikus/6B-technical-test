import { z } from 'zod';

/**
 * Client-side booking schema — mirrors the backend Zod schema
 * in appointments.validation.ts so validation errors match.
 */
export const bookingSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .min(7, 'Phone number too short')
    .regex(/^\+?[\d\s\-()]+$/, 'Enter a valid phone number'),
  description: z.string().min(1, 'Description is required'),
  date_time: z
    .string()
    .min(1, 'Date and time are required')
    .refine(
      (val) => {
        const d = new Date(val);
        return !isNaN(d.getTime()) && d > new Date();
      },
      { message: 'Appointment must be in the future' },
    ),
});

export type BookingFormData = z.infer<typeof bookingSchema>;

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

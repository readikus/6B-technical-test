import { z } from 'zod';

const noHtmlTags = (val: string) => !/<[a-zA-Z][^>]*>/.test(val);
const htmlTagMessage = 'HTML tags are not allowed';

export const createAppointmentSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .refine(noHtmlTags, htmlTagMessage),
  email: z.string().email('Invalid email format'),
  phone: z
    .string()
    .min(7, 'Phone number too short')
    .regex(/^\+?[\d\s\-()]+$/, 'Invalid phone format'),
  description: z
    .string()
    .min(1, 'Description is required')
    .refine(noHtmlTags, htmlTagMessage),
  date_time: z.string().datetime('Invalid datetime format'),
});

export const updateAppointmentSchema = createAppointmentSchema
  .partial()
  .extend({
    status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
  });

export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentDto = z.infer<typeof updateAppointmentSchema>;

import { z } from 'zod';

export const AttendeeSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  responseStatus: z.string().optional(),
});

export const ReminderSchema = z.object({
  method: z.enum(['popup', 'email']),
  minutes: z.number().int().min(0),
});

export const GetEventsQuerySchema = z.object({
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  calendar_ids: z.string().optional(),
}).refine(
  (d) => {
    const start = new Date(d.start);
    const end = new Date(d.end);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 90 && diffDays >= 0;
  },
  { message: 'Date range must be between 0 and 90 days' },
);

export const CreateEventSchema = z
  .object({
    calendar_id: z.string().uuid(),
    title: z.string().min(1),
    start_at: z.string().datetime({ offset: true }).optional(),
    end_at: z.string().datetime({ offset: true }).optional(),
    is_all_day: z.boolean().optional().default(false),
    recurrence_rule: z.string().optional(),
    attendees: z.array(AttendeeSchema).optional().default([]),
    reminders: z.array(ReminderSchema).optional().default([]),
  })
  .refine((d) => d.is_all_day || (d.start_at !== undefined && d.end_at !== undefined), {
    message: 'start_at and end_at are required unless is_all_day is true',
    path: ['start_at'],
  });

export const UpdateEventSchema = z
  .object({
    title: z.string().min(1).optional(),
    start_at: z.string().datetime({ offset: true }).optional(),
    end_at: z.string().datetime({ offset: true }).optional(),
    is_all_day: z.boolean().optional(),
    recurrence_rule: z.string().optional(),
    attendees: z.array(AttendeeSchema).optional(),
    reminders: z.array(ReminderSchema).optional(),
  });

export const DuplicateEventSchema = z.object({
  target_calendar_id: z.string().uuid().optional(),
  title_prefix: z.string().optional(),
});

export const DeleteScopeSchema = z
  .enum(['this', 'this_and_following', 'all'])
  .default('this');

export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
export type DuplicateEventInput = z.infer<typeof DuplicateEventSchema>;
export type DeleteScope = z.infer<typeof DeleteScopeSchema>;

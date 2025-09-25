import { z } from 'zod';

// Simplified email schema
export const EmailMessageSchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  from: z.string(),
  body: z.string(),
  timestamp: z.date().optional(),
  threadId: z.string().optional(),
});

// Simplified intent schema
export const EmailIntentSchema = z.object({
  intent: z.enum(['reply', 'meeting', 'archive', 'human_review']),
  reasoning: z.string(),
});

export type EmailMessage = z.infer<typeof EmailMessageSchema>;
export type EmailIntent = z.infer<typeof EmailIntentSchema>;
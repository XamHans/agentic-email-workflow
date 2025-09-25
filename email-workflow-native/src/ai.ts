// src/ai.ts
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import * as dotenv from 'dotenv';
import { z } from 'zod';
import logger from './logger';

dotenv.config({ path: '../.env' });

// Replace with your preferred provider
const openai = createOpenAI();

// Schema for detecting the primary intent
export const intentSchema = z.object({
  intent: z
    .enum(['reply', 'meeting', 'archive', 'human_review'])
    .describe('The primary intent of the email.'),
  emailType: z
    .enum([
      'personal',
      'newsletter',
      'transactional',
      'promotional',
      'notification',
      'meeting_invite',
    ])
    .describe('The type of email to help determine appropriate actions.'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence level in the intent classification (0-1).'),
});

// Schema for generating a reply
export const replySchema = z.object({
  subject: z.string().describe('The subject of the reply email.'),
  body: z.string().describe('The body of the reply email.'),
});

// Schema for extracting meeting details
export const meetingSchema = z.object({
  title: z.string().describe('The title of the meeting.'),
  // Use ISO 8601 string format for JSON Schema compatibility
  dateTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/).describe('Meeting time as ISO 8601 string (e.g., "2025-09-30T10:00:00Z")'),
  durationMinutes: z
    .number()
    .min(15)
    .max(480)
    .describe('The duration of the meeting in minutes (15-480 minutes).'),
});

export async function getEmailIntent(
  content: string,
  emailSubject?: string,
  senderEmail?: string
) {
  logger.info('Detecting email intent...');
  const currentDate = new Date().toISOString();

  return generateObject({
    model: openai('gpt-4o-mini'),
    schema: intentSchema,
    prompt: `Analyze the following email and determine the appropriate intent and email type.

Current date/time: ${currentDate}

RULES FOR INTENT CLASSIFICATION:
1. MEETING: Only for emails requesting/proposing future meetings or appointments with the recipient. NOT for:
   - Event announcements, webinars, or conferences
   - Past events or promotional content
   - Educational content or courses

2. REPLY: Only for personal emails that require a human response. NOT for:
   - Newsletters (contain unsubscribe links, bulk sender patterns)
   - Transactional emails (receipts, confirmations, notifications)
   - Promotional emails (sales pitches, offers, marketing)
   - Automated notifications (system messages, delivery confirmations)
   - Educational content (daily reminders, course content)

3. ARCHIVE: For informational content, newsletters, receipts, past events, notifications
4. HUMAN_REVIEW: For important emails that are unclear or require careful consideration

EMAIL TYPE CLASSIFICATION:
- personal: Direct communication from individuals requiring personal response
- newsletter: Mass communications, marketing emails, educational content
- transactional: Receipts, confirmations, delivery notifications, account updates
- promotional: Sales offers, product announcements, marketing campaigns
- notification: System notifications, automated alerts, status updates
- meeting_invite: Actual meeting invitations or appointment requests for future dates

Email Subject: ${emailSubject || 'Not provided'}
Sender: ${senderEmail || 'Not provided'}
Content: ${content}

Consider sender patterns (e.g., noreply@, automated systems) and content indicators (unsubscribe links, promotional language) when classifying.`,
  });
}

export async function generateReply(content: string, emailType?: string) {
  logger.info('Generating email reply...');

  // Additional safety check - avoid replying to certain email types
  if (
    emailType &&
    ['newsletter', 'transactional', 'promotional', 'notification'].includes(
      emailType
    )
  ) {
    throw new Error(`Cannot generate reply for ${emailType} email type`);
  }

  return generateObject({
    model: openai('gpt-4o-mini'),
    schema: replySchema,
    prompt: `Based on the following email, draft a professional reply.

IMPORTANT: Only draft replies for personal emails that require a human response. This should NOT be a newsletter, promotional email, transactional notification, or automated message.

Email content: ${content}

Draft a concise, professional response that addresses the sender's inquiry or continues the conversation appropriately. Return in the language of original email. Make sure you use senders name for greeting if available. Otherwise just say Hi or Hello in greeting`,
  });
}

export async function generateMeetingDetails(content: string) {
  logger.info('Generating meeting details...');
  const currentDate = new Date().toISOString();

  return generateObject({
    model: openai('gpt-4o-mini'),
    schema: meetingSchema,
    prompt: `Extract meeting details from the following email and return them in the specified format.

Current date/time for reference: ${currentDate}

Return a simple object with these fields:
- title: The meeting title/subject
- dateTime: Meeting date/time as ISO 8601 string (e.g., "2025-09-30T10:00:00Z")
- durationMinutes: Duration in minutes (default 60 if not specified)

Rules:
- Only extract meetings with FUTURE dates/times (after ${currentDate})
- Use the email subject for title if no better title is available
- Convert all times to UTC format (ending with Z)
- Duration should be between 15-480 minutes
- If no valid meeting is detected, the LLM should fail schema validation

Example output:
{
  "title": "Team Sync Meeting",
  "dateTime": "2025-09-30T10:00:00Z",
  "durationMinutes": 60
}

Email content: ${content}`,
  });
}

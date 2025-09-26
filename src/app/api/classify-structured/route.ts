import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

const intentSchema = z.object({
  intent: z
    .enum(['reply', 'meeting', 'archive', 'human_review'])
    .describe('The primary action needed for this email'),
  emailType: z
    .enum(['personal', 'newsletter', 'transactional', 'promotional', 'notification', 'meeting_invite'])
    .describe('The category of email'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence level (0-1)'),
});

export async function POST(req: NextRequest) {
  try {
    const { emailContent } = await req.json();

    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: intentSchema,
      prompt: `Classify this email appropriately.

RULES:
- MEETING: Requests for meetings or calls
- REPLY: Personal emails needing response
- ARCHIVE: Newsletters, receipts, notifications
- HUMAN_REVIEW: Important but unclear emails

Email: ${emailContent}`,
    });

    return NextResponse.json({
      success: true,
      response: object,
      type: 'structured'
    });
  } catch (error) {
    console.error('Structured classification error:', error);
    return NextResponse.json({
      success: false,
      error: 'Classification failed'
    }, { status: 500 });
  }
}
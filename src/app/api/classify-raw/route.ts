import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { emailContent } = await req.json();

    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: `Classify this email intent. Return only JSON with "intent" and "confidence" fields.
      Intent should be one of: reply, meeting, archive, human_review

      Email: ${emailContent}`,
    });

    return NextResponse.json({
      success: true,
      response: text,
      type: 'raw'
    });
  } catch (error) {
    console.error('Raw classification error:', error);
    return NextResponse.json({
      success: false,
      error: 'Classification failed'
    }, { status: 500 });
  }
}
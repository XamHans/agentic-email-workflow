import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { EmailIntentSchema } from '../types/email';

export const intentAgent = new Agent({
  name: 'Intent Agent',
  description: 'Determines basic email intent for routing',
  instructions: `Analyze emails and classify them into one of these intents:

1. **reply** - Email has questions or needs a response
2. **meeting** - Email mentions meeting, call, or scheduling
3. **archive** - Email is just informational
4. **human_review** - Complex or unclear emails

Provide the intent and brief reasoning.`,
  model: openai('gpt-4o-mini'),
});

export const analyzeEmailIntentTool = async (emailData: {
  subject: string;
  from: string;
  body: string;
}) => {
  const response = await intentAgent.generate(
    [
      {
        role: 'user',
        content: `Classify this email:

Subject: ${emailData.subject}
From: ${emailData.from}
Body: ${emailData.body}`,
      },
    ],
    {
      output: EmailIntentSchema,
    }
  );

  return response.object;
};
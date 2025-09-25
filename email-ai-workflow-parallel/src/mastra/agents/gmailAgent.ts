import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { sendEmailTool, markEmailAsReadTool } from '../tools/gmailTools';

export const gmailAgent = new Agent({
  name: 'Gmail Agent',
  description: 'Sends email replies using Gmail API',
  instructions: 'You are a helpful assistant that can send email replies. When asked to reply to an email, use the send email tool to compose and send appropriate responses. Keep replies professional and concise.',
  model: openai('gpt-4o-mini'),
  tools: {
    sendEmailTool,
    markEmailAsReadTool,
  },
});

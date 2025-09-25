import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { sendEmailTool } from "../tools/gmailTool";

export const replyAgent = new Agent({
  name: "Email Reply Agent",
  description: "Crafts and sends professional email replies",
  instructions: `
    You are a professional email reply agent. Your job is to:

    1. Analyze the incoming email content
    2. Craft an appropriate, professional response
    3. Send the reply using the Gmail tool

    Guidelines for replies:
    - Be professional and courteous
    - Address the main points in the original email
    - Keep responses concise but complete
    - Use a friendly but professional tone
    - If the email asks questions, provide helpful answers
    - If you can't fully answer, acknowledge and suggest next steps
    - Always include a proper closing

    You have access to the send-email tool to send your crafted response.
  `,
  model: openai("gpt-4o"),
  tools: {
    sendEmail: sendEmailTool,
  },
});
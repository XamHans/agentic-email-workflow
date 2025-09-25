import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
// Import tools and agents as before...

// Step to process each email
const processEmailStep = createStep({
  id: 'process-email',
  description: 'Process each email based on its intent',
  inputSchema: z.object({
    emailsWithIntent: z.array(
      z.object({
        id: z.string(),
        subject: z.string().optional(),
        from: z.string(),
        body: z.string(),
        threadId: z.string().optional(),
        intent: z.string(),
        reasoning: z.string(),
      })
    ),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        emailId: z.string(),
        action: z.string(),
        status: z.string(),
      })
    ),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const results = [];
    for (const email of inputData.emailsWithIntent) {
      try {
        if (email.intent === 'reply') {
          // Handle reply
          // Use gmailAgent to generate and send reply...
        } else if (email.intent === 'meeting') {
          // Handle meeting request
          // Use calendarAgent to suggest meeting times...
        } else if (email.intent === 'archive') {
          // Archive email
          // Use archiveEmailTool...
        } else if (email.intent === 'human_review') {
          // Flag for human review
          // Use markEmailAsReadTool...
        }
        results.push({
          emailId: email.id,
          action: email.intent,
          status: 'success',
        });
      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
        results.push({
          emailId: email.id,
          action: email.intent,
          status: 'error',
        });
      }
    }
    return { results };
  },
});

// Main Email Processing Workflow - Sequential Processing
export const emailProcessingWorkflow = createWorkflow({
  id: 'email-processing-workflow',
  description: 'Email processing with sequential routing after intent analysis',
  inputSchema: z.object({
    maxEmails: z.number().default(5).optional(),
  }),
})
  .then(fetchEmailsStep)
  .then(analyzeIntentStep)
  .then(processEmailStep) // Process each email one by one
  .then(summaryStep)
  .commit();

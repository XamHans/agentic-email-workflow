import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Import tools
import { fetchUnreadEmailsTool, markEmailAsReadTool, archiveEmailTool, sendEmailTool } from '../tools/gmailTools';
import { createCalendarEventTool, suggestMeetingTimesTool } from '../tools/calendarTools';

// Import agents
import { analyzeEmailIntentTool } from '../agents/intentAgent';
import { gmailAgent } from '../agents/gmailAgent';
import { calendarAgent } from '../agents/calendarAgent';

// Step 1: Fetch Unread Emails
const fetchEmailsStep = createStep({
  id: 'fetch-emails',
  description: 'Fetch unread emails from Gmail',
  inputSchema: z.object({
    maxEmails: z.number().default(10).optional(),
  }),
  outputSchema: z.object({
    emails: z.array(
      z.object({
        id: z.string(),
        subject: z.string().optional(),
        from: z.string(),
        body: z.string(),
        threadId: z.string().optional(),
      })
    ),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    try {
      const result = await fetchUnreadEmailsTool.execute({
        context: { maxResults: inputData.maxEmails },
        runtimeContext,
        tracingContext: {},
      });

      // Simplify email objects
      const emails = result.emails.map(email => ({
        id: email.id,
        subject: email.subject,
        from: email.from,
        body: email.body,
        threadId: email.threadId,
      }));

      return { emails };
    } catch (error) {
      console.error('Error fetching emails:', error);
      return { emails: [] };
    }
  },
});

// Step 2: Analyze Intent Only
const analyzeIntentStep = createStep({
  id: 'analyze-intent',
  description: 'Analyze email intent for routing decisions',
  inputSchema: z.object({
    emails: z.array(
      z.object({
        id: z.string(),
        subject: z.string().optional(),
        from: z.string(),
        body: z.string(),
        threadId: z.string().optional(),
      })
    ),
  }),
  outputSchema: z.object({
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
  execute: async ({ inputData }) => {
    const emailsWithIntent = [];

    for (const email of inputData.emails) {
      try {
        const intentResult = await analyzeEmailIntentTool({
          subject: email.subject || '',
          from: email.from,
          body: email.body,
        });

        emailsWithIntent.push({
          ...email,
          intent: intentResult.intent,
          reasoning: intentResult.reasoning,
        });

      } catch (error) {
        console.error(`Error analyzing intent for email ${email.id}:`, error);
        emailsWithIntent.push({
          ...email,
          intent: 'human_review',
          reasoning: 'Failed to analyze intent',
        });
      }
    }

    return { emailsWithIntent };
  },
});

// Step 3: Reply Action Step
const replyActionStep = createStep({
  id: 'reply-action',
  description: 'Handle emails that need replies using Gmail agent',
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
    const replyEmails = inputData.emailsWithIntent.filter(email => email.intent === 'reply');
    const results = [];

    for (const email of replyEmails) {
      try {
        console.log(`📧 Processing reply for: ${email.subject} from ${email.from}`);

        // Use Gmail agent to generate and send reply
        const response = await gmailAgent.generate([
          {
            role: 'user',
            content: `Generate a professional reply to this email:

From: ${email.from}
Subject: ${email.subject}
Body: ${email.body}

Please send an appropriate response and then mark the email as read.`,
          },
        ], {
          maxSteps: 3
        });

        console.log(`✅ Reply sent for email ${email.id}`);
        results.push({
          emailId: email.id,
          action: 'reply_sent',
          status: 'success',
        });
      } catch (error) {
        console.error(`❌ Error sending reply for email ${email.id}:`, error);
        results.push({
          emailId: email.id,
          action: 'reply_failed',
          status: 'error',
        });
      }
    }

    return { results };
  },
});

// Step 4: Meeting Action Step
const meetingActionStep = createStep({
  id: 'meeting-action',
  description: 'Handle meeting requests using Calendar agent',
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
    const meetingEmails = inputData.emailsWithIntent.filter(email => email.intent === 'meeting');
    const results = [];

    for (const email of meetingEmails) {
      try {
        console.log(`📅 Processing meeting request: ${email.subject} from ${email.from}`);

        // Use Calendar agent to suggest meeting times
        const response = await calendarAgent.generate([
          {
            role: 'user',
            content: `Process this meeting request:

From: ${email.from}
Subject: ${email.subject}
Body: ${email.body}

Please suggest optimal meeting times or create a calendar event as appropriate.`,
          },
        ], {
          maxSteps: 3
        });

        // Mark email as read
        await markEmailAsReadTool.execute({
          context: { messageId: email.id },
          runtimeContext,
          tracingContext: {},
        });

        console.log(`✅ Meeting request processed for email ${email.id}`);
        results.push({
          emailId: email.id,
          action: 'meeting_processed',
          status: 'success',
        });
      } catch (error) {
        console.error(`❌ Error processing meeting request for email ${email.id}:`, error);
        results.push({
          emailId: email.id,
          action: 'meeting_failed',
          status: 'error',
        });
      }
    }

    return { results };
  },
});

// Step 5: Archive Action Step
const archiveActionStep = createStep({
  id: 'archive-action',
  description: 'Archive informational emails',
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
    const archiveEmails = inputData.emailsWithIntent.filter(email => email.intent === 'archive');
    const results = [];

    for (const email of archiveEmails) {
      try {
        console.log(`📁 Archiving email: ${email.subject} from ${email.from}`);
        console.log(`   Reasoning: ${email.reasoning}`);

        await archiveEmailTool.execute({
          context: { messageId: email.id },
          runtimeContext,
          tracingContext: {},
        });

        console.log(`✅ Email ${email.id} archived successfully`);
        results.push({
          emailId: email.id,
          action: 'archived',
          status: 'success',
        });
      } catch (error) {
        console.error(`❌ Error archiving email ${email.id}:`, error);
        results.push({
          emailId: email.id,
          action: 'archive_failed',
          status: 'error',
        });
      }
    }

    return { results };
  },
});

// Step 6: Human Review Action Step
const humanReviewActionStep = createStep({
  id: 'human-review-action',
  description: 'Flag complex emails for human review',
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
    const humanReviewEmails = inputData.emailsWithIntent.filter(email => email.intent === 'human_review');
    const results = [];

    for (const email of humanReviewEmails) {
      console.log(`👤 Flagging for human review: ${email.subject} from ${email.from}`);
      console.log(`   Reasoning: ${email.reasoning}`);

      // Mark as read so it doesn't keep getting processed
      await markEmailAsReadTool.execute({
        context: { messageId: email.id },
        runtimeContext,
        tracingContext: {},
      });

      results.push({
        emailId: email.id,
        action: 'flagged_for_review',
        status: 'success',
      });
    }

    return { results };
  },
});

// Step 7: Summary Step
const summaryStep = createStep({
  id: 'summary',
  description: 'Summarize all processing results',
  inputSchema: z.object({
    'reply-action': z.object({
      results: z.array(
        z.object({
          emailId: z.string(),
          action: z.string(),
          status: z.string(),
        })
      ),
    }),
    'meeting-action': z.object({
      results: z.array(
        z.object({
          emailId: z.string(),
          action: z.string(),
          status: z.string(),
        })
      ),
    }),
    'archive-action': z.object({
      results: z.array(
        z.object({
          emailId: z.string(),
          action: z.string(),
          status: z.string(),
        })
      ),
    }),
    'human-review-action': z.object({
      results: z.array(
        z.object({
          emailId: z.string(),
          action: z.string(),
          status: z.string(),
        })
      ),
    }),
  }),
  outputSchema: z.object({
    totalProcessed: z.number(),
    summary: z.string(),
  }),
  execute: async ({ inputData }) => {
    // Flatten all results from parallel steps
    const allResults = [
      ...inputData['reply-action'].results,
      ...inputData['meeting-action'].results,
      ...inputData['archive-action'].results,
      ...inputData['human-review-action'].results,
    ];

    const total = allResults.length;
    const actionCounts = allResults.reduce((acc, result) => {
      acc[result.action] = (acc[result.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`\n📊 Email Processing Complete!`);
    console.log(`   Total emails processed: ${total}`);
    console.log(`   Action breakdown:`, actionCounts);
    console.log(`   Workflow completed with branched routing\n`);

    const summary = `Processed ${total} emails: ${Object.entries(actionCounts)
      .map(([action, count]) => `${count} ${action}`)
      .join(', ')}`;

    return {
      totalProcessed: total,
      summary: summary,
    };
  },
});

// Main Email Processing Workflow - Branch-Based Routing
export const emailProcessingWorkflow = createWorkflow({
  id: 'email-processing-workflow',
  description: 'Email processing with branch-based routing after intent analysis',
  inputSchema: z.object({
    maxEmails: z.number().default(5).optional(),
  }),
  outputSchema: z.object({
    totalProcessed: z.number(),
    summary: z.string(),
  }),
})
  .then(fetchEmailsStep)
  .then(analyzeIntentStep)
  // Branch based on intents - all branches run in parallel
  .parallel([
    replyActionStep,
    meetingActionStep,
    archiveActionStep,
    humanReviewActionStep,
  ])
  // Map the results for the summary step
  .then(summaryStep)
  .commit();
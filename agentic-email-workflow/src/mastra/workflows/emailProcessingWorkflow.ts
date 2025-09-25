import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { getUnreadEmailsTool } from "../tools/gmailTool";
import { storeForHumanReviewTool } from "../tools/storageTool";
import { classificationAgent } from "../agents/classificationAgent";
import { replyAgent } from "../agents/replyAgent";
import { calendarAgent } from "../agents/calendarAgent";
import { archiveAgent } from "../agents/archiveAgent";

// Step 1: Fetch unread emails
const fetchEmailsStep = createStep({
  id: "fetch-emails",
  description: "Fetch unread emails from Gmail",
  inputSchema: z.object({
    maxEmails: z.number().optional().default(10),
  }),
  outputSchema: z.object({
    emails: z.array(z.object({
      id: z.string(),
      subject: z.string(),
      from: z.string(),
      body: z.string(),
      date: z.string(),
    })),
  }),
  execute: async ({ inputData }) => {
    const result = await getUnreadEmailsTool.execute({
      context: { maxResults: inputData.maxEmails },
    });
    return result;
  },
});

// Step 2: Process each email with classification
const processEmailsStep = createStep({
  id: "process-emails",
  description: "Process and classify each email",
  inputSchema: z.object({
    emails: z.array(z.object({
      id: z.string(),
      subject: z.string(),
      from: z.string(),
      body: z.string(),
      date: z.string(),
    })),
  }),
  outputSchema: z.object({
    processedEmails: z.array(z.object({
      email: z.object({
        id: z.string(),
        subject: z.string(),
        from: z.string(),
        body: z.string(),
        date: z.string(),
      }),
      intent: z.enum(["reply", "meeting", "human_review", "archive"]),
    })),
  }),
  execute: async ({ inputData }) => {
    const processedEmails = [];

    for (const email of inputData.emails) {
      const prompt = `Subject: ${email.subject}\n\nFrom: ${email.from}\n\nBody: ${email.body}`;

      const classification = await classificationAgent.generate(prompt);
      const intent = classification.text.trim().toLowerCase();

      // Validate intent
      const validIntents = ["reply", "meeting", "human_review", "archive"];
      const finalIntent = validIntents.includes(intent) ? intent : "human_review";

      processedEmails.push({
        email,
        intent: finalIntent as "reply" | "meeting" | "human_review" | "archive",
      });
    }

    return { processedEmails };
  },
});

// Step 3: Route emails based on intent
const routeEmailsStep = createStep({
  id: "route-emails",
  description: "Route emails to appropriate handlers based on intent",
  inputSchema: z.object({
    processedEmails: z.array(z.object({
      email: z.object({
        id: z.string(),
        subject: z.string(),
        from: z.string(),
        body: z.string(),
        date: z.string(),
      }),
      intent: z.enum(["reply", "meeting", "human_review", "archive"]),
    })),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      emailId: z.string(),
      intent: z.string(),
      action: z.string(),
      success: z.boolean(),
      details: z.string().optional(),
    })),
  }),
  execute: async ({ inputData }) => {
    const results = [];

    for (const { email, intent } of inputData.processedEmails) {
      try {
        switch (intent) {
          case "reply":
            const replyPrompt = `Please craft and send a professional reply to this email:

Subject: ${email.subject}
From: ${email.from}
Body: ${email.body}

Extract the sender's email from the 'From' field and send an appropriate response.`;

            await replyAgent.generate(replyPrompt);
            results.push({
              emailId: email.id,
              intent,
              action: "reply_sent",
              success: true,
              details: "Professional reply sent to sender",
            });
            break;

          case "meeting":
            const meetingPrompt = `Please create a calendar event based on this meeting request:

Subject: ${email.subject}
From: ${email.from}
Body: ${email.body}

Extract the sender's email from the 'From' field, create an appropriate calendar event, and send a confirmation.`;

            await calendarAgent.generate(meetingPrompt);
            results.push({
              emailId: email.id,
              intent,
              action: "meeting_scheduled",
              success: true,
              details: "Calendar event created and confirmation sent",
            });
            break;

          case "human_review":
            await storeForHumanReviewTool.execute({
              context: {
                email,
                reason: "Email classified as requiring human review",
              },
            });
            results.push({
              emailId: email.id,
              intent,
              action: "stored_for_review",
              success: true,
              details: "Email stored in human review queue",
            });
            break;

          case "archive":
            const archivePrompt = `Please archive this informational email:

Subject: ${email.subject}
From: ${email.from}
Body: ${email.body}

Email ID: ${email.id}`;

            await archiveAgent.generate(archivePrompt);
            results.push({
              emailId: email.id,
              intent,
              action: "archived",
              success: true,
              details: "Email archived successfully",
            });
            break;

          default:
            results.push({
              emailId: email.id,
              intent,
              action: "error",
              success: false,
              details: "Unknown intent classification",
            });
        }
      } catch (error) {
        results.push({
          emailId: email.id,
          intent,
          action: "error",
          success: false,
          details: `Error processing email: ${error}`,
        });
      }
    }

    return { results };
  },
});

// Main workflow
export const emailProcessingWorkflow = createWorkflow({
  id: "email-processing",
  description: "Processes unread emails from Gmail with intent classification and routing",
  inputSchema: z.object({
    maxEmails: z.number().optional().default(10),
  }),
  outputSchema: z.object({
    totalProcessed: z.number(),
    results: z.array(z.object({
      emailId: z.string(),
      intent: z.string(),
      action: z.string(),
      success: z.boolean(),
      details: z.string().optional(),
    })),
  }),
})
  .then(fetchEmailsStep)
  .then(processEmailsStep)
  .then(routeEmailsStep)
  .map(({ inputData }) => ({
    totalProcessed: inputData.results.length,
    results: inputData.results,
  }))
  .commit();
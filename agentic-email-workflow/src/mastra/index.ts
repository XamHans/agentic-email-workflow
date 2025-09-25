
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

// Import all agents
import { classificationAgent } from "./agents/classificationAgent";
import { replyAgent } from "./agents/replyAgent";
import { calendarAgent } from "./agents/calendarAgent";
import { archiveAgent } from "./agents/archiveAgent";

// Import all tools
import { getUnreadEmailsTool, sendEmailTool, archiveEmailTool } from "./tools/gmailTool";
import { createCalendarEventTool } from "./tools/calendarTool";
import { storeForHumanReviewTool, getHumanReviewQueueTool } from "./tools/storageTool";

// Import workflows
import { emailProcessingWorkflow } from "./workflows/emailProcessingWorkflow";

export const mastra = new Mastra({
  agents: {
    classificationAgent,
    replyAgent,
    calendarAgent,
    archiveAgent,
  },
  tools: {
    getUnreadEmails: getUnreadEmailsTool,
    sendEmail: sendEmailTool,
    archiveEmail: archiveEmailTool,
    createCalendarEvent: createCalendarEventTool,
    storeForHumanReview: storeForHumanReviewTool,
    getHumanReviewQueue: getHumanReviewQueueTool,
  },
  workflows: {
    emailProcessing: emailProcessingWorkflow,
  },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'EmailWorkflow',
    level: 'info',
  }),
});

import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import { emailProcessingWorkflow } from './workflows/emailProcessing';
import { gmailAgent } from './agents/gmailAgent';
import { calendarAgent } from './agents/calendarAgent';
import { intentAgent } from './agents/intentAgent';

export const mastra = new Mastra({
  workflows: { emailProcessingWorkflow },
  agents: {
    gmailAgent,
    calendarAgent,
    intentAgent,
  },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});

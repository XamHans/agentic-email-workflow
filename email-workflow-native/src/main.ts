// src/main.ts
import { google } from 'googleapis';
import * as actions from './actions';
import { getEmailIntent } from './ai';
import { logAction } from './audit';
import { getAuthenticatedClient } from './auth';
import { getUnreadEmails } from './gmail';
import logger from './logger';

async function main() {
  logger.info('Starting email processing workflow...');
  const auth = await getAuthenticatedClient();
  const gmail = google.gmail({ version: 'v1', auth });
  const calendar = google.calendar({ version: 'v3', auth });

  const emails = await getUnreadEmails(gmail);

  for (const email of emails) {
    const childLogger = logger.child({ emailId: email.id });
    try {
      childLogger.info(`Processing email with subject: "${email.subject}"`);

      const emailContent = `Subject: ${email.subject}\nBody: ${email.body}`;
      const { object } = await getEmailIntent(emailContent);

      switch (object.intent) {
        case 'reply':
          await actions.handleReply(gmail, email);
          break;
        case 'meeting':
          await actions.handleMeeting(calendar, email);
          break;
        case 'human_review':
          await actions.handleHumanReview(email);
          break;
        case 'archive':
          await actions.handleArchive(gmail, email);
          break;
        default:
          childLogger.warn(
            { intent: (object as any).intent },
            'Unknown intent detected'
          );
      }
      childLogger.info('Successfully processed email.');
    } catch (error) {
      childLogger.error({ error }, 'Failed to process email');
      // Add error to the audit log
      await logAction({
        emailId: email.id,
        subject: email.subject,
        intent: 'error',
        action: 'FATAL: Failed to process email in main loop',
        details: (error as Error).message,
      });
      // Continue to the next email
    }
  }
  logger.info('Workflow finished.');
}

main().catch((error) => {
  logger.fatal({ error }, 'Workflow terminated with a fatal error.');
});

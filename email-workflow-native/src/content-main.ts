// src/content-main.ts
import { google } from 'googleapis';
import { getAuthenticatedClient } from './auth';
import { runContentCreationWorkflow } from './core/content-workflow';
import logger from './logger';

/**
 * Entry point for the Content Creation Workflow
 *
 * This workflow:
 * 1. Fetches calendar events from the next 10 days
 * 2. Uses AI to identify content-related events
 * 3. For each content event:
 *    - Performs web research using OpenAI Responses API
 *    - Generates a YouTube Shorts script following best practices
 *    - Updates the calendar event with the generated script
 * 4. Sends a summary email with all generated scripts
 */
async function main() {
  logger.info('🎬 Starting Content Creation Workflow...');

  try {
    // Authenticate with Google APIs
    const auth = await getAuthenticatedClient();
    const gmail = google.gmail({ version: 'v1', auth });
    const calendar = google.calendar({ version: 'v3', auth });

    // Configuration
    const RECIPIENT_EMAIL = 'muellerjohannes93@gmail.com';
    const DAYS_AHEAD = 10;

    logger.info({
      recipientEmail: RECIPIENT_EMAIL,
      daysAhead: DAYS_AHEAD,
    }, 'Workflow configuration');

    // Run the workflow
    await runContentCreationWorkflow({
      gmail,
      calendar,
      recipientEmail: RECIPIENT_EMAIL,
      daysAhead: DAYS_AHEAD,
    });

    logger.info('✅ Content Creation Workflow completed successfully!');
  } catch (error) {
    logger.fatal({ error }, '💥 Content Creation Workflow failed with fatal error');
    process.exit(1);
  }
}

// Execute the workflow
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

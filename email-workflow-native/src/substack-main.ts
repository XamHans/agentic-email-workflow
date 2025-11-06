// src/substack-main.ts
import { google } from 'googleapis';
import { getAuthenticatedClient } from './auth';
import { runSubstackToCalendarWorkflow } from './core/substack-workflow';
import logger from './logger';

/**
 * Entry point for the Substack-to-Calendar Workflow
 *
 * This workflow:
 * 1. Fetches content from a Substack article URL and converts it to markdown
 * 2. Uses AI to extract 3-5 key topics suitable for YouTube scripts
 * 3. Creates Google Calendar events for each topic with:
 *    - Topic summary
 *    - Deep link to the source article
 *    - Scheduled in 2-hour blocks on consecutive days
 * 4. Logs a summary of all created events
 *
 * Usage:
 *   npm run substack
 *   Then provide a Substack URL when prompted, or pass as argument:
 *   npm run substack -- https://agentdevs.substack.com/p/your-article
 */
async function main() {
  logger.info('📚 Starting Substack-to-Calendar Workflow...');

  try {
    // Get Substack URL from command line arguments or use default
    const substackUrl =
      process.argv[2] ||
      'https://agentdevs.substack.com/p/agent-skills-claude-code-and-the';

    if (!substackUrl) {
      console.error('❌ Error: Please provide a Substack URL');
      console.log('\nUsage:');
      console.log('  npm run substack -- https://agentdevs.substack.com/p/your-article');
      process.exit(1);
    }

    // Validate URL format
    try {
      new URL(substackUrl);
    } catch (error) {
      console.error('❌ Error: Invalid URL format');
      console.log('\nPlease provide a valid URL starting with http:// or https://');
      process.exit(1);
    }

    console.log(`\n🔍 Processing article from: ${substackUrl}\n`);

    // Authenticate with Google APIs
    const auth = await getAuthenticatedClient();
    const calendar = google.calendar({ version: 'v3', auth });

    // Configuration
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1); // Start from tomorrow
    const timeZone = 'America/Los_Angeles'; // Adjust if needed

    logger.info(
      {
        substackUrl,
        startDate: startDate.toISOString(),
        timeZone,
      },
      'Workflow configuration'
    );

    // Run the workflow
    const result = await runSubstackToCalendarWorkflow({
      calendar,
      substackUrl,
      startDate,
      timeZone,
    });

    logger.info(
      {
        articleTitle: result.articleTitle,
        totalEventsCreated: result.totalEventsCreated,
      },
      '✅ Substack-to-Calendar Workflow completed successfully!'
    );

    console.log('\n🎉 All done! Check your Google Calendar for the new events.');
  } catch (error) {
    logger.fatal({ error }, '💥 Substack-to-Calendar Workflow failed with fatal error');
    console.error('\n❌ Workflow failed with error:');
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : JSON.stringify(error);
    console.error(message);
    process.exit(1);
  }
}

// Execute the workflow
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// src/core/substack-workflow.ts
import { calendar_v3 } from 'googleapis';
import logger from '../logger';
import { extractTopicsFromContent } from '../ai';
import { urlToMarkdown } from '../tools/url-to-markdown';
import { createCalendarEvent } from './calendar-service';
import { Workflow } from './workflow';

type Calendar = calendar_v3.Calendar;

interface ExtractedTopic {
  title: string;
  summary: string;
  url: string;
  keyTakeaways: string[];
  youtubeRelevance: number;
}

interface TopicWithEvent extends ExtractedTopic {
  calendarEventId: string;
  calendarEventLink: string;
  scheduledDateTime: string;
}

interface WorkflowInput {
  calendar: Calendar;
  substackUrl: string;
  startDate?: Date;
  timeZone?: string;
}

interface WorkflowOutput {
  articleTitle: string;
  articleUrl: string;
  topics: TopicWithEvent[];
  totalEventsCreated: number;
}

/**
 * Generates ISO datetime strings for scheduling events
 * Schedules each topic in 2-hour blocks (2:00 PM - 4:00 PM) on consecutive days
 */
function generateScheduleTimes(
  startDate: Date,
  topicCount: number,
  timeZone: string
): Array<{ start: string; end: string }> {
  const schedules: Array<{ start: string; end: string }> = [];
  const currentDate = new Date(startDate);

  for (let i = 0; i < topicCount; i++) {
    // Add i days to start date
    const eventDate = new Date(currentDate);
    eventDate.setDate(currentDate.getDate() + i);

    // Set to 2:00 PM (14:00)
    const startDateTime = new Date(eventDate);
    startDateTime.setHours(14, 0, 0, 0);

    // Set to 4:00 PM (16:00)
    const endDateTime = new Date(eventDate);
    endDateTime.setHours(16, 0, 0, 0);

    schedules.push({
      start: startDateTime.toISOString(),
      end: endDateTime.toISOString(),
    });
  }

  return schedules;
}

/**
 * Formats a topic into a calendar event description
 * Simple format: Title, Summary, URL
 */
function formatTopicForCalendar(topic: ExtractedTopic): string {
  return `${topic.title}

${topic.summary}

🔗 ${topic.url}`;
}

/**
 * Main workflow for processing Substack content and creating calendar events
 */
export async function runSubstackToCalendarWorkflow(
  input: WorkflowInput
): Promise<WorkflowOutput> {
  const {
    calendar,
    substackUrl,
    startDate = new Date(Date.now() + 24 * 60 * 60 * 1000), // Default: tomorrow
    timeZone = 'America/Los_Angeles',
  } = input;

  logger.info({ substackUrl }, 'Starting Substack-to-Calendar Workflow...');

  // Setup output directory for logs
  const outDir = './workflow-logs';
  await setupLogsDirectory(outDir);

  const workflow = Workflow.start({ logDir: outDir, verbose: true })
    .step('fetchMarkdownContent', async ({ log }) => {
      log(`Fetching content from: ${substackUrl}`);
      const result = await urlToMarkdown(substackUrl);
      log(`Successfully fetched: ${result.title}`);
      log(`Content length: ${result.markdown.length} characters`);
      return result;
    })
    .step('extractTopics', async ({ input: markdownResult, log }) => {
      log('Extracting 3-5 key topics using AI...');
      const extraction = await extractTopicsFromContent(
        markdownResult.markdown,
        markdownResult.title,
        substackUrl
      );
      log(`Extracted ${extraction.object.topics.length} topics`);
      extraction.object.topics.forEach((topic, i) => {
        log(
          `Topic ${i + 1}: ${topic.title} (Relevance: ${topic.youtubeRelevance}/10) - ${topic.url}`
        );
      });
      return {
        topics: extraction.object.topics,
        articleTitle: markdownResult.title,
      };
    })
    .step('createCalendarEvents', async ({ input, log }) => {
      const { topics, articleTitle } = input;
      log(`Creating ${topics.length} calendar events...`);

      const schedules = generateScheduleTimes(startDate, topics.length, timeZone);
      const topicsWithEvents: TopicWithEvent[] = [];

      for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        const schedule = schedules[i];

        log(`Creating event ${i + 1}/${topics.length}: ${topic.title}`);

        const eventDescription = formatTopicForCalendar(topic);

        const createdEvent = await createCalendarEvent(calendar, {
          summary: `YouTube Script: ${topic.title}`,
          description: eventDescription,
          startDateTime: schedule.start,
          endDateTime: schedule.end,
          timeZone,
        });

        topicsWithEvents.push({
          ...topic,
          calendarEventId: createdEvent.id,
          calendarEventLink: createdEvent.htmlLink || '',
          scheduledDateTime: schedule.start,
        });

        log(`✓ Created event: ${createdEvent.htmlLink}`);
      }

      return {
        topics: topicsWithEvents,
        articleTitle,
      };
    })
    .tap('logSummary', async ({ topics, articleTitle }) => {
      logger.info(
        {
          articleTitle,
          articleUrl: substackUrl,
          topicsCount: topics.length,
        },
        'Workflow completed successfully'
      );
      console.log('\n✅ Workflow Summary:');
      console.log(`📄 Article: ${articleTitle}`);
      console.log(`🔗 URL: ${substackUrl}`);
      console.log(`📅 Created ${topics.length} calendar events:\n`);
      topics.forEach((topic, i) => {
        console.log(
          `  ${i + 1}. ${topic.title} (Relevance: ${topic.youtubeRelevance}/10)`
        );
        console.log(`     📅 Scheduled: ${new Date(topic.scheduledDateTime).toLocaleString()}`);
        console.log(`     🔗 Topic URL: ${topic.url}`);
        console.log(`     📆 Calendar: ${topic.calendarEventLink}\n`);
      });
    });

  try {
    const result = await workflow.run(undefined);

    const output: WorkflowOutput = {
      articleTitle: result.output.articleTitle,
      articleUrl: substackUrl,
      topics: result.output.topics,
      totalEventsCreated: result.output.topics.length,
    };

    console.log('\n📊 Workflow Execution Trace:');
    console.table(
      result.trace.map((t) => ({
        step: t.name,
        duration_ms: t.durationMs,
        status: t.ok ? '✅' : '❌',
      }))
    );

    return output;
  } catch (error: any) {
    console.error('🚨 Workflow failed!');
    logger.error({ error }, 'Substack-to-Calendar workflow execution failed');

    if (error.trace) {
      console.table(
        error.trace.map((t: any) => ({
          step: t.name,
          duration_ms: t.durationMs,
          status: t.ok ? '✅' : '❌',
        }))
      );
    }

    throw error;
  }
}

/**
 * Sets up the logs directory
 */
async function setupLogsDirectory(dir: string): Promise<void> {
  const fs = await import('fs/promises');
  try {
    await fs.mkdir(dir, { recursive: true });
    logger.info({ directory: dir }, 'Logs directory ready');
  } catch (error) {
    logger.warn({ error, directory: dir }, 'Could not create logs directory');
  }
}

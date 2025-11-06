// src/core/content-workflow.ts
import { calendar_v3, google } from 'googleapis';
import logger from '../logger';
import { urlToMarkdown } from '../tools/url-to-markdown';
import {
  CalendarEvent,
  fetchUpcomingEvents,
  formatScriptForCalendar,
  updateEventDescription,
} from './calendar-service';
import { ContentSummary, sendContentSummaryEmail } from './email-service';
import { researchContentTopic } from './web-research-agent';
import { Workflow } from './workflow';
import {
  createYouTubeShortScript,
  createYouTubeShortScriptFromMarkdown,
  validateScript,
  YouTubeScript,
} from './youtube-script-generator';

type Gmail = ReturnType<typeof google.gmail>;
type Calendar = calendar_v3.Calendar;

interface ContentEvent {
  event: CalendarEvent;
  topic: string;
  contentType?: string | null;
}

interface WorkflowInput {
  gmail: Gmail;
  calendar: Calendar;
  recipientEmail: string;
  daysAhead?: number;
}

interface ProcessedContent {
  event: CalendarEvent;
  topic: string;
  script: YouTubeScript;
}

/**
 * Main workflow for content creation pipeline
 */
export async function runContentCreationWorkflow(
  input: WorkflowInput
): Promise<void> {
  const { gmail, calendar, recipientEmail, daysAhead = 10 } = input;

  logger.info('Starting Content Creation Workflow...');

  // Setup output directory for logs
  const outDir = './workflow-logs';
  await setupLogsDirectory(outDir);

  const workflow = Workflow.start({ logDir: outDir, verbose: true })
    .step('fetchCalendarEvents', async () => {
      return fetchUpcomingEvents(calendar, daysAhead);
    })
    .step('selectYouTubeShortEvents', async ({ input: events }) => {
      return filterYouTubeShortEvents(events);
    })
    .step('researchAndGenerateScripts', async ({ input: contentEvents }) => {
      return await processContentEvents(contentEvents);
    })
    .step('updateCalendarEvents', async ({ input: processedContent }) => {
      return await updateCalendarWithScripts(calendar, processedContent);
    })
    .step('sendSummaryEmail', async ({ input: summaries }) => {
      await sendContentSummaryEmail(gmail, recipientEmail, summaries);
      return summaries;
    })
    .tap('complete', async (summaries) => {
      const successful = summaries.filter((s) => s.success).length;
      const total = summaries.length;
      logger.info(
        `Content Creation Workflow completed: ${successful}/${total} events processed successfully`
      );
    });

  try {
    const result = await workflow.run(undefined);
    console.log('\n✅ Workflow completed successfully!');
    console.table(
      result.trace.map((t) => ({
        step: t.name,
        duration_ms: t.durationMs,
        status: t.ok ? '✅' : '❌',
      }))
    );
  } catch (error: any) {
    console.error('🚨 Workflow failed!');
    logger.error({ error }, 'Workflow execution failed');
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
 * Filters calendar events for YouTube Shorts content
 */
function filterYouTubeShortEvents(events: CalendarEvent[]): ContentEvent[] {
  const prefix = 'YouTube Script:';
  const prefixLower = prefix.toLowerCase();
  logger.info(
    `Filtering ${events.length} calendar events for YouTube Shorts...`
  );

  const contentEvents: ContentEvent[] = [];

  for (const event of events) {
    const summary = event.summary || '';
    const normalized = summary.trim().toLowerCase();
    if (!normalized.startsWith(prefixLower)) {
      continue;
    }

    const topic = summary
      .slice(summary.toLowerCase().indexOf(prefixLower) + prefixLower.length)
      .trim();
    if (!topic) {
      logger.warn(
        { eventTitle: event.summary },
        'Skipping YouTube Short event with no topic in title'
      );
      continue;
    }

    contentEvents.push({
      event,
      topic,
      contentType: 'YouTube Short',
    });
  }

  logger.info(`Found ${contentEvents.length} YouTube Short events`);
  return contentEvents;
}

/**
 * Extracts the first URL from a text string
 */
function extractUrl(text?: string | null): string | null {
  if (!text) return null;
  const urlMatch = text.match(/(https?:\/\/[^\s<>)"]+)/i);
  return urlMatch ? urlMatch[1] : null;
}

/**
 * Processes each content event: research + generate script
 */
async function processContentEvents(
  contentEvents: ContentEvent[]
): Promise<ProcessedContent[]> {
  logger.info(`Processing ${contentEvents.length} content events...`);

  const processed: ProcessedContent[] = [];

  for (const contentEvent of contentEvents) {
    try {
      logger.info(
        { topic: contentEvent.topic, eventTitle: contentEvent.event.summary },
        'Processing content event'
      );

      let script: YouTubeScript;

      // Check if event description contains a URL
      const url = extractUrl(contentEvent.event.description);

      if (url) {
        // URL-based flow: fetch and convert to markdown, then generate script
        logger.info(
          { url, topic: contentEvent.topic },
          'Using URL-to-markdown flow'
        );

        try {
          // Step 1: Convert URL to markdown
          const markdownResult = await urlToMarkdown(url);

          logger.info(
            {
              url,
              title: markdownResult.title,
              markdownLength: markdownResult.markdown.length,
            },
            'URL converted to markdown successfully'
          );

          // Step 2: Generate YouTube script from markdown
          script = await createYouTubeShortScriptFromMarkdown(
            contentEvent.topic,
            markdownResult.markdown,
            markdownResult.title
          );

          logger.info(
            { topic: contentEvent.topic, sourceUrl: url },
            'Script generated from URL content'
          );
        } catch (urlError) {
          // If URL-to-markdown fails, fall back to web search
          logger.warn(
            { error: urlError, url, topic: contentEvent.topic },
            'URL-to-markdown failed, falling back to web search'
          );

          const research = await researchContentTopic(
            contentEvent.topic,
            contentEvent.contentType
          );
          script = await createYouTubeShortScript(contentEvent.topic, research);
        }
      } else {
        // Web search flow: traditional research-based approach
        logger.info(
          { topic: contentEvent.topic },
          'Using web search flow (no URL found)'
        );

        // Step 1: Perform web research
        const research = await researchContentTopic(
          contentEvent.topic,
          contentEvent.contentType
        );

        // Step 2: Generate YouTube script
        script = await createYouTubeShortScript(contentEvent.topic, research);
      }

      // Step 3: Validate script (common for both flows)
      const validation = validateScript(script);
      if (!validation.valid) {
        logger.warn(
          { warnings: validation.warnings, topic: contentEvent.topic },
          'Script validation warnings'
        );
      }

      processed.push({
        event: contentEvent.event,
        topic: contentEvent.topic,
        script,
      });

      logger.info(
        { topic: contentEvent.topic, title: script.title },
        'Content processed successfully'
      );
    } catch (error) {
      logger.error(
        {
          error,
          topic: contentEvent.topic,
          eventTitle: contentEvent.event.summary,
        },
        'Failed to process content event'
      );
      // Continue with other events
    }
  }

  logger.info(
    `Successfully processed ${processed.length}/${contentEvents.length} events`
  );
  return processed;
}

/**
 * Updates calendar events with generated scripts
 */
async function updateCalendarWithScripts(
  calendar: Calendar,
  processedContent: ProcessedContent[]
): Promise<ContentSummary[]> {
  logger.info(`Updating ${processedContent.length} calendar events...`);

  const summaries: ContentSummary[] = [];

  for (const content of processedContent) {
    try {
      const formattedDescription = formatScriptForCalendar(
        content.event.description || undefined,
        content.script
      );

      await updateEventDescription(
        calendar,
        content.event.id,
        formattedDescription
      );

      summaries.push({
        eventTitle: content.event.summary,
        eventDate:
          content.event.start?.dateTime ||
          content.event.start?.date ||
          undefined,
        topic: content.topic,
        script: content.script,
        calendarLink: content.event.htmlLink || undefined,
        success: true,
      });

      logger.info({ eventId: content.event.id }, 'Calendar event updated');
    } catch (error) {
      logger.error(
        { error, eventId: content.event.id },
        'Failed to update calendar event'
      );

      summaries.push({
        eventTitle: content.event.summary,
        eventDate:
          content.event.start?.dateTime ||
          content.event.start?.date ||
          undefined,
        topic: content.topic,
        script: content.script,
        success: false,
        error: (error as Error).message,
      });
    }
  }

  return summaries;
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

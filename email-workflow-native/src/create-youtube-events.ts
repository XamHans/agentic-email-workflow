// src/create-youtube-events.ts
import { google } from 'googleapis';
import { getAuthenticatedClient } from './auth';
import { createCalendarEvent } from './core/calendar-service';
import logger from './logger';

interface EventData {
  title: string;
  date: string;
  time: string;
  description: string;
}

// Hardcoded YouTube content events
const eventsToCreate: EventData[] = [
  {
    title: 'YouTube Script: Secure Your AI: Protect Against Tool Poisoning',
    date: 'Monday, October 28, 2025',
    time: '1:00 PM - 3:00 PM',
    description:
      'Discover the invisible threats of tool poisoning in AI development and how they can compromise sensitive data. This topic is critical for anyone working with AI agents, making it both urgent and valuable to understand.\n\n🔗 https://labs.snyk.io/resources/detect-tool-poisoning-mcp-server-security/',
  },
  {
    title: 'YouTube Script: Agent Skills for Claude',
    date: 'Tuesday, October 29, 2025',
    time: '2:00 PM - 4:00 PM',
    description:
      'Create short-form content on Agent Skills - reusable domain expertise modules. Cover composable, portable, executable features. Include Box case study demo.',
  },
  {
    title: 'YouTube Script: Claude Code on the Web',
    date: 'Wednesday, October 30, 2025',
    time: '2:00 PM - 4:00 PM',
    description:
      'Create content on browser-based coding with parallel execution, GitHub integration, secure sandboxing. Screen record actual workflow.',
  },
  {
    title: 'YouTube Script: MCP Security Crisis',
    date: 'Thursday, October 31, 2025',
    time: '3:00 PM - 5:00 PM',
    description:
      'Educational content on tool poisoning attacks, threat explanation, mcp-scan tool demo. Focus on security awareness and protection.',
  },
];

/**
 * Parses a date string and time range into ISO 8601 datetime strings
 * @param dateStr - e.g., "Tuesday, October 29, 2025"
 * @param timeRange - e.g., "2:00 PM - 4:00 PM"
 * @returns Object with startDateTime and endDateTime in ISO format
 */
function parseDateTime(
  dateStr: string,
  timeRange: string
): { startDateTime: string; endDateTime: string } {
  // Parse the date (e.g., "Tuesday, October 29, 2025")
  const dateParts = dateStr.match(/(\w+),\s+(\w+)\s+(\d+),\s+(\d+)/);
  if (!dateParts) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  const [, , month, day, year] = dateParts;

  // Parse the time range (e.g., "2:00 PM - 4:00 PM")
  const timeParts = timeRange.match(/(\d+):(\d+)\s+(AM|PM)\s+-\s+(\d+):(\d+)\s+(AM|PM)/);
  if (!timeParts) {
    throw new Error(`Invalid time format: ${timeRange}`);
  }

  const [, startHour, startMin, startPeriod, endHour, endMin, endPeriod] = timeParts;

  // Convert to 24-hour format
  let start24Hour = parseInt(startHour);
  if (startPeriod === 'PM' && start24Hour !== 12) start24Hour += 12;
  if (startPeriod === 'AM' && start24Hour === 12) start24Hour = 0;

  let end24Hour = parseInt(endHour);
  if (endPeriod === 'PM' && end24Hour !== 12) end24Hour += 12;
  if (endPeriod === 'AM' && end24Hour === 12) end24Hour = 0;

  // Construct ISO datetime strings
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const monthIndex = monthNames.indexOf(month) + 1;
  const monthStr = monthIndex.toString().padStart(2, '0');
  const dayStr = day.padStart(2, '0');

  const startDateTime = `${year}-${monthStr}-${dayStr}T${start24Hour.toString().padStart(2, '0')}:${startMin}:00`;
  const endDateTime = `${year}-${monthStr}-${dayStr}T${end24Hour.toString().padStart(2, '0')}:${endMin}:00`;

  return { startDateTime, endDateTime };
}

/**
 * Main function to create all YouTube events
 */
async function main() {
  try {
    logger.info('Starting YouTube events creation...');

    // Authenticate with Google
    const auth = await getAuthenticatedClient();
    const calendar = google.calendar({ version: 'v3', auth });

    // Create each event
    for (const eventData of eventsToCreate) {
      const { startDateTime, endDateTime } = parseDateTime(eventData.date, eventData.time);

      logger.info(
        {
          title: eventData.title,
          start: startDateTime,
          end: endDateTime,
        },
        'Creating event...'
      );

      const createdEvent = await createCalendarEvent(calendar, {
        summary: eventData.title,
        description: eventData.description,
        startDateTime,
        endDateTime,
        timeZone: 'America/Los_Angeles', // Adjust if needed
      });

      logger.info(
        {
          id: createdEvent.id,
          link: createdEvent.htmlLink,
        },
        `✓ Created: ${eventData.title}`
      );
    }

    logger.info(`Successfully created ${eventsToCreate.length} calendar events!`);
  } catch (error) {
    logger.error({ error }, 'Failed to create calendar events');
    process.exit(1);
  }
}

// Run the script
main();

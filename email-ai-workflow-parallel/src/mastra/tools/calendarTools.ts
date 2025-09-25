import { authenticate } from '@google-cloud/local-auth';
import { createTool } from '@mastra/core/tools';
import { promises as fs } from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import path from 'path';
import { z } from 'zod';

// Configuration constants for Calendar API
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

// Build absolute paths for calendar credentials (matching Gmail pattern)
const CREDENTIALS_PATH = path.join(
  '/Volumes/PortableSSD/content/email-ai-workflow/credentials/calendar/',
  'credentials.json'
);
const TOKEN_PATH = path.join(
  '/Volumes/PortableSSD/content/email-ai-workflow/credentials/calendar/',
  'token.json'
);

async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
  try {
    // Create the directory if it doesn't exist
    await fs.mkdir(path.dirname(TOKEN_PATH), { recursive: true });
    const content = await fs.readFile(TOKEN_PATH, 'utf-8');
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials) as OAuth2Client;
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client: OAuth2Client): Promise<void> {
  console.log('reading calendar credentials from', CREDENTIALS_PATH);
  const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  // Ensure the directory exists before writing the token
  await fs.mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize(): Promise<OAuth2Client> {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

export const checkCalendarAvailabilityTool = createTool({
  id: 'check-calendar-availability',
  description: 'Checks calendar availability for scheduling meetings',
  inputSchema: z.object({
    startDate: z.string().describe('Start date in ISO format'),
    endDate: z.string().describe('End date in ISO format'),
    duration: z.number().describe('Meeting duration in minutes'),
  }),
  outputSchema: z.object({
    availableSlots: z.array(z.object({
      start: z.string(),
      end: z.string(),
    })),
    busySlots: z.array(z.object({
      start: z.string(),
      end: z.string(),
      title: z.string().optional(),
    })),
  }),
  execute: async ({ context, runtimeContext }) => {
    try {
      const auth = await authorize();
      const calendar = google.calendar({ version: 'v3', auth });

      console.log(`📅 Checking calendar availability from ${context.startDate} to ${context.endDate}`);

      // Query for busy times using the freebusy API
      const freeBusyResponse = await calendar.freebusy.query({
        requestBody: {
          timeMin: context.startDate,
          timeMax: context.endDate,
          items: [{ id: 'primary' }],
        },
      });

      const busySlots = [];
      const primaryCalendar = freeBusyResponse.data.calendars?.['primary'];

      if (primaryCalendar?.busy) {
        for (const busy of primaryCalendar.busy) {
          if (busy.start && busy.end) {
            busySlots.push({
              start: busy.start,
              end: busy.end,
              title: 'Busy',
            });
          }
        }
      }

      // Calculate available slots (simplified logic)
      const availableSlots = [];
      const startTime = new Date(context.startDate);
      const endTime = new Date(context.endDate);

      // Simple logic: create hourly slots that don't conflict with busy times
      const current = new Date(startTime);
      while (current < endTime) {
        const slotEnd = new Date(current.getTime() + context.duration * 60 * 1000);
        if (slotEnd <= endTime) {
          // Check if this slot conflicts with any busy time
          const hasConflict = busySlots.some(busy => {
            const busyStart = new Date(busy.start);
            const busyEnd = new Date(busy.end);
            return (current < busyEnd && slotEnd > busyStart);
          });

          if (!hasConflict) {
            availableSlots.push({
              start: current.toISOString(),
              end: slotEnd.toISOString(),
            });
          }
        }
        current.setHours(current.getHours() + 1); // Move to next hour
      }

      console.log(`📅 Found ${availableSlots.length} available slots and ${busySlots.length} busy slots`);

      return {
        availableSlots,
        busySlots,
      };
    } catch (error) {
      console.error('Error checking calendar availability:', error);
      // Fallback to basic available slots if API fails
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      return {
        availableSlots: [
          {
            start: new Date(tomorrow.setHours(10, 0, 0, 0)).toISOString(),
            end: new Date(tomorrow.setHours(11, 0, 0, 0)).toISOString(),
          },
        ],
        busySlots: [],
      };
    }
  },
});

export const createCalendarEventTool = createTool({
  id: 'create-calendar-event',
  description: 'Creates a calendar event for a meeting',
  inputSchema: z.object({
    title: z.string(),
    description: z.string().optional(),
    startTime: z.string().describe('Start time in ISO format'),
    endTime: z.string().describe('End time in ISO format'),
    attendees: z.array(z.string()).describe('Array of attendee email addresses'),
    location: z.string().optional(),
    sendNotifications: z.boolean().default(true),
  }),
  outputSchema: z.object({
    eventId: z.string(),
    eventUrl: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ context, runtimeContext }) => {
    try {
      const auth = await authorize();
      const calendar = google.calendar({ version: 'v3', auth });

      console.log(`📅 Creating calendar event: ${context.title}`);

      const event = {
        summary: context.title,
        description: context.description,
        location: context.location,
        start: {
          dateTime: context.startTime,
          timeZone: 'America/New_York', // You might want to make this configurable
        },
        end: {
          dateTime: context.endTime,
          timeZone: 'America/New_York',
        },
        attendees: context.attendees.map(email => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 10 }, // 10 minutes before
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        sendUpdates: context.sendNotifications ? 'all' : 'none',
      });

      console.log(`✅ Calendar event created successfully!`);
      console.log(`   Event ID: ${response.data.id}`);
      console.log(`   Event URL: ${response.data.htmlLink}`);

      return {
        eventId: response.data.id || '',
        eventUrl: response.data.htmlLink || '',
        success: true,
      };
    } catch (error) {
      console.error('Error creating calendar event:', error);
      return {
        eventId: '',
        eventUrl: '',
        success: false,
      };
    }
  },
});

export const suggestMeetingTimesTool = createTool({
  id: 'suggest-meeting-times',
  description: 'Suggests optimal meeting times based on calendar availability',
  inputSchema: z.object({
    duration: z.number().describe('Meeting duration in minutes'),
    daysAhead: z.number().default(7).describe('Number of days ahead to look'),
    preferredTimeStart: z.string().default('09:00').describe('Preferred start time (HH:MM)'),
    preferredTimeEnd: z.string().default('17:00').describe('Preferred end time (HH:MM)'),
    timezone: z.string().default('America/New_York'),
  }),
  outputSchema: z.object({
    suggestedTimes: z.array(z.object({
      start: z.string(),
      end: z.string(),
      dayOfWeek: z.string(),
      confidence: z.number().describe('Confidence score based on optimal timing'),
    })),
  }),
  execute: async ({ context, runtimeContext }) => {
    try {
      console.log(`📅 Suggesting meeting times:`);
      console.log(`   Duration: ${context.duration} minutes`);
      console.log(`   Looking ahead: ${context.daysAhead} days`);
      console.log(`   Preferred time: ${context.preferredTimeStart} - ${context.preferredTimeEnd}`);

      const suggestions = [];
      const now = new Date();

      for (let dayOffset = 1; dayOffset <= context.daysAhead; dayOffset++) {
        const targetDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);

        // Skip weekends for business meetings
        if (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
          continue;
        }

        // Parse preferred times
        const [startHour, startMinute] = context.preferredTimeStart.split(':').map(Number);
        const [endHour, endMinute] = context.preferredTimeEnd.split(':').map(Number);

        const dayStart = new Date(targetDate);
        dayStart.setHours(startHour, startMinute, 0, 0);

        const dayEnd = new Date(targetDate);
        dayEnd.setHours(endHour, endMinute, 0, 0);

        // Check availability for this day
        const availabilityResult = await checkCalendarAvailabilityTool.execute({
          context: {
            startDate: dayStart.toISOString(),
            endDate: dayEnd.toISOString(),
            duration: context.duration,
          },
          runtimeContext,
          tracingContext: {},
        });

        // Add available slots as suggestions with confidence scores
        availabilityResult.availableSlots.forEach((slot, index) => {
          const startTime = new Date(slot.start);
          const endTime = new Date(slot.end);

          // Calculate confidence based on time preferences and day distance
          let confidence = 0.9;

          // Lower confidence for later days
          confidence -= (dayOffset - 1) * 0.1;

          // Higher confidence for mid-morning slots
          const hour = startTime.getHours();
          if (hour >= 10 && hour <= 11) {
            confidence += 0.1;
          } else if (hour >= 14 && hour <= 15) {
            confidence += 0.05;
          }

          // Cap confidence
          confidence = Math.min(0.99, Math.max(0.1, confidence));

          suggestions.push({
            start: slot.start,
            end: slot.end,
            dayOfWeek: startTime.toLocaleDateString('en-US', { weekday: 'long' }),
            confidence,
          });
        });

        // Limit to reasonable number of suggestions
        if (suggestions.length >= 5) {
          break;
        }
      }

      // Sort by confidence
      suggestions.sort((a, b) => b.confidence - a.confidence);

      console.log(`📅 Generated ${suggestions.length} meeting time suggestions`);

      return { suggestedTimes: suggestions.slice(0, 5) }; // Return top 5
    } catch (error) {
      console.error('Error suggesting meeting times:', error);

      // Fallback to simple suggestions
      const now = new Date();
      const mockSuggestions = [];

      for (let i = 1; i <= 3; i++) {
        const futureDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
        // Skip weekends
        if (futureDate.getDay() === 0 || futureDate.getDay() === 6) {
          continue;
        }

        const startTime = new Date(futureDate.setHours(10 + (i % 3), 0, 0, 0));
        const endTime = new Date(startTime.getTime() + context.duration * 60 * 1000);

        mockSuggestions.push({
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          dayOfWeek: startTime.toLocaleDateString('en-US', { weekday: 'long' }),
          confidence: 0.8 - (i * 0.1),
        });
      }

      return { suggestedTimes: mockSuggestions };
    }
  },
});
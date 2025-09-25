import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import {
  checkCalendarAvailabilityTool,
  createCalendarEventTool,
  suggestMeetingTimesTool,
} from '../tools/calendarTools';
export const calendarAgent = new Agent({
  name: 'Calendar Agent',
  description: 'Creates meetings and manages calendar events',
  instructions: `
    You are a helpful assistant that creates and manages calendar events. 
    When asked to schedule a meeting:
    1. Always check calendar availability first.
    2. If the requested time is available, schedule the meeting.
    3. If the requested time is not available, automatically find the closest available timeslot 
       using the suggestMeetingTimesTool. Pick the best available option and create the event.
    4. Do not ask the user again if no exact slot is free — resolve conflicts by picking the best alternative.
    5. Always confirm the created event details back to the user (title, time, attendees, and link).
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    createCalendarEventTool,
    checkCalendarAvailabilityTool,
    suggestMeetingTimesTool,
  },
});

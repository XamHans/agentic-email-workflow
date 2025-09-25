import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

const tokenPath = path.join(process.cwd(), "token.json");

const getCalendarClient = () => {
  const token = JSON.parse(fs.readFileSync(tokenPath, "utf8"));

  const oauth2Client = new google.auth.OAuth2(
    token.client_id,
    token.client_secret,
    "urn:ietf:wg:oauth:2.0:oob"
  );

  oauth2Client.setCredentials({
    refresh_token: token.refresh_token,
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
};

export const createCalendarEventTool = createTool({
  id: "create-calendar-event",
  description: "Creates a calendar event for meetings",
  inputSchema: z.object({
    summary: z.string().describe("Event title/summary"),
    description: z.string().optional().describe("Event description"),
    startDateTime: z.string().describe("Start date and time in ISO format"),
    endDateTime: z.string().describe("End date and time in ISO format"),
    attendeeEmails: z.array(z.string()).describe("List of attendee email addresses"),
    location: z.string().optional().describe("Meeting location or video link"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    eventId: z.string().optional(),
    htmlLink: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const calendar = getCalendarClient();

    const event = {
      summary: context.summary,
      description: context.description,
      location: context.location,
      start: {
        dateTime: context.startDateTime,
        timeZone: "America/Los_Angeles", // You can make this configurable
      },
      end: {
        dateTime: context.endDateTime,
        timeZone: "America/Los_Angeles", // You can make this configurable
      },
      attendees: context.attendeeEmails.map(email => ({ email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 }, // 1 day before
          { method: "popup", minutes: 10 }, // 10 minutes before
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
    });

    return {
      success: true,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
    };
  },
});
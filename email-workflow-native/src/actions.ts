// src/actions.ts
import { promises as fs } from 'fs';
import { google } from 'googleapis';
import * as ai from './ai';
import { logAction } from './audit'; // Import the new audit logger
import { Email } from './gmail'; // Use the updated Email interface
import logger from './logger';

type Gmail = ReturnType<typeof google.gmail>;
type Calendar = ReturnType<typeof google.calendar>;

/**
 * Generates an AI reply and sends it using the Gmail API.
 */
export async function handleReply(gmail: Gmail, email: Email) {
  const { object: reply } = await ai.generateReply(email.body);
  await logAction({
    emailId: email.id,
    subject: email.subject,
    intent: 'reply',
    action: 'Generated AI reply',
    details: `Reply subject: ${reply.subject}`,
  });

  // RFC 2822 formatted email for the API.
  const emailLines = [
    `To: ${email.from}`,
    `Subject: ${reply.subject}`,
    `In-Reply-To: ${email.messageIdHeader}`, // For correct threading
    `References: ${email.messageIdHeader}`, // For correct threading
    'Content-Type: text/plain; charset=utf-8',
    '',
    reply.body,
  ];
  const rawEmail = Buffer.from(emailLines.join('\r\n')).toString('base64url');

  try {
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawEmail,
        threadId: email.threadId, // Ensures reply stays in the same conversation
      },
    });
    logger.info({ emailId: email.id }, 'Successfully sent reply');
    await logAction({
      emailId: email.id,
      subject: email.subject,
      intent: 'reply',
      action: 'Sent reply via Gmail API',
    });
  } catch (error) {
    logger.error({ error, emailId: email.id }, 'Failed to send reply');
    await logAction({
      emailId: email.id,
      subject: email.subject,
      intent: 'reply',
      action: 'ERROR: Failed to send reply',
      details: (error as Error).message,
    });
  }
}

import { calendar_v3 } from 'googleapis';

/**
 * Extracts meeting details and creates an event in Google Calendar.
 */
export async function handleMeeting(
  calendar: calendar_v3.Calendar,
  email: Email
) {
  // Ask the AI to extract meeting details
  const { object: meetingDetails } = await ai.generateMeetingDetails(email.body);

  // Parse the ISO date string and calculate end time with error handling
  let startTime: Date;
  let endTime: Date;

  try {
    startTime = new Date(meetingDetails.dateTime);

    // Validate that the parsed date is valid
    if (isNaN(startTime.getTime())) {
      throw new Error(`Invalid date format: ${meetingDetails.dateTime}`);
    }

    // Calculate end time
    endTime = new Date(startTime.getTime() + (meetingDetails.durationMinutes * 60 * 1000));

    // Validate that the meeting is in the future
    const now = new Date();
    if (startTime <= now) {
      throw new Error(`Meeting time ${meetingDetails.dateTime} is not in the future`);
    }
  } catch (dateError) {
    throw new Error(`Failed to parse meeting date/time: ${(dateError as Error).message}`);
  }

  // Create Google Calendar event format
  const event: calendar_v3.Schema$Event = {
    summary: meetingDetails.title,
    description: `Generated from email: "${email.subject}"\n\n---\n${email.body}`,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: 'UTC',
    },
    attendees: [
      { email: email.from }, // Always include sender
    ],
  };

  // Log action before inserting
  await logAction({
    emailId: email.id,
    subject: email.subject,
    intent: 'meeting',
    action: 'Generated meeting details',
    details: `Title: ${meetingDetails.title}, when: ${meetingDetails.dateTime}`,
  });

  try {
    await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    logger.info(
      { emailId: email.id, eventTitle: event.summary },
      'Successfully scheduled meeting'
    );

    await logAction({
      emailId: email.id,
      subject: email.subject,
      intent: 'meeting',
      action: 'Created calendar event',
      details: `Event: ${event.summary}`,
    });
  } catch (error) {
    logger.error({ error, emailId: email.id }, 'Failed to schedule meeting');
    await logAction({
      emailId: email.id,
      subject: email.subject,
      intent: 'meeting',
      action: 'ERROR: Failed to create event',
      details: (error as Error).message,
    });
  }
}

/**
 * Saves the email content to a local markdown file for manual review.
 */
export async function handleHumanReview(email: Email) {
  await logAction({
    emailId: email.id,
    subject: email.subject,
    intent: 'human_review',
    action: 'Saving to local file',
  });
  logger.info({ emailId: email.id }, 'Saving for human review');

  const reviewContent = `---
Subject: ${email.subject}
From: ${email.from}
Date: ${new Date().toISOString()}
---

${email.body}`;

  await fs.mkdir('./review', { recursive: true });
  await fs.writeFile(`./review/${email.id}.md`, reviewContent);
}

/**
 * Archives the email by removing it from the inbox and marking it as read.
 */
export async function handleArchive(gmail: Gmail, email: Email) {
  await logAction({
    emailId: email.id,
    subject: email.subject,
    intent: 'archive',
    action: 'Archiving email',
  });
  logger.info({ emailId: email.id }, 'Archiving email');

  await gmail.users.messages.modify({
    userId: 'me',
    id: email.id,
    requestBody: {
      // To "archive," we remove the INBOX label. We also mark as read.
      removeLabelIds: ['UNREAD', 'INBOX'],
    },
  });
}

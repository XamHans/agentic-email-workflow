// src/gmail.ts
import { google } from 'googleapis';
import logger from './logger';

// A simplified type for the Gmail client instance
type Gmail = ReturnType<typeof google.gmail>;

// Define a clear structure for the email data we'll use, including headers for replying
export interface Email {
  id: string;
  threadId: string;
  subject: string;
  body: string;
  from: string; // 'From' header to use as 'To' in the reply
  messageIdHeader: string; // 'Message-ID' header for threading
}

/**
 * Fetches all unread emails from the user's inbox.
 * @param gmail The authenticated Gmail API client.
 * @returns A promise that resolves to an array of Email objects.
 */
export async function getUnreadEmails(gmail: Gmail): Promise<Email[]> {
  logger.info('Fetching unread emails...');

  // 1. List messages that are unread
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread', // Query to filter for unread messages
  });

  const messages = listResponse.data.messages;
  if (!messages || messages.length === 0) {
    logger.info('No unread emails found.');
    return [];
  }

  logger.info(`Found ${messages.length} unread emails. Fetching details...`);

  // 2. Fetch the full details for each message concurrently
  const emailPromises = messages.map(async (message) => {
    if (message.id) {
      try {
        const msgResponse = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full', // 'full' gives us headers and the decoded body
        });

        // 3. Parse the message to extract subject and body
        return parseEmail(msgResponse.data);
      } catch (error) {
        logger.error(
          { error, messageId: message.id },
          'Failed to fetch or parse email'
        );
        return null; // Return null for failed emails
      }
    }
    return null;
  });

  const emails = await Promise.all(emailPromises);

  // Filter out any nulls from failed fetches and ensure all elements are valid
  return emails.filter((email): email is Email => email !== null);
}

/**
 * Parses a raw Gmail API message object into our simplified Email format.
 * @param messageData The raw data object from the Gmail API.
 * @returns An Email object.
 */
function parseEmail(messageData: any): Email {
  const headers = messageData.payload.headers;
  // Helper to safely get a header value
  const getHeader = (name: string) =>
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())
      ?.value || '';

  const subject = getHeader('Subject');
  const from = getHeader('From');
  const messageIdHeader = getHeader('Message-ID');

  let body = '';
  const parts = messageData.payload.parts;

  // Emails can be multipart (e.g., plain text and HTML). We prioritize plain text.
  if (parts) {
    const textPart = parts.find((part: any) => part.mimeType === 'text/plain');
    if (textPart && textPart.body && textPart.body.data) {
      // Body is base64 encoded, so we need to decode it
      body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
    } else {
      // Fallback for emails without a plain text part or other structures
      const htmlPart = parts.find((part: any) => part.mimeType === 'text/html');
      if (htmlPart && htmlPart.body && htmlPart.body.data) {
        body = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
      }
    }
  } else if (messageData.payload.body && messageData.payload.body.data) {
    // For simple, non-multipart emails
    body = Buffer.from(messageData.payload.body.data, 'base64').toString(
      'utf-8'
    );
  }

  return {
    id: messageData.id,
    threadId: messageData.threadId,
    subject,
    body: body.trim(), // Trim whitespace from the body
    from,
    messageIdHeader,
  };
}

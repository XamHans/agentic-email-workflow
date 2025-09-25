import { authenticate } from '@google-cloud/local-auth';
import { createTool } from '@mastra/core/tools';
import { promises as fs } from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import path from 'path';
import { z } from 'zod';
import { EmailMessageSchema } from '../types/email';

// --- START OF CHANGES ---

// Configuration constants
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];

// Build an absolute path from the project's root directory (process.cwd())
const CREDENTIALS_PATH = path.join(
  '/Volumes/PortableSSD/content/email-ai-workflow/credentials/gmail/',

  'credentials.json'
);
const TOKEN_PATH = path.join(
  '/Volumes/PortableSSD/content/email-ai-workflow/credentials/gmail/',

  'token.json'
);

// --- END OF CHANGES ---gmail

async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
  try {
    // Create the directory if it doesn't exist, especially for the token
    await fs.mkdir(path.dirname(TOKEN_PATH), { recursive: true });
    const content = await fs.readFile(TOKEN_PATH, 'utf-8');
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials) as OAuth2Client;
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client: OAuth2Client): Promise<void> {
  console.log('reading from', CREDENTIALS_PATH);
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

export const fetchUnreadEmailsTool = createTool({
  id: 'fetch-unread-emails',
  description: 'Fetches unread emails from Gmail from the last 2 days',
  inputSchema: z.object({
    maxResults: z.number().default(10).optional(),
  }),
  outputSchema: z.object({
    emails: z.array(EmailMessageSchema),
    totalCount: z.number(),
  }),
  execute: async ({ context }) => {
    const auth = await authorize();
    const gmail = google.gmail({ version: 'v1', auth });

    // Use the same query from your existing code
    const query = 'is:unread ';

    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: context.maxResults || 10,
    });

    const messages = res.data.messages;
    if (!messages || messages.length === 0) {
      return { emails: [], totalCount: 0 };
    }

    const emails = [];
    for (const message of messages) {
      if (message.id) {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full',
        });

        const headers = msg.data.payload?.headers;
        const subject = headers?.find((h) => h.name === 'Subject')?.value || '';
        const from = headers?.find((h) => h.name === 'From')?.value || '';
        const date = headers?.find((h) => h.name === 'Date')?.value;

        // Extract email body
        let body = '';
        if (msg.data.payload) {
          if (msg.data.payload.body?.data) {
            body = Buffer.from(msg.data.payload.body.data, 'base64').toString();
          } else if (msg.data.payload.parts) {
            const textPart = msg.data.payload.parts.find(
              (part) => part.mimeType === 'text/plain'
            );
            if (textPart?.body?.data) {
              body = Buffer.from(textPart.body.data, 'base64').toString();
            }
          }
        }

        emails.push({
          id: message.id,
          subject,
          from,
          body,
          timestamp: date ? new Date(date) : new Date(),
          threadId: msg.data.threadId || undefined,
        });
      }
    }

    return { emails, totalCount: emails.length };
  },
});

export const sendEmailTool = createTool({
  id: 'send-email',
  description: 'Sends an email response using Gmail API',
  inputSchema: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
    threadId: z.string().optional(),
    inReplyTo: z.string().optional(),
  }),
  outputSchema: z.object({
    messageId: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ context }) => {
    const auth = await authorize();
    const gmail = google.gmail({ version: 'v1', auth });

    // Create email message
    const headers = [
      `To: ${context.to}`,
      `Subject: ${context.subject}`,
      'Content-Type: text/plain; charset=utf-8',
    ];

    if (context.inReplyTo) {
      headers.push(`In-Reply-To: ${context.inReplyTo}`);
    }

    const email = [...headers, '', context.body].join('\n');

    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const request: any = {
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
      },
    };

    if (context.threadId) {
      request.requestBody.threadId = context.threadId;
    }

    const result = await gmail.users.messages.send(request);

    return {
      messageId: result.data.id || '',
      success: true,
    };
  },
});

export const markEmailAsReadTool = createTool({
  id: 'mark-email-read',
  description: 'Marks an email as read in Gmail',
  inputSchema: z.object({
    messageId: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async ({ context }) => {
    const auth = await authorize();
    const gmail = google.gmail({ version: 'v1', auth });

    try {
      await gmail.users.messages.modify({
        userId: 'me',
        id: context.messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Error marking email as read:', error);
      return { success: false };
    }
  },
});

export const archiveEmailTool = createTool({
  id: 'archive-email',
  description: 'Archives an email by removing it from inbox',
  inputSchema: z.object({
    messageId: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async ({ context }) => {
    const auth = await authorize();
    const gmail = google.gmail({ version: 'v1', auth });

    try {
      await gmail.users.messages.modify({
        userId: 'me',
        id: context.messageId,
        requestBody: {
          removeLabelIds: ['INBOX'],
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Error archiving email:', error);
      return { success: false };
    }
  },
});

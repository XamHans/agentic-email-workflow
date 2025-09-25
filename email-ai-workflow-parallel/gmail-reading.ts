import { authenticate } from '@google-cloud/local-auth';
import { promises as fs } from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import path from 'path';

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 */
async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
  try {
    const content = await fs.readFile(TOKEN_PATH, 'utf-8');
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials) as OAuth2Client;
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 */
async function saveCredentials(client: OAuth2Client): Promise<void> {
  const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 */
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

/**
 * Lists unread messages from the last 2 days.
 *
 * @param {OAuth2Client} auth An authorized OAuth2 client.
 */
async function listRecentUnreadMessages(auth: OAuth2Client) {
  const gmail = google.gmail({ version: 'v1', auth });

  // Use the 'q' parameter for server-side filtering.
  // This query finds messages that are unread AND newer than 2 days.
  const query = 'is:unread newer_than:2d';

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
  });

  const messages = res.data.messages;
  if (!messages || messages.length === 0) {
    console.log('No new unread messages in the last 2 days.');
    return;
  }

  console.log('Recent unread messages:');
  for (const message of messages) {
    if (message.id) {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'metadata', // Fetch only metadata (headers) for efficiency
        metadataHeaders: ['Subject', 'From'],
      });

      const headers = msg.data.payload?.headers;
      if (headers) {
        const subject = headers.find(
          (header) => header.name === 'Subject'
        )?.value;
        const from = headers.find((header) => header.name === 'From')?.value;
        console.log(`- From: ${from}, Subject: ${subject}`);
      }
    }
  }
}

authorize().then(listRecentUnreadMessages).catch(console.error);

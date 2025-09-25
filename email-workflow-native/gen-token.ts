/*
================================================================================
TUTORIAL: Agentic Workflows - Chapter: Email and Calendar Integration
================================================================================

This script demonstrates how to create a secure and robust Express.js server
that can authenticate with Google APIs (like Gmail and Calendar) on behalf of a user.

HOW TO RUN THIS SCRIPT:
1.  Install Dependencies:
    npm install express googleapis @google-cloud/local-auth
    npm install -D @types/express @types/node typescript ts-node

2.  Get Credentials:
    - Go to the Google Cloud Console and create a project.
    - Enable the "Gmail API" and "Google Calendar API".
    - Go to "Credentials", create an "OAuth 2.0 Client ID" for a "Desktop app".
    - Download the credentials JSON file and save it as `credentials.json` in the same
      directory as this script.

3.  Run the Server:
    npx ts-node server.ts

4.  First-Time Authentication:
    - The script will automatically open your web browser.
    - Log in to your Google account and grant the requested permissions.
    - After you approve, you'll be redirected to a success page, and a `token.json`
      file will be created in your project directory.

5.  Using the API:
    - You can now access the API endpoints like http://localhost:3000/list-emails.
    - On all subsequent runs, the server will use the `token.json` file and you
      won't need to log in again.
*/

// --- 1. IMPORTS ---
// We import the necessary libraries to create the server, handle files, and interact with Google APIs.
import { authenticate } from '@google-cloud/local-auth';
import express from 'express';
import { promises as fs } from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import path from 'path';

// --- 2. CONFIGURATION ---
// We define constants here for easy configuration.

// The port our Express server will listen on.
const PORT = 3000;

// The SCOPES define what permissions our application will request from the user.
// IMPORTANT: If you change the scopes, you MUST delete the `token.json` file to
// force the user to re-authorize with the new permissions.
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly', // View your emails
  'https://www.googleapis.com/auth/gmail.send', // Send emails on your behalf
  'https://www.googleapis.com/auth/gmail.modify', // Add this scope to modify emails (e.g., archiving)
  'https://www.googleapis.com/auth/calendar', // Manage your calendars
];

// We create absolute paths to our credentials and token files.
// Using `process.cwd()` makes the script runnable from any directory.
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'token.json');

// This will hold our authenticated client instance globally after authorization.
let auth: OAuth2Client;

// --- 3. AUTHENTICATION LOGIC ---
// These functions handle the entire OAuth 2.0 flow.

async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
  try {
    const content = await fs.readFile(TOKEN_PATH, 'utf-8');
    const credentials = JSON.parse(content);

    // build client manually
    const oAuth2Client = new OAuth2Client(
      credentials.client_id,
      credentials.client_secret
    );

    oAuth2Client.setCredentials({
      refresh_token: credentials.refresh_token,
    });

    return oAuth2Client;
  } catch (err) {
    console.log('No saved token found or token is invalid.');
    return null;
  }
}

/**
 * Saves the user's credentials (especially the refresh_token) to `token.json`.
 * The refresh_token is a long-lived credential that allows our application
 * to obtain new access_tokens without asking the user to log in again.
 * @param {OAuth2Client} client The authorized client instance.
 */
async function saveCredentials(client: OAuth2Client): Promise<void> {
  // Read the client secrets from our credentials.json file.
  const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;

  // Construct the payload to save. It includes the client ID, client secret,
  // and the crucial refresh_token.
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });

  // Write the payload to our token.json file.
  await fs.writeFile(TOKEN_PATH, payload);
  console.log('Authentication token has been saved to:', TOKEN_PATH);
}

/**
 * The main authorization function. It orchestrates the entire flow.
 * 1. It first tries to load a saved token.
 * 2. If no token exists, it starts the interactive, browser-based authentication flow.
 * 3. After a successful new authentication, it saves the credentials for future use.
 * @returns {Promise<OAuth2Client>} A fully authenticated OAuth2Client.
 */
async function authorize(): Promise<OAuth2Client> {
  // Try to load saved credentials first.
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }

  // If we couldn't load a client, we must authenticate from scratch.
  // The `authenticate` function from `@google-cloud/local-auth` handles everything:
  // - Starting a temporary local server to catch the redirect.
  // - Opening the user's browser to the consent screen.
  // - Exchanging the authorization code for tokens.
  console.log('Starting new authentication flow...');
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });

  // After the user has authenticated, save the new credentials.
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

// --- 4. API ACTION FUNCTIONS ---
// These functions perform specific actions using the Google APIs.
// They are kept separate from the Express routes for better organization.

/**
 * Fetches the 5 most recent unread emails from the user's inbox.
 * @param {OAuth2Client} authClient An authorized OAuth2 client.
 */
async function listUnreadEmails(authClient: OAuth2Client) {
  const gmail = google.gmail({ version: 'v1', auth: authClient });
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread',
    maxResults: 5,
  });
  console.log(
    'Emails fetched successfully.',
    JSON.stringify(res.data, null, 2)
  );
  return res.data.messages || [];
}

/**
 * Creates a new event in the user's primary Google Calendar.
 * @param {OAuth2Client} authClient An authorized OAuth2 client.
 */
async function createCalendarEvent(authClient: OAuth2Client) {
  const calendar = google.calendar({ version: 'v3', auth: authClient });
  const event = {
    summary: 'Test Event from Node.js',
    description: 'This is a sample event created by the tutorial server.',
    start: {
      dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      timeZone: 'UTC',
    },
    end: {
      dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
      timeZone: 'UTC',
    },
  };
  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
  });
  return res.data;
}

// --- 5. EXPRESS SERVER SETUP ---
// Here we define our API endpoints.

const app = express();

// A simple root route to provide a status message and links to other endpoints.
app.get('/', (req, res) => {
  res.send(`
    <h1>Google API Server is Authenticated and Running!</h1>
    <p>The server has successfully authenticated and is ready to use.</p>
    <h3>Available API Endpoints:</h3>
    <ul>
      <li><a href="/list-emails">GET /list-emails</a> - Lists 5 recent unread emails.</li>
      <li><a href="/create-event">GET /create-event</a> - Creates a sample event in your calendar.</li>
    </ul>
  `);
});

// An endpoint to list unread emails.
app.get('/list-emails', async (req, res) => {
  try {
    const emails = await listUnreadEmails(auth);
    res.json({ message: 'Successfully fetched emails.', data: emails });
  } catch (error) {
    console.error('The API returned an error: ', error);
    res.status(500).send('Failed to retrieve emails.');
  }
});

// An endpoint to create a calendar event.
app.get('/create-event', async (req, res) => {
  try {
    const event = await createCalendarEvent(auth);
    res.json({ message: 'Successfully created event.', data: event });
  } catch (error) {
    console.error('The API returned an error: ', error);
    res.status(500).send('Failed to create event.');
  }
});

// --- 6. SERVER INITIALIZATION ---
// This is the main entry point of our application.

// We must complete the authorization process *before* we start the server.
// This ensures that the global `auth` client is ready before any API requests come in.
authorize()
  .then((client) => {
    // Store the authenticated client globally for our Express routes to use.
    auth = client;
    // Now that we are authenticated, we can start the Express server.
    app.listen(PORT, () => {
      console.log(`\nServer is running at http://localhost:${PORT}`);
      console.log(
        'Authentication was successful. The server is ready to accept requests.'
      );
    });
  })
  .catch((err) => {
    // If authorization fails for any reason, we log the error and exit.
    console.error('Failed to authorize and start the server:', err);
    process.exit(1);
  });

#!/usr/bin/env npx tsx

import { authenticate } from '@google-cloud/local-auth';
import { promises as fs } from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import path from 'path';
import readline from 'readline';

// Get the project root directory (go up one level from scripts/)
const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Configuration for different Google services
const SERVICES = {
  gmail: {
    name: 'Gmail',
    scopes: ['https://www.googleapis.com/auth/gmail.modify'] as string[],
    credentialsPath: path.join(PROJECT_ROOT, 'credentials', 'gmail', 'credentials.json'),
    tokenPath: path.join(PROJECT_ROOT, 'credentials', 'gmail', 'token.json'),
  },
  calendar: {
    name: 'Google Calendar',
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ] as string[],
    credentialsPath: path.join(PROJECT_ROOT, 'credentials', 'calendar', 'credentials.json'),
    tokenPath: path.join(PROJECT_ROOT, 'credentials', 'calendar', 'token.json'),
  },
};

type ServiceType = keyof typeof SERVICES;

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function loadSavedCredentialsIfExist(tokenPath: string): Promise<OAuth2Client | null> {
  try {
    const content = await fs.readFile(tokenPath, 'utf-8');
    const credentials = JSON.parse(content);
    const auth = google.auth.fromJSON(credentials);
    return auth as OAuth2Client;
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client: OAuth2Client, service: ServiceType): Promise<void> {
  const { credentialsPath, tokenPath } = SERVICES[service];

  console.log(`📖 Reading credentials from ${credentialsPath}`);
  const content = await fs.readFile(credentialsPath, 'utf-8');
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;

  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });

  // Ensure the directory exists
  await fs.mkdir(path.dirname(tokenPath), { recursive: true });
  await fs.writeFile(tokenPath, payload);
  console.log(`✅ Token saved to ${tokenPath}`);
}

async function authorize(service: ServiceType): Promise<OAuth2Client> {
  const { credentialsPath, tokenPath, scopes, name } = SERVICES[service];

  console.log(`\n🔐 Authorizing ${name}...`);

  // Check if we have existing credentials
  let client = await loadSavedCredentialsIfExist(tokenPath);
  if (client) {
    console.log(`✅ Found existing ${name} token`);

    // Test if the token is still valid
    try {
      await client.getAccessToken();
      console.log(`✅ ${name} token is valid`);
      return client;
    } catch (error) {
      console.log(`⚠️ ${name} token is expired or invalid, refreshing...`);

      // Try to refresh the token
      try {
        await client.refreshAccessToken();
        await saveCredentials(client, service);
        console.log(`✅ ${name} token refreshed successfully`);
        return client;
      } catch (refreshError) {
        console.log(`❌ Failed to refresh ${name} token, need to re-authenticate`);
      }
    }
  }

  // Need fresh authentication
  console.log(`🌐 Opening browser for ${name} authentication...`);
  console.log(`📋 Required scopes: ${scopes.join(', ')}`);

  const newClient = await authenticate({
    scopes: scopes,
    keyfilePath: credentialsPath,
  }) as OAuth2Client;

  if (newClient.credentials) {
    await saveCredentials(newClient as any, service);
    console.log(`✅ ${name} authenticated successfully!`);
  }

  return newClient;
}

async function testGmailConnection(client: OAuth2Client): Promise<boolean> {
  try {
    const gmail = google.gmail({ version: 'v1', auth: client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log(`📧 Gmail connected - Email: ${profile.data.emailAddress}`);
    return true;
  } catch (error) {
    console.log(`❌ Gmail connection test failed:`, error);
    return false;
  }
}

async function testCalendarConnection(client: OAuth2Client): Promise<boolean> {
  try {
    const calendar = google.calendar({ version: 'v3', auth: client });
    const calendars = await calendar.calendarList.list({ maxResults: 1 });
    const primaryCalendar = calendars.data.items?.[0];
    console.log(`📅 Calendar connected - Primary calendar: ${primaryCalendar?.summary}`);
    return true;
  } catch (error) {
    console.log(`❌ Calendar connection test failed:`, error);
    return false;
  }
}

interface ProcessingResult {
  service: string;
  success: boolean;
  tested: boolean;
  error?: string;
}

async function generateTokens(services: ServiceType[]): Promise<void> {
  console.log('🚀 Google API Token Generator');
  console.log('================================');

  const results: ProcessingResult[] = [];

  for (const service of services) {
    try {
      const client = await authorize(service);

      // Test the connection
      let testResult = false;
      if (service === 'gmail') {
        testResult = await testGmailConnection(client);
      } else if (service === 'calendar') {
        testResult = await testCalendarConnection(client);
      }

      results.push({
        service: SERVICES[service].name,
        success: true,
        tested: testResult,
      });

    } catch (error) {
      console.log(`❌ Failed to authorize ${SERVICES[service].name}:`, error);
      results.push({
        service: SERVICES[service].name,
        success: false,
        tested: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Summary
  console.log('\n📊 Summary');
  console.log('===========');
  results.forEach((result) => {
    const status = result.success ? '✅' : '❌';
    const tested = result.tested ? '(API Tested)' : result.success ? '(Not Tested)' : '';
    console.log(`${status} ${result.service} ${tested}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
}

async function main(): Promise<void> {
  try {
    console.log('🔑 Google API Token Generator');
    console.log('==============================\n');

    console.log('Which service(s) would you like to authenticate?');
    console.log('1. Gmail only');
    console.log('2. Google Calendar only');
    console.log('3. Both Gmail and Calendar');
    console.log('4. Exit');

    const choice = await ask('\nEnter your choice (1-4): ');

    let services: ServiceType[] = [];

    switch (choice.trim()) {
      case '1':
        services = ['gmail'];
        break;
      case '2':
        services = ['calendar'];
        break;
      case '3':
        services = ['gmail', 'calendar'];
        break;
      case '4':
        console.log('👋 Goodbye!');
        process.exit(0);
        break;
      default:
        console.log('❌ Invalid choice. Please run the script again.');
        process.exit(1);
    }

    if (services.length === 0) {
      console.log('❌ No services selected.');
      process.exit(1);
    }

    console.log(`\n🎯 Selected services: ${services.map(s => SERVICES[s].name).join(', ')}`);
    console.log('\n⚠️  Note: This will open your browser for OAuth consent.');
    console.log('Make sure you have the required credentials.json files in place.\n');

    const confirm = await ask('Continue? (y/N): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('🚫 Operation cancelled.');
      return;
    }

    await generateTokens(services);

  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}
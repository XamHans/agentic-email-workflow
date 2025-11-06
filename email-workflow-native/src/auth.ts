// src/auth.ts
import { promises as fs } from 'fs';
import { google } from 'googleapis';
import * as path from 'path';
import logger from './logger';

const TOKEN_PATH = path.join(__dirname, '..', 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json'); // Store your client credentials here

export async function getAuthenticatedClient() {
  try {
    const credentials = JSON.parse(
      await fs.readFile(CREDENTIALS_PATH, 'utf-8')
    );
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    const token = JSON.parse(await fs.readFile(TOKEN_PATH, 'utf-8'));
    oAuth2Client.setCredentials(token);

    logger.info('Successfully authenticated with Google APIs');
    return oAuth2Client;
  } catch (error) {
    logger.error({ error }, 'Failed to authenticate with Google');
    throw error;
  }
}

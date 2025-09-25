// src/audit.ts
import { promises as fs } from 'fs';
import { EOL } from 'os'; // End-of-line constant for cross-platform compatibility
import logger from './logger';

const AUDIT_FILE_PATH = './audit_log.csv';
const CSV_HEADER = 'timestamp,emailId,subject,intent,action,details' + EOL;

/**
 * Escapes a string for safe inclusion in a CSV file.
 * Wraps the string in double quotes if it contains commas, quotes, or newlines.
 */
const escapeCsv = (value: string | undefined): string => {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Logs a record of an action taken on an email to a CSV file.
 */
export async function logAction(data: {
  emailId: string;
  subject: string;
  intent: 'reply' | 'meeting' | 'archive' | 'human_review' | 'error';
  action: string;
  details?: string;
}) {
  const timestamp = new Date().toISOString();
  const { emailId, subject, intent, action, details } = data;

  const row =
    [timestamp, emailId, subject, intent, action, details]
      .map(escapeCsv)
      .join(',') + EOL;

  try {
    // Ensure the file exists and has a header
    try {
      await fs.access(AUDIT_FILE_PATH);
    } catch {
      await fs.writeFile(AUDIT_FILE_PATH, CSV_HEADER);
      logger.info('Created new audit log file: audit_log.csv');
    }
    // Append the new action
    await fs.appendFile(AUDIT_FILE_PATH, row);
  } catch (error) {
    logger.error({ error, ...data }, 'Failed to write to audit log');
  }
}

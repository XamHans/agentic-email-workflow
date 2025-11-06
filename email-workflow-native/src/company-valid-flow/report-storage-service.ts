// src/company-valid-flow/report-storage-service.ts
import { randomBytes, randomUUID, scryptSync } from 'crypto';
import { getDatabase } from '../db/client';
import { verificationReports } from '../db/schema';
import type { LogFn, ShareableReport, VerificationReport } from './types';

const DEFAULT_BASE_URL = 'https://verification.local/report';

export async function storeVerificationReport(
  report: VerificationReport,
  log: LogFn
): Promise<ShareableReport> {
  const reportId = randomUUID();
  const accessPassword = generateAccessPassword();
  const { hash, salt } = hashPassword(accessPassword);

  const db = getDatabase();

  try {
    await db.insert(verificationReports).values({
      id: reportId,
      report,
      passwordHash: hash,
      salt,
    });
  } catch (error) {
    log('Failed to store verification report in Neon', error);
    throw error;
  }

  const shareableLink = buildShareableLink(reportId);

  log(`Report stored in Neon. Shareable link ready.`);

  return {
    reportId,
    shareableLink,
    accessPassword,
  };
}

function generateAccessPassword() {
  return randomBytes(6).toString('base64url');
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const buffer = scryptSync(password, salt, 32);
  return { hash: buffer.toString('hex'), salt };
}

function buildShareableLink(reportId: string) {
  const baseUrl = process.env.REPORT_BASE_URL ?? DEFAULT_BASE_URL;
  return `${baseUrl}/${reportId}`;
}

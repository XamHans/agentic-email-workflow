// src/company-valid-flow/email-notification-service.ts
import { randomUUID } from 'crypto';
import type {
  LogFn,
  NotificationResult,
  ShareableReport,
  VerificationReport,
} from './types';

export async function sendShareableLinkEmail(
  recipientEmail: string,
  report: VerificationReport,
  shareable: ShareableReport,
  log: LogFn
): Promise<NotificationResult> {
  log(
    `Sending shareable report link to ${recipientEmail}: ${shareable.shareableLink}`
  );

  await new Promise((resolve) => setTimeout(resolve, 500));

  log(
    `Email ready with subject "Verification report for ${report.sources.identity.legalName}"`
  );

  return {
    messageId: randomUUID(),
    recipient: recipientEmail,
  };
}

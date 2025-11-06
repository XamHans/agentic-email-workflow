// src/core/email-service.ts
import { google } from 'googleapis';
import logger from '../logger';
import { YouTubeScript } from './youtube-script-generator';

type Gmail = ReturnType<typeof google.gmail>;

export interface ContentSummary {
  eventTitle: string;
  eventDate?: string;
  topic: string;
  script: YouTubeScript;
  calendarLink?: string;
  success: boolean;
  error?: string;
}

/**
 * Sends a summary email with all generated content scripts
 */
export async function sendContentSummaryEmail(
  gmail: Gmail,
  toEmail: string,
  summaries: ContentSummary[]
): Promise<void> {
  logger.info({ toEmail, count: summaries.length }, 'Sending content summary email...');

  const successfulSummaries = summaries.filter((s) => s.success);
  const failedSummaries = summaries.filter((s) => !s.success);

  const emailBody = formatSummaryEmail(successfulSummaries, failedSummaries);
  const subject = `📹 YouTube Scripts Generated - ${successfulSummaries.length} Content Ideas Ready`;

  const emailLines = [
    `To: ${toEmail}`,
    `From: me`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    emailBody,
  ];

  const rawEmail = Buffer.from(emailLines.join('\r\n')).toString('base64url');

  try {
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawEmail,
      },
    });

    logger.info({ toEmail, count: summaries.length }, 'Content summary email sent successfully');
  } catch (error) {
    logger.error({ error, toEmail }, 'Failed to send content summary email');
    throw error;
  }
}

/**
 * Formats the summary email body
 */
function formatSummaryEmail(
  successful: ContentSummary[],
  failed: ContentSummary[]
): string {
  const sections: string[] = [];

  // Header
  sections.push('🎬 YouTube Content Scripts - AI Generated Summary');
  sections.push('═══════════════════════════════════════════════════════════');
  sections.push('');
  sections.push(
    `Generated on: ${new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`
  );
  sections.push('');

  if (successful.length > 0) {
    sections.push(`✅ ${successful.length} Content Script${successful.length > 1 ? 's' : ''} Generated Successfully`);
    sections.push('');

    successful.forEach((summary, index) => {
      sections.push('───────────────────────────────────────────────────────────');
      sections.push(`\n📌 CONTENT #${index + 1}: ${summary.eventTitle}`);
      if (summary.eventDate) {
        sections.push(`📅 Scheduled: ${new Date(summary.eventDate).toLocaleString()}`);
      }
      sections.push(`🎯 Topic: ${summary.topic}`);
      sections.push('');

      // Script summary
      sections.push(`🎬 Title: ${summary.script.title}`);
      sections.push(`🪝 Hook: ${summary.script.hook}`);
      sections.push(`💡 Main Concept: ${summary.script.mainConcept}`);
      sections.push('');
      sections.push('📝 Script Preview:');
      const scriptPreview = summary.script.scriptTable
        .map(row => row.sentence)
        .join(' ')
        .substring(0, 200) + '...';
      sections.push(scriptPreview);
      sections.push('');
      sections.push(`📢 CTA: ${summary.script.cta}`);
      sections.push(`🏷️  Hashtags: ${summary.script.hashtags.join(' ')}`);
      sections.push('');

      if (summary.calendarLink) {
        sections.push(`🔗 Full script in calendar: ${summary.calendarLink}`);
        sections.push('');
      }
    });
  }

  if (failed.length > 0) {
    sections.push('');
    sections.push('═══════════════════════════════════════════════════════════');
    sections.push(`❌ ${failed.length} Event${failed.length > 1 ? 's' : ''} Failed to Process`);
    sections.push('');

    failed.forEach((summary, index) => {
      sections.push(`${index + 1}. ${summary.eventTitle}`);
      sections.push(`   Error: ${summary.error || 'Unknown error'}`);
      sections.push('');
    });
  }

  // Footer
  sections.push('═══════════════════════════════════════════════════════════');
  sections.push('');
  sections.push('💡 Tips for Using These Scripts:');
  sections.push('1. Review and personalize each script to match your style');
  sections.push('2. Check calendar events for full script details and visual cues');
  sections.push('3. Practice reading at a fast pace (30-60 seconds)');
  sections.push('4. Prepare visuals and on-screen text as suggested');
  sections.push('5. Remember: ONE concept per Short for maximum impact');
  sections.push('');
  sections.push('📧 This email was generated automatically by your Content Creation Workflow');
  sections.push('🤖 Powered by OpenAI + Google Calendar Integration');

  return sections.join('\n');
}

/**
 * Creates a short summary for a single content item
 */
export function createShortSummary(summary: ContentSummary): string {
  if (!summary.success) {
    return `❌ ${summary.eventTitle}: Failed - ${summary.error}`;
  }

  return `✅ ${summary.eventTitle}
   📝 "${summary.script.title}"
   🪝 ${summary.script.hook}
   🏷️ ${summary.script.hashtags.join(' ')}`;
}

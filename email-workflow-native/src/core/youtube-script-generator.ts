// src/core/youtube-script-generator.ts
import { generateYouTubeScript, generateYouTubeScriptFromMarkdown } from '../ai';
import logger from '../logger';
import { ResearchResult } from './web-research-agent';

export interface YouTubeScript {
  title: string;
  mainConcept: string;
  hook: string;
  cta: string;
  hashtags: string[];
  scriptTable: Array<{
    sentence: string;
    bRoll: string;
  }>;
}

/**
 * Generates a YouTube Shorts script based on research findings
 */
export async function createYouTubeShortScript(
  topic: string,
  research: ResearchResult
): Promise<YouTubeScript> {
  logger.info({ topic }, 'Generating YouTube Shorts script...');

  try {
    const { object } = await generateYouTubeScript(
      topic,
      research.summary,
      research.keyPoints
    );

    logger.info({ topic, title: object.title }, 'YouTube script generated successfully');

    return object;
  } catch (error) {
    logger.error({ error, topic }, 'Failed to generate YouTube script');
    throw new Error(`Failed to generate script for "${topic}": ${(error as Error).message}`);
  }
}

/**
 * Generates a YouTube Shorts script directly from markdown content
 */
export async function createYouTubeShortScriptFromMarkdown(
  topic: string,
  markdownContent: string,
  sourceTitle?: string
): Promise<YouTubeScript> {
  logger.info({ topic, sourceTitle }, 'Generating YouTube Shorts script from markdown...');

  try {
    const { object } = await generateYouTubeScriptFromMarkdown(
      topic,
      markdownContent,
      sourceTitle
    );

    logger.info({ topic, title: object.title }, 'YouTube script generated successfully from markdown');

    return object;
  } catch (error) {
    logger.error({ error, topic }, 'Failed to generate YouTube script from markdown');
    throw new Error(`Failed to generate script from markdown for "${topic}": ${(error as Error).message}`);
  }
}

/**
 * Formats a YouTube script into readable markdown
 */
export function formatScriptAsMarkdown(script: YouTubeScript): string {
  const scriptTableMarkdown = script.scriptTable
    .map((row, i) => `${i + 1}. **${row.sentence}**\n   - B-Roll: ${row.bRoll}`)
    .join('\n\n');

  return `# ${script.title}

## Hook (0-2 seconds)
${script.hook}

## Main Concept
${script.mainConcept}

## Script & B-Roll
${scriptTableMarkdown}

## Call to Action
${script.cta}

## Metadata
**Hashtags:** ${script.hashtags.join(' ')}
`;
}

/**
 * Validates that a script meets YouTube Shorts best practices
 */
export function validateScript(script: YouTubeScript): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check hook length (should be concise)
  if (script.hook.length > 150) {
    warnings.push('Hook is too long - should be under 150 characters');
  }

  // Check if we have script table entries with B-roll
  if (script.scriptTable.length === 0) {
    warnings.push('No script content provided');
  }

  const missingBRoll = script.scriptTable.filter(row => !row.bRoll || row.bRoll.trim() === '');
  if (missingBRoll.length > 0) {
    warnings.push(`${missingBRoll.length} script entries missing B-roll suggestions - shorts need visual engagement`);
  }

  // Check hashtag count
  if (script.hashtags.length < 2 || script.hashtags.length > 4) {
    warnings.push('Should have 2-4 hashtags');
  }

  // Check script length (rough estimate: ~150 words per minute, target 30-60 seconds)
  const scriptText = script.scriptTable.map(row => row.sentence).join(' ');
  const wordCount = scriptText.split(/\s+/).length;
  if (wordCount < 75 || wordCount > 200) {
    warnings.push(
      `Script word count (${wordCount}) may not fit 30-60 second target (aim for 75-200 words)`
    );
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

// src/core/web-research-agent.ts
import { performWebResearch } from '../ai';
import logger from '../logger';

export interface ResearchResult {
  summary: string;
  keyPoints: string[];
  trends: string[];
  suggestions: string[];
  sources?: string[];
}

/**
 * Performs comprehensive web research on a content topic
 */
export async function researchContentTopic(
  topic: string,
  contentType?: string | null
): Promise<ResearchResult> {
  logger.info({ topic, contentType }, 'Starting web research...');

  try {
    const { object, sources } = await performWebResearch(topic, contentType);

    const result: ResearchResult = {
      summary: object.summary,
      keyPoints: object.keyPoints,
      trends: object.trends,
      suggestions: object.suggestions,
      sources: sources
        ?.map((s) => {
          // Sources have title, id, filename but not url
          if ('title' in s && s.title) return s.title;
          if ('id' in s && s.id) return s.id;
          return undefined;
        })
        .filter((s): s is string => s !== undefined),
    };

    logger.info(
      { topic, pointsFound: result.keyPoints.length, sourcesCount: result.sources?.length },
      'Web research completed'
    );

    return result;
  } catch (error) {
    logger.error({ error, topic }, 'Web research failed');
    throw new Error(`Failed to research topic "${topic}": ${(error as Error).message}`);
  }
}

/**
 * Formats research results into a readable markdown summary
 */
export function formatResearchSummary(research: ResearchResult): string {
  const sections = [
    '## Research Summary',
    research.summary,
    '',
    '## Key Points',
    ...research.keyPoints.map((point, i) => `${i + 1}. ${point}`),
    '',
    '## Current Trends',
    ...research.trends.map((trend, i) => `${i + 1}. ${trend}`),
    '',
    '## Content Suggestions',
    ...research.suggestions.map((suggestion, i) => `${i + 1}. ${suggestion}`),
  ];

  if (research.sources && research.sources.length > 0) {
    sections.push('', '## Sources', ...research.sources.map((source, i) => `${i + 1}. ${source}`));
  }

  return sections.join('\n');
}

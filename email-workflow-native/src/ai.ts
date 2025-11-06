// src/ai.ts
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { z } from 'zod';
import logger from './logger';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Replace with your preferred provider
const openai = createOpenAI();

// Schema for detecting the primary intent
export const intentSchema = z.object({
  intent: z
    .enum(['reply', 'meeting', 'archive', 'human_review'])
    .describe('The primary intent of the email.'),
  emailType: z
    .enum([
      'personal',
      'newsletter',
      'transactional',
      'promotional',
      'notification',
      'meeting_invite',
    ])
    .describe('The type of email to help determine appropriate actions.'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence level in the intent classification (0-1).'),
});

// Schema for generating a reply
export const replySchema = z.object({
  subject: z.string().describe('The subject of the reply email.'),
  body: z.string().describe('The body of the reply email.'),
});

// Schema for extracting meeting details
export const meetingSchema = z.object({
  title: z.string().describe('The title of the meeting.'),
  // Use ISO 8601 string format for JSON Schema compatibility
  dateTime: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/)
    .describe('Meeting time as ISO 8601 string (e.g., "2025-09-30T10:00:00Z")'),
  durationMinutes: z
    .number()
    .min(15)
    .max(480)
    .describe('The duration of the meeting in minutes (15-480 minutes).'),
});

export async function getEmailIntent(
  content: string,
  emailSubject?: string,
  senderEmail?: string
) {
  logger.info('Detecting email intent...');
  const currentDate = new Date().toISOString();

  return generateObject({
    model: openai('gpt-4o-mini'),
    schema: intentSchema,
    prompt: `Analyze the following email and determine the appropriate intent and email type.

Current date/time: ${currentDate}

RULES FOR INTENT CLASSIFICATION:
1. MEETING: Only for emails requesting/proposing future meetings or appointments with the recipient. NOT for:
   - Event announcements, webinars, or conferences
   - Past events or promotional content
   - Educational content or courses

2. REPLY: Only for personal emails that require a human response. NOT for:
   - Newsletters (contain unsubscribe links, bulk sender patterns)
   - Transactional emails (receipts, confirmations, notifications)
   - Promotional emails (sales pitches, offers, marketing)
   - Automated notifications (system messages, delivery confirmations)
   - Educational content (daily reminders, course content)

3. ARCHIVE: For informational content, newsletters, receipts, past events, notifications
4. HUMAN_REVIEW: For important emails that are unclear or require careful consideration

EMAIL TYPE CLASSIFICATION:
- personal: Direct communication from individuals requiring personal response
- newsletter: Mass communications, marketing emails, educational content
- transactional: Receipts, confirmations, delivery notifications, account updates
- promotional: Sales offers, product announcements, marketing campaigns
- notification: System notifications, automated alerts, status updates
- meeting_invite: Actual meeting invitations or appointment requests for future dates

Email Subject: ${emailSubject || 'Not provided'}
Sender: ${senderEmail || 'Not provided'}
Content: ${content}

Consider sender patterns (e.g., noreply@, automated systems) and content indicators (unsubscribe links, promotional language) when classifying.`,
  });
}

export async function generateReply(content: string, emailType?: string) {
  logger.info('Generating email reply...');

  // Additional safety check - avoid replying to certain email types
  if (
    emailType &&
    ['newsletter', 'transactional', 'promotional', 'notification'].includes(
      emailType
    )
  ) {
    throw new Error(`Cannot generate reply for ${emailType} email type`);
  }

  return generateObject({
    model: openai('gpt-4o-mini'),
    schema: replySchema,
    prompt: `Based on the following email, draft a professional reply.

IMPORTANT: Only draft replies for personal emails that require a human response. This should NOT be a newsletter, promotional email, transactional notification, or automated message.

Email content: ${content}

Draft a concise, professional response that addresses the sender's inquiry or continues the conversation appropriately. Return in the language of original email. Make sure you use senders name for greeting if available. Otherwise just say Hi or Hello in greeting`,
  });
}

export async function generateMeetingDetails(content: string) {
  logger.info('Generating meeting details...');
  const currentDate = new Date().toISOString();

  return generateObject({
    model: openai('gpt-4o-mini'),
    schema: meetingSchema,
    prompt: `Extract meeting details from the following email and return them in the specified format.

Current date/time for reference: ${currentDate}

Return a simple object with these fields:
- title: The meeting title/subject
- dateTime: Meeting date/time as ISO 8601 string (e.g., "2025-09-30T10:00:00Z")
- durationMinutes: Duration in minutes (default 60 if not specified)

Rules:
- Only extract meetings with FUTURE dates/times (after ${currentDate})
- Use the email subject for title if no better title is available
- Convert all times to UTC format (ending with Z)
- Duration should be between 15-480 minutes
- If no valid meeting is detected, the LLM should fail schema validation

Example output:
{
  "title": "Team Sync Meeting",
  "dateTime": "2025-09-30T10:00:00Z",
  "durationMinutes": 60
}

Email content: ${content}`,
  });
}

// Schema for content event classification
export const contentEventSchema = z.object({
  isContentRelated: z
    .boolean()
    .describe('Whether this calendar event is related to content creation'),
  contentType: z
    .enum(['youtube', 'blog', 'social_media', 'video', 'podcast', 'other'])
    .optional()
    .nullable()
    .describe(
      'The type of content if content-related. Set to null if not content-related.'
    ),
  topic: z
    .string()
    .optional()
    .nullable()
    .describe(
      'The main topic or subject of the content. Set to null if not content-related.'
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence level in the classification (0-1)'),
});

// Schema for web research results
export const webResearchSchema = z.object({
  summary: z
    .string()
    .describe('A comprehensive summary of the research findings'),
  keyPoints: z
    .array(z.string())
    .describe('3-5 key points or insights from the research'),
  trends: z
    .array(z.string())
    .describe('Current trends or recent developments on the topic'),
  suggestions: z
    .array(z.string())
    .describe('Suggestions for unique angles or interesting perspectives'),
  sources: z
    .array(z.string())
    .optional()
    .describe('Source URLs from web search'),
});

// [MODIFIED] Schema for YouTube Shorts script with B-Roll table
export const youtubeScriptSchema = z.object({
  title: z.string().describe('Optimized title for the YouTube Short.'),
  mainConcept: z
    .string()
    .describe('The ONE clear idea being taught in this short.'),
  hook: z
    .string()
    .describe(
      'The first 1-3 seconds of the script, designed to grab attention.'
    ),
  cta: z
    .string()
    .describe(
      'A strong, value-driven call-to-action for the end of the script.'
    ),
  hashtags: z
    .array(z.string())
    .describe('2-4 relevant hashtags for the short.'),
  scriptTable: z
    .array(
      z.object({
        sentence: z
          .string()
          .describe(
            'A single sentence or short phrase of the script to be spoken.'
          ),
        bRoll: z
          .string()
          .describe(
            'A specific, actionable B-roll or visual suggestion that corresponds directly to the sentence.'
          ),
      })
    )
    .describe(
      'The main body of the script, broken down sentence-by-sentence with corresponding B-roll suggestions in a table format.'
    ),
});

/**
 * Classifies whether a calendar event is related to content creation
 */
export async function classifyContentEvent(
  eventTitle: string,
  eventDescription?: string
) {
  logger.info('Classifying calendar event for content creation...');

  return generateObject({
    model: openai('gpt-4o-mini'),
    schema: contentEventSchema,
    prompt: `Analyze the following calendar event and determine if it's related to content creation.

Content creation includes: YouTube videos, blog posts, social media content, podcasts, educational videos, marketing content, etc.

NOT content creation: Regular meetings, personal events, reminders unrelated to creating content.

Event Title: ${eventTitle}
Event Description: ${eventDescription || 'No description provided'}

Classify this event and extract the topic if it's content-related.

IMPORTANT: If isContentRelated is false, set contentType and topic to null (not empty strings).`,
  });
}

/**
 * Performs web research on a topic using OpenAI Responses API
 */
export async function performWebResearch(
  topic: string,
  contentType?: string | null
) {
  logger.info({ topic, contentType }, 'Performing web research');

  const contentTypeText = contentType || 'content';

  // Step 1: Use generateText with web search to get current information
  const { text, sources } = await generateText({
    model: openai.responses('gpt-4o-mini'),
    tools: {
      web_search_preview: openai.tools.webSearchPreview({}),
    },
    prompt: `Research the following topic and provide comprehensive, current information suitable for creating educational ${contentTypeText}.

Topic: ${topic}

Your research should focus on:
1. Latest developments, news, or trends (last few weeks/months)
2. Interesting facts or insights that would surprise viewers
3. Common misconceptions or myths
4. Practical tips or actionable advice
5. Unique angles that aren't commonly covered

Provide detailed research findings that can be used to create engaging content on this topic.`,
  });

  // Step 2: Structure the web research results using generateObject
  const structured = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: webResearchSchema,
    prompt: `Based on the following web research, extract and structure the information:

Research Results:
${text}

Extract:
1. A comprehensive summary
2. 3-5 key points or insights
3. Current trends or recent developments
4. Suggestions for unique angles or perspectives

Format the output according to the schema.`,
  });

  // Add sources to the structured output
  const sourcesArray =
    sources?.map((s) => {
      // Sources have id, title, filename, etc but not url
      if ('title' in s) {
        return s.title;
      }
      if ('id' in s) {
        return s.id;
      }
      return 'Unknown source';
    }) || [];

  return {
    object: {
      ...structured.object,
      sources: sourcesArray,
    },
    sources: sources || [],
  };
}

/**
 * [ENHANCED] Generates a YouTube Shorts script based on research and framework
 */
export async function generateYouTubeScript(
  topic: string,
  researchFindings: string,
  keyPoints: string[]
) {
  logger.info({ topic }, 'Generating YouTube Shorts script');

  const keyPointsList = keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n');

  return generateObject({
    model: openai('gpt-4o-mini'),
    schema: youtubeScriptSchema,
    mode: 'json',
    prompt: `Create a YouTube Shorts script for educational content based on the following research.

Topic: ${topic}

Research Findings:
${researchFindings}

Key Points:
${keyPointsList}

YOUTUBE SHORTS FRAMEWORK (CRITICAL - FOLLOW EXACTLY):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. HOOK (First 1-2 seconds) - AUTHENTIC & MAGNETIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Choose ONE hook pattern: Problem, Curiosity Gap, Shocking Statement, Direct Question, or Relatable Scenario. The hook MUST match the value you deliver. No clickbait.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. TIME TO VALUE - Deliver Within 3-5 Seconds
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Structure: [0-2s] HOOK → [3-5s] VALUE/ANSWER DELIVERED → [6-30s] EXPLANATION/PROOF → [30-60s] PAYOFF + CTA. Deliver the core insight immediately.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. TEACH ONE CLEAR IDEA - Make It Memorable
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Focus on ONE specific, actionable concept. Make it simple to grasp, valuable enough to share, and specific enough to apply.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. ENTERTAINMENT + EDUCATION - Engage Emotions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use a relatable, conversational tone. Address pain points. Create emotional beats: Frustration → Surprise → Relief.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. SCRIPT & B-ROLL STRUCTURE (HPC SYSTEM) - CRITICAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your output must be a table mapping spoken sentences to specific B-roll shots. This keeps the pace fast and the visuals engaging. Every sentence must have a corresponding visual idea.

Follow the HPC (Hook, Progression, Climax) framework for your B-roll suggestions:

H = HOOK (0-3 SECONDS)
Purpose: Grab attention, create questions.
B-Roll Ideas:
- Intriguing close-ups (unusual object, key ingredient)
- Fast-paced action shots (typing, drawing, unboxing)
- A compelling "Before" shot of a transformation
- A shot showing a clear problem or frustration

P = PROGRESSION (MIDDLE)
Purpose: Show the journey, build tension, deliver value.
B-Roll Ideas:
- Quick cuts showing sequential steps of a process
- Screen recordings of code or software with key parts highlighted
- Time-lapses to condense a long process
- Multiple angles of the same action to keep it visually fresh
- On-screen text, diagrams, and callouts to explain key concepts

C = CLIMAX (FINAL SECONDS)
Purpose: Pay off the promise from the hook, deliver satisfaction.
B-Roll Ideas:
- The stunning "After" shot of the final result
- A slow-motion reveal of the finished product
- A reaction shot (surprise, satisfaction)
- The final product being used successfully
- A graph showing dramatic improvement

⚠️ B-ROLL RULES:
- BE SPECIFIC: "Show a line of code" is BAD. "Show the 'const user = await db.getUser()' line highlighted" is GOOD.
- MATCH THE SENTENCE: The visual must directly enhance the spoken words.
- KEEP IT MOVING: Suggest quick cuts, zooms, and text animations.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. CALL TO ACTION - Value-Driven, Not Begging
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Make it value-focused: "Follow for one smart dev tip every day" or "Save this - you'll need it when debugging".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL SCRIPT REQUIREMENTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 30-60 seconds when read at a fast pace.
✅ Hook in first 2s, value by 5s.
✅ Pattern interrupts (visual changes) every 7-10 seconds.
✅ ONE clear takeaway.
✅ Authentic - hook matches delivered value.
✅ The entire script is presented in the 'scriptTable' format.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (CRITICAL):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return a valid JSON object with these exact fields. The main script content MUST be in the 'scriptTable'.

{
  "title": "string - optimized title",
  "mainConcept": "string - the one clear idea",
  "hook": "string - the first 1-3 seconds of script (should match first sentence(s) in scriptTable)",
  "cta": "string - your call to action (should match last sentence(s) in scriptTable)",
  "hashtags": ["array", "of", "hashtags"],
  "scriptTable": [
    {
      "sentence": "Your first sentence spoken in the video...",
      "bRoll": "Specific B-roll for the first sentence. e.g., 'Fast zoom on a computer screen showing an error message.'"
    },
    {
      "sentence": "Your second sentence...",
      "bRoll": "Specific B-roll for the second sentence. e.g., 'Close-up of hands typing furiously.'"
    }
  ]
}

DO NOT wrap this in any other JSON structure. ONLY return the script data as shown above.

Now create the script following this comprehensive framework.`,
  });
}

/**
 * [ENHANCED] Generates a YouTube Shorts script directly from markdown content
 */
export async function generateYouTubeScriptFromMarkdown(
  topic: string,
  markdownContent: string,
  sourceTitle?: string
) {
  logger.info(
    { topic, sourceTitle },
    'Generating YouTube Shorts script from markdown content'
  );

  const titleContext = sourceTitle ? `\nSource Article: ${sourceTitle}` : '';

  return generateObject({
    model: openai('gpt-4o-mini'),
    schema: youtubeScriptSchema,
    mode: 'json',
    prompt: `Create a YouTube Shorts script for educational content based ONLY on the following article content.

Topic: ${topic}${titleContext}

Article Content (Markdown):
${markdownContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️⚠️⚠️ CRITICAL - ANTI-HALLUCINATION RULES ⚠️⚠️⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 FORBIDDEN: DO NOT use your general knowledge. DO NOT mention tools, concepts, or examples NOT in the article. DO NOT make up data.
✅ REQUIRED: USE ONLY information that appears in the markdown content. Every claim, tool, and example must be traceable back to the provided text.

Before writing, mentally checklist the specific tools, examples, and data points present in the article. Your script will use ONLY these.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUTUBE SHORTS FRAMEWORK (CRITICAL - FOLLOW EXACTLY):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. HOOK (First 1-2 seconds): Grab attention with the MOST surprising or valuable insight FROM THE ARTICLE.
2. TIME TO VALUE (3-5 Seconds): Deliver the ARTICLE'S answer/solution immediately.
3. TEACH ONE CLEAR IDEA: Extract ONE specific, actionable concept FROM THE ARTICLE.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. SCRIPT & B-ROLL STRUCTURE (HPC SYSTEM) - CRITICAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your output must be a table mapping spoken sentences to specific B-roll shots derived FROM THE ARTICLE. This keeps the pace fast and the visuals engaging. Every sentence must have a corresponding visual idea.

Follow the HPC (Hook, Progression, Climax) framework for your B-roll suggestions:

H = HOOK (0-3 SECONDS)
Purpose: Grab attention using an article detail.
B-Roll Ideas:
- Intriguing close-up of a code snippet or diagram FROM THE ARTICLE.
- A shot illustrating the core problem the ARTICLE addresses.

P = PROGRESSION (MIDDLE)
Purpose: Show the journey, using the article's examples.
B-Roll Ideas:
- Quick cuts showing steps from an article tutorial.
- Screen recordings of code mentioned in the article, with key parts highlighted.
- On-screen text quoting a key statistic or phrase FROM THE ARTICLE.

C = CLIMAX (FINAL SECONDS)
Purpose: Pay off the promise, showing the article's solution.
B-Roll Ideas:
- The stunning "After" shot of the result described in the article.
- A slow-motion reveal of the final product from an article example.

⚠️ B-ROLL RULES:
- BE SPECIFIC & GROUNDED: "Show the article's performance chart" is GOOD. "Show a chart" is BAD. All visuals must refer to content within the provided markdown.
- MATCH THE SENTENCE: The visual must directly enhance the spoken words from the article.
- KEEP IT MOVING: Suggest quick cuts, zooms, and text animations on article content.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. CALL TO ACTION: Value-driven, referencing the source article. e.g., "Link in bio for the full article and all the code examples".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL SCRIPT REQUIREMENTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 30-60 seconds when read at a fast pace.
✅ Hook in first 2s, value by 5s, all from the article.
✅ ONE clear takeaway from the article.
✅ Authentic - hook matches the article's actual content.
✅ The entire script is presented in the 'scriptTable' format, with B-roll suggestions based ONLY on the article.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (CRITICAL):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return a valid JSON object with these exact fields. The main script content MUST be in the 'scriptTable'.

{
  "title": "string - optimized title",
  "mainConcept": "string - the one clear idea from the article",
  "hook": "string - the first 1-3 seconds of script (from article content)",
  "cta": "string - your call to action (referencing the article)",
  "hashtags": ["array", "of", "hashtags"],
  "scriptTable": [
    {
      "sentence": "The first sentence, paraphrased from the article...",
      "bRoll": "Specific B-roll for the first sentence. e.g., 'Text overlay of the quote: '...' from the article.'"
    },
    {
      "sentence": "The second sentence from the article...",
      "bRoll": "Specific B-roll. e.g., 'Split screen showing the 'Before' and 'After' code from the article.'"
    }
  ]
}

DO NOT wrap this in any other JSON structure. ONLY return the script data as shown above.

Now create the script following this comprehensive, article-grounded framework.`,
  });
}

// Schema for extracting topics from content
export const topicsExtractionSchema = z.object({
  topics: z
    .array(
      z.object({
        title: z.string().describe('Concise title for the topic (5-10 words)'),
        summary: z
          .string()
          .describe(
            'Brief 1-2 sentence summary of the topic and why it would make good YouTube content'
          ),
        url: z
          .string()
          .url()
          .describe(
            'The main/primary URL from this topic section (e.g., "Try it for yourself", "Get started", "Read more" links)'
          ),
        keyTakeaways: z
          .array(z.string())
          .min(2)
          .max(4)
          .describe('2-4 key points or insights about this topic'),
        youtubeRelevance: z
          .number()
          .min(0)
          .max(10)
          .describe(
            'How suitable this topic is for YouTube content (0-10, where 10 is highly suitable)'
          ),
      })
    )
    .min(3)
    .max(5)
    .describe('3-5 key topics from the content suitable for YouTube scripts'),
});

/**
 * Extracts 3-5 key topics from content suitable for creating YouTube scripts
 */
export async function extractTopicsFromContent(
  content: string,
  title?: string,
  sourceUrl?: string
) {
  logger.info('Extracting topics from content for YouTube script creation...');

  const titleContext = title ? `Content Title: ${title}\n` : '';
  const urlContext = sourceUrl ? `Source URL: ${sourceUrl}\n` : '';

  try {
    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: topicsExtractionSchema,
      mode: 'json',
      prompt: `Analyze the following content and extract 3-5 key topics that would make excellent YouTube scripts.

${titleContext}${urlContext}
Content:
${content}

Instructions:
1. Identify 3-5 distinct topics that are mentioned or discussed in the content
2. Focus on topics that would be engaging for YouTube educational content
3. Each topic should be substantial enough to create a 30-60 second YouTube Short
4. Prioritize topics with:
   - Clear, teachable concepts
   - Surprising insights or lesser-known information
   - Practical value for viewers
   - Potential to go viral (shareable, relatable)

5. For each topic provide:
   - A concise, compelling title
   - A brief 1-2 sentence summary explaining what makes it interesting
   - The main/primary URL from that topic's section (e.g., "Try it for yourself", "Get started", "Read more", "Learn about" links)
   - 2-4 key takeaways or insights
   - A relevance score (0-10) indicating how suitable it is for YouTube

IMPORTANT: Extract the specific URL from each topic's section, not the article URL. Look for action links like "Try it", "Get started", "Read the guide", etc.

Return a JSON object with this exact structure:
{
  "topics": [
    {
      "title": "...",
      "summary": "...",
      "url": "https://...",
      "keyTakeaways": ["...", "..."],
      "youtubeRelevance": 8
    }
  ]
}

Order topics by YouTube relevance (highest first).`,
    });

    return result;
  } catch (error) {
    logger.error({ error }, 'Failed to extract topics from content');
    throw error;
  }
}

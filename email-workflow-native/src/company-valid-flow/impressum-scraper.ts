// src/company-valid-flow/impressum-scraper.ts
import { Readability } from '@mozilla/readability';
import { generateObject } from 'ai';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import { fetch } from 'undici';
import { z } from 'zod';
import { getGeminiModel } from './ai-client';
import type { LogFn, ScrapedImpressum } from './types';

// --- Zod Schema for AI Extraction ---
const impressumSchema = z.object({
  legalName: z
    .string()
    .describe(
      "The full legal company name, e.g., 'Beispiel GmbH'. This field is required."
    ),
  registerNumber: z
    .string()
    .describe(
      "The trade register number, e.g., 'Amtsgericht Berlin, HRB 12345'. This field is required."
    ),
  directors: z
    .array(z.string())
    .describe(
      'List of managing directors (Geschäftsführer). Can be an empty array if none are listed.'
    ),
});

// --- HTML Parsing Setup ---
const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

/**
 * Fetches and parses a company's Impressum/Legal Notice page.
 * It combines fetching, text extraction, and AI to get structured data.
 */
export async function scrapeAndExtractImpressumData(
  companyWebsite: string,
  log: LogFn
): Promise<ScrapedImpressum> {
  // MVP assumption: The legal notice is at /impressum
  const url = `https://${companyWebsite}/impressum`;
  log(`Starting scrape for: ${url}`);

  try {
    // 1. Fetch HTML
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch URL (${response.status} ${response.statusText})`
      );
    }
    const html = await response.text();
    const dom = new JSDOM(html, { url });

    // 2. Use Readability to get clean article content
    // This is great for stripping ads, nav bars, and footers.
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    const contentHtml =
      article?.content || dom.window.document.body.innerHTML || '';
    if (!contentHtml) {
      throw new Error('No readable content found on Impressum page.');
    }

    // 3. Convert clean HTML to plain text (via Markdown)
    const cleanText = turndownService.turndown(contentHtml);
    log(`Extracted ${cleanText.length} characters of text from Impressum.`);

    if (cleanText.length < 50) {
      throw new Error('Extracted content seems too short, parsing failed.');
    }

    // 4. Use LLM to extract structured data from the text
    log('Sending clean text to LLM for structured data extraction...');

    // Use generateObject with the Zod schema
    const { object: extractedData } = await generateObject({
      model: getGeminiModel(),
      schema: impressumSchema,
      prompt: `You are an expert German legal data extractor.
      From the following Impressum (Legal Notice) text, extract the precise:
      1. Legal Company Name (legalName)
      2. Register Number (registerNumber)
      3. Managing Directors (directors)

      Text:
      ---
      ${cleanText.substring(0, 4000)}
      ---
      
      CRITICAL: You must extract a value for 'legalName' and 'registerNumber'.
      If 'directors' are not listed, return an empty array for that field.
    `,
    });

    log(`LLM Extraction complete: Found "${extractedData.legalName}"`);

    return {
      ...extractedData,
      sourceUrl: url,
    };
  } catch (error) {
    log('Error during scraping and extraction:', error);
    throw new Error(
      `Failed to process impressum for ${url}: ${(error as Error).message}`
    );
  }
}

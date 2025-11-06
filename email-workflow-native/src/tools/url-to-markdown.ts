import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { appendFile, mkdir } from 'fs/promises';
import path from 'path';
import TurndownService from 'turndown';
import { fetch } from 'undici';
import logger from '../logger';

interface ToolLogEntry {
  timestamp: string;
  url: string;
  status: 'success' | 'error';
  output?: string;
  error?: string;
}

export interface UrlToMarkdownResult {
  title: string;
  markdown: string;
  byline?: string | null;
  excerpt?: string | null;
}

const LOG_FILE_PATH = path.resolve(process.cwd(), 'logs', 'html-to-markdown.log');

const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

/**
 * Persist tool activity to a newline-delimited JSON log for easy ingestion.
 */
async function logToolActivity(entry: ToolLogEntry): Promise<void> {
  try {
    await mkdir(path.dirname(LOG_FILE_PATH), { recursive: true });
    await appendFile(LOG_FILE_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (logError) {
    logger.warn({ logError }, 'Failed to write HTML-to-Markdown tool log entry');
  }
}

function toAbsoluteUrl(baseUrl: string, value: string): string {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function prepareContentFragment(baseUrl: string, html: string): DocumentFragment {
  const fragment = JSDOM.fragment(html);
  fragment.querySelectorAll('a[href]').forEach((anchor: Element) => {
    const link = anchor as HTMLAnchorElement;
    const href = link.getAttribute('href');
    if (href) link.setAttribute('href', toAbsoluteUrl(baseUrl, href));
  });

  fragment.querySelectorAll('img[src]').forEach((image: Element) => {
    const img = image as HTMLImageElement;
    const src = img.getAttribute('src');
    if (src) img.setAttribute('src', toAbsoluteUrl(baseUrl, src));
  });

  return fragment;
}

/**
 * Convert the HTML located at the provided URL into Markdown, logging both
 * the input URL and output Markdown to a dedicated log file.
 */
export async function urlToMarkdown(url: string): Promise<UrlToMarkdownResult> {
  const timestamp = new Date().toISOString();

  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`Failed to fetch URL (${response.status} ${response.statusText})`);
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    const title = article?.title?.trim() || dom.window.document.title || url;
    const contentHtml =
      article?.content || dom.window.document.querySelector('body')?.innerHTML || '';

    if (!contentHtml) {
      throw new Error('No readable content found in page.');
    }

    const contentFragment = prepareContentFragment(url, contentHtml);
    const markdownBody = turndownService.turndown(contentFragment);
    const markdown = title ? `# ${title}\n\n${markdownBody}`.trim() : markdownBody.trim();

    const result: UrlToMarkdownResult = {
      title,
      markdown,
      byline: article?.byline ?? null,
      excerpt: article?.excerpt ?? null,
    };

    await logToolActivity({ timestamp, url, status: 'success', output: markdown });
    logger.info(
      { url, title, markdownLength: markdown.length },
      'HTML-to-Markdown conversion succeeded'
    );

    return result;
  } catch (error) {
    const message = (error as Error).message;
    await logToolActivity({ timestamp, url, status: 'error', error: message });
    logger.error({ url, error }, 'HTML-to-Markdown conversion failed');
    throw error;
  }
}

export const htmlToMarkdownLogFile = LOG_FILE_PATH;

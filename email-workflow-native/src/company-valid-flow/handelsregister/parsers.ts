import { JSDOM } from 'jsdom';
import type {
  HandelsregisterListing,
  HandelsregisterRecord,
} from '../types';

function cleanup(value: string | null | undefined): string {
  return value?.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
}

function cleanupPreserveNewlines(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function textWithBreaks(element: Element | null): string {
  if (!element) {
    return '';
  }

  const clone = element.cloneNode(true) as HTMLElement;

  clone.querySelectorAll('br').forEach((br) => {
    br.replaceWith('\n');
  });

  clone.querySelectorAll('p').forEach((p) => {
    p.append('\n');
  });

  clone.querySelectorAll('li').forEach((li) => {
    li.append('\n');
  });

  return clone.textContent ?? '';
}

export function normalizeRegisterNumber(value: string): string {
  return cleanup(value).replace(/\s+/g, '').toUpperCase();
}

export function normalizeCompanyName(value: string): string {
  return cleanup(value).toUpperCase();
}

function extractRegisterInfo(value: string): {
  court: string;
  registerNumber: string;
} {
  const cleaned = cleanup(value);
  const registerMatch = cleaned.match(/(HR[AB]\s*[0-9A-Z]+)/i);
  const registerNumber = registerMatch
    ? registerMatch[1].replace(/\s+/g, ' ').toUpperCase()
    : '';

  let court = cleaned.replace(registerMatch?.[0] ?? '', '').trim();
  court = court.replace(/[,;]\s*$/, '');
  court = court.replace(/^Registergericht\s*:?/i, '').trim();
  court = cleanup(court);

  return {
    court,
    registerNumber,
  };
}

function extractLegalForm(cell: Element): string | undefined {
  const text = cleanup(cell.textContent);
  if (!text) {
    return undefined;
  }
  const match = text.match(/Rechtsform:\s*(.*?)(?:\s{2,}|$)/i);
  return cleanup(match?.[1]);
}

function resolveLink(
  element: Element | null,
  baseUrl: string
): { relative: string; absolute: string } {
  const href = element?.getAttribute?.('href') ?? '';
  const relative = cleanup(href);
  if (!relative) {
    return { relative, absolute: baseUrl };
  }
  try {
    const absolute = new URL(relative, baseUrl).toString();
    return { relative, absolute };
  } catch {
    return { relative, absolute: baseUrl };
  }
}

export function parseSearchResults(
  html: string,
  baseUrl: string
): HandelsregisterListing[] {
  const dom = new JSDOM(html);
  const { document } = dom.window;

  const tables = Array.from(document.querySelectorAll('table'));
  const targetTable = tables.find((table) => {
    const headers = Array.from(table.querySelectorAll('th'))
      .map((cell) => cleanup(cell.textContent).toLowerCase())
      .join(' ');
    return headers.includes('firma') && headers.includes('register');
  }) as HTMLTableElement | undefined;

  if (!targetTable) {
    return [];
  }

  const rows = Array.from(targetTable.querySelectorAll('tbody tr')).filter(
    (row) => row.querySelectorAll('td').length >= 2
  );

  const listings: HandelsregisterListing[] = [];

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll('td'));
    if (cells.length < 2) {
      continue;
    }

    const [companyCell, seatCell, registerCell] = cells;
    const anchor = companyCell.querySelector('a');
    const companyName = cleanup(anchor?.textContent ?? companyCell.textContent);
    if (!companyName) {
      continue;
    }

    const { relative, absolute } = resolveLink(anchor, baseUrl);
    const seat = cleanup(seatCell?.textContent ?? '');
    const registerInfo = cleanup(registerCell?.textContent ?? '');
    const { court, registerNumber } = extractRegisterInfo(registerInfo);

    if (!registerNumber) {
      continue;
    }

    const legalForm = extractLegalForm(companyCell);

    listings.push({
      companyName,
      normalizedCompanyName: normalizeCompanyName(companyName),
      registerNumber,
      normalizedRegisterNumber: normalizeRegisterNumber(registerNumber),
      court,
      seat: seat || undefined,
      legalForm,
      detailRelativeUrl: relative,
      publicRegisterUrl: absolute,
    });
  }

  return listings;
}

type KeyValue = { key: string; value: string };

function collectKeyValues(document: Document): KeyValue[] {
  const pairs: KeyValue[] = [];

  const tables = Array.from(document.querySelectorAll('table'));
  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll('tr'));
    for (const row of rows) {
      const cells = Array.from(row.children) as HTMLElement[];
      if (cells.length < 2) {
        continue;
      }

      const key = cleanup(cells[0].textContent);
      const value = cleanupPreserveNewlines(
        cells
          .slice(1)
          .map((cell) => textWithBreaks(cell))
          .join('\n')
      );
      if (!key || !value) {
        continue;
      }
      pairs.push({ key, value });
    }
  }

  const definitionLists = Array.from(document.querySelectorAll('dl'));
  for (const dl of definitionLists) {
    const terms = Array.from(dl.querySelectorAll('dt'));
    for (const term of terms) {
      const definition = term.nextElementSibling;
      if (!definition) {
        continue;
      }
      const key = cleanup(term.textContent);
      const value = cleanupPreserveNewlines(textWithBreaks(definition));
      if (!key || !value) {
        continue;
      }
      pairs.push({ key, value });
    }
  }

  return pairs;
}

function splitList(value: string): string[] {
  return value
    .split(/\n|;/)
    .map((item) => cleanup(item))
    .filter(Boolean);
}

function splitAddress(value: string): string[] {
  return value
    .split(/\n|,/) // addresses often use commas or newlines
    .map((line) => cleanup(line))
    .filter(Boolean);
}

export function parseDetailPage(
  html: string,
  detailUrl: string,
  fallback?: Partial<HandelsregisterListing>
): HandelsregisterRecord {
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const rawHtml = html;

  const title =
    cleanup(document.querySelector('h1, h2, h3')?.textContent ?? '') ||
    cleanup(fallback?.companyName ?? '');

  const pairs = collectKeyValues(document);

  const base: HandelsregisterRecord = {
    companyName: fallback?.companyName ?? title,
    normalizedCompanyName: normalizeCompanyName(
      fallback?.companyName ?? title
    ),
    registerNumber: fallback?.registerNumber ?? '',
    normalizedRegisterNumber: normalizeRegisterNumber(
      fallback?.registerNumber ?? ''
    ),
    court: fallback?.court ?? '',
    seat: fallback?.seat,
    legalForm: fallback?.legalForm,
    detailRelativeUrl: fallback?.detailRelativeUrl ?? '',
    publicRegisterUrl: fallback?.publicRegisterUrl ?? detailUrl,
    status: undefined,
    registrationDate: undefined,
    lastUpdate: undefined,
    addressLines: [],
    representatives: [],
    businessPurpose: undefined,
    shareCapital: undefined,
    rawHtml,
  };

  const normalizedDetailUrl = (() => {
    try {
      return new URL(detailUrl).toString();
    } catch {
      return fallback?.publicRegisterUrl ?? detailUrl;
    }
  })();
  base.publicRegisterUrl = normalizedDetailUrl;

  for (const { key, value } of pairs) {
    const lowerKey = key.toLowerCase();

    if (lowerKey.includes('registergericht')) {
      base.court = value;
      continue;
    }

    if (
      lowerKey.includes('handelsregister') ||
      lowerKey.includes('registernr') ||
      lowerKey.includes('register-nr')
    ) {
      const info = extractRegisterInfo(value);
      base.registerNumber = info.registerNumber || value;
      base.normalizedRegisterNumber = normalizeRegisterNumber(
        base.registerNumber
      );
      if (info.court) {
        base.court = info.court;
      }
      continue;
    }

    if (lowerKey.includes('sitz')) {
      base.seat = value;
      continue;
    }

    if (lowerKey.includes('rechtsform')) {
      base.legalForm = value;
      continue;
    }

    if (lowerKey.includes('status')) {
      base.status = value;
      continue;
    }

    if (
      lowerKey.includes('vertretung') ||
      lowerKey.includes('geschäftsführer') ||
      lowerKey.includes('vorstand')
    ) {
      base.representatives = splitList(value);
      continue;
    }

    if (lowerKey.includes('anschrift')) {
      base.addressLines = splitAddress(value);
      continue;
    }

    if (
      lowerKey.includes('stammkapital') ||
      lowerKey.includes('kapital')
    ) {
      base.shareCapital = value;
      continue;
    }

    if (
      lowerKey.includes('gegenstand') ||
      lowerKey.includes('zweck')
    ) {
      base.businessPurpose = value;
      continue;
    }

    if (
      lowerKey.includes('letzte') ||
      lowerKey.includes('zuletzt')
    ) {
      base.lastUpdate = value;
      continue;
    }

    if (lowerKey.includes('eintragung') || lowerKey.includes('gründung')) {
      base.registrationDate = base.registrationDate ?? value;
    }
  }

  if (!base.registerNumber) {
    const info = extractRegisterInfo(
      pairs
        .filter(({ key }) => key.toLowerCase().includes('register'))
        .map(({ value }) => value)
        .join('\n')
    );
    base.registerNumber = info.registerNumber;
    base.normalizedRegisterNumber = normalizeRegisterNumber(
      base.registerNumber
    );
    if (info.court && !base.court) {
      base.court = info.court;
    }
  }

  if (!base.companyName) {
    base.companyName = title;
    base.normalizedCompanyName = normalizeCompanyName(title);
  }

  return base;
}

import type { LogFn, HandelsregisterRecord } from './types';
import { HandelsregisterClient } from './handelsregister/client';
import {
  normalizeCompanyName,
  normalizeRegisterNumber,
} from './handelsregister/parsers';

const client = new HandelsregisterClient();

function pickBestListing<T extends { normalizedRegisterNumber: string; normalizedCompanyName: string }>(
  listings: T[],
  targetRegisterNumber?: string,
  targetCompanyName?: string
): T | undefined {
  if (!listings.length) {
    return undefined;
  }

  if (targetRegisterNumber) {
    const match = listings.find(
      (listing) => listing.normalizedRegisterNumber === targetRegisterNumber
    );
    if (match) {
      return match;
    }
  }

  if (targetCompanyName) {
    const normalizedTargetName = normalizeCompanyName(targetCompanyName);
    const nameMatch = listings.find((listing) =>
      listing.normalizedCompanyName.includes(normalizedTargetName)
    );
    if (nameMatch) {
      return nameMatch;
    }
  }

  return listings[0];
}

export async function fetchHandelsregisterRecord(
  registerNumber: string,
  legalName?: string,
  log?: LogFn
): Promise<HandelsregisterRecord | undefined> {
  const normalizedNumber = normalizeRegisterNumber(registerNumber);
  if (!normalizedNumber) {
    log?.('Handelsregister lookup skipped: empty register number');
    return undefined;
  }

  const normalizedName = legalName ? normalizeCompanyName(legalName) : undefined;

  try {
    log?.(
      `Searching Handelsregister: register=${normalizedNumber}, name=${normalizedName}`
    );

    let listings = await client.search({
      registerNumber: normalizedNumber,
      companyName: legalName,
    });

    if (!listings.length && legalName) {
      log?.(
        'No Handelsregister results when searching by register number, retrying with company name'
      );
      listings = await client.search({
        companyName: legalName,
      });
    }

    if (!listings.length) {
      log?.('No Handelsregister listings returned for query');
      return undefined;
    }

    const selected = pickBestListing(
      listings,
      normalizedNumber,
      legalName
    );

    if (!selected) {
      log?.('Failed to select Handelsregister listing');
      return undefined;
    }

    log?.(
      `Fetching Handelsregister detail for ${selected.companyName} (${selected.registerNumber})`
    );

    const record = await client.getCompanyDetails(selected);
    return record;
  } catch (error) {
    log?.('Handelsregister lookup failed', error);
    return undefined;
  }
}

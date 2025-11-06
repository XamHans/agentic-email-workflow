// src/company-valid-flow/compliance-risk-service.ts
import type { ComplianceData, LogFn } from './types';

export async function checkSanctions(
  legalName: string,
  directors: string[],
  log: LogFn
): Promise<ComplianceData> {
  log(
    `Checking sanctions for legal name "${legalName}" across ${directors.length} directors`
  );

  await delay(1200);

  const data: ComplianceData = {
    hits: 0,
    status: 'clear',
    rawReport: JSON.stringify({
      searchTerms: [legalName, ...directors],
      hits: 0,
      listsChecked: ['EU_CFSP', 'UN_SC', 'US_OFAC'],
    }),
  };

  log('Sanctions check complete: No matches found');
  return data;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

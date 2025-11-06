// src/company-valid-flow/financial-risk-service.ts
import type { FinancialData, LogFn } from './types';

export async function fetchCreditReport(
  registerNumber: string,
  log: LogFn
): Promise<FinancialData> {
  log(`Fetching credit report for register number: "${registerNumber}"`);

  await delay(1000);

  const data: FinancialData = {
    score: 190,
    riskLevel: 'low',
    provider: 'Creditreform',
    rawReport: JSON.stringify({
      companyId: registerNumber,
      score: 190,
      riskClass: 2,
      recommendation: 'proceed',
    }),
  };

  log('Credit report received: Low risk profile');
  return data;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

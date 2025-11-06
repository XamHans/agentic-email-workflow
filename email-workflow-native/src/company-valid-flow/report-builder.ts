// src/company-valid-flow/report-builder.ts
import type {
  ComplianceData,
  FinancialData,
  HandelsregisterRecord,
  RiskAnalysisResult,
  ScrapedImpressum,
  VerificationReport,
} from './types';

export function buildVerificationReport(
  scrapedData: ScrapedImpressum,
  registerRecord: HandelsregisterRecord | undefined,
  financialData: FinancialData,
  complianceData: ComplianceData,
  analysis: RiskAnalysisResult,
  prompt: string,
  dataFedToAI: string
): VerificationReport {
  const publicRegisterLink =
    registerRecord?.publicRegisterUrl ??
    buildRegisterLink(scrapedData.registerNumber);

  return {
    overallStatus: analysis.recommendation,
    aiSummary: analysis.summary,
    reportDate: new Date().toISOString(),
    sources: {
      identity: {
        legalName: registerRecord?.companyName ?? scrapedData.legalName,
        registerNumber:
          registerRecord?.registerNumber ?? scrapedData.registerNumber,
        registerCourt: registerRecord?.court,
        legalForm: registerRecord?.legalForm,
        registeredOffice: registerRecord?.seat,
        registerStatus: registerRecord?.status,
        scrapedUrl: scrapedData.sourceUrl,
        publicRegisterLink,
      },
      financial: {
        provider: financialData.provider,
        score: financialData.score,
        risk: financialData.riskLevel,
        rawApiData: financialData.rawReport,
      },
      compliance: {
        status: complianceData.status,
        hits: complianceData.hits,
        publicSanctionsLink: buildSanctionsLink(scrapedData.legalName),
        rawApiData: complianceData.rawReport,
      },
    },
    aiTransparency: {
      prompt,
      dataFedToAI,
    },
  };
}

function buildRegisterLink(registerNumber: string) {
  return `https://www.unternehmensregister.de/ureg/result.html?search=${encodeURIComponent(
    registerNumber
  )}`;
}

function buildSanctionsLink(legalName: string) {
  return `https://www.sanctionsmap.eu/#/search?search=${encodeURIComponent(
    legalName
  )}`;
}

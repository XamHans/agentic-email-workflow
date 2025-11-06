// src/company-valid-flow/analysis-service.ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { getGeminiModel } from './ai-client';
import type {
  ComplianceData,
  HandelsregisterRecord,
  FinancialData,
  LogFn,
  RiskAnalysisResult,
  RiskRecommendation,
  ScrapedImpressum,
} from './types';

const analysisSchema = z.object({
  summary: z.string().min(10),
  recommendation: z.enum(['Approve', 'Deny', 'Manual Review']),
});

type AnalysisPayload = {
  scrapedData: ScrapedImpressum;
  registerRecord?: HandelsregisterRecord;
  financialData: FinancialData;
  complianceData: ComplianceData;
};

export async function generateRiskAnalysis(
  payload: AnalysisPayload,
  log: LogFn
): Promise<{
  analysis: RiskAnalysisResult;
  prompt: string;
  dataFedToAI: string;
}> {
  const { scrapedData, financialData, complianceData } = payload;
  const { registerRecord } = payload;

  log('Generating AI synthesis for combined risk signals...');

  const aiInputData = {
    identity: {
      legalName: scrapedData.legalName,
      registerNumber: scrapedData.registerNumber,
      registerCourt: registerRecord?.court,
      registerStatus: registerRecord?.status,
      legalForm: registerRecord?.legalForm,
      registeredOffice: registerRecord?.seat,
    },
    financial: {
      provider: financialData.provider,
      score: financialData.score,
      risk: financialData.riskLevel,
    },
    compliance: {
      status: complianceData.status,
      hits: complianceData.hits,
    },
  };

  const dataFedToAI = JSON.stringify(aiInputData, null, 2);

  const prompt = `You are a senior B2B risk analyst assessing a new German customer.
Review the structured data provided and return a concise JSON response with next steps.

Business rules:
- Risk "low" AND compliance "clear" -> Approve
- Risk "medium" -> Manual Review
- Risk "high" OR compliance "review_required" -> Deny

Respond ONLY with valid JSON matching:
{
  "summary": string,
  "recommendation": "Approve" | "Deny" | "Manual Review"
}

Structured data:
${dataFedToAI}`;

  const { object } = await generateObject({
    model: getGeminiModel(),
    schema: analysisSchema,
    prompt,
  });

  const analysis: RiskAnalysisResult = {
    summary: object.summary,
    recommendation: object.recommendation as RiskRecommendation,
  };

  log(`AI recommendation: ${analysis.recommendation}`);

  return {
    analysis,
    prompt,
    dataFedToAI,
  };
}

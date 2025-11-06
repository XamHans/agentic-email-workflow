// src/company-valid-flow/types.ts
export type LogFn = (...args: unknown[]) => void;

export interface WorkflowInput {
  companyWebsite: string;
  notificationEmail?: string;
}

export interface ScrapedImpressum {
  legalName: string;
  registerNumber: string;
  directors: string[];
  sourceUrl: string;
}

export interface HandelsregisterSearchQuery {
  registerNumber?: string;
  companyName?: string;
  seat?: string;
  court?: string;
}

export interface HandelsregisterListing {
  companyName: string;
  normalizedCompanyName: string;
  registerNumber: string;
  normalizedRegisterNumber: string;
  court: string;
  seat?: string;
  legalForm?: string;
  status?: string;
  detailRelativeUrl: string;
  publicRegisterUrl: string;
}

export interface HandelsregisterRecord extends HandelsregisterListing {
  status?: string;
  registrationDate?: string;
  lastUpdate?: string;
  addressLines: string[];
  representatives: string[];
  businessPurpose?: string;
  shareCapital?: string;
  rawHtml: string;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface FinancialData {
  score: number;
  riskLevel: RiskLevel;
  provider: 'Creditreform' | 'SCHUFA';
  rawReport: string;
}

export interface ComplianceData {
  hits: number;
  status: 'clear' | 'review_required';
  rawReport: string;
}

export type RiskRecommendation = 'Approve' | 'Deny' | 'Manual Review';

export interface RiskAnalysisResult {
  summary: string;
  recommendation: RiskRecommendation;
}

export interface VerificationReport {
  overallStatus: RiskRecommendation;
  aiSummary: string;
  reportDate: string;
  sources: {
    identity: {
      legalName: string;
      registerNumber: string;
      registerCourt?: string;
      legalForm?: string;
      registeredOffice?: string;
      registerStatus?: string;
      scrapedUrl: string;
      publicRegisterLink: string;
    };
    financial: {
      provider: string;
      score: number;
      risk: string;
      rawApiData: string;
    };
    compliance: {
      status: string;
      hits: number;
      publicSanctionsLink: string;
      rawApiData: string;
    };
  };
  aiTransparency: {
    prompt: string;
    dataFedToAI: string;
  };
}

export interface ShareableReport {
  reportId: string;
  shareableLink: string;
  accessPassword: string;
  expiresAt?: string;
}

export interface NotificationResult {
  messageId: string;
  recipient: string;
}

export interface ScrapeStepState {
  workflowInput: WorkflowInput;
  scrapedData: ScrapedImpressum;
  registerRecord?: HandelsregisterRecord;
}

export interface RiskAssessmentState extends ScrapeStepState {
  financialData: FinancialData;
  complianceData: ComplianceData;
}

export interface AnalysisState extends RiskAssessmentState {
  analysis: RiskAnalysisResult;
  prompt: string;
  dataFedToAI: string;
}

export interface ReportState extends AnalysisState {
  report: VerificationReport;
}

export interface StoredReportState extends ReportState {
  shareableReport: ShareableReport;
}

export interface NotificationState extends StoredReportState {
  notification?: NotificationResult;
}

export interface VerificationWorkflowResult {
  report: VerificationReport;
  shareableReport: ShareableReport;
  notification?: NotificationResult;
}

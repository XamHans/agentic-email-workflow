// src/company-valid-flow/index.ts
import { Workflow } from '../core/workflow';
import logger from '../logger';
import { checkSanctions } from './compliance-risk-service';
import { fetchCreditReport } from './financial-risk-service';
import { generateRiskAnalysis } from './analysis-service';
import { sendShareableLinkEmail } from './email-notification-service';
import { scrapeAndExtractImpressumData } from './impressum-scraper';
import { buildVerificationReport } from './report-builder';
import { fetchHandelsregisterRecord } from './handelsregister-service';
import { storeVerificationReport } from './report-storage-service';
import type {
  AnalysisState,
  NotificationResult,
  ReportState,
  RiskAssessmentState,
  ScrapeStepState,
  StoredReportState,
  VerificationWorkflowResult,
  WorkflowInput,
} from './types';

export async function runVerificationWorkflow(
  input: WorkflowInput
): Promise<VerificationWorkflowResult> {
  const outDir = './workflow-logs';
  await setupLogsDirectory(outDir);
  const logFile = `company-verification-${Date.now()}.log`;

  logger.info(
    {
      companyWebsite: input.companyWebsite,
      notificationEmail: input.notificationEmail,
    },
    'Starting company verification workflow'
  );

  type InitialState = { workflowInput: WorkflowInput };

  const workflow = Workflow.start({ logDir: outDir, logFile, verbose: true })
    .step('initializeState', async (): Promise<InitialState> => ({
      workflowInput: input,
    }))
    .step('scrapeImpressum', async ({ input: state, log }): Promise<ScrapeStepState> => {
      const scrapedData = await scrapeAndExtractImpressumData(
        state.workflowInput.companyWebsite,
        log
      );
      return {
        workflowInput: state.workflowInput,
        scrapedData,
        registerRecord: undefined,
      };
    })
    .step('fetchHandelsregister', async ({ input: state, log }): Promise<ScrapeStepState> => {
      const registerRecord = await fetchHandelsregisterRecord(
        state.scrapedData.registerNumber,
        state.scrapedData.legalName,
        log
      );

      if (registerRecord) {
        log(
          `Handelsregister match: ${registerRecord.companyName} (${registerRecord.registerNumber})`
        );
      } else {
        log('No Handelsregister record found for scraped data.');
      }

      return {
        ...state,
        registerRecord,
      };
    })
    .parallel('riskChecks', {
      financial: async ({ input, log }) => {
        const financialData = await fetchCreditReport(
          input.scrapedData.registerNumber,
          log
        );
        return { base: input, financialData };
      },
      compliance: async ({ input, log }) => {
        const complianceData = await checkSanctions(
          input.scrapedData.legalName,
          input.scrapedData.directors,
          log
        );
        return { base: input, complianceData };
      },
    })
    .step(
      'combineRiskResults',
      async ({ input }): Promise<RiskAssessmentState> => {
        const { base } = input.financial;
        return {
          workflowInput: base.workflowInput,
          scrapedData: base.scrapedData,
          financialData: input.financial.financialData,
          complianceData: input.compliance.complianceData,
        };
      }
    )
    .step('generateAnalysis', async ({ input, log }): Promise<AnalysisState> => {
      const { analysis, prompt, dataFedToAI } = await generateRiskAnalysis(
        {
          scrapedData: input.scrapedData,
          registerRecord: input.registerRecord,
          financialData: input.financialData,
          complianceData: input.complianceData,
        },
        log
      );

      return {
        ...input,
        analysis,
        prompt,
        dataFedToAI,
      };
    })
    .step('assembleReport', async ({ input, log }): Promise<ReportState> => {
      const report = buildVerificationReport(
        input.scrapedData,
        input.registerRecord,
        input.financialData,
        input.complianceData,
        input.analysis,
        input.prompt,
        input.dataFedToAI
      );

      log(`Report assembled with status: ${report.overallStatus}`);

      return {
        ...input,
        report,
      };
    })
    .step(
      'storeReport',
      async ({ input, log }): Promise<StoredReportState> => {
        const shareableReport = await storeVerificationReport(input.report, log);
        return {
          ...input,
          shareableReport,
        };
      }
    )
    .step('sendNotification', async ({ input, log }) => {
      const recipient = input.workflowInput.notificationEmail;

      if (!recipient) {
        log('No notification email provided. Skipping email step.');
        return {
          ...input,
          notification: undefined as NotificationResult | undefined,
        };
      }

      const notification = await sendShareableLinkEmail(
        recipient,
        input.report,
        input.shareableReport,
        log
      );

      log(`Notification sent to ${recipient} with id ${notification.messageId}`);

      return {
        ...input,
        notification,
      };
    })
    .step('finalize', async ({ input }) => {
      const result: VerificationWorkflowResult = {
        report: input.report,
        shareableReport: input.shareableReport,
        notification: input.notification,
      };
      return result;
    })
    .tap('logSummary', async (result) => {
      logger.info(
        {
          status: result.report.overallStatus,
          reportId: result.shareableReport.reportId,
          notificationRecipient: result.notification?.recipient,
        },
        'Company verification workflow completed'
      );
    });

  try {
    const runResult = await workflow.run(undefined);

    console.log('\n📊 Workflow Execution Trace');
    console.table(
      runResult.trace.map((entry) => ({
        step: entry.name,
        duration_ms: entry.durationMs,
        status: entry.ok ? '✅' : '❌',
      }))
    );

    return runResult.output;
  } catch (error) {
    logger.error({ error }, 'Company verification workflow failed');
    throw error;
  }
}

async function setupLogsDirectory(dir: string) {
  const fs = await import('fs/promises');
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    logger.warn({ error, dir }, 'Failed to create logs directory');
  }
}

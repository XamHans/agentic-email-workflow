// src/core/pipeline.ts
import { createContentPlan } from '../agents/assignment-editor';
import { writeAllSections } from '../agents/creative-copywriter';
import { fetchAllCandidates } from '../sources';
import { CandidateItem, ContentPlan, WrittenSection } from '../types/schemas';
import { setupOutputDirectory, writeDebugFile } from './file-writer';
import { Workflow } from './workflow';

function formatCandidates(items: CandidateItem[]) {
  return items.map((i) => `- [${i.source}] ${i.title} (${i.url})`).join('\n');
}
function formatPlan(plan: ContentPlan) {
  return JSON.stringify(plan, null, 2);
}
function formatSections(sections: WrittenSection[]) {
  return sections
    .map((s) => `## ${s.title}\n\n${s.markdownContent}`)
    .join('\n\n');
}
function assembleFinal(sections: WrittenSection[]) {
  return sections
    .map((s) => `### ${s.title}\n\n${s.markdownContent}`)
    .join('\n\n');
}

export async function runPipeline() {
  console.log('🚀 Starting AI Newsletter Workflow with unified logging...\n');

  // STAGE 0
  const outDir = await setupOutputDirectory();
  console.log(`[SETUP] Output directory: ${outDir}\n`);

  const wf = Workflow.start({ logDir: outDir, verbose: false })
    .step('fetchCandidates', async () => {
      const candidates = await fetchAllCandidates();
      await writeDebugFile(
        outDir,
        '0-candidates.md',
        formatCandidates(candidates)
      );
      return candidates;
    })
    .step('createPlan', async ({ input }) => {
      const plan = await createContentPlan(input);
      await writeDebugFile(outDir, '1-content-plan.md', formatPlan(plan));
      return plan;
    })
    .step('writeSections', async ({ input }) => {
      const sections = await writeAllSections(input);
      await writeDebugFile(outDir, '2-sections.md', formatSections(sections));
      return sections;
    })
    .step('assembleNewsletter', async ({ input }) => {
      const newsletter = assembleFinal(input);
      await writeDebugFile(outDir, '3-final-newsletter.md', newsletter);
      return newsletter;
    })
    .tap('done', async (newsletter) => {
      console.log('\n✅ Pipeline finished successfully!');
      console.log(`\nOutput saved to ${outDir}/pipeline.log`);
    });

  try {
    const result = await wf.run(undefined);
    console.table(
      result.trace.map((t) => ({
        step: t.name,
        ms: t.durationMs,
        ok: t.ok,
      }))
    );
  } catch (err: any) {
    console.error('🚨 Pipeline failed!');
    if (err.trace) console.table(err.trace);
  }
}

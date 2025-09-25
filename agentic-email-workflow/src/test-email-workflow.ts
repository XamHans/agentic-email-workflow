import "dotenv/config";
import { mastra } from "./mastra";

async function testEmailWorkflow() {
  console.log("🚀 Starting email processing workflow test...");

  try {
    // Get the email processing workflow
    const workflow = mastra.getWorkflow("emailProcessing");

    if (!workflow) {
      throw new Error("Email processing workflow not found");
    }

    // Create a run instance
    const run = await workflow.createRunAsync();

    console.log("📧 Running email processing workflow...");

    // Start the workflow with default settings (process up to 10 emails)
    const result = await run.start({
      inputData: {
        maxEmails: 5, // Process up to 5 emails for testing
      },
    });

    console.log("✅ Workflow completed!");
    console.log(`📊 Status: ${result.status}`);

    if (result.status === "success") {
      console.log(`📈 Total emails processed: ${result.result.totalProcessed}`);
      console.log("\n📋 Processing results:");

      result.result.results.forEach((emailResult, index) => {
        console.log(`\n${index + 1}. Email ID: ${emailResult.emailId}`);
        console.log(`   Intent: ${emailResult.intent}`);
        console.log(`   Action: ${emailResult.action}`);
        console.log(`   Success: ${emailResult.success ? "✅" : "❌"}`);
        if (emailResult.details) {
          console.log(`   Details: ${emailResult.details}`);
        }
      });

      // Summary by intent
      const intentCounts = result.result.results.reduce((acc, res) => {
        acc[res.intent] = (acc[res.intent] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log("\n📊 Summary by intent:");
      Object.entries(intentCounts).forEach(([intent, count]) => {
        console.log(`   ${intent}: ${count} emails`);
      });

    } else if (result.status === "failed") {
      console.error("❌ Workflow failed:", result.error);
    } else if (result.status === "suspended") {
      console.log("⏸️ Workflow suspended:", result.suspended);
    }

  } catch (error) {
    console.error("💥 Error running workflow:", error);
  }
}

// Run the test
testEmailWorkflow();
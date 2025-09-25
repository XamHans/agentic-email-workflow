import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import fs from "fs";
import path from "path";

const humanReviewDir = path.join(process.cwd(), "human-review");

// Ensure the directory exists
if (!fs.existsSync(humanReviewDir)) {
  fs.mkdirSync(humanReviewDir, { recursive: true });
}

export const storeForHumanReviewTool = createTool({
  id: "store-for-human-review",
  description: "Stores an email in the human review queue",
  inputSchema: z.object({
    email: z.object({
      id: z.string(),
      subject: z.string(),
      from: z.string(),
      body: z.string(),
      date: z.string(),
    }),
    reason: z.string().describe("Reason why this email needs human review"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    filePath: z.string(),
  }),
  execute: async ({ context }) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${context.email.id}_${timestamp}.json`;
    const filePath = path.join(humanReviewDir, fileName);

    const reviewItem = {
      email: context.email,
      reason: context.reason,
      storedAt: new Date().toISOString(),
      status: "pending",
    };

    fs.writeFileSync(filePath, JSON.stringify(reviewItem, null, 2));

    return {
      success: true,
      filePath,
    };
  },
});

export const getHumanReviewQueueTool = createTool({
  id: "get-human-review-queue",
  description: "Gets all emails in the human review queue",
  inputSchema: z.object({}),
  outputSchema: z.object({
    items: z.array(z.object({
      email: z.object({
        id: z.string(),
        subject: z.string(),
        from: z.string(),
        body: z.string(),
        date: z.string(),
      }),
      reason: z.string(),
      storedAt: z.string(),
      status: z.string(),
      filePath: z.string(),
    })),
  }),
  execute: async () => {
    const files = fs.readdirSync(humanReviewDir);
    const items = [];

    for (const file of files) {
      if (file.endsWith(".json")) {
        const filePath = path.join(humanReviewDir, file);
        const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
        items.push({
          ...content,
          filePath,
        });
      }
    }

    return { items };
  },
});
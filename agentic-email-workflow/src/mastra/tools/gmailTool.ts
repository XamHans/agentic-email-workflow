import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

const tokenPath = path.join(process.cwd(), "token.json");

const getGmailClient = () => {
  const token = JSON.parse(fs.readFileSync(tokenPath, "utf8"));

  const oauth2Client = new google.auth.OAuth2(
    token.client_id,
    token.client_secret,
    "urn:ietf:wg:oauth:2.0:oob"
  );

  oauth2Client.setCredentials({
    refresh_token: token.refresh_token,
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
};

export const getUnreadEmailsTool = createTool({
  id: "get-unread-emails",
  description: "Fetches unread emails from Gmail",
  inputSchema: z.object({
    maxResults: z.number().optional().default(10).describe("Maximum number of emails to fetch"),
  }),
  outputSchema: z.object({
    emails: z.array(z.object({
      id: z.string(),
      subject: z.string(),
      from: z.string(),
      body: z.string(),
      date: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    const gmail = getGmailClient();

    const response = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
      maxResults: context.maxResults,
    });

    const messages = response.data.messages || [];
    const emails = [];

    for (const message of messages) {
      const emailData = await gmail.users.messages.get({
        userId: "me",
        id: message.id!,
        format: "full",
      });

      const headers = emailData.data.payload?.headers || [];
      const subject = headers.find(h => h.name === "Subject")?.value || "";
      const from = headers.find(h => h.name === "From")?.value || "";
      const date = headers.find(h => h.name === "Date")?.value || "";

      let body = "";
      if (emailData.data.payload?.parts) {
        const textPart = emailData.data.payload.parts.find(part =>
          part.mimeType === "text/plain"
        );
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
        }
      } else if (emailData.data.payload?.body?.data) {
        body = Buffer.from(emailData.data.payload.body.data, "base64").toString("utf-8");
      }

      emails.push({
        id: message.id!,
        subject,
        from,
        body,
        date,
      });
    }

    return { emails };
  },
});

export const sendEmailTool = createTool({
  id: "send-email",
  description: "Sends an email reply via Gmail",
  inputSchema: z.object({
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body content"),
    inReplyTo: z.string().optional().describe("Original email ID for threading"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const gmail = getGmailClient();

    const message = [
      `To: ${context.to}`,
      `Subject: ${context.subject}`,
      context.inReplyTo ? `In-Reply-To: ${context.inReplyTo}` : "",
      "",
      context.body,
    ].filter(Boolean).join("\n");

    const encodedMessage = Buffer.from(message).toString("base64url");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    return {
      success: true,
      messageId: response.data.id,
    };
  },
});

export const archiveEmailTool = createTool({
  id: "archive-email",
  description: "Archives an email by removing it from inbox",
  inputSchema: z.object({
    emailId: z.string().describe("Email ID to archive"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async ({ context }) => {
    const gmail = getGmailClient();

    await gmail.users.messages.modify({
      userId: "me",
      id: context.emailId,
      requestBody: {
        removeLabelIds: ["INBOX"],
      },
    });

    return { success: true };
  },
});
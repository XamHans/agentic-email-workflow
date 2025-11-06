# B2B Company Verification Workflow

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Workflow Architecture](#workflow-architecture)
- [Implementation Details](#implementation-details)
  - [Handelsregister Integration](#handelsregister-integration)
  - [Step 1: Scrape & Extract](#step-1-scrape--extract-impressum-scraper-ts)
  - [Step 2: Parallel Risk Assessment](#step-2-parallel-risk-assessment)
  - [Step 3: AI Synthesis](#step-3-ai-synthesis-llm)
  - [Step 4: Save Report & Generate Link](#step-4-save-report--generate-link-report-storage-service-ts)
  - [Step 5: Send Shareable Link Email](#step-5-send-shareable-link-email-email-notification-service-ts)
- [Key Features](#key-features)
- [Technical Stack](#technical-stack)

---

## Project Overview

This project provides an automated, end-to-end workflow for B2B new company verification, specifically tailored for the German market. It transforms a manual, hours-long process into a streamlined, 60-second automated verification system.

---

## The Problem

Manually verifying a new B2B customer in Germany is **slow, manual, and error-prone**. It requires a sales or compliance employee to:

- 🔍 **Manually find** the company's legal notice (Impressum)
- 📋 **Copy-paste** the legal name and register number
- 🔐 **Log into** a credit agency portal (like Creditreform) and run a check
- ⚖️ **Log into** a separate compliance portal to check sanctions lists
- 📊 **Manually assemble** this data and make a decision

> **This process can take hours or even days.**

---

## The Solution

This workflow **automates the entire process in under 60 seconds**. It takes a company's website as input and, using web scraping, AI, and parallel processing, it:

1. ✅ **Generates** a complete, auditable verification report
2. 💾 **Saves** this report to a Postgres database
3. 🔗 **Creates** a secure, password-protected web link for the report
4. 📧 **Automatically emails** this secure link to the customer

This allows us to track customer engagement (i.e., if/when they view the report) and provides a modern, shareable experience.

---

## Workflow Architecture

The system is built on a custom `workflow.ts` engine and orchestrates several steps, as shown in this diagram:

```mermaid
flowchart LR
    subgraph "B2B Verification Workflow"
        direction LR
        A(Start) --> B[Step 1: Scrape Impressum]
        B --> C{Step 2: Parallel Risk Check}
        C --> D[Financial API (Creditreform)]
        C --> E[Compliance API (Sanctions)]
        D --> F([Join])
        E --> F
        F --> G[Step 3: AI Synthesis]
        G --> H[Step 4: Save to DB & Get Link]
        H --> I[Step 5: Send Secure Email]
        I --> J(End)
    end
```

---

## Implementation Details

### Handelsregister Integration

To retrieve official register data without a browser we introduce a dedicated `HandelsregisterClient`. It keeps a lightweight cookie jar, mimics a modern Chromium user agent, and submits the same form data that the public Handelsregister portal expects. The client exposes two typed methods:

- `search(query)` posts a search form (by register number and/or company name) and parses the HTML table into lean `HandelsregisterListing` results.
- `getCompanyDetails(listing)` follows the detail link, normalises key/value rows, and returns a rich `HandelsregisterRecord` object (name, court, register number, address, status, update timestamps, etc.) plus a deep link to the official register entry.

The service stays headless by relying on `undici` for HTTP, `URLSearchParams` for form submissions, and `JSDOM` for DOM querying—no Playwright dependency at runtime. Downstream steps can therefore enrich the identity section of the verification report with first-party register data while keeping the workflow fully automated.

- **Local CLI:** `pnpm exec ts-node src/company-valid-flow/handelsregister-cli.ts HRB123456 "Muster GmbH"` will perform an on-demand lookup and print the normalised register payload. Network access to handelsregister.de is required when running this helper.

### Step 1: Scrape & Extract (`impressum-scraper.ts`)

**Input:** A company website (e.g., `beispiel-gmbh.de`)

**Action:**

- 🌐 Fetches the HTML from the legally-mandated `/impressum` (Legal Notice) page
- 📝 Uses `jsdom` and `readability` to parse and extract the clean, relevant text content
- 🤖 Feeds this text to the Vercel AI SDK's `generateObject` function

**Output:** A structured JSON object with the company's exact `legalName`, `registerNumber`, and `directors`.

---

### Step 2: Parallel Risk Assessment

**Input:** The structured data from Step 1

**Action:** The workflow runs two checks **simultaneously** to save time:

- **Financial Check:** Calls a (mocked) Creditreform API with the `registerNumber` to get a credit score
- **Compliance Check:** Calls a (mocked) Sanctions API with the `legalName` and `directors` list to check against blacklists

**Output:** Two JSON objects with raw risk data

---

### Step 3: AI Synthesis (LLM)

**Input:** All the raw data collected so far (identity, financial, compliance)

**Action:** Uses `generateObject` with a specific schema. The AI acts as a **"Senior Risk Analyst"** to:

- 📖 Read all the disparate data
- 📝 Provide a simple, one-sentence `aiSummary`
- ⚖️ Make a final `overallStatus` recommendation: `Approve`, `Deny`, or `Manual Review`

**Output:** A `VerificationReport` object with the final AI verdict

---

### Step 4: Save Report & Generate Link (`report-storage-service.ts`)

**Input:** The final `VerificationReport` object

**Action:**

- 🔑 Generates a unique `reportId` and a secure, random `accessPassword`
- 🔐 Hashes the password for database storage (never store plain text)
- 💾 Saves the full `VerificationReport` as JSONB in a Postgres database (mocked)
- 🔗 Creates a shareable link (e.g., `https://your-service.com/report/[reportId]`)

**Output:** A `ShareableReport` object containing the `shareableLink` and the plain-text `accessPassword` (to be used in the next step only)

---

### Step 5: Send Shareable Link Email (`email-notification-service.ts`)

**Input:** The `ShareableReport` object and customer email

**Action:**

- 📧 Crafts an email to the customer
- 🔗 Includes the `shareableLink` and the `accessPassword` needed to view the report
- 📤 Sends the email (mocked)

**Output:** A `messageId` confirming the email was sent

---

## Key Features

### 🤖 AI-Powered Extraction

Uses `generateObject` to reliably get structured data from unstructured HTML

### 📊 Automated Risk Analysis

Uses an LLM to summarize complex data into a simple, actionable verdict

### 📈 Trackable Customer Engagement

By saving reports to a database and using a secure link, we can log every time a customer (or their colleagues) accesses the report

### 🔒 Secure & Shareable

Replaces insecure PDF attachments with a modern, password-protected web portal

### 🔧 Extensible

Built on the custom `workflow.ts` engine, so new steps (e.g., updating a CRM, sending a Slack notification) can be easily added

---

## Technical Stack

- **Workflow Engine:** Custom `workflow.ts`
- **Web Scraping:** `jsdom` + `readability`
- **AI Processing:** Vercel AI SDK (`generateObject`)
- **Database:** Postgres (JSONB storage)
- **Security:** Password hashing + secure link generation
- **Email:** Automated notification service
- **Processing:** Parallel execution for performance

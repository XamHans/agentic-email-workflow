# Agentic Email Workflow

A Mastra-powered email processing workflow that automatically processes Gmail emails with AI-driven intent classification and routing.

## Features

- **Automatic Email Processing**: Fetches unread emails from Gmail
- **Intent Classification**: AI agent classifies emails into 4 categories:
  - `reply` - Emails requiring direct response
  - `meeting` - Meeting scheduling requests
  - `human_review` - Complex emails needing human attention
  - `archive` - Informational emails to be archived
- **Smart Routing**: Routes emails to appropriate agents based on intent
- **Google Integration**: Uses Gmail API and Google Calendar API
- **Human Review Queue**: Stores complex emails for manual review

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Setup**:
   - Copy `.env.example` to `.env`
   - Add your OpenAI API key
   - Ensure `token.json` contains valid Google OAuth credentials

3. **Google OAuth Setup**:
   - The workflow uses the existing `token.json` file for Gmail and Calendar API access
   - Make sure the token has the following scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.modify`
     - `https://www.googleapis.com/auth/calendar`

## Usage

### Run the Email Processing Workflow

```bash
npm test
```

This will:
1. Fetch up to 5 unread emails from Gmail
2. Classify each email using the AI classification agent
3. Route emails to appropriate handlers:
   - Send professional replies for `reply` emails
   - Create calendar events for `meeting` requests
   - Store `human_review` emails in `./human-review/` directory
   - Archive `archive` emails

### Start Mastra Dev Server

```bash
npm run dev
```

Access the Mastra playground at `http://localhost:4111` to:
- Test individual agents and tools
- Monitor workflow executions
- View the human review queue

## Architecture

### Agents
- **Classification Agent**: Analyzes email content and determines intent
- **Reply Agent**: Crafts and sends professional email responses
- **Calendar Agent**: Creates calendar events and sends meeting confirmations
- **Archive Agent**: Archives informational emails

### Tools
- **Gmail Tools**: Fetch, send, and archive emails
- **Calendar Tool**: Create Google Calendar events
- **Storage Tools**: Manage human review queue

### Workflow
1. **Fetch Emails**: Get unread emails from Gmail
2. **Classify**: Determine intent for each email
3. **Route**: Send to appropriate agent based on classification
4. **Execute**: Perform the required action (reply, schedule, store, archive)

## File Structure

```
src/
├── mastra/
│   ├── agents/          # AI agents for different tasks
│   ├── tools/           # Tools for Gmail, Calendar, and storage
│   ├── workflows/       # Main email processing workflow
│   └── index.ts         # Mastra instance configuration
├── test-email-workflow.ts # Test script
human-review/            # Directory for emails requiring human attention
token.json              # Google OAuth credentials
```

## Customization

### Modify Classification Logic
Edit `src/mastra/agents/classificationAgent.ts` to adjust intent categories or classification criteria.

### Customize Reply Templates
Modify `src/mastra/agents/replyAgent.ts` to change the response style and templates.

### Adjust Email Processing Limits
Change the `maxEmails` parameter in the test script or workflow to process more/fewer emails.

## Following KISS & YAGNI Principles

This implementation follows Keep It Simple, Stupid (KISS) and You Aren't Gonna Need It (YAGNI) principles:

- **Simple conditional routing** instead of complex workflow orchestration
- **File-based storage** for human review instead of a database
- **Four clear intent categories** instead of complex classification
- **Direct tool execution** without unnecessary abstractions
- **Minimal configuration** using existing Google OAuth tokens

## Troubleshooting

1. **Authentication Issues**: Ensure `token.json` is valid and has necessary scopes
2. **API Rate Limits**: Gmail and Calendar APIs have rate limits; adjust processing frequency if needed
3. **Classification Accuracy**: Fine-tune the classification agent's instructions for better results
4. **Missing Dependencies**: Run `npm install` to ensure all packages are installed
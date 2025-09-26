# AI Email Processing Workflow - Learning Module

Learn to build an intelligent email automation system that processes Gmail messages using AI classification and takes automated actions like replying, scheduling meetings, and archiving emails.

## 🎯 What You'll Build

An AI-powered email workflow that:
- Fetches unread emails from Gmail
- Classifies each email's intent using AI (reply, meeting, archive, human review)
- Automatically generates replies for personal emails
- Creates calendar events for meeting requests
- Archives newsletters and notifications
- Logs all actions for audit trails

## 🛠️ Prerequisites

- **Node.js 18+** installed
- **Google account** with Gmail and Calendar access
- **OpenAI API key** for AI classification and reply generation

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd email-workflow-native
npm install
```

### 2. Setup Google Authentication

Run the token generation script to authenticate with Google APIs:

```bash
npx ts-node gen-token.ts
```

This will:
- Open your browser for Google OAuth
- Create `credentials.json` and `token.json` files
- Grant necessary permissions for Gmail and Calendar access

### 3. Configure OpenAI

Create a `.env` file in the project root:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### 4. Run the Email Workflow

```bash
npx ts-node src/main.ts
```

The system will:
- Fetch unread emails from your Gmail
- Process each email through AI classification
- Take appropriate actions based on email type
- Generate detailed logs of all operations

## 📁 Project Structure

```
email-workflow-native/
├── src/
│   ├── main.ts          # Main workflow orchestration
│   ├── auth.ts          # Google OAuth authentication
│   ├── gmail.ts         # Email fetching and parsing
│   ├── ai.ts            # AI classification and generation
│   ├── actions.ts       # Email action handlers
│   ├── audit.ts         # Action logging system
│   └── logger.ts        # Structured logging
├── gen-token.ts         # Google authentication setup
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## 🔍 How It Works

### Email Processing Flow

1. **Authentication** - Connects to Gmail and Calendar APIs using OAuth
2. **Email Fetching** - Retrieves unread emails from inbox
3. **AI Classification** - Analyzes email content to determine intent:
   - `reply` - Personal emails requiring human response
   - `meeting` - Meeting requests or scheduling
   - `archive` - Newsletters, notifications, receipts
   - `human_review` - Complex emails needing manual review
4. **Action Execution** - Performs appropriate action based on classification
5. **Audit Logging** - Records all actions for transparency

### Key Components

#### AI Classification (`src/ai.ts`)
- Uses OpenAI GPT-4 for email intent detection
- Structured output with Zod schemas for type safety
- Context-aware prompts for accurate classification

#### Action Handlers (`src/actions.ts`)
- **Reply**: Generates contextual responses and sends via Gmail
- **Meeting**: Extracts meeting details and creates calendar events
- **Archive**: Removes emails from inbox
- **Human Review**: Saves emails as markdown files for manual processing

#### Error Handling
- Individual email failures don't stop the workflow
- Comprehensive error logging with email context
- Graceful degradation for API failures

## 📊 Sample Output

```
[INFO] Starting email processing workflow...
[INFO] Successfully authenticated with Google APIs
[INFO] Found 5 unread emails. Fetching details...
[INFO] Processing email with subject: "Meeting Request - Project Review"
[INFO] Detected intent: meeting, confidence: 0.95
[INFO] Successfully scheduled meeting
[INFO] Processing email with subject: "Weekly Newsletter"
[INFO] Detected intent: archive, confidence: 0.98
[INFO] Archiving email
[INFO] Workflow finished.
```

## 🔧 Configuration Options

### Email Classification Rules

The AI uses specific rules to classify emails:

- **Meeting**: Future meeting requests with specific dates/times
- **Reply**: Personal emails from individuals requiring responses
- **Archive**: Mass communications, newsletters, notifications, receipts
- **Human Review**: Important but unclear emails needing careful consideration

### Customization

Modify `src/ai.ts` to:
- Adjust classification prompts
- Add new email types or intents
- Change confidence thresholds
- Customize reply generation style

## 📝 Logs and Outputs

- **Console Logs**: Real-time processing status with structured logging
- **Audit Logs**: CSV files tracking all email actions (`audit.csv`)
- **Review Files**: Emails marked for human review saved in `./review/` directory

## 🎓 Learning Objectives

By completing this module, you'll understand:

1. **OAuth 2.0 Flow**: Secure API authentication with Google services
2. **Structured AI Output**: Using Zod schemas for reliable AI responses
3. **Error Isolation**: Building resilient systems that handle individual failures
4. **Audit Trails**: Comprehensive logging for production systems
5. **Modular Architecture**: Separating concerns for maintainable code

## 🚨 Troubleshooting

### Authentication Issues

**Problem**: `Failed to authenticate with Google`
**Solution**:
- Ensure `credentials.json` exists in project root
- Re-run `npx ts-node gen-token.ts` to refresh tokens
- Check that Gmail and Calendar APIs are enabled

### API Rate Limits

**Problem**: `Quota exceeded` errors
**Solution**:
- Reduce email batch size in `src/gmail.ts`
- Add delays between API calls
- Check Google Cloud Console quota limits

### Missing Dependencies

**Problem**: Module not found errors
**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### OpenAI API Issues

**Problem**: `Invalid API key` or quota errors
**Solution**:
- Verify `.env` file contains correct `OPENAI_API_KEY`
- Check OpenAI account usage and billing
- Ensure API key has necessary permissions

## 🔄 Next Steps

Once you have the basic workflow running:

1. **Test with Different Email Types**: Send yourself various email types to see classification in action
2. **Modify Classification Rules**: Adjust prompts in `src/ai.ts` for your use case
3. **Add Custom Actions**: Implement new handlers in `src/actions.ts`
4. **Integrate Webhooks**: Set up real-time email processing
5. **Add Email Templates**: Create dynamic reply templates
6. **Implement Scheduling**: Run the workflow on a schedule

## 📚 Key Technologies

- **TypeScript**: Type-safe development
- **Gmail API**: Email access and manipulation
- **Google Calendar API**: Meeting scheduling
- **OpenAI API**: AI classification and generation
- **Zod**: Runtime type validation
- **Pino**: Structured logging

## 💡 Production Considerations

- **Rate Limiting**: Implement exponential backoff for API calls
- **Monitoring**: Add health checks and alerting
- **Security**: Rotate API keys regularly, use least privilege access
- **Scaling**: Consider message queues for high-volume processing
- **Testing**: Add unit tests for each component

---

**Happy Learning!** 🚀

This workflow demonstrates practical AI integration patterns that can be applied to many business automation challenges.
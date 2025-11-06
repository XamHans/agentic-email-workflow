# Content Creation Workflow

An AI-powered workflow that automatically generates YouTube Shorts scripts from your calendar events.

## Overview

This workflow:
1. **Fetches** calendar events from the next 10 days
2. **Classifies** which events are content-related using AI
3. **Researches** each content topic using OpenAI's web search
4. **Generates** YouTube Shorts scripts following best practices
5. **Updates** calendar events with the generated scripts
6. **Emails** you a summary of all generated content

## Features

- 🔍 **AI-Powered Classification**: Automatically identifies content creation events
- 🌐 **Web Research**: Uses OpenAI Responses API with native web search
- 📝 **YouTube Shorts Framework**: Follows proven best practices for viral educational content
- 📅 **Calendar Integration**: Updates Google Calendar events with full scripts
- 📧 **Email Summaries**: Sends formatted summaries to your email

## Setup

### Prerequisites

1. Google Calendar API credentials (OAuth 2.0)
2. OpenAI API key with access to Responses API
3. Node.js and npm/yarn installed

### Installation

```bash
cd email-workflow-native
npm install
```

### Configuration

1. Ensure your `.env` file contains:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

2. Make sure you have valid Google credentials:
   - `credentials.json` - OAuth 2.0 client credentials
   - `token.json` - Authorized token (generated after first OAuth flow)

3. Update recipient email in `src/content-main.ts` if needed (default: `muellerjohannes93@gmail.com`)

## Usage

Run the content creation workflow:

```bash
npm run content
```

Or directly:

```bash
ts-node src/content-main.ts
```

### What Happens

1. **Scans Calendar**: Looks at events in the next 10 days
2. **AI Classification**: Identifies content-related events (YouTube, blog, social media, etc.)
3. **For Each Content Event**:
   - Performs web research on the topic
   - Generates a complete YouTube Shorts script with:
     - Attention-grabbing hook (1-2 seconds)
     - One clear educational concept
     - Fast-paced script body (30-60 seconds)
     - Visual cues and on-screen text suggestions
     - Strong call-to-action
     - Optimized title and hashtags
   - Updates the calendar event description with the full script
4. **Sends Email**: Comprehensive summary of all generated scripts

## File Structure

```
src/
├── content-main.ts              # Entry point for content workflow
├── core/
│   ├── content-workflow.ts      # Main orchestrator
│   ├── calendar-service.ts      # Google Calendar operations
│   ├── web-research-agent.ts    # Web research using OpenAI
│   ├── youtube-script-generator.ts # Script generation
│   ├── email-service.ts         # Email sending
│   └── workflow.ts              # Workflow framework (existing)
├── ai.ts                        # AI schemas and functions
├── auth.ts                      # Google authentication
└── logger.ts                    # Logging
```

## YouTube Shorts Framework

The workflow follows these proven best practices:

### 1. Hook (First 1-2 Seconds)
- Stops the scroll immediately
- Creates curiosity + relevance
- Examples: "Most people don't know this, but...", "In 10 seconds, I'll teach you..."

### 2. One Clear Idea
- Each Short teaches ONE concept only
- Makes content memorable and binge-able

### 3. Fast Pace + Visuals
- Quick cuts, no long pauses
- On-screen text and diagrams
- Large subtitles for accessibility

### 4. Strong CTA
- Value-driven, not begging
- Examples: "Follow for 1 smart lesson a day", "Subscribe so you don't miss the next trick"

### 5. Shareable Content
- Surprising facts, myths vs truth
- Quick hacks and before/after comparisons

### 6. Optimization
- SEO-friendly titles
- 2-4 relevant hashtags

## Output

### Calendar Events
Each processed event will have its description updated with:
- Original event notes (preserved)
- Complete YouTube Shorts script
- Title and main concept
- Hook and script body
- Visual cues
- Call-to-action
- Hashtags and metadata

### Email Summary
You'll receive an email with:
- List of all processed events
- Script previews for each
- Links to full scripts in calendar
- Generation timestamp
- Tips for using the scripts

### Logs
Detailed logs are saved to `./workflow-logs/pipeline.log`

## Customization

### Change Time Range
In `src/content-main.ts`, modify:
```typescript
const DAYS_AHEAD = 10; // Change to your preferred number of days
```

### Change Recipient Email
In `src/content-main.ts`, modify:
```typescript
const RECIPIENT_EMAIL = 'your-email@gmail.com';
```

### Adjust Content Classification
In `src/ai.ts`, modify the `classifyContentEvent()` prompt to adjust what counts as "content-related"

### Customize Script Framework
In `src/ai.ts`, modify the `generateYouTubeScript()` prompt to adjust the script generation rules

## Troubleshooting

### "No content events found"
- Check that your calendar events have descriptive titles
- Events should mention content types like "YouTube", "video", "blog", "post", etc.
- Or let AI classify based on event description

### "Web research failed"
- Ensure your OpenAI API key has access to the Responses API
- Check that you're not hitting rate limits
- Verify internet connectivity

### "Failed to update calendar"
- Ensure Google Calendar API is enabled
- Check that your OAuth token has calendar write permissions
- Verify the event still exists

### "Email not sent"
- Check Gmail API is enabled
- Verify OAuth token has Gmail send permissions
- Ensure recipient email is valid

## Development

### Run Original Email Workflow
```bash
npm start
```

### Run Content Workflow
```bash
npm run content
```

### Enable Verbose Logging
In `src/core/content-workflow.ts`, change:
```typescript
const workflow = Workflow.start({ logDir: outDir, verbose: true })
```

## Contributing

The workflow uses a modular architecture:
- Each service is independent and testable
- Add new content types by extending the schemas in `src/ai.ts`
- Add new actions by extending `src/core/content-workflow.ts`

## License

Part of the email-workflow-native project.

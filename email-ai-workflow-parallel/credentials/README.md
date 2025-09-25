# Credentials Directory

This directory contains organized Google API credentials for different services.

## Structure

```
credentials/
├── gmail/
│   ├── credentials.json    # Gmail API credentials
│   └── token.json         # Gmail OAuth token
└── calendar/
    ├── credentials.json   # Calendar API credentials  
    └── token.json        # Calendar OAuth token
```

## Setup

1. **Gmail Credentials**: Replace the placeholder content in `gmail/credentials.json` and `gmail/token.json` with your actual Gmail API credentials.

2. **Calendar Credentials**: Replace the placeholder content in `calendar/credentials.json` and `calendar/token.json` with your actual Calendar API credentials.

## Current Status

**⚠️ All API calls are currently MOCKED** - No actual API requests are made to Google services. All tools return mock data and log console messages instead of performing real operations.

This is safe for development and testing without affecting real Gmail/Calendar accounts.

## Mock Behavior

### Gmail Tools
- `fetchUnreadEmailsTool`: Returns 3 mock emails
- `sendEmailTool`: Logs email details to console
- `markEmailAsReadTool`: Logs action to console  
- `archiveEmailTool`: Logs action to console

### Calendar Tools
- `checkCalendarAvailabilityTool`: Returns mock availability data
- `createCalendarEventTool`: Logs event details to console
- `suggestMeetingTimesTool`: Returns mock meeting suggestions
# AI SDK Structured Output Demo

This demo shows the difference between raw AI responses and structured output using the Vercel AI SDK.

## Setup

1. Clone this repository
2. Install dependencies: `npm install`
3. Add your OpenAI API key to `.env.local`
4. Run the development server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000)

## What it demonstrates

- **Raw AI Response**: Shows unpredictable, hard-to-parse AI output
- **Structured Output**: Shows guaranteed, type-safe JSON using `generateObject` and Zod schemas

## Key features

- Side-by-side comparison
- Sample emails for testing
- Real-time classification
- Visual explanation of benefits

## Learning points

- Why raw AI responses are problematic for production
- How Zod schemas define data structure
- How `generateObject` ensures reliable output
- Type safety and validation benefits
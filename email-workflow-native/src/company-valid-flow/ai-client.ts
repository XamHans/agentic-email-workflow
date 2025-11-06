// src/company-valid-flow/ai-client.ts
import { createGoogleGenerativeAI } from '@vercel/ai';

const MODEL_ID = 'models/gemini-2.5-flash-preview-09-2025';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY ?? 'MOCK_API_KEY_placeholder',
});

export function getGeminiModel(modelId: string = MODEL_ID) {
  return google(modelId);
}

declare module '@vercel/ai' {
  type GoogleClient = (modelId: string) => any;

  export function createGoogleGenerativeAI(config: {
    apiKey: string;
  }): GoogleClient;
}

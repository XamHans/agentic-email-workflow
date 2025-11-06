declare module 'drizzle-orm/neon-http' {
  export type NeonHttpDatabase<TSchema = any> = any;
  export function drizzle<TSchema = any>(
    client: any,
    config?: { schema?: TSchema }
  ): NeonHttpDatabase<TSchema>;
}

declare module 'drizzle-orm/pg-core' {
  export const pgTable: any;
  export const text: any;
  export const jsonb: any;
  export const timestamp: any;
}

declare module '@neondatabase/serverless' {
  export type NeonQueryFunction = any;
  export function neon(connectionString: string): NeonQueryFunction;
}

// src/db/client.ts
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { schema } from './schema';

type Database = NeonHttpDatabase<typeof schema>;

let cachedDb: Database | undefined;

export function getDatabase(): Database {
  if (cachedDb) return cachedDb;

  const connectionString =
    process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'Missing Neon connection string. Set NEON_DATABASE_URL or DATABASE_URL.'
    );
  }

  const client: NeonQueryFunction = neon(connectionString);
  cachedDb = drizzle(client, { schema });
  return cachedDb;
}

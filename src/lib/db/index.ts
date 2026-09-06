import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

/**
 * Postgres is optional in development. With no DATABASE_URL the app runs
 * entirely on the deterministic mock generator, so `npm run dev` works on a
 * fresh clone with no setup — which is also what CI uses.
 */
export const hasDatabase = Boolean(process.env.DATABASE_URL);

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  if (!hasDatabase) {
    throw new Error('DATABASE_URL is not set — callers must check hasDatabase first.');
  }
  cached ??= drizzle(neon(process.env.DATABASE_URL!), { schema });
  return cached;
}

export { schema };

import type { SQL } from 'drizzle-orm';

export interface Transaction {
  execute<T extends Record<string, unknown> = Record<string, unknown>>(query: SQL): Promise<{ rows: T[] }>;
}
export interface Database {
  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
}

// Both the Neon and local PostgreSQL Drizzle adapters implement this boundary.
// Keeping it narrow lets integration tests run the actual game service locally.
export function databaseAdapter(native: {
  transaction<T>(work: (tx: { execute(query: SQL): Promise<unknown> }) => Promise<T>, config?: { isolationLevel: 'read committed' }): Promise<T>;
}): Database {
  return {
    transaction: work => native.transaction(async nativeTx => {
      const tx: Transaction = {
        async execute<T extends Record<string, unknown>>(query: SQL) {
          const result = await nativeTx.execute(query);
          if (!result || typeof result !== 'object' || !('rows' in result) || !Array.isArray(result.rows)) throw new Error('Unexpected database response.');
          return { rows: result.rows as T[] };
        },
      };
      return work(tx);
    }, { isolationLevel: 'read committed' }),
  };
}

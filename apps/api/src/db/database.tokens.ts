import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema';

export const PG_POOL = Symbol('PG_POOL');
export const DATABASE = Symbol('DATABASE');
export const AUTH_DATABASE = Symbol('AUTH_DATABASE');

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

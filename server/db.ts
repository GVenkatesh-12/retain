import { createClient, type Client, type InStatement, type Row } from '@libsql/client';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const schemaUrl = new URL('./schema.sql', import.meta.url);
const localUrl = process.env.TURSO_DATABASE_URL || 'file:./retain.db';
export const db: Client = createClient({ url: localUrl, authToken: process.env.TURSO_AUTH_TOKEN });

export async function migrate(): Promise<void> {
  const schema = await readFile(schemaUrl, 'utf8');
  const statements = schema.split(';').map((sql) => sql.trim()).filter(Boolean);
  for (const sql of statements) {
    await db.execute(sql);
  }
}

export type DbRow = Row & Record<string, unknown>;
export async function query(sql: string, args: Record<string, string | number | null> = {}): Promise<DbRow[]> {
  const result = await db.execute({ sql, args });
  return result.rows as DbRow[];
}

export async function execute(sql: string, args: Record<string, string | number | null> = {}) {
  return db.execute({ sql, args });
}

export async function transaction(statements: Array<{ sql: string; args?: Record<string, string | number | null> }>) {
  return db.batch(statements.map((statement): InStatement => ({ sql: statement.sql, args: statement.args ?? {} })), 'write');
}

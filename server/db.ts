import { createClient, type Client, type InStatement, type Row } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

try {
  const envContent = readFileSync('.env.local', 'utf8');
  for (const line of envContent.split('\n')) {
    const idx = line.indexOf('=');
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k && !process.env[k]) process.env[k] = v;
    }
  }
} catch {}

const schemaUrl = new URL('./schema.sql', import.meta.url);
const localUrl = process.env.TURSO_DATABASE_URL || 'file:./retain.db';
export const db: Client = createClient({ url: localUrl, authToken: process.env.TURSO_AUTH_TOKEN });

export async function migrate(): Promise<void> {
  const schema = await readFile(schemaUrl, 'utf8');
  const statements = schema.split(';').map((sql) => sql.trim()).filter(Boolean);
  for (const sql of statements) {
    await db.execute(sql);
  }
  // Seed default user if not already present
  await db.execute({
    sql: `INSERT OR IGNORE INTO users (id, email, password_hash, password_salt, created_at)
          VALUES (:id, :email, :password_hash, :password_salt, :created_at)`,
    args: {
      id: 'user-gvenkatesh',
      email: 'gvenkatesh.on@gmail.com',
      password_hash: '2a52bd126fed1aacf12d39236c4d669ab114b2f3690fdd217897d61ca133b448',
      password_salt: 'retain_salt_gvenkatesh',
      created_at: new Date().toISOString(),
    },
  });
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

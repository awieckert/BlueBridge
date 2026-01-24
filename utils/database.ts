import * as SQLite from 'expo-sqlite';

export const DB_NAME = 'bluebridge.db';

export const SCHEMA = {
  MESSAGES: `
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('incoming', 'outgoing')),
      status TEXT NOT NULL CHECK(status IN ('sent', 'queued', 'failed', 'delivered')),
      created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') || substr(strftime('%f', 'now'), 4) as INTEGER))
    );
  `,
  MESSAGES_INDEXES: `
    CREATE INDEX IF NOT EXISTS idx_conversation ON messages(conversation_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_status ON messages(status);
  `,
  CONVERSATIONS: `
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      phone_number TEXT UNIQUE NOT NULL,
      last_message_preview TEXT,
      last_message_timestamp INTEGER,
      unread_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') || substr(strftime('%f', 'now'), 4) as INTEGER)),
      updated_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') || substr(strftime('%f', 'now'), 4) as INTEGER))
    );
  `,
  QUEUE: `
    CREATE TABLE IF NOT EXISTS queue (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at INTEGER,
      error TEXT,
      created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') || substr(strftime('%f', 'now'), 4) as INTEGER)),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );
  `,
};

export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // Create tables
  await db.execAsync(SCHEMA.MESSAGES);
  await db.execAsync(SCHEMA.MESSAGES_INDEXES);
  await db.execAsync(SCHEMA.CONVERSATIONS);
  await db.execAsync(SCHEMA.QUEUE);

  console.log('Database initialized successfully');

  return db;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  return await SQLite.openDatabaseAsync(DB_NAME);
}

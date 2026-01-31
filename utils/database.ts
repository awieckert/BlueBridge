import * as SQLite from "expo-sqlite";

export const DB_NAME = "bluebridge.db";

export const SCHEMA = {
  MESSAGES: `
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      sender_type INTEGER NOT NULL CHECK(sender_type IN (0, 1)),
      message TEXT NOT NULL,
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
      sender TEXT NOT NULL,
      sender_type INTEGER NOT NULL CHECK(sender_type IN (0, 1)),
      contact_name TEXT,
      last_message_preview TEXT,
      last_message_timestamp INTEGER,
      unread_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') || substr(strftime('%f', 'now'), 4) as INTEGER)),
      updated_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') || substr(strftime('%f', 'now'), 4) as INTEGER)),
      UNIQUE(sender, sender_type)
    );
  `,
  QUEUE: `
    CREATE TABLE IF NOT EXISTS queue (
      id TEXT PRIMARY KEY,
      message_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      sender_type INTEGER NOT NULL CHECK(sender_type IN (0, 1)),
      message TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at INTEGER,
      error TEXT,
      created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') || substr(strftime('%f', 'now'), 4) as INTEGER)),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );
  `,
};

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  // If already initialized, return existing instance
  if (dbInstance) {
    console.log("Database already initialized, returning existing instance");
    return dbInstance;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    console.log("Database initialization in progress, waiting...");
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = (async () => {
    try {
      console.log("Opening database:", DB_NAME);
      const db = await SQLite.openDatabaseAsync(DB_NAME);

      if (!db) {
        throw new Error("Failed to open database: db is null");
      }

      console.log("Database opened successfully, creating tables...");

      // Create tables one by one with error handling
      try {
        await db.execAsync(SCHEMA.MESSAGES);
        console.log("Messages table created");
      } catch (err) {
        console.error("Error creating messages table:", err);
        throw err;
      }

      try {
        await db.execAsync(SCHEMA.MESSAGES_INDEXES);
        console.log("Messages indexes created");
      } catch (err) {
        console.error("Error creating messages indexes:", err);
        throw err;
      }

      try {
        await db.execAsync(SCHEMA.CONVERSATIONS);
        console.log("Conversations table created");
      } catch (err) {
        console.error("Error creating conversations table:", err);
        throw err;
      }

      try {
        await db.execAsync(SCHEMA.QUEUE);
        console.log("Queue table created");
      } catch (err) {
        console.error("Error creating queue table:", err);
        throw err;
      }

      console.log("Database initialized successfully");

      // Run migration to convert string sender_type to numeric
      try {
        await migrateSenderTypeToNumeric(db);
      } catch (error) {
        console.warn("Sender type migration failed (non-critical):", error);
      }

      dbInstance = db;
      return db;
    } catch (error) {
      console.error("Database initialization failed:", error);
      initializationPromise = null; // Reset so it can be retried
      throw error;
    }
  })();

  return initializationPromise;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  // If database is already initialized, return it
  if (dbInstance) {
    return dbInstance;
  }

  // If not initialized, initialize it first
  return await initializeDatabase();
}

/**
 * Migrate sender_type from string to numeric representation
 * This handles existing databases that used TEXT for sender_type
 */
async function migrateSenderTypeToNumeric(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    console.log('[Migration] Checking if sender_type migration is needed...');

    // Check if sender_type is already numeric by trying to get a sample
    const sample = await db.getFirstAsync<{ sender_type: any }>(
      'SELECT sender_type FROM messages LIMIT 1'
    );

    // If no data exists, no migration needed
    if (!sample) {
      console.log('[Migration] No data to migrate');
      return;
    }

    // If sender_type is already a number, migration was done
    if (typeof sample.sender_type === 'number') {
      console.log('[Migration] Sender type already numeric, skipping migration');
      return;
    }

    console.log('[Migration] Starting sender_type migration from string to numeric...');

    // Create temporary tables with new schema
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS messages_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        sender_type INTEGER NOT NULL CHECK(sender_type IN (0, 1)),
        message TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        direction TEXT NOT NULL CHECK(direction IN ('incoming', 'outgoing')),
        status TEXT NOT NULL CHECK(status IN ('sent', 'queued', 'failed', 'delivered')),
        created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') || substr(strftime('%f', 'now'), 4) as INTEGER))
      );

      CREATE TABLE IF NOT EXISTS conversations_new (
        id TEXT PRIMARY KEY,
        sender TEXT NOT NULL,
        sender_type INTEGER NOT NULL CHECK(sender_type IN (0, 1)),
        contact_name TEXT,
        last_message_preview TEXT,
        last_message_timestamp INTEGER,
        unread_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') || substr(strftime('%f', 'now'), 4) as INTEGER)),
        updated_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') || substr(strftime('%f', 'now'), 4) as INTEGER)),
        UNIQUE(sender, sender_type)
      );

      CREATE TABLE IF NOT EXISTS queue_new (
        id TEXT PRIMARY KEY,
        message_id INTEGER NOT NULL,
        sender TEXT NOT NULL,
        sender_type INTEGER NOT NULL CHECK(sender_type IN (0, 1)),
        message TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        next_retry_at INTEGER,
        error TEXT,
        created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') || substr(strftime('%f', 'now'), 4) as INTEGER)),
        FOREIGN KEY (message_id) REFERENCES messages_new(id) ON DELETE CASCADE
      );
    `);

    // Migrate messages: 'phone' -> 0, 'email' -> 1
    await db.execAsync(`
      INSERT INTO messages_new
      SELECT
        id,
        conversation_id,
        sender,
        CASE
          WHEN LOWER(sender_type) = 'phone' THEN 0
          WHEN LOWER(sender_type) = 'email' THEN 1
          ELSE 0
        END as sender_type,
        message,
        timestamp,
        direction,
        status,
        created_at
      FROM messages;
    `);

    // Migrate conversations
    await db.execAsync(`
      INSERT INTO conversations_new
      SELECT
        id,
        sender,
        CASE
          WHEN LOWER(sender_type) = 'phone' THEN 0
          WHEN LOWER(sender_type) = 'email' THEN 1
          ELSE 0
        END as sender_type,
        contact_name,
        last_message_preview,
        last_message_timestamp,
        unread_count,
        created_at,
        updated_at
      FROM conversations;
    `);

    // Migrate queue
    await db.execAsync(`
      INSERT INTO queue_new
      SELECT
        id,
        message_id,
        sender,
        CASE
          WHEN LOWER(sender_type) = 'phone' THEN 0
          WHEN LOWER(sender_type) = 'email' THEN 1
          ELSE 0
        END as sender_type,
        message,
        timestamp,
        retry_count,
        next_retry_at,
        error,
        created_at
      FROM queue;
    `);

    // Drop old tables and rename new ones
    await db.execAsync(`
      DROP TABLE IF EXISTS messages;
      DROP TABLE IF EXISTS conversations;
      DROP TABLE IF EXISTS queue;

      ALTER TABLE messages_new RENAME TO messages;
      ALTER TABLE conversations_new RENAME TO conversations;
      ALTER TABLE queue_new RENAME TO queue;
    `);

    // Recreate indexes
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_conversation ON messages(conversation_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_status ON messages(status);
    `);

    console.log('[Migration] Sender type migration completed successfully');
  } catch (error) {
    console.error('[Migration] Failed to migrate sender_type:', error);
    throw error;
  }
}

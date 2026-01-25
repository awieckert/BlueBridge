import * as SQLite from 'expo-sqlite';

export const DB_NAME = 'bluebridge.db';

export const SCHEMA = {
  MESSAGES: `
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      sender_type TEXT NOT NULL CHECK(sender_type IN ('phone', 'email')),
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
      sender_type TEXT NOT NULL CHECK(sender_type IN ('phone', 'email')),
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
      sender_type TEXT NOT NULL CHECK(sender_type IN ('phone', 'email')),
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

/**
 * Run database migrations to update existing tables
 */
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    console.log('Running database migrations...');

    // Migration 1: Add contact_name column to conversations table (if not exists)
    try {
      // Check if column exists by querying table info
      const result = await db.getAllAsync('PRAGMA table_info(conversations)');
      const hasContactName = result.some((col: any) => col.name === 'contact_name');

      if (!hasContactName) {
        console.log('Adding contact_name column to conversations table...');
        await db.execAsync('ALTER TABLE conversations ADD COLUMN contact_name TEXT');
        console.log('contact_name column added successfully');
      } else {
        console.log('contact_name column already exists');
      }
    } catch (migrationError) {
      console.error('Error in contact_name migration:', migrationError);
      // Don't throw - allow app to continue even if migration fails
    }

    // Migration 2: Convert UUID-based messages to numeric IDs with sender pattern
    try {
      const tableInfo = await db.getAllAsync('PRAGMA table_info(messages)');
      const idColumn = tableInfo.find((col: any) => col.name === 'id');
      const hasSenderColumn = tableInfo.some((col: any) => col.name === 'sender');

      // Check if migration is needed (old schema has TEXT id, new has INTEGER)
      if (idColumn && idColumn.type === 'TEXT' && !hasSenderColumn) {
        console.log('Starting UUID to numeric ID migration...');

        await db.execAsync('BEGIN TRANSACTION');

        try {
          // Step 1: Create new tables with correct schema
          await db.execAsync(`
            CREATE TABLE messages_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              conversation_id TEXT NOT NULL,
              sender TEXT NOT NULL,
              sender_type TEXT NOT NULL CHECK(sender_type IN ('phone', 'email')),
              message TEXT NOT NULL,
              timestamp INTEGER NOT NULL,
              direction TEXT NOT NULL CHECK(direction IN ('incoming', 'outgoing')),
              status TEXT NOT NULL CHECK(status IN ('sent', 'queued', 'failed', 'delivered')),
              created_at INTEGER NOT NULL
            )
          `);

          await db.execAsync(`
            CREATE TABLE conversations_new (
              id TEXT PRIMARY KEY,
              sender TEXT NOT NULL,
              sender_type TEXT NOT NULL CHECK(sender_type IN ('phone', 'email')),
              contact_name TEXT,
              last_message_preview TEXT,
              last_message_timestamp INTEGER,
              unread_count INTEGER NOT NULL DEFAULT 0,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              UNIQUE(sender, sender_type)
            )
          `);

          await db.execAsync(`
            CREATE TABLE queue_new (
              id TEXT PRIMARY KEY,
              message_id INTEGER NOT NULL,
              sender TEXT NOT NULL,
              sender_type TEXT NOT NULL CHECK(sender_type IN ('phone', 'email')),
              message TEXT NOT NULL,
              timestamp INTEGER NOT NULL,
              retry_count INTEGER NOT NULL DEFAULT 0,
              next_retry_at INTEGER,
              error TEXT,
              created_at INTEGER NOT NULL
            )
          `);

          // Step 2: Create mapping table (old UUID -> new numeric ID)
          await db.execAsync(`
            CREATE TEMPORARY TABLE id_mapping (
              old_id TEXT PRIMARY KEY,
              new_id INTEGER NOT NULL
            )
          `);

          // Step 3: Migrate messages data (preserving order by created_at)
          await db.execAsync(`
            INSERT INTO messages_new (conversation_id, sender, sender_type, message, timestamp, direction, status, created_at)
            SELECT conversation_id, phone_number, 'phone', content, timestamp, direction, status, created_at
            FROM messages
            ORDER BY created_at ASC
          `);

          // Step 4: Build mapping table
          await db.execAsync(`
            INSERT INTO id_mapping (old_id, new_id)
            SELECT m.id, mn.id
            FROM messages m
            JOIN messages_new mn ON m.conversation_id = mn.conversation_id
              AND m.sender = mn.sender
              AND m.timestamp = mn.timestamp
              AND m.created_at = mn.created_at
            ORDER BY m.created_at ASC
          `);

          // Step 5: Migrate conversations data
          await db.execAsync(`
            INSERT INTO conversations_new (id, sender, sender_type, contact_name, last_message_preview, last_message_timestamp, unread_count, created_at, updated_at)
            SELECT id, phone_number, 'phone', contact_name, last_message_preview, last_message_timestamp, unread_count, created_at, updated_at
            FROM conversations
          `);

          // Step 6: Migrate queue data (updating foreign keys)
          await db.execAsync(`
            INSERT INTO queue_new (id, message_id, sender, sender_type, message, timestamp, retry_count, next_retry_at, error, created_at)
            SELECT q.id, COALESCE(im.new_id, 0), q.phone_number, 'phone', q.content, q.timestamp, q.retry_count, q.next_retry_at, q.error, q.created_at
            FROM queue q
            LEFT JOIN id_mapping im ON q.message_id = im.old_id
          `);

          // Step 7: Verify row counts
          const oldMessagesCount = await db.getFirstAsync('SELECT COUNT(*) as count FROM messages');
          const newMessagesCount = await db.getFirstAsync('SELECT COUNT(*) as count FROM messages_new');
          const oldConversationsCount = await db.getFirstAsync('SELECT COUNT(*) as count FROM conversations');
          const newConversationsCount = await db.getFirstAsync('SELECT COUNT(*) as count FROM conversations_new');

          if ((oldMessagesCount as any)?.count !== (newMessagesCount as any)?.count) {
            throw new Error(`Message count mismatch: ${(oldMessagesCount as any)?.count} vs ${(newMessagesCount as any)?.count}`);
          }
          if ((oldConversationsCount as any)?.count !== (newConversationsCount as any)?.count) {
            throw new Error(`Conversation count mismatch: ${(oldConversationsCount as any)?.count} vs ${(newConversationsCount as any)?.count}`);
          }

          console.log(`Migration verified: ${(oldMessagesCount as any)?.count} messages, ${(oldConversationsCount as any)?.count} conversations`);

          // Step 8: Drop old tables
          await db.execAsync('DROP TABLE queue');
          await db.execAsync('DROP TABLE messages');
          await db.execAsync('DROP TABLE conversations');

          // Step 9: Rename new tables
          await db.execAsync('ALTER TABLE messages_new RENAME TO messages');
          await db.execAsync('ALTER TABLE conversations_new RENAME TO conversations');
          await db.execAsync('ALTER TABLE queue_new RENAME TO queue');

          // Step 10: Create indexes
          await db.execAsync('CREATE INDEX idx_conversation ON messages(conversation_id, timestamp)');
          await db.execAsync('CREATE INDEX idx_status ON messages(status)');

          await db.execAsync('COMMIT');
          console.log('UUID to numeric ID migration completed successfully');
        } catch (migrationError) {
          await db.execAsync('ROLLBACK');
          console.error('Migration failed, rolled back:', migrationError);
          throw migrationError;
        }
      } else {
        console.log('Numeric ID migration already applied or not needed');
      }
    } catch (migrationError) {
      console.error('Error in numeric ID migration:', migrationError);
      // Don't throw - allow app to continue even if migration fails
    }

    console.log('Database migrations completed');
  } catch (error) {
    console.error('Error running migrations:', error);
    // Don't throw - allow app to continue
  }
}

export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  // If already initialized, return existing instance
  if (dbInstance) {
    console.log('Database already initialized, returning existing instance');
    return dbInstance;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    console.log('Database initialization in progress, waiting...');
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = (async () => {
    try {
      console.log('Opening database:', DB_NAME);
      const db = await SQLite.openDatabaseAsync(DB_NAME);

      if (!db) {
        throw new Error('Failed to open database: db is null');
      }

      console.log('Database opened successfully, creating tables...');

      // Create tables one by one with error handling
      try {
        await db.execAsync(SCHEMA.MESSAGES);
        console.log('Messages table created');
      } catch (err) {
        console.error('Error creating messages table:', err);
        throw err;
      }

      try {
        await db.execAsync(SCHEMA.MESSAGES_INDEXES);
        console.log('Messages indexes created');
      } catch (err) {
        console.error('Error creating messages indexes:', err);
        throw err;
      }

      try {
        await db.execAsync(SCHEMA.CONVERSATIONS);
        console.log('Conversations table created');
      } catch (err) {
        console.error('Error creating conversations table:', err);
        throw err;
      }

      try {
        await db.execAsync(SCHEMA.QUEUE);
        console.log('Queue table created');
      } catch (err) {
        console.error('Error creating queue table:', err);
        throw err;
      }

      // Run migrations to update existing tables
      await runMigrations(db);

      console.log('Database initialized successfully');

      dbInstance = db;
      return db;
    } catch (error) {
      console.error('Database initialization failed:', error);
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

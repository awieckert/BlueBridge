import { getDatabase } from './database';

/**
 * Verify database integrity
 * Checks that all sender_type values are valid (0 or 1)
 */
export async function verifyDatabaseIntegrity(): Promise<boolean> {
  try {
    const db = await getDatabase();

    console.log('[DB Verify] Checking database integrity...');

    // Check messages - sender_type should be 0 (phone) or 1 (email)
    const invalidMessages = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM messages
       WHERE sender_type NOT IN (0, 1)`
    );
    console.log(`[DB Verify] Invalid messages: ${invalidMessages?.count || 0}`);

    // Check conversations
    const invalidConversations = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM conversations
       WHERE sender_type NOT IN (0, 1)`
    );
    console.log(`[DB Verify] Invalid conversations: ${invalidConversations?.count || 0}`);

    // Check queue
    const invalidQueue = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM queue
       WHERE sender_type NOT IN (0, 1)`
    );
    console.log(`[DB Verify] Invalid queued messages: ${invalidQueue?.count || 0}`);

    const isValid =
      (invalidMessages?.count || 0) === 0 &&
      (invalidConversations?.count || 0) === 0 &&
      (invalidQueue?.count || 0) === 0;

    if (isValid) {
      console.log('[DB Verify] Database integrity check passed ✓');
    } else {
      console.error('[DB Verify] Database integrity check failed ✗');
    }

    return isValid;
  } catch (error) {
    console.error('[DB Verify] Error during verification:', error);
    return false;
  }
}

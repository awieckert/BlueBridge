import { getDatabase } from '../utils/database';
import { Message, Conversation, QueuedMessage } from '../types/message';
import { v4 as uuidv4 } from 'uuid';

export class StorageService {
  // Messages
  async saveMessage(message: Message): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO messages
       (id, conversation_id, phone_number, content, timestamp, direction, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        message.conversationId,
        message.phoneNumber,
        message.content,
        message.timestamp,
        message.direction,
        message.status,
        message.createdAt,
      ]
    );
  }

  async updateMessageStatus(messageId: string, status: Message['status']): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE messages SET status = ? WHERE id = ?',
      [status, messageId]
    );
  }

  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      conversation_id: string;
      phone_number: string;
      content: string;
      timestamp: number;
      direction: string;
      status: string;
      created_at: number;
    }>(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
      [conversationId]
    );

    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      phoneNumber: row.phone_number,
      content: row.content,
      timestamp: row.timestamp,
      direction: row.direction as Message['direction'],
      status: row.status as Message['status'],
      createdAt: row.created_at,
    }));
  }

  async getAllMessages(): Promise<Message[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      conversation_id: string;
      phone_number: string;
      content: string;
      timestamp: number;
      direction: string;
      status: string;
      created_at: number;
    }>('SELECT * FROM messages ORDER BY timestamp ASC');

    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      phoneNumber: row.phone_number,
      content: row.content,
      timestamp: row.timestamp,
      direction: row.direction as Message['direction'],
      status: row.status as Message['status'],
      createdAt: row.created_at,
    }));
  }

  // Conversations
  async saveConversation(conversation: Conversation): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO conversations
       (id, phone_number, last_message_preview, last_message_timestamp, unread_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        conversation.id,
        conversation.phoneNumber,
        conversation.lastMessagePreview,
        conversation.lastMessageTimestamp,
        conversation.unreadCount,
        conversation.createdAt,
        conversation.updatedAt,
      ]
    );
  }

  async updateConversation(
    conversationId: string,
    updates: Partial<Conversation>
  ): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.lastMessagePreview !== undefined) {
      fields.push('last_message_preview = ?');
      values.push(updates.lastMessagePreview);
    }
    if (updates.lastMessageTimestamp !== undefined) {
      fields.push('last_message_timestamp = ?');
      values.push(updates.lastMessageTimestamp);
    }
    if (updates.unreadCount !== undefined) {
      fields.push('unread_count = ?');
      values.push(updates.unreadCount);
    }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      values.push(Date.now());
      values.push(conversationId);

      await db.runAsync(
        `UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    }
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{
      id: string;
      phone_number: string;
      last_message_preview: string | null;
      last_message_timestamp: number | null;
      unread_count: number;
      created_at: number;
      updated_at: number;
    }>('SELECT * FROM conversations WHERE id = ?', [conversationId]);

    if (!row) return null;

    return {
      id: row.id,
      phoneNumber: row.phone_number,
      lastMessagePreview: row.last_message_preview,
      lastMessageTimestamp: row.last_message_timestamp,
      unreadCount: row.unread_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getConversationByPhoneNumber(phoneNumber: string): Promise<Conversation | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{
      id: string;
      phone_number: string;
      last_message_preview: string | null;
      last_message_timestamp: number | null;
      unread_count: number;
      created_at: number;
      updated_at: number;
    }>('SELECT * FROM conversations WHERE phone_number = ?', [phoneNumber]);

    if (!row) return null;

    return {
      id: row.id,
      phoneNumber: row.phone_number,
      lastMessagePreview: row.last_message_preview,
      lastMessageTimestamp: row.last_message_timestamp,
      unreadCount: row.unread_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAllConversations(): Promise<Conversation[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      phone_number: string;
      last_message_preview: string | null;
      last_message_timestamp: number | null;
      unread_count: number;
      created_at: number;
      updated_at: number;
    }>('SELECT * FROM conversations ORDER BY last_message_timestamp DESC');

    return rows.map((row) => ({
      id: row.id,
      phoneNumber: row.phone_number,
      lastMessagePreview: row.last_message_preview,
      lastMessageTimestamp: row.last_message_timestamp,
      unreadCount: row.unread_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getOrCreateConversation(phoneNumber: string): Promise<Conversation> {
    let conversation = await this.getConversationByPhoneNumber(phoneNumber);

    if (!conversation) {
      const now = Date.now();
      conversation = {
        id: uuidv4(),
        phoneNumber,
        lastMessagePreview: null,
        lastMessageTimestamp: null,
        unreadCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      await this.saveConversation(conversation);
    }

    return conversation;
  }

  // Queue
  async queueMessage(queuedMessage: QueuedMessage): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO queue
       (id, message_id, phone_number, content, timestamp, retry_count, next_retry_at, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        queuedMessage.id,
        queuedMessage.messageId,
        queuedMessage.phoneNumber,
        queuedMessage.content,
        queuedMessage.timestamp,
        queuedMessage.retryCount,
        queuedMessage.nextRetryAt,
        queuedMessage.error,
        queuedMessage.createdAt,
      ]
    );
  }

  async updateQueuedMessage(
    queueId: string,
    updates: Partial<QueuedMessage>
  ): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.retryCount !== undefined) {
      fields.push('retry_count = ?');
      values.push(updates.retryCount);
    }
    if (updates.nextRetryAt !== undefined) {
      fields.push('next_retry_at = ?');
      values.push(updates.nextRetryAt);
    }
    if (updates.error !== undefined) {
      fields.push('error = ?');
      values.push(updates.error);
    }

    if (fields.length > 0) {
      values.push(queueId);
      await db.runAsync(
        `UPDATE queue SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    }
  }

  async removeFromQueue(messageId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM queue WHERE message_id = ?', [messageId]);
  }

  async getQueuedMessages(): Promise<QueuedMessage[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      message_id: string;
      phone_number: string;
      content: string;
      timestamp: number;
      retry_count: number;
      next_retry_at: number | null;
      error: string | null;
      created_at: number;
    }>('SELECT * FROM queue ORDER BY created_at ASC');

    return rows.map((row) => ({
      id: row.id,
      messageId: row.message_id,
      phoneNumber: row.phone_number,
      content: row.content,
      timestamp: row.timestamp,
      retryCount: row.retry_count,
      nextRetryAt: row.next_retry_at,
      error: row.error,
      createdAt: row.created_at,
    }));
  }

  // Utility
  async clearAllData(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM messages');
    await db.runAsync('DELETE FROM conversations');
    await db.runAsync('DELETE FROM queue');
  }
}

export const storageService = new StorageService();

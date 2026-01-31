import { getDatabase } from '../utils/database';
import { Message, Conversation, QueuedMessage, SenderType } from '../types/message';
import { v4 as uuidv4 } from 'uuid';

export class StorageService {
  // Messages
  async saveMessage(message: Omit<Message, 'id'>): Promise<number> {
    const db = await getDatabase();
    const result = await db.runAsync(
      `INSERT INTO messages
       (conversation_id, sender, sender_type, message, timestamp, direction, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        message.conversationId,
        message.sender,
        message.senderType,
        message.message,
        message.timestamp,
        message.direction,
        message.status,
        message.createdAt,
      ]
    );
    return result.lastInsertRowId;
  }

  async updateMessageStatus(messageId: number, status: Message['status']): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE messages SET status = ? WHERE id = ?',
      [status, messageId]
    );
  }

  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: number;
      conversation_id: string;
      sender: string;
      sender_type: SenderType;
      message: string;
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
      sender: row.sender,
      senderType: row.sender_type,
      message: row.message,
      timestamp: row.timestamp,
      direction: row.direction as Message['direction'],
      status: row.status as Message['status'],
      createdAt: row.created_at,
    }));
  }

  async getAllMessages(): Promise<Message[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: number;
      conversation_id: string;
      sender: string;
      sender_type: SenderType;
      message: string;
      timestamp: number;
      direction: string;
      status: string;
      created_at: number;
    }>('SELECT * FROM messages ORDER BY timestamp ASC');

    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      sender: row.sender,
      senderType: row.sender_type,
      message: row.message,
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
       (id, sender, sender_type, contact_name, last_message_preview, last_message_timestamp, unread_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        conversation.id,
        conversation.sender,
        conversation.senderType,
        conversation.contactName,
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

    if (updates.contactName !== undefined) {
      fields.push('contact_name = ?');
      values.push(updates.contactName);
    }
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

  async updateConversationContactName(conversationId: string, contactName: string | null): Promise<void> {
    await this.updateConversation(conversationId, { contactName });
  }

  async updateConversationContactNameBySender(sender: string, senderType: SenderType, contactName: string | null): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE conversations SET contact_name = ?, updated_at = ? WHERE sender = ? AND sender_type = ?',
      [contactName, Date.now(), sender, senderType]
    );
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{
      id: string;
      sender: string;
      sender_type: SenderType;
      contact_name: string | null;
      last_message_preview: string | null;
      last_message_timestamp: number | null;
      unread_count: number;
      created_at: number;
      updated_at: number;
    }>('SELECT * FROM conversations WHERE id = ?', [conversationId]);

    if (!row) return null;

    return {
      id: row.id,
      sender: row.sender,
      senderType: row.sender_type,
      contactName: row.contact_name,
      lastMessagePreview: row.last_message_preview,
      lastMessageTimestamp: row.last_message_timestamp,
      unreadCount: row.unread_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getConversationBySender(sender: string, senderType: SenderType): Promise<Conversation | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{
      id: string;
      sender: string;
      sender_type: SenderType;
      contact_name: string | null;
      last_message_preview: string | null;
      last_message_timestamp: number | null;
      unread_count: number;
      created_at: number;
      updated_at: number;
    }>('SELECT * FROM conversations WHERE sender = ? AND sender_type = ?', [sender, senderType]);

    if (!row) return null;

    return {
      id: row.id,
      sender: row.sender,
      senderType: row.sender_type,
      contactName: row.contact_name,
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
      sender: string;
      sender_type: SenderType;
      contact_name: string | null;
      last_message_preview: string | null;
      last_message_timestamp: number | null;
      unread_count: number;
      created_at: number;
      updated_at: number;
    }>('SELECT * FROM conversations ORDER BY last_message_timestamp DESC');

    return rows.map((row) => ({
      id: row.id,
      sender: row.sender,
      senderType: row.sender_type,
      contactName: row.contact_name,
      lastMessagePreview: row.last_message_preview,
      lastMessageTimestamp: row.last_message_timestamp,
      unreadCount: row.unread_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getOrCreateConversation(sender: string, senderType: SenderType, contactName: string | null = null): Promise<Conversation> {
    let conversation = await this.getConversationBySender(sender, senderType);

    if (!conversation) {
      const now = Date.now();
      conversation = {
        id: uuidv4(),
        sender,
        senderType,
        contactName,
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
       (id, message_id, sender, sender_type, message, timestamp, retry_count, next_retry_at, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        queuedMessage.id,
        queuedMessage.messageId,
        queuedMessage.sender,
        queuedMessage.senderType,
        queuedMessage.message,
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

  async removeFromQueue(messageId: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM queue WHERE message_id = ?', [messageId]);
  }

  async getQueuedMessages(): Promise<QueuedMessage[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      message_id: number;
      sender: string;
      sender_type: SenderType;
      message: string;
      timestamp: number;
      retry_count: number;
      next_retry_at: number | null;
      error: string | null;
      created_at: number;
    }>('SELECT * FROM queue ORDER BY created_at ASC');

    return rows.map((row) => ({
      id: row.id,
      messageId: row.message_id,
      sender: row.sender,
      senderType: row.sender_type,
      message: row.message,
      timestamp: row.timestamp,
      retryCount: row.retry_count,
      nextRetryAt: row.next_retry_at,
      error: row.error,
      createdAt: row.created_at,
    }));
  }

  // Delete operations
  async deleteConversation(conversationId: string): Promise<void> {
    const db = await getDatabase();

    // Delete messages first (this will CASCADE delete queue items via foreign key)
    await this.deleteMessagesByConversation(conversationId);

    // Delete the conversation
    await db.runAsync('DELETE FROM conversations WHERE id = ?', [conversationId]);

    console.log(`[StorageService] Deleted conversation ${conversationId}`);
  }

  async deleteMessagesByConversation(conversationId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
    console.log(`[StorageService] Deleted messages for conversation ${conversationId}`);
  }

  async deleteQueuedMessagesByConversation(conversationId: string): Promise<void> {
    const db = await getDatabase();

    // Get all message IDs for this conversation
    const messages = await this.getMessagesByConversation(conversationId);
    const messageIds = messages.map(m => m.id);

    if (messageIds.length === 0) return;

    // Delete queue items for these messages
    const placeholders = messageIds.map(() => '?').join(',');
    await db.runAsync(
      `DELETE FROM queue WHERE message_id IN (${placeholders})`,
      messageIds
    );

    console.log(`[StorageService] Deleted queued messages for conversation ${conversationId}`);
  }

  async getConversationMessageCount(conversationId: string): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?',
      [conversationId]
    );
    return result?.count || 0;
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

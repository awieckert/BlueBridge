import { storageService } from './storageService';
import { useMessagesStore } from '../stores/messagesStore';
import { useQueueStore } from '../stores/queueStore';

export class ConversationService {
  /**
   * Delete a conversation with all its messages and queued items
   */
  async deleteConversation(conversationId: string): Promise<void> {
    console.log(`[ConversationService] Starting deletion of conversation ${conversationId}`);

    try {
      // Get conversation info before deleting (for queue cleanup)
      const conversation = await storageService.getConversation(conversationId);
      if (!conversation) {
        console.warn(`[ConversationService] Conversation ${conversationId} not found`);
        return;
      }

      // 1. Delete from database (messages first, then conversation)
      // This will CASCADE delete related queue items via foreign key
      await storageService.deleteConversation(conversationId);

      // 2. Update Zustand stores
      useMessagesStore.getState().deleteConversation(conversationId);

      // 3. Clean up queue store by sender/senderType
      useQueueStore.getState().removeQueuedMessagesForConversation(
        conversation.sender,
        conversation.senderType
      );

      console.log(`[ConversationService] Successfully deleted conversation ${conversationId}`);
    } catch (error) {
      console.error(`[ConversationService] Failed to delete conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Get statistics about a conversation (for confirmation dialog)
   */
  async getConversationStats(conversationId: string): Promise<{
    messageCount: number;
    hasQueuedMessages: boolean;
  }> {
    try {
      const messageCount = await storageService.getConversationMessageCount(conversationId);

      // Check if there are queued messages for this conversation
      const messages = await storageService.getMessagesByConversation(conversationId);
      const messageIds = messages.map(m => m.id);
      const queuedMessages = await storageService.getQueuedMessages();
      const hasQueuedMessages = queuedMessages.some(q => messageIds.includes(q.messageId));

      return {
        messageCount,
        hasQueuedMessages,
      };
    } catch (error) {
      console.error(`[ConversationService] Failed to get stats for conversation ${conversationId}:`, error);
      return {
        messageCount: 0,
        hasQueuedMessages: false,
      };
    }
  }

  /**
   * Check if a conversation exists
   */
  async conversationExists(conversationId: string): Promise<boolean> {
    const conversation = await storageService.getConversation(conversationId);
    return conversation !== null;
  }
}

export const conversationService = new ConversationService();

import { storageService } from './storageService';
import { messageService } from './messageService';
import { QueuedMessage, SenderType } from '../types/message';
import { Config } from '../utils/constants';
import { v4 as uuidv4 } from 'uuid';

export class QueueService {
  private isProcessing = false;
  private processingTimeout: NodeJS.Timeout | null = null;

  /**
   * Queue a message for retry when initial send fails
   */
  async queueMessage(
    messageId: number,
    sender: string,
    senderType: SenderType,
    message: string,
    timestamp: number,
    error: string
  ): Promise<void> {
    const queuedMessage: QueuedMessage = {
      id: uuidv4(),
      messageId,
      sender,
      senderType,
      message,
      timestamp,
      retryCount: 0,
      nextRetryAt: this.calculateNextRetryTime(0),
      error,
      createdAt: Date.now(),
    };

    await storageService.queueMessage(queuedMessage);
    await storageService.updateMessageStatus(messageId, 'queued');

    console.log(`[QueueService] Message ${messageId} queued for retry`);

    // Schedule immediate processing attempt
    this.scheduleQueueProcessing(0);
  }

  /**
   * Process all messages in the queue that are ready for retry
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('[QueueService] Queue processing already in progress, skipping');
      return;
    }

    this.isProcessing = true;
    console.log('[QueueService] Starting queue processing...');

    try {
      const queuedMessages = await storageService.getQueuedMessages();
      const now = Date.now();

      // Filter messages ready for retry
      const readyMessages = queuedMessages.filter(
        (msg) => !msg.nextRetryAt || msg.nextRetryAt <= now
      );

      if (readyMessages.length === 0) {
        console.log('[QueueService] No messages ready for retry');
        return;
      }

      console.log(`[QueueService] Processing ${readyMessages.length} messages`);

      for (const queuedMsg of readyMessages) {
        await this.retryMessage(queuedMsg);
      }

      // Schedule next processing if there are remaining messages
      const remainingMessages = await storageService.getQueuedMessages();
      if (remainingMessages.length > 0) {
        const nextRetry = Math.min(
          ...remainingMessages
            .map((msg) => msg.nextRetryAt || Infinity)
            .filter((time) => time !== Infinity)
        );
        if (nextRetry !== Infinity) {
          const delay = Math.max(0, nextRetry - Date.now());
          this.scheduleQueueProcessing(delay);
        }
      }
    } catch (error) {
      console.error('[QueueService] Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retry a single queued message
   */
  private async retryMessage(queuedMsg: QueuedMessage): Promise<void> {
    console.log(
      `[QueueService] Retrying message ${queuedMsg.messageId} (attempt ${queuedMsg.retryCount + 1}/${Config.MAX_RETRY_ATTEMPTS})`
    );

    // Check if the message still exists (conversation might have been deleted)
    try {
      const message = await storageService.getAllMessages();
      const messageExists = message.some(m => m.id === queuedMsg.messageId);

      if (!messageExists) {
        console.log(`[QueueService] Message ${queuedMsg.messageId} no longer exists (conversation deleted), removing from queue`);
        await storageService.removeFromQueue(queuedMsg.messageId);
        return;
      }
    } catch (error) {
      console.error(`[QueueService] Error checking message existence:`, error);
    }

    try {
      // Attempt to send the message
      await messageService.sendMessage(
        queuedMsg.sender,
        queuedMsg.senderType,
        queuedMsg.message,
        queuedMsg.timestamp
      );

      // Success! Remove from queue and update message status
      await storageService.removeFromQueue(queuedMsg.messageId);
      await storageService.updateMessageStatus(queuedMsg.messageId, 'sent');

      console.log(`[QueueService] Message ${queuedMsg.messageId} sent successfully`);
    } catch (error) {
      // Retry failed
      const newRetryCount = queuedMsg.retryCount + 1;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error(
        `[QueueService] Retry failed for message ${queuedMsg.messageId}:`,
        errorMessage
      );

      if (newRetryCount >= Config.MAX_RETRY_ATTEMPTS) {
        // Max retries reached - mark as permanently failed
        await storageService.removeFromQueue(queuedMsg.messageId);
        await storageService.updateMessageStatus(queuedMsg.messageId, 'failed');
        console.log(
          `[QueueService] Message ${queuedMsg.messageId} failed permanently after ${Config.MAX_RETRY_ATTEMPTS} attempts`
        );
      } else {
        // Schedule next retry
        const nextRetryAt = this.calculateNextRetryTime(newRetryCount);
        await storageService.updateQueuedMessage(queuedMsg.id, {
          retryCount: newRetryCount,
          nextRetryAt,
          error: errorMessage,
        });
        console.log(
          `[QueueService] Message ${queuedMsg.messageId} will retry at ${new Date(nextRetryAt).toLocaleTimeString()}`
        );
      }
    }
  }

  /**
   * Manually retry a failed message
   */
  async retryFailedMessage(messageId: number, message: any): Promise<void> {
    console.log(`[QueueService] Manual retry requested for message ${messageId}`);

    try {
      // Update status to queued
      await storageService.updateMessageStatus(messageId, 'queued');

      // Attempt to send
      await messageService.sendMessage(
        message.sender,
        message.senderType,
        message.message,
        message.timestamp
      );

      // Success
      await storageService.updateMessageStatus(messageId, 'sent');
      console.log(`[QueueService] Manual retry successful for message ${messageId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[QueueService] Manual retry failed for message ${messageId}:`, errorMessage);

      // Queue the message for automatic retry
      await this.queueMessage(
        messageId,
        message.sender,
        message.senderType,
        message.message,
        message.timestamp,
        errorMessage
      );
    }
  }

  /**
   * Calculate the next retry timestamp based on retry count
   */
  private calculateNextRetryTime(retryCount: number): number {
    const delay = Config.RETRY_DELAYS[retryCount] || Config.RETRY_DELAYS[Config.RETRY_DELAYS.length - 1];
    return Date.now() + delay;
  }

  /**
   * Schedule queue processing after a delay
   */
  private scheduleQueueProcessing(delayMs: number): void {
    // Clear any existing timeout
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
    }

    this.processingTimeout = setTimeout(() => {
      this.processQueue();
    }, delayMs);

    console.log(`[QueueService] Queue processing scheduled in ${delayMs}ms`);
  }

  /**
   * Cancel scheduled queue processing
   */
  cancelScheduledProcessing(): void {
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }
  }

  /**
   * Get count of queued messages
   */
  async getQueuedCount(): Promise<number> {
    const messages = await storageService.getQueuedMessages();
    return messages.length;
  }
}

export const queueService = new QueueService();

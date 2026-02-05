import * as signalR from '@microsoft/signalr';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';
import { ReceiveMessagePayload } from '../types/api';
import { Message, SenderType } from '../types/message';
import { useAuthStore } from '../stores/authStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useContactStore } from '../stores/contactStore';
import { storageService } from './storageService';
import { useMessagesStore } from '../stores/messagesStore';
import { getDatabase } from '../utils/database';
import { SenderTypeEnum } from '../utils/senderTypeEnum';

export class SignalRService {
  private connection: HubConnection | null = null;
  private reconnectAttempt = 0;
  private reconnectDelays = [0, 2000, 10000, 30000, 60000]; // Exponential backoff
  private isManuallyDisconnected = false;
  private isConnecting = false;

  async connect(): Promise<void> {
    const { apiKey, serverUrl } = useAuthStore.getState();

    if (!apiKey) {
      console.log('[SignalR] No API key configured, skipping connection');
      useConnectionStore.getState().setConnectionStatus('disconnected');
      useConnectionStore.getState().setLastError('No API key configured');
      return;
    }

    // Check if already connected
    if (this.connection?.state === HubConnectionState.Connected) {
      console.log('[SignalR] Already connected');
      return;
    }

    // Check if currently connecting (but not if we're reconnecting after a disconnect)
    if (this.isConnecting) {
      console.log('[SignalR] Connection already in progress');
      return;
    }

    // If there's an existing connection in Connecting or Reconnecting state, don't create another
    if (this.connection &&
        (this.connection.state === HubConnectionState.Connecting ||
         this.connection.state === HubConnectionState.Reconnecting)) {
      console.log('[SignalR] Connection already in progress');
      return;
    }

    try {
      this.isConnecting = true;
      this.isManuallyDisconnected = false;
      const hubUrl = `${serverUrl}/hubs/messages`;

      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(`${hubUrl}?access_token=${encodeURIComponent(apiKey)}`, {
          headers: { 'BB-API-KEY': apiKey },
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            const delay = this.reconnectDelays[
              Math.min(retryContext.previousRetryCount, this.reconnectDelays.length - 1)
            ];
            console.log(`[SignalR] Reconnect attempt ${retryContext.previousRetryCount + 1}, waiting ${delay}ms`);
            return delay;
          },
        })
        .withKeepAliveInterval(15000) // Send keepalive ping every 15 seconds
        .withServerTimeout(60000) // Server timeout after 60 seconds of no messages
        .configureLogging(signalR.LogLevel.Information)
        .build();

      this.setupEventHandlers();

      useConnectionStore.getState().setConnectionStatus('connecting');
      await this.connection.start();

      console.log('[SignalR] Connected successfully');
      this.reconnectAttempt = 0;
      this.isConnecting = false;
      useConnectionStore.getState().setConnected(true);
      useConnectionStore.getState().setLastError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log at INFO level if it's the first attempt, ERROR level for subsequent failures
      if (this.reconnectAttempt === 0) {
        console.log(`[SignalR] Initial connection failed (will retry): ${errorMessage}`);
      } else {
        console.error(`[SignalR] Connection attempt ${this.reconnectAttempt + 1} failed:`, errorMessage);
      }

      this.isConnecting = false;
      useConnectionStore.getState().setConnected(false);
      useConnectionStore.getState().setLastError(errorMessage);

      this.scheduleReconnect();
    }
  }

  async disconnect(): Promise<void> {
    this.isManuallyDisconnected = true;
    this.isConnecting = false;

    if (this.connection) {
      try {
        await this.connection.stop();
        console.log('[SignalR] Disconnected');
      } catch (error) {
        console.error('[SignalR] Error during disconnect:', error);
      }

      this.connection = null;
      useConnectionStore.getState().setConnected(false);
    }
  }

  private setupEventHandlers(): void {
    if (!this.connection) return;

    // Handle single incoming message
    this.connection.on('ReceiveMessage', async (payload: ReceiveMessagePayload) => {
      console.log('[SignalR] Received message:', payload);
      await this.handleIncomingMessage(payload);
    });

    // Handle batch of queued messages (when reconnecting)
    this.connection.on('ReceiveQueuedMessages', async (messages: ReceiveMessagePayload[]) => {
      console.log(`[SignalR] Received ${messages.length} queued messages`);
      for (const payload of messages) {
        await this.handleIncomingMessage(payload);
      }
    });

    // Connection lifecycle events
    this.connection.onreconnecting((error) => {
      console.log('[SignalR] Reconnecting...', error?.message);
      useConnectionStore.getState().setConnectionStatus('reconnecting');
    });

    this.connection.onreconnected((connectionId) => {
      console.log('[SignalR] Reconnected:', connectionId);
      this.reconnectAttempt = 0;
      useConnectionStore.getState().setConnected(true);
      useConnectionStore.getState().setLastError(null);
    });

    this.connection.onclose((error) => {
      console.log('[SignalR] Connection closed:', error?.message);
      this.isConnecting = false;
      useConnectionStore.getState().setConnected(false);

      if (!this.isManuallyDisconnected) {
        this.scheduleReconnect();
      }
    });
  }

  private async handleIncomingMessage(payload: ReceiveMessagePayload): Promise<void> {
    try {
      // Validate required fields
      if (!payload.sender || payload.senderType === undefined || !payload.id || !payload.message || !payload.conversationId) {
        console.error('[SignalR] Invalid message payload - missing required fields');
        console.error('[SignalR] Payload:', JSON.stringify(payload));
        return;
      }

      // Validate senderType is 0 or 1
      if (payload.senderType !== SenderTypeEnum.Phone && payload.senderType !== SenderTypeEnum.Email) {
        console.error('[SignalR] Invalid senderType:', payload.senderType);
        console.error('[SignalR] Full payload:', JSON.stringify(payload));
        return;
      }

      // Lookup contact name (only for phone numbers)
      const contactName = payload.senderType === SenderTypeEnum.Phone
        ? useContactStore.getState().getNameByPhoneNumber(payload.sender)
        : null;

      // Try to get conversation by backend conversationId first
      let conversation = await storageService.getConversation(payload.conversationId);

      if (!conversation) {
        // Check if conversation exists by sender (might be temp ID in store)
        const existingBySender = await storageService.getConversationBySender(
          payload.sender,
          payload.senderType
        );

        if (existingBySender) {
          // Found existing conversation - should not happen if conversationIds match
          console.warn('[SignalR] Found conversation by sender but not by conversationId:', {
            existingId: existingBySender.id,
            payloadId: payload.conversationId
          });
          conversation = existingBySender;
        } else {
          // Create new conversation with backend conversationId
          const now = Date.now();
          conversation = {
            id: payload.conversationId,
            sender: payload.sender,
            senderType: payload.senderType,
            contactName,
            lastMessagePreview: null,
            lastMessageTimestamp: null,
            unreadCount: 0,
            createdAt: now,
            updatedAt: now,
          };
          await storageService.saveConversation(conversation);

          // Add to Zustand store
          const store = useMessagesStore.getState();
          store.loadConversations([...store.conversations, conversation]);
        }
      }

      // Update contact name if needed
      if (!conversation.contactName && contactName) {
        await storageService.updateConversation(conversation.id, { contactName });
        conversation.contactName = contactName;
      }

      // Create message object with backend conversationId
      const message: Message = {
        id: payload.id,
        conversationId: payload.conversationId,
        sender: payload.sender,
        senderType: payload.senderType,
        message: payload.message,
        timestamp: payload.timestamp,
        direction: 'incoming' as const,
        status: 'delivered' as const,
        createdAt: Date.now(),
      };

      // Save to database with explicit ID from backend
      const db = await getDatabase();
      await db.runAsync(
        `INSERT OR REPLACE INTO messages
         (id, conversation_id, sender, sender_type, message, timestamp, direction, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
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

      // Update conversation
      await storageService.updateConversation(conversation.id, {
        lastMessagePreview: payload.message,
        lastMessageTimestamp: payload.timestamp,
      });

      // Update Zustand stores for UI reactivity
      useMessagesStore.getState().addMessage(message);

      // Update conversation in store (including contact name)
      useMessagesStore.getState().updateConversation(conversation.id, {
        contactName: conversation.contactName,
        lastMessagePreview: payload.message,
        lastMessageTimestamp: payload.timestamp,
      });

      // Increment unread count if not viewing this conversation
      const activeConversationId = useMessagesStore.getState().activeConversationId;
      if (activeConversationId !== conversation.id) {
        useMessagesStore.getState().incrementUnreadCount(conversation.id);
        await storageService.updateConversation(conversation.id, {
          unreadCount: (await storageService.getConversation(conversation.id))!.unreadCount + 1,
        });
      }

      console.log('[SignalR] Message saved and UI updated');
    } catch (error) {
      console.error('[SignalR] Error handling incoming message:', error);
      console.error('[SignalR] Failed payload:', JSON.stringify(payload));
    }
  }

  private scheduleReconnect(): void {
    if (this.isManuallyDisconnected) {
      return;
    }

    const delay = this.reconnectDelays[
      Math.min(this.reconnectAttempt, this.reconnectDelays.length - 1)
    ];

    console.log(`[SignalR] Scheduling reconnect attempt ${this.reconnectAttempt + 1} in ${delay}ms`);

    setTimeout(() => {
      this.reconnectAttempt++;
      this.connect();
    }, delay);
  }

  getConnectionState(): HubConnectionState | null {
    return this.connection?.state ?? null;
  }

  isConnected(): boolean {
    return this.connection?.state === HubConnectionState.Connected;
  }
}

export const signalRService = new SignalRService();

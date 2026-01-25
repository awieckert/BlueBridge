import * as signalR from '@microsoft/signalr';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';
import { ReceiveMessagePayload } from '../types/api';
import { Message } from '../types/message';
import { useAuthStore } from '../stores/authStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useContactStore } from '../stores/contactStore';
import { storageService } from './storageService';
import { useMessagesStore } from '../stores/messagesStore';
import { getDatabase } from '../utils/database';

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
        .withUrl(hubUrl, {
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
      console.error('[SignalR] Connection failed:', errorMessage);

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
      if (!payload.sender || !payload.senderType || !payload.id || !payload.message) {
        console.error('[SignalR] Invalid message payload - missing required fields:', payload);
        return;
      }

      // Lookup contact name
      const contactName = payload.senderType === 'phone'
        ? useContactStore.getState().getNameByPhoneNumber(payload.sender)
        : null; // TODO: Add email contact lookup when implemented

      // Get or create conversation for this sender
      const conversation = await storageService.getOrCreateConversation(
        payload.sender,
        payload.senderType,
        contactName
      );

      // If conversation already exists but doesn't have contact name, update it
      if (!conversation.contactName && contactName) {
        await storageService.updateConversationContactNameBySender(
          payload.sender,
          payload.senderType,
          contactName
        );
        conversation.contactName = contactName;
      }

      // Create message object with backend-provided ID
      const message: Message = {
        id: payload.id,
        conversationId: payload.conversationId || conversation.id,
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

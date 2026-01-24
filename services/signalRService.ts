import * as signalR from '@microsoft/signalr';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';
import { ReceiveMessagePayload } from '../types/api';
import { useAuthStore } from '../stores/authStore';
import { useConnectionStore } from '../stores/connectionStore';
import { storageService } from './storageService';
import { useMessagesStore } from '../stores/messagesStore';
import { v4 as uuidv4 } from 'uuid';

export class SignalRService {
  private connection: HubConnection | null = null;
  private reconnectAttempt = 0;
  private reconnectDelays = [0, 2000, 10000, 30000, 60000]; // Exponential backoff
  private isManuallyDisconnected = false;

  async connect(): Promise<void> {
    const { apiKey, serverUrl } = useAuthStore.getState();

    if (!apiKey) {
      console.log('[SignalR] No API key configured, skipping connection');
      return;
    }

    if (this.connection?.state === HubConnectionState.Connected) {
      console.log('[SignalR] Already connected');
      return;
    }

    try {
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
        .configureLogging(signalR.LogLevel.Information)
        .build();

      this.setupEventHandlers();

      useConnectionStore.getState().setConnectionStatus('connecting');
      await this.connection.start();

      console.log('[SignalR] Connected successfully');
      this.reconnectAttempt = 0;
      useConnectionStore.getState().setConnected(true);
      useConnectionStore.getState().setLastError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SignalR] Connection failed:', errorMessage);

      useConnectionStore.getState().setConnected(false);
      useConnectionStore.getState().setLastError(errorMessage);

      this.scheduleReconnect();
    }
  }

  async disconnect(): Promise<void> {
    this.isManuallyDisconnected = true;

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
      useConnectionStore.getState().setConnected(false);

      if (!this.isManuallyDisconnected) {
        this.scheduleReconnect();
      }
    });
  }

  private async handleIncomingMessage(payload: ReceiveMessagePayload): Promise<void> {
    try {
      // Get or create conversation for this phone number
      const conversation = await storageService.getOrCreateConversation(payload.phoneNumber);

      // Create message object
      const message = {
        id: payload.id,
        conversationId: conversation.id,
        phoneNumber: payload.phoneNumber,
        content: payload.message,
        timestamp: payload.timestamp,
        direction: 'incoming' as const,
        status: 'delivered' as const,
        createdAt: Date.now(),
      };

      // Save to database
      await storageService.saveMessage(message);

      // Update conversation
      await storageService.updateConversation(conversation.id, {
        lastMessagePreview: payload.message,
        lastMessageTimestamp: payload.timestamp,
      });

      // Update Zustand stores for UI reactivity
      useMessagesStore.getState().addMessage(message);

      // Update conversation in store
      useMessagesStore.getState().updateConversation(conversation.id, {
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

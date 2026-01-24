export type MessageDirection = 'incoming' | 'outgoing';
export type MessageStatus = 'sent' | 'queued' | 'failed' | 'delivered';

export interface Message {
  id: string;
  conversationId: string;
  phoneNumber: string;
  content: string;
  timestamp: number; // Unix timestamp in milliseconds
  direction: MessageDirection;
  status: MessageStatus;
  createdAt: number;
}

export interface Conversation {
  id: string;
  phoneNumber: string;
  lastMessagePreview: string | null;
  lastMessageTimestamp: number | null;
  unreadCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface QueuedMessage {
  id: string;
  messageId: string;
  phoneNumber: string;
  content: string;
  timestamp: number;
  retryCount: number;
  nextRetryAt: number | null;
  error: string | null;
  createdAt: number;
}

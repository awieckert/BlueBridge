export type MessageDirection = 'incoming' | 'outgoing';
export type MessageStatus = 'sent' | 'queued' | 'failed' | 'delivered';
export type SenderType = 'phone' | 'email';

export interface Message {
  id: number;
  conversationId: string;
  sender: string;
  senderType: SenderType;
  message: string;
  timestamp: number; // Unix timestamp in milliseconds
  direction: MessageDirection;
  status: MessageStatus;
  createdAt: number;
}

export interface Conversation {
  id: string;
  sender: string;
  senderType: SenderType;
  contactName: string | null;
  lastMessagePreview: string | null;
  lastMessageTimestamp: number | null;
  unreadCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface QueuedMessage {
  id: string;
  messageId: number;
  sender: string;
  senderType: SenderType;
  message: string;
  timestamp: number;
  retryCount: number;
  nextRetryAt: number | null;
  error: string | null;
  createdAt: number;
}

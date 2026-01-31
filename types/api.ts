import { SenderType } from './message';

export interface SendMessageRequest {
  recipient: string;
  senderType: SenderType;
  message: string;
  timestamp: number;
}

export interface SendMessageResponse {
  success: boolean;
  conversationId: string;
  messageId?: string;
  error?: string;
}

export interface SendGroupMessageRequest {
  participants: string[];
  message: string;
  conversationId?: string; // Optional - if provided, send to existing group
}

export interface ReceiveMessagePayload {
  id: number;
  conversationId: string;
  sender: string;
  senderType: SenderType;
  message: string;
  timestamp: number;
}

export interface DeleteConversationRequest {
  conversationId: string;
  reopenMessagesApp?: boolean;
}

export interface DeleteConversationResponse {
  success: boolean;
  timestamp: string;
  error?: string;
  messagesDeleted: number;
  messagesAppClosed: boolean;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
}

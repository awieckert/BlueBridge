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
  messageId?: number;
  error?: string;
}

export interface ReceiveMessagePayload {
  id: number;
  conversationId: string;
  sender: string;
  senderType: SenderType;
  message: string;
  timestamp: number;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
}

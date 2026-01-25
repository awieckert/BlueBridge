import { SenderType } from './message';

export interface SendMessageRequest {
  sender: string;
  senderType: SenderType;
  message: string;
  timestamp: number;
}

export interface SendMessageResponse {
  success: boolean;
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

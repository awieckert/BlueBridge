export interface SendMessageRequest {
  phoneNumber: string;
  message: string;
  timestamp: number;
}

export interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ReceiveMessagePayload {
  id: string;
  phoneNumber: string;
  message: string;
  timestamp: number;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
}

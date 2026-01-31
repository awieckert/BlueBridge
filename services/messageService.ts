import { SendMessageRequest, SendMessageResponse, SendGroupMessageRequest, DeleteConversationRequest, DeleteConversationResponse, ApiError } from '../types/api';
import { SenderType } from '../types/message';
import { useAuthStore } from '../stores/authStore';

export class MessageService {
  private getHeaders(apiKey: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'BB-API-KEY': apiKey,
    };
  }

  async sendMessage(
    recipient: string,
    senderType: SenderType,
    message: string,
    timestamp: number
  ): Promise<SendMessageResponse> {
    const { apiKey, serverUrl } = useAuthStore.getState();

    if (!apiKey) {
      throw this.createApiError(401, 'API key not configured');
    }

    const endpoint = `${serverUrl}/api/messages/send`;
    const payload: SendMessageRequest = {
      recipient,
      senderType,
      message,
      timestamp,
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(apiKey),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json();
      return {
        success: true,
        conversationId: data.conversationId,
        messageId: data.messageId,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'TypeError') {
        // Network error (offline, DNS failure, etc.)
        throw this.createApiError(0, 'Network error - check connection');
      }
      throw error;
    }
  }

  async sendGroupMessage(
    participants: string[],
    message: string,
    conversationId?: string
  ): Promise<SendMessageResponse> {
    const { apiKey, serverUrl } = useAuthStore.getState();

    if (!apiKey) {
      throw this.createApiError(401, 'API key not configured');
    }

    const endpoint = `${serverUrl}/api/messages/send-group`;
    const payload: SendGroupMessageRequest = {
      participants,
      message,
      conversationId,
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(apiKey),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json();
      return {
        success: true,
        conversationId: data.conversationId,
        messageId: data.messageId,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'TypeError') {
        // Network error (offline, DNS failure, etc.)
        throw this.createApiError(0, 'Network error - check connection');
      }
      throw error;
    }
  }

  async deleteConversation(
    conversationId: string,
    reopenMessagesApp: boolean = true
  ): Promise<DeleteConversationResponse> {
    const { apiKey, serverUrl } = useAuthStore.getState();

    if (!apiKey) {
      throw this.createApiError(401, 'API key not configured');
    }

    const endpoint = `${serverUrl}/api/messages/delete`;
    const payload: DeleteConversationRequest = {
      conversationId,
      reopenMessagesApp,
    };

    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: this.getHeaders(apiKey),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json();
      console.log(
        `Backend deleted ${data.messagesDeleted} messages for conversation ${conversationId}`
      );

      return {
        success: true,
        timestamp: data.timestamp,
        messagesDeleted: data.messagesDeleted,
        messagesAppClosed: data.messagesAppClosed,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'TypeError') {
        // Network error (offline, DNS failure, etc.)
        throw this.createApiError(0, 'Network error - check connection');
      }
      throw error;
    }
  }

  private async handleErrorResponse(response: Response): Promise<ApiError> {
    let errorMessage = response.statusText;

    try {
      const data = await response.json();
      if (data.error || data.message) {
        errorMessage = data.error || data.message;
      }
    } catch {
      // Response body not JSON, use statusText
    }

    return this.createApiError(response.status, errorMessage);
  }

  private createApiError(status: number, message: string): ApiError {
    const errorMessages: Record<number, string> = {
      0: message, // Network error
      401: 'Invalid API key - check settings',
      403: 'Access forbidden - verify API key permissions',
      429: 'Rate limit exceeded - try again later',
      500: 'Server error - try again later',
      503: 'Service unavailable - server may be offline',
    };

    return {
      status,
      message: errorMessages[status] || message,
    };
  }
}

export const messageService = new MessageService();

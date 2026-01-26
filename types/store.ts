import { Message, Conversation, QueuedMessage } from './message';

export interface MessagesStore {
  messages: Message[];
  conversations: Conversation[];
  activeConversationId: string | null;

  // Actions
  addMessage: (message: Message) => void;
  updateMessage: (id: number, updates: Partial<Message>) => void;
  getMessagesByConversation: (conversationId: string) => Message[];

  setActiveConversation: (conversationId: string | null) => void;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void;
  updateConversationId: (oldId: string, newId: string) => void;
  incrementUnreadCount: (conversationId: string) => void;
  resetUnreadCount: (conversationId: string) => void;

  loadMessages: (messages: Message[]) => void;
  loadConversations: (conversations: Conversation[]) => void;
  clearAll: () => void;
}

export interface ConnectionStore {
  isConnected: boolean;
  isOnline: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting' | 'connecting';
  lastError: string | null;

  // Actions
  setConnected: (connected: boolean) => void;
  setOnline: (online: boolean) => void;
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'reconnecting' | 'connecting') => void;
  setLastError: (error: string | null) => void;
}

export interface QueueStore {
  queuedMessages: QueuedMessage[];
  isProcessing: boolean;

  // Actions
  addToQueue: (message: QueuedMessage) => void;
  removeFromQueue: (messageId: string) => void;
  updateQueuedMessage: (messageId: string, updates: Partial<QueuedMessage>) => void;
  setProcessing: (processing: boolean) => void;
  loadQueue: (messages: QueuedMessage[]) => void;
  clearQueue: () => void;
}

export interface AuthStore {
  apiKey: string | null;
  serverUrl: string;

  // Actions
  setApiKey: (key: string | null) => void;
  setServerUrl: (url: string) => void;
}

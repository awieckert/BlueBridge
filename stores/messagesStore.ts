import { create } from 'zustand';
import { MessagesStore } from '../types/store';
import { Message, Conversation } from '../types/message';

export const useMessagesStore = create<MessagesStore>((set, get) => ({
  messages: [],
  conversations: [],
  activeConversationId: null,

  addMessage: (message) =>
    set((state) => {
      // Prevent duplicates
      if (state.messages.some((m) => m.id === message.id)) {
        return state;
      }
      return { messages: [...state.messages, message] };
    }),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    })),

  getMessagesByConversation: (conversationId) => {
    const state = get();
    return state.messages
      .filter((msg) => msg.conversationId === conversationId)
      .sort((a, b) => a.timestamp - b.timestamp);
  },

  setActiveConversation: (conversationId) =>
    set({ activeConversationId: conversationId }),

  updateConversation: (conversationId, updates) =>
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? { ...conv, ...updates, updatedAt: Date.now() }
          : conv
      ),
    })),

  updateConversationId: (oldId, newId) =>
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === oldId ? { ...conv, id: newId } : conv
      ),
      messages: state.messages.map((msg) =>
        msg.conversationId === oldId ? { ...msg, conversationId: newId } : msg
      ),
      activeConversationId: state.activeConversationId === oldId ? newId : state.activeConversationId
    })),

  incrementUnreadCount: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? { ...conv, unreadCount: conv.unreadCount + 1 }
          : conv
      ),
    })),

  resetUnreadCount: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      ),
    })),

  loadMessages: (messages) => set({ messages }),

  loadConversations: (conversations) => set({ conversations }),

  clearAll: () =>
    set({
      messages: [],
      conversations: [],
      activeConversationId: null,
    }),
}));

import { create } from 'zustand';
import { QueueStore } from '../types/store';
import { QueuedMessage } from '../types/message';

export const useQueueStore = create<QueueStore>((set) => ({
  queuedMessages: [],
  isProcessing: false,

  addToQueue: (message) =>
    set((state) => {
      // Prevent duplicates
      if (state.queuedMessages.some((m) => m.id === message.id)) {
        return state;
      }
      return { queuedMessages: [...state.queuedMessages, message] };
    }),

  removeFromQueue: (messageId) =>
    set((state) => ({
      queuedMessages: state.queuedMessages.filter((m) => m.messageId !== messageId),
    })),

  updateQueuedMessage: (messageId, updates) =>
    set((state) => ({
      queuedMessages: state.queuedMessages.map((msg) =>
        msg.messageId === messageId ? { ...msg, ...updates } : msg
      ),
    })),

  setProcessing: (processing) => set({ isProcessing: processing }),

  loadQueue: (messages) => set({ queuedMessages: messages }),

  clearQueue: () => set({ queuedMessages: [] }),
}));

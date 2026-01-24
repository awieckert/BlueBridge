import { create } from 'zustand';
import { ConnectionStore } from '../types/store';

export const useConnectionStore = create<ConnectionStore>((set) => ({
  isConnected: false,
  isOnline: true,
  connectionStatus: 'disconnected',
  lastError: null,

  setConnected: (connected) =>
    set({
      isConnected: connected,
      connectionStatus: connected ? 'connected' : 'disconnected',
    }),

  setOnline: (online) => set({ isOnline: online }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setLastError: (error) => set({ lastError: error }),
}));

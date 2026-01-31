import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthStore } from '../types/store';
import { Config } from '../utils/constants';

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      apiKey: null,
      serverUrl: Config.API_BASE_URL,

      setApiKey: (key) => set({ apiKey: key }),
      setServerUrl: (url) => set({ serverUrl: url }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

import { create } from 'zustand';
import {
  Contact,
  fetchContacts,
  requestContactsPermission,
  getContactsPermissionStatus,
  lookupContactByPhoneNumber,
  getContactName,
  searchContacts,
  getCachedContacts,
  clearContactsCache,
  getCachedPermissionStatus,
} from '../services/contactService';

interface ContactStoreState {
  // State
  contacts: Contact[];
  permissionStatus: 'granted' | 'denied' | 'undetermined';
  isLoading: boolean;
  error: string | null;

  // Actions
  requestPermission: () => Promise<'granted' | 'denied' | 'undetermined'>;
  loadContacts: (forceRefresh?: boolean) => Promise<void>;
  searchContactsByQuery: (query: string) => Contact[];
  getContactByPhoneNumber: (phoneNumber: string) => Contact | null;
  getNameByPhoneNumber: (phoneNumber: string) => string | null;
  clearContacts: () => void;
  checkPermissionStatus: () => Promise<void>;
}

export const useContactStore = create<ContactStoreState>((set, get) => ({
  // Initial state
  contacts: getCachedContacts(),
  permissionStatus: getCachedPermissionStatus(),
  isLoading: false,
  error: null,

  // Request contacts permission
  requestPermission: async () => {
    try {
      set({ isLoading: true, error: null });
      const status = await requestContactsPermission();
      set({ permissionStatus: status, isLoading: false });

      // If permission granted, automatically load contacts
      if (status === 'granted') {
        await get().loadContacts();
      }

      return status;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request permission';
      set({ error: errorMessage, isLoading: false });
      return 'denied';
    }
  },

  // Load contacts from device
  loadContacts: async (forceRefresh = false) => {
    try {
      set({ isLoading: true, error: null });

      // Check permission first
      if (get().permissionStatus !== 'granted') {
        const status = await getContactsPermissionStatus();
        set({ permissionStatus: status });

        if (status !== 'granted') {
          set({
            error: 'Contacts permission not granted',
            isLoading: false,
            contacts: [],
          });
          return;
        }
      }

      // Fetch contacts
      const contacts = await fetchContacts(forceRefresh);
      set({ contacts, isLoading: false, error: null });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load contacts';
      set({ error: errorMessage, isLoading: false });
    }
  },

  // Search contacts by query string
  searchContactsByQuery: (query: string) => {
    return searchContacts(query);
  },

  // Get contact by phone number
  getContactByPhoneNumber: (phoneNumber: string) => {
    return lookupContactByPhoneNumber(phoneNumber);
  },

  // Get contact name by phone number
  getNameByPhoneNumber: (phoneNumber: string) => {
    return getContactName(phoneNumber);
  },

  // Clear contacts from cache
  clearContacts: () => {
    clearContactsCache();
    set({ contacts: [], error: null });
  },

  // Check permission status without requesting
  checkPermissionStatus: async () => {
    try {
      const status = await getContactsPermissionStatus();
      set({ permissionStatus: status });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check permission';
      set({ error: errorMessage });
    }
  },
}));

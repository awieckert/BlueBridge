import * as Contacts from 'expo-contacts';
import { normalizePhoneNumber, phoneNumbersMatch } from '../utils/phoneNumber';

export interface Contact {
  id: string;
  name: string;
  phoneNumbers: string[]; // Normalized E.164 format
  rawPhoneNumbers: string[]; // Original format from device
  emails: string[]; // Email addresses
}

interface ContactCache {
  contacts: Contact[];
  lastFetched: number | null;
  permissionStatus: 'granted' | 'denied' | 'undetermined';
}

// In-memory cache
let cache: ContactCache = {
  contacts: [],
  lastFetched: null,
  permissionStatus: 'undetermined',
};

/**
 * Request permission to access contacts
 * @returns Permission status
 */
export async function requestContactsPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    cache.permissionStatus = status;
    return status;
  } catch (error) {
    console.error('Error requesting contacts permission:', error);
    cache.permissionStatus = 'denied';
    return 'denied';
  }
}

/**
 * Get current permission status without requesting
 * @returns Current permission status
 */
export async function getContactsPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const { status } = await Contacts.getPermissionsAsync();
    cache.permissionStatus = status;
    return status;
  } catch (error) {
    console.error('Error getting contacts permission status:', error);
    return 'undetermined';
  }
}

/**
 * Fetch all contacts with phone numbers from device
 * @param forceRefresh - Force refresh even if cached
 * @returns Array of contacts with normalized phone numbers
 */
export async function fetchContacts(forceRefresh: boolean = false): Promise<Contact[]> {
  // Check if we have cached contacts and don't need to refresh
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  if (
    !forceRefresh &&
    cache.contacts.length > 0 &&
    cache.lastFetched &&
    Date.now() - cache.lastFetched < CACHE_DURATION
  ) {
    return cache.contacts;
  }

  try {
    // Check permission status first
    const permissionStatus = await getContactsPermissionStatus();
    if (permissionStatus !== 'granted') {
      console.warn('Contacts permission not granted');
      return [];
    }

    // Fetch contacts with phone numbers and emails
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
    });

    // Filter and transform contacts
    const contacts: Contact[] = [];

    for (const contact of data) {
      // Extract phone numbers and normalize them
      const phoneNumbers: string[] = [];
      const rawPhoneNumbers: string[] = [];

      if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
        for (const phoneEntry of contact.phoneNumbers) {
          if (phoneEntry.number) {
            const normalized = normalizePhoneNumber(phoneEntry.number);
            if (normalized) {
              phoneNumbers.push(normalized);
              rawPhoneNumbers.push(phoneEntry.number);
            }
          }
        }
      }

      // Extract email addresses
      const emails: string[] = [];
      if (contact.emails && contact.emails.length > 0) {
        for (const emailEntry of contact.emails) {
          if (emailEntry.email) {
            emails.push(emailEntry.email.trim().toLowerCase());
          }
        }
      }

      // Only include contacts with at least one phone number or email
      if (phoneNumbers.length > 0 || emails.length > 0) {
        contacts.push({
          id: contact.id || `contact-${Date.now()}-${Math.random()}`,
          name: contact.name || 'Unknown',
          phoneNumbers,
          rawPhoneNumbers,
          emails,
        });
      }
    }

    // Update cache
    cache.contacts = contacts;
    cache.lastFetched = Date.now();

    return contacts;
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return [];
  }
}

/**
 * Lookup contact by phone number
 * @param phoneNumber - Phone number to lookup (any format)
 * @returns Contact if found, null otherwise
 */
export function lookupContactByPhoneNumber(phoneNumber: string): Contact | null {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) {
    return null;
  }

  // Search through cached contacts
  for (const contact of cache.contacts) {
    for (const contactPhone of contact.phoneNumbers) {
      if (contactPhone === normalized) {
        return contact;
      }
    }
  }

  return null;
}

/**
 * Get contact name by phone number
 * @param phoneNumber - Phone number to lookup (any format)
 * @returns Contact name if found, null otherwise
 */
export function getContactName(phoneNumber: string): string | null {
  const contact = lookupContactByPhoneNumber(phoneNumber);
  return contact ? contact.name : null;
}

/**
 * Search contacts by name or phone number
 * @param query - Search query
 * @returns Array of matching contacts
 */
export function searchContacts(query: string): Contact[] {
  if (!query || query.trim().length === 0) {
    return cache.contacts;
  }

  const lowerQuery = query.toLowerCase().trim();

  return cache.contacts.filter((contact) => {
    // Search in name
    if (contact.name.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Search in phone numbers (both normalized and raw)
    for (const phone of [...contact.phoneNumbers, ...contact.rawPhoneNumbers]) {
      if (phone.includes(lowerQuery) || phone.replace(/\D/g, '').includes(lowerQuery)) {
        return true;
      }
    }

    // Search in emails
    for (const email of contact.emails) {
      if (email.toLowerCase().includes(lowerQuery)) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Get all cached contacts (without fetching)
 * @returns Cached contacts array
 */
export function getCachedContacts(): Contact[] {
  return cache.contacts;
}

/**
 * Clear contacts cache
 */
export function clearContactsCache(): void {
  cache.contacts = [];
  cache.lastFetched = null;
}

/**
 * Get current permission status from cache
 * @returns Cached permission status
 */
export function getCachedPermissionStatus(): 'granted' | 'denied' | 'undetermined' {
  return cache.permissionStatus;
}

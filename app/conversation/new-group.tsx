import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { contactService } from '../../services/contactService';
import { StorageService } from '../../services/storageService';
import { useMessagesStore } from '../../stores/messagesStore';
import { Contact } from '../../types/contact';
import { normalizePhoneNumber } from '../../utils/phoneNumber';

const storageService = new StorageService();

export default function NewGroupScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const addConversation = useMessagesStore((state) => state.addConversation);

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredContacts(
        contacts.filter(
          (contact) =>
            contact.name.toLowerCase().includes(query) ||
            contact.phoneNumbers.some((p) => p.number.includes(query)) ||
            contact.emails.some((e) => e.email.toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery, contacts]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const loadedContacts = await contactService.getContacts();
      setContacts(loadedContacts);
      setFilteredContacts(loadedContacts);
    } catch (error) {
      console.error('Failed to load contacts:', error);
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const toggleContact = (contact: Contact) => {
    setSelectedContacts((prev) => {
      const isSelected = prev.some((c) => c.id === contact.id);
      if (isSelected) {
        return prev.filter((c) => c.id !== contact.id);
      } else {
        return [...prev, contact];
      }
    });
  };

  const createGroup = async () => {
    if (selectedContacts.length < 2) {
      Alert.alert('Minimum 2 Participants', 'Please select at least 2 contacts to create a group.');
      return;
    }

    try {
      setCreating(true);

      // Extract phone numbers/emails from selected contacts
      const participants: string[] = [];
      for (const contact of selectedContacts) {
        if (contact.phoneNumbers.length > 0) {
          // Use first phone number and normalize it
          const normalized = normalizePhoneNumber(contact.phoneNumbers[0].number);
          if (normalized) {
            participants.push(normalized);
          }
        } else if (contact.emails.length > 0) {
          // Use first email as fallback
          participants.push(contact.emails[0].email);
        }
      }

      if (participants.length < 2) {
        Alert.alert('Error', 'Could not extract valid phone numbers or emails from selected contacts.');
        setCreating(false);
        return;
      }

      // Create group conversation locally with temp ID
      const contactNames = selectedContacts.map((c) => c.name).join(', ');
      const conversation = await storageService.createGroupConversation(participants, contactNames);

      // Add to store
      addConversation(conversation);

      // Navigate to chat screen - first message will trigger backend group creation
      router.replace(`/chat/${conversation.id}`);
    } catch (error) {
      console.error('Failed to create group:', error);
      Alert.alert('Error', 'Failed to create group conversation');
      setCreating(false);
    }
  };

  const isSelected = (contact: Contact) => {
    return selectedContacts.some((c) => c.id === contact.id);
  };

  const renderContact = ({ item }: { item: Contact }) => {
    const selected = isSelected(item);
    const hasPhone = item.phoneNumbers.length > 0;
    const hasEmail = item.emails.length > 0;

    return (
      <TouchableOpacity
        style={[
          styles.contactItem,
          {
            backgroundColor: isDark ? '#2c2c2c' : '#fff',
            borderBottomColor: isDark ? '#444' : '#e0e0e0',
          },
          selected && {
            backgroundColor: isDark ? '#1a4d2e' : '#e8f5e9',
          },
        ]}
        onPress={() => toggleContact(item)}
      >
        <View style={styles.contactAvatar}>
          <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, { color: isDark ? '#fff' : '#000' }]}>
            {item.name}
          </Text>
          <Text style={[styles.contactDetail, { color: isDark ? '#aaa' : '#666' }]}>
            {hasPhone && item.phoneNumbers[0].number}
            {hasEmail && !hasPhone && item.emails[0].email}
          </Text>
        </View>
        {selected && (
          <Ionicons name="checkmark-circle" size={24} color="#4caf50" />
        )}
      </TouchableOpacity>
    );
  };

  const renderSelectedChip = ({ item }: { item: Contact }) => (
    <View style={[styles.chip, { backgroundColor: isDark ? '#1a4d2e' : '#e8f5e9' }]}>
      <Text style={[styles.chipText, { color: isDark ? '#fff' : '#000' }]}>{item.name}</Text>
      <TouchableOpacity onPress={() => toggleContact(item)}>
        <Ionicons name="close-circle" size={18} color={isDark ? '#aaa' : '#666'} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1c1c1c' : '#f5f5f5' }]}>
      {/* Selected Contacts Bar */}
      {selectedContacts.length > 0 && (
        <View style={[styles.selectedBar, { backgroundColor: isDark ? '#2c2c2c' : '#fff' }]}>
          <FlatList
            horizontal
            data={selectedContacts}
            renderItem={renderSelectedChip}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.selectedList}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: isDark ? '#2c2c2c' : '#fff' }]}>
        <Ionicons name="search" size={20} color={isDark ? '#aaa' : '#666'} />
        <TextInput
          style={[styles.searchInput, { color: isDark ? '#fff' : '#000' }]}
          placeholder="Search contacts..."
          placeholderTextColor={isDark ? '#666' : '#999'}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Contacts List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          renderItem={renderContact}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={{ color: isDark ? '#aaa' : '#666' }}>No contacts found</Text>
            </View>
          }
        />
      )}

      {/* Create Button */}
      {selectedContacts.length >= 2 && (
        <TouchableOpacity
          style={[styles.createButton, creating && styles.createButtonDisabled]}
          onPress={createGroup}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="people" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.createButtonText}>
                Create Group ({selectedContacts.length})
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  selectedBar: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectedList: {
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  list: {
    paddingBottom: 100,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  contactDetail: {
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  createButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 28,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
});

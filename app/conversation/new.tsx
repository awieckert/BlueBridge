import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useContactStore } from '@/stores/contactStore';
import { useMessagesStore } from '@/stores/messagesStore';
import { ContactListItem } from '@/components/ContactListItem';
import { ConversationItem } from '@/components/ConversationItem';
import { Contact } from '@/services/contactService';
import { Conversation } from '@/types/message';
import { normalizePhoneNumber, validatePhoneNumber, formatPhoneNumber } from '@/utils/phoneNumber';
import { storageService } from '@/services/storageService';

export default function NewConversationScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const {
    contacts,
    permissionStatus,
    isLoading,
    requestPermission,
    loadContacts,
    searchContactsByQuery,
  } = useContactStore();

  const { conversations } = useMessagesStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualPhoneNumber, setManualPhoneNumber] = useState('');

  // Request permission and load contacts on mount
  useEffect(() => {
    const init = async () => {
      if (permissionStatus === 'undetermined') {
        await requestPermission();
      } else if (permissionStatus === 'granted' && contacts.length === 0) {
        await loadContacts();
      }
    };
    init();
  }, []);

  // Filter contacts based on search query
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) {
      return contacts;
    }
    return searchContactsByQuery(searchQuery);
  }, [searchQuery, contacts]);

  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) {
      return conversations;
    }
    const lowerQuery = searchQuery.toLowerCase();
    return conversations.filter((conv) => {
      // Search in contact name
      if (conv.contactName && conv.contactName.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      // Search in sender (phone number or email)
      if (conv.sender.includes(lowerQuery)) {
        return true;
      }
      // Search in last message preview
      if (conv.lastMessagePreview && conv.lastMessagePreview.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      return false;
    });
  }, [searchQuery, conversations]);

  // Handle contact selection
  const handleContactPress = async (contact: Contact) => {
    try {
      // Use the first phone number
      const phoneNumber = contact.phoneNumbers[0];

      // Check if conversation already exists
      const existing = await storageService.getConversationBySender(phoneNumber, 'phone');

      if (existing) {
        // Navigate to existing conversation
        router.push(`/chat/${existing.id}`);
      } else {
        // Create new conversation with contact name
        const conversation = await storageService.getOrCreateConversation(phoneNumber, 'phone', contact.name);
        router.push(`/chat/${conversation.id}`);
      }
    } catch (error) {
      console.error('Error creating conversation from contact:', error);
      Alert.alert('Error', 'Failed to create conversation. Please try again.');
    }
  };

  // Handle conversation selection
  const handleConversationPress = (conversation: Conversation) => {
    router.push(`/chat/${conversation.id}`);
  };

  // Handle manual phone number entry
  const handleManualPhoneNumberSubmit = async () => {
    const trimmed = manualPhoneNumber.trim();

    if (!trimmed) {
      Alert.alert('Invalid Input', 'Please enter a phone number.');
      return;
    }

    // Validate phone number
    if (!validatePhoneNumber(trimmed)) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid phone number.');
      return;
    }

    // Normalize phone number
    const normalized = normalizePhoneNumber(trimmed);
    if (!normalized) {
      Alert.alert('Invalid Phone Number', 'Unable to parse phone number. Please check the format.');
      return;
    }

    try {
      // Check if conversation already exists
      const existing = await storageService.getConversationBySender(normalized, 'phone');

      if (existing) {
        // Navigate to existing conversation
        setShowManualEntry(false);
        setManualPhoneNumber('');
        router.push(`/chat/${existing.id}`);
      } else {
        // Create new conversation
        const conversation = await storageService.getOrCreateConversation(normalized, 'phone', null);
        setShowManualEntry(false);
        setManualPhoneNumber('');
        router.push(`/chat/${conversation.id}`);
      }
    } catch (error) {
      console.error('Error creating conversation from manual entry:', error);
      Alert.alert('Error', 'Failed to create conversation. Please try again.');
    }
  };

  // Render permission request UI
  const renderPermissionRequest = () => {
    if (permissionStatus === 'denied') {
      return (
        <View style={[styles.permissionContainer, isDark && styles.permissionContainerDark]}>
          <Text style={[styles.permissionTitle, isDark && styles.permissionTitleDark]}>
            Contacts Permission Required
          </Text>
          <Text style={[styles.permissionMessage, isDark && styles.permissionMessageDark]}>
            Allow access to contacts to easily message your friends.
          </Text>
          <Pressable
            style={[styles.permissionButton, isDark && styles.permissionButtonDark]}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </Pressable>
        </View>
      );
    }
    return null;
  };

  // Render empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
        No contacts or conversations found
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Search Bar */}
      <View style={[styles.searchContainer, isDark && styles.searchContainerDark]}>
        <TextInput
          style={[styles.searchInput, isDark && styles.searchInputDark]}
          placeholder="Search contacts or conversations..."
          placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Loading State */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}

      {/* Permission Request */}
      {!isLoading && permissionStatus === 'denied' && renderPermissionRequest()}

      {/* Content List */}
      {!isLoading && permissionStatus !== 'denied' && (
        <FlatList
          data={[
            ...filteredConversations.map((c) => ({ type: 'conversation', data: c })),
            ...filteredContacts.map((c) => ({ type: 'contact', data: c })),
          ]}
          keyExtractor={(item, index) =>
            item.type === 'conversation'
              ? `conv-${item.data.id}`
              : `contact-${(item.data as Contact).id}`
          }
          renderItem={({ item }) => {
            if (item.type === 'conversation') {
              return (
                <ConversationItem
                  conversation={item.data as Conversation}
                  onPress={() => handleConversationPress(item.data as Conversation)}
                />
              );
            } else {
              return (
                <ContactListItem
                  contact={item.data as Contact}
                  onPress={() => handleContactPress(item.data as Contact)}
                  searchQuery={searchQuery}
                />
              );
            }
          }}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={
            filteredContacts.length === 0 && filteredConversations.length === 0
              ? styles.emptyListContainer
              : undefined
          }
        />
      )}

      {/* Manual Entry Button */}
      <View style={[styles.manualEntryContainer, isDark && styles.manualEntryContainerDark]}>
        <Pressable
          style={[styles.manualEntryButton, isDark && styles.manualEntryButtonDark]}
          onPress={() => setShowManualEntry(true)}
        >
          <Text style={styles.manualEntryButtonText}>Enter Phone Number Manually</Text>
        </Pressable>
      </View>

      {/* Manual Entry Modal */}
      <Modal
        visible={showManualEntry}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManualEntry(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowManualEntry(false)}
        >
          <Pressable
            style={[styles.modalContent, isDark && styles.modalContentDark]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
              Enter Phone Number
            </Text>
            <TextInput
              style={[styles.modalInput, isDark && styles.modalInputDark]}
              placeholder="+1 (234) 567-8900"
              placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
              value={manualPhoneNumber}
              onChangeText={setManualPhoneNumber}
              keyboardType="phone-pad"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowManualEntry(false);
                  setManualPhoneNumber('');
                }}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.modalButtonSubmit,
                  isDark && styles.modalButtonSubmitDark,
                ]}
                onPress={handleManualPhoneNumberSubmit}
              >
                <Text style={styles.modalButtonSubmitText}>Start Chat</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  searchContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchContainerDark: {
    backgroundColor: '#1C1C1E',
    borderBottomColor: '#38383A',
  },
  searchInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    fontSize: 16,
    color: '#000000',
  },
  searchInputDark: {
    backgroundColor: '#38383A',
    color: '#FFFFFF',
  },
  clearButton: {
    marginLeft: 8,
    padding: 8,
  },
  clearButtonText: {
    fontSize: 18,
    color: '#8E8E93',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  permissionContainerDark: {
    backgroundColor: '#000000',
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionTitleDark: {
    color: '#FFFFFF',
  },
  permissionMessage: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 24,
    textAlign: 'center',
  },
  permissionMessageDark: {
    color: '#8E8E93',
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonDark: {
    backgroundColor: '#0A84FF',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyListContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  emptyTextDark: {
    color: '#8E8E93',
  },
  manualEntryContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  manualEntryContainerDark: {
    backgroundColor: '#1C1C1E',
    borderTopColor: '#38383A',
  },
  manualEntryButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  manualEntryButtonDark: {
    backgroundColor: '#0A84FF',
  },
  manualEntryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
  },
  modalContentDark: {
    backgroundColor: '#1C1C1E',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalTitleDark: {
    color: '#FFFFFF',
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#000000',
    marginBottom: 16,
  },
  modalInputDark: {
    borderColor: '#38383A',
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F2F2F7',
  },
  modalButtonCancelText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonSubmit: {
    backgroundColor: '#007AFF',
  },
  modalButtonSubmitDark: {
    backgroundColor: '#0A84FF',
  },
  modalButtonSubmitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

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
import { Contact } from '@/services/contactService';
import { Conversation, SenderType } from '@/types/message';
import { normalizePhoneNumber, validatePhoneNumber, formatPhoneNumber } from '@/utils/phoneNumber';
import { storageService } from '@/services/storageService';
import { SenderTypeEnum } from '@/utils/senderTypeEnum';
import { v4 as uuidv4 } from 'uuid';

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


  const [searchQuery, setSearchQuery] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualContact, setManualContact] = useState('');
  const [showContactMethodPicker, setShowContactMethodPicker] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

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

  // Don't show existing conversations in the new conversation screen
  // Users should only select from contacts to start new conversations

  // Handle contact selection
  const handleContactPress = async (contact: Contact) => {
    try {
      const hasPhone = contact.phoneNumbers.length > 0;
      const hasEmail = contact.emails.length > 0;

      // If contact has both phone and email, show picker
      if (hasPhone && hasEmail) {
        setSelectedContact(contact);
        setShowContactMethodPicker(true);
        return;
      }

      // Otherwise, use whichever is available
      let sender: string;
      let type: SenderType;

      if (hasPhone) {
        sender = contact.phoneNumbers[0];
        type = SenderTypeEnum.Phone;
      } else if (hasEmail) {
        sender = contact.emails[0];
        type = SenderTypeEnum.Email;
      } else {
        Alert.alert('Error', 'This contact has no phone number or email address.');
        return;
      }

      await createConversationAndNavigate(sender, type, contact.name);
    } catch (error) {
      console.error('Error creating conversation from contact:', error);
      Alert.alert('Error', 'Failed to create conversation. Please try again.');
    }
  };

  // Handle contact method selection
  const handleContactMethodSelect = async (method: SenderType) => {
    if (!selectedContact) return;

    try {
      const sender = method === SenderTypeEnum.Phone
        ? selectedContact.phoneNumbers[0]
        : selectedContact.emails[0];

      setShowContactMethodPicker(false);
      setSelectedContact(null);

      await createConversationAndNavigate(sender, method, selectedContact.name);
    } catch (error) {
      console.error('Error creating conversation from contact method:', error);
      Alert.alert('Error', 'Failed to create conversation. Please try again.');
    }
  };

  // Helper function to create conversation and navigate
  const createConversationAndNavigate = async (
    sender: string,
    type: SenderType,
    contactName: string | null
  ) => {
    // Check if conversation already exists in DATABASE
    const existing = await storageService.getConversationBySender(sender, type);

    if (existing) {
      // Navigate to existing conversation (has real ID from server)
      // Use replace to remove new conversation screen from stack
      router.replace(`/chat/${existing.id}`);
    } else {
      // Create temporary in-memory conversation for UI navigation
      const tempId = uuidv4();
      const now = Date.now();

      const tempConversation: Conversation = {
        id: tempId,
        sender,
        senderType: type,
        contactName,
        lastMessagePreview: null,
        lastMessageTimestamp: null,
        unreadCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      // Add to Zustand store ONLY (not database)
      const store = useMessagesStore.getState();
      store.loadConversations([...store.conversations, tempConversation]);

      // Navigate to chat screen with temp UUID
      // Use replace to remove new conversation screen from stack
      router.replace(`/chat/${tempId}`);
    }
  };


  // Validate email address
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle manual contact entry (phone or email)
  const handleManualContactSubmit = async () => {
    const trimmed = manualContact.trim();

    if (!trimmed) {
      Alert.alert('Invalid Input', 'Please enter a phone number or email address.');
      return;
    }

    let sender: string;
    let type: SenderType;

    // Check if it's an email address
    if (trimmed.includes('@')) {
      if (!validateEmail(trimmed)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address.');
        return;
      }
      sender = trimmed.toLowerCase();
      type = SenderTypeEnum.Email;
    } else {
      // Treat as phone number
      if (!validatePhoneNumber(trimmed)) {
        Alert.alert('Invalid Phone Number', 'Please enter a valid phone number.');
        return;
      }

      const normalized = normalizePhoneNumber(trimmed);
      if (!normalized) {
        Alert.alert('Invalid Phone Number', 'Unable to parse phone number. Please check the format.');
        return;
      }
      sender = normalized;
      type = SenderTypeEnum.Phone;
    }

    try {
      setShowManualEntry(false);
      setManualContact('');
      await createConversationAndNavigate(sender, type, null);
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
        No contacts found
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
          New Conversation
        </Text>
      </View>

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
          data={filteredContacts}
          keyExtractor={(contact) => contact.id}
          renderItem={({ item }) => (
            <ContactListItem
              contact={item}
              onPress={() => handleContactPress(item)}
              searchQuery={searchQuery}
            />
          )}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={
            filteredContacts.length === 0
              ? styles.emptyListContainer
              : undefined
          }
        />
      )}

      {/* Action Buttons */}
      <View style={[styles.manualEntryContainer, isDark && styles.manualEntryContainerDark]}>
        <Pressable
          style={[styles.actionButton, styles.groupButton, isDark && styles.groupButtonDark]}
          onPress={() => router.push('/conversation/new-group')}
        >
          <Text style={styles.groupButtonText}>➕ New Group</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.manualEntryButton, isDark && styles.manualEntryButtonDark]}
          onPress={() => setShowManualEntry(true)}
        >
          <Text style={styles.manualEntryButtonText}>Enter Contact Manually</Text>
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
              Enter Phone Number or Email
            </Text>
            <TextInput
              style={[styles.modalInput, isDark && styles.modalInputDark]}
              placeholder="+1 (234) 567-8900 or email@example.com"
              placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
              value={manualContact}
              onChangeText={setManualContact}
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowManualEntry(false);
                  setManualContact('');
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
                onPress={handleManualContactSubmit}
              >
                <Text style={styles.modalButtonSubmitText}>Start Chat</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Contact Method Picker Modal */}
      <Modal
        visible={showContactMethodPicker}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowContactMethodPicker(false);
          setSelectedContact(null);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowContactMethodPicker(false);
            setSelectedContact(null);
          }}
        >
          <Pressable
            style={[styles.modalContent, isDark && styles.modalContentDark]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
              Choose Contact Method
            </Text>
            {selectedContact && (
              <>
                <Text style={[styles.contactPickerName, isDark && styles.contactPickerNameDark]}>
                  {selectedContact.name}
                </Text>
                <View style={styles.contactMethodButtons}>
                  {selectedContact.phoneNumbers.length > 0 && (
                    <Pressable
                      style={[
                        styles.contactMethodButton,
                        isDark && styles.contactMethodButtonDark,
                      ]}
                      onPress={() => handleContactMethodSelect(SenderTypeEnum.Phone)}
                    >
                      <Text style={[styles.contactMethodLabel, isDark && styles.contactMethodLabelDark]}>
                        Phone
                      </Text>
                      <Text style={[styles.contactMethodValue, isDark && styles.contactMethodValueDark]}>
                        {formatPhoneNumber(selectedContact.rawPhoneNumbers[0])}
                      </Text>
                    </Pressable>
                  )}
                  {selectedContact.emails.length > 0 && (
                    <Pressable
                      style={[
                        styles.contactMethodButton,
                        isDark && styles.contactMethodButtonDark,
                      ]}
                      onPress={() => handleContactMethodSelect(SenderTypeEnum.Email)}
                    >
                      <Text style={[styles.contactMethodLabel, isDark && styles.contactMethodLabelDark]}>
                        Email
                      </Text>
                      <Text style={[styles.contactMethodValue, isDark && styles.contactMethodValueDark]}>
                        {selectedContact.emails[0]}
                      </Text>
                    </Pressable>
                  )}
                </View>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonCancel, { marginTop: 12 }]}
                  onPress={() => {
                    setShowContactMethodPicker(false);
                    setSelectedContact(null);
                  }}
                >
                  <Text style={styles.modalButtonCancelText}>Cancel</Text>
                </Pressable>
              </>
            )}
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
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerDark: {
    backgroundColor: '#1C1C1E',
    borderBottomColor: '#38383A',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
  },
  headerTitleDark: {
    color: '#FFFFFF',
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
    flexDirection: 'row',
    gap: 12,
  },
  manualEntryContainerDark: {
    backgroundColor: '#1C1C1E',
    borderTopColor: '#38383A',
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  groupButton: {
    backgroundColor: '#4CAF50',
  },
  groupButtonDark: {
    backgroundColor: '#388E3C',
  },
  groupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  manualEntryButton: {
    backgroundColor: '#007AFF',
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
  contactPickerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
    textAlign: 'center',
  },
  contactPickerNameDark: {
    color: '#FFFFFF',
  },
  contactMethodButtons: {
    gap: 12,
    width: '100%',
  },
  contactMethodButton: {
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  contactMethodButtonDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#38383A',
  },
  contactMethodLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  contactMethodLabelDark: {
    color: '#8E8E93',
  },
  contactMethodValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  contactMethodValueDark: {
    color: '#FFFFFF',
  },
});

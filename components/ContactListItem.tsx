import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Contact } from '@/services/contactService';
import { formatPhoneNumber } from '@/utils/phoneNumber';

interface ContactListItemProps {
  contact: Contact;
  onPress: () => void;
  searchQuery?: string;
}

export function ContactListItem({ contact, onPress, searchQuery }: ContactListItemProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Get the first letter of the contact name for the avatar
  const avatarLetter = contact.name.charAt(0).toUpperCase();

  // Format the first phone number or email for display
  const displayContact = contact.rawPhoneNumbers.length > 0
    ? formatPhoneNumber(contact.rawPhoneNumbers[0])
    : contact.phoneNumbers.length > 0
    ? contact.phoneNumbers[0]
    : contact.emails.length > 0
    ? contact.emails[0]
    : '';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        isDark && styles.containerDark,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, isDark && styles.avatarDark]}>
          <Text style={styles.avatarText}>{avatarLetter}</Text>
        </View>
      </View>

      <View style={styles.contentContainer}>
        <Text
          style={[styles.name, isDark && styles.nameDark]}
          numberOfLines={1}
        >
          {contact.name}
        </Text>
        <Text
          style={[styles.phoneNumber, isDark && styles.phoneNumberDark]}
          numberOfLines={1}
        >
          {displayContact}
        </Text>
        {(contact.phoneNumbers.length + contact.emails.length > 1) && (
          <Text
            style={[styles.additionalInfo, isDark && styles.additionalInfoDark]}
            numberOfLines={1}
          >
            +{contact.phoneNumbers.length + contact.emails.length - 1} more
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  containerDark: {
    backgroundColor: '#000000',
    borderBottomColor: '#38383A',
  },
  pressed: {
    opacity: 0.7,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarDark: {
    backgroundColor: '#30D158',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  nameDark: {
    color: '#FFFFFF',
  },
  phoneNumber: {
    fontSize: 15,
    color: '#8E8E93',
  },
  phoneNumberDark: {
    color: '#8E8E93',
  },
  additionalInfo: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
    fontStyle: 'italic',
  },
  additionalInfoDark: {
    color: '#8E8E93',
  },
});

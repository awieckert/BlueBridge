import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Conversation } from '@/types/message';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
}

export function ConversationItem({ conversation, onPress }: ConversationItemProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

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
          <Text style={styles.avatarText}>
            {conversation.phoneNumber.charAt(0)}
          </Text>
        </View>
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text
            style={[styles.phoneNumber, isDark && styles.phoneNumberDark]}
            numberOfLines={1}
          >
            {conversation.phoneNumber}
          </Text>
          <Text style={[styles.timestamp, isDark && styles.timestampDark]}>
            {formatTimestamp(conversation.lastMessageTimestamp)}
          </Text>
        </View>

        <View style={styles.messageRow}>
          <Text
            style={[
              styles.preview,
              isDark && styles.previewDark,
              conversation.unreadCount > 0 && styles.previewUnread,
            ]}
            numberOfLines={1}
          >
            {conversation.lastMessagePreview || 'No messages yet'}
          </Text>
          {conversation.unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{conversation.unreadCount}</Text>
            </View>
          )}
        </View>
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
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarDark: {
    backgroundColor: '#0A84FF',
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  phoneNumber: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  phoneNumberDark: {
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
  },
  timestampDark: {
    color: '#8E8E93',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preview: {
    fontSize: 15,
    color: '#8E8E93',
    flex: 1,
  },
  previewDark: {
    color: '#8E8E93',
  },
  previewUnread: {
    fontWeight: '600',
    color: '#000000',
  },
  badge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

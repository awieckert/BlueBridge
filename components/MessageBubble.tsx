import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Message } from '@/types/message';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface MessageBubbleProps {
  message: Message;
  onRetry?: (message: Message) => void;
  isGroup?: boolean;
  senderName?: string;
}

export function MessageBubble({ message, onRetry, isGroup = false, senderName }: MessageBubbleProps) {
  const colorScheme = useColorScheme();
  const isOutgoing = message.direction === 'outgoing';
  const isDark = colorScheme === 'dark';
  const showRetryButton = message.status === 'failed' && isOutgoing && onRetry;
  const showSenderName = isGroup && !isOutgoing && senderName;

  const getStatusText = () => {
    if (message.direction === 'incoming') return null;

    switch (message.status) {
      case 'queued':
        return 'Queued';
      case 'failed':
        return 'Failed';
      case 'sent':
        return 'Sent';
      case 'delivered':
        return 'Delivered';
      default:
        return null;
    }
  };

  const statusText = getStatusText();

  return (
    <View style={[styles.container, isOutgoing ? styles.outgoingContainer : styles.incomingContainer]}>
      <View
        style={[
          styles.bubble,
          isOutgoing ? styles.outgoingBubble : styles.incomingBubble,
          isOutgoing && isDark && styles.outgoingBubbleDark,
          !isOutgoing && isDark && styles.incomingBubbleDark,
        ]}
      >
        {showSenderName && (
          <Text style={[styles.senderName, isDark && styles.senderNameDark]}>
            {senderName}
          </Text>
        )}
        <Text
          style={[
            styles.messageText,
            isOutgoing ? styles.outgoingText : styles.incomingText,
            isDark && !isOutgoing && styles.incomingTextDark,
          ]}
        >
          {message.message}
        </Text>
        <View style={styles.metaContainer}>
          <Text style={[styles.timestamp, isOutgoing && styles.outgoingTimestamp]}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {statusText && (
            <Text
              style={[
                styles.status,
                message.status === 'failed' && styles.statusFailed,
                message.status === 'queued' && styles.statusQueued,
              ]}
            >
              {statusText}
            </Text>
          )}
        </View>
        {showRetryButton && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => onRetry(message)}
          >
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 12,
  },
  outgoingContainer: {
    alignItems: 'flex-end',
  },
  incomingContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  senderNameDark: {
    color: '#0A84FF',
  },
  outgoingBubble: {
    backgroundColor: '#007AFF',
  },
  outgoingBubbleDark: {
    backgroundColor: '#0A84FF',
  },
  incomingBubble: {
    backgroundColor: '#E5E5EA',
  },
  incomingBubbleDark: {
    backgroundColor: '#3A3A3C',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  outgoingText: {
    color: '#FFFFFF',
  },
  incomingText: {
    color: '#000000',
  },
  incomingTextDark: {
    color: '#FFFFFF',
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  timestamp: {
    fontSize: 11,
    color: 'rgba(0, 0, 0, 0.45)',
  },
  outgoingTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  status: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statusFailed: {
    color: '#FF3B30',
  },
  statusQueued: {
    color: '#FF9500',
  },
  retryButton: {
    marginTop: 6,
    paddingVertical: 4,
  },
  retryText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    textDecorationLine: 'underline',
  },
});

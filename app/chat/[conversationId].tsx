import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Text,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useMessagesStore } from '@/stores';
import { storageService } from '@/services/storageService';
import { messageService } from '@/services/messageService';
import { MessageBubble } from '@/components/MessageBubble';
import { MessageInput } from '@/components/MessageInput';
import { ScrollToBottomButton } from '@/components/ScrollToBottomButton';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { v4 as uuidv4 } from 'uuid';
import type { Message } from '@/types/message';
import type { ApiError } from '@/types/api';

export default function ChatScreen() {
  const params = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { messages, getMessagesByConversation, addMessage, resetUnreadCount } = useMessagesStore();
  const [conversation, setConversation] = useState<any>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const conversationMessages = getMessagesByConversation(params.conversationId);

  useEffect(() => {
    loadConversation();
    loadMessages();

    // Reset unread count when viewing conversation
    resetUnreadCount(params.conversationId);
  }, [params.conversationId]);

  const loadConversation = async () => {
    try {
      const conv = await storageService.getConversation(params.conversationId);
      setConversation(conv);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const dbMessages = await storageService.getMessagesByConversation(
        params.conversationId
      );
      // Messages are already in the store, but we can reload them if needed
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!conversation) return;

    const now = Date.now();
    const messageId = uuidv4();
    const message: Message = {
      id: messageId,
      conversationId: params.conversationId,
      phoneNumber: conversation.phoneNumber,
      content,
      timestamp: now,
      direction: 'outgoing',
      status: 'sent',
      createdAt: now,
    };

    try {
      // Add to store (optimistic UI)
      addMessage(message);

      // Save to database
      await storageService.saveMessage(message);

      // Update conversation
      await storageService.updateConversation(params.conversationId, {
        lastMessagePreview: content,
        lastMessageTimestamp: now,
      });

      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Send via messageService
      try {
        const response = await messageService.sendMessage(
          conversation.phoneNumber,
          content,
          now
        );

        console.log('Message sent successfully:', response);
      } catch (apiError) {
        // Handle send failure
        const error = apiError as ApiError;
        console.error('Failed to send message via API:', error.message);

        // Update message status to failed
        const updatedMessage = { ...message, status: 'failed' as const };
        useMessagesStore.getState().updateMessage(messageId, { status: 'failed' });
        await storageService.updateMessageStatus(messageId, 'failed');

        // TODO: Phase 4 - Queue message for retry
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtBottom =
      contentOffset.y >= contentSize.height - layoutMeasurement.height - 50;
    setShowScrollButton(!isAtBottom && conversationMessages.length > 0);
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble message={item} />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
        No messages yet
      </Text>
      <Text style={[styles.emptySubtext, isDark && styles.emptySubtextDark]}>
        Send a message to start the conversation
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: conversation?.phoneNumber || 'Chat',
          headerBackTitle: 'Back',
        }}
      />

      <View style={[styles.chatContainer, isDark && styles.chatContainerDark]}>
        <FlatList
          ref={flatListRef}
          data={conversationMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={
            conversationMessages.length === 0
              ? styles.emptyListContainer
              : styles.listContent
          }
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={() => {
            // Auto-scroll to bottom when new messages arrive
            if (!showScrollButton) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
        />

        <ScrollToBottomButton
          visible={showScrollButton}
          onPress={scrollToBottom}
        />
      </View>

      <MessageInput onSend={handleSendMessage} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  chatContainerDark: {
    backgroundColor: '#000000',
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyListContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emptyTextDark: {
    color: '#FFFFFF',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  emptySubtextDark: {
    color: '#8E8E93',
  },
});

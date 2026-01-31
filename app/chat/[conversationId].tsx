import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Text,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useMessagesStore } from '@/stores';
import { storageService } from '@/services/storageService';
import { messageService } from '@/services/messageService';
import { queueService } from '@/services/queueService';
import { MessageBubble } from '@/components/MessageBubble';
import { MessageInput } from '@/components/MessageInput';
import { ScrollToBottomButton } from '@/components/ScrollToBottomButton';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatPhoneNumber } from '@/utils/phoneNumber';
import type { Message, SenderType } from '@/types/message';
import type { ApiError } from '@/types/api';
import { SenderTypeEnum } from '@/utils/senderTypeEnum';

const formatSender = (sender: string, senderType: SenderType): string => {
  return senderType === SenderTypeEnum.Phone ? formatPhoneNumber(sender) : sender;
};

export default function ChatScreen() {
  const params = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { addMessage, resetUnreadCount, setActiveConversation, conversations } = useMessagesStore();

  // Subscribe directly to the messages array
  const allMessages = useMessagesStore((state) => state.messages);

  // Filter and sort messages for this conversation using useMemo
  const conversationMessages = useMemo(() => {
    return allMessages
      .filter((msg) => msg.conversationId === params.conversationId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [allMessages, params.conversationId]);

  const [conversation, setConversation] = useState<any>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Set this as the active conversation
    setActiveConversation(params.conversationId);

    loadConversation();
    loadMessages();

    // Reset unread count when viewing conversation
    resetUnreadCount(params.conversationId);

    // Clear active conversation when unmounting
    return () => {
      setActiveConversation(null);
    };
  }, [params.conversationId]);

  // Handle conversation deletion while viewing
  useEffect(() => {
    // Check if conversation still exists
    const conversationExists = conversations.some(c => c.id === params.conversationId);

    if (!conversationExists && conversation !== null) {
      // Conversation was deleted, navigate back
      console.log('[ChatScreen] Conversation was deleted, navigating back');
      router.back();
    }
  }, [conversations, params.conversationId, conversation, router]);

  const loadConversation = async () => {
    try {
      // Try to load from database first
      const conv = await storageService.getConversation(params.conversationId);
      if (conv) {
        setConversation(conv);
      } else {
        // If not in database, check Zustand store (might be temp conversation)
        const storeConv = useMessagesStore.getState().conversations.find(
          c => c.id === params.conversationId
        );
        if (storeConv) {
          setConversation(storeConv);
        }
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const dbMessages = await storageService.getMessagesByConversation(
        params.conversationId
      );

      // Add any messages from DB that aren't in the store yet
      const storeMessages = useMessagesStore.getState().messages;
      const storeMessageIds = new Set(storeMessages.map(m => m.id));

      dbMessages.forEach(dbMsg => {
        if (!storeMessageIds.has(dbMsg.id)) {
          useMessagesStore.getState().addMessage(dbMsg);
        }
      });
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSendMessage = async (messageContent: string) => {
    if (!conversation) return;

    setIsSending(true);
    const now = Date.now();
    const tempMessageId = -Date.now();
    const currentConversationId = params.conversationId;

    // Create optimistic message with current conversationId (might be temp)
    const optimisticMessage: Message = {
      id: tempMessageId,
      conversationId: currentConversationId,
      sender: conversation.sender,
      senderType: conversation.senderType,
      message: messageContent,
      timestamp: now,
      direction: 'outgoing',
      status: 'sent',
      createdAt: now,
    };

    try {
      // Add to store immediately (optimistic UI)
      addMessage(optimisticMessage);

      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Send via messageService
      const response = await messageService.sendMessage(
        conversation.sender,
        conversation.senderType,
        messageContent,
        now
      );

      console.log('[ChatScreen] Message sent successfully:', response);

      // Get real conversationId from server
      const realConversationId = response.conversationId;

      // Check if we need to update conversationId (temp → real)
      if (realConversationId !== currentConversationId) {
        console.log('[ChatScreen] ConversationId changed:', {
          old: currentConversationId,
          new: realConversationId
        });

        // Save conversation to database with real ID
        await storageService.saveConversation({
          id: realConversationId,
          sender: conversation.sender,
          senderType: conversation.senderType,
          contactName: conversation.contactName,
          lastMessagePreview: messageContent,
          lastMessageTimestamp: now,
          unreadCount: 0,
          createdAt: conversation.createdAt || now,
          updatedAt: now,
        });

        // Save message to database with real conversationId
        const realMessageId = await storageService.saveMessage({
          conversationId: realConversationId,
          sender: conversation.sender,
          senderType: conversation.senderType,
          message: messageContent,
          timestamp: now,
          direction: 'outgoing',
          status: 'delivered',
          createdAt: now,
        });

        // Update store: conversationId (temp → real)
        useMessagesStore.getState().updateConversationId(
          currentConversationId,
          realConversationId
        );

        // Update optimistic message with real IDs
        useMessagesStore.getState().updateMessage(tempMessageId, {
          id: realMessageId,
          conversationId: realConversationId,
          status: 'delivered'
        });

        // Navigate to real conversationId (replace URL)
        router.replace(`/chat/${realConversationId}`);

      } else {
        // Normal flow: conversation already has real ID
        const realMessageId = await storageService.saveMessage({
          conversationId: currentConversationId,
          sender: conversation.sender,
          senderType: conversation.senderType,
          message: messageContent,
          timestamp: now,
          direction: 'outgoing',
          status: 'delivered',
          createdAt: now,
        });

        // Update conversation
        await storageService.updateConversation(currentConversationId, {
          lastMessagePreview: messageContent,
          lastMessageTimestamp: now,
        });

        // Update optimistic message with real ID and status
        useMessagesStore.getState().updateMessage(tempMessageId, {
          id: realMessageId,
          status: 'delivered'
        });
      }

      setIsSending(false);
    } catch (apiError) {
      setIsSending(false);
      // Handle send failure
      const error = apiError as ApiError;
      console.error('[ChatScreen] Failed to send message via API:', error.message);

      // Show user-friendly error message for common errors
      let errorTitle = 'Message Failed';
      let errorMessage = 'Your message will be retried automatically when connection is restored.';

      if (error.status === 401 || error.status === 403) {
        errorTitle = 'Authentication Error';
        errorMessage = 'Please check your API key in Settings and try again.';
      } else if (error.status === 429) {
        errorTitle = 'Rate Limited';
        errorMessage = 'Too many messages sent. Please wait a moment and try again.';
      } else if (error.status === 0) {
        errorTitle = 'No Connection';
        errorMessage = 'Your message is queued and will send when you\'re back online.';
      }

      // Only save to database and queue if conversation already has real ID
      const conversationExists = await storageService.getConversation(currentConversationId);
      if (conversationExists) {
        const realMessageId = await storageService.saveMessage({
          conversationId: currentConversationId,
          sender: conversation.sender,
          senderType: conversation.senderType,
          message: messageContent,
          timestamp: now,
          direction: 'outgoing',
          status: 'queued',
          createdAt: now,
        });

        // Update with real ID and queued status
        useMessagesStore.getState().updateMessage(tempMessageId, {
          id: realMessageId,
          status: 'queued'
        });

        // Queue message for retry
        await queueService.queueMessage(
          realMessageId,
          conversation.sender,
          conversation.senderType,
          messageContent,
          now,
          error.message
        );

        // Only show alert for non-network errors (network errors will auto-retry)
        if (error.status !== 0) {
          Alert.alert(errorTitle, errorMessage, [{ text: 'OK' }]);
        }
      } else {
        // Temp conversation - just mark as failed
        useMessagesStore.getState().updateMessage(tempMessageId, { status: 'failed' });
        Alert.alert(errorTitle, 'Failed to send message. Please try again.', [{ text: 'OK' }]);
      }
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

  const handleRetryMessage = useCallback(async (message: Message) => {
    console.log('[ChatScreen] Manual retry requested for message:', message.id);
    try {
      await queueService.retryFailedMessage(message.id, message);
    } catch (error) {
      console.error('[ChatScreen] Failed to retry message:', error);
      Alert.alert(
        'Retry Failed',
        'Could not retry sending this message. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  const renderMessage = useCallback(({ item }: { item: Message }) => (
    <MessageBubble message={item} onRetry={handleRetryMessage} />
  ), [handleRetryMessage]);

  const keyExtractor = useCallback((item: Message) => item.id.toString(), []);

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

  // Determine header title: contact name if available, otherwise formatted sender
  const headerTitle = conversation
    ? conversation.contactName || formatSender(conversation.sender, conversation.senderType)
    : 'Chat';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: headerTitle,
          headerBackTitle: 'Back',
        }}
      />

      <View style={[styles.chatContainer, isDark && styles.chatContainerDark]}>
        <FlatList
          ref={flatListRef}
          data={conversationMessages}
          keyExtractor={keyExtractor}
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
          removeClippedSubviews={true}
          maxToRenderPerBatch={20}
          updateCellsBatchingPeriod={50}
          initialNumToRender={20}
          windowSize={10}
        />

        <ScrollToBottomButton
          visible={showScrollButton}
          onPress={scrollToBottom}
        />
      </View>

      <MessageInput onSend={handleSendMessage} isSending={isSending} />
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

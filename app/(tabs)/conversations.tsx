import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, Text, RefreshControl, Pressable, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMessagesStore, useConnectionStore } from '@/stores';
import { storageService } from '@/services/storageService';
import { conversationService } from '@/services/conversationService';
import { SwipeableConversationItem } from '@/components/SwipeableConversationItem';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Conversation } from '@/types/message';

export default function ConversationsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { conversations, loadConversations } = useMessagesStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadConversationsFromDB();
  }, []);

  const loadConversationsFromDB = async () => {
    try {
      const dbConversations = await storageService.getAllConversations();
      loadConversations(dbConversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadConversationsFromDB();
    setRefreshing(false);
  };

  const handleConversationPress = useCallback(async (conversationId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/chat/[conversationId]',
      params: { conversationId },
    });
  }, [router]);

  const handleNewConversation = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/conversation/new');
  }, [router]);

  const handleDeleteConversation = useCallback(async (conversationId: string) => {
    try {
      // Get conversation stats for confirmation message
      const stats = await conversationService.getConversationStats(conversationId);

      // Show confirmation dialog
      Alert.alert(
        'Delete Conversation?',
        stats.messageCount > 0
          ? `This will permanently delete ${stats.messageCount} message${stats.messageCount === 1 ? '' : 's'}. This cannot be undone.`
          : 'This will permanently delete this conversation. This cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: async () => {
              await Haptics.selectionAsync();
            },
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                // Success haptic
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Delete the conversation
                await conversationService.deleteConversation(conversationId);

                console.log('[ConversationsScreen] Successfully deleted conversation:', conversationId);
              } catch (error) {
                console.error('[ConversationsScreen] Failed to delete conversation:', error);

                // Error haptic
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

                Alert.alert(
                  'Delete Failed',
                  'Could not delete the conversation. Please try again.',
                  [{ text: 'OK' }]
                );
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('[ConversationsScreen] Failed to get conversation stats:', error);
    }
  }, []);

  const keyExtractor = useCallback((item: Conversation) => item.id, []);

  const renderItem = useCallback(({ item }: { item: Conversation }) => (
    <SwipeableConversationItem
      conversation={item}
      onPress={() => handleConversationPress(item.id)}
      onDelete={() => handleDeleteConversation(item.id)}
    />
  ), [handleConversationPress, handleDeleteConversation]);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
        No conversations yet
      </Text>
      <Text style={[styles.emptySubtext, isDark && styles.emptySubtextDark]}>
        Messages will appear here when you start a conversation
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <ConnectionBanner />
      <FlatList
        data={conversations}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={
          conversations.length === 0 ? styles.emptyListContainer : undefined
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
      />

      {/* Floating Action Button */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          isDark && styles.fabDark,
          pressed && styles.fabPressed,
        ]}
        onPress={handleNewConversation}
      >
        <Text style={styles.fabIcon}>✎</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabDark: {
    backgroundColor: '#0A84FF',
  },
  fabPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  fabIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

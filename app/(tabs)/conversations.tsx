import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Text, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useMessagesStore, useConnectionStore } from '@/stores';
import { storageService } from '@/services/storageService';
import { ConversationItem } from '@/components/ConversationItem';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { useColorScheme } from '@/hooks/use-color-scheme';

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

  const handleConversationPress = (conversationId: string) => {
    router.push({
      pathname: '/chat/[conversationId]',
      params: { conversationId },
    });
  };

  const handleNewConversation = () => {
    router.push('/conversation/new');
  };

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
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConversationItem
            conversation={item}
            onPress={() => handleConversationPress(item.id)}
          />
        )}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={
          conversations.length === 0 ? styles.emptyListContainer : undefined
        }
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

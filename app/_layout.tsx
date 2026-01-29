import 'react-native-get-random-values';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { initializeDatabase } from '@/utils/database';
import { signalRService } from '@/services/signalRService';
import { storageService } from '@/services/storageService';
import { queueService } from '@/services/queueService';
import { useAuthStore, useConnectionStore, useMessagesStore } from '@/stores';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initialize() {
      try {
        console.log('Initializing database...');
        await initializeDatabase();
        console.log('Database initialized successfully');

        // Load initial data from database
        await loadInitialData();

        // Set up network monitoring
        setupNetworkMonitoring();

        // Connect to SignalR if API key exists
        const { apiKey } = useAuthStore.getState();
        if (apiKey) {
          console.log('API key found, connecting to SignalR...');
          await signalRService.connect();
        }

        // Set up app state monitoring (background/foreground)
        setupAppStateMonitoring();

        setIsReady(true);
      } catch (err) {
        console.error('Failed to initialize database:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }

    initialize();

    // Cleanup on unmount
    return () => {
      signalRService.disconnect();
    };
  }, []);

  async function loadInitialData() {
    try {
      const [conversations, messages] = await Promise.all([
        storageService.getAllConversations(),
        storageService.getAllMessages(),
      ]);

      useMessagesStore.getState().loadConversations(conversations);
      useMessagesStore.getState().loadMessages(messages);

      console.log(`Loaded ${conversations.length} conversations and ${messages.length} messages`);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }

  function setupNetworkMonitoring() {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = state.isConnected && state.isInternetReachable !== false;
      console.log(`Network state changed: ${isOnline ? 'online' : 'offline'}`);

      useConnectionStore.getState().setOnline(isOnline);

      // Reconnect SignalR when coming back online
      if (isOnline && !signalRService.isConnected()) {
        const { apiKey } = useAuthStore.getState();
        if (apiKey) {
          console.log('Network restored, reconnecting to SignalR...');
          signalRService.connect();
        }
      }

      // Process message queue when coming back online
      if (isOnline) {
        console.log('Network restored, processing message queue...');
        queueService.processQueue();
      }
    });

    return unsubscribe;
  }

  function setupAppStateMonitoring() {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      console.log(`App state changed to: ${nextAppState}`);

      if (nextAppState === 'active') {
        // App came to foreground, ensure SignalR is connected
        const { apiKey } = useAuthStore.getState();
        if (apiKey && !signalRService.isConnected()) {
          console.log('App foregrounded, reconnecting to SignalR...');
          signalRService.connect();
        }

        // Process message queue when app comes to foreground
        console.log('App foregrounded, processing message queue...');
        queueService.processQueue();
      }
      // Note: We maintain SignalR connection when backgrounded for message reception
    });

    return () => subscription.remove();
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error initializing app</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Initializing...</Text>
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 10,
  },
  errorDetail: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

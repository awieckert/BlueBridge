import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { useAuthStore, useConnectionStore, useMessagesStore } from '@/stores';
import { storageService } from '@/services/storageService';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { apiKey, serverUrl, setApiKey, setServerUrl } = useAuthStore();
  const { connectionStatus, isOnline } = useConnectionStore();
  const { clearAll } = useMessagesStore();

  const [apiKeyInput, setApiKeyInput] = useState(apiKey || '');
  const [serverUrlInput, setServerUrlInput] = useState(serverUrl);

  useEffect(() => {
    if (apiKey) {
      setApiKeyInput(apiKey);
    }
  }, [apiKey]);

  const handleSaveApiKey = () => {
    const trimmedKey = apiKeyInput.trim();
    if (trimmedKey) {
      setApiKey(trimmedKey);
      Alert.alert('Success', 'API key saved');
    } else {
      setApiKey(null);
      Alert.alert('Success', 'API key cleared');
    }
  };

  const handleSaveServerUrl = () => {
    const trimmedUrl = serverUrlInput.trim();
    if (trimmedUrl) {
      setServerUrl(trimmedUrl);
      Alert.alert('Success', 'Server URL saved');
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Conversation History',
      'This will delete all messages and conversations. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await storageService.clearAllData();
              clearAll();
              Alert.alert('Success', 'All conversations cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear conversations');
              console.error('Clear history error:', error);
            }
          },
        },
      ]
    );
  };

  const getConnectionStatusText = () => {
    if (!isOnline) return 'Offline';
    if (connectionStatus === 'connected') return 'Connected';
    if (connectionStatus === 'reconnecting') return 'Reconnecting...';
    return 'Disconnected';
  };

  const getConnectionStatusColor = () => {
    if (!isOnline) return '#FF9500';
    if (connectionStatus === 'connected') return '#34C759';
    if (connectionStatus === 'reconnecting') return '#FF9500';
    return '#FF3B30';
  };

  return (
    <ScrollView
      style={[styles.container, isDark && styles.containerDark]}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
          Connection
        </Text>

        <View style={styles.statusContainer}>
          <Text style={[styles.label, isDark && styles.labelDark]}>Status</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getConnectionStatusColor() },
              ]}
            />
            <Text style={[styles.statusText, isDark && styles.statusTextDark]}>
              {getConnectionStatusText()}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
          Configuration
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, isDark && styles.labelDark]}>API Key</Text>
          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            value={apiKeyInput}
            onChangeText={setApiKeyInput}
            placeholder="Enter your BlueBridge API key"
            placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleSaveApiKey}
          >
            <Text style={styles.buttonText}>Save API Key</Text>
          </Pressable>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, isDark && styles.labelDark]}>
            Server URL
          </Text>
          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            value={serverUrlInput}
            onChangeText={setServerUrlInput}
            placeholder="http://192.168.1.50:5067"
            placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleSaveServerUrl}
          >
            <Text style={styles.buttonText}>Save Server URL</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
          Data
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.buttonDanger,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleClearHistory}
        >
          <Text style={[styles.buttonText, styles.buttonDangerText]}>
            Clear Conversation History
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
          About
        </Text>

        <View style={styles.infoRow}>
          <Text style={[styles.label, isDark && styles.labelDark]}>
            App Version
          </Text>
          <Text style={[styles.value, isDark && styles.valueDark]}>
            {Constants.expoConfig?.version || '1.0.0'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={[styles.label, isDark && styles.labelDark]}>Platform</Text>
          <Text style={[styles.value, isDark && styles.valueDark]}>
            {Platform.OS} {Platform.Version}
          </Text>
        </View>
      </View>
    </ScrollView>
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
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  labelDark: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
    marginBottom: 8,
  },
  inputDark: {
    backgroundColor: '#1C1C1E',
    borderColor: '#38383A',
    color: '#FFFFFF',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDanger: {
    backgroundColor: '#FF3B30',
  },
  buttonDangerText: {
    color: '#FFFFFF',
  },
  statusContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#000000',
  },
  statusTextDark: {
    color: '#FFFFFF',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    color: '#8E8E93',
  },
  valueDark: {
    color: '#8E8E93',
  },
});

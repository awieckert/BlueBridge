import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Text, Platform, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Config } from '@/utils/constants';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isSending?: boolean;
}

export function MessageInput({ onSend, disabled = false, isSending = false }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0 || trimmedMessage.length > Config.MAX_MESSAGE_LENGTH) {
      // Haptic feedback for invalid send
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    // Haptic feedback for successful send
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    onSend(trimmedMessage);
    setMessage('');
  };

  const canSend = message.trim().length > 0 && message.trim().length <= Config.MAX_MESSAGE_LENGTH && !disabled && !isSending;
  const isExceedingLimit = message.length > Config.MAX_MESSAGE_LENGTH;

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            isDark && styles.inputDark,
            isExceedingLimit && styles.inputError,
          ]}
          value={message}
          onChangeText={setMessage}
          placeholder="Message"
          placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
          multiline
          maxLength={Config.MAX_MESSAGE_LENGTH + 100} // Allow typing past limit to show error
          editable={!disabled && !isSending}
        />
        {isSending ? (
          <View style={styles.sendButton}>
            <ActivityIndicator size="small" color="#007AFF" />
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              !canSend && styles.sendButtonDisabled,
              pressed && canSend && styles.sendButtonPressed,
            ]}
            onPress={handleSend}
            disabled={!canSend}
          >
            <Text
              style={[
                styles.sendButtonText,
                !canSend && styles.sendButtonTextDisabled,
              ]}
            >
              Send
            </Text>
          </Pressable>
        )}
      </View>
      {isExceedingLimit && (
        <Text style={styles.charCountError}>
          {message.length}/{Config.MAX_MESSAGE_LENGTH} (exceeds limit)
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    paddingBottom: Platform.OS === 'ios' ? 34 : 8,
  },
  containerDark: {
    backgroundColor: '#000000',
    borderTopColor: '#38383A',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    backgroundColor: '#F2F2F7',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 16,
    color: '#000000',
  },
  inputDark: {
    backgroundColor: '#1C1C1E',
    color: '#FFFFFF',
  },
  sendButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 36,
  },
  sendButtonPressed: {
    opacity: 0.6,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sendButtonTextDisabled: {
    color: '#8E8E93',
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  charCountError: {
    fontSize: 12,
    color: '#FF3B30',
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
});

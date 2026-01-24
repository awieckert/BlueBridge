import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Text, Platform } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Config } from '@/utils/constants';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0 || trimmedMessage.length > Config.MAX_MESSAGE_LENGTH) {
      return;
    }

    onSend(trimmedMessage);
    setMessage('');
  };

  const canSend = message.trim().length > 0 && message.trim().length <= Config.MAX_MESSAGE_LENGTH && !disabled;

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            isDark && styles.inputDark,
          ]}
          value={message}
          onChangeText={setMessage}
          placeholder="Message"
          placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
          multiline
          maxLength={Config.MAX_MESSAGE_LENGTH}
          editable={!disabled}
        />
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
      </View>
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
});

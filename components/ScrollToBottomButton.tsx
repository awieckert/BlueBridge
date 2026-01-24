import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ScrollToBottomButtonProps {
  onPress: () => void;
  visible: boolean;
}

export function ScrollToBottomButton({ onPress, visible }: ScrollToBottomButtonProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!visible) {
    return null;
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        isDark && styles.buttonDark,
        pressed && styles.buttonPressed,
      ]}
      onPress={onPress}
    >
      <Ionicons name="chevron-down" size={24} color={isDark ? '#FFFFFF' : '#007AFF'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonDark: {
    backgroundColor: '#1C1C1E',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});

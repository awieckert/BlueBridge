import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ConversationItem } from './ConversationItem';
import { Conversation } from '@/types/message';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface SwipeableConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
  onDelete: () => void;
}

export function SwipeableConversationItem({
  conversation,
  onPress,
  onDelete,
}: SwipeableConversationItemProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.rightActionsContainer}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <RectButton
            style={[styles.deleteButton, isDark && styles.deleteButtonDark]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
            <Text style={styles.deleteText}>Delete</Text>
          </RectButton>
        </Animated.View>
      </View>
    );
  };

  const handleDelete = async () => {
    // Haptic feedback
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    // Close the swipeable
    swipeableRef.current?.close();

    // Call the delete handler (which will show confirmation)
    onDelete();
  };

  const handleSwipeableOpen = async () => {
    // Light haptic when swipe reveals delete button
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeableOpen}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
    >
      <ConversationItem conversation={conversation} onPress={onPress} />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  rightActionsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    paddingHorizontal: 12,
  },
  deleteButtonDark: {
    backgroundColor: '#FF453A',
  },
  deleteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});

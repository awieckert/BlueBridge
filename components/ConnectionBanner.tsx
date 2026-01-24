import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useConnectionStore } from '@/stores';

export function ConnectionBanner() {
  const { connectionStatus, isOnline } = useConnectionStore();

  if (connectionStatus === 'connected') {
    return null;
  }

  const getBannerConfig = () => {
    if (!isOnline) {
      return {
        text: 'No Internet Connection',
        color: '#FF9500',
      };
    }

    if (connectionStatus === 'reconnecting') {
      return {
        text: 'Reconnecting...',
        color: '#FF9500',
      };
    }

    return {
      text: 'Disconnected',
      color: '#FF3B30',
    };
  };

  const config = getBannerConfig();

  return (
    <View style={[styles.banner, { backgroundColor: config.color }]}>
      <Text style={styles.text}>{config.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

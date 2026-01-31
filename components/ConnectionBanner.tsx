import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
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
        showSpinner: false,
      };
    }

    if (connectionStatus === 'connecting') {
      return {
        text: 'Connecting...',
        color: '#007AFF',
        showSpinner: true,
      };
    }

    if (connectionStatus === 'reconnecting') {
      return {
        text: 'Reconnecting...',
        color: '#FF9500',
        showSpinner: true,
      };
    }

    return {
      text: 'Disconnected',
      color: '#FF3B30',
      showSpinner: false,
    };
  };

  const config = getBannerConfig();

  return (
    <View style={[styles.banner, { backgroundColor: config.color }]}>
      {config.showSpinner && (
        <ActivityIndicator size="small" color="#FFFFFF" style={styles.spinner} />
      )}
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
    flexDirection: 'row',
  },
  spinner: {
    marginRight: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

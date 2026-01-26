#!/bin/bash

# Setup ADB reverse port forwarding and start Expo
# This allows the Android emulator to connect to the Metro bundler

echo "Setting up ADB reverse port forwarding..."
adb reverse tcp:8081 tcp:8081

echo "Starting Expo development server..."
npx expo start --clear

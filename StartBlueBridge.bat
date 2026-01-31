@echo off
REM Setup ADB reverse port forwarding and start Expo
REM This allows the Android emulator to connect to the Metro bundler

echo Setting up ADB reverse port forwarding...
adb reverse tcp:8081 tcp:8081

if %errorlevel% neq 0 (
    echo Warning: ADB reverse command failed. Make sure emulator is running.
    pause
)

echo Starting Expo development server...
npx expo start --clear

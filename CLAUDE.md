# BlueBridge Mobile Client

## Overview

BlueBridge is a React Native messaging application that enables Android/iOS users to send and receive iMessages through the BlueBridge-Relay backend infrastructure. Built with Expo, it provides real-time messaging with comprehensive offline support, automatic retry queue, local persistence, and device contact integration.

**Current Status:** MVP Complete - Full send/receive functionality with offline queue, contact integration, and retry mechanisms implemented.

## Tech Stack

- **Framework:** Expo ~54 / React Native 0.81 / TypeScript 5.9
- **State:** Zustand (reactive stores)
- **Database:** SQLite (expo-sqlite)
- **Real-time:** SignalR (@microsoft/signalr)
- **Navigation:** Expo Router (file-based)
- **Storage:** AsyncStorage (config persistence)

## Architecture

```
UI Layer (Screens/Components)
    ↓
State Layer (Zustand Stores)
    ↓
Service Layer (SignalR, HTTP, Storage, Contacts)
    ↓
Persistence Layer (SQLite, AsyncStorage)
    ↓
External Services (BlueBridge-Relay API, Device Contacts)
```

## Key Directories

```
app/                    # Expo Router screens (file-based routing)
  (tabs)/              # Tab navigation (conversations, settings)
  chat/[conversationId].tsx  # Chat screen
  conversation/new.tsx  # New conversation picker

components/            # Reusable UI components
  MessageBubble.tsx    # Message display with status
  ConversationItem.tsx # Conversation list item
  ConnectionBanner.tsx # Connection status indicator

stores/               # Zustand state management
  messagesStore.ts    # Messages & conversations
  connectionStore.ts  # Connection status
  authStore.ts        # API key (persisted)
  contactStore.ts     # Device contacts

services/             # Business logic
  signalRService.ts   # Real-time message receiving
  messageService.ts   # HTTP message sending
  storageService.ts   # SQLite CRUD operations
  contactService.ts   # Device contact integration

utils/
  database.ts         # SQLite schema initialization
  phoneNumber.ts      # E.164 phone number validation
  constants.ts        # API URLs, retry config
```

## Implemented Features

### Core Messaging
- **1-to-1 Conversations**: Full send/receive with real-time updates
- **Optimistic UI**: Messages appear immediately, status updated on server response
- **Message Status Tracking**: Visual badges for Sent, Delivered, Queued, Failed
- **Manual Retry**: Tap failed messages to retry immediately
- **Character Limit**: 1000 characters with visual feedback (red border + counter)
- **Conversation Search**: Filter across existing conversations and device contacts
- **Swipe-to-Delete**: Gesture-based conversation deletion with confirmation

### Offline Support (IMPLEMENTED)
- **Automatic Queueing**: Failed messages auto-queue when network is unavailable
- **Exponential Backoff Retry**: 1s → 2s → 4s → 8s → 16s (max 5 attempts)
- **Network Monitoring**: Auto-detects network changes via NetInfo
- **Auto-Process on Connect**: Queue processes when network restores
- **Queue Persistence**: Failed messages persist across app restarts
- **Foreground Processing**: Queue processes when app returns to foreground

### Contact Integration
- **Device Contact Access**: Permission-based contact loading via expo-contacts
- **Contact Search**: Real-time search with debouncing
- **Name Enrichment**: Auto-populates contact names in conversations
- **Multiple Methods**: Picker modal when contact has both phone & email
- **Manual Entry**: Direct phone/email input with validation
- **Flexible Phone Matching**: Handles various phone number formats

### Real-time Connection
- **SignalR Hub**: WebSocket connection to `/hubs/messages`
- **Auto-Reconnection**: Exponential backoff (0s → 2s → 10s → 30s → 60s)
- **Keep-alive Pings**: 15-second intervals with 60s server timeout
- **Connection States**: Connected, Connecting, Reconnecting, Disconnected
- **Status Banner**: Prominent visual indicator with color coding
- **Batch Message Sync**: Receives queued messages on reconnect

### UI/UX Features
- **Light/Dark Mode**: System-aware theming
- **Haptic Feedback**: Touch responses for actions (light/medium/warning/success)
- **Animated Scroll Button**: Appears when scrolled up, spring animation
- **Smart Timestamps**: Relative dates (time today, "Yesterday", weekday, full date)
- **Empty States**: Contextual messaging for empty lists
- **Avatar Generation**: First letter of contact name in colored circle
- **Loading Indicators**: Throughout data fetch operations
- **Keyboard Avoidance**: Platform-specific handling (iOS padding)

### Settings & Configuration
- **API Key Management**: Secure entry with masked input
- **Server URL Config**: Dynamic endpoint selection (default: http://192.168.1.50:5067)
- **Connection Status Display**: Real-time indicator with reconnection option
- **Nuclear Data Clear**: Wipe all conversations and messages
- **App Info Display**: Version and platform details

## Core Data Flow

### Sending Messages (Success Path)

```
1. User Input → Create temp message with 'sent' status
2. Add to Store (optimistic UI update)
3. Save to SQLite
4. HTTP POST to /api/messages/send
5. Receive conversationId + messageId from server
6. Update message status to 'delivered'
7. If new conversation: Migrate temp ID to real conversationId
```

### Sending Messages (Offline Path)

```
1. User Input → Create temp message
2. HTTP POST fails (network error)
3. Update status to 'queued'
4. Add to queue table with retry metadata
5. queueService processes with exponential backoff
6. On success: Update to 'delivered', remove from queue
7. On max retries: Mark as 'failed', user can tap to retry
```

### Receiving Messages

```
SignalR 'ReceiveMessage' Event
  → Validate required fields
  → Check for existing conversation (create if needed)
  → Lookup contact name (if available)
  → Save to SQLite
  → Update conversations table (last_message, timestamp, unread_count)
  → Update Store (reactive)
  → UI Auto-updates
```

### Conversation ID Migration

New conversations start with temporary UUID, then migrate when server responds:

```
1. First message to new contact → Create conversation with temp UUID
2. Navigate to chat/[tempUUID]
3. Send message → Server returns real conversationId
4. Detect mismatch (tempId !== realId)
5. Create new conversation record with realId
6. Migrate all messages to realId
7. Delete temp conversation
8. Navigate to chat/[realId]
9. Update Store with real conversation
```

## Database Schema

**messages**: id (PK), conversation_id (FK, indexed), sender, sender_type (0=phone, 1=email), message, timestamp, direction, status, created_at

- Indexed on (conversation_id, timestamp) for fast conversation queries
- Status: 'sent' | 'queued' | 'failed' | 'delivered'
- Direction: 'incoming' | 'outgoing'

**conversations**: id (PK), sender, sender_type, contact_name, last_message_preview, last_message_timestamp, unread_count

- Unique constraint on (sender, sender_type) to prevent duplicates
- contact_name populated from device contacts when available

**queue**: id (PK, UUID), message_id (FK, CASCADE on delete), sender, sender_type, message, timestamp, retry_count, next_retry_at, error

- CASCADE delete: Queue entries removed when message is deleted
- next_retry_at: Unix timestamp for next retry attempt
- retry_count: Increments on each failure (max 5)
- error: Last error message for debugging

**Schema Migration**: Auto-migrates sender_type from TEXT ('phone'/'email') to INTEGER (0/1) on app startup for backward compatibility

## Key Patterns

1. **Service Layer Abstraction**: All external interactions (database, API, SignalR) abstracted into reusable services
2. **Optimistic UI**: Messages shown immediately, status updated on server response
3. **Auto-reconnection**: SignalR with exponential backoff (0s → 2s → 10s → 30s → 60s)
4. **Type Safety**: Strong TypeScript typing throughout (Message, Conversation, API types)
5. **Selective State Subscriptions**: Zustand allows components to subscribe only to needed state slices
6. **Contact Caching**: Device contacts cached with 5-minute TTL, lazy refresh
7. **Error Recovery**: Comprehensive HTTP status code mapping to user-friendly messages
8. **Concurrent Processing Prevention**: Queue uses `isProcessing` flag to prevent race conditions
9. **Message Deduplication**: Store validates message IDs to prevent duplicate display
10. **Cascading Deletes**: Database foreign keys ensure cleanup (delete conversation → deletes messages + queue entries)

## Error Handling

### HTTP Status Code Mapping
- **401/403**: "Authentication failed. Please check your API key in Settings."
- **429**: "Too many messages sent. Please wait a moment and try again."
- **500/503**: "Server error. Please try again later."
- **Network (0)**: Auto-queues message, triggers offline handling
- **Other**: Generic "Failed to send message. Please try again."

### Error Recovery Strategies
- **Network Errors**: Auto-queue → Retry with exponential backoff → Mark failed after max attempts
- **Auth Errors**: Show error banner, don't queue (requires user intervention)
- **Rate Limits**: Show error, don't retry automatically
- **Server Errors**: Queue and retry (may be temporary issue)

### User-Facing Error Feedback
- **Toast Notifications**: For transient errors (network, server)
- **Status Badges**: On messages (Queued, Failed with retry button)
- **Connection Banner**: Persistent indicator at top of conversation list
- **Haptic Feedback**: Error vibration on send failure

## App Lifecycle & State Management

### Initialization (app/_layout.tsx)
1. Initialize SQLite database with schema migration
2. Load conversations and recent messages into Zustand stores
3. Load API key from AsyncStorage (authStore persisted)
4. Setup NetInfo network monitoring listeners
5. Attempt SignalR connection (if API key configured)
6. Setup app state change listeners (background/foreground)

### Background/Foreground Handling
- **On Background**: SignalR connection maintained, can still receive messages
- **On Foreground**:
  - Ensure SignalR connected (reconnect if needed)
  - Process message queue (catch any missed retries)
  - Refresh connection status

### Network State Changes
- **Online Detected**:
  - Trigger SignalR reconnection attempt
  - Process message queue immediately
  - Update connectionStore.isOnline
- **Offline Detected**:
  - Update connectionStore.isOnline
  - Show disconnected banner
  - All new messages auto-queue

## Configuration

**File**: `utils/constants.ts`

**API Settings** (Configurable in Settings screen):
- **Default Server URL**: `http://192.168.1.50:5067` (development server)
- **API Endpoint**: `/api/messages/send`
- **SignalR Hub**: `/hubs/messages`
- **API Key**: User-provided, persisted in AsyncStorage via Zustand

**Message Queue Settings**:
- **Max Retry Attempts**: 5
- **Retry Delays**: [1000ms, 2000ms, 4000ms, 8000ms, 16000ms] (exponential backoff)
- **Queue Processing**: Triggers on network restore, app foreground, send failure

**Message Constraints**:
- **Max Message Length**: 1000 characters
- **Batch Size**: 50 messages (for pagination/loading)

**SignalR Settings**:
- **Ping Interval**: 15 seconds
- **Server Timeout**: 60 seconds
- **Reconnect Delays**: [0ms, 2000ms, 10000ms, 30000ms, 60000ms]

**Contact Settings**:
- **Cache TTL**: 5 minutes
- **Default Country Code**: US (for phone number parsing)

**UI Settings**:
- **Themes**: System-aware light/dark mode
- **Network Detection**: NetInfo monitors connectivity
- **Haptic Feedback**: Platform-specific (iOS/Android)

## Important Notes

### Phone Number Handling
- **Normalization**: All numbers normalized to E.164 format (+1234567890) via libphonenumber-js
- **Default Country**: US assumed for parsing
- **Validation**: Strict validation before sending
- **Display**: Formatted for UI, stored normalized in DB
- **Matching**: Flexible matching handles various input formats

### Type System
- **SenderType Enum**: Phone=0, Email=1 (matches BlueBridge-Relay backend schema)
- **Message Status Lifecycle**:
  - 'sent': Initial optimistic state when created
  - 'delivered': Server confirmed receipt (HTTP 200)
  - 'queued': Network failure, in retry queue
  - 'failed': Max retries exceeded, manual intervention needed
- **Message Direction**: 'incoming' (from SignalR) | 'outgoing' (user sent)

### State Management
- **Connection States**: 'connected' (green) | 'connecting' (blue) | 'reconnecting' (orange) | 'disconnected' (red)
- **Store Persistence**: authStore persisted to AsyncStorage, others in-memory only
- **Selective Subscriptions**: Components subscribe to specific state slices to minimize re-renders
- **Reactive Updates**: Store changes trigger immediate UI updates via Zustand

### Data Integrity
- **Conversation ID Migration**: Temp UUIDs replaced with server IDs on first message
- **Message Deduplication**: Prevents duplicate messages in store
- **Cascade Deletes**: Foreign keys ensure orphaned data cleanup
- **Unread Count**: Tracked per conversation, reset on chat view
- **Contact Name Sync**: Auto-populates from device contacts on message receive

### Security
- **API Key**: Stored in AsyncStorage, sent via BB-API-KEY header
- **E.164 Normalization**: Prevents phone number spoofing
- **SQL Injection**: Parameterized queries throughout
- **Contact Permissions**: Explicit user permission required

## Current Limitations & Future Features

### Implemented (MVP Complete)
- ✅ 1-to-1 messaging (send/receive)
- ✅ Offline message queue with automatic retry
- ✅ Device contact integration
- ✅ Real-time SignalR connection with auto-reconnect
- ✅ Message status tracking
- ✅ Conversation management (create, view, delete)
- ✅ Network state monitoring
- ✅ Light/dark mode theming

### Not Yet Implemented
- ❌ **Group Messaging**: Currently only supports 1-to-1 conversations
- ❌ **Message Deletion**: Conversation deletion works, but no per-message deletion
- ❌ **Push Notifications**: No background notification support
- ❌ **Read Receipts**: Only tracks delivery, not read status
- ❌ **Media Attachments**: Text-only messaging (no images/files)
- ❌ **Message Editing**: No edit functionality for sent messages
- ❌ **Search in Messages**: Can search conversations, but not message content
- ❌ **Typing Indicators**: No real-time typing status
- ❌ **Message Reactions**: No emoji reactions or likes
- ❌ **User Profiles**: Minimal user identity (just API key)

### Known Issues
- **ConversationId Migration**: Complex flow when creating new conversations (temp ID → real ID)
- **Debug Logging**: Some verbose console logs still present from MVP development
- **Hidden Screens**: `explore.tsx` and root `index.tsx` exist but are not exposed in navigation

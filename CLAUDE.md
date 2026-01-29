# BlueBridge Mobile Client

## Overview

BlueBridge is a React Native messaging application that enables Android/iOS users to send and receive iMessages through the BlueBridge-Relay backend infrastructure. Built with Expo, it provides real-time messaging with offline support and local persistence.

**Current Status:** Phase 3.5 (MVP Core Complete) - Basic send/receive functionality implemented but debugging needed

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

## Core Data Flow

### Sending Messages

```
User Input → Store (optimistic) → SQLite → HTTP POST → Status Update
```

### Receiving Messages

```
SignalR Event → SQLite → Store (reactive) → UI Auto-update
```

## Database Schema

**messages**: id, conversation_id, sender, sender_type (0=phone, 1=email), message, timestamp, direction, status

- Indexed on (conversation_id, timestamp)
- Status: 'sent' | 'queued' | 'failed' | 'delivered'

**conversations**: id, sender, sender_type, last_message, last_timestamp, unread_count

- Unique on (sender, sender_type)

**queue**: id, message_id, retry_count, error, next_retry_time

- For offline message retry (Phase 4)

## Key Patterns

1. **Service Layer Abstraction**: All external interactions (database, API, SignalR) abstracted into reusable services
2. **Optimistic UI**: Messages shown immediately, status updated on server response
3. **Auto-reconnection**: SignalR with exponential backoff (0s → 2s → 10s → 30s → 60s)
4. **Type Safety**: Strong TypeScript typing throughout (Message, Conversation, API types)
5. **Selective State Subscriptions**: Zustand allows components to subscribe only to needed state slices
6. **Contact Caching**: Device contacts cached with 5-minute TTL

## Configuration

- **API URL**: Stored in `utils/constants.ts` - `https://bluebridge-relay.onrender.com`
- **API Key**: User-configurable in Settings screen, persisted in AsyncStorage
- **Network Detection**: NetInfo monitors connectivity, triggers reconnection
- **Themes**: System-aware light/dark mode support

## Important Notes

- **Phone Numbers**: All numbers normalized to E.164 format via libphonenumber-js
- **SenderType Enum**: Phone=0, Email=1 (matches BlueBridge-Relay backend)
- **Message Status**: 'sent' (HTTP 200), 'queued' (offline), 'failed' (HTTP error)
- **Connection State**: Stored in connectionStore, displayed via ConnectionBanner
- **Database Init**: Runs on app launch in `app/_layout.tsx`

## Next Phase (Phase 4)

- Implement offline message queue with retry
- Add message deletion
- Group messaging support
- Push notifications

# BlueBridge React Native Messaging App - Implementation Plan

## Overview
Build a baseline Android messaging app using React Native (Expo) that integrates with BlueBridge-Relay infrastructure for sending/receiving iMessages. Focus on minimal viable functionality with offline support and clean architecture for future iteration.

## User Requirements
- **Core Features**: Send text messages, receive real-time messages, conversation view, message persistence
- **Offline Support**: Queue messages when offline with auto-retry
- **UI**: Minimal/functional (fast iteration)
- **Notifications**: Skip for baseline (future enhancement)

## Current Project State
- **Framework**: Expo SDK 54 + Expo Router (file-based routing)
- **Navigation**: Tab-based navigation already configured
- **Theming**: Light/dark mode system with themed components
- **Dependencies**: React Native 0.81.5, TypeScript 5.9.2, Reanimated 4.1.1
- **Missing**: State management, SignalR, SQLite, API integration

## Architecture

### Tech Stack Decisions

**State Management: Zustand**
- Lightweight with minimal boilerplate
- Excellent performance with selective subscriptions
- Perfect for frequently updating message data
- Simple API for quick iteration

**Data Persistence: expo-sqlite**
- Scalable for thousands of messages
- ACID transactions for data integrity
- Complex queries for conversation threading
- Future-ready for encryption (SQLCipher)

**Real-time Communication: @microsoft/signalr**
- React Native compatible
- Built-in auto-reconnect with exponential backoff
- Server-side message queueing when client offline
- WebSocket transport with long-polling fallback

**Network Detection: @react-native-community/netinfo**
- Reliable network state monitoring
- Triggers offline queue processing on reconnect

### Data Flow

```
User Action → Zustand Store → Service Layer → BlueBridge-Relay
                ↓                    ↓
            SQLite DB ←──────────────┘
                ↓
          UI Updates
```

**Outbound Messages**:
1. User sends message → messagesStore.sendMessage()
2. Save to SQLite with 'sent' status
3. HTTP POST to /api/messages
4. If fails → queueService.queueMessage() with retry logic
5. UI shows queued/sent/failed status

**Inbound Messages**:
1. SignalR receives 'ReceiveMessage' event
2. storageService.saveMessage() to SQLite
3. Update messagesStore (triggers UI re-render)
4. Update conversation in list, increment unread count

## Database Schema

```sql
-- Messages table
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  direction TEXT CHECK(direction IN ('incoming', 'outgoing')),
  status TEXT CHECK(status IN ('sent', 'queued', 'failed', 'delivered')),
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  INDEX idx_conversation (conversation_id, timestamp),
  INDEX idx_status (status)
);

-- Conversations table
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,
  last_message_preview TEXT,
  last_message_timestamp INTEGER,
  unread_count INTEGER DEFAULT 0,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Offline queue
CREATE TABLE queue (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  retry_count INTEGER DEFAULT 0,
  next_retry_at INTEGER,
  error TEXT,
  FOREIGN KEY (message_id) REFERENCES messages(id)
);
```

## Implementation Phases

### Phase 1: Infrastructure Setup (Foundation)

**Install Dependencies**
```bash
npm install zustand @microsoft/signalr expo-sqlite @react-native-community/netinfo uuid
npm install --save-dev @types/uuid
```

**Create Type Definitions**
- `types/message.ts` - Message, Conversation, QueuedMessage interfaces
- `types/api.ts` - BlueBridge API request/response types
- `types/store.ts` - Zustand store type definitions

**Create Zustand Stores**
- `stores/messagesStore.ts` - Messages, conversations, CRUD operations
- `stores/connectionStore.ts` - Connection state, online/offline status
- `stores/queueStore.ts` - Offline queue management
- `stores/authStore.ts` - API key storage with AsyncStorage persistence
- `stores/index.ts` - Combined exports

**Create Storage Service**
- `services/storageService.ts` - SQLite database operations
- `utils/database.ts` - SQL schema definition and migrations
- Initialize database on app launch in `app/_layout.tsx`

**Update Root Layout**
- Add SQLite initialization in `app/_layout.tsx`
- Add error boundary for crash handling
- Keep existing ThemeProvider and Stack navigation

**Verification**
- [ ] Dependencies installed without errors
- [ ] Zustand stores can be imported and used
- [ ] SQLite database created on app launch
- [ ] All tables exist (verify with Expo dev tools)

### Phase 2: UI Screens (User Interface)

**Create UI Components**
- `components/MessageBubble.tsx` - Message display (incoming/outgoing styles)
- `components/ConversationItem.tsx` - Conversation list item with unread badge
- `components/ConnectionBanner.tsx` - Connection status indicator
- `components/MessageInput.tsx` - Input bar with send button

**Build Conversations Screen**
- Rename `app/(tabs)/index.tsx` → `app/(tabs)/conversations.tsx`
- FlatList of conversations sorted by last message timestamp
- Connection status banner in header
- Pull-to-refresh (future: sync from server)
- Empty state when no conversations
- Navigate to chat on conversation tap

**Build Chat Screen**
- Create `app/chat/[conversationId].tsx`
- Inverted FlatList for messages (newest at bottom)
- MessageInput component at bottom
- Back button to conversations list
- Message status indicators (queued, sent, failed)
- Auto-scroll to bottom on new message

**Build Settings Screen**
- Rename `app/(tabs)/explore.tsx` → `app/(tabs)/settings.tsx`
- API key input with SecureTextEntry
- Server URL input (default: BlueBridge-Relay)
- Connection status display
- Clear conversation history button
- App version info

**Update Tab Navigation**
- Modify `app/(tabs)/_layout.tsx`
- Conversations tab: chat icon (`message.fill` or `bubble.left.and.bubble.right.fill`)
- Settings tab: gear icon (`gearshape.fill`)
- Update tab labels

**Verification**
- [ ] Can navigate between all screens
- [ ] UI renders in light and dark mode
- [ ] Connection status displays (even if "Disconnected")
- [ ] Can input and persist API key
- [ ] Message bubbles render correctly

### Phase 3: Real-Time Messaging (SignalR Integration)

**Create SignalR Service**
- `services/signalRService.ts`
- Connection management with auto-reconnect
- Handle `ReceiveMessage` event (single message)
- Handle `ReceiveQueuedMessages` event (batch on reconnect)
- Emit connection state changes to connectionStore
- Exponential backoff: 0s, 2s, 10s, 30s, 60s

**Create Message Service**
- `services/messageService.ts`
- HTTP POST to `/api/messages/send`
- Headers: `Content-Type: application/json`, `BB-API-KEY: {apiKey}`
- Body: `{phoneNumber, message, timestamp}`
- Error handling: network errors, 401/403, 429, 500

**Integrate with App Lifecycle**
- Connect SignalR on app launch (if API key exists)
- Disconnect on app background
- Reconnect on app foreground
- Use NetInfo for network state detection

**Wire Up Message Receiving**
- SignalR `ReceiveMessage` → storageService.saveMessage → messagesStore update
- Update conversation list with new message preview
- Increment unread count if not viewing conversation
- Real-time UI updates via Zustand subscriptions

**Wire Up Message Sending**
- MessageInput → messagesStore.sendMessage() → messageService.sendMessage()
- Optimistic UI: save to SQLite immediately with 'sent' status
- Update to 'failed' if send fails
- Show status in message bubble

**Verification**
- [ ] SignalR connects with valid API key
- [ ] Can send message to real phone number
- [ ] Message appears in chat view immediately
- [ ] Incoming messages display in real-time
- [ ] Connection indicator updates correctly
- [ ] Messages persist after app restart

### Phase 4: Offline Support (Queue & Retry)

**Create Queue Service**
- `services/queueService.ts`
- Queue message when send fails (network error)
- Exponential backoff retry: 1s, 2s, 4s, 8s, 16s
- Max 5 retries, then mark as 'failed'
- Process queue on network reconnect

**Integrate Queue with Sending**
- On HTTP error → queueService.queueMessage()
- Save to queue table in SQLite
- Update message status to 'queued'
- Show "Queued" indicator in chat bubble

**Queue Processing Triggers**
- Network state change (NetInfo: offline → online)
- App state change (background → foreground)
- Manual retry button for failed messages

**Network State Management**
- NetInfo listener → connectionStore.setIsOnline()
- Show offline banner when disconnected
- Disable send button UI (messages still queue)
- Auto-process queue on reconnect

**Edge Cases**
- Prevent duplicate sends (server handles by timestamp)
- App killed during send → Queue persists in SQLite
- Retry failures → Update retry count and error message
- Queue processing while another in progress → Skip

**Verification**
- [ ] Turn off WiFi → Send message → Shows "Queued"
- [ ] Turn on WiFi → Message sends automatically
- [ ] Kill app offline → Restart → Queued messages persist
- [ ] Failed message (after 5 retries) can be manually retried
- [ ] Offline banner displays correctly

### Phase 5: Polish & Testing (Refinement)

**UI Polish**
- Add loading states (sending, connecting)
- Improve error messages (user-friendly)
- Haptic feedback on send (use existing expo-haptics)
- Smooth scroll animations
- Empty state illustrations/messages

**Error Handling**
- API key validation (401 → prompt to check settings)
- Network timeout handling (30s)
- Invalid phone number detection
- Server error messages displayed to user

**Performance Optimization**
- FlatList optimization: getItemLayout, keyExtractor
- Debounce typing in message input
- Lazy load old messages (pagination for 50+ messages)
- Memoize conversation list items

**Testing Scenarios**
- Send/receive with multiple phone numbers
- Create 5+ conversations
- Long messages (500+ characters)
- Rapid sending (10 messages quickly)
- App backgrounding/foregrounding
- Connection interruptions
- API key changes
- Conversation unread counts

**Documentation**
- Update README with setup instructions
- Document how to get API key
- Troubleshooting section
- Architecture diagram

**Verification**
- [ ] App feels responsive and polished
- [ ] No crashes in common scenarios
- [ ] Clear error messages guide user
- [ ] Documentation enables setup

## Critical Files

### New Files to Create

**Services** (Phase 1 & 3)
- `services/signalRService.ts` - Real-time WebSocket connection
- `services/messageService.ts` - HTTP API for sending messages
- `services/storageService.ts` - SQLite database operations
- `services/queueService.ts` - Offline message queue (Phase 4)

**Stores** (Phase 1)
- `stores/messagesStore.ts` - Message and conversation state
- `stores/connectionStore.ts` - Connection state management
- `stores/queueStore.ts` - Queue state management
- `stores/authStore.ts` - API key persistence

**Types** (Phase 1)
- `types/message.ts` - Data model interfaces
- `types/api.ts` - API request/response types
- `types/store.ts` - Store type definitions

**UI Components** (Phase 2)
- `components/MessageBubble.tsx`
- `components/ConversationItem.tsx`
- `components/ConnectionBanner.tsx`
- `components/MessageInput.tsx`

**Screens** (Phase 2)
- `app/(tabs)/conversations.tsx` - Main screen (rename from index.tsx)
- `app/(tabs)/settings.tsx` - Settings screen (rename from explore.tsx)
- `app/chat/[conversationId].tsx` - Chat view (new route)

**Utilities** (Phase 1)
- `utils/database.ts` - SQL schema and migrations
- `utils/constants.ts` - App-wide constants (API URLs, retry delays)

### Files to Modify

**Root Layout** (Phase 1)
- `app/_layout.tsx` - Add SQLite initialization, error boundary

**Tab Navigation** (Phase 2)
- `app/(tabs)/_layout.tsx` - Update tab icons and labels

**Configuration** (Phase 1)
- `package.json` - Add new dependencies

## Configuration

### Constants File

Create `utils/constants.ts`:
```typescript
export const Config = {
  // Update these to match your BlueBridge-Relay server
  API_BASE_URL: 'http://192.168.1.50:5067',
  API_ENDPOINT: '/api/messages/send',
  SIGNALR_HUB_URL: 'http://192.168.1.50:5067/hubs/messages',

  // Queue retry configuration
  MAX_RETRY_ATTEMPTS: 5,
  RETRY_DELAYS: [1000, 2000, 4000, 8000, 16000], // ms

  // UI configuration
  MESSAGE_BATCH_SIZE: 50, // Pagination size
  MAX_MESSAGE_LENGTH: 1000,
};
```

### API Key Storage

AuthStore with AsyncStorage persistence:
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useAuthStore = create(
  persist(
    (set) => ({
      apiKey: null,
      serverUrl: Config.API_BASE_URL,
      setApiKey: (key) => set({ apiKey: key }),
      setServerUrl: (url) => set({ serverUrl: url }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

## Testing Strategy

### Phase-by-Phase Verification

**Phase 1: Infrastructure**
- App launches without errors
- SQLite database created (check Expo dev tools)
- Zustand stores accessible
- API key can be saved/retrieved

**Phase 2: UI**
- Navigate between all screens
- Light/dark mode works
- Connection banner displays
- Message bubbles render correctly

**Phase 3: Real-Time**
- SignalR connects (check logs)
- Send message appears in chat
- Receive message from another device
- Connection status accurate
- Messages persist after restart

**Phase 4: Offline**
- Offline → send → shows "Queued"
- Online → queued message sends
- App killed → queued messages persist
- Failed messages after 5 retries

**Phase 5: Edge Cases**
- Invalid API key → error message
- Long message (1000 chars)
- 10 rapid sends
- Multiple conversations
- App backgrounding during send

### Connection Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| App launch (online) | Connects to SignalR, shows "Connected" |
| App launch (offline) | Shows "Disconnected", doesn't attempt |
| Network drops mid-chat | Shows "Reconnecting...", messages queue |
| Network returns | Auto-reconnects, processes queue |
| Invalid API key | Shows auth error, prompts settings |
| Server down | Shows "Disconnected", retries with backoff |
| App backgrounded | Disconnects SignalR cleanly |
| App foregrounded | Reconnects, receives queued messages |

## Technical Decisions

### Why Zustand over Context API?
- Context causes re-renders of all consumers on any state change
- Zustand allows selective subscriptions (only re-render what changed)
- Critical for frequently updating message data
- Simpler API with less boilerplate

### Why SQLite over AsyncStorage?
- AsyncStorage limited to ~6MB, slow with >100 records
- Messaging needs thousands of messages
- SQLite provides ACID, transactions, complex queries
- Future-ready for encryption, full-text search

### Why Offline-First Architecture?
- Better UX: messages send instantly in UI
- Network resilience: queue handles failures
- Server queueing: no message loss when offline
- Single source of truth: SQLite drives all UI

### Background Service Approach
**Baseline**: No background reception
- SignalR disconnects when app backgrounded
- Server queues messages while offline
- Delivers batch on reconnect

**Future**: Foreground Service (Android) or Background Fetch (iOS)
- Requires additional permissions and setup
- Out of scope for baseline MVP

## Out of Scope (Future Enhancements)

**Not in Baseline**
- Push notifications (requires FCM/APNs)
- Background message reception
- Contact names/avatars
- Read receipts
- Typing indicators
- Message search
- Image/file attachments
- Group messaging
- End-to-end encryption
- Message reactions
- Message editing/deletion

**Easy Future Additions**
- Timestamp formatting (date-fns)
- Avatar placeholders
- Pull-to-refresh
- Swipe-to-delete conversations
- Copy message to clipboard
- Message character counter

## Timeline Estimate

- **Phase 1 (Infrastructure)**: 2 days
- **Phase 2 (UI Screens)**: 2 days
- **Phase 3 (Real-Time)**: 2 days
- **Phase 4 (Offline)**: 2 days
- **Phase 5 (Polish)**: 2 days

**Total**: ~10 days (assumes single developer, no blockers)

## Success Criteria

A successful baseline implementation delivers:

1. ✅ Send text messages to phone numbers via BlueBridge-Relay
2. ✅ Receive real-time messages via SignalR WebSocket
3. ✅ Conversation list showing all message threads
4. ✅ Chat view displaying message history
5. ✅ Message persistence in SQLite (survives app restart)
6. ✅ Offline queue with auto-retry on reconnect
7. ✅ Connection status indicators
8. ✅ Settings for API key configuration
9. ✅ Light/dark mode theme support
10. ✅ Clean, maintainable codebase for future iteration

## Next Steps After Plan Approval

1. Install dependencies (Phase 1)
2. Set up Zustand stores and type definitions
3. Initialize SQLite database
4. Build UI screens incrementally
5. Integrate SignalR and message services
6. Implement offline queue
7. Test thoroughly across scenarios
8. Document setup and usage

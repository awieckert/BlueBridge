# BlueBridge React Native Messaging App - Implementation Plan

## Overview
Build a baseline Android messaging app using React Native (Expo) that integrates with BlueBridge-Relay infrastructure for sending/receiving iMessages. Focus on minimal viable functionality with offline support and clean architecture for future iteration.

## Implementation Progress

**Current Status:** Phase 3.5 Complete - Contact Integration & New Conversations

| Phase | Status | Completion Date |
|-------|--------|-----------------|
| Phase 1: Infrastructure Setup | ✅ **COMPLETE** | 2026-01-24 |
| Phase 2: UI Screens | ✅ **COMPLETE** | 2026-01-24 |
| Phase 3: Real-Time Messaging | ✅ **COMPLETE** | 2026-01-24 |
| Phase 3.5: New Conversations & Contact Integration | ✅ **COMPLETE** | 2026-01-25 |
| Phase 4: Offline Support | ⏳ Pending | - |
| Phase 5: Polish & Testing | ⏳ Pending | - |

**What's Working:**
- ✅ SQLite database with messages, conversations, and queue tables
- ✅ Zustand state management for messages, connections, queue, auth, and contacts
- ✅ Full UI: Conversations list, Chat screen, Settings screen, New Conversation screen
- ✅ Message input and display (saves to local database)
- ✅ API key configuration and persistence
- ✅ Light/dark mode throughout
- ✅ Optimistic UI for sending messages
- ✅ SignalR real-time connection to BlueBridge-Relay
- ✅ HTTP API integration for sending messages
- ✅ Network state monitoring with NetInfo
- ✅ Incoming message handling and storage
- ✅ Connection status indicators (banner and settings)
- ✅ Auto-reconnect with exponential backoff
- ✅ App lifecycle management (background/foreground)
- ✅ Contact integration with device contacts (expo-contacts)
- ✅ New conversation screen with contact picker and search
- ✅ Phone number normalization and validation (libphonenumber-js)
- ✅ Contact names displayed in conversations list and chat headers
- ✅ Manual phone number entry for creating conversations
- ✅ Floating action button for easy access to new conversations
- ✅ Automatic contact name lookup for incoming messages

**What's Next (Phase 4):**
- Queue service for offline message retry
- Message queueing when send fails
- Auto-process queue on network reconnect
- Manual retry for failed messages

## User Requirements
- **Core Features**: Send text messages, receive real-time messages, conversation view, message persistence
- **Offline Support**: Queue messages when offline with auto-retry
- **UI**: Minimal/functional (fast iteration)
- **Notifications**: Skip for baseline (future enhancement)

## Current Project State
- **Framework**: Expo SDK 54 + Expo Router (file-based routing)
- **Navigation**: Tab-based navigation configured (Conversations, Settings, Chat)
- **Theming**: Light/dark mode system with themed components
- **Dependencies**: React Native 0.81.5, TypeScript 5.9.2, Reanimated 4.1.1
- **Added (Phase 1)**: Zustand state management, expo-sqlite, @microsoft/signalr, NetInfo, AsyncStorage
- **Added (Phase 2)**: Complete UI screens and components, chat functionality
- **Remaining**: SignalR connection, HTTP API integration, offline queue processing

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
  timestamp INTEGER NOT NULL,  -- Unix timestamp in milliseconds (JavaScript Date.now())
  direction TEXT NOT NULL CHECK(direction IN ('incoming', 'outgoing')),
  status TEXT NOT NULL CHECK(status IN ('sent', 'queued', 'failed', 'delivered')),
  created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') || substr(strftime('%f', 'now'), 4) as INTEGER)),
  INDEX idx_conversation (conversation_id, timestamp),
  INDEX idx_status (status)
);

-- Conversations table
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,
  last_message_preview TEXT,
  last_message_timestamp INTEGER,  -- Unix timestamp in milliseconds
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') || substr(strftime('%f', 'now'), 4) as INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') || substr(strftime('%f', 'now'), 4) as INTEGER))
);

-- Offline queue
CREATE TABLE queue (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,  -- Unix timestamp in milliseconds
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at INTEGER,  -- Unix timestamp in milliseconds, NULL until first retry scheduled
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') || substr(strftime('%f', 'now'), 4) as INTEGER)),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
```

**Schema Notes:**
- All timestamps use INTEGER type storing milliseconds (JavaScript Date.now() format) for consistency with React Native
- NOT NULL constraints added to enforce data integrity on required fields
- CHECK constraints on direction/status prevent invalid enum values
- Foreign key includes ON DELETE CASCADE to auto-clean queue when message deleted
- Indexes on frequently queried columns (conversation_id, timestamp, status)

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
- [x] Dependencies installed without errors
- [x] Zustand stores can be imported and used
- [x] SQLite database created on app launch
- [x] All tables exist (verify with Expo dev tools)

**PHASE 1 COMPLETE ✅** (Completed: 2026-01-24)

**What Was Built:**
- All dependencies added to package.json (zustand, @microsoft/signalr, expo-sqlite, @react-native-community/netinfo, uuid, @react-native-async-storage/async-storage)
- Type definitions created in `types/` directory (message.ts, api.ts, store.ts)
- Four Zustand stores created: authStore, messagesStore, connectionStore, queueStore
- Complete storage service with SQLite CRUD operations for messages, conversations, and queue
- Database schema with proper indexes, constraints, and foreign keys
- Constants configuration file for API URLs and retry settings
- Root layout updated with database initialization and error handling

### Phase 2: UI Screens (User Interface)

**Create UI Components**
- `components/MessageBubble.tsx` - Message display (incoming/outgoing styles)
- `components/ConversationItem.tsx` - Conversation list item with unread badge
- `components/ConnectionBanner.tsx` - Connection status indicator
- `components/MessageInput.tsx` - Input bar with send button
- `components/ScrollToBottomButton.tsx` - Floating button to jump to latest message (shows when scrolled up)

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
- Scroll-to-bottom button (appears when user scrolls up and latest message not in view)
- Track scroll position to show/hide scroll-to-bottom button

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
- [x] Can navigate between all screens
- [x] UI renders in light and dark mode
- [x] Connection status displays (even if "Disconnected")
- [x] Can input and persist API key
- [x] Message bubbles render correctly

**PHASE 2 COMPLETE ✅** (Completed: 2026-01-24)

**What Was Built:**

*UI Components (5 components):*
- `components/MessageBubble.tsx` - Message display with incoming/outgoing styles, status indicators, timestamps
- `components/ConversationItem.tsx` - Conversation list item with avatar, unread badge, smart timestamp formatting
- `components/ConnectionBanner.tsx` - Color-coded connection status banner (auto-hides when connected)
- `components/MessageInput.tsx` - Message input with send button, character limit, multiline support
- `components/ScrollToBottomButton.tsx` - Floating scroll button with visibility based on scroll position

*Screens (3 screens):*
- `app/(tabs)/conversations.tsx` - Conversations list with pull-to-refresh, empty state, loads from SQLite
- `app/(tabs)/settings.tsx` - API key input, server URL config, connection status, clear history, app info
- `app/chat/[conversationId].tsx` - Chat view with message list, auto-scroll, optimistic UI, saves to SQLite

*Tab Navigation:*
- Updated `app/(tabs)/_layout.tsx` with Conversations and Settings tabs
- Added proper icons (message.fill, gearshape.fill)
- Hidden old index/explore tabs
- Enabled headers for navigation

*Key Features:*
- Messages save to SQLite immediately (optimistic UI)
- Conversation loading from database on app launch
- Unread count reset when viewing conversations
- Light/dark mode throughout all screens
- Keyboard handling for chat input
- Scroll position tracking and auto-scroll for new messages

**Note:** Message sending to BlueBridge-Relay server not yet implemented (Phase 3)

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
- Maintain connection when app backgrounded (for message reception)
- Use NetInfo for network state detection
- Handle app termination gracefully (disconnect on app kill)
- Reconnect on network state changes (offline → online)

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
- [x] SignalR connects with valid API key
- [x] Can send message to real phone number
- [x] Message appears in chat view immediately
- [x] Incoming messages display in real-time
- [x] Connection indicator updates correctly
- [x] Messages persist after app restart
- [x] Connection maintained when app backgrounded
- [x] Messages received while backgrounded appear when foregrounded
- [x] Scroll-to-bottom button appears when scrolled away from latest message

**PHASE 3 COMPLETE ✅** (Completed: 2026-01-24)

**What Was Built:**

*Services (2 files):*
- `services/messageService.ts` - HTTP POST to BlueBridge-Relay API for sending messages
  - API key authentication via `BB-API-KEY` header
  - Error handling for network errors, auth errors (401/403), rate limits (429), server errors (500)
  - User-friendly error messages for common failure scenarios
- `services/signalRService.ts` - Real-time WebSocket connection management
  - Auto-connect on app launch with valid API key
  - Event handlers for `ReceiveMessage` (single) and `ReceiveQueuedMessages` (batch)
  - Exponential backoff reconnection: 0s, 2s, 10s, 30s, 60s
  - Automatic conversation creation for incoming messages
  - Unread count increment for background messages
  - Connection state updates to connectionStore

*App Lifecycle Integration:*
- Updated `app/_layout.tsx` - Database initialization, SignalR connection, network monitoring
  - Load initial messages/conversations from SQLite on launch
  - NetInfo subscription for network state changes
  - AppState monitoring for background/foreground transitions
  - Auto-reconnect when network restored or app foregrounded
  - Cleanup on app unmount
- Updated `app/chat/[conversationId].tsx` - Message sending integration
  - Uses messageService.sendMessage() for HTTP POST
  - Updates message status to 'failed' on send error
  - Optimistic UI with immediate local save
  - TODO marker for Phase 4 queue integration
- Updated `app/(tabs)/settings.tsx` - Reconnect on config changes
  - Disconnect and reconnect SignalR when API key changes
  - Disconnect and reconnect when server URL changes
  - Connection status display with 'connecting' state

*Component Updates:*
- Updated `components/ConnectionBanner.tsx` - Added 'connecting' status
  - Blue banner for "Connecting..." state
  - Existing orange for offline/reconnecting
  - Red for disconnected

*Type Updates:*
- Updated `types/store.ts` - Added 'connecting' to ConnectionStore status union

*Key Features:*
- Real-time message reception via SignalR WebSockets
- HTTP message sending with error handling
- Network state monitoring (online/offline detection)
- Auto-reconnect on network changes and app foregrounding
- Connection status indicators throughout UI
- Message persistence across app restarts
- Optimistic UI for instant message display
- Unread count management for background messages

**Known Limitations (Addressed in Phase 4):**
- Failed messages show 'failed' status but don't auto-retry
- No offline queue processing (messages just fail when offline)
- Manual retry button not yet implemented

### Phase 3.5: New Conversations & Contact Integration

**Install Dependencies**
```bash
npm install expo-contacts libphonenumber-js
npm install --save-dev @types/libphonenumber-js
```

**Create Contact Service**
- `services/contactService.ts`
- Request contacts permission via `Contacts.requestPermissionsAsync()`
- Fetch all contacts with phone numbers using `getContactsAsync()`
- Normalize phone numbers to E.164 format (+1234567890) for consistent matching
- Cache contacts in memory for performance (refresh on app launch)
- Lookup contact name by phone number for incoming messages
- Handle permission denied gracefully

**Create Contact Store**
- `stores/contactStore.ts`
- Store fetched contacts array
- Track permission status ('granted', 'denied', 'undetermined')
- Provide search/filter functionality (by name or phone number)
- Sync contact names with existing conversations

**Create Phone Number Utilities**
- `utils/phoneNumber.ts`
- Normalize phone numbers to E.164 format using libphonenumber-js
- Validate phone numbers (check if valid format)
- Format for display (e.g., "+1 (234) 567-8900")
- Match different phone number formats (handle (123) 456-7890 vs +11234567890)

**Build New Conversation Screen**
- `app/conversation/new.tsx`
- **Search Bar** at top
  - Real-time search across contacts AND existing conversations
  - Debounced input (300ms) for performance
  - Clear button to reset search
- **Two Sections (conditional rendering):**
  - "Contacts" - Device contacts with phone numbers (filtered by search)
  - "Recent Conversations" - Existing message threads (filtered by search)
- **Contact List Item Component:**
  - Contact photo/avatar placeholder (first letter of name)
  - Contact name (primary text, bold)
  - Phone number (secondary text, gray)
  - Tap to create conversation and navigate to chat
- **Manual Phone Number Entry:**
  - "Enter phone number manually" button at bottom (always visible)
  - Shows input dialog/modal with phone number field
  - Format validation using libphonenumber-js
  - Shows validation errors ("Invalid phone number format")
  - "Start Chat" button (disabled if invalid)
- **Permission Handling:**
  - Request permission on first screen load
  - Show explanation before requesting ("Access contacts to easily message friends")
  - If denied: hide contacts section, show manual entry only
  - "Grant Permission" button to re-request if denied

**Create UI Components**
- `components/ContactListItem.tsx` - Contact picker item
  - Avatar with first letter of name
  - Name and phone number display
  - Tap handler to select contact
  - Match highlighting (optional polish)

**Update Database Schema**
- Add `contact_name` column to conversations table:
```sql
ALTER TABLE conversations ADD COLUMN contact_name TEXT;
```
- Migration handled in `utils/database.ts`

**Update Existing Components**
- `components/ConversationItem.tsx`
  - Display contact name if available (fallback to phone number)
  - Format: "John Doe" vs "+1 (234) 567-8900"
- `app/chat/[conversationId].tsx`
  - Display contact name in header instead of phone number
  - Load contact name from conversation or lookup in contactStore
- `app/(tabs)/conversations.tsx`
  - Add floating action button (FAB) for "New Message"
  - Position: bottom right, above tab bar
  - Icon: compose/plus icon
  - Navigate to `conversation/new` on tap

**Update Services**
- `services/signalRService.ts`
  - When receiving message, lookup contact name by phone number
  - Save contact name when creating new conversation
  - Update existing conversation if contact name found
- `services/storageService.ts`
  - Add methods to save/update contact names in conversations
  - `updateConversationContactName(conversationId, contactName)`
  - Query to fetch conversations with contact names

**Update Configuration**
- `app.json` - Add Android permissions:
```json
{
  "expo": {
    "android": {
      "permissions": [
        "android.permission.READ_CONTACTS"
      ]
    }
  }
}
```

**Data Flow**

**Starting New Conversation:**
1. User taps "New Message" FAB on conversations screen
2. Navigate to `app/conversation/new.tsx`
3. Request READ_CONTACTS permission (if not already granted)
4. Fetch all contacts with phone numbers
5. User searches or scrolls to find contact
6. Tap contact → Normalize phone number → Check if conversation exists
7. If exists: Navigate to existing chat
8. If new: Create conversation in SQLite with contact name → Navigate to chat
9. User can immediately send first message

**Receiving Message from Contact:**
1. SignalR receives message with phone number
2. Normalize phone number to E.164 format
3. Lookup contact name from contactStore (compare normalized numbers)
4. Save message to SQLite
5. Create/update conversation with contact name
6. Display contact name in conversations list and chat header

**Search Functionality:**
- Searches contact names, phone numbers (normalized), and existing conversation previews
- Case-insensitive matching
- Debounced input (300ms) to prevent lag
- Sections hide when empty (e.g., no matching contacts)

**Edge Cases**
- Permission denied → Show manual entry only, hide contacts section
- No contacts with phone numbers → Show empty state with manual entry
- Duplicate conversation prevention → Check by normalized phone number
- Contact name changes on device → Refresh contacts on app launch
- Phone number normalization fails → Use raw phone number
- Multiple phone numbers per contact → Show all, let user choose

**Verification**
- [x] Contacts permission request appears on first use
- [x] Shows all device contacts with phone numbers
- [x] Search filters contacts and conversations in real-time
- [x] Can tap contact to start new conversation
- [x] Duplicate conversations prevented (navigates to existing)
- [x] Can manually enter phone number if contact not found
- [x] Invalid phone numbers show validation error
- [x] Valid manual phone number creates conversation
- [x] Contact names display in conversations list
- [x] Contact names display in chat header
- [x] Incoming messages from contacts show contact name
- [x] Incoming messages from unknown numbers show phone number
- [x] Works gracefully if permission denied (manual entry only)
- [x] FAB appears on conversations screen
- [x] Contact names persist after app restart
- [x] Phone number normalization handles different formats

**Files to Create**
- `services/contactService.ts` - Contact fetching and lookup (150-200 lines)
- `stores/contactStore.ts` - Contact state management (100-150 lines)
- `utils/phoneNumber.ts` - Phone number normalization/validation (50-75 lines)
- `app/conversation/new.tsx` - New conversation screen (250-300 lines)
- `components/ContactListItem.tsx` - Contact picker item (75-100 lines)

**Files to Modify**
- `app/(tabs)/conversations.tsx` - Add "New Message" FAB (~10 lines)
- `app/chat/[conversationId].tsx` - Display contact name in header (~15 lines)
- `components/ConversationItem.tsx` - Display contact name if available (~10 lines)
- `services/signalRService.ts` - Lookup contact name for incoming messages (~20 lines)
- `services/storageService.ts` - Save/update contact names in conversations (~30 lines)
- `utils/database.ts` - Add contact_name column migration (~15 lines)
- `package.json` - Add expo-contacts and libphonenumber-js
- `app.json` - Add READ_CONTACTS permission (~5 lines)

**PHASE 3.5 COMPLETE ✅** (Completed: 2026-01-25)

**What Was Built:**

*Dependencies (3 packages):*
- `expo-contacts` (~15.0.4) - Access device contacts
- `libphonenumber-js` (1.12.35) - Phone number normalization and validation
- `@types/libphonenumber-js` (1.0.1) - TypeScript definitions

*Phone Number Utilities (1 file):*
- `utils/phoneNumber.ts` - Comprehensive phone number handling
  - Normalize to E.164 format (+1234567890)
  - Validate phone number format
  - Format for display (+1 (234) 567-8900)
  - Match different phone number formats
  - Extract digits and country codes

*Contact Service (1 file):*
- `services/contactService.ts` - Contact management with caching
  - Request/check contacts permission
  - Fetch contacts with phone numbers (with 5-minute cache)
  - Lookup contact by phone number
  - Search contacts by name or number
  - Handle permission denied gracefully

*Contact Store (1 file):*
- `stores/contactStore.ts` - Zustand state management
  - Track contacts array and permission status
  - Request permission and load contacts
  - Search/filter functionality
  - Contact lookup methods

*Database Enhancements:*
- Added `contact_name` column to conversations table
- Created migration system to update existing databases
- Updated Conversation type to include `contactName`
- Added helper methods: `updateConversationContactName()`, `updateConversationContactNameByPhoneNumber()`

*UI Components (1 file):*
- `components/ContactListItem.tsx` - Contact display
  - Avatar with first letter of contact name
  - Contact name and formatted phone number
  - Indicator for multiple phone numbers
  - Light/dark mode support

*New Conversation Screen (1 file):*
- `app/conversation/new.tsx` - Full-featured contact picker (300+ lines)
  - Search bar with debouncing (filters contacts & conversations)
  - Combined list showing contacts and existing conversations
  - Manual phone number entry modal with validation
  - Permission request UI with explanation
  - Duplicate conversation prevention
  - Creates conversation with contact name
  - Navigates to existing or new chat

*Floating Action Button:*
- Added FAB to conversations screen (bottom-right)
- Navigate to new conversation screen
- Styled for light/dark mode

*Contact Name Integration:*
- Updated `ConversationItem.tsx` to show contact name if available
- Updated chat screen header to display contact name
- Updated SignalR service to lookup and save contact names for incoming messages
- Contact names persist in SQLite database

*Configuration:*
- Added `READ_CONTACTS` permission to app.json (Android)

**Achieved Outcomes:**
- ✅ Users can start new conversations by selecting contacts
- ✅ Contact names appear in conversations list and chat headers
- ✅ Search functionality across contacts and existing conversations
- ✅ Phone number normalization ensures reliable contact matching
- ✅ Manual entry available when contacts not accessible
- ✅ Seamless UX like native messaging apps (iMessage, WhatsApp)
- ✅ Permission handling with graceful fallback
- ✅ Automatic contact name lookup for incoming messages
- ✅ Contact names persist across app restarts

**Research Sources:**
- [Expo Contacts Documentation](https://docs.expo.dev/versions/latest/sdk/contacts/)
- [expo-contacts npm package](https://www.npmjs.com/package/expo-contacts)
- [React Native Contacts - LogRocket](https://blog.logrocket.com/react-native-contacts-how-to-access-a-devices-contact-list/)
- [libphonenumber-js for phone number normalization](https://www.npmjs.com/package/react-phone-number-input)
- [Mastering Contacts in React Native + Expo](https://medium.com/@iLuckyisrael/mastering-sms-contacts-and-location-in-react-native-expo-permissions-8fe4adc4bcd8)

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

**Services** (Phase 1, 3 & 3.5)
- `services/signalRService.ts` - Real-time WebSocket connection
- `services/messageService.ts` - HTTP API for sending messages
- `services/storageService.ts` - SQLite database operations
- `services/contactService.ts` - Contact fetching and lookup (Phase 3.5)
- `services/queueService.ts` - Offline message queue (Phase 4)

**Stores** (Phase 1 & 3.5)
- `stores/messagesStore.ts` - Message and conversation state
- `stores/connectionStore.ts` - Connection state management
- `stores/queueStore.ts` - Queue state management
- `stores/authStore.ts` - API key persistence
- `stores/contactStore.ts` - Contact state management (Phase 3.5)

**Types** (Phase 1)
- `types/message.ts` - Data model interfaces
- `types/api.ts` - API request/response types
- `types/store.ts` - Store type definitions

**UI Components** (Phase 2 & 3.5)
- `components/MessageBubble.tsx`
- `components/ConversationItem.tsx`
- `components/ConnectionBanner.tsx`
- `components/MessageInput.tsx`
- `components/ScrollToBottomButton.tsx`
- `components/ContactListItem.tsx` (Phase 3.5)

**Screens** (Phase 2 & 3.5)
- `app/(tabs)/conversations.tsx` - Main screen (rename from index.tsx)
- `app/(tabs)/settings.tsx` - Settings screen (rename from explore.tsx)
- `app/chat/[conversationId].tsx` - Chat view (new route)
- `app/conversation/new.tsx` - New conversation screen (Phase 3.5)

**Utilities** (Phase 1 & 3.5)
- `utils/database.ts` - SQL schema and migrations
- `utils/constants.ts` - App-wide constants (API URLs, retry delays)
- `utils/phoneNumber.ts` - Phone number normalization/validation (Phase 3.5)

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
| App backgrounded | Maintains SignalR connection, receives messages |
| App foregrounded | Connection already active, UI updates |
| App killed/terminated | Disconnects, reconnects on next launch |

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
**Baseline**: Maintain SignalR Connection When Backgrounded
- SignalR connection stays active when app backgrounded
- Enables real-time message reception while app in background
- Lays foundation for future push notification integration
- Android: Connection maintained by default
- iOS: Limited background execution time (~30 seconds)

**Future**: Push Notifications via FCM/APNs
- Display notifications for messages received while backgrounded
- Wake app on notification tap
- Requires FCM/APNs setup and device token registration
- Out of scope for baseline MVP but infrastructure ready

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

- **Phase 1 (Infrastructure)**: 2 days ✅
- **Phase 2 (UI Screens)**: 2 days ✅
- **Phase 3 (Real-Time)**: 2 days ✅
- **Phase 3.5 (Contacts & New Conversations)**: 2 days
- **Phase 4 (Offline)**: 2 days
- **Phase 5 (Polish)**: 2 days

**Total**: ~12 days (assumes single developer, no blockers)

## Success Criteria

A successful baseline implementation delivers:

1. ✅ Send text messages to phone numbers via BlueBridge-Relay
2. ✅ Receive real-time messages via SignalR WebSocket
3. ✅ Conversation list showing all message threads
4. ✅ Chat view displaying message history
5. ✅ Message persistence in SQLite (survives app restart)
6. ✅ Start new conversations with contact picker and search
7. ✅ Contact integration with name display throughout app
8. ⏳ Offline queue with auto-retry on reconnect
9. ✅ Connection status indicators
10. ✅ Settings for API key configuration
11. ✅ Light/dark mode theme support
12. ✅ Clean, maintainable codebase for future iteration

## Implementation Status Summary

### Completed Steps ✅

1. ✅ Install dependencies (Phase 1) - **DONE**
2. ✅ Set up Zustand stores and type definitions - **DONE**
3. ✅ Initialize SQLite database - **DONE**
4. ✅ Build UI screens incrementally - **DONE**
5. ✅ Integrate SignalR and message services - **DONE (Phase 3)**
6. ✅ Add contact integration and new conversation UI - **DONE (Phase 3.5)**
7. ⏳ Implement offline queue - **NEXT (Phase 4)**
8. ⏳ Test thoroughly across scenarios - **Phase 5**
9. ⏳ Document setup and usage - **Phase 5**

### Files Created (Phases 1-3.5) ✅

**Type Definitions (3 files):**
- `types/message.ts` - Message, Conversation, QueuedMessage interfaces (updated in Phase 3.5 for contactName)
- `types/api.ts` - API request/response types
- `types/store.ts` - Zustand store type definitions (updated in Phase 3)

**Stores (6 files):**
- `stores/authStore.ts` - API key with AsyncStorage persistence
- `stores/messagesStore.ts` - Messages and conversations state
- `stores/connectionStore.ts` - Connection status management
- `stores/queueStore.ts` - Offline queue state
- `stores/contactStore.ts` - Contact state management (Phase 3.5)
- `stores/index.ts` - Combined exports (updated in Phase 3.5)

**Services (4 files):**
- `services/storageService.ts` - Complete SQLite CRUD operations (updated in Phase 3.5)
- `services/messageService.ts` - HTTP API for sending messages (Phase 3)
- `services/signalRService.ts` - Real-time WebSocket connection (Phase 3, updated in Phase 3.5)
- `services/contactService.ts` - Contact fetching and lookup (Phase 3.5)

**Utilities (3 files):**
- `utils/database.ts` - Database schema and initialization (updated in Phase 3.5 with migrations)
- `utils/constants.ts` - App configuration constants
- `utils/phoneNumber.ts` - Phone number normalization/validation (Phase 3.5)

**Components (6 files):**
- `components/MessageBubble.tsx` - Message display
- `components/ConversationItem.tsx` - Conversation list item (updated in Phase 3.5)
- `components/ConnectionBanner.tsx` - Connection status banner (updated in Phase 3)
- `components/MessageInput.tsx` - Message input field
- `components/ScrollToBottomButton.tsx` - Floating scroll button
- `components/ContactListItem.tsx` - Contact picker item (Phase 3.5)

**Screens (4 files):**
- `app/(tabs)/conversations.tsx` - Conversations list screen (updated in Phase 3.5 with FAB)
- `app/(tabs)/settings.tsx` - Settings and configuration (updated in Phase 3)
- `app/chat/[conversationId].tsx` - Chat view (updated in Phase 3 & 3.5)
- `app/conversation/new.tsx` - New conversation screen (Phase 3.5)

**Modified Files (4 files):**
- `app/_layout.tsx` - Database init, SignalR connection, network monitoring (updated in Phase 3)
- `app/(tabs)/_layout.tsx` - Updated tab navigation
- `package.json` - Added dependencies (Phases 1 & 3.5)
- `app.json` - Added READ_CONTACTS permission (Phase 3.5)

### Next Steps (Phase 4 - Offline Support)

**Immediate Next Actions:**
1. Create `services/queueService.ts` for offline message retry
2. Integrate queueService with message sending (on HTTP error)
3. Add queue processing on network reconnect
4. Add manual retry button for failed messages
5. Update UI to show queued message status
6. Test offline scenarios (WiFi off/on, app killed)

**Files to Create in Phase 4:**
- `services/queueService.ts` - Queue management with exponential backoff retry

**Files to Update in Phase 4:**
- `app/chat/[conversationId].tsx` - Queue failed messages instead of just marking failed
- `app/_layout.tsx` - Process queue on network reconnect
- `components/MessageBubble.tsx` - Add retry button for failed messages (optional)

**Expected Outcome:**
- Messages queue when offline or send fails
- Auto-retry with exponential backoff (1s, 2s, 4s, 8s, 16s)
- Max 5 retry attempts before marking permanently failed
- Queue persists across app restarts (SQLite)
- Auto-process queue when network reconnects
- Manual retry button for failed messages

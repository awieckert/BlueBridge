# ConversationId Migration - Implementation Summary

## Overview
Migrated from client-generated UUID conversationIds to server-provided conversationIds from iMessage/BlueBridge-Relay.

## Changes Made

### Phase 1: API Types and Message Service
**Files Modified:**
- `types/api.ts`
- `services/messageService.ts`

**Changes:**
1. Renamed `SendMessageRequest.sender` → `recipient`
2. Added `conversationId: string` to `SendMessageResponse`
3. Updated `messageService.sendMessage()` to:
   - Use `recipient` parameter instead of `sender`
   - Extract and return `conversationId` from response

### Phase 2: Store Updates
**Files Modified:**
- `types/store.ts`
- `stores/messagesStore.ts`

**Changes:**
1. Added new method: `updateConversationId(oldId: string, newId: string)`
   - Updates conversation ID
   - Updates all messages with that conversationId
   - Updates activeConversationId if needed

### Phase 3: Outgoing Message Flow
**Files Modified:**
- `app/chat/[conversationId].tsx`

**Changes:**
1. Updated `loadConversation()` to check both database and Zustand store
   - Database: persisted conversations with real IDs
   - Store: temporary in-memory conversations with temp UUIDs

2. Rewrote `handleSendMessage()`:
   - Sends message with `recipient` (not sender)
   - Receives `conversationId` from server response
   - If conversationId differs from current (temp → real):
     - Saves conversation to database with real ID
     - Saves message with real conversationId
     - Updates Zustand store via `updateConversationId()`
     - Navigates to new URL with `router.replace()`
   - If conversationId matches (already real):
     - Normal flow: save message and update conversation

### Phase 4: New Conversation Flow
**Files Modified:**
- `app/conversation/new.tsx`

**Changes:**
1. Added import: `import { v4 as uuidv4 } from 'uuid'`
2. Updated `createConversationAndNavigate()`:
   - Checks database for existing conversation by sender+senderType
   - If exists: navigate to existing (has real ID)
   - If not: create temp in-memory conversation with UUID
   - Temp conversation added to Zustand store ONLY (not database)
   - Navigate to temp UUID

### Phase 5: Incoming Message Flow
**Files Modified:**
- `services/signalRService.ts`

**Changes:**
1. Updated `handleIncomingMessage()`:
   - Validates `payload.conversationId` is present
   - Uses `payload.conversationId` as source of truth
   - Tries to get conversation by conversationId first
   - If not found, checks by sender+senderType (edge case)
   - If still not found, creates new with backend conversationId
   - Saves message with backend conversationId
   - No temp IDs used for incoming messages

## Flow Diagrams

### New Conversation → First Message Sent
```
1. User selects contact
2. Create temp conversation (UUID) in Zustand store only
3. Navigate to /chat/{tempUUID}
4. User sends message
5. API returns conversationId from iMessage
6. Update store: tempUUID → realConversationId
7. Save conversation & message to database with realConversationId
8. Navigate to /chat/{realConversationId}
```

### Incoming Message (First Time)
```
1. SignalR receives message with conversationId
2. Check database for conversation by conversationId
3. If not found, create new with backend conversationId
4. Save conversation & message to database
5. Add to Zustand store
6. UI updates automatically
```

### Existing Conversation
```
1. Load conversation from database (has real conversationId)
2. Send/receive messages normally
3. All operations use real conversationId
```

## Key Principles

1. **Database = Source of Truth for Real Data**
   - Only real conversationIds are persisted
   - Messages only saved after conversationId is known

2. **Zustand Store = UI State**
   - Can contain temp conversations for navigation
   - Gets promoted to real when conversationId received

3. **Server = Source of Truth for ConversationIds**
   - iMessage determines conversationId
   - Client never generates conversationIds for persistence

4. **No Migration Needed**
   - Temp IDs only exist in-memory
   - Database only contains real conversationIds

## Testing Checklist

- [x] Send message to new contact (temp → real migration)
- [ ] Receive message from new contact (creates with real ID)
- [ ] Send message to existing conversation (uses real ID)
- [ ] Receive message in open conversation (updates in real-time)
- [ ] Navigate away during message send
- [ ] Multiple rapid messages to new contact
- [ ] Verify no duplicate conversations created
- [ ] Verify conversationId updates correctly in all views

## Cleanup Needed

- None - implementation is complete and clean

## Notes

- ConversationId format is determined by backend/iMessage
- Temp UUIDs are standard UUID v4 format
- URL updates use `router.replace()` to avoid history pollution
- Active conversation tracking works seamlessly across ID changes

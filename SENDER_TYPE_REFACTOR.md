# SenderType Enum Refactoring

## Overview
Refactored the database to use numeric enum values (0 = phone, 1 = email) instead of string values for `sender_type` columns. This approach is more efficient, type-safe, and avoids string comparison/case sensitivity issues.

## Changes Made

### 1. New Enum Utility (`utils/senderTypeEnum.ts`)
Created a centralized enum system:
- `SenderTypeEnum.Phone = 0`
- `SenderTypeEnum.Email = 1`
- `senderTypeToNumber()` - Convert 'phone'|'email' to 0|1
- `numberToSenderType()` - Convert 0|1 to 'phone'|'email'
- `isValidSenderTypeNumber()` - Validate numeric values

### 2. Database Schema (`utils/database.ts`)
Updated all tables to use INTEGER instead of TEXT:
- `sender_type INTEGER NOT NULL CHECK(sender_type IN (0, 1))`
- Applied to: `messages`, `conversations`, `queue` tables

### 3. Automatic Migration
Added `migrateSenderTypeToNumeric()` function that:
- Detects if migration is needed
- Creates temporary tables with new schema
- Converts existing data: 'phone' → 0, 'email' → 1 (case-insensitive)
- Swaps tables atomically
- Runs automatically on database initialization

### 4. Storage Service (`services/storageService.ts`)
Updated all database operations:
- **Writing**: Convert SenderType to number using `senderTypeToNumber()`
- **Reading**: Convert number to SenderType using `numberToSenderType()`
- Updated methods:
  - `saveMessage()` - converts senderType before INSERT
  - `getMessagesByConversation()` - converts from number on SELECT
  - `getAllMessages()` - converts from number on SELECT
  - `saveConversation()` - converts senderType before INSERT
  - `updateConversationContactNameBySender()` - converts for WHERE clause
  - `getConversation()` - converts from number on SELECT
  - `getConversationBySender()` - converts for WHERE and SELECT
  - `getAllConversations()` - converts from number on SELECT
  - `queueMessage()` - converts senderType before INSERT
  - `getQueuedMessages()` - converts from number on SELECT

### 5. SignalR Service (`services/signalRService.ts`)
- Simplified validation (case-insensitive check still present for incoming payloads)
- Storage layer now handles numeric conversion automatically

### 6. Database Verification (`utils/databaseCleanup.ts`)
- Updated `verifyDatabaseIntegrity()` to check for valid numeric values (0 or 1)
- Removed string-based cleanup functions

## Benefits

### Performance
- Integer comparisons are faster than string comparisons
- Smaller storage footprint (4 bytes vs variable string length)
- More efficient indexing

### Reliability
- No case sensitivity issues
- Type-safe at compile time
- Database CHECK constraint prevents invalid values

### Maintainability
- Centralized enum definition
- Clear conversion points between string and numeric representations
- Easy to add new sender types in the future

## Database Values

| SenderType (Code) | Database Value | Description |
|-------------------|----------------|-------------|
| 'phone'           | 0              | Phone number |
| 'email'           | 1              | Email address |

## Migration Safety

The migration is designed to be safe:
1. **Automatic Detection**: Only runs if needed
2. **Non-Destructive**: Creates new tables before dropping old ones
3. **Case-Insensitive**: Handles 'Phone', 'phone', 'PHONE' correctly
4. **Error Handling**: Logs errors without crashing the app
5. **Verification**: Can verify integrity after migration

## Testing Checklist

- [x] Database schema updated
- [x] Migration function created
- [x] Storage service updated
- [x] SignalR service updated
- [x] Enum utilities created
- [ ] Test with existing database (string values)
- [ ] Test with fresh database
- [ ] Verify messages send/receive correctly
- [ ] Verify conversations created correctly
- [ ] Check queue functionality

## Rollback

If issues occur:
1. The old database cleanup utility is removed
2. Migration creates backups by renaming tables
3. Can restore from device backup if needed

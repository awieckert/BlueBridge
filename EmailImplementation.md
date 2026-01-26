# Implementation Plan: Add Email Address Support to BlueBridge

## Overview

Add email address support to the React Native messaging app alongside existing phone number functionality. Users will be able to send and receive messages to/from both phone numbers and email addresses.

**Backend Status:** ✅ Backend already supports email addresses with `recipientType` field

**UX Decision:** When a contact has both phone and email, show selection dialog to let user choose

## Implementation Approach

**Data Model: Generic Recipient Pattern**

- Replace `phone_number` columns with `recipient` + `recipient_type` columns
- `recipient_type` enum: `'phone' | 'email'`
- Justification: Cleaner architecture, future-proof, simpler queries, better indexing

## Implementation Stages

### Stage 1: Database Migration & Core Types (Foundation)

**1.1 Database Migration** (`utils/database.ts`)

- Add `recipient` (TEXT) and `recipient_type` (TEXT) columns to: `conversations`, `messages`, `queue`
- Migrate existing `phone_number` data to `recipient` with type='phone'
- Add CHECK constraint: `recipient_type IN ('phone', 'email')`
- Create unique index on `(recipient, recipient_type)` for conversations
- Drop old `phone_number` columns after verification
- Use transactions for safe rollback

**1.2 Type Definitions** (`types/message.ts`, `types/api.ts`)

- Add `RecipientType = 'phone' | 'email'` type
- Update `Message` interface: `phoneNumber` → `recipient`, add `recipientType`
- Update `Conversation` interface: `phoneNumber` → `recipient`, add `recipientType`
- Update `QueuedMessage` interface: `phoneNumber` → `recipient`, add `recipientType`
- Update `SendMessageRequest`: `phoneNumber` → `recipient`, add `recipientType`
- Update `ReceiveMessagePayload`: `phoneNumber` → `recipient`, add `recipientType`

### Stage 2: Validation & Utility Layer

**2.1 Email Validation** (Create `utils/email.ts`)

```typescript
export function validateEmail(email: string): boolean;
export function normalizeEmail(email: string): string | null; // Lowercase, trim
export function formatEmailForDisplay(email: string): string;
```

**2.2 Unified Recipient Utilities** (Create `utils/recipient.ts`)

```typescript
export function detectRecipientType(input: string): RecipientType | null;
export function validateRecipient(
  recipient: string,
  type: RecipientType,
): boolean;
export function normalizeRecipient(
  recipient: string,
  type: RecipientType,
): string | null;
export function formatRecipient(recipient: string, type: RecipientType): string;
export function autoNormalizeRecipient(
  input: string,
): { recipient: string; type: RecipientType } | null;
```

**2.3 Keep Existing** (`utils/phoneNumber.ts`)

- No changes needed - still used internally by `recipient.ts`

### Stage 3: Service Layer

**3.1 Storage Service** (`services/storageService.ts`)

- Update all SQL queries: `phone_number` → `recipient`, add `recipient_type` to WHERE clauses
- Rename methods:
  - `getConversationByPhoneNumber()` → `getConversationByRecipient(recipient, type)`
  - `updateConversationContactNameByPhoneNumber()` → `updateConversationContactNameByRecipient()`
- Update `getOrCreateConversation()` signature: add `recipientType` parameter
- Update all row mappings: `phone_number` → `recipient`, add `recipient_type`
- Add backward compatibility wrappers (deprecated) for transition period

**3.2 Contact Service** (`services/contactService.ts`)

- Extend `Contact` interface:
  ```typescript
  emails: string[]        // Normalized emails
  rawEmails: string[]     // Original format
  ```
- Update `fetchContacts()`: Request `Contacts.Fields.Emails` from device
- Normalize and validate emails using `normalizeEmail()`
- Add `lookupContactByEmail(email: string): Contact | null`
- Add `getContactNameByRecipient(recipient: string, type: RecipientType): string | null`
- Update `searchContacts()` to search emails too

**3.3 Message Service** (`services/messageService.ts`)

- Update `sendMessage()` signature:
  ```typescript
  async sendMessage(
    recipient: string,
    recipientType: RecipientType,
    message: string,
    timestamp: number
  ): Promise<SendMessageResponse>
  ```
- Update request payload construction to use new fields

**3.4 SignalR Service** (`services/signalRService.ts`)

- Update `handleIncomingMessage()` validation: check `recipient` and `recipientType` fields
- Use `getContactNameByRecipient()` for contact lookup
- Update `getOrCreateConversation()` call with recipient type
- Handle both phone and email messages uniformly

### Stage 4: State Management

**4.1 Contact Store** (`stores/contactStore.ts`)

- Add `getNameByRecipient(recipient: string, type: RecipientType): string | null`
- Update existing methods to handle emails
- Ensure contact search includes emails

**4.2 Messages Store** (`stores/messagesStore.ts`)

- Verify type compatibility with updated `Message` and `Conversation` interfaces
- No major logic changes expected (types should handle it)

### Stage 5: UI Components

**5.1 New Conversation Screen** (`app/conversation/new.tsx`)

- **Manual Entry Modal:**
  - Add auto-detection: `detectRecipientType()` as user types
  - Show detected type indicator
  - Update keyboard type based on detected type (`phone-pad` vs `email-address`)
  - Validate using `validateRecipient()`
  - Normalize using `normalizeRecipient()`

- **Contact Selection:**
  - When contact has both phone AND email: show selection dialog
  - Dialog displays all phone numbers and emails as separate options
  - User taps to select which method to use
  - Update `handleContactPress()` to accept `recipient` and `recipientType` parameters

- **Search:**
  - Search both phone numbers and emails
  - Show which field matched in results

**5.2 Contact List Item** (`components/ContactListItem.tsx`)

- Update props: `onPress: (recipient: string, type: RecipientType) => void`
- When contact has multiple methods (multiple phones + emails):
  - Show primary method + "+X more" indicator
  - On press: if multiple options, show selection sheet
  - If only one option, call onPress directly
- Add type indicator icons (phone icon vs envelope icon)

**5.3 Conversation Item** (`components/ConversationItem.tsx`)

- Update display name logic:
  ```typescript
  const displayName =
    conversation.contactName ||
    formatRecipient(conversation.recipient, conversation.recipientType);
  ```
- Update avatar letter logic to handle emails properly
- Ensure formatting works for both types

**5.4 Chat Screen** (`app/chat/[conversationId].tsx`)

- Update `handleSendMessage()`: pass `conversation.recipient` and `conversation.recipientType` to `messageService.sendMessage()`
- Update header title: use `formatRecipient(conversation.recipient, conversation.recipientType)`
- Update message object creation to include `recipientType`

## Implementation Order (Dependency Chain)

**Must be done sequentially:**

1. Database migration (`utils/database.ts`) - CRITICAL FIRST STEP
2. Type definitions (`types/message.ts`, `types/api.ts`) - TypeScript will catch all needed updates
3. Email validation (`utils/email.ts`) - NEW FILE
4. Recipient utilities (`utils/recipient.ts`) - NEW FILE

**Can be done in parallel after Step 4:**

5. Storage Service (`services/storageService.ts`)
6. Contact Service (`services/contactService.ts`)
7. Message Service (`services/messageService.ts`)
8. SignalR Service (`services/signalRService.ts`)

**After Step 5-8 complete:**

9. Zustand Stores (`stores/contactStore.ts`, `stores/messagesStore.ts`)

**After Step 9 complete (can be done in parallel):**

10. ContactListItem (`components/ContactListItem.tsx`)
11. ConversationItem (`components/ConversationItem.tsx`)
12. Chat Screen (`app/chat/[conversationId].tsx`)
13. New Conversation Screen (`app/conversation/new.tsx`)

## Critical Files to Modify

| File                              | Lines | Priority | Changes                                     |
| --------------------------------- | ----- | -------- | ------------------------------------------- |
| `utils/database.ts`               | 169   | CRITICAL | Add migration #2, update schema definitions |
| `types/message.ts`                | 37    | CRITICAL | Update all interfaces with recipient/type   |
| `services/storageService.ts`      | 348   | HIGH     | Update all queries and method signatures    |
| `utils/recipient.ts`              | NEW   | HIGH     | Create unified validation/formatting        |
| `utils/email.ts`                  | NEW   | HIGH     | Create email validation utilities           |
| `services/contactService.ts`      | 215   | MEDIUM   | Add email fetching and lookup               |
| `services/signalRService.ts`      | 242   | MEDIUM   | Update incoming message handling            |
| `services/messageService.ts`      | 88    | MEDIUM   | Update API request structure                |
| `app/conversation/new.tsx`        | 525   | MEDIUM   | Add email input, selection dialog           |
| `app/chat/[conversationId].tsx`   | 242   | MEDIUM   | Update message sending                      |
| `types/api.ts`                    | 25    | LOW      | Update request/response types               |
| `stores/contactStore.ts`          | 120   | LOW      | Add recipient lookup methods                |
| `stores/messagesStore.ts`         | 72    | LOW      | Type compatibility check                    |
| `components/ContactListItem.tsx`  | 130   | LOW      | Update display and selection                |
| `components/ConversationItem.tsx` | 186   | LOW      | Update formatting logic                     |

## Edge Cases to Handle

1. **Contact with Both Phone and Email:**
   - ✅ Show selection dialog (per UX decision)
   - Don't create duplicate conversations for same recipient+type
   - Track user's last used method per contact (future enhancement)

2. **Duplicate Recipients:**
   - Database UNIQUE constraint on (recipient, recipient_type) prevents duplicates
   - Handle migration carefully if duplicate phone numbers exist

3. **Normalization:**
   - Email: lowercase, trim whitespace
   - Phone: E.164 format (existing logic)
   - Always normalize before database storage

4. **Validation:**
   - International phone numbers (already handled by libphonenumber-js)
   - Complex email formats (RFC 5322 compliance)
   - Invalid input: show clear error messages

5. **Backward Compatibility:**
   - Migration must preserve all existing phone number conversations
   - Old queued messages must process correctly after migration
   - Keep deprecated methods temporarily for safety

## Verification & Testing

### Database Migration Verification

- [ ] All existing phone numbers migrated to recipient field with type='phone'
- [ ] No data loss during migration
- [ ] UNIQUE constraint works (recipient + type combination)
- [ ] Indexes created successfully
- [ ] Old columns dropped without errors

### Email Validation Testing

- [ ] Valid email formats accepted: `user@example.com`, `name+tag@domain.co.uk`
- [ ] Invalid emails rejected: `invalid`, `@example.com`, `user@`
- [ ] Normalization works: `User@Example.COM` → `user@example.com`

### Contact Service Testing

- [ ] Fetch contacts with emails from device
- [ ] Lookup by email works
- [ ] Lookup by phone still works
- [ ] Search finds both phones and emails

### Message Flow Testing

- [ ] Send message to phone number (existing flow)
- [ ] Send message to email address (new flow)
- [ ] Receive message from phone number via SignalR
- [ ] Receive message from email address via SignalR
- [ ] Failed messages queue correctly for both types

### UI Testing

- [ ] Manual entry with phone number: auto-detects as 'phone'
- [ ] Manual entry with email: auto-detects as 'email'
- [ ] Contact with only phone: creates conversation directly
- [ ] Contact with only email: creates conversation directly
- [ ] Contact with both: shows selection dialog
- [ ] Conversation list displays both types correctly
- [ ] Chat header shows formatted phone or email
- [ ] Messages send successfully for both types

### Integration Testing

- [ ] Create conversation with email → send message → receive response
- [ ] Create conversation with phone → send message → receive response
- [ ] Existing conversations still work after migration
- [ ] Search finds conversations by email
- [ ] Search finds conversations by phone
- [ ] Contact name resolution works for both types

## Rollback Strategy

If issues arise during migration:

1. **Keep old columns initially** - Don't drop `phone_number` columns until migration verified
2. **Transaction-based migration** - Full rollback capability
3. **Verification step** - Compare row counts before/after migration
4. **Gradual rollout** - Test with subset of data first
5. **Database backup** - Create backup before migration

## Notes

- Backend already supports email (confirmed by user)
- No backend coordination required
- All changes are client-side only
- Keep libphonenumber-js dependency for phone validation
- Use standard RFC 5322 regex for email validation
- Maintain consistent normalization for reliable lookups

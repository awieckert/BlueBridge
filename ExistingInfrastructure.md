# Existing Infrastructure - BlueBridge-Windows

**Last Updated**: 2026-01-24

## Table of Contents
- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Implementation Details](#implementation-details)
  - [Sending Messages](#sending-messages)
  - [Receiving Messages](#receiving-messages)
- [Data Models](#data-models)
- [Key Features](#key-features)
- [Configuration](#configuration)

---

## Project Overview

**BlueBridge-Windows** is a React/TypeScript web application that enables users to send and receive iMessage texts through a Mac server running BlueBridge-Relay. The application was built as Phase 1 of a project that will eventually become a React Native Android app.

### Purpose
- Send iMessages via HTTP POST requests to a Mac server
- Receive real-time iMessages via SignalR WebSocket connection
- Provide a simple, clean web interface for iMessage communication

### System Architecture
```
┌─────────────────────┐         HTTP POST          ┌──────────────────┐
│  BlueBridge-Windows │ ──────────────────────────► │  BlueBridge-Relay│
│   (React/Vite)      │                             │   (.NET 8 API)   │
│                     │        WebSocket            │                  │
│                     │ ◄────────────────────────── │    (Mac Server)  │
└─────────────────────┘        (SignalR)            └────────┬─────────┘
                                                             │
                                                             ▼
                                                      ┌──────────────┐
                                                      │   iMessage   │
                                                      │ (Messages.app)│
                                                      └──────────────┘
```

---

## Architecture

### Communication Patterns

**Outbound (Send Messages)**
1. User inputs phone number and message in React UI
2. Client sends HTTP POST to `/api/messages` endpoint
3. Mac server executes AppleScript to send via Messages.app
4. Server returns success/failure response

**Inbound (Receive Messages)**
1. Mac server monitors Messages database for new messages
2. When new message detected, server pushes to SignalR hub
3. Connected clients receive message via `ReceiveMessage` event
4. If client disconnected, messages queued for delivery on reconnect

---

## Technology Stack

### Frontend
- **Framework**: React 18+
- **Build Tool**: Vite
- **Language**: TypeScript
- **Package Manager**: Yarn
- **Real-time Communication**: @microsoft/signalr (v8.0.0)

### Backend (Mac Server)
- **Platform**: .NET 8 Web API
- **Real-time**: SignalR with WebSocket protocol
- **iMessage Integration**: AppleScript + SQLite database monitoring
- **OS**: macOS 11.7.10+

### Communication Protocols
- **HTTP/REST**: For sending messages
- **WebSocket (SignalR)**: For receiving messages
- **Authentication**: API key-based (BB-API-Key header)

---

## Implementation Details

### Sending Messages

**File**: `src/services/messageService.ts`

**Function**: `sendMessage(phoneNumber: string, messageText: string)`

#### Request Specification
- **Method**: POST
- **Endpoint**: `${VITE_API_BASE_URL}/api/messages`
- **Headers**:
  - `Content-Type: application/json`
  - `BB-API-KEY: ${apiKey}` (from environment)
- **Body**:
  ```json
  {
    "phoneNumber": "1234567890",
    "message": "Message text",
    "timestamp": "2026-01-24T12:00:00.000Z"
  }
  ```

#### Response Handling
- **Success (200 OK)**: Returns `{ success: true, message: "..." }`
- **Server Error (4xx/5xx)**: Throws error with status code
- **Network Error**: Returns user-friendly network error message

#### Error Handling Strategy
- Catches `TypeError` for network failures (server unreachable)
- Logs all errors to console for debugging
- Returns structured `MessageResponse` with success flag and error details
- Provides user-friendly error messages

---

### Receiving Messages

**File**: `src/services/signalRService.ts`

**Class**: `SignalRService` (Singleton Pattern)

#### Connection Configuration

**Hub URL**: `${VITE_SIGNALR_HUB_URL}/hubs/messages` (default: `http://localhost:5067/hubs/messages`)

**Authentication**:
- API key passed via `accessTokenFactory` (required for WebSocket handshake)
- Also included in `headers` for initial HTTP negotiation

**Connection Options**:
```typescript
{
  accessTokenFactory: () => apiKey,
  headers: { 'BB-API-Key': apiKey }
}
```

**Reconnection Strategy**:
- Automatic reconnection enabled
- Exponential backoff: [0ms, 2s, 5s, 10s, 30s]
- Maximum 5 reconnection attempts before giving up

**Logging Level**: Information (configurable)

#### Event Handlers

**Server-to-Client Events**:

1. **ReceiveMessage** - Individual incoming message
   - Payload: `IncomingMessage` object
   - Triggers all registered message handlers
   - Fires in real-time as messages arrive

2. **ReceiveQueuedMessages** - Batch of queued messages
   - Payload: `IncomingMessage[]` array
   - Fires on reconnection to deliver missed messages
   - Can be manually triggered via `GetQueuedMessages()` hub method

**Connection Lifecycle Events**:

1. **onclose** - Connection closed
   - Updates state to 'disconnected'
   - Provides error details if available

2. **onreconnecting** - Reconnection attempt started
   - Updates state to 'reconnecting'
   - Called before each retry attempt

3. **onreconnected** - Successfully reconnected
   - Updates state to 'connected'
   - Provides new connection ID

#### Connection Management

**Connection States**:
- `disconnected` - Not connected
- `connecting` - Connection in progress
- `connected` - Active connection
- `reconnecting` - Attempting to reconnect
- `error` - Connection failed

**Connection Flow**:
1. `connect()` called by application
2. Check if already connecting (prevents duplicates)
3. Initialize connection if first time
4. Perform connection and update state
5. Return promise that resolves when connected

**Duplicate Connection Prevention**:
- Stores active connection promise
- Returns existing promise if connection in progress
- Prevents multiple simultaneous connection attempts

#### Observable Pattern

**Handler Registration**:
- `onMessage(handler)` - Subscribe to individual messages
- `onQueuedMessages(handler)` - Subscribe to queued message batches
- `onConnectionStateChange(handler)` - Subscribe to connection state updates

**Handler Cleanup**:
- All `on*` methods return cleanup function
- Call returned function to unsubscribe
- Prevents memory leaks in React components

**Handler Storage**:
- Uses `Set<Handler>` for efficient add/remove
- Supports multiple simultaneous subscriptions
- Handlers called in registration order

---

## Data Models

**File**: `src/types/message.ts`

### Outbound Message (Sending)
```typescript
interface Message {
  phoneNumber: string;    // Target phone number
  message: string;        // Message text content
  timestamp: string;      // ISO 8601 timestamp
}
```

### Message Response
```typescript
interface MessageResponse {
  success: boolean;       // Operation success flag
  message?: string;       // Success message
  error?: string;         // Error description
}
```

### Inbound Message (Receiving)
```typescript
interface IncomingMessage {
  messageId: number;           // Unique ID from Messages database
  sender: string;              // Phone number or email of sender
  text: string;                // Message content
  conversationId: string;      // Chat identifier (usually same as sender)
  timestamp: string;           // When message was sent (local time)
  receivedAtServer: string;    // When server detected message (UTC)
}
```

### Connection State
```typescript
type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

interface ConnectionState {
  status: ConnectionStatus;
  error?: string;           // Error message if status is 'error'
  lastConnected?: Date;     // Timestamp of last successful connection
}
```

---

## Key Features

### 1. Message Queueing
- Server queues messages when client disconnected
- Queued messages delivered via `ReceiveQueuedMessages` event on reconnect
- Manual queue retrieval via `GetQueuedMessages()` hub method

### 2. Automatic Reconnection
- Exponential backoff strategy prevents server overload
- Connection state tracking for UI feedback
- Automatic queue flush on reconnection

### 3. Type Safety
- Full TypeScript typing throughout application
- Type-safe event handlers and payloads
- Compile-time validation of data structures

### 4. Separation of Concerns
- Services layer handles all API/SignalR communication
- Components only handle UI and user interaction
- Types defined separately for reusability

### 5. Error Handling
- Network error detection and user-friendly messages
- Server error logging for debugging
- Graceful degradation when connection fails

### 6. Singleton Pattern for SignalR
- Single connection instance across application
- Prevents multiple concurrent connections
- Centralized connection state management

---

## Configuration

### Environment Variables

**Required**:
- `VITE_API_BASE_URL` - Base URL for HTTP API (e.g., `http://192.168.1.50:5067`)
- `VITE_API_ENDPOINT` - Endpoint path for sending messages (default: `/api/messages`)
- `VITE_SIGNALR_HUB_URL` - SignalR hub URL (e.g., `http://192.168.1.50:5067/hubs/messages`)
- `VITE_API_KEY` - Authentication key for API access

**Example** (`.env` file):
```bash
VITE_API_BASE_URL=http://192.168.1.50:5067
VITE_API_ENDPOINT=/api/messages
VITE_SIGNALR_HUB_URL=http://192.168.1.50:5067/hubs/messages
VITE_API_KEY=your-secure-api-key-here
```

### Default Ports
- **HTTP**: 5067
- **HTTPS**: 7090

### Network Discovery
The Mac server provides a discovery endpoint at `/api/health/network` that returns:
- Available network interfaces
- SignalR hub URLs
- API base URLs
- Port numbers

This enables automatic server discovery without manual configuration.

---

## Success Criteria (Original Requirements)

✅ User can type text message in input field
✅ User can send message via HTTP POST
✅ Properly formatted JSON sent to server
✅ Success feedback displayed
✅ Error feedback displayed
✅ Empty message validation
✅ TypeScript typing throughout
✅ Responsive desktop browser support

**Additional Features Implemented**:
✅ Real-time message receiving via SignalR
✅ Automatic reconnection with backoff
✅ Message queueing for offline clients
✅ Connection state tracking
✅ API key authentication

---

## Next Steps

This infrastructure provides a solid foundation for:
1. Migration to React Native for Android
2. Enhanced UI/UX for message display
3. Conversation threading and history
4. User authentication and profiles
5. Push notifications
6. Multi-user support

# Mobile Support Chat Integration Guide

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/support/message` | Start conversation OR send message |
| GET | `/api/support/conversation/:conversationId` | Get messages |

---

## 1. Start Conversation (Just Phone)

```json
POST /api/support/message
{ "phone": "9876543210" }
```

---

## 2. Send Message

```json
POST /api/support/message
{ "conversationId": "...", "content": "Hello" }
```

---

## 3. Socket.io Events (Real-Time)

### Connect & Register
```dart
socket = IO.io('http://SERVER:8000', { 'transports': ['websocket'] });
socket.emit('registerSupport', { 'phone': '9876543210' });
```

### Listen for Events

| Event | Description |
|-------|-------------|
| `newSupportMessage` | Admin sent a reply |
| `adminOnline` | Admin joined your chat (viewing it now) |
| `adminOffline` | Admin left your chat |
| `adminTyping` | Admin is typing |

```dart
// Admin is online (viewing your chat)
socket.on('adminOnline', (data) {
  // data['adminName'] = "Support Agent"
  // data['message'] = "A support agent has joined the chat"
  showToast("Support agent is online!");
});

// Admin left
socket.on('adminOffline', (data) {
  showToast("Support agent left the chat");
});

// Admin typing
socket.on('adminTyping', (data) {
  // data['isTyping'] = true/false
});

// New message from admin
socket.on('newSupportMessage', (data) {
  // data['message']['content'] = "..."
});
```

---

## Flow

1. `POST /message { phone }` → Get `conversationId`
2. Connect WebSocket: `registerSupport({ phone })`
3. User gets notified when admin joins (`adminOnline`)
4. User receives messages (`newSupportMessage`)
5. User sees typing indicator (`adminTyping`)

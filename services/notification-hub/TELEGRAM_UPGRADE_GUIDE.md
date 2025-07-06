# 🤖 Telegram Service Upgrade Guide

## 📋 Tổng quan

TelegramService đã được upgrade từ `node-telegram-bot-api` sang **grammy framework** với những cải tiến lớn về performance, type safety và notification logic.

## 🔥 **Vấn đề được Fix**

### ❌ **Vấn đề cũ: allowedChats**
```typescript
// Logic cũ - CHẶN tất cả notifications nếu có allowedChats
if (this.allowedChats.size > 0 && !this.allowedChats.has(message.chatId)) {
  logger.warn(`Chat ${message.chatId} not in allowed list`);
  return false; // ❌ CHẶN LUÔN!
}
```

**Hậu quả:** Nếu set `TELEGRAM_ALLOWED_CHATS`, bot sẽ **không gửi notification nào** ngoài danh sách đó!

### ✅ **Giải pháp mới: adminChats + blockedChats**
```typescript
// Logic mới - Smart access control
// 1. Admin chats: Chỉ dành cho commands (/stats, /health)
// 2. Blocked chats: Blacklist thay vì whitelist
// 3. Notifications: Gửi tự do (trừ blocked)

// Check if chat is blocked
if (this.blockedChats.has(message.chatId)) {
  this.messageStats.blocked++;
  logger.warn(`Chat ${message.chatId} is blocked`);
  return false; // ❌ Chỉ chặn blocked chats
}
// ✅ Còn lại gửi tự do!
```

## 🚀 **Ưu điểm của grammy**

### 1. **Type Safety**
```typescript
// grammy có full TypeScript support
import { Bot, Context, InlineKeyboard } from 'grammy';

// Auto-completion và type checking
const keyboard = new InlineKeyboard()
  .url('🚀 Open App', 'https://app.moonx.farm')
  .row()
  .url('📊 Charts', 'https://app.moonx.farm/charts');
```

### 2. **Performance & Rate Limiting**
```typescript
// Built-in middlewares
import { autoRetry } from '@grammyjs/auto-retry';
import { apiThrottler } from '@grammyjs/transformer-throttler';

// Auto-retry failed requests
bot.api.config.use(autoRetry());

// Smart rate limiting (30 msg/second)
bot.api.config.use(apiThrottler({
  maxConcurrentCalls: 30,
  minDelayMs: 33 // ~33ms between calls
}));
```

### 3. **Better Error Handling**
```typescript
// Automatic error detection & handling
if (error.message.includes('Too Many Requests')) {
  this.messageStats.rateLimit++;
  logger.warn(`Rate limit hit for chat ${chatId}`);
} else if (error.message.includes('USER_DEACTIVATED')) {
  // Auto-add to blocked list
  this.addBlockedChat(chatId);
  logger.warn(`Chat ${chatId} blocked bot`);
}
```

## 🔧 **Configuration Changes**

### Environment Variables (Cũ → Mới)
```bash
# ❌ CŨ: allowedChats (quá strict)
TELEGRAM_ALLOWED_CHATS=chat1,chat2,chat3

# ✅ MỚI: adminChats + blockedChats (linh hoạt)
TELEGRAM_ADMIN_CHATS=-1001234567890,-1001234567891  # Admin commands
TELEGRAM_BLOCKED_CHATS=                              # Blocked users (empty = none)
TELEGRAM_RATE_LIMIT=30                              # Rate limiting
```

### TelegramConfig Interface
```typescript
interface TelegramConfig {
  botToken: string;
  webhookUrl?: string;
  adminChats?: string[];      // 🆕 Admin commands only
  blockedChats?: string[];    // 🆕 Blacklist
  enablePolling?: boolean;    // 🆕 Polling mode
  rateLimitPerSecond?: number; // 🆕 Rate limiting
}
```

## 📊 **New Features**

### 1. **Admin Commands**
```typescript
// Chỉ admin chats mới có thể sử dụng
/start   - Admin panel
/stats   - Bot statistics
/health  - Health check
/test    - Send test notification
```

### 2. **Message Statistics**
```typescript
interface MessageStats {
  total: number;      // Tổng số messages
  success: number;    // Gửi thành công
  failed: number;     // Gửi thất bại
  blocked: number;    // Bị chặn
  rateLimit: number;  // Rate limit hits
}
```

### 3. **Smart Auto-blocking**
```typescript
// Tự động block users khi:
// - User deactivated account
// - User blocked bot
// - Chat not found
if (error.message.includes('USER_DEACTIVATED')) {
  this.addBlockedChat(chatId);
}
```

## 🎯 **Usage Examples**

### Send Notification (Ai cũng nhận được)
```typescript
// ✅ Gửi tới bất kì user nào (trừ blocked)
await telegramService.sendNotification(
  'user_chat_id',
  '📈 Price Alert',
  'BTC has reached $50,000!',
  { type: 'price_alert', symbol: 'BTC' }
);
```

### Admin Management
```typescript
// Add/remove admin chats
telegramService.addAdminChat('-1001234567890');
telegramService.removeAdminChat('-1001234567890');

// Block/unblock users
telegramService.addBlockedChat('spam_user_id');
telegramService.removeBlockedChat('user_id');
```

### Enhanced Keyboard
```typescript
// grammy InlineKeyboard API
const keyboard = new InlineKeyboard()
  .url('🚀 Open App', 'https://app.moonx.farm')
  .url('📊 Charts', 'https://app.moonx.farm/charts')
  .row()
  .url('💼 Portfolio', 'https://app.moonx.farm/portfolio')
  .url('⚙️ Settings', 'https://app.moonx.farm/settings');
```

## 🔄 **Migration Steps**

### 1. Update Environment
```bash
# Remove old config
# TELEGRAM_ALLOWED_CHATS=chat1,chat2,chat3

# Add new config
TELEGRAM_ADMIN_CHATS=-1001234567890    # Your admin chat ID
TELEGRAM_BLOCKED_CHATS=                # Empty initially
TELEGRAM_RATE_LIMIT=30
```

### 2. Install Dependencies
```bash
npm install grammy @grammyjs/auto-retry @grammyjs/transformer-throttler
npm uninstall node-telegram-bot-api @types/node-telegram-bot-api
```

### 3. Test Notifications
```bash
# Test với admin chat
curl -X POST http://localhost:3008/test/telegram \
  -H "Content-Type: application/json" \
  -d '{"chatId": "YOUR_ADMIN_CHAT_ID", "message": "Test"}'

# Test với user chat
curl -X POST http://localhost:3008/test/telegram \
  -H "Content-Type: application/json" \
  -d '{"chatId": "ANY_USER_CHAT_ID", "message": "Test"}'
```

### 4. Verify Stats
```bash
# Send /stats command to admin chat
# Should see message statistics
```

## 🚨 **Breaking Changes**

### Configuration
- ❌ `TELEGRAM_ALLOWED_CHATS` → ✅ `TELEGRAM_ADMIN_CHATS`
- ❌ `allowedChats` config → ✅ `adminChats` + `blockedChats`

### Behavior
- ❌ Whitelist approach → ✅ Blacklist approach
- ❌ Block all non-allowed → ✅ Send to all (except blocked)

### Interface
- ❌ `TelegramKeyboard` → ✅ `InlineKeyboard` (grammy)
- ❌ String-based methods → ✅ Builder pattern

## ✅ **Benefits Summary**

| Aspect | Cũ (node-telegram-bot-api) | Mới (grammy) |
|--------|---------------------------|--------------|
| **Notifications** | ❌ Bị chặn bởi allowedChats | ✅ Gửi tự do (trừ blocked) |
| **Type Safety** | ❌ JavaScript-style | ✅ Full TypeScript |
| **Performance** | ❌ Manual rate limiting | ✅ Built-in optimizations |
| **Error Handling** | ❌ Basic try/catch | ✅ Smart error detection |
| **Admin Features** | ❌ No built-in commands | ✅ Rich admin panel |
| **Statistics** | ❌ No tracking | ✅ Comprehensive metrics |
| **Auto-management** | ❌ Manual blocked list | ✅ Auto-block bad users |

## 🎉 **Result**

**Trước:** `allowedChats` chặn tất cả notifications ❌
**Sau:** Notifications gửi tự do, chỉ admin commands bị restrict ✅

**Perfect!** 🚀 
# 🚀 MoonX Farm System Notification Test

## ⚙️ **Configuration**
```bash
export NOTIFICATION_HUB_URL="http://localhost:3008"
export ADMIN_API_KEY="your-admin-api-key-here"
```

## 📋 **1. Create System Rule**

```bash
curl -X POST "${NOTIFICATION_HUB_URL}/api/v1/rules/create" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${ADMIN_API_KEY}" \
  -d @create-system-rule.json
```

## 🧪 **2. Test System Notification**

```bash
curl -X POST "${NOTIFICATION_HUB_URL}/api/v1/notifications/system" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${ADMIN_API_KEY}" \
  -d @test-system-notification.json
```

## 🔍 **3. Check Rules Status**

```bash
curl -X GET "${NOTIFICATION_HUB_URL}/api/v1/rules/list" \
  -H "X-API-Key: ${ADMIN_API_KEY}"
```

## 📊 **4. Check Connection Status**

```bash
curl -X GET "${NOTIFICATION_HUB_URL}/api/system/health" \
  -H "X-API-Key: ${ADMIN_API_KEY}"
```

## 🎯 **Expected Flow:**
1. Create system rule ✅
2. WebSocket connects and joins `user:${userId}` room ✅ 
3. Send test notification ✅
4. Frontend receives notification via WebSocket ✅
5. System alert appears in UI ✅

## 🔧 **Debug Commands:**

### Check WebSocket connections:
```bash
curl -X GET "${NOTIFICATION_HUB_URL}/api/system/connections" \
  -H "X-API-Key: ${ADMIN_API_KEY}"
```

### Check user rooms:
```bash
curl -X GET "${NOTIFICATION_HUB_URL}/api/system/rooms" \
  -H "X-API-Key: ${ADMIN_API_KEY}"
``` 
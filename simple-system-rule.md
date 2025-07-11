# 📋 MoonX Farm - Single System Rule

## ⚙️ **Configuration**
```bash
export NOTIFICATION_HUB_URL="http://localhost:3008"
export ADMIN_API_KEY="your-admin-api-key-here"
```

## 🚀 **1. Create System Rule**

```bash
curl -X POST "${NOTIFICATION_HUB_URL}/api/v1/rules/create" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${ADMIN_API_KEY}" \
  -d '{
    "name": "System Announcements",
    "description": "Official system announcements for MoonX Farm platform",
    "conditions": {
      "type": "system_event",
      "parameters": {
        "eventType": "system_announcement",
        "source": "admin_panel"
      }
    },
    "actions": [
      {
        "type": "notification",
        "parameters": {
          "channels": ["websocket", "push"],
          "priority": "medium"
        }
      }
    ],
    "priority": "medium",
    "enabled": true,
    "schedule": {
      "type": "immediate",
      "parameters": {}
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "rule": {
    "id": "rule_1234567890abcdef",
    "name": "System Announcements",
    "enabled": true,
    "priority": "medium",
    "createdAt": "2024-12-15T10:30:00.000Z"
  }
}
```

## 🧪 **2. Test System Rule**

```bash
# Replace RULE_ID with actual rule ID from step 1
RULE_ID="rule_1234567890abcdef"

curl -X POST "${NOTIFICATION_HUB_URL}/api/v1/rules/${RULE_ID}/test" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${ADMIN_API_KEY}" \
  -d '{
    "testData": {
      "title": "🚀 MoonX Farm System Update",
      "body": "New features and improvements are now live. Check out the latest updates!",
      "category": "system_update",
      "priority": "medium",
      "actionUrl": "/updates"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Test notification sent",
  "notificationId": "notif_1234567890abcdef"
}
```

## 📊 **3. Manage System Rule**

### **3.1 Check Rule Details**
```bash
curl -X GET "${NOTIFICATION_HUB_URL}/api/v1/rules/${RULE_ID}" \
  -H "X-API-Key: ${ADMIN_API_KEY}"
```

### **3.2 List All Rules**
```bash
curl -X GET "${NOTIFICATION_HUB_URL}/api/v1/rules/list" \
  -H "X-API-Key: ${ADMIN_API_KEY}"
```

### **3.3 Disable Rule**
```bash
curl -X PATCH "${NOTIFICATION_HUB_URL}/api/v1/rules/${RULE_ID}/toggle" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${ADMIN_API_KEY}" \
  -d '{"enabled": false}'
```

### **3.4 Enable Rule**
```bash
curl -X PATCH "${NOTIFICATION_HUB_URL}/api/v1/rules/${RULE_ID}/toggle" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${ADMIN_API_KEY}" \
  -d '{"enabled": true}'
```

## 🎯 **4. Real Usage Examples**

### **4.1 New Feature Announcement**
```bash
curl -X POST "${NOTIFICATION_HUB_URL}/api/v1/rules/${RULE_ID}/test" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${ADMIN_API_KEY}" \
  -d '{
    "testData": {
      "title": "🚀 New Trading Feature",
      "body": "Advanced order types are now available. Try Stop Loss and Take Profit orders!",
      "category": "feature_release",
      "actionUrl": "/trading/advanced-orders"
    }
  }'
```

### **4.2 Maintenance Notice**
```bash
curl -X POST "${NOTIFICATION_HUB_URL}/api/v1/rules/${RULE_ID}/test" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${ADMIN_API_KEY}" \
  -d '{
    "testData": {
      "title": "⚠️ Scheduled Maintenance",
      "body": "System maintenance on Dec 15, 2024 from 02:00-04:00 UTC. Trading will be unavailable.",
      "category": "maintenance",
      "priority": "high",
      "actionUrl": "/maintenance-schedule"
    }
  }'
```

### **4.3 Security Alert**
```bash
curl -X POST "${NOTIFICATION_HUB_URL}/api/v1/rules/${RULE_ID}/test" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${ADMIN_API_KEY}" \
  -d '{
    "testData": {
      "title": "🔒 Security Update",
      "body": "Enhanced security measures implemented. Please review your account settings.",
      "category": "security_update",
      "priority": "high",
      "actionUrl": "/security-settings"
    }
  }'
```

## 🔍 **5. Quick Commands**

### **Health Check**
```bash
curl -X GET "${NOTIFICATION_HUB_URL}/api/v1/system/health"
```

### **Delete Rule** (if needed)
```bash
curl -X DELETE "${NOTIFICATION_HUB_URL}/api/v1/rules/${RULE_ID}" \
  -H "X-API-Key: ${ADMIN_API_KEY}"
```

---

## 📝 **Workflow:**

1. ✅ **Create rule** → Get `rule_id`
2. ✅ **Test rule** → Send real notification
3. ✅ **Check WebSocket** → User receives notification
4. ✅ **Use in production** → Real system announcements

**💡 Save the rule ID for future use!** 
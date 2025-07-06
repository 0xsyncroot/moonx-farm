# 📋 **Notification Hub API Documentation**

## 📖 **Overview**

**Notification Hub** là service trung tâm quản lý hệ thống thông báo của MoonXFarm. API được thiết kế theo RESTful principles với JWT authentication cho user endpoints và X-API-Key authentication cho admin endpoints.

### **Base URL**
```
Production: https://moonx.farm/notification-hub
Development: http://localhost:3008
```

### **API Version**
Tất cả endpoints đều có prefix `/api/v1/`

### **Authentication**
- **JWT Bearer Token**: User endpoints yêu cầu `Authorization: Bearer <token>`
- **X-API-Key**: Admin endpoints yêu cầu `X-API-Key: <admin_api_key>`
- **User Context**: UserId được lấy từ JWT payload, không cần truyền trong URL

---

## 🔐 **Authentication Flow**

### **User Authentication (JWT)**
```http
Authorization: Bearer <jwt_token>
```

**Token Verification**:
- Token được verify qua Auth Service tại `/api/v1/auth/verify`
- Token timeout: 5 seconds
- User phải có `isActive: true`
- UserId được extract từ token payload để đảm bảo user chỉ truy cập data của mình

**User Context Protection**:
- User endpoints sử dụng userId từ JWT payload
- Không thể truy cập data của user khác
- Đơn giản hóa API calls (không cần truyền userId trong URL)

### **Admin Authentication (X-API-Key)**
```http
X-API-Key: <admin_api_key>
```

**Admin API Key**:
- Được cấu hình trong environment variable `ADMIN_API_KEY`
- Chỉ dùng cho admin endpoints (`/api/v1/rules/*`)
- Không có expiration time
- Cần được generate securely và rotate định kỳ

---

## 📊 **System Endpoints** `/api/v1/system`

### **Health Check**
```http
GET /api/v1/system/health
```

**Description**: Kiểm tra trạng thái hoạt động của hệ thống và các services

**Authentication**: ❌ Không yêu cầu

**Response**:
```json
{
  "status": "healthy" | "unhealthy" | "error",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "redis": true,
    "database": true,
    "kafka": true,
    "kafkaConsumerPool": true
  }
}
```

**HTTP Status Codes**:
- `200`: Healthy
- `503`: Unhealthy
- `500`: Error

---

### **Metrics**
```http
GET /api/v1/system/metrics
```

**Description**: Lấy metrics Prometheus cho monitoring và alerting

**Authentication**: ❌ Không yêu cầu

**Response**: Plain text format metrics theo chuẩn Prometheus

**Content-Type**: `text/plain`

---

### **Analytics**
```http
GET /api/v1/system/analytics?period=24h
```

**Description**: Lấy thống kê analytics của hệ thống thông báo

**Authentication**: ❌ Không yêu cầu

**Query Parameters**:
- `period` (string, optional): Khoảng thời gian phân tích (default: '24h')

**Response**:
```json
{
  "success": true,
  "analytics": {
    "totalNotifications": 1000,
    "deliveryRate": 95.5,
    "channelBreakdown": {
      "websocket": 400,
      "email": 300,
      "push": 200,
      "telegram": 100
    }
  }
}
```

---

### **Server Status**
```http
GET /api/v1/system/status
```

**Description**: Lấy thông tin trạng thái runtime của server

**Authentication**: ❌ Không yêu cầu

**Response**:
```json
{
  "uptime": 3600,
  "memory": {
    "rss": 52428800,
    "heapTotal": 20971520,
    "heapUsed": 15728640,
    "external": 1048576
  },
  "cpu": {
    "user": 1000000,
    "system": 500000
  },
  "nodeVersion": "v18.17.0",
  "platform": "linux",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 🔧 **Rules Management** `/api/v1/rules`

### **Create Rule**
```http
POST /api/v1/rules/create
X-API-Key: <admin_api_key>
```

**Description**: Tạo notification rule mới cho admin/system

**Authentication**: ⭐ Yêu cầu Admin X-API-Key

**Request Body**:
```json
{
  "name": "BTC Price Alert",
  "description": "Alert when BTC price changes significantly",
  "conditions": {
    "type": "price_change",
    "parameters": {
      "symbol": "BTC",
      "threshold": 5
    }
  },
  "actions": [
    {
      "type": "notification",
      "parameters": {
        "channels": ["websocket", "push"]
      }
    }
  ],
  "priority": "high",
  "enabled": true,
  "userId": "user123",
  "targetUsers": ["user123", "user456"],
  "schedule": {
    "type": "immediate",
    "parameters": {}
  }
}
```

**Response**:
```json
{
  "success": true,
  "rule": {
    "id": "rule_123",
    "name": "BTC Price Alert",
    "description": "Alert when BTC price changes significantly",
    "conditions": { ... },
    "actions": [ ... ],
    "priority": "high",
    "enabled": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### **List Rules**
```http
GET /api/v1/rules/list?userId=user123&enabled=true
X-API-Key: <admin_api_key>
```

**Description**: Lấy danh sách tất cả notification rules

**Authentication**: ⭐ Yêu cầu Admin X-API-Key

**Query Parameters**:
- `userId` (string, optional): Lọc theo user ID
- `enabled` (boolean, optional): Lọc theo trạng thái enabled

**Response**:
```json
{
  "success": true,
  "rules": [
    {
      "id": "rule_123",
      "name": "BTC Price Alert",
      "enabled": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### **Get Rule**
```http
GET /api/v1/rules/:ruleId
X-API-Key: <admin_api_key>
```

**Description**: Lấy thông tin chi tiết một rule cụ thể

**Authentication**: ⭐ Yêu cầu Admin X-API-Key

**Response**:
```json
{
  "success": true,
  "rule": {
    "id": "rule_123",
    "name": "BTC Price Alert",
    "description": "Alert when BTC price changes significantly",
    "conditions": { ... },
    "actions": [ ... ],
    "priority": "high",
    "enabled": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### **Update Rule**
```http
PUT /api/v1/rules/:ruleId
X-API-Key: <admin_api_key>
```

**Description**: Cập nhật thông tin một rule

**Authentication**: ⭐ Yêu cầu Admin X-API-Key

**Request Body**: Các fields cần update (partial)
```json
{
  "name": "Updated BTC Price Alert",
  "priority": "medium",
  "enabled": false
}
```

**Response**:
```json
{
  "success": true,
  "rule": {
    "id": "rule_123",
    "name": "Updated BTC Price Alert",
    "priority": "medium",
    "enabled": false,
    "updatedAt": "2024-01-01T01:00:00.000Z"
  }
}
```

---

### **Delete Rule**
```http
DELETE /api/v1/rules/:ruleId
X-API-Key: <admin_api_key>
```

**Description**: Xóa một rule

**Authentication**: ⭐ Yêu cầu Admin X-API-Key

**Response**:
```json
{
  "success": true,
  "message": "Notification rule deleted successfully"
}
```

---

### **Toggle Rule**
```http
PATCH /api/v1/rules/:ruleId/toggle
X-API-Key: <admin_api_key>
```

**Description**: Bật/tắt một rule

**Authentication**: ⭐ Yêu cầu Admin X-API-Key

**Request Body**:
```json
{
  "enabled": true
}
```

**Response**:
```json
{
  "success": true,
  "rule": {
    "id": "rule_123",
    "enabled": true,
    "updatedAt": "2024-01-01T01:00:00.000Z"
  }
}
```

---

### **Test Rule**
```http
POST /api/v1/rules/:ruleId/test
X-API-Key: <admin_api_key>
```

**Description**: Test trigger rule thủ công

**Authentication**: ⭐ Yêu cầu Admin X-API-Key

**Request Body**:
```json
{
  "testData": {
    "symbol": "BTC",
    "price": 50000
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Test notification sent",
  "notificationId": "notif_123"
}
```

---

## 👤 **User Preferences** `/api/v1/preferences`

### **Get User Preferences**
```http
GET /api/v1/preferences
Authorization: Bearer <jwt_token>
```

**Description**: Lấy preferences thông báo của user (userId từ JWT payload)

**Authentication**: ✅ Yêu cầu JWT token

**Response**:
```json
{
  "success": true,
  "preferences": {
    "userId": "user123",
    "channels": {
      "websocket": true,
      "email": false,
      "push": true,
      "telegram": false
    },
    "notifications": {
      "priceAlerts": true,
      "volumeAlerts": true,
      "whaleAlerts": true,
      "walletActivity": true,
      "systemAlerts": true,
      "tradingSignals": false,
      "marketNews": false,
      "portfolio": true
    },
    "frequency": {
      "immediate": true,
      "hourly": false,
      "daily": false,
      "weekly": false
    },
    "quietHours": {
      "enabled": false,
      "startTime": "22:00",
      "endTime": "08:00",
      "timezone": "UTC"
    },
    "filters": {
      "minPriceChange": 5,
      "minVolumeThreshold": 100000,
      "minTransactionAmount": 10000,
      "watchedTokens": ["BTC", "ETH"],
      "ignoredTokens": ["DOGE"]
    }
  }
}
```

---

### **Update User Preferences**
```http
PUT /api/v1/preferences
Authorization: Bearer <jwt_token>
```

**Description**: Cập nhật toàn bộ preferences của user (userId từ JWT payload)

**Authentication**: ✅ Yêu cầu JWT token

**Request Body**: UserPreferences object đầy đủ
```json
{
  "userId": "user123",
  "channels": {
    "websocket": true,
    "email": true,
    "push": true,
    "telegram": false
  },
  "notifications": {
    "priceAlerts": true,
    "volumeAlerts": false,
    "whaleAlerts": true,
    "walletActivity": true,
    "systemAlerts": true,
    "tradingSignals": false,
    "marketNews": false,
    "portfolio": true
  },
  "frequency": {
    "immediate": false,
    "hourly": true,
    "daily": false,
    "weekly": false
  },
  "quietHours": {
    "enabled": true,
    "startTime": "22:00",
    "endTime": "08:00",
    "timezone": "Asia/Ho_Chi_Minh"
  },
  "filters": {
    "minPriceChange": 10,
    "minVolumeThreshold": 500000,
    "minTransactionAmount": 50000,
    "watchedTokens": ["BTC", "ETH", "ADA"],
    "ignoredTokens": ["DOGE", "SHIB"]
  }
}
```

**Response**:
```json
{
  "success": true,
  "preferences": {
    "userId": "user123",
    "channels": { ... },
    "notifications": { ... },
    "frequency": { ... },
    "quietHours": { ... },
    "filters": { ... }
  }
}
```

---

### **Update Preference Section**
```http
PATCH /api/v1/preferences/:section
Authorization: Bearer <jwt_token>
```

**Description**: Cập nhật một phần preferences (channels, notifications, frequency, quietHours, filters)

**Authentication**: ✅ Yêu cầu JWT token

**Valid Sections**: `channels`, `notifications`, `frequency`, `quietHours`, `filters`

**Request Body** (Example for channels):
```json
{
  "email": true,
  "telegram": true
}
```

**Response**:
```json
{
  "success": true,
  "preferences": {
    "userId": "user123",
    "channels": {
      "websocket": true,
      "email": true,
      "push": true,
      "telegram": true
    },
    ...
  }
}
```

---

### **Reset Preferences**
```http
POST /api/v1/preferences/reset
Authorization: Bearer <jwt_token>
```

**Description**: Reset preferences về mặc định

**Authentication**: ✅ Yêu cầu JWT token

**Response**:
```json
{
  "success": true,
  "message": "Preferences reset to default"
}
```

---

### **Bulk Get Preferences**
```http
POST /api/v1/preferences/bulk
Authorization: Bearer <jwt_token>
```

**Description**: Lấy preferences của nhiều users cùng lúc (admin function)

**Authentication**: ✅ Yêu cầu JWT token

**Request Body**:
```json
{
  "userIds": ["user123", "user456", "user789"]
}
```

**Response**:
```json
{
  "success": true,
  "preferences": {
    "user123": { ... },
    "user456": { ... },
    "user789": { ... }
  }
}
```

---

## 📋 **Subscriptions Management** `/api/v1/subscriptions`

### **Get User Subscriptions**
```http
GET /api/v1/subscriptions?type=price_alert&active=true
Authorization: Bearer <jwt_token>
```

**Description**: Lấy danh sách subscriptions của user (userId từ JWT payload)

**Authentication**: ✅ Yêu cầu JWT token

**Query Parameters**:
- `type` (string, optional): Lọc theo loại subscription
- `active` (boolean, optional): Lọc theo trạng thái active

**Response**:
```json
{
  "success": true,
  "subscriptions": [
    {
      "id": "sub_123",
      "userId": "user123",
      "type": "price_alert",
      "target": "BTC",
      "conditions": {
        "threshold": 50000,
        "direction": "above"
      },
      "channels": ["websocket", "push"],
      "active": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### **Create Subscription**
```http
POST /api/v1/subscriptions
Authorization: Bearer <jwt_token>
```

**Description**: Tạo subscription mới cho user (userId từ JWT payload)

**Authentication**: ✅ Yêu cầu JWT token

**Request Body**:
```json
{
  "type": "price_alert",
  "target": "BTC",
  "conditions": {
    "threshold": 50000,
    "direction": "above"
  },
  "channels": ["websocket", "push"],
  "active": true
}
```

**Subscription Types**:
- `price_alert`: Thông báo thay đổi giá
- `volume_alert`: Thông báo thay đổi volume
- `whale_alert`: Thông báo giao dịch lớn
- `wallet_tracking`: Theo dõi ví
- `token_news`: Tin tức token
- `portfolio_update`: Cập nhật portfolio

**Response**:
```json
{
  "success": true,
  "subscription": {
    "id": "sub_123",
    "userId": "user123",
    "type": "price_alert",
    "target": "BTC",
    "conditions": { ... },
    "channels": ["websocket", "push"],
    "active": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### **Update Subscription**
```http
PUT /api/v1/subscriptions/:subscriptionId
Authorization: Bearer <jwt_token>
```

**Description**: Cập nhật subscription của user (user ownership verification)

**Authentication**: ✅ Yêu cầu JWT token

**Request Body**:
```json
{
  "conditions": {
    "threshold": 55000,
    "direction": "both"
  },
  "channels": ["websocket", "push", "email"],
  "active": true
}
```

**Response**:
```json
{
  "success": true,
  "subscription": {
    "id": "sub_123",
    "userId": "user123",
    "conditions": {
      "threshold": 55000,
      "direction": "both"
    },
    "channels": ["websocket", "push", "email"],
    "active": true,
    "updatedAt": "2024-01-01T01:00:00.000Z"
  }
}
```

---

### **Delete Subscription**
```http
DELETE /api/v1/subscriptions/:subscriptionId
Authorization: Bearer <jwt_token>
```

**Description**: Xóa subscription của user (user ownership verification)

**Authentication**: ✅ Yêu cầu JWT token

**Response**:
```json
{
  "success": true,
  "message": "Subscription deleted successfully"
}
```

---

### **Toggle Subscription**
```http
PATCH /api/v1/subscriptions/:subscriptionId/toggle
Authorization: Bearer <jwt_token>
```

**Description**: Bật/tắt subscription (user ownership verification)

**Authentication**: ✅ Yêu cầu JWT token

**Response**:
```json
{
  "success": true,
  "subscription": {
    "id": "sub_123",
    "active": false,
    "updatedAt": "2024-01-01T01:00:00.000Z"
  }
}
```

---

### **Subscription Statistics**
```http
GET /api/v1/subscriptions/stats
Authorization: Bearer <jwt_token>
```

**Description**: Lấy thống kê subscriptions của user (userId từ JWT payload)

**Authentication**: ✅ Yêu cầu JWT token

**Response**:
```json
{
  "success": true,
  "stats": {
    "total": 10,
    "active": 8,
    "inactive": 2,
    "byType": {
      "price_alert": 5,
      "volume_alert": 3,
      "whale_alert": 2
    }
  }
}
```

---

### **Bulk Operations**
```http
POST /api/v1/subscriptions/bulk
Authorization: Bearer <jwt_token>
```

**Description**: Thực hiện bulk operations trên subscriptions của user

**Authentication**: ✅ Yêu cầu JWT token

**Request Body**:
```json
{
  "action": "activate",
  "subscriptionIds": ["sub_123", "sub_456", "sub_789"]
}
```

**Actions**: `activate`, `deactivate`, `delete`

**Response**:
```json
{
  "success": true,
  "result": {
    "processed": 3,
    "succeeded": 3,
    "failed": 0
  }
}
```

---

## 🚨 **Alerts Configuration** `/api/v1/alerts`

### **Get User Alerts**
```http
GET /api/v1/alerts?type=price_alert&active=true
Authorization: Bearer <jwt_token>
```

**Description**: Lấy danh sách alerts của user (userId từ JWT payload)

**Authentication**: ✅ Yêu cầu JWT token

**Query Parameters**:
- `type` (string, optional): Lọc theo loại alert
- `active` (boolean, optional): Lọc theo trạng thái active

**Response**:
```json
{
  "success": true,
  "alerts": [
    {
      "id": "alert_123",
      "userId": "user123",
      "name": "BTC Price Alert",
      "type": "price_alert",
      "parameters": {
        "symbol": "BTC",
        "targetPrice": 50000,
        "priceDirection": "above"
      },
      "channels": ["websocket", "push"],
      "priority": "high",
      "active": true,
      "triggerCount": 5,
      "lastTriggered": "2024-01-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### **Create Price Alert**
```http
POST /api/v1/alerts/price
Authorization: Bearer <jwt_token>
```

**Description**: Tạo price alert mới (userId từ JWT payload)

**Authentication**: ✅ Yêu cầu JWT token

**Request Body**:
```json
{
  "name": "BTC Price Alert",
  "symbol": "BTC",
  "targetPrice": 50000,
  "direction": "above",
  "channels": ["websocket", "push"],
  "priority": "high"
}
```

**Response**:
```json
{
  "success": true,
  "alert": {
    "id": "alert_123",
    "userId": "user123",
    "name": "BTC Price Alert",
    "type": "price_alert",
    "parameters": {
      "symbol": "BTC",
      "targetPrice": 50000,
      "priceDirection": "above"
    },
    "channels": ["websocket", "push"],
    "priority": "high",
    "active": true,
    "triggerCount": 0,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### **Create Volume Alert**
```http
POST /api/v1/alerts/volume
Authorization: Bearer <jwt_token>
```

**Description**: Tạo volume alert mới (userId từ JWT payload)

**Authentication**: ✅ Yêu cầu JWT token

**Request Body**:
```json
{
  "name": "BTC Volume Alert",
  "symbol": "BTC",
  "threshold": 1000000,
  "timeframe": "1h",
  "channels": ["websocket", "push"],
  "priority": "medium"
}
```

**Response**:
```json
{
  "success": true,
  "alert": {
    "id": "alert_124",
    "userId": "user123",
    "name": "BTC Volume Alert",
    "type": "volume_alert",
    "parameters": {
      "symbol": "BTC",
      "volumeThreshold": 1000000,
      "timeframe": "1h"
    },
    "channels": ["websocket", "push"],
    "priority": "medium",
    "active": true,
    "triggerCount": 0,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### **Create Whale Alert**
```http
POST /api/v1/alerts/whale
Authorization: Bearer <jwt_token>
```

**Description**: Tạo whale alert mới (userId từ JWT payload)

**Authentication**: ✅ Yêu cầu JWT token

**Request Body**:
```json
{
  "name": "BTC Whale Alert",
  "symbol": "BTC",
  "minAmount": 100,
  "walletAddress": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "channels": ["websocket", "push"],
  "priority": "high"
}
```

**Response**:
```json
{
  "success": true,
  "alert": {
    "id": "alert_125",
    "userId": "user123",
    "name": "BTC Whale Alert",
    "type": "whale_alert",
    "parameters": {
      "symbol": "BTC",
      "transactionAmount": 100,
      "walletAddress": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
    },
    "channels": ["websocket", "push"],
    "priority": "high",
    "active": true,
    "triggerCount": 0,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### **Update Alert**
```http
PUT /api/v1/alerts/:alertId
Authorization: Bearer <jwt_token>
```

**Description**: Cập nhật thông tin alert (user ownership verification)

**Authentication**: ✅ Yêu cầu JWT token

**Request Body**:
```json
{
  "name": "Updated BTC Price Alert",
  "parameters": {
    "targetPrice": 55000,
    "priceDirection": "both"
  },
  "priority": "medium"
}
```

**Response**:
```json
{
  "success": true,
  "alert": {
    "id": "alert_123",
    "name": "Updated BTC Price Alert",
    "parameters": {
      "symbol": "BTC",
      "targetPrice": 55000,
      "priceDirection": "both"
    },
    "priority": "medium",
    "updatedAt": "2024-01-01T01:00:00.000Z"
  }
}
```

---

### **Delete Alert**
```http
DELETE /api/v1/alerts/:alertId
Authorization: Bearer <jwt_token>
```

**Description**: Xóa alert của user (user ownership verification)

**Authentication**: ✅ Yêu cầu JWT token

**Response**:
```json
{
  "success": true,
  "message": "Alert deleted successfully"
}
```

---

### **Toggle Alert**
```http
PATCH /api/v1/alerts/:alertId/toggle
Authorization: Bearer <jwt_token>
```

**Description**: Bật/tắt alert (user ownership verification)

**Authentication**: ✅ Yêu cầu JWT token

**Response**:
```json
{
  "success": true,
  "alert": {
    "id": "alert_123",
    "active": false,
    "updatedAt": "2024-01-01T01:00:00.000Z"
  }
}
```

---

### **Alert Statistics**
```http
GET /api/v1/alerts/stats
Authorization: Bearer <jwt_token>
```

**Description**: Lấy thống kê alerts của user (userId từ JWT payload)

**Authentication**: ✅ Yêu cầu JWT token

**Response**:
```json
{
  "success": true,
  "stats": {
    "total": 15,
    "active": 12,
    "inactive": 3,
    "byType": {
      "price_alert": 8,
      "volume_alert": 4,
      "whale_alert": 3
    },
    "totalTriggers": 45,
    "lastTriggered": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### **Test Alert**
```http
POST /api/v1/alerts/:alertId/test
Authorization: Bearer <jwt_token>
```

**Description**: Test trigger alert thủ công (user ownership verification)

**Authentication**: ✅ Yêu cầu JWT token

**Response**:
```json
{
  "success": true,
  "message": "Test alert notification sent"
}
```

---

## 📚 **Error Handling**

### **Common Error Responses**

**400 Bad Request**:
```json
{
  "error": "Missing required fields: name, symbol, targetPrice"
}
```

**401 Unauthorized**:
```json
{
  "error": "Unauthorized access"
}
```

**401 Unauthorized (Admin)**:
```json
{
  "error": "X-API-Key header is required for admin endpoints"
}
```

**401 Unauthorized (Invalid Admin Key)**:
```json
{
  "error": "Invalid admin API key"
}
```

**403 Forbidden**:
```json
{
  "error": "Access denied to this resource"
}
```

**404 Not Found**:
```json
{
  "error": "Resource not found"
}
```

**500 Internal Server Error**:
```json
{
  "error": "Internal server error"
}
```

---

## 🔧 **Rate Limiting**

- **System endpoints**: Không giới hạn
- **User endpoints**: 1000 requests/hour per user
- **Admin endpoints**: 5000 requests/hour per API key
- **Heavy operations**: 100 requests/hour per user

---

## 📊 **Response Format**

### **Success Response**:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### **Error Response**:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

---

## 🌐 **Environment Variables**

**Required for API Integration**:
- `AUTH_SERVICE_URL`: URL của Auth Service để verify JWT tokens
- `ADMIN_API_KEY`: API key cho admin endpoints (generate securely)
- `ALLOWED_ORIGINS`: CORS origins (comma-separated)
- `LOG_LEVEL`: Logging level (info, debug, error)

**Admin API Key Security**:
- Use cryptographically secure random generator
- Minimum 32 characters length
- Rotate regularly (monthly recommended)
- Store securely in environment variables
- Never log or expose in responses

---

## 🔐 **Security Best Practices**

### **API Key Management**
- Generate admin API keys using secure random generators
- Store keys in secure environment variables
- Rotate keys regularly
- Use different keys for different environments
- Monitor API key usage and suspicious activity

### **Authentication**
- JWT tokens expire and require refresh
- Admin API keys should be rotated periodically
- Implement proper logging for authentication failures
- Use HTTPS in production for all API calls

### **Access Control**
- User endpoints enforce ownership via JWT payload
- Admin endpoints require valid API key
- System endpoints are public but should be monitored
- Implement proper CORS configuration
- UserId is extracted from token payload (không thể spoof)

---

## 📝 **Notes**

1. **Timestamps**: Tất cả timestamps sử dụng ISO 8601 format
2. **Time Zones**: Mặc định UTC, có thể customize trong user preferences
3. **Pagination**: Sẽ được implement trong tương lai cho large datasets
4. **Webhooks**: Sẽ được thêm vào Rules system để callback external services
5. **Real-time Updates**: WebSocket connections được handle bởi WebSocket Gateway service
6. **Admin API Keys**: Cần được generate securely và rotate định kỳ
7. **User Context**: UserId luôn được lấy từ JWT payload để đảm bảo security

---

## 🔗 **Related Services**

- **Auth Service**: JWT token verification
- **WebSocket Gateway**: Real-time notifications
- **Core Service**: Business logic integration
- **Database**: PostgreSQL với comprehensive schema
- **Message Queue**: Kafka cho event streaming
- **Cache**: Redis cho performance optimization

---

## 📋 **Authentication Summary**

| Endpoint Category | Authentication Method | Header Required | User Context |
|-------------------|----------------------|----------------|--------------|
| **System** `/api/v1/system/*` | ❌ None | - | - |
| **Rules** `/api/v1/rules/*` | ⭐ Admin API Key | `X-API-Key: <admin_api_key>` | - |
| **Preferences** `/api/v1/preferences/*` | ✅ JWT | `Authorization: Bearer <jwt_token>` | UserId từ JWT payload |
| **Subscriptions** `/api/v1/subscriptions/*` | ✅ JWT | `Authorization: Bearer <jwt_token>` | UserId từ JWT payload |
| **Alerts** `/api/v1/alerts/*` | ✅ JWT | `Authorization: Bearer <jwt_token>` | UserId từ JWT payload |

---

**Last Updated**: 2024-01-01  
**API Version**: v1  
**Documentation Version**: 1.2.0 
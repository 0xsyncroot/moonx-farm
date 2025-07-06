# 🖥️ Frontend Integration Guide - Notification Hub

## 📋 **Tổng quan**

Tài liệu hướng dẫn frontend developers tích hợp với Notification Hub để:
- Nhận thông báo real-time qua WebSocket
- Quản lý user preferences/subscriptions/alerts
- Hiển thị notifications trong UI

## 🏗️ **Integration Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   WebSocket     │    │  Notification   │
│   Application   │◄──►│   Gateway       │◄──►│   Hub           │
│                 │    │   (External)    │    │                 │
│ - React Hook    │    │ - Real-time     │    │ - Processing    │
│ - Notification  │    │ - Pub/Sub       │    │ - User APIs     │
│ - Preferences   │    │ - Authentication│    │ - Admin APIs    │
│ - Toast System  │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔌 **1. WebSocket Connection**

### **1.1 Basic Setup**

```typescript
// hooks/useNotifications.ts
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
  data?: any;
}

export function useNotifications() {
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token || !user) return;

    const socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    
    socket.on('notification', (notification: Notification) => {
      setNotifications(prev => [notification, ...prev.slice(0, 99)]);
      
      // Show browser notification
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.body,
          icon: '/icon-192x192.png'
        });
      }
    });

    // Join user's room
    socket.emit('join_room', { room: `user:${user.id}` });

    return () => socket.disconnect();
  }, [token, user]);

  return { notifications, connected };
}
```

## 🔔 **2. Notification Components**

### **2.1 Notification Bell**

```tsx
// components/NotificationBell.tsx
import { Bell } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

export function NotificationBell() {
  const { notifications } = useNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <button className="relative p-2 rounded-full hover:bg-gray-100">
      <Bell className="w-6 h-6" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
```

### **2.2 Toast Notification**

```tsx
// components/ToastNotification.tsx
interface ToastProps {
  notification: Notification;
  onClose: () => void;
}

export function ToastNotification({ notification, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const priorityColor = {
    high: 'border-red-500',
    medium: 'border-blue-500', 
    low: 'border-green-500'
  }[notification.priority];

  return (
    <div className={`fixed top-4 right-4 bg-white rounded-lg shadow-lg border-l-4 ${priorityColor} p-4 w-80`}>
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold">{notification.title}</h4>
          <p className="text-sm text-gray-600 mt-1">{notification.body}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
      </div>
    </div>
  );
}
```

## ⚙️ **3. API Integration**

### **3.1 API Client Setup**

```typescript
// services/notificationApi.ts
import axios from 'axios';

export class NotificationAPI {
  private client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_NOTIFICATION_HUB_URL,
    headers: { 'Content-Type': 'application/json' }
  });

  constructor(private getToken: () => string) {
    this.client.interceptors.request.use((config) => {
      config.headers.Authorization = `Bearer ${this.getToken()}`;
      return config;
    });
  }

  // User Preferences (JWT - userId từ token payload)
  async getPreferences() {
    const response = await this.client.get('/api/v1/preferences');
    return response.data.preferences;
  }

  async updatePreferences(preferences: any) {
    await this.client.put('/api/v1/preferences', preferences);
  }

  // User Subscriptions (JWT - userId từ token payload)
  async getSubscriptions() {
    const response = await this.client.get('/api/v1/subscriptions');
    return response.data.subscriptions;
  }

  async createSubscription(subscription: any) {
    await this.client.post('/api/v1/subscriptions', subscription);
  }

  // User Alerts (JWT - userId từ token payload) 
  async getAlerts() {
    const response = await this.client.get('/api/v1/alerts');
    return response.data.alerts;
  }

  async createPriceAlert(alert: any) {
    await this.client.post('/api/v1/alerts/price', alert);
  }
}
```

### **3.2 Admin API Client** 

```typescript
// services/adminApi.ts
export class AdminAPI {
  private client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_NOTIFICATION_HUB_URL,
    headers: { 
      'Content-Type': 'application/json',
      'X-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY
    }
  });

  // Admin Rules (X-API-Key authentication)
  async getRules() {
    const response = await this.client.get('/api/v1/rules/list');
    return response.data.rules;
  }

  async createRule(rule: any) {
    await this.client.post('/api/v1/rules/create', rule);
  }

  async toggleRule(ruleId: string, enabled: boolean) {
    await this.client.patch(`/api/v1/rules/${ruleId}/toggle`, { enabled });
  }
}
```

## 📋 **4. User Settings Components**

### **4.1 Notification Preferences**

```tsx
// components/NotificationSettings.tsx
export function NotificationSettings() {
  const { token } = useAuth();
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const api = new NotificationAPI(() => token);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await api.getPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateChannels = async (channels: any) => {
    const newPrefs = { ...preferences, channels };
    await api.updatePreferences(newPrefs);
    setPreferences(newPrefs);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Notification Settings</h1>
      
      {/* Delivery Channels */}
      <div className="bg-white rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Delivery Channels</h2>
        {Object.entries(preferences.channels).map(([channel, enabled]) => (
          <div key={channel} className="flex items-center justify-between mb-4">
            <label className="text-sm font-medium capitalize">{channel}</label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => updateChannels({
                ...preferences.channels,
                [channel]: e.target.checked
              })}
            />
          </div>
        ))}
      </div>

      {/* Notification Types */}
      <div className="bg-white rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Notification Types</h2>
        {Object.entries(preferences.notifications).map(([type, enabled]) => (
          <div key={type} className="flex items-center justify-between mb-4">
            <label className="text-sm font-medium">
              {type.replace(/([A-Z])/g, ' $1').trim()}
            </label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => updateNotifications({
                ...preferences.notifications,
                [type]: e.target.checked
              })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### **4.2 Alert Management**

```tsx
// components/AlertManagement.tsx
export function AlertManagement() {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const api = new NotificationAPI(() => token);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    const alertData = await api.getAlerts();
    setAlerts(alertData);
  };

  const createPriceAlert = async (alertData: any) => {
    await api.createPriceAlert(alertData);
    setShowCreateForm(false);
    loadAlerts();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Price Alerts</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
        >
          Add Alert
        </button>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {alerts.map(alert => (
          <div key={alert.id} className="bg-white rounded-lg p-4 border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{alert.name}</h3>
                <p className="text-sm text-gray-600">
                  {alert.symbol} {alert.direction} ${alert.targetPrice}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  alert.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {alert.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Alert Form */}
      {showCreateForm && (
        <CreateAlertModal
          onSave={createPriceAlert}
          onCancel={() => setShowCreateForm(false)}
        />
      )}
    </div>
  );
}
```

## 🔧 **5. Admin Components**

### **5.1 Rules Management** 

```tsx
// components/admin/RulesManagement.tsx
export function RulesManagement() {
  const [rules, setRules] = useState([]);
  const adminApi = new AdminAPI();

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    const rulesData = await adminApi.getRules();
    setRules(rulesData);
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    await adminApi.toggleRule(ruleId, enabled);
    loadRules();
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">System Rules</h1>
      
      <div className="bg-white rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Rule Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rules.map(rule => (
              <tr key={rule.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {rule.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {rule.conditions.type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs ${
                    rule.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {rule.enabled ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => toggleRule(rule.id, !rule.enabled)}
                    className={`${
                      rule.enabled ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                    }`}
                  >
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

## 📱 **6. Mobile Considerations**

### **6.1 Push Notification Setup**

```typescript
// services/pushNotifications.ts
export class PushNotificationService {
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;
    await navigator.serviceWorker.register('/sw.js');
  }

  async subscribeToPush(): Promise<string | null> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      });
      return JSON.stringify(subscription);
    } catch (error) {
      console.error('Push subscription failed:', error);
      return null;
    }
  }
}
```

## 🧪 **7. Testing**

### **7.1 Component Testing**

```typescript
// tests/NotificationBell.test.tsx
import { render, screen } from '@testing-library/react';
import { NotificationBell } from '../components/NotificationBell';

jest.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: [
      { id: '1', title: 'Test', body: 'Test notification', read: false }
    ]
  })
}));

test('shows notification count', () => {
  render(<NotificationBell />);
  expect(screen.getByText('1')).toBeInTheDocument();
});
```

### **7.2 API Testing**

```typescript
// tests/notificationApi.test.ts
import { NotificationAPI } from '../services/notificationApi';

describe('NotificationAPI', () => {
  const mockToken = 'test-token';
  const api = new NotificationAPI(() => mockToken);

  test('gets user preferences', async () => {
    // Mock axios response
    const preferences = await api.getPreferences();
    expect(preferences).toBeDefined();
  });
});
```

## ⚡ **8. Performance Tips**

### **8.1 Optimization**

```typescript
// Memoize notification components
const NotificationItem = React.memo(({ notification }: { notification: Notification }) => (
  <div className="notification-item">
    <h4>{notification.title}</h4>
    <p>{notification.body}</p>
  </div>
));

// Debounce preference updates
const debouncedUpdatePreferences = useCallback(
  debounce(async (preferences) => {
    await api.updatePreferences(preferences);
  }, 500),
  []
);
```

### **8.2 Error Handling**

```typescript
// Global error boundary
export function NotificationErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={<div>Something went wrong with notifications</div>}
      onError={(error) => console.error('Notification error:', error)}
    >
      {children}
    </ErrorBoundary>
  );
}
```

## 📋 **Best Practices**

### **1. Security**
- Always validate JWT tokens
- Sanitize notification content
- Use HTTPS for all API calls
- Implement proper CORS

### **2. User Experience**
- Show loading states
- Handle connection failures gracefully
- Provide clear notification settings
- Respect user's quiet hours

### **3. Performance**
- Limit notification history (max 100)
- Use virtual scrolling for large lists
- Debounce user actions
- Cache preferences locally

### **4. Accessibility**
- Use proper ARIA labels
- Support keyboard navigation
- Provide screen reader support
- Maintain proper contrast ratios

---

**🎉 Frontend Integration Ready!** Follow patterns này để tạo notification experience mượt mà và user-friendly. 
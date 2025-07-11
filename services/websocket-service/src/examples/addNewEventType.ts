/**
 * Example: Adding New Event Types Without Code Changes
 * 
 * Suppose a new "notification-service" wants to send events.
 * No need to modify kafkaConsumer.ts!
 */

import { kafkaConsumer } from '../services/kafkaConsumer';

// Example: Add notification events support
kafkaConsumer.addRoutingRule({
  eventTypePattern: /^notification\./,
  userExtractor: (event) => event.data.recipientId || event.data.userId,
  messageTransformer: (event) => ({
    id: `notification_${event.data.notificationId}_${event.metadata.timestamp}`,
    type: 'notification_update',
    timestamp: event.metadata.timestamp,
    data: {
      notificationId: event.data.notificationId,
      title: event.data.title,
      message: event.data.message,
      type: event.data.notificationType,
      priority: event.data.priority,
      read: false
    }
  })
});

// Example: Add payment events support  
kafkaConsumer.addRoutingRule({
  eventTypePattern: /^payment\./,
  userExtractor: (event) => event.data.userId,
  channelMapping: 'payments', // Broadcast to payments channel
  messageTransformer: (event) => ({
    id: `payment_${event.data.paymentId}_${event.metadata.timestamp}`,
    type: 'payment_update',
    timestamp: event.metadata.timestamp,
    data: {
      paymentId: event.data.paymentId,
      status: event.metadata.eventType.split('.')[1], // created, processed, failed
      amount: event.data.amount,
      currency: event.data.currency,
      method: event.data.paymentMethod
    }
  })
});

// Example: Add analytics events (log only, no forwarding)
kafkaConsumer.addRoutingRule({
  eventTypePattern: /^analytics\./,
  filter: () => false, // Don't forward to clients
  // Just logs the event automatically
});

// Example: Add admin events (only for admin users)
kafkaConsumer.addRoutingRule({
  eventTypePattern: /^admin\./,
  userExtractor: (event) => event.data.adminId,
  messageTransformer: (event) => ({
    id: `admin_${event.metadata.eventId}`,
    type: 'admin_alert',
    timestamp: event.metadata.timestamp,
    data: event.data
  }),
  filter: (event) => {
    // Only forward to admin users
    return event.data.userRole === 'admin' || event.data.isAdmin === true;
  }
});

console.log('✅ New event types added without modifying core code!');
console.log('Current routing rules:', kafkaConsumer.getRoutingRules().length); 
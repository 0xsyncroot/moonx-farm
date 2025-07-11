/**
 * Example: Dynamic Routing Configuration
 * 
 * Routes can be configured externally via config files, APIs, or databases
 * No need to restart the service!
 */

import { kafkaConsumer } from '../services/kafkaConsumer';

// Example: Load routing rules from external config
interface RoutingConfig {
  eventPattern: string;
  userField?: string;
  channel?: string;
  messageType: string;
  dataMapping?: Record<string, string>;
  filterCondition?: string;
}

// External config (could come from database, API, config file)
const externalRoutingConfig: RoutingConfig[] = [
  {
    eventPattern: "^inventory\\.",
    userField: "storeManagerId", 
    channel: "inventory",
    messageType: "inventory_update",
    dataMapping: {
      "productId": "data.productId",
      "quantity": "data.currentStock",
      "location": "data.warehouseLocation"
    }
  },
  {
    eventPattern: "^shipping\\.",
    userField: "customerId",
    messageType: "shipping_update", 
    dataMapping: {
      "trackingNumber": "data.trackingNumber",
      "status": "metadata.eventType",
      "estimatedDelivery": "data.estimatedDelivery"
    }
  },
  {
    eventPattern: "^audit\\.",
    messageType: "audit_log",
    filterCondition: "data.severity === 'high'", // Only forward high severity
    channel: "admin_alerts"
  }
];

// Generic function to apply external config
function applyExternalRoutingConfig(configs: RoutingConfig[]) {
  configs.forEach(config => {
    kafkaConsumer.addRoutingRule({
      eventTypePattern: new RegExp(config.eventPattern),
      
      userExtractor: config.userField ? 
        (event) => getNestedValue(event, config.userField!) : 
        undefined,
        
      channelMapping: config.channel,
      
      messageTransformer: (event) => ({
        id: `${config.messageType}_${event.metadata.eventId}`,
        type: config.messageType,
        timestamp: event.metadata.timestamp,
        data: config.dataMapping ? 
          mapEventData(event, config.dataMapping) : 
          event.data
      }),
      
      filter: config.filterCondition ? 
        (event) => evaluateCondition(event, config.filterCondition!) : 
        undefined
    });
  });
}

// Helper function to get nested values
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Helper function to map event data according to config
function mapEventData(event: any, mapping: Record<string, string>): any {
  const result: any = {};
  
  Object.entries(mapping).forEach(([targetKey, sourcePath]) => {
    result[targetKey] = getNestedValue(event, sourcePath);
  });
  
  return result;
}

// Helper function to evaluate filter conditions
function evaluateCondition(event: any, condition: string): boolean {
  try {
    // Simple condition evaluation (in production, use a proper expression evaluator)
    const conditionFunc = new Function('data', 'metadata', `return ${condition}`);
    return conditionFunc(event.data, event.metadata);
  } catch (error) {
    console.warn('Failed to evaluate condition:', condition, error);
    return true; // Default to allowing the event
  }
}

// Apply external configuration
applyExternalRoutingConfig(externalRoutingConfig);

// Example: Hot-reload routing rules from API
async function reloadRoutingRules() {
  try {
    // Simulate fetching from API
    const apiResponse = await fetch('/api/websocket/routing-rules');
    const newConfigs: RoutingConfig[] = await apiResponse.json();
    
    // Clear existing rules (optional)
    // kafkaConsumer.clearRoutingRules();
    
    // Apply new rules
    applyExternalRoutingConfig(newConfigs);
    
    console.log('✅ Routing rules reloaded from API');
  } catch (error) {
    console.error('❌ Failed to reload routing rules:', error);
  }
}

// Example: Conditional routing based on user preferences
kafkaConsumer.addRoutingRule({
  eventTypePattern: /^marketing\./,
  userExtractor: (event) => event.data.userId,
  messageTransformer: (event) => ({
    id: `marketing_${event.metadata.eventId}`,
    type: 'marketing_update',
    timestamp: event.metadata.timestamp,
    data: event.data
  }),
  filter: (event) => {
    // Check user preferences (sync version for demo)
    const userId = event.data.userId;
    // In real implementation, you'd cache user preferences or use sync check
    return true; // Simplified for demo - could implement caching here
  }
});

async function getUserMarketingPreferences(userId: string) {
  // Simulate API call
  return { allowMarketingNotifications: true };
}

console.log('🎯 Dynamic routing configuration applied!');

export {
  applyExternalRoutingConfig,
  reloadRoutingRules
};

export type { RoutingConfig }; 
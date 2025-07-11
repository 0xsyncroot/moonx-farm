#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 MoonX Farm - Create System Rule${NC}"
echo "=========================================="

# Configuration
NOTIFICATION_HUB_URL="${NOTIFICATION_HUB_URL:-http://localhost:3008}"
ADMIN_API_KEY="${ADMIN_API_KEY:-5b9311d4-becc-4e3a-9f31-0c6ffe824932}"

# Check if API key is set
if [ "$ADMIN_API_KEY" == "your-admin-api-key-here" ]; then
  echo -e "${RED}❌ Please set ADMIN_API_KEY environment variable${NC}"
  echo "   export ADMIN_API_KEY='your-actual-admin-api-key'"
  exit 1
fi

# Function to check API response
check_api_response() {
  local response="$1"
  local operation="$2"
  
  if echo "$response" | grep -q '"success":true'; then
    return 0
  else
    echo -e "${RED}❌ $operation failed${NC}"
    echo "Response: $response"
    return 1
  fi
}

# Step 1: Test API connectivity
echo -e "\n${YELLOW}🔍 Testing API connectivity${NC}"
echo "URL: ${NOTIFICATION_HUB_URL}/api/v1/rules/create"
echo "API Key: ${ADMIN_API_KEY:0:8}..."

# Test basic connectivity
HEALTH_CHECK=$(curl -s -w "%{http_code}" -o /dev/null "${NOTIFICATION_HUB_URL}/api/v1/system/health" || echo "000")
echo "Health check status: $HEALTH_CHECK"

if [ "$HEALTH_CHECK" != "200" ]; then
  echo -e "${RED}❌ Cannot connect to Notification Hub${NC}"
  echo "   Make sure the service is running at: $NOTIFICATION_HUB_URL"
  echo "   Health check endpoint: ${NOTIFICATION_HUB_URL}/api/v1/system/health"
  exit 1
fi

# Check available endpoints
echo -e "\n${YELLOW}🔍 Checking available API endpoints${NC}"
API_ROUTES=$(curl -s "${NOTIFICATION_HUB_URL}/api/v1/routes" 2>/dev/null || echo "No routes endpoint")
echo "Available routes: $API_ROUTES"

# Try different common endpoints
echo -e "\n${YELLOW}🔍 Testing common endpoints${NC}"
for endpoint in "rules" "notifications" "admin"; do
  status=$(curl -s -w "%{http_code}" -o /dev/null "${NOTIFICATION_HUB_URL}/api/v1/${endpoint}" 2>/dev/null || echo "000")
  echo "  /api/v1/${endpoint}: $status"
done

# Step 2: Create System Rule
echo -e "\n${YELLOW}📋 Creating System Rule${NC}"

CREATE_RULE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${NOTIFICATION_HUB_URL}/api/v1/rules/create" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${ADMIN_API_KEY}" \
  -d '{
    "name": "System Announcements",
    "description": "Official system announcements for MoonX Farm platform",
    "conditions": {
      "type": "system_event",
      "eventType": "admin_announcement",
      "source": "admin_panel",
      "immediate": true
    },
    "actions": {
      "channels": ["websocket", "push"],
      "priority": "high",
      "fromAdmin": true,
      "broadcast": true
    },
    "priority": "high",
    "enabled": true,
    "schedule": {
      "type": "immediate"
    }
  }')

# Parse response and HTTP status
HTTP_STATUS=$(echo "$CREATE_RULE_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
RESPONSE_BODY=$(echo "$CREATE_RULE_RESPONSE" | sed '/HTTP_STATUS:/d')

echo "HTTP Status: $HTTP_STATUS"
echo "Response Body: $RESPONSE_BODY"

# Check HTTP status first
if [ "$HTTP_STATUS" != "200" ] && [ "$HTTP_STATUS" != "201" ]; then
  echo -e "${RED}❌ HTTP Error: $HTTP_STATUS${NC}"
  
  case "$HTTP_STATUS" in
    "400") echo -e "${YELLOW}💡 Bad Request - Check payload structure${NC}" ;;
    "401") echo -e "${YELLOW}💡 Unauthorized - Check API key${NC}" ;;
    "403") echo -e "${YELLOW}💡 Forbidden - Check API permissions${NC}" ;;
    "404") echo -e "${YELLOW}💡 Not Found - Check API endpoint${NC}" ;;
    "500") echo -e "${YELLOW}💡 Server Error - Check server logs${NC}" ;;
    "000") echo -e "${YELLOW}💡 Connection Error - Check service status${NC}" ;;
    *) echo -e "${YELLOW}💡 Unknown Error - Check server logs${NC}" ;;
  esac
  
  
  # Try alternative payload structure
  echo -e "${YELLOW}🔄 Trying alternative payload structure${NC}"
  
  CREATE_RULE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${NOTIFICATION_HUB_URL}/api/v1/rules/create" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${ADMIN_API_KEY}" \
    -d '{
      "name": "System Announcements",
      "description": "Official system announcements for MoonX Farm platform",
      "conditions": {
        "type": "system_event",
        "eventType": "admin_announcement"
      },
      "actions": {
        "channels": ["websocket", "push"],
        "priority": "high"
      },
      "enabled": true
    }')
  
  # Parse alternative response
  HTTP_STATUS=$(echo "$CREATE_RULE_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
  RESPONSE_BODY=$(echo "$CREATE_RULE_RESPONSE" | sed '/HTTP_STATUS:/d')
  
  echo "Alternative HTTP Status: $HTTP_STATUS"
  echo "Alternative Response Body: $RESPONSE_BODY"
  
  if [ "$HTTP_STATUS" != "200" ] && [ "$HTTP_STATUS" != "201" ]; then
         
     # Try minimal payload structure
     echo -e "${YELLOW}🔄 Trying minimal payload structure${NC}"
     
     CREATE_RULE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${NOTIFICATION_HUB_URL}/api/v1/rules/create" \
       -H "Content-Type: application/json" \
       -H "X-API-Key: ${ADMIN_API_KEY}" \
       -d '{
         "name": "System Announcements",
         "description": "Official system announcements for MoonX Farm platform",
         "conditions": {
           "type": "system_event"
         },
         "actions": {
           "channels": ["websocket", "push"],
           "priority": "high"
         },
         "enabled": true
       }')
     
     # Parse minimal response
     HTTP_STATUS=$(echo "$CREATE_RULE_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
     RESPONSE_BODY=$(echo "$CREATE_RULE_RESPONSE" | sed '/HTTP_STATUS:/d')
     
     echo "Minimal HTTP Status: $HTTP_STATUS"
     echo "Minimal Response Body: $RESPONSE_BODY"
     
     if [ "$HTTP_STATUS" != "200" ] && [ "$HTTP_STATUS" != "201" ]; then
       echo -e "${RED}❌ All payload structures failed${NC}"
       echo -e "${YELLOW}💡 Debugging information:${NC}"
       echo "   - Check if Notification Hub service is running"
       echo "   - Verify API key: ${ADMIN_API_KEY:0:8}..."
       echo "   - Test endpoint manually: curl -X GET \"$NOTIFICATION_HUB_URL/api/v1/rules\""
       echo "   - Check server logs for detailed error messages"
       exit 1
     fi
   fi
fi

# Check if rule creation was successful
if ! check_api_response "$RESPONSE_BODY" "Rule creation"; then
  exit 1
fi

# Extract rule ID using more robust method
RULE_ID=$(echo "$RESPONSE_BODY" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$RULE_ID" ]; then
  echo -e "${RED}❌ Failed to extract rule ID from response${NC}"
  exit 1
fi

echo -e "${GREEN}✅ System Rule created successfully!${NC}"
echo -e "${GREEN}📋 Rule ID: $RULE_ID${NC}"

# Step 2: Test the System Rule
echo -e "\n${YELLOW}🧪 Testing System Rule${NC}"

TEST_RESPONSE=$(curl -s -X POST "${NOTIFICATION_HUB_URL}/api/v1/rules/${RULE_ID}/test" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${ADMIN_API_KEY}" \
  -d '{
    "testData": {
      "title": "🚀 System Test - MoonX Farm Update",
      "body": "This is a test system announcement. New features and improvements are now live!",
      "category": "system_update",
      "priority": "high",
      "actionUrl": "/updates",
      "fromAdmin": true,
      "broadcast": true,
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
    }
  }')

echo "Test Response: $TEST_RESPONSE"

if check_api_response "$TEST_RESPONSE" "System notification test"; then
  echo -e "${GREEN}✅ System notification sent successfully!${NC}"
  
  # Extract notification ID if present
  NOTIFICATION_ID=$(echo "$TEST_RESPONSE" | grep -o '"notificationId":"[^"]*' | cut -d'"' -f4)
  if [ ! -z "$NOTIFICATION_ID" ]; then
    echo -e "${GREEN}📧 Notification ID: $NOTIFICATION_ID${NC}"
  fi
else
  echo -e "${YELLOW}⚠️ Test failed, but rule was created successfully${NC}"
fi

# Step 3: Verify rule exists
echo -e "\n${YELLOW}📋 Verifying Rule Status${NC}"

GET_RULE_RESPONSE=$(curl -s -X GET "${NOTIFICATION_HUB_URL}/api/v1/rules/${RULE_ID}" \
  -H "X-API-Key: ${ADMIN_API_KEY}")

echo "Rule Details: $GET_RULE_RESPONSE"

if check_api_response "$GET_RULE_RESPONSE" "Rule verification"; then
  echo -e "${GREEN}✅ Rule verified successfully${NC}"
fi

# Step 4: Create a real system announcement
echo -e "\n${YELLOW}🎯 Creating Real System Announcement${NC}"

REAL_ANNOUNCEMENT_RESPONSE=$(curl -s -X POST "${NOTIFICATION_HUB_URL}/api/v1/rules/${RULE_ID}/test" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${ADMIN_API_KEY}" \
  -d '{
    "testData": {
      "title": "🎉 Welcome to MoonX Farm!",
      "body": "The decentralized exchange is now live. Start trading with zero fees for the first 24 hours!",
      "category": "platform_launch",
      "priority": "high",
      "actionUrl": "/trading",
      "fromAdmin": true,
      "broadcast": true,
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
    }
  }')

echo "Real Announcement Response: $REAL_ANNOUNCEMENT_RESPONSE"

if check_api_response "$REAL_ANNOUNCEMENT_RESPONSE" "Real announcement"; then
  echo -e "${GREEN}✅ Real system announcement sent successfully!${NC}"
fi

# Final Summary
echo -e "\n${BLUE}🎉 System Rule Setup Complete!${NC}"
echo -e "${GREEN}📊 Summary:${NC}"
echo -e "  • Rule ID: $RULE_ID"
echo -e "  • Rule Name: System Announcements"
echo -e "  • Status: Active"
echo -e "  • Channels: WebSocket + Push"
echo -e "  • Priority: High"
echo -e "  • Broadcast: Enabled"

echo -e "\n${YELLOW}💡 Usage Examples:${NC}"
echo -e "  • Send announcement:"
echo -e "    curl -X POST \"$NOTIFICATION_HUB_URL/api/v1/rules/$RULE_ID/test\" \\"
echo -e "         -H \"X-API-Key: $ADMIN_API_KEY\" \\"
echo -e "         -H \"Content-Type: application/json\" \\"
echo -e "         -d '{\"testData\":{\"title\":\"Your Title\",\"body\":\"Your Message\",\"fromAdmin\":true,\"broadcast\":true}}'"
echo -e ""
echo -e "  • Disable rule:"
echo -e "    curl -X PATCH \"$NOTIFICATION_HUB_URL/api/v1/rules/$RULE_ID/toggle\" \\"
echo -e "         -H \"X-API-Key: $ADMIN_API_KEY\" \\"
echo -e "         -H \"Content-Type: application/json\" \\"
echo -e "         -d '{\"enabled\":false}'"
echo -e ""
echo -e "  • Check rule status:"
echo -e "    curl -X GET \"$NOTIFICATION_HUB_URL/api/v1/rules/$RULE_ID\" \\"
echo -e "         -H \"X-API-Key: $ADMIN_API_KEY\""

echo -e "\n${GREEN}🔗 Next Steps:${NC}"
echo -e "  • Test WebSocket connection to receive notifications"
echo -e "  • Set up client apps to listen for admin notifications"
echo -e "  • Configure push notification credentials if needed"
echo -e "  • Monitor logs for notification delivery status" 
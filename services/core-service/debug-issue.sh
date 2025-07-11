#!/bin/bash

# =============================================================================
# Debug Issue Script - Core Service
# =============================================================================
# This script helps identify why the API is returning 404 for new routes
# =============================================================================

set -e

echo "🔍 Debugging Core Service Issue..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service configuration
CONTAINER_NAME="moonx-core-service"
PORT=3007

echo -e "${YELLOW}📋 Step 1: Checking container status...${NC}"
if docker ps | grep -q $CONTAINER_NAME; then
    echo -e "${GREEN}✅ Container is running${NC}"
    CONTAINER_ID=$(docker ps -q --filter "name=$CONTAINER_NAME")
    echo -e "${BLUE}Container ID: $CONTAINER_ID${NC}"
    
    # Check when container was created
    CREATED=$(docker inspect --format='{{.Created}}' $CONTAINER_ID)
    echo -e "${BLUE}Container created: $CREATED${NC}"
else
    echo -e "${RED}❌ Container is not running${NC}"
    exit 1
fi

echo -e "${YELLOW}🔍 Step 2: Checking service health...${NC}"
if curl -s http://localhost:$PORT/health > /dev/null; then
    echo -e "${GREEN}✅ Service is healthy${NC}"
    curl -s http://localhost:$PORT/health | jq '.'
else
    echo -e "${RED}❌ Service is not healthy${NC}"
fi

echo -e "${YELLOW}🔍 Step 3: Testing the problematic route...${NC}"
echo -e "${BLUE}Testing: GET /api/v1/stats/chain?limit=10${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:$PORT/api/v1/stats/chain?limit=10)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo -e "${BLUE}HTTP Status: $HTTP_CODE${NC}"
echo -e "${BLUE}Response Body:${NC}"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

echo -e "${YELLOW}🔍 Step 4: Testing other routes...${NC}"
echo -e "${BLUE}Testing: GET /api/v1/chains${NC}"
curl -s -w "\nHTTP Status: %{http_code}\n" http://localhost:$PORT/api/v1/chains | head -5

echo -e "${YELLOW}📋 Step 5: Checking container logs...${NC}"
echo -e "${BLUE}Recent logs:${NC}"
docker logs $CONTAINER_NAME --tail 50

echo -e "${YELLOW}🔍 Step 6: Checking source code in container...${NC}"
echo -e "${BLUE}Checking if statsController.ts exists in container:${NC}"
docker exec $CONTAINER_NAME ls -la dist/controllers/ 2>/dev/null || echo "dist/controllers/ not found"

echo -e "${BLUE}Checking if stats routes are registered:${NC}"
docker exec $CONTAINER_NAME grep -r "stats" dist/ 2>/dev/null | head -5 || echo "No stats references found"

echo -e "${YELLOW}🔍 Step 7: Checking build timestamp...${NC}"
echo -e "${BLUE}Build timestamp in container:${NC}"
docker exec $CONTAINER_NAME stat dist/index.js 2>/dev/null || echo "dist/index.js not found"

echo -e "${YELLOW}📋 Step 8: Recommendations...${NC}"
if [ "$HTTP_CODE" = "404" ]; then
    echo -e "${RED}❌ Route not found - This indicates:${NC}"
    echo -e "${RED}   1. Container is running old code${NC}"
    echo -e "${RED}   2. Routes are not properly registered${NC}"
    echo -e "${RED}   3. Build cache issue${NC}"
    echo ""
    echo -e "${GREEN}🔧 Solutions:${NC}"
    echo -e "${GREEN}   1. Run: ./build-fresh.sh (recommended)${NC}"
    echo -e "${GREEN}   2. Or restart container: docker restart $CONTAINER_NAME${NC}"
    echo -e "${GREEN}   3. Or rebuild: docker build --no-cache -t moonx-farm/core-service .${NC}"
else
    echo -e "${GREEN}✅ Route is working!${NC}"
fi

echo -e "${BLUE}🎉 Debug completed!${NC}" 
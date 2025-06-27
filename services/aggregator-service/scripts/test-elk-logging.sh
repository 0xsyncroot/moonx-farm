#!/bin/bash

# Test ELK Logging Script for MoonX Aggregator Service
# This script tests the ELK stack integration

set -e

echo "🧪 Testing ELK Logging Integration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if services are running
check_service() {
    local service_name=$1
    local port=$2
    
    if curl -s "http://localhost:$port" > /dev/null 2>&1; then
        print_success "$service_name is running on port $port"
        return 0
    else
        print_error "$service_name is not running on port $port"
        return 1
    fi
}

# Test Elasticsearch
test_elasticsearch() {
    print_status "Testing Elasticsearch connection..."
    
    if check_service "Elasticsearch" 9200; then
        # Check cluster health
        local health=$(curl -s "http://localhost:9200/_cluster/health" | jq -r '.status')
        if [ "$health" = "green" ] || [ "$health" = "yellow" ]; then
            print_success "Elasticsearch cluster is healthy (status: $health)"
        else
            print_warning "Elasticsearch cluster status: $health"
        fi
        
        # Check indices
        local indices=$(curl -s "http://localhost:9200/_cat/indices?v" | grep moonx-farm || true)
        if [ -n "$indices" ]; then
            print_success "Found MoonX indices in Elasticsearch"
            echo "$indices"
        else
            print_warning "No MoonX indices found yet"
        fi
    fi
}

# Test Kibana
test_kibana() {
    print_status "Testing Kibana connection..."
    
    if check_service "Kibana" 5601; then
        print_success "Kibana is accessible at http://localhost:5601"
        print_status "You can access Kibana with:"
        echo "  - URL: http://localhost:5601"
        echo "  - No authentication required (security disabled)"
    fi
}

# Test Logstash
test_logstash() {
    print_status "Testing Logstash connection..."
    
    if check_service "Logstash" 9600; then
        print_success "Logstash is running"
        
        # Check Logstash pipeline status
        local pipeline_status=$(curl -s "http://localhost:9600/_node/pipeline" | jq -r '.pipelines.main.plugins.inputs[0].config.paths[0]' 2>/dev/null || echo "unknown")
        if [ "$pipeline_status" != "unknown" ]; then
            print_success "Logstash pipeline is configured to read from: $pipeline_status"
        else
            print_warning "Could not verify Logstash pipeline configuration"
        fi
    fi
}

# Test Aggregator Service
test_aggregator_service() {
    print_status "Testing Aggregator Service..."
    
    if check_service "Aggregator Service" 3007; then
        print_success "Aggregator Service is running"
        
        # Test health endpoint
        local health=$(curl -s "http://localhost:3007/health" | jq -r '.status' 2>/dev/null || echo "unknown")
        if [ "$health" = "ok" ]; then
            print_success "Aggregator Service health check passed"
        else
            print_warning "Aggregator Service health check returned: $health"
        fi
        
        # Test metrics endpoint
        if curl -s "http://localhost:9091/metrics" > /dev/null 2>&1; then
            print_success "Prometheus metrics endpoint is accessible"
        else
            print_warning "Prometheus metrics endpoint is not accessible"
        fi
    fi
}

# Generate test logs
generate_test_logs() {
    print_status "Generating test logs..."
    
    # Make some API calls to generate logs
    local endpoints=(
        "/health"
        "/ready"
        "/api/v1/health"
        "/api/v1/ready"
    )
    
    for endpoint in "${endpoints[@]}"; do
        print_status "Calling $endpoint..."
        curl -s "http://localhost:3003$endpoint" > /dev/null 2>&1 || true
        sleep 1
    done
    
    print_success "Test API calls completed"
}

# Check logs in Elasticsearch
check_logs_in_elasticsearch() {
    print_status "Checking logs in Elasticsearch..."
    
    # Wait a bit for logs to be processed
    sleep 5
    
    # Search for recent logs
    local recent_logs=$(curl -s "http://localhost:9200/moonx-farm-*/_search" \
        -H "Content-Type: application/json" \
        -d '{
            "query": {
                "range": {
                    "@timestamp": {
                        "gte": "now-5m"
                    }
                }
            },
            "sort": [{"@timestamp": {"order": "desc"}}],
            "size": 10
        }' | jq -r '.hits.hits[]._source.service' 2>/dev/null || echo "")
    
    if [ -n "$recent_logs" ]; then
        print_success "Found recent logs in Elasticsearch:"
        echo "$recent_logs" | sort | uniq -c
    else
        print_warning "No recent logs found in Elasticsearch"
    fi
}

# Main test execution
main() {
    echo "🚀 Starting ELK Logging Test Suite..."
    echo "======================================"
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        print_error "jq is required but not installed. Please install jq first."
        exit 1
    fi
    
    # Test services
    test_elasticsearch
    test_kibana
    test_logstash
    test_aggregator_service
    
    echo ""
    echo "📝 Generating test logs..."
    generate_test_logs
    
    echo ""
    echo "🔍 Checking logs in Elasticsearch..."
    check_logs_in_elasticsearch
    
    echo ""
    echo "✅ ELK Logging Test Complete!"
    echo ""
    echo "📊 Access your monitoring stack:"
    echo "  - Kibana: http://localhost:5601"
    echo "  - Grafana: http://localhost:3001 (admin/admin123)"
    echo "  - Prometheus: http://localhost:9091"
    echo "  - Aggregator Service: http://localhost:3007"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Open Kibana and create an index pattern for 'moonx-farm-*'"
    echo "  2. Create visualizations and dashboards"
    echo "  3. Set up alerts for critical errors"
    echo "  4. Configure log retention policies"
}

# Run main function
main "$@" 
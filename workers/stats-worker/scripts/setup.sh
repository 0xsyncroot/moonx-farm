#!/bin/bash

# ================================
# Stats Worker Setup Script
# ================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}MoonX Farm Stats Worker Setup${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# ================================
# Functions
# ================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

prompt_user() {
    local prompt="$1"
    local default="$2"
    local value
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " value
        echo "${value:-$default}"
    else
        read -p "$prompt: " value
        echo "$value"
    fi
}

check_dependency() {
    local cmd="$1"
    local name="$2"
    
    if ! command -v "$cmd" &> /dev/null; then
        log_error "$name is not installed. Please install it first."
        return 1
    fi
    log_success "$name is installed"
    return 0
}

# ================================
# Check Dependencies
# ================================

log_info "Checking dependencies..."

check_dependency "node" "Node.js" || exit 1
check_dependency "npm" "npm" || exit 1

# Optional dependencies
check_dependency "docker" "Docker" || log_warning "Docker not found - Docker deployment won't be available"
check_dependency "docker-compose" "Docker Compose" || log_warning "Docker Compose not found - Docker deployment won't be available"

echo ""

# ================================
# Create Environment File
# ================================

ENV_FILE="$PROJECT_DIR/.env"
ENV_TEMPLATE="$PROJECT_DIR/env.template"

log_info "Setting up environment configuration..."

if [ -f "$ENV_FILE" ]; then
    log_warning ".env file already exists"
    overwrite=$(prompt_user "Do you want to overwrite it? (y/N)" "n")
    if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
        log_info "Using existing .env file"
    else
        rm "$ENV_FILE"
        log_info "Removed existing .env file"
    fi
fi

if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ENV_TEMPLATE" ]; then
        cp "$ENV_TEMPLATE" "$ENV_FILE"
        log_success "Created .env file from template"
    else
        log_error "Template file not found: $ENV_TEMPLATE"
        exit 1
    fi
fi

# ================================
# Configure Environment Variables
# ================================

log_info "Configuring environment variables..."

# Node Environment
node_env=$(prompt_user "Environment (development/staging/production)" "development")
sed -i "s/NODE_ENV=.*/NODE_ENV=$node_env/" "$ENV_FILE"

# Alchemy API Key
log_info "Alchemy API Key is required for blockchain data access"
log_info "Get your free API key at: https://dashboard.alchemy.com/"
alchemy_key=$(prompt_user "Enter your Alchemy API Key")

if [ -n "$alchemy_key" ]; then
    sed -i "s/ALCHEMY_API_KEY=.*/ALCHEMY_API_KEY=$alchemy_key/" "$ENV_FILE"
    sed -i "s/YOUR_API_KEY/$alchemy_key/g" "$ENV_FILE"
    log_success "Alchemy API key configured"
else
    log_warning "No Alchemy API key provided - you'll need to configure it manually"
fi

# Database Configuration
setup_db=$(prompt_user "Setup MongoDB configuration? (Y/n)" "y")
if [[ "$setup_db" =~ ^[Yy]$ ]]; then
    mongo_uri=$(prompt_user "MongoDB URI" "mongodb://localhost:27017/moonx-farm")
    sed -i "s|MONGODB_URI=.*|MONGODB_URI=$mongo_uri|" "$ENV_FILE"
    log_success "MongoDB configuration updated"
fi

# Kafka Configuration
setup_kafka=$(prompt_user "Setup Kafka configuration? (Y/n)" "y")
if [[ "$setup_kafka" =~ ^[Yy]$ ]]; then
    kafka_brokers=$(prompt_user "Kafka brokers" "localhost:9092")
    sed -i "s/KAFKA_BROKERS=.*/KAFKA_BROKERS=$kafka_brokers/" "$ENV_FILE"
    log_success "Kafka configuration updated"
fi

# Job Scheduling
if [ "$node_env" = "development" ]; then
    log_info "Setting development intervals (faster for testing)"
    sed -i "s/# STATS_COLLECTION_INTERVAL=\*\/30/STATS_COLLECTION_INTERVAL=*\/30/" "$ENV_FILE"
    sed -i "s/# CHAIN_PERFORMANCE_INTERVAL=\*\/15/CHAIN_PERFORMANCE_INTERVAL=*\/15/" "$ENV_FILE"
    sed -i "s/# BRIDGE_LATENCY_INTERVAL=\*\/20/BRIDGE_LATENCY_INTERVAL=*\/20/" "$ENV_FILE"
    sed -i "s/STATS_COLLECTION_INTERVAL=0 \*\/5/# STATS_COLLECTION_INTERVAL=0 *\/5/" "$ENV_FILE"
    sed -i "s/CHAIN_PERFORMANCE_INTERVAL=0 \*\/1/# CHAIN_PERFORMANCE_INTERVAL=0 *\/1/" "$ENV_FILE"
    sed -i "s/BRIDGE_LATENCY_INTERVAL=0 \*\/2/# BRIDGE_LATENCY_INTERVAL=0 *\/2/" "$ENV_FILE"
fi

# Cluster Mode for Production
if [ "$node_env" = "production" ]; then
    log_info "Enabling cluster mode for production"
    sed -i "s/CLUSTER_MODE=false/CLUSTER_MODE=true/" "$ENV_FILE"
    workers=$(prompt_user "Number of worker processes (0 = auto)" "0")
    sed -i "s/CLUSTER_WORKERS=0/CLUSTER_WORKERS=$workers/" "$ENV_FILE"
fi

echo ""

# ================================
# Install Dependencies
# ================================

log_info "Installing Node.js dependencies..."

cd "$PROJECT_DIR"

if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

log_success "Dependencies installed"

# ================================
# Build Project
# ================================

log_info "Building project..."

npm run build

log_success "Project built successfully"

# ================================
# Create Directories
# ================================

log_info "Creating required directories..."

mkdir -p "$PROJECT_DIR/logs"
mkdir -p "$PROJECT_DIR/data"
mkdir -p "$PROJECT_DIR/scripts"

log_success "Directories created"

# ================================
# Docker Setup (Optional)
# ================================

if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    setup_docker=$(prompt_user "Setup Docker environment? (y/N)" "n")
    if [[ "$setup_docker" =~ ^[Yy]$ ]]; then
        log_info "Setting up Docker environment..."
        
        # Create .env for docker-compose
        cat > "$PROJECT_DIR/.env.docker" << EOF
ALCHEMY_API_KEY=$alchemy_key
MONGODB_ROOT_PASSWORD=moonx123
MONGODB_EXPRESS_PASSWORD=moonx123
EOF
        
        log_success "Docker environment configured"
        log_info "You can now run: docker-compose up -d"
    fi
fi

# ================================
# MongoDB Initialization Script
# ================================

log_info "Creating MongoDB initialization script..."

cat > "$PROJECT_DIR/scripts/mongo-init.js" << 'EOF'
// MongoDB initialization script for MoonX Farm Stats Worker

// Switch to moonx-farm database
db = db.getSiblingDB('moonx-farm');

// Create collections with validation
db.createCollection('chain_stats', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['chainId', 'chainName', 'blockTime', 'updatedAt'],
      properties: {
        chainId: { bsonType: 'number' },
        chainName: { bsonType: 'string' },
        blockTime: {
          bsonType: 'object',
          required: ['current', 'timestamp'],
          properties: {
            current: { bsonType: 'number' },
            change: { bsonType: 'string' },
            changePercent: { bsonType: 'number' },
            timestamp: { bsonType: 'number' }
          }
        },
        volume24h: { bsonType: 'string' },
        volumeUSD: { bsonType: 'number' },
        status: { enum: ['healthy', 'degraded', 'unhealthy'] },
        updatedAt: { bsonType: 'date' },
        expiresAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('bridge_stats', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['provider', 'latency', 'status', 'timestamp', 'updatedAt'],
      properties: {
        provider: { enum: ['LI.FI', 'Relay.link', '1inch'] },
        latency: { bsonType: 'number' },
        status: { enum: ['healthy', 'degraded', 'unhealthy'] },
        timestamp: { bsonType: 'number' },
        updatedAt: { bsonType: 'date' },
        expiresAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('stats_overview', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['chainPerformance', 'bridgeLatency', 'lastUpdated', 'healthStatus'],
      properties: {
        chainPerformance: { bsonType: 'array' },
        bridgeLatency: { bsonType: 'array' },
        lastUpdated: { bsonType: 'date' },
        healthStatus: { enum: ['healthy', 'degraded', 'unhealthy'] },
        expiresAt: { bsonType: 'date' }
      }
    }
  }
});

// Create indexes for performance
db.chain_stats.createIndex({ chainId: 1, updatedAt: -1 });
db.chain_stats.createIndex({ updatedAt: -1 });
db.chain_stats.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

db.bridge_stats.createIndex({ provider: 1, updatedAt: -1 });
db.bridge_stats.createIndex({ updatedAt: -1 });
db.bridge_stats.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

db.stats_overview.createIndex({ _id: 1 });
db.stats_overview.createIndex({ lastUpdated: -1 });
db.stats_overview.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

print('MongoDB collections and indexes created successfully');
EOF

log_success "MongoDB initialization script created"

# ================================
# Create Helper Scripts
# ================================

log_info "Creating helper scripts..."

# Start script
cat > "$PROJECT_DIR/scripts/start.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/.."
echo "Starting Stats Worker Service..."
npm start
EOF

# Development script
cat > "$PROJECT_DIR/scripts/dev.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/.."
echo "Starting Stats Worker Service in development mode..."
npm run dev
EOF

# Health check script
cat > "$PROJECT_DIR/scripts/health-check.sh" << 'EOF'
#!/bin/bash
# Check if stats-worker process is running
ps aux | grep -v grep | grep 'stats-worker' || exit 1
EOF

# Make scripts executable
chmod +x "$PROJECT_DIR/scripts/"*.sh

log_success "Helper scripts created"

# ================================
# Summary
# ================================

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

log_success "Stats Worker Service is ready to run"
echo ""

echo -e "${BLUE}Next Steps:${NC}"
echo "1. Review and update .env file if needed"
echo "2. Start the service:"
echo "   - Development: npm run dev"
echo "   - Production: npm start"
echo "   - Docker: docker-compose up -d"
echo ""

echo -e "${BLUE}Available Scripts:${NC}"
echo "- ./scripts/start.sh - Start production service"
echo "- ./scripts/dev.sh - Start development service"
echo "- ./scripts/health-check.sh - Check service health"
echo ""

echo -e "${BLUE}Service URLs:${NC}"
echo "- MongoDB Express: http://localhost:8081 (development profile)"
echo "- Kafka UI: http://localhost:8080 (development profile)"
echo "- Stats Worker: Background service (no HTTP endpoints)"
echo ""

echo -e "${BLUE}Configuration Files:${NC}"
echo "- Environment: .env"
echo "- Docker: docker-compose.yml"
echo "- MongoDB Init: scripts/mongo-init.js"
echo ""

if [ -z "$alchemy_key" ]; then
    log_warning "Remember to set your Alchemy API key in .env file"
fi

log_success "Setup completed successfully!" 
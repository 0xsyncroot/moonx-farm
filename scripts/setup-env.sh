#!/bin/bash

# =============================================================================
# MoonX Farm DEX - Environment Setup Script
# =============================================================================
# Script to setup environment variables for development

set -e

echo "🚀 Setting up MoonX Farm DEX environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if .env file exists
if [ -f ".env" ]; then
    print_warning ".env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Keeping existing .env file"
        exit 0
    fi
fi

# Copy env.example to .env
if [ -f "env.example" ]; then
    cp env.example .env
    print_status "Created .env file from env.example"
else
    print_error "env.example file not found!"
    exit 1
fi

# Generate random secrets
print_info "Generating secure random secrets..."

# Generate JWT secret (64 characters)
JWT_SECRET=$(openssl rand -hex 32)
sed -i "s/your-super-secret-jwt-key-change-this-in-production/$JWT_SECRET/g" .env
print_status "Generated JWT_SECRET"

# Generate session secret (64 characters)
SESSION_SECRET=$(openssl rand -hex 32)
sed -i "s/your-session-secret-key/$SESSION_SECRET/g" .env
print_status "Generated SESSION_SECRET"

# Prompt for database configuration
print_info "Setting up database configuration..."
read -p "Database host (localhost): " db_host
db_host=${db_host:-localhost}
sed -i "s/DATABASE_HOST=localhost/DATABASE_HOST=$db_host/g" .env

read -p "Database port (5432): " db_port
db_port=${db_port:-5432}
sed -i "s/DATABASE_PORT=5432/DATABASE_PORT=$db_port/g" .env

read -p "Database name (moonx_farm): " db_name
db_name=${db_name:-moonx_farm}
sed -i "s/DATABASE_NAME=moonx_farm/DATABASE_NAME=$db_name/g" .env

read -p "Database user (postgres): " db_user
db_user=${db_user:-postgres}
sed -i "s/DATABASE_USER=postgres/DATABASE_USER=$db_user/g" .env

read -s -p "Database password (postgres123): " db_password
echo
db_password=${db_password:-postgres123}
sed -i "s/DATABASE_PASSWORD=postgres123/DATABASE_PASSWORD=$db_password/g" .env

print_status "Database configuration set"

# Prompt for Redis configuration
print_info "Setting up Redis configuration..."
read -p "Redis host (localhost): " redis_host
redis_host=${redis_host:-localhost}
sed -i "s/REDIS_HOST=localhost/REDIS_HOST=$redis_host/g" .env

read -p "Redis port (6379): " redis_port
redis_port=${redis_port:-6379}
sed -i "s/REDIS_PORT=6379/REDIS_PORT=$redis_port/g" .env

read -s -p "Redis password (leave empty if none): " redis_password
echo
if [ ! -z "$redis_password" ]; then
    sed -i "s/REDIS_PASSWORD=/REDIS_PASSWORD=$redis_password/g" .env
fi

print_status "Redis configuration set"

# Prompt for Kafka configuration
print_info "Setting up Kafka configuration..."
read -p "Kafka brokers (localhost:9092): " kafka_brokers
kafka_brokers=${kafka_brokers:-localhost:9092}
sed -i "s/KAFKA_BROKERS=localhost:9092/KAFKA_BROKERS=$kafka_brokers/g" .env

print_status "Kafka configuration set"

# Prompt for external API keys (optional)
print_info "Setting up external API keys (optional)..."

read -p "CoinGecko API key (optional): " coingecko_key
if [ ! -z "$coingecko_key" ]; then
    sed -i "s/COINGECKO_API_KEY=your-coingecko-api-key/COINGECKO_API_KEY=$coingecko_key/g" .env
fi

read -p "CoinMarketCap API key (optional): " cmc_key
if [ ! -z "$cmc_key" ]; then
    sed -i "s/COINMARKETCAP_API_KEY=your-coinmarketcap-api-key/COINMARKETCAP_API_KEY=$cmc_key/g" .env
fi

read -p "Alchemy API key (optional): " alchemy_key
if [ ! -z "$alchemy_key" ]; then
    sed -i "s/ALCHEMY_API_KEY=your-alchemy-api-key/ALCHEMY_API_KEY=$alchemy_key/g" .env
fi

# Set development-specific values
print_info "Setting development-specific configurations..."
sed -i "s/NODE_ENV=development/NODE_ENV=development/g" .env
sed -i "s/LOG_LEVEL=debug/LOG_LEVEL=debug/g" .env
sed -i "s/DEV_MODE=true/DEV_MODE=true/g" .env

print_status "Environment setup completed!"

echo
print_info "📋 Next steps:"
echo "   1. Review the .env file and adjust values as needed"
echo "   2. Install dependencies: pnpm install"
echo "   3. Build packages: pnpm build"
echo "   4. Start development: make dev-up"
echo
print_warning "🔒 Security reminder:"
echo "   - Never commit the .env file to version control"
echo "   - Use different secrets for production"
echo "   - Rotate secrets regularly"
echo

# Create .env files for different environments
print_info "Creating environment-specific files..."

# Create .env.development
cp .env .env.development
print_status "Created .env.development"

# Create .env.test template
cat > .env.test << EOF
# Test environment configuration
NODE_ENV=test
LOG_LEVEL=error

# Test Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=moonx_farm_test
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres123
DATABASE_SSL=false

# Test Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=1

# Test Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=moonx-farm-test

# Test JWT
JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET

# Mock external APIs in test
MOCK_EXTERNAL_APIS=true
EOF

print_status "Created .env.test"

# Create .env.production template
cat > .env.production.example << EOF
# Production environment configuration template
# Copy this to .env.production and fill with actual production values

NODE_ENV=production
LOG_LEVEL=info

# Production Database
DATABASE_HOST=your-production-db-host
DATABASE_PORT=5432
DATABASE_NAME=moonx_farm_prod
DATABASE_USER=your-prod-db-user
DATABASE_PASSWORD=your-secure-prod-password
DATABASE_SSL=true

# Production Redis
REDIS_HOST=your-production-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-redis-password

# Production Kafka
KAFKA_BROKERS=your-kafka-cluster
KAFKA_SSL=true
KAFKA_USERNAME=your-kafka-user
KAFKA_PASSWORD=your-kafka-password

# Production JWT (generate new secrets!)
JWT_SECRET=generate-new-64-char-secret-for-production
SESSION_SECRET=generate-new-64-char-secret-for-production

# Production API keys
COINGECKO_API_KEY=your-production-coingecko-key
COINMARKETCAP_API_KEY=your-production-cmc-key
ALCHEMY_API_KEY=your-production-alchemy-key

# Production blockchain RPCs
BASE_MAINNET_RPC=your-production-base-rpc
BSC_MAINNET_RPC=your-production-bsc-rpc
EOF

print_status "Created .env.production.example"

echo
print_status "🎉 Environment setup completed successfully!"
print_info "You can now start developing with: make dev-up" 
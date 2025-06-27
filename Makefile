# ================================
# MoonXFarm DEX - Development Makefile
# ================================

.PHONY: help install build dev test lint clean docker-dev docker-prod setup-env

# Default target
help: ## Show this help message
	@echo 'Usage: make <target>'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ===================
# Development Commands
# ===================

install: ## Install all dependencies
	@echo "Installing dependencies..."
	npm install
	@echo "Installing service dependencies..."
	cd services/aggregator-service && go mod download
	cd workers/price-crawler && go mod download

build: ## Build all services
	@echo "Building all services..."
	npm run build

dev: ## Start development environment
	@echo "Starting development environment..."
	npm run dev

dev-services: ## Start only backend services
	@echo "Starting backend services..."
	docker-compose up -d postgres redis kafka zookeeper
	npm run dev --workspace=services

dev-frontend: ## Start only frontend
	@echo "Starting frontend..."
	npm run dev --workspace=apps/web

# ===================
# Testing & Quality
# ===================

test: ## Run all tests
	@echo "Running tests..."
	npm run test

test-unit: ## Run unit tests only
	@echo "Running unit tests..."
	npm run test --workspaces

test-integration: ## Run integration tests
	@echo "Running integration tests..."
	cd tests/integration && npm test

test-e2e: ## Run end-to-end tests
	@echo "Running E2E tests..."
	cd tests/e2e && npm test

lint: ## Run linting
	@echo "Running linters..."
	npm run lint

lint-fix: ## Fix linting issues
	@echo "Fixing linting issues..."
	npm run lint --workspaces -- --fix

# ===================
# Docker Commands
# ===================

docker-dev: ## Start development environment with Docker
	@echo "Starting development environment with Docker..."
	docker-compose up -d

docker-dev-build: ## Build and start development environment
	@echo "Building and starting development environment..."
	docker-compose up -d --build

docker-prod: ## Start production environment
	@echo "Starting production environment..."
	docker-compose -f infrastructure/docker/docker-compose.prod.yml up -d

docker-stop: ## Stop all Docker containers
	@echo "Stopping Docker containers..."
	docker-compose down

docker-clean: ## Clean up Docker containers and images
	@echo "Cleaning up Docker..."
	docker-compose down -v --rmi all --remove-orphans

# ===================
# Database Commands
# ===================

db-migrate: ## Run database migrations
	@echo "Running database migrations..."
	cd database && npm run migrate

db-seed: ## Seed database with test data
	@echo "Seeding database..."
	cd database && npm run seed

db-reset: ## Reset database (drop and recreate)
	@echo "Resetting database..."
	cd database && npm run reset

# ===================
# Contract Commands
# ===================

contracts-build: ## Build smart contracts
	@echo "Building smart contracts..."
	cd contracts && forge build

contracts-test: ## Test smart contracts
	@echo "Testing smart contracts..."
	cd contracts && forge test

contracts-deploy-base-testnet: ## Deploy to Base testnet
	@echo "Deploying to Base testnet..."
	cd contracts && forge script script/Deploy.s.sol --rpc-url $(BASE_TESTNET_RPC_URL) --broadcast

contracts-deploy-bsc-testnet: ## Deploy to BSC testnet
	@echo "Deploying to BSC testnet..."
	cd contracts && forge script script/Deploy.s.sol --rpc-url $(BSC_TESTNET_RPC_URL) --broadcast

# ===================
# Environment Setup
# ===================

setup-env: ## Setup environment files from examples
	@echo "Setting up environment files..."
	./scripts/setup/generate-env-files.sh

setup-local: ## Complete local development setup
	@echo "Setting up local development environment..."
	./scripts/setup/setup-local-env.sh

# ===================
# Monitoring Commands
# ===================

logs: ## View logs from all services
	@echo "Viewing logs..."
	docker-compose logs -f

logs-service: ## View logs from specific service (usage: make logs-service SERVICE=notify-service)
	@echo "Viewing logs for $(SERVICE)..."
	docker-compose logs -f $(SERVICE)

monitoring-up: ## Start monitoring stack
	@echo "Starting monitoring stack..."
	docker-compose up -d prometheus grafana

monitoring-down: ## Stop monitoring stack
	@echo "Stopping monitoring stack..."
	docker-compose stop prometheus grafana

# ===================
# Deployment Commands
# ===================

deploy-staging: ## Deploy to staging environment
	@echo "Deploying to staging..."
	./scripts/deployment/deploy-staging.sh

deploy-production: ## Deploy to production environment
	@echo "Deploying to production..."
	./scripts/deployment/deploy-production.sh

# ===================
# Utility Commands
# ===================

clean: ## Clean build artifacts and node_modules
	@echo "Cleaning up..."
	npm run clean
	find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
	find . -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true

format: ## Format code
	@echo "Formatting code..."
	npm run format --workspaces --if-present

security-scan: ## Run security scan
	@echo "Running security scan..."
	npm audit
	./scripts/testing/security-scan.sh

check: ## Run all checks (lint, test, security)
	@echo "Running all checks..."
	make lint
	make test
	make security-scan

# ===================
# Performance Commands
# ===================

load-test: ## Run load tests
	@echo "Running load tests..."
	cd tests/performance && npm run load-test

benchmark: ## Run benchmark tests
	@echo "Running benchmarks..."
	cd tests/performance && npm run benchmark

# ===================
# Documentation
# ===================

docs-serve: ## Serve documentation locally
	@echo "Starting documentation server..."
	cd docs && npm run serve

docs-build: ## Build documentation
	@echo "Building documentation..."
	cd docs && npm run build 
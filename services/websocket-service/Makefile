# =============================================================================
# MoonXFarm WebSocket Service - Makefile
# =============================================================================
# Convenient commands for managing the WebSocket service with Docker Compose
# =============================================================================

.PHONY: help build up down restart logs health clean setup test

# Default target
.DEFAULT_GOAL := help

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

# Help target
help: ## Show this help message
	@echo "$(BLUE)MoonXFarm WebSocket Service - Docker Compose Commands$(NC)"
	@echo ""
	@echo "$(YELLOW)Usage:$(NC)"
	@echo "  make [target]"
	@echo ""
	@echo "$(YELLOW)Available targets:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-12s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(YELLOW)Examples:$(NC)"
	@echo "  make setup    # First time setup"
	@echo "  make up       # Start all services"
	@echo "  make logs     # View logs"
	@echo "  make health   # Check service health"
	@echo "  make down     # Stop all services"

# Environment check
check-env: ## Check if .env file exists
	@if [ ! -f .env ]; then \
		echo "$(RED)Error: .env file not found!$(NC)"; \
		echo "$(YELLOW)Please copy .env.example to .env and configure it:$(NC)"; \
		echo "  cp .env.example .env"; \
		echo "  vim .env"; \
		exit 1; \
	fi

# Setup (first time)
setup: check-env ## First time setup - create .env and start services
	@echo "$(BLUE)Setting up WebSocket Service...$(NC)"
	@echo "$(YELLOW)Starting all services...$(NC)"
	@docker-compose up -d
	@echo "$(GREEN)Setup complete!$(NC)"
	@echo "$(YELLOW)Checking service health...$(NC)"
	@sleep 15
	@make health

# Build images
build: ## Build Docker images
	@echo "$(BLUE)Building Docker images...$(NC)"
	@docker-compose build

# Start services
up: check-env ## Start all services
	@echo "$(BLUE)Starting WebSocket Service...$(NC)"
	@docker-compose up -d
	@echo "$(GREEN)Services started!$(NC)"
	@echo "$(YELLOW)WebSocket Service: http://localhost:3008$(NC)"
	@echo "$(YELLOW)Health Check: http://localhost:3008/health$(NC)"

# Start services in foreground
up-fg: check-env ## Start all services in foreground
	@echo "$(BLUE)Starting WebSocket Service in foreground...$(NC)"
	@docker-compose up

# Stop services
down: ## Stop all services
	@echo "$(BLUE)Stopping WebSocket Service...$(NC)"
	@docker-compose down
	@echo "$(GREEN)Services stopped!$(NC)"

# Restart services
restart: ## Restart all services
	@echo "$(BLUE)Restarting WebSocket Service...$(NC)"
	@docker-compose restart
	@echo "$(GREEN)Services restarted!$(NC)"

# View logs
logs: ## View logs from all services
	@docker-compose logs -f

# View logs for specific service
logs-ws: ## View WebSocket service logs
	@docker-compose logs -f websocket-service

logs-redis: ## View Redis logs
	@docker-compose logs -f redis

logs-kafka: ## View Kafka logs
	@docker-compose logs -f kafka

# Health checks
health: ## Check health of all services
	@echo "$(BLUE)Checking service health...$(NC)"
	@echo "$(YELLOW)WebSocket Service:$(NC)"
	@curl -s http://localhost:3008/health | jq . || echo "$(RED)WebSocket service not healthy$(NC)"
	@echo ""
	@echo "$(YELLOW)Redis:$(NC)"
	@docker-compose exec -T redis redis-cli ping || echo "$(RED)Redis not healthy$(NC)"
	@echo ""
	@echo "$(YELLOW)Kafka:$(NC)"
	@docker-compose exec -T kafka kafka-broker-api-versions --bootstrap-server localhost:9092 >/dev/null 2>&1 && echo "$(GREEN)Kafka is healthy$(NC)" || echo "$(RED)Kafka not healthy$(NC)"

# Service status
status: ## Show service status
	@docker-compose ps

# Show service stats
stats: ## Show service resource usage
	@docker-compose stats --no-stream

# Clean up
clean: ## Remove stopped containers and unused networks
	@echo "$(BLUE)Cleaning up...$(NC)"
	@docker-compose down --remove-orphans
	@docker system prune -f
	@echo "$(GREEN)Cleanup complete!$(NC)"

# Clean all (including volumes)
clean-all: ## Remove everything including volumes (DATA LOSS!)
	@echo "$(RED)WARNING: This will remove all data!$(NC)"
	@read -p "Are you sure? (y/N) " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		echo ""; \
		echo "$(BLUE)Removing all data...$(NC)"; \
		docker-compose down -v --remove-orphans; \
		docker system prune -f; \
		echo "$(GREEN)All data removed!$(NC)"; \
	else \
		echo ""; \
		echo "$(YELLOW)Operation cancelled.$(NC)"; \
	fi

# Update services
update: ## Pull latest images and restart services
	@echo "$(BLUE)Updating services...$(NC)"
	@docker-compose pull
	@docker-compose up -d
	@echo "$(GREEN)Services updated!$(NC)"

# Test connection
test: ## Test WebSocket connection
	@echo "$(BLUE)Testing WebSocket connection...$(NC)"
	@node -e "const WebSocket = require('ws'); const ws = new WebSocket('ws://localhost:3008/ws'); ws.on('open', () => { console.log('$(GREEN)✓ WebSocket connection successful$(NC)'); ws.close(); process.exit(0); }); ws.on('error', (err) => { console.log('$(RED)✗ WebSocket connection failed:$(NC)', err.message); process.exit(1); }); setTimeout(() => { console.log('$(RED)✗ WebSocket connection timeout$(NC)'); process.exit(1); }, 5000);" || echo "$(RED)Test failed! Make sure 'ws' package is installed: npm install ws$(NC)"

# Development mode
dev: ## Start in development mode with hot reload
	@echo "$(BLUE)Starting in development mode...$(NC)"
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
	@echo "$(GREEN)Development mode started!$(NC)"

# Production mode
prod: check-env ## Start in production mode
	@echo "$(BLUE)Starting in production mode...$(NC)"
	@docker-compose up -d
	@echo "$(GREEN)Production mode started!$(NC)"

# Backup volumes
backup: ## Backup persistent volumes
	@echo "$(BLUE)Creating backup...$(NC)"
	@mkdir -p backups
	@docker run --rm -v moonx-websocket-redis-data:/data -v $(PWD)/backups:/backup alpine tar czf /backup/redis-backup-$(shell date +%Y%m%d-%H%M%S).tar.gz -C /data .
	@docker run --rm -v moonx-websocket-kafka-data:/data -v $(PWD)/backups:/backup alpine tar czf /backup/kafka-backup-$(shell date +%Y%m%d-%H%M%S).tar.gz -C /data .
	@echo "$(GREEN)Backup created in ./backups/$(NC)"

# Show environment
env: ## Show current environment variables
	@echo "$(BLUE)Environment Variables:$(NC)"
	@docker-compose config | grep -A 50 "environment:"

# Show topics
topics: ## Show Kafka topics
	@echo "$(BLUE)Kafka Topics:$(NC)"
	@docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092

# Reset topics
reset-topics: ## Reset Kafka topics (removes all messages)
	@echo "$(RED)WARNING: This will remove all messages!$(NC)"
	@read -p "Are you sure? (y/N) " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		echo ""; \
		echo "$(BLUE)Resetting Kafka topics...$(NC)"; \
		docker-compose exec kafka kafka-topics --delete --topic moonx.ws.events --bootstrap-server localhost:9092; \
		docker-compose exec kafka kafka-topics --delete --topic moonx.ws.events.dlq --bootstrap-server localhost:9092; \
		docker-compose restart kafka-setup; \
		echo "$(GREEN)Topics reset!$(NC)"; \
	else \
		echo ""; \
		echo "$(YELLOW)Operation cancelled.$(NC)"; \
	fi

# Show this help when no target is specified
.PHONY: help
help: ## Show this help message
	@echo "$(BLUE)MoonXFarm WebSocket Service - Docker Compose Commands$(NC)"
	@echo ""
	@echo "$(YELLOW)Usage:$(NC)"
	@echo "  make [target]"
	@echo ""
	@echo "$(YELLOW)Available targets:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-12s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST) 
#!/bin/bash

# =================================================================
# MoonX Farm Notification Hub - Database Deployment Script
# =================================================================
# Production-ready database setup for comprehensive notification system
# =================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$SCRIPT_DIR/../database"
MIGRATIONS_DIR="$DB_DIR/migrations"
SEEDS_DIR="$DB_DIR/seeds"

# Database configuration from environment or defaults
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-moonx_notifications}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-password}
DB_SSL_MODE=${DB_SSL_MODE:-prefer}

# Deployment options
ENVIRONMENT=${ENVIRONMENT:-development}
SKIP_SEEDS=${SKIP_SEEDS:-false}
FORCE_RECREATE=${FORCE_RECREATE:-false}
BACKUP_EXISTING=${BACKUP_EXISTING:-true}

# =================================================================
# UTILITY FUNCTIONS
# =================================================================

print_header() {
    echo -e "${BLUE}=================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=================================================================${NC}"
}

print_success() {
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

# Check if required tools are installed
check_dependencies() {
    print_info "Checking dependencies..."
    
    if ! command -v psql &> /dev/null; then
        print_error "PostgreSQL client (psql) is not installed"
        exit 1
    fi
    
    if ! command -v pg_dump &> /dev/null; then
        print_error "PostgreSQL pg_dump is not installed"
        exit 1
    fi
    
    print_success "All dependencies are available"
}

# Test database connection
test_connection() {
    print_info "Testing database connection..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c '\q' &> /dev/null; then
        print_error "Cannot connect to PostgreSQL server"
        print_error "Please check your database configuration:"
        print_error "  Host: $DB_HOST"
        print_error "  Port: $DB_PORT"
        print_error "  User: $DB_USER"
        exit 1
    fi
    
    print_success "Database connection established"
}

# Create database if it doesn't exist
create_database() {
    print_info "Creating database '$DB_NAME' if it doesn't exist..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check if database exists
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
        if [ "$FORCE_RECREATE" = "true" ]; then
            print_warning "Database exists and FORCE_RECREATE is true. Backing up and recreating..."
            backup_database
            drop_database
        else
            print_info "Database '$DB_NAME' already exists"
            return 0
        fi
    fi
    
    # Create database
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;"
    print_success "Database '$DB_NAME' created"
}

# Backup existing database
backup_database() {
    if [ "$BACKUP_EXISTING" = "true" ]; then
        print_info "Creating backup of existing database..."
        
        BACKUP_FILE="$DB_DIR/backups/backup_$(date +%Y%m%d_%H%M%S).sql"
        mkdir -p "$DB_DIR/backups"
        
        export PGPASSWORD="$DB_PASSWORD"
        
        if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"; then
            print_success "Backup created: $BACKUP_FILE"
        else
            print_error "Failed to create backup"
            exit 1
        fi
    fi
}

# Drop database (used with FORCE_RECREATE)
drop_database() {
    print_warning "Dropping database '$DB_NAME'..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Terminate all connections to the database
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '$DB_NAME'
        AND pid <> pg_backend_pid();
    " &> /dev/null
    
    # Drop database
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
    print_success "Database '$DB_NAME' dropped"
}

# Run database migrations
run_migrations() {
    print_info "Running database migrations..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check if migrations directory exists
    if [ ! -d "$MIGRATIONS_DIR" ]; then
        print_error "Migrations directory not found: $MIGRATIONS_DIR"
        exit 1
    fi
    
    # Run each migration file
    for migration_file in "$MIGRATIONS_DIR"/*.sql; do
        if [ -f "$migration_file" ]; then
            migration_name=$(basename "$migration_file")
            print_info "Running migration: $migration_name"
            
            if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file"; then
                print_success "Migration completed: $migration_name"
            else
                print_error "Migration failed: $migration_name"
                exit 1
            fi
        fi
    done
    
    print_success "All migrations completed"
}

# Run the main schema
run_schema() {
    print_info "Running main database schema..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    SCHEMA_FILE="$DB_DIR/schema.sql"
    
    if [ ! -f "$SCHEMA_FILE" ]; then
        print_error "Schema file not found: $SCHEMA_FILE"
        exit 1
    fi
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCHEMA_FILE"; then
        print_success "Schema applied successfully"
    else
        print_error "Schema application failed"
        exit 1
    fi
}

# Seed database with sample data
seed_database() {
    if [ "$SKIP_SEEDS" = "true" ]; then
        print_info "Skipping database seeding (SKIP_SEEDS=true)"
        return 0
    fi
    
    if [ "$ENVIRONMENT" = "production" ]; then
        print_warning "Skipping database seeding in production environment"
        return 0
    fi
    
    print_info "Seeding database with sample data..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check if seeds directory exists
    if [ ! -d "$SEEDS_DIR" ]; then
        print_error "Seeds directory not found: $SEEDS_DIR"
        exit 1
    fi
    
    # Run each seed file
    for seed_file in "$SEEDS_DIR"/*.sql; do
        if [ -f "$seed_file" ]; then
            seed_name=$(basename "$seed_file")
            print_info "Running seed: $seed_name"
            
            if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$seed_file"; then
                print_success "Seed completed: $seed_name"
            else
                print_error "Seed failed: $seed_name"
                exit 1
            fi
        fi
    done
    
    print_success "Database seeding completed"
}

# Verify database setup
verify_setup() {
    print_info "Verifying database setup..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check if main tables exist
    TABLES=(
        "notifications"
        "user_preferences"
        "price_alerts"
        "volume_alerts"
        "tracked_wallets"
        "whale_alerts"
        "liquidity_alerts"
        "portfolio_alerts"
        "position_health_alerts"
        "security_alerts"
        "notification_templates"
        "notification_delivery_log"
        "notification_analytics"
    )
    
    for table in "${TABLES[@]}"; do
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT 1 FROM information_schema.tables WHERE table_name='$table'" | grep -q 1; then
            print_success "Table exists: $table"
        else
            print_error "Table missing: $table"
            exit 1
        fi
    done
    
    # Check if extensions are installed
    EXTENSIONS=("uuid-ossp" "pg_trgm" "btree_gin")
    
    for extension in "${EXTENSIONS[@]}"; do
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT 1 FROM pg_extension WHERE extname='$extension'" | grep -q 1; then
            print_success "Extension installed: $extension"
        else
            print_error "Extension missing: $extension"
            exit 1
        fi
    done
    
    # Check record counts (if seeded)
    if [ "$SKIP_SEEDS" != "true" ] && [ "$ENVIRONMENT" != "production" ]; then
        NOTIFICATION_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM notifications")
        print_info "Sample notifications: $NOTIFICATION_COUNT"
        
        TEMPLATE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM notification_templates")
        print_info "Notification templates: $TEMPLATE_COUNT"
    fi
    
    print_success "Database setup verification completed"
}

# Display deployment summary
display_summary() {
    print_header "DEPLOYMENT SUMMARY"
    
    echo -e "${GREEN}Database Setup Completed Successfully!${NC}"
    echo ""
    echo "Database Details:"
    echo "  📍 Host: $DB_HOST:$DB_PORT"
    echo "  🗄️  Database: $DB_NAME"
    echo "  👤 User: $DB_USER"
    echo "  🌍 Environment: $ENVIRONMENT"
    echo ""
    
    if [ "$SKIP_SEEDS" != "true" ] && [ "$ENVIRONMENT" != "production" ]; then
        echo "🌱 Sample data has been seeded for development/testing"
    fi
    
    echo ""
    echo "Next Steps:"
    echo "  1. Update your notification-hub service configuration"
    echo "  2. Start the notification-hub service"
    echo "  3. Test the notification system"
    echo ""
    echo "Connection String:"
    echo "  postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
    echo ""
}

# Main deployment function
main() {
    print_header "MOONX FARM NOTIFICATION HUB - DATABASE DEPLOYMENT"
    
    echo "Configuration:"
    echo "  🗄️  Database: $DB_NAME"
    echo "  🌍 Environment: $ENVIRONMENT"
    echo "  🌱 Skip Seeds: $SKIP_SEEDS"
    echo "  🔄 Force Recreate: $FORCE_RECREATE"
    echo "  💾 Backup Existing: $BACKUP_EXISTING"
    echo ""
    
    # Confirmation prompt for production
    if [ "$ENVIRONMENT" = "production" ]; then
        read -p "⚠️  Are you sure you want to deploy to PRODUCTION? (yes/no): " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            print_info "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Run deployment steps
    check_dependencies
    test_connection
    create_database
    run_schema
    seed_database
    verify_setup
    display_summary
    
    print_success "🎉 Deployment completed successfully!"
}

# =================================================================
# SCRIPT EXECUTION
# =================================================================

# Help function
show_help() {
    cat << EOF
MoonX Farm Notification Hub - Database Deployment Script

Usage: $0 [OPTIONS]

Options:
  -h, --help              Show this help message
  -e, --environment ENV   Set environment (development|staging|production)
  -s, --skip-seeds        Skip database seeding
  -f, --force-recreate    Force recreation of existing database
  -b, --no-backup         Skip backup of existing database
  
Environment Variables:
  DB_HOST                 Database host (default: localhost)
  DB_PORT                 Database port (default: 5432)
  DB_NAME                 Database name (default: moonx_notifications)
  DB_USER                 Database user (default: postgres)
  DB_PASSWORD             Database password (default: password)
  DB_SSL_MODE             SSL mode (default: prefer)

Examples:
  # Development deployment with sample data
  $0 --environment development
  
  # Production deployment without seeds
  $0 --environment production --skip-seeds
  
  # Force recreate with backup
  $0 --force-recreate --environment development
  
  # Production deployment with custom database
  DB_NAME=moonx_prod DB_USER=moonx_user $0 --environment production --skip-seeds

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--skip-seeds)
            SKIP_SEEDS="true"
            shift
            ;;
        -f|--force-recreate)
            FORCE_RECREATE="true"
            shift
            ;;
        -b|--no-backup)
            BACKUP_EXISTING="false"
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    print_error "Must be one of: development, staging, production"
    exit 1
fi

# Run main deployment
main 
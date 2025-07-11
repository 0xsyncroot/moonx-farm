#!/bin/bash

# =============================================================================
# MoonXFarm WebSocket Service - Nginx Setup Script
# =============================================================================
# Script to setup nginx configuration for WebSocket service
# Usage: ./setup-nginx.sh [option]
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="ws.moonx.farm"
NGINX_CONFIG_DIR="/etc/nginx/sites-available"
NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
SSL_DIR="/etc/nginx/ssl"
SERVICE_PORT="3008"

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root"
        echo "Please run: sudo $0"
        exit 1
    fi
}

# Install nginx if not present
install_nginx() {
    print_step "Checking nginx installation..."
    
    if ! command -v nginx &> /dev/null; then
        print_info "Installing nginx..."
        apt-get update
        apt-get install -y nginx
        systemctl enable nginx
        print_info "Nginx installed successfully"
    else
        print_info "Nginx is already installed"
    fi
}

# Create SSL directory
create_ssl_dir() {
    print_step "Creating SSL directory..."
    mkdir -p "$SSL_DIR"
    chmod 700 "$SSL_DIR"
    print_info "SSL directory created: $SSL_DIR"
}

# Generate self-signed certificate
generate_self_signed_cert() {
    print_step "Generating self-signed SSL certificate..."
    
    if [ -f "$SSL_DIR/$DOMAIN.crt" ]; then
        print_warning "SSL certificate already exists"
        return 0
    fi
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/$DOMAIN.key" \
        -out "$SSL_DIR/$DOMAIN.crt" \
        -subj "/C=US/ST=State/L=City/O=MoonXFarm/CN=$DOMAIN"
    
    chmod 600 "$SSL_DIR/$DOMAIN.key"
    chmod 644 "$SSL_DIR/$DOMAIN.crt"
    
    print_info "Self-signed certificate generated"
}

# Setup Let's Encrypt certificate
setup_letsencrypt() {
    print_step "Setting up Let's Encrypt certificate..."
    
    # Install certbot
    if ! command -v certbot &> /dev/null; then
        print_info "Installing certbot..."
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    fi
    
    # Generate certificate
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@moonx.farm
    
    # Setup auto-renewal
    crontab -l | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | crontab -
    
    print_info "Let's Encrypt certificate setup complete"
}

# Install nginx configuration
install_nginx_config() {
    local config_type=$1
    print_step "Installing nginx configuration ($config_type)..."
    
    local config_file=""
    case $config_type in
        "simple")
            config_file="nginx-simple.conf"
            ;;
        "full")
            config_file="nginx.conf"
            ;;
        *)
            print_error "Invalid configuration type: $config_type"
            exit 1
            ;;
    esac
    
    if [ ! -f "$config_file" ]; then
        print_error "Configuration file not found: $config_file"
        exit 1
    fi
    
    # Copy configuration
    cp "$config_file" "$NGINX_CONFIG_DIR/websocket-service"
    
    # Create symlink to enable site
    ln -sf "$NGINX_CONFIG_DIR/websocket-service" "$NGINX_ENABLED_DIR/websocket-service"
    
    # Remove default nginx site
    rm -f "$NGINX_ENABLED_DIR/default"
    
    print_info "Nginx configuration installed"
}

# Test nginx configuration
test_nginx_config() {
    print_step "Testing nginx configuration..."
    
    if nginx -t; then
        print_info "Nginx configuration test passed"
    else
        print_error "Nginx configuration test failed"
        exit 1
    fi
}

# Reload nginx
reload_nginx() {
    print_step "Reloading nginx..."
    
    systemctl reload nginx
    print_info "Nginx reloaded successfully"
}

# Check WebSocket service
check_websocket_service() {
    print_step "Checking WebSocket service..."
    
    if nc -z localhost "$SERVICE_PORT"; then
        print_info "WebSocket service is running on port $SERVICE_PORT"
    else
        print_warning "WebSocket service is not running on port $SERVICE_PORT"
        print_info "Please start your WebSocket service first"
    fi
}

# Show usage
show_usage() {
    echo -e "${BLUE}MoonXFarm WebSocket Service - Nginx Setup${NC}"
    echo ""
    echo "Usage: $0 [option]"
    echo ""
    echo "Options:"
    echo "  simple      - Install simple nginx configuration"
    echo "  full        - Install full nginx configuration with security"
    echo "  ssl-self    - Generate self-signed SSL certificate"
    echo "  ssl-lets    - Setup Let's Encrypt SSL certificate"
    echo "  test        - Test nginx configuration"
    echo "  reload      - Reload nginx configuration"
    echo "  status      - Check service status"
    echo "  install     - Full installation (nginx + simple config + self-signed SSL)"
    echo ""
    echo "Examples:"
    echo "  $0 install           # Complete setup"
    echo "  $0 simple            # Install simple config"
    echo "  $0 ssl-lets          # Setup Let's Encrypt"
    echo "  $0 test              # Test configuration"
}

# Main function
main() {
    case "${1:-}" in
        "simple")
            check_root
            install_nginx
            create_ssl_dir
            generate_self_signed_cert
            install_nginx_config "simple"
            test_nginx_config
            reload_nginx
            check_websocket_service
            ;;
        "full")
            check_root
            install_nginx
            create_ssl_dir
            generate_self_signed_cert
            install_nginx_config "full"
            test_nginx_config
            reload_nginx
            check_websocket_service
            ;;
        "ssl-self")
            check_root
            create_ssl_dir
            generate_self_signed_cert
            ;;
        "ssl-lets")
            check_root
            setup_letsencrypt
            ;;
        "test")
            test_nginx_config
            ;;
        "reload")
            check_root
            reload_nginx
            ;;
        "status")
            check_websocket_service
            systemctl status nginx
            ;;
        "install")
            check_root
            install_nginx
            create_ssl_dir
            generate_self_signed_cert
            install_nginx_config "simple"
            test_nginx_config
            reload_nginx
            check_websocket_service
            print_info "Setup complete! WebSocket available at: wss://$DOMAIN/ws"
            ;;
        *)
            show_usage
            ;;
    esac
}

# Run main function
main "$@" 
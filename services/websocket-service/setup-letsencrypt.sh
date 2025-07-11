#!/bin/bash

echo "🔒 Setting up Let's Encrypt for ws.moonx.farm"
echo "============================================="

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    apt update
    apt install -y certbot python3-certbot-nginx
fi

# Stop nginx temporarily
echo "⏸️  Stopping nginx temporarily..."
systemctl stop nginx

# Get certificate for ws.moonx.farm
echo "📜 Requesting certificate for ws.moonx.farm..."
certbot certonly --standalone \
    -d ws.moonx.farm \
    --non-interactive \
    --agree-tos \
    --email admin@moonx.farm \
    --rsa-key-size 4096

# Check if certificate was generated
if [ -f "/etc/letsencrypt/live/ws.moonx.farm/fullchain.pem" ]; then
    echo "✅ Certificate generated successfully!"
    
    # Create symlinks for nginx
    echo "🔗 Creating certificate symlinks for nginx..."
    mkdir -p /etc/nginx/certs
    ln -sf /etc/letsencrypt/live/ws.moonx.farm/fullchain.pem /etc/nginx/certs/ws.moonx.farm.crt
    ln -sf /etc/letsencrypt/live/ws.moonx.farm/privkey.pem /etc/nginx/certs/ws.moonx.farm.key
    
    echo "📁 Certificate files linked:"
    echo "   Certificate: /etc/nginx/certs/ws.moonx.farm.crt → /etc/letsencrypt/live/ws.moonx.farm/fullchain.pem"
    echo "   Private Key: /etc/nginx/certs/ws.moonx.farm.key → /etc/letsencrypt/live/ws.moonx.farm/privkey.pem"
    
    # Test nginx configuration
    echo "🧪 Testing nginx configuration..."
    if nginx -t; then
        echo "✅ Nginx configuration is valid"
        
        # Start nginx
        echo "🚀 Starting nginx..."
        systemctl start nginx
        systemctl enable nginx
        
        # Test SSL
        echo "🔍 Testing SSL connection..."
        sleep 5
        curl -I https://ws.moonx.farm/health 2>/dev/null | head -1
        
        echo ""
        echo "🎉 SSL setup completed successfully!"
        echo "   WebSocket URL: wss://ws.moonx.farm/"
        echo "   Health Check: https://ws.moonx.farm/health"
        
    else
        echo "❌ Nginx configuration error"
        echo "Please check nginx config and try again"
    fi
    
    # Setup auto-renewal
    echo "⏰ Setting up auto-renewal..."
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --nginx") | crontab -
    echo "✅ Auto-renewal configured (daily at 12:00)"
    
else
    echo "❌ Certificate generation failed"
    echo "Please check domain DNS settings and try again"
    
    # Start nginx anyway
    systemctl start nginx
fi

echo ""
echo "📋 Manual certificate renewal command:"
echo "   certbot renew --nginx"
echo ""
echo "🔧 If you encounter issues:"
echo "1. Check DNS: dig ws.moonx.farm"
echo "2. Check firewall: ufw status"
echo "3. Check logs: tail -f /var/log/letsencrypt/letsencrypt.log" 
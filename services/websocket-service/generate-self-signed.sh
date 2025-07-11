#!/bin/bash

echo "🔑 Generating Self-Signed Certificate for ws.moonx.farm"
echo "======================================================"

# Create certs directory if not exists
mkdir -p /etc/nginx/certs

echo "📝 Creating self-signed certificate..."

# Generate self-signed certificate with SAN for ws.moonx.farm
openssl req -x509 -newkey rsa:4096 \
    -keyout /etc/nginx/certs/ws.moonx.farm.key \
    -out /etc/nginx/certs/ws.moonx.farm.crt \
    -days 365 -nodes \
    -subj "/C=US/ST=CA/L=SF/O=MoonX/CN=ws.moonx.farm" \
    -extensions SAN \
    -config <(cat /etc/ssl/openssl.cnf <(printf "[SAN]\nsubjectAltName=DNS:ws.moonx.farm,DNS:*.moonx.farm,DNS:moonx.farm"))

echo "✅ Self-signed certificate generated!"
echo ""
echo "📁 Files created:"
echo "   Certificate: /etc/nginx/certs/ws.moonx.farm.crt"
echo "   Private Key: /etc/nginx/certs/ws.moonx.farm.key"
echo ""

# Set proper permissions
chmod 644 /etc/nginx/certs/ws.moonx.farm.crt
chmod 600 /etc/nginx/certs/ws.moonx.farm.key

echo "🔧 Next steps:"
echo "1. Update nginx config to use new certificate files"
echo "2. Restart nginx: systemctl restart nginx"
echo "3. Test connection: curl -k https://ws.moonx.farm/health"
echo ""
echo "⚠️  Note: Self-signed certificates will show browser warnings"
echo "   For production, use Let's Encrypt or commercial certificate" 
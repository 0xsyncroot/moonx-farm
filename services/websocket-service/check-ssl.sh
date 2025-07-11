#!/bin/bash

echo "🔍 SSL Certificate Debug for ws.moonx.farm"
echo "=========================================="

# Check certificate files exist
echo "📁 Checking certificate files..."
if [ -f "/etc/nginx/certs/moonx.farm.pem" ]; then
    echo "✅ Certificate file exists: /etc/nginx/certs/moonx.farm.pem"
else
    echo "❌ Certificate file missing: /etc/nginx/certs/moonx.farm.pem"
fi

if [ -f "/etc/nginx/certs/moonx.farm.key" ]; then
    echo "✅ Key file exists: /etc/nginx/certs/moonx.farm.key"
else
    echo "❌ Key file missing: /etc/nginx/certs/moonx.farm.key"
fi

echo ""
echo "🔒 Certificate Details:"
echo "----------------------"

# Check certificate details
if [ -f "/etc/nginx/certs/moonx.farm.pem" ]; then
    echo "📋 Certificate Subject and SAN:"
    openssl x509 -in /etc/nginx/certs/moonx.farm.pem -text -noout | grep -E "(Subject:|DNS:|CN=)"
    
    echo ""
    echo "📅 Certificate Validity:"
    openssl x509 -in /etc/nginx/certs/moonx.farm.pem -dates -noout
    
    echo ""
    echo "🔗 Certificate Chain:"
    openssl crl2pkcs7 -nocrl -certfile /etc/nginx/certs/moonx.farm.pem | openssl pkcs7 -print_certs -text -noout | grep -E "(Subject:|Issuer:)" | head -10
fi

echo ""
echo "🌐 Testing SSL Connection:"
echo "-------------------------"

# Test SSL connection
echo "Testing ws.moonx.farm:443..."
timeout 10 openssl s_client -connect ws.moonx.farm:443 -servername ws.moonx.farm -showcerts </dev/null 2>/dev/null | grep -E "(subject=|issuer=|verify error:|verify return:)"

echo ""
echo "🔧 Recommendations:"
echo "==================="

echo "1. For ws.moonx.farm subdomain, you need:"
echo "   - Certificate that includes ws.moonx.farm in SAN"
echo "   - Or wildcard certificate *.moonx.farm"
echo ""
echo "2. To fix certificate chain:"
echo "   - Combine certificate + intermediate certificates"
echo "   - Order: Your cert + Intermediate + Root"
echo ""
echo "3. Generate new certificate:"
echo "   - Use certbot: certbot certonly --nginx -d ws.moonx.farm"
echo "   - Or create wildcard: certbot certonly --manual -d *.moonx.farm"
echo ""
echo "4. Quick test with self-signed (development only):"
echo "   openssl req -x509 -newkey rsa:4096 -keyout /tmp/ws.key -out /tmp/ws.crt -days 365 -nodes -subj '/CN=ws.moonx.farm'" 
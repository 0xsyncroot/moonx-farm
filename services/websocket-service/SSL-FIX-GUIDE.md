# SSL Certificate Fix Guide for ws.moonx.farm

## 🚨 **Current Issue**
```
Lỗi: "Chuỗi chứng chỉ không hoàn thiện"
Domain: ws.moonx.farm
Nguyên nhân: Certificate không match domain hoặc certificate chain không đầy đủ
```

## 🔍 **Step 1: Debug Current Certificate**

```bash
# Check current certificate status
chmod +x check-ssl.sh
./check-ssl.sh
```

## ⚡ **Step 2: Quick Fix (Self-Signed for Testing)**

```bash
# Generate self-signed certificate for immediate testing
chmod +x generate-self-signed.sh
./generate-self-signed.sh

# Restart nginx
systemctl restart nginx

# Test connection (ignore browser warning)
curl -k https://ws.moonx.farm/health
```

**Result**: WebSocket will work but browser shows security warning.

## 🔒 **Step 3: Production Fix (Let's Encrypt)**

### Prerequisites:
- Domain `ws.moonx.farm` points to your server IP
- Port 80 and 443 open in firewall
- Nginx stopped during certificate generation

```bash
# Generate production certificate
chmod +x setup-letsencrypt.sh
./setup-letsencrypt.sh
```

### If Let's Encrypt fails:
```bash
# Check DNS resolution
dig ws.moonx.farm

# Check firewall
ufw status

# Manual certificate request
certbot certonly --manual -d ws.moonx.farm
```

## 🔧 **Step 4: Alternative Solutions**

### Option A: Wildcard Certificate
```bash
# Request wildcard certificate for *.moonx.farm
certbot certonly --manual -d "*.moonx.farm" -d "moonx.farm" --preferred-challenges=dns
```

### Option B: Use Existing moonx.farm Certificate
If you have a valid certificate for `moonx.farm`, modify nginx to use it:

```nginx
# In moonx-ws.conf
ssl_certificate      /etc/nginx/certs/moonx.farm.pem;
ssl_certificate_key  /etc/nginx/certs/moonx.farm.key;

# Add this in server block
server_name ws.moonx.farm moonx.farm;
```

### Option C: Certificate with Complete Chain
If you have commercial certificate, combine files:
```bash
# Combine certificate + intermediate + root
cat your-cert.crt intermediate.crt root.crt > ws.moonx.farm.crt
```

## 🧪 **Step 5: Test & Verify**

```bash
# Test nginx config
nginx -t

# Test SSL connection
openssl s_client -connect ws.moonx.farm:443 -servername ws.moonx.farm

# Test WebSocket
curl -I https://ws.moonx.farm/health

# Check certificate details
openssl x509 -in /etc/nginx/certs/ws.moonx.farm.crt -text -noout | grep -A 5 "Subject Alternative Name"
```

## 📋 **Troubleshooting**

### Common Issues:

| Error | Solution |
|-------|----------|
| `Certificate not found` | Run `generate-self-signed.sh` or `setup-letsencrypt.sh` |
| `DNS not found` | Update DNS A record for `ws.moonx.farm` |
| `Connection refused` | Check firewall: `ufw allow 443/tcp` |
| `Certificate expired` | Run `certbot renew` |
| `Domain mismatch` | Ensure certificate includes `ws.moonx.farm` in SAN |

### Debug Commands:
```bash
# Check certificate expiry
openssl x509 -in /etc/nginx/certs/ws.moonx.farm.crt -dates -noout

# Check certificate chain
openssl verify -CAfile /etc/ssl/certs/ca-certificates.crt /etc/nginx/certs/ws.moonx.farm.crt

# Test SSL grades
curl -s "https://api.ssllabs.com/api/v3/analyze?host=ws.moonx.farm" | jq .

# Check nginx error logs
tail -f /var/log/nginx/error.log
```

## 🎯 **Expected Results**

After successful SSL setup:

✅ **Browser Access**: https://ws.moonx.farm/health (no warnings)
✅ **WebSocket**: wss://ws.moonx.farm/ (connects successfully)  
✅ **Certificate**: Valid chain, includes ws.moonx.farm in SAN
✅ **Auto-renewal**: Configured for Let's Encrypt

## 🚀 **Quick Commands Summary**

```bash
# For immediate testing (self-signed)
./generate-self-signed.sh && systemctl restart nginx

# For production (Let's Encrypt) 
./setup-letsencrypt.sh

# Debug issues
./check-ssl.sh

# Test connection
curl -I https://ws.moonx.farm/health
```

---

**Note**: Choose self-signed for development/testing, Let's Encrypt for production. 
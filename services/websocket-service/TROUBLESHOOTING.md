# WebSocket Service Troubleshooting Guide

## 🚨 Common Issues & Solutions

### Issue 1: Connection to Wrong Path (FIXED)

**Symptoms:**
```
WebSocket connection to 'wss://ws.moonx.farm/' failed
// Client connecting to root instead of /ws
```

**Root Cause:**
- Client was connecting to `wss://ws.moonx.farm/` instead of `wss://ws.moonx.farm/ws`
- WebSocket Manager only converted protocol (HTTP→WS) but didn't ensure `/ws` path

**Solution Applied:**
✅ **Fixed in WebSocket Manager**: Automatically adds `/ws` path if not present
✅ **Fixed in Nginx Config**: Handles WebSocket connections at both `/` and `/ws` paths

**URL Processing (Automatic):**
- `http://localhost:3008` → `ws://localhost:3008/ws`
- `https://ws.moonx.farm` → `wss://ws.moonx.farm/ws`
- `ws://localhost:3008/ws` → `ws://localhost:3008/ws` (no change)

**Test Your Fix:**
```bash
# Test connection fix
node test-connection-fix.js

# Test URL processing
node -e "console.log('URL processing test completed')"
```

### Issue 2: Connection Established but Authentication Timeout

**Symptoms:**
```
WebSocket connection established, waiting for authentication
// No further messages
```

**Possible Causes:**
1. **Auth service not running** - Server can't verify tokens
2. **Client not sending auth message** - No response to auth.required
3. **Auth service timeout** - Takes too long to verify token
4. **Invalid token format** - Client sends malformed token

**Solutions:**

#### 1. Check Auth Service
```bash
# Check if auth service is running
curl http://localhost:3001/health

# Check auth verify endpoint
curl -H "Authorization: Bearer test-token" http://localhost:3001/api/v1/auth/verify
```

#### 2. Test WebSocket Connection
```bash
# Run test client
node test-client.js

# Run full debug
node debug-connection.js
```

#### 3. Check WebSocket Logs
```bash
# Docker logs
docker logs moonx-websocket-service --tail=50

# PM2 logs
pm2 logs websocket-service

# Journal logs
journalctl -u websocket-service --lines=50
```

#### 4. Verify Environment Variables
```bash
# Check auth service URL
echo $AUTH_SERVICE_URL

# Check port
echo $PORT

# Check CORS
echo $CORS_ORIGIN
```

### Issue 2: Nginx Connection Issues

**Symptoms:**
```
WebSocket connection failed
Error: getaddrinfo ENOTFOUND ws.moonx.farm
```

**Possible Causes:**
1. **DNS not configured** - Domain not resolving
2. **SSL certificates missing** - HTTPS connection failing
3. **Nginx not running** - Reverse proxy down
4. **Firewall blocking** - Ports blocked

**Solutions:**

#### 1. Test Direct Connection (Bypass Nginx)
```bash
# Test direct WebSocket service
node test-client.js # (modify URL to ws://localhost:3008/ws)

# Test health endpoint
curl http://localhost:3008/health
```

#### 2. Test Nginx Configuration
```bash
# Test nginx config
nginx -t

# Check nginx status
systemctl status nginx

# Check nginx logs
tail -f /var/log/nginx/error.log
```

#### 3. Use Debug Nginx Config
```bash
# Copy debug config
cp nginx-debug.conf /etc/nginx/sites-available/websocket-debug

# Enable debug config
ln -s /etc/nginx/sites-available/websocket-debug /etc/nginx/sites-enabled/

# Test simple connection
curl http://localhost:8080/test

# Test WebSocket via debug proxy
# Use ws://localhost:8080/ws instead of wss://ws.moonx.farm/ws
```

### Issue 3: Authentication Fails

**Symptoms:**
```
Authentication failed: Invalid token
```

**Possible Causes:**
1. **Auth service configuration** - Wrong URL or endpoint
2. **Token format** - Invalid JWT format
3. **Token expired** - Token no longer valid
4. **Network issues** - Auth service unreachable

**Solutions:**

#### 1. Test Auth Service Directly
```bash
# Get a valid token (from your auth service)
TOKEN="your-valid-jwt-token"

# Test auth verify endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/v1/auth/verify

# Check response format
curl -v -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/v1/auth/verify
```

#### 2. Debug Auth Configuration
```bash
# Check auth service URL in WebSocket config
grep -r "AUTH_SERVICE_URL" .env

# Check auth service logs
docker logs moonx-auth-service --tail=50
```

#### 3. Test with Valid Token
```javascript
// Modify test-client.js with a real token
const client = new WebSocketTestClient('ws://localhost:3008/ws', 'your-real-token');
```

### Issue 4: Rate Limiting Issues

**Symptoms:**
```
Connection refused
429 Too Many Requests
```

**Possible Causes:**
1. **Nginx rate limiting** - Too many connections
2. **Service rate limiting** - Application-level limits
3. **IP blocking** - Firewall rules

**Solutions:**

#### 1. Check Nginx Rate Limiting
```bash
# Check nginx error logs for rate limiting
grep -i "limiting" /var/log/nginx/error.log

# Temporarily disable rate limiting (in nginx config)
# Comment out: limit_req zone=websocket_limit burst=100 nodelay;
```

#### 2. Check Service Rate Limiting
```bash
# Check if rate limiting is enabled
grep -r "RATE_LIMIT_ENABLED" .env

# Disable rate limiting
export RATE_LIMIT_ENABLED=false
```

### Issue 5: SSL/TLS Issues

**Symptoms:**
```
SSL handshake failed
Certificate verification failed
```

**Possible Causes:**
1. **SSL certificates missing** - No cert files
2. **SSL certificates expired** - Certs out of date
3. **Wrong domain** - Cert for wrong domain
4. **Mixed content** - HTTP/HTTPS mixing

**Solutions:**

#### 1. Check SSL Certificates
```bash
# Check if certificates exist
ls -la /etc/nginx/ssl/

# Check certificate details
openssl x509 -in /etc/nginx/ssl/ws.moonx.farm.crt -text -noout

# Check certificate expiry
openssl x509 -in /etc/nginx/ssl/ws.moonx.farm.crt -dates -noout
```

#### 2. Test Without SSL
```bash
# Use HTTP instead of HTTPS for testing
# ws://localhost:8080/ws (via nginx-debug.conf)
# ws://localhost:3008/ws (direct)
```

#### 3. Generate Self-Signed Certificates (for testing)
```bash
# Generate self-signed cert
openssl req -x509 -newkey rsa:4096 -keyout /tmp/ws.key -out /tmp/ws.crt -days 365 -nodes -subj "/CN=ws.moonx.farm"

# Copy to nginx ssl directory
cp /tmp/ws.crt /etc/nginx/ssl/ws.moonx.farm.crt
cp /tmp/ws.key /etc/nginx/ssl/ws.moonx.farm.key
```

## 🔧 Debug Tools

### 1. Test Client
```bash
# Basic connection test
node test-client.js

# Test with custom URL and token
node -e "
const TestClient = require('./test-client');
const client = new TestClient('ws://localhost:3008/ws', 'your-token');
client.runTests();
"
```

### 2. Debug Script
```bash
# Full system debug
node debug-connection.js

# Check specific service
node -e "
const Debugger = require('./debug-connection');
const debug = new Debugger();
debug.checkAuthService();
"
```

### 3. Manual Tests
```bash
# Test WebSocket service directly
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" http://localhost:3008/ws

# Test health endpoint
curl http://localhost:3008/health

# Test with netcat
echo -e "GET /ws HTTP/1.1\r\nHost: localhost:3008\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: test\r\nSec-WebSocket-Version: 13\r\n\r\n" | nc localhost 3008
```

## 📊 Monitoring & Logging

### Key Log Files
- **WebSocket Service**: `docker logs moonx-websocket-service`
- **Nginx**: `/var/log/nginx/ws.moonx.farm.error.log`
- **Auth Service**: `docker logs moonx-auth-service`
- **System**: `journalctl -u websocket-service`

### Debug Log Levels
```bash
# Enable debug logging
export LOG_LEVEL=debug

# Enable nginx debug
# Add to nginx.conf: error_log /var/log/nginx/error.log debug;
```

### Health Check URLs
- WebSocket Service: `http://localhost:3008/health`
- Auth Service: `http://localhost:3001/health`
- Nginx Proxy: `https://ws.moonx.farm/health`

## 🔍 Step-by-Step Diagnosis

### 1. Basic Connectivity
```bash
# Check if services are running
docker ps | grep moonx
pm2 status

# Check ports
netstat -tlnp | grep -E "(3008|3001|443|80)"

# Check DNS
nslookup ws.moonx.farm
```

### 2. Service Health
```bash
# Test each service individually
curl http://localhost:3008/health  # WebSocket
curl http://localhost:3001/health  # Auth
curl https://ws.moonx.farm/health  # Nginx proxy
```

### 3. WebSocket Connection
```bash
# Direct connection
node test-client.js

# Via nginx
node -e "
const TestClient = require('./test-client');
const client = new TestClient('wss://ws.moonx.farm/ws', 'your-token');
client.runTests();
"
```

### 4. Authentication Flow
```bash
# Check auth service
curl -H "Authorization: Bearer test-token" http://localhost:3001/api/v1/auth/verify

# Check WebSocket logs for auth messages
docker logs moonx-websocket-service 2>&1 | grep -i auth
```

## 🚀 Quick Fixes

### Restart Services
```bash
# Restart WebSocket service
docker restart moonx-websocket-service
# or
pm2 restart websocket-service

# Restart nginx
systemctl restart nginx

# Restart auth service
docker restart moonx-auth-service
```

### Reset Configuration
```bash
# Use minimal nginx config
cp nginx-debug.conf /etc/nginx/sites-enabled/websocket-debug

# Disable rate limiting
export RATE_LIMIT_ENABLED=false

# Enable debug logging
export LOG_LEVEL=debug
```

### Emergency Debug Mode
```bash
# Stop nginx (use direct connection)
systemctl stop nginx

# Test direct connection
node test-client.js  # Update URL to ws://localhost:3008/ws

# If direct connection works, issue is with nginx
# If direct connection fails, issue is with WebSocket service
```

## 📞 When to Seek Help

If you've tried all the above steps and still have issues:

1. **Gather Debug Information**:
   ```bash
   # Run full debug
   node debug-connection.js > debug-report.txt

   # Collect logs
   docker logs moonx-websocket-service > websocket-logs.txt
   cat /var/log/nginx/error.log > nginx-logs.txt
   ```

2. **Provide Context**:
   - Environment (development/production)
   - When the issue started
   - What changed recently
   - Error messages and logs

3. **Include Configuration**:
   - Environment variables
   - Nginx configuration
   - Docker compose setup 
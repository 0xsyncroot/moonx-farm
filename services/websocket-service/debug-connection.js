const axios = require('axios');
const { execSync } = require('child_process');

// Debug script for WebSocket connection issues
class WebSocketDebugger {
  constructor() {
    this.authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
    this.websocketPort = process.env.PORT || 3008;
    this.websocketHost = process.env.HOST || 'localhost';
  }

  async debugAll() {
    console.log('🔍 WebSocket Service Debug Report');
    console.log('=================================');
    
    await this.checkServiceStatus();
    await this.checkAuthService();
    await this.checkRedis();
    await this.checkKafka();
    await this.checkNetworkConnectivity();
    await this.checkEnvironmentVariables();
    await this.checkLogs();
    
    console.log('\n✅ Debug completed. Check the results above for issues.');
  }

  async checkServiceStatus() {
    console.log('\n🔍 Checking WebSocket Service Status...');
    
    try {
      // Check if service is running
      const response = await axios.get(`http://${this.websocketHost}:${this.websocketPort}/health`, {
        timeout: 5000
      });
      
      if (response.status === 200) {
        console.log('✅ WebSocket service is running');
        console.log('📊 Health check response:', response.data);
      } else {
        console.log('❌ WebSocket service returned non-200 status:', response.status);
      }
    } catch (error) {
      console.log('❌ WebSocket service is not accessible:', error.message);
      console.log('🔧 Possible issues:');
      console.log('   - Service not started');
      console.log('   - Wrong port or host');
      console.log('   - Firewall blocking connection');
    }
  }

  async checkAuthService() {
    console.log('\n🔍 Checking Auth Service...');
    
    try {
      const response = await axios.get(`${this.authServiceUrl}/health`, {
        timeout: 5000
      });
      
      if (response.status === 200) {
        console.log('✅ Auth service is running');
        console.log('📊 Auth service URL:', this.authServiceUrl);
      } else {
        console.log('❌ Auth service returned non-200 status:', response.status);
      }
    } catch (error) {
      console.log('❌ Auth service is not accessible:', error.message);
      console.log('🔧 Possible issues:');
      console.log('   - Auth service not started');
      console.log('   - Wrong AUTH_SERVICE_URL:', this.authServiceUrl);
      console.log('   - Network connectivity issues');
    }
    
    // Test auth verify endpoint
    try {
      const response = await axios.get(`${this.authServiceUrl}/api/v1/auth/verify`, {
        headers: {
          'Authorization': 'Bearer test-token'
        },
        timeout: 5000,
        validateStatus: () => true // Don't throw on 4xx/5xx
      });
      
      console.log('📊 Auth verify endpoint response:', response.status);
      if (response.status === 401) {
        console.log('✅ Auth verify endpoint is working (401 expected for invalid token)');
      } else {
        console.log('⚠️  Auth verify endpoint returned:', response.status);
      }
    } catch (error) {
      console.log('❌ Auth verify endpoint error:', error.message);
    }
  }

  async checkRedis() {
    console.log('\n🔍 Checking Redis Connection...');
    
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log('📊 Redis URL:', redisUrl);
    
    try {
      // Try to connect to Redis using redis-cli if available
      const result = execSync('redis-cli ping', { encoding: 'utf8', timeout: 5000 });
      if (result.trim() === 'PONG') {
        console.log('✅ Redis is accessible');
      } else {
        console.log('❌ Redis ping failed:', result);
      }
    } catch (error) {
      console.log('❌ Redis connection failed:', error.message);
      console.log('🔧 Possible issues:');
      console.log('   - Redis not installed or not running');
      console.log('   - Wrong Redis URL or credentials');
      console.log('   - Network connectivity issues');
    }
  }

  async checkKafka() {
    console.log('\n🔍 Checking Kafka Connection...');
    
    const kafkaBrokers = process.env.KAFKA_BROKERS || 'localhost:9092';
    console.log('📊 Kafka brokers:', kafkaBrokers);
    
    try {
      // Try to check if Kafka port is open
      const brokers = kafkaBrokers.split(',');
      for (const broker of brokers) {
        const [host, port] = broker.trim().split(':');
        try {
          execSync(`nc -z ${host} ${port}`, { timeout: 5000 });
          console.log(`✅ Kafka broker accessible: ${broker}`);
        } catch (error) {
          console.log(`❌ Kafka broker not accessible: ${broker}`);
        }
      }
    } catch (error) {
      console.log('❌ Kafka connectivity check failed:', error.message);
      console.log('🔧 Possible issues:');
      console.log('   - Kafka not started');
      console.log('   - Wrong broker addresses');
      console.log('   - Network connectivity issues');
    }
  }

  async checkNetworkConnectivity() {
    console.log('\n🔍 Checking Network Connectivity...');
    
    // Test port binding
    try {
      const result = execSync(`netstat -tlnp | grep :${this.websocketPort}`, { 
        encoding: 'utf8', 
        timeout: 5000 
      });
      
      if (result.trim()) {
        console.log('✅ WebSocket port is bound:', this.websocketPort);
        console.log('📊 Port info:', result.trim());
      } else {
        console.log('❌ WebSocket port is not bound:', this.websocketPort);
      }
    } catch (error) {
      console.log('❌ Port check failed:', error.message);
    }
    
    // Test if nginx is running
    try {
      const result = execSync('systemctl is-active nginx', { encoding: 'utf8', timeout: 5000 });
      if (result.trim() === 'active') {
        console.log('✅ Nginx is active');
      } else {
        console.log('❌ Nginx is not active:', result.trim());
      }
    } catch (error) {
      console.log('⚠️  Nginx status check failed (might not be installed):', error.message);
    }
  }

  async checkEnvironmentVariables() {
    console.log('\n🔍 Checking Environment Variables...');
    
    const requiredEnvs = [
      'AUTH_SERVICE_URL',
      'REDIS_URL',
      'KAFKA_BROKERS',
      'CORS_ORIGIN'
    ];
    
    const optionalEnvs = [
      'PORT',
      'HOST',
      'NODE_ENV',
      'LOG_LEVEL',
      'RATE_LIMIT_ENABLED'
    ];
    
    console.log('📊 Required environment variables:');
    requiredEnvs.forEach(env => {
      const value = process.env[env];
      if (value) {
        console.log(`✅ ${env}: ${value}`);
      } else {
        console.log(`❌ ${env}: Not set`);
      }
    });
    
    console.log('\n📊 Optional environment variables:');
    optionalEnvs.forEach(env => {
      const value = process.env[env];
      if (value) {
        console.log(`✅ ${env}: ${value}`);
      } else {
        console.log(`⚠️  ${env}: Not set (using default)`);
      }
    });
  }

  async checkLogs() {
    console.log('\n🔍 Checking Recent Logs...');
    
    try {
      // Try to get recent logs from journalctl or docker logs
      const commands = [
        'journalctl -u websocket-service --no-pager --lines=10',
        'docker logs moonx-websocket-service --tail=10',
        'pm2 logs websocket-service --lines=10'
      ];
      
      for (const command of commands) {
        try {
          const result = execSync(command, { encoding: 'utf8', timeout: 5000 });
          if (result.trim()) {
            console.log(`✅ Logs from: ${command}`);
            console.log(result.trim());
            break;
          }
        } catch (error) {
          // Continue to next command
        }
      }
    } catch (error) {
      console.log('⚠️  Could not retrieve logs:', error.message);
      console.log('💡 Try manually checking logs with:');
      console.log('   - journalctl -u websocket-service');
      console.log('   - docker logs moonx-websocket-service');
      console.log('   - pm2 logs websocket-service');
    }
  }

  async generateSuggestions() {
    console.log('\n💡 Troubleshooting Suggestions:');
    console.log('===============================');
    
    console.log('1. 🔧 Check if all services are running:');
    console.log('   - WebSocket service: pm2 status or docker ps');
    console.log('   - Auth service: curl http://localhost:3001/health');
    console.log('   - Redis: redis-cli ping');
    console.log('   - Kafka: kafka-console-consumer.sh --list');
    
    console.log('\n2. 🔧 Check nginx configuration:');
    console.log('   - nginx -t (test configuration)');
    console.log('   - systemctl status nginx');
    console.log('   - tail -f /var/log/nginx/error.log');
    
    console.log('\n3. 🔧 Check SSL certificates:');
    console.log('   - ls -la /etc/nginx/ssl/');
    console.log('   - openssl x509 -in /etc/nginx/ssl/ws.moonx.farm.crt -text -noout');
    
    console.log('\n4. 🔧 Check firewall:');
    console.log('   - ufw status');
    console.log('   - iptables -L');
    
    console.log('\n5. 🔧 Test direct connection:');
    console.log('   - node test-client.js');
    console.log('   - curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:3008/ws');
  }
}

// Run debug if called directly
if (require.main === module) {
  const wsDebugger = new WebSocketDebugger();
  wsDebugger.debugAll()
    .then(() => wsDebugger.generateSuggestions())
    .catch(console.error);
}

module.exports = WebSocketDebugger; 
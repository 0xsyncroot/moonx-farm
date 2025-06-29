/**
 * MoonXFarm Web App - Health Check Script
 * 
 * Simple health check for Docker container monitoring.
 * Checks if the Next.js server is responding properly.
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 3000,
  path: '/api/health',
  method: 'GET',
  timeout: 5000,
};

const request = http.request(options, (res) => {
  console.log(`Health check status: ${res.statusCode}`);
  
  if (res.statusCode === 200) {
    process.exit(0); // Success
  } else {
    process.exit(1); // Failure
  }
});

request.on('error', (err) => {
  console.error('Health check failed:', err.message);
  process.exit(1); // Failure
});

request.on('timeout', () => {
  console.error('Health check timeout');
  request.destroy();
  process.exit(1); // Failure
});

request.end(); 
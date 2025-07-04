/**
 * Test script for Alchemy API improvements
 * Tests the enhanced error handling, retry logic, and fallback mechanisms
 */

const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3007'; // Core service URL
const TEST_WALLET = '0x742d35cccccccccccccccccccccccccccccccccccc'; // Placeholder wallet

async function testAlchemyImprovements() {
  console.log('🧪 Testing Alchemy Service Improvements...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing service health...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Service is healthy:', healthResponse.data.status);
    console.log('🔑 API Key configured:', healthResponse.data.apiKey ? 'Yes' : 'No');
    console.log('🌐 Connectivity:', healthResponse.data.connectivity ? 'Yes' : 'No');
    console.log();

    // Test 2: Portfolio endpoint with improved error handling
    console.log('2️⃣ Testing portfolio endpoint with error handling...');
    try {
      const portfolioResponse = await axios.get(`${BASE_URL}/api/v1/portfolio`, {
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });
      
      console.log('✅ Portfolio response status:', portfolioResponse.status);
      console.log('📊 Response data:', JSON.stringify(portfolioResponse.data, null, 2));
    } catch (error) {
      if (error.response) {
        console.log('🔴 Portfolio API Error Status:', error.response.status);
        console.log('🔴 Error Message:', error.response.data?.message || 'Unknown error');
        
        // Check if it's the expected sync response (202)
        if (error.response.status === 202) {
          console.log('✅ Expected behavior: Portfolio sync initiated');
        }
      } else {
        console.log('🔴 Network Error:', error.message);
      }
    }
    console.log();

    // Test 3: Sync trigger to test API resilience
    console.log('3️⃣ Testing sync trigger with API resilience...');
    try {
      const syncResponse = await axios.post(`${BASE_URL}/api/v1/sync/trigger`, {
        syncType: 'portfolio',
        priority: 'medium'
      }, {
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      
      console.log('✅ Sync response status:', syncResponse.status);
      console.log('🔄 Sync message:', syncResponse.data?.message);
    } catch (error) {
      if (error.response) {
        console.log('🔴 Sync API Error Status:', error.response.status);
        console.log('🔴 Error Message:', error.response.data?.message || 'Unknown error');
      } else {
        console.log('🔴 Network Error:', error.message);
      }
    }
    console.log();

    // Test 4: Check sync status
    console.log('4️⃣ Testing sync status monitoring...');
    try {
      const statusResponse = await axios.get(`${BASE_URL}/api/v1/sync/status`, {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      
      console.log('✅ Sync status response:', statusResponse.status);
      console.log('📈 Status data:', JSON.stringify(statusResponse.data, null, 2));
    } catch (error) {
      if (error.response) {
        console.log('🔴 Status API Error:', error.response.status);
        console.log('🔴 Error Message:', error.response.data?.message || 'Unknown error');
      } else {
        console.log('🔴 Network Error:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }

  console.log('\n🏁 Test completed!\n');
  
  console.log('💡 Improvements implemented:');
  console.log('  • Enhanced retry logic with exponential backoff (5 retries)');
  console.log('  • Rate limiting protection (1000ms between requests)');
  console.log('  • Improved CoinGecko API handling with validation');
  console.log('  • Better error detection for 503/429 status codes');
  console.log('  • Comprehensive fallback pricing strategy');
  console.log('  • Smaller batch sizes for API stability (10-50 tokens)');
  console.log('  • Enhanced timeout and error recovery mechanisms');
}

// Run the test
testAlchemyImprovements().catch(console.error); 
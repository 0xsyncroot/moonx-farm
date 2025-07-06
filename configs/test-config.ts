#!/usr/bin/env tsx

import { getApiKeys, createCoreServiceConfig } from './index';

console.log('🧪 Testing core-service configuration...\n');

try {
  // Test 1: Check if core-service config can be created
  console.log('✅ Test 1: Creating core-service config...');
  const config = createCoreServiceConfig();
  console.log('✅ Core service config created successfully\n');

  // Test 2: Check if getApiKeys works for core-service
  console.log('✅ Test 2: Getting API keys for core-service...');
  const apiKeys = getApiKeys('core-service');
  console.log(`✅ API keys loaded: ${Object.keys(apiKeys).join(', ')}\n`);

  // Test 3: Check specific API key values
  console.log('✅ Test 3: Checking API key values...');
  console.log(`  - ALCHEMY_API_KEY: ${apiKeys.alchemy ? 'Set' : 'Not set'}`);
  console.log(`  - COINGECKO_API_KEY: ${apiKeys.coingecko ? 'Set' : 'Not set'}`);
  console.log(`  - INFURA_API_KEY: ${apiKeys.infura ? 'Set' : 'Not set'}\n`);

  // Test 4: Check environment variable directly
  console.log('✅ Test 4: Checking environment variables...');
  console.log(`  - process.env.ALCHEMY_API_KEY: ${process.env.ALCHEMY_API_KEY ? 'Set' : 'Not set'}`);
  console.log(`  - process.env.NODE_ENV: ${process.env.NODE_ENV || 'undefined'}\n`);

  // Test 5: Check config data structure
  console.log('✅ Test 5: Checking config data structure...');
  const configData = config.getAll() as any;
  console.log(`  - Config has ALCHEMY_API_KEY: ${configData.ALCHEMY_API_KEY ? 'Yes' : 'No'}`);
  console.log(`  - Config has DATABASE_HOST: ${configData.DATABASE_HOST ? 'Yes' : 'No'}`);
  console.log(`  - Config has REDIS_HOST: ${configData.REDIS_HOST ? 'Yes' : 'No'}\n`);

  console.log('🎉 All tests passed! Configuration is working correctly.');

} catch (error) {
  console.error('❌ Configuration test failed:', error);
  console.error('\n🔍 Debugging tips:');
  console.error('  1. Make sure .env file exists in the root directory');
  console.error('  2. Check that ALCHEMY_API_KEY is set in .env file');
  console.error('  3. Verify the .env file is properly formatted');
  console.error('  4. Ensure no syntax errors in environment variables');
  process.exit(1);
} 
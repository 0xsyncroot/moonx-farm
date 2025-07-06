#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 MoonX Farm Configuration Debug Tool\n');

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
const envExists = fs.existsSync(envPath);

console.log('📁 Environment File Check:');
console.log(`  - .env file exists: ${envExists ? '✅' : '❌'}`);
console.log(`  - .env file path: ${envPath}`);

if (!envExists) {
  console.log('\n❌ .env file not found!');
  console.log('📝 Create .env file with:');
  console.log('  cp env.example .env');
  console.log('  nano .env');
  process.exit(1);
}

// Read and parse .env file
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
  console.log(`  - .env file size: ${envContent.length} characters\n`);
} catch (error) {
  console.log(`  - Error reading .env: ${error.message}\n`);
  process.exit(1);
}

// Check for required environment variables
const requiredVars = [
  'NODE_ENV',
  'DATABASE_HOST',
  'DATABASE_PASSWORD',
  'JWT_SECRET',
  'REDIS_HOST',
  'ALCHEMY_API_KEY'
];

console.log('🔑 Required Environment Variables:');
const missingVars = [];
const setVars = [];

requiredVars.forEach(varName => {
  // Check if variable is defined in .env file
  const envHasVar = envContent.includes(`${varName}=`);
  // Check if variable is set in environment
  const envValue = process.env[varName];
  
  if (envValue && envValue.trim() !== '') {
    console.log(`  - ${varName}: ✅ Set`);
    setVars.push(varName);
  } else if (envHasVar) {
    console.log(`  - ${varName}: ⚠️  Defined but empty`);
    missingVars.push(varName);
  } else {
    console.log(`  - ${varName}: ❌ Missing`);
    missingVars.push(varName);
  }
});

console.log('\n📊 Configuration Summary:');
console.log(`  - Variables set: ${setVars.length}/${requiredVars.length}`);
console.log(`  - Variables missing: ${missingVars.length}`);

if (missingVars.length > 0) {
  console.log('\n❌ Missing Required Variables:');
  missingVars.forEach(varName => {
    console.log(`  - ${varName}`);
  });
  
  console.log('\n🛠️  How to fix:');
  console.log('  1. Open .env file: nano .env');
  console.log('  2. Add missing variables:');
  
  missingVars.forEach(varName => {
    switch (varName) {
      case 'ALCHEMY_API_KEY':
        console.log(`     ${varName}=your-alchemy-api-key-here`);
        break;
      case 'DATABASE_PASSWORD':
        console.log(`     ${varName}=your-database-password`);
        break;
      case 'JWT_SECRET':
        console.log(`     ${varName}=your-jwt-secret-minimum-32-characters-long`);
        break;
      default:
        console.log(`     ${varName}=your-value-here`);
    }
  });
  
  console.log('  3. Save and restart the service');
  console.log('\n💡 Get Alchemy API Key:');
  console.log('  - Visit: https://www.alchemy.com/');
  console.log('  - Sign up for free account');
  console.log('  - Create new app and copy API key');
  
  process.exit(1);
} else {
  console.log('\n✅ All required variables are set!');
  console.log('🎉 Configuration looks good.');
  
  // Test @moonx-farm/configs if available
  try {
    const { getApiKeys } = require('../configs');
    console.log('\n🧪 Testing @moonx-farm/configs...');
    
    const apiKeys = getApiKeys('core-service');
    console.log(`  - API keys loaded: ${Object.keys(apiKeys).join(', ')}`);
    console.log(`  - ALCHEMY_API_KEY: ${apiKeys.alchemy ? 'Set' : 'Not set'}`);
    
    console.log('\n🎉 @moonx-farm/configs test passed!');
  } catch (error) {
    console.log('\n⚠️  Could not test @moonx-farm/configs:', error.message);
  }
} 
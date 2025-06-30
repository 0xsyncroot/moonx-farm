#!/usr/bin/env node

/**
 * Test script to demonstrate logger configuration from @moonx-farm/configs
 */

// Note: This is a demonstration file. In a real project, you would import from @moonx/common
// import { createLogger, createLoggerForProfile, createLoggerWithConfig, LoggerConfig } from '@moonx-farm/common';

console.log('=== Logger Configuration Test ===\n');

// Test 1: Basic logger
console.log('1. Basic logger:');
console.log('const basicLogger = createLogger("test-service");');
console.log('basicLogger.info("Basic logger test", { test: true });');

// Test 2: Profile-based logger
console.log('\n2. Profile-based logger:');
console.log('const authLogger = createLoggerForProfile("auth-service");');
console.log('authLogger.info("Auth service logger test", { profile: "auth-service" });');

console.log('const aggregatorLogger = createLoggerForProfile("aggregator-service");');
console.log('aggregatorLogger.debug("Aggregator service logger test", { profile: "aggregator-service" });');

// Test 3: Custom configuration
console.log('\n3. Custom configuration:');
console.log('const customConfig: LoggerConfig = {');
console.log('  level: "debug",');
console.log('  service: "custom-test",');
console.log('  enableConsole: true,');
console.log('  enableFile: false,');
console.log('  logDir: "logs",');
console.log('  maxFiles: 5,');
console.log('  maxSize: "10m",');
console.log('  format: "console",');
console.log('};');

// Test 4: Child logger
console.log('\n4. Child logger:');
console.log('const childLogger = basicLogger.child({ testId: "child-test" });');
console.log('childLogger.info("Child logger test", { parent: "basic-logger" });');

// Test 5: Different log levels
console.log('\n5. Different log levels:');
console.log('const debugLogger = createLogger("debug-test", "debug");');
console.log('debugLogger.debug("Debug message");');
console.log('debugLogger.info("Info message");');
console.log('debugLogger.warn("Warning message");');
console.log('debugLogger.error("Error message");');

console.log('\n=== Test completed ===');
console.log('\nTo run this test with actual logger:');
console.log('1. Install @moonx/common package');
console.log('2. Uncomment the import statement');
console.log('3. Run: node test-logger.ts'); 
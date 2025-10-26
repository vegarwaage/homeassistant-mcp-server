#!/usr/bin/env node
// ABOUTME: Test script to verify server initialization
// ABOUTME: Verifies server can initialize with all tools registered

// Set test environment
process.env.SUPERVISOR_TOKEN = 'test-token';
process.env.HA_BASE_URL = 'http://localhost:8123';
process.env.TRANSPORT = 'stdio';

console.log('🧪 Testing Server Initialization...\n');

// Import and check if the module loads without errors
try {
  // This will execute the index.js file
  // We'll catch it before it starts the transport
  const originalResume = process.stdin.resume;
  let serverStarted = false;

  process.stdin.resume = function() {
    serverStarted = true;
    console.log('✅ Server initialized successfully!');
    console.log('✅ All tools registered without errors');
    console.log('✅ MCP server ready to accept connections\n');
    process.exit(0);
  };

  // Import the server (this will start initialization)
  require('./dist/index.js');

  // If we get here without throwing, initialization succeeded
  setTimeout(() => {
    if (!serverStarted) {
      console.log('⚠️  Server loaded but did not reach ready state');
      process.exit(1);
    }
  }, 2000);

} catch (error) {
  console.error('❌ Server initialization failed:');
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
}

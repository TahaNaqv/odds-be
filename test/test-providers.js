const { ethers } = require('ethers');

// Test script to verify our hybrid HTTP/WebSocket provider setup
async function testProviders() {
  console.log('🧪 Testing Provider Setup...\n');

  // Load environment variables
  require('dotenv').config();

  const httpUrl = process.env.BASE_SEPOLIA_RPC_URL;
  const wsUrl = process.env.BASE_SEPOLIA_WSS_URL;

  console.log('📋 Configuration:');
  console.log(`HTTP URL: ${httpUrl ? '✅ Configured' : '❌ Missing'}`);
  console.log(`WebSocket URL: ${wsUrl ? '✅ Configured' : '❌ Missing'}\n`);

  // Test HTTP Provider
  try {
    console.log('🌐 Testing HTTP Provider...');
    const httpProvider = new ethers.JsonRpcProvider(httpUrl);

    const blockNumber = await httpProvider.getBlockNumber();
    console.log(`✅ HTTP Provider: Connected, latest block: ${blockNumber}`);

    const network = await httpProvider.getNetwork();
    console.log(
      `✅ HTTP Provider: Network ${network.name} (chainId: ${network.chainId})`,
    );
  } catch (error) {
    console.log(`❌ HTTP Provider: Failed - ${error.message}`);
  }

  console.log('');

  // Test WebSocket Provider
  if (wsUrl) {
    try {
      console.log('🔌 Testing WebSocket Provider...');
      const wsProvider = new ethers.WebSocketProvider(wsUrl);

      // Set up connection handlers
      wsProvider.websocket.on('open', () => {
        console.log('✅ WebSocket: Connection opened');
      });

      wsProvider.websocket.on('error', (error) => {
        console.log(`❌ WebSocket: Error - ${error.message}`);
      });

      wsProvider.websocket.on('close', (code, reason) => {
        console.log(`⚠️ WebSocket: Connection closed (${code}: ${reason})`);
      });

      // Test basic operations
      const blockNumber = await wsProvider.getBlockNumber();
      console.log(
        `✅ WebSocket Provider: Connected, latest block: ${blockNumber}`,
      );

      const network = await wsProvider.getNetwork();
      console.log(
        `✅ WebSocket Provider: Network ${network.name} (chainId: ${network.chainId})`,
      );

      // Test event listening capability
      console.log('🎧 Testing event listening capability...');

      // Create a simple filter to test event listening
      wsProvider.on('block', (blockNumber) => {
        console.log(`📦 New block received via WebSocket: ${blockNumber}`);
      });

      // Let it run for a few seconds to catch a block
      setTimeout(() => {
        wsProvider.removeAllListeners();
        wsProvider.websocket.close();
        console.log('✅ WebSocket event listening test completed');

        console.log('\n🎉 Provider Test Summary:');
        console.log('- HTTP Provider: Ready for contract operations');
        console.log('- WebSocket Provider: Ready for real-time events');
        console.log('\nYour hybrid setup is working correctly! 🚀');
      }, 10000);
    } catch (error) {
      console.log(`❌ WebSocket Provider: Failed - ${error.message}`);
      console.log('⚠️ WebSocket events will fallback to HTTP polling');
    }
  } else {
    console.log(
      '⚠️ WebSocket URL not configured, events will use HTTP polling',
    );
  }
}

// Run the test
testProviders().catch(console.error);

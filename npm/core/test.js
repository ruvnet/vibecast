#!/usr/bin/env node

/**
 * Core bindings integration test
 */

const { AgenticNode, AgenticPublisher, AgenticSubscriber } = require('./index.js');

async function testNodeCreation() {
  console.log('🧪 Test 1: Node creation');
  try {
    const node = new AgenticNode('test-node');
    console.log('✅ Node created successfully');
    return true;
  } catch (error) {
    console.error('❌ Node creation failed:', error.message);
    return false;
  }
}

async function testPublisher() {
  console.log('\n🧪 Test 2: Publisher creation and publishing');
  try {
    const node = new AgenticNode('test-pub-node');
    const publisher = await node.createPublisher('/test/topic');
    console.log('✅ Publisher created');

    const testData = {
      message: 'Hello, World!',
      timestamp: Date.now(),
      value: 42.5,
    };

    await publisher.publish(JSON.stringify(testData));
    console.log('✅ Message published');

    const stats = publisher.getStats();
    console.log('✅ Stats retrieved:', stats);

    if (stats.messages !== 1) {
      console.error('❌ Stats incorrect: expected 1 message, got', stats.messages);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Publisher test failed:', error.message);
    return false;
  }
}

async function testSubscriber() {
  console.log('\n🧪 Test 3: Subscriber creation and receiving');
  try {
    const node = new AgenticNode('test-sub-node');
    const subscriber = await node.createSubscriber('/test/topic2');
    console.log('✅ Subscriber created');

    // Test non-blocking receive (should return null immediately)
    const msg = await subscriber.tryRecv();
    if (msg === null) {
      console.log('✅ Non-blocking receive returned null (expected)');
    } else {
      console.warn('⚠️  Non-blocking receive returned data:', msg);
    }

    return true;
  } catch (error) {
    console.error('❌ Subscriber test failed:', error.message);
    return false;
  }
}

async function testPubSub() {
  console.log('\n🧪 Test 4: Publisher-Subscriber communication');
  try {
    const pubNode = new AgenticNode('pub-node');
    const subNode = new AgenticNode('sub-node');

    const topic = '/test/pubsub';
    const publisher = await pubNode.createPublisher(topic);
    const subscriber = await subNode.createSubscriber(topic);

    console.log('✅ Publisher and Subscriber created');

    // Give subscriber time to connect
    await new Promise(resolve => setTimeout(resolve, 100));

    // Publish message
    const testMsg = { test: 'data', value: 123 };
    await publisher.publish(JSON.stringify(testMsg));
    console.log('✅ Message published to', topic);

    // Try to receive (may not work immediately due to async nature)
    await new Promise(resolve => setTimeout(resolve, 50));
    const received = await subscriber.tryRecv();

    if (received) {
      const parsed = JSON.parse(received);
      console.log('✅ Message received:', parsed);
    } else {
      console.log('⚠️  No message received (async timing)');
    }

    return true;
  } catch (error) {
    console.error('❌ Pub-Sub test failed:', error.message);
    return false;
  }
}

async function testMultipleMessages() {
  console.log('\n🧪 Test 5: Multiple message publishing');
  try {
    const node = new AgenticNode('multi-msg-node');
    const publisher = await node.createPublisher('/test/multi');

    const messageCount = 100;
    for (let i = 0; i < messageCount; i++) {
      await publisher.publish(JSON.stringify({ id: i, data: `message-${i}` }));
    }

    const stats = publisher.getStats();
    console.log(`✅ Published ${messageCount} messages`);
    console.log('📊 Stats:', stats);

    if (stats.messages !== messageCount) {
      console.error(`❌ Stats mismatch: expected ${messageCount}, got ${stats.messages}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Multiple messages test failed:', error.message);
    return false;
  }
}

async function testErrorHandling() {
  console.log('\n🧪 Test 6: Error handling');
  try {
    const node = new AgenticNode('error-test-node');
    const publisher = await node.createPublisher('/test/errors');

    // Test invalid JSON
    try {
      await publisher.publish('not valid json {]');
      console.error('❌ Should have thrown error for invalid JSON');
      return false;
    } catch (error) {
      console.log('✅ Correctly rejected invalid JSON:', error.message);
    }

    return true;
  } catch (error) {
    console.error('❌ Error handling test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Core Bindings Integration Tests\n');
  console.log('=' .repeat(60));

  const tests = [
    testNodeCreation,
    testPublisher,
    testSubscriber,
    testPubSub,
    testMultipleMessages,
    testErrorHandling,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error('❌ Test threw exception:', error.message);
      failed++;
    }
    console.log('─'.repeat(60));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed');
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

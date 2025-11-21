/**
 * Basic PubNub messaging example
 * Demonstrates simple pub/sub functionality
 */

import { PubNubService, MessageType, Message } from '../src';

async function main() {
  console.log('=== Basic PubNub Messaging Example ===\n');

  // Initialize PubNub with demo keys
  const pubnub = new PubNubService({
    publishKey: 'demo',
    subscribeKey: 'demo',
    userId: 'basic-example-user',
    logVerbosity: false,
  });

  // Subscribe to a channel
  const channel = 'vibecast-demo';
  pubnub.subscribe(channel);

  // Set up message handler
  pubnub.onMessage(channel, (message: Message) => {
    console.log(`\n📨 Received message:`);
    console.log(`   Type: ${message.type}`);
    console.log(`   From: ${message.sender}`);
    console.log(`   Payload:`, message.payload);
    console.log(`   Time: ${new Date(message.timestamp).toISOString()}`);
  });

  // Set up presence handler
  pubnub.onPresence(channel, (presence) => {
    const action = presence.joined ? 'joined' : 'left';
    console.log(`\n👤 User ${presence.uuid} ${action} the channel`);
  });

  // Wait for subscription to complete
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Send some messages
  console.log('\n📤 Sending messages...\n');

  await pubnub.publish(
    channel,
    MessageType.TEXT,
    { text: 'Hello from Vibecast!' }
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  await pubnub.publish(
    channel,
    MessageType.DATA,
    {
      temperature: 72,
      humidity: 45,
      location: 'Studio'
    },
    { sensor: 'weather-01' }
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  await pubnub.publish(
    channel,
    MessageType.EVENT,
    {
      eventName: 'stream_started',
      viewers: 0,
      quality: '1080p'
    }
  );

  // Check who's here
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('\n👥 Getting channel presence...');
  const users = await pubnub.hereNow(channel);
  console.log(`   Users in channel: ${users.length}`);
  console.log(`   Users: ${users.join(', ')}`);

  // Set user state
  await pubnub.setState(channel, {
    status: 'streaming',
    mood: '🎉',
    viewers: 42
  });

  console.log('\n✅ State updated!');

  // Get message history
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('\n📜 Fetching message history...');
  const history = await pubnub.getHistory(channel, 10);
  console.log(`   Found ${history.length} messages in history`);

  // Keep alive for a bit
  console.log('\n⏳ Keeping connection alive for 5 seconds...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Cleanup
  console.log('\n🔌 Disconnecting...');
  pubnub.disconnect();
  console.log('✅ Done!\n');
}

// Run example
main().catch(console.error);

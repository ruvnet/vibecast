#!/usr/bin/env node

const { program } = require('commander');
const { AgenticNode } = require('@agentic-robotics/core');

program
  .name('agentic-robotics')
  .description('CLI tools for agentic robotics framework')
  .version('0.1.3');

program
  .command('test')
  .description('Test node creation and communication')
  .action(async () => {
    console.log('🤖 Testing Agentic Robotics Node...');

    try {
      const node = new AgenticNode('test-node');
      console.log('✅ Node created successfully');

      const publisher = await node.createPublisher('/test');
      console.log('✅ Publisher created');

      await publisher.publish(JSON.stringify({ message: 'Hello, World!', timestamp: Date.now() }));
      console.log('✅ Message published');

      const stats = publisher.getStats();
      console.log('📊 Stats:', stats);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('info')
  .description('Show framework information')
  .action(() => {
    console.log('🤖 Agentic Robotics Framework v0.1.3');
    console.log('📦 ROS3-compatible robotics middleware');
    console.log('⚡ High-performance native bindings');
    console.log('');
    console.log('Available commands:');
    console.log('  test     - Test node creation and communication');
    console.log('  info     - Show this information');
  });

program.parse();

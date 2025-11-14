#!/usr/bin/env node

/**
 * Change Management Expert System CLI
 * Main entry point for the command-line interface
 */

const commands = require('./src/cli/commands');

// Parse arguments
const args = process.argv.slice(2);
const command = args[0] || 'help';

// Parse flags
const parsedArgs = { _: args };
for (let i = 1; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].substring(2);
    const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
    parsedArgs[key] = value;
    if (value !== true) i++;
  }
}

// Execute command
(async () => {
  try {
    if (commands[command]) {
      await commands[command](parsedArgs);
    } else {
      console.error(`Unknown command: ${command}`);
      commands.help();
      process.exit(1);
    }
  } catch (error) {
    console.error('Error executing command:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();

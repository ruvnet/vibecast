#!/usr/bin/env node

/**
 * AgentDB CLI - Pattern storage and reflexion memory management
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { AgentDB, ReflexionMemory, MockEmbeddingModel } from './agentdb';
import { State } from './state';
import { VERSION } from './index';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const program = new Command();

// Global AgentDB instance
let agentDb: AgentDB;
let reflexion: ReflexionMemory;

function initializeAgentDB() {
  if (!agentDb) {
    agentDb = new AgentDB(new MockEmbeddingModel());
    reflexion = new ReflexionMemory(agentDb);
  }
}

program
  .name('agentdb')
  .description(chalk.cyan('🧠 AgentDB - Pattern storage and reflexion memory management'))
  .version(VERSION, '-v, --version', 'Output the current version');

// Store pattern command
program
  .command('store <name> <content>')
  .description('Store a new pattern')
  .option('-m, --metadata <json>', 'Metadata as JSON string')
  .action(async (name, content, options) => {
    initializeAgentDB();
    const spinner = ora('Storing pattern...').start();

    try {
      const metadata = options.metadata ? JSON.parse(options.metadata) : {};
      const id = await agentDb.storePattern(name, content, metadata);

      spinner.succeed(`Pattern stored with ID: ${chalk.green(id)}\n`);

      console.log(chalk.bold.cyan('Pattern Details:\n'));
      console.log(chalk.white('Name:    ') + chalk.green(name));
      console.log(chalk.white('ID:      ') + chalk.yellow(id));
      console.log(chalk.white('Content: ') + chalk.gray(content.substring(0, 60) + (content.length > 60 ? '...' : '')));
      console.log();
    } catch (error: any) {
      spinner.fail('Failed to store pattern');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Search command
program
  .command('search <query>')
  .description('Search for similar patterns')
  .option('-l, --limit <number>', 'Maximum number of results', '5')
  .action(async (query, options) => {
    initializeAgentDB();
    const spinner = ora('Searching patterns...').start();

    try {
      const limit = parseInt(options.limit);
      const results = await agentDb.searchSimilar(query, limit);

      spinner.succeed(`Found ${results.length} similar patterns\n`);

      if (results.length === 0) {
        console.log(chalk.yellow('No patterns found'));
        return;
      }

      const data = [
        [
          chalk.bold('Rank'),
          chalk.bold('Name'),
          chalk.bold('Score'),
          chalk.bold('Usage'),
          chalk.bold('Content Preview')
        ],
        ...results.map((pattern, i) => [
          (i + 1).toString(),
          pattern.name,
          pattern.score.toFixed(3),
          pattern.usageCount.toString(),
          pattern.content.substring(0, 40) + (pattern.content.length > 40 ? '...' : '')
        ])
      ];

      console.log(table(data, {
        border: {
          topBody: `─`,
          topJoin: `┬`,
          topLeft: `┌`,
          topRight: `┐`,
          bottomBody: `─`,
          bottomJoin: `┴`,
          bottomLeft: `└`,
          bottomRight: `┘`,
          bodyLeft: `│`,
          bodyRight: `│`,
          bodyJoin: `│`,
          joinBody: `─`,
          joinLeft: `├`,
          joinRight: `┤`,
          joinJoin: `┼`
        }
      }));
      console.log();
    } catch (error: any) {
      spinner.fail('Search failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Display AgentDB statistics')
  .action(() => {
    initializeAgentDB();

    const stats = agentDb.getStats();
    const reflexionStats = reflexion.getStats();

    console.log(chalk.bold.cyan('\n📊 AgentDB Statistics\n'));

    console.log(chalk.white('Total Patterns:      ') + chalk.green(stats.totalPatterns));
    console.log(chalk.white('Embedding Dimension: ') + chalk.yellow(stats.embeddingDimension));
    console.log(chalk.white('Total Usage:         ') + chalk.green(stats.totalUsage));

    console.log(chalk.bold.cyan('\n🧠 Reflexion Memory Statistics\n'));

    console.log(chalk.white('Successes:   ') + chalk.green(reflexionStats.successes));
    console.log(chalk.white('Failures:    ') + chalk.red(reflexionStats.failures));
    console.log(chalk.white('Success Rate:') + chalk.yellow((reflexionStats.successRate * 100).toFixed(1) + '%'));
    console.log();
  });

// Record success command
program
  .command('record-success <name> <state>')
  .description('Record a successful execution')
  .option('-s, --score <number>', 'Success score (0-1)', '1.0')
  .action(async (name, stateJson, options) => {
    initializeAgentDB();
    const spinner = ora('Recording success...').start();

    try {
      const stateData = JSON.parse(stateJson);
      const state = new State(stateData);
      const score = parseFloat(options.score);

      const id = await reflexion.recordSuccess(name, state, score);

      spinner.succeed(`Success recorded with ID: ${chalk.green(id)}\n`);

      console.log(chalk.bold.cyan('Recorded Details:\n'));
      console.log(chalk.white('Name:  ') + chalk.green(name));
      console.log(chalk.white('Score: ') + chalk.yellow(score.toFixed(2)));
      console.log(chalk.white('State: ') + chalk.gray(JSON.stringify(stateData)));
      console.log();
    } catch (error: any) {
      spinner.fail('Failed to record success');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Record failure command
program
  .command('record-failure <name> <state> <error>')
  .description('Record a failed execution')
  .action(async (name, stateJson, error) => {
    initializeAgentDB();
    const spinner = ora('Recording failure...').start();

    try {
      const stateData = JSON.parse(stateJson);
      const state = new State(stateData);

      const id = await reflexion.recordFailure(name, state, error);

      spinner.succeed(`Failure recorded with ID: ${chalk.green(id)}\n`);

      console.log(chalk.bold.cyan('Recorded Details:\n'));
      console.log(chalk.white('Name:  ') + chalk.red(name));
      console.log(chalk.white('Error: ') + chalk.yellow(error));
      console.log(chalk.white('State: ') + chalk.gray(JSON.stringify(stateData)));
      console.log();
    } catch (error: any) {
      spinner.fail('Failed to record failure');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Recall command
program
  .command('recall <state>')
  .description('Recall similar past executions')
  .option('-l, --limit <number>', 'Maximum number of results', '5')
  .action(async (stateJson, options) => {
    initializeAgentDB();
    const spinner = ora('Recalling similar executions...').start();

    try {
      const stateData = JSON.parse(stateJson);
      const state = new State(stateData);
      const limit = parseInt(options.limit);

      const results = await reflexion.recallSimilar(state, limit);

      spinner.succeed(`Found ${results.length} similar executions\n`);

      if (results.length === 0) {
        console.log(chalk.yellow('No similar executions found'));
        return;
      }

      const data = [
        [
          chalk.bold('Rank'),
          chalk.bold('Name'),
          chalk.bold('Type'),
          chalk.bold('Score'),
          chalk.bold('Usage')
        ],
        ...results.map((pattern, i) => [
          (i + 1).toString(),
          pattern.name,
          pattern.metadata.type === 'success' ? chalk.green('✓ Success') : chalk.red('✗ Failure'),
          pattern.score.toFixed(3),
          pattern.usageCount.toString()
        ])
      ];

      console.log(table(data));
      console.log();
    } catch (error: any) {
      spinner.fail('Recall failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Export command
program
  .command('export <file>')
  .description('Export all patterns to JSON file')
  .action((file) => {
    initializeAgentDB();
    const spinner = ora('Exporting patterns...').start();

    try {
      const patterns = agentDb.export();
      const outputPath = resolve(process.cwd(), file);
      writeFileSync(outputPath, JSON.stringify(patterns, null, 2));

      spinner.succeed(`Exported ${patterns.length} patterns to ${chalk.green(outputPath)}\n`);
    } catch (error: any) {
      spinner.fail('Export failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Import command
program
  .command('import <file>')
  .description('Import patterns from JSON file')
  .action((file) => {
    initializeAgentDB();
    const spinner = ora('Importing patterns...').start();

    try {
      const filePath = resolve(process.cwd(), file);
      const patterns = JSON.parse(readFileSync(filePath, 'utf-8'));

      agentDb.import(patterns);

      spinner.succeed(`Imported ${patterns.length} patterns from ${chalk.green(filePath)}\n`);
    } catch (error: any) {
      spinner.fail('Import failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Enhanced help
program.addHelpText('after', `
${chalk.bold.cyan('Examples:')}
  ${chalk.gray('# Store a new pattern')}
  $ agentdb store "workflow-1" "User authentication flow"

  ${chalk.gray('# Search for similar patterns')}
  $ agentdb search "authentication" --limit 10

  ${chalk.gray('# Record successful execution')}
  $ agentdb record-success "flow-1" '{"user":"john","status":"ok"}' --score 0.95

  ${chalk.gray('# Record failed execution')}
  $ agentdb record-failure "flow-2" '{"user":"jane"}' "Authentication failed"

  ${chalk.gray('# Recall similar executions')}
  $ agentdb recall '{"user":"john"}' --limit 5

  ${chalk.gray('# Export patterns to file')}
  $ agentdb export patterns.json

  ${chalk.gray('# Import patterns from file')}
  $ agentdb import patterns.json

  ${chalk.gray('# View statistics')}
  $ agentdb stats

${chalk.bold.cyan('Documentation:')}
  ${chalk.white('GitHub:')} https://github.com/ruvnet/vibecast
  ${chalk.white('Issues:')} https://github.com/ruvnet/vibecast/issues
`);

program.parse();

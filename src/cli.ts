#!/usr/bin/env node
/**
 * Toyota Motor Company Simulation - CLI Interface
 * npx ruvector toyota-sim
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import * as readline from 'readline';
import { ToyotaSimulationEngine } from './simulation/SimulationEngine';

const program = new Command();

// ASCII Art Logo
const LOGO = `
${chalk.red('████████╗ ██████╗ ██╗   ██╗ ██████╗ ████████╗ █████╗ ')}
${chalk.red('╚══██╔══╝██╔═══██╗╚██╗ ██╔╝██╔═══██╗╚══██╔══╝██╔══██╗')}
${chalk.red('   ██║   ██║   ██║ ╚████╔╝ ██║   ██║   ██║   ███████║')}
${chalk.red('   ██║   ██║   ██║  ╚██╔╝  ██║   ██║   ██║   ██╔══██║')}
${chalk.red('   ██║   ╚██████╔╝   ██║   ╚██████╔╝   ██║   ██║  ██║')}
${chalk.red('   ╚═╝    ╚═════╝    ╚═╝    ╚═════╝    ╚═╝    ╚═╝  ╚═╝')}
${chalk.gray('          Self-Learning Enterprise Simulation')}
${chalk.cyan('              Powered by ruvector AI')}
`;

program
  .name('toyota-sim')
  .description('Toyota Motor Company Self-Learning Simulation Agent')
  .version('1.0.0');

// ============================================================================
// SIMULATE COMMAND
// ============================================================================

program
  .command('simulate')
  .description('Run the Toyota Motor Company simulation')
  .option('-e, --employees <number>', 'Number of employees to simulate', '370000')
  .option('-s, --suppliers <number>', 'Number of suppliers', '500')
  .option('-d, --duration <hours>', 'Simulation duration in hours', '24')
  .option('-t, --tick <ms>', 'Tick duration in milliseconds', '100')
  .option('--no-learning', 'Disable agent learning')
  .option('--no-kaizen', 'Disable kaizen improvements')
  .option('--no-jit', 'Disable Just-In-Time production')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    console.log(LOGO);

    const spinner = ora('Initializing Toyota Simulation Engine...').start();

    try {
      const engine = new ToyotaSimulationEngine({
        employeeCount: parseInt(options.employees),
        supplierCount: parseInt(options.suppliers),
        tickDuration: parseInt(options.tick),
        enableLearning: options.learning !== false,
        enableKaizen: options.kaizen !== false,
        enableJIT: options.jit !== false,
        verbosity: options.verbose ? 'verbose' : 'normal',
      });

      spinner.succeed('Engine created');

      await engine.initialize();

      // Setup event handlers for display
      let lastDayReport: any = null;

      engine.on('day:completed', (day, summary) => {
        lastDayReport = summary;
        if (options.verbose) {
          console.log(chalk.green(`\n📅 Day ${day} completed:`));
          console.log(`   Vehicles produced: ${(summary as any).vehiclesProduced.toLocaleString()}`);
          console.log(`   YTD production: ${(summary as any).ytdProduction.toLocaleString()}`);
        }
      });

      engine.on('milestone:reached', (description) => {
        console.log(chalk.yellow(`\n🎉 MILESTONE: ${description}`));
      });

      // Start simulation
      console.log(chalk.cyan('\n▶️  Starting simulation...\n'));
      await engine.start();

      // Run for specified duration
      const durationHours = parseInt(options.duration);
      const totalTicks = durationHours;

      console.log(chalk.gray(`Running simulation for ${durationHours} simulated hours...\n`));

      // Progress display
      const progressInterval = setInterval(() => {
        const status = engine.getSimulationStatus() as any;
        process.stdout.write(
          `\r${chalk.cyan('⏱️')}  Tick: ${status.simulation.currentTick.toString().padStart(6)} | ` +
          `${chalk.green('🚗')} Today: ${status.production.currentDailyOutput?.toLocaleString() || 0} | ` +
          `${chalk.yellow('👥')} Active Agents: ${status.orchestrator.orchestrator.activeAgents}`
        );
      }, 1000);

      // Wait for simulation to complete
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const status = engine.getSimulationStatus() as any;
          if (status.simulation.currentTick >= totalTicks) {
            clearInterval(checkInterval);
            clearInterval(progressInterval);
            resolve();
          }
        }, 100);
      });

      // Stop simulation
      await engine.stop();

      // Final report
      console.log('\n\n');
      printFinalReport(engine.getSimulationStatus());

    } catch (error) {
      spinner.fail('Simulation failed');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// INTERACTIVE COMMAND
// ============================================================================

program
  .command('interactive')
  .alias('i')
  .description('Run simulation in interactive mode')
  .option('-e, --employees <number>', 'Number of employees to simulate', '100000')
  .action(async (options) => {
    console.log(LOGO);

    const engine = new ToyotaSimulationEngine({
      employeeCount: parseInt(options.employees),
      tickDuration: 500, // Slower for interactive
    });

    await engine.initialize();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(chalk.cyan('\n🎮 Interactive Mode'));
    console.log(chalk.gray('Commands: start, stop, pause, resume, status, agents, suppliers, production, quit\n'));

    const prompt = () => {
      rl.question(chalk.cyan('toyota> '), async (input) => {
        const cmd = input.trim().toLowerCase();

        switch (cmd) {
          case 'start':
            await engine.start();
            console.log(chalk.green('✓ Simulation started'));
            break;

          case 'stop':
            await engine.stop();
            console.log(chalk.yellow('✓ Simulation stopped'));
            break;

          case 'pause':
            engine.pause();
            break;

          case 'resume':
            engine.resume();
            break;

          case 'status':
            printStatus(engine.getSimulationStatus());
            break;

          case 'agents':
            printAgentSummary(engine);
            break;

          case 'suppliers':
            printSupplierSummary(engine);
            break;

          case 'production':
            printProductionSummary(engine);
            break;

          case 'help':
            console.log(`
Available commands:
  ${chalk.cyan('start')}      - Start the simulation
  ${chalk.cyan('stop')}       - Stop the simulation
  ${chalk.cyan('pause')}      - Pause the simulation
  ${chalk.cyan('resume')}     - Resume the simulation
  ${chalk.cyan('status')}     - Show current simulation status
  ${chalk.cyan('agents')}     - Show agent summary
  ${chalk.cyan('suppliers')} - Show supplier summary
  ${chalk.cyan('production')}- Show production metrics
  ${chalk.cyan('quit')}       - Exit the simulation
            `);
            break;

          case 'quit':
          case 'exit':
          case 'q':
            await engine.stop();
            console.log(chalk.yellow('Goodbye! 👋'));
            rl.close();
            process.exit(0);
            break;

          default:
            if (cmd) {
              console.log(chalk.red(`Unknown command: ${cmd}. Type 'help' for available commands.`));
            }
        }

        prompt();
      });
    };

    prompt();
  });

// ============================================================================
// DASHBOARD COMMAND
// ============================================================================

program
  .command('dashboard')
  .description('Launch real-time simulation dashboard')
  .option('-e, --employees <number>', 'Number of employees', '50000')
  .action(async (options) => {
    console.log(LOGO);

    const engine = new ToyotaSimulationEngine({
      employeeCount: parseInt(options.employees),
      tickDuration: 200,
    });

    await engine.initialize();
    await engine.start();

    // Clear screen and show dashboard
    const updateDashboard = () => {
      console.clear();
      console.log(LOGO);
      console.log(chalk.gray('Press Ctrl+C to exit\n'));

      const status = engine.getSimulationStatus() as any;

      // Simulation Status Panel
      console.log(chalk.cyan.bold('╔══════════════════════════════════════════════════════════════════╗'));
      console.log(chalk.cyan.bold('║                    SIMULATION DASHBOARD                          ║'));
      console.log(chalk.cyan.bold('╠══════════════════════════════════════════════════════════════════╣'));

      console.log(`║ Status: ${status.simulation.status.padEnd(10)} | Tick: ${status.simulation.currentTick.toString().padStart(8)} | Day: ${status.simulation.simulationDay.toString().padStart(4)} ║`);
      console.log(`║ Date: ${status.simulation.currentDate.slice(0, 10).padEnd(12)} | Elapsed: ${status.simulation.elapsedTime.padEnd(20)} ║`);

      console.log(chalk.cyan.bold('╠══════════════════════════════════════════════════════════════════╣'));
      console.log(chalk.cyan.bold('║                      ORGANIZATION                                ║'));
      console.log(chalk.cyan.bold('╠══════════════════════════════════════════════════════════════════╣'));

      console.log(`║ Employees: ${status.organization.totalEmployees.padEnd(12)} | Suppliers: ${status.organization.totalSuppliers.padEnd(10)}║`);
      console.log(`║ Locations: ${status.organization.globalLocations.toString().padEnd(12)} | Models: ${status.organization.vehicleModels.toString().padEnd(13)}║`);

      console.log(chalk.cyan.bold('╠══════════════════════════════════════════════════════════════════╣'));
      console.log(chalk.cyan.bold('║                      PRODUCTION                                  ║'));
      console.log(chalk.cyan.bold('╠══════════════════════════════════════════════════════════════════╣'));

      const prod = status.production;
      console.log(`║ Daily Capacity: ${prod.totalDailyCapacity.toLocaleString().padEnd(8)} | Output: ${prod.currentDailyOutput.toLocaleString().padEnd(8)}       ║`);
      console.log(`║ Utilization: ${prod.capacityUtilization.padEnd(10)} | Lines: ${prod.totalProductionLines.toString().padEnd(15)}║`);

      if (prod.tps) {
        console.log(`║ Takt Time: ${prod.tps.taktTime.padEnd(8)} | OEE: ${prod.tps.oee.padEnd(8)} | FTQ: ${prod.tps.firstTimeQuality.padEnd(5)}║`);
        console.log(`║ Defect Rate: ${prod.tps.defectRate.padEnd(10)} | Kaizen: ${prod.tps.kaizenCount.toString().padEnd(5)} | Andons: ${prod.tps.andonsToday.toString().padEnd(3)} ║`);
      }

      console.log(chalk.cyan.bold('╠══════════════════════════════════════════════════════════════════╣'));
      console.log(chalk.cyan.bold('║                    RUVECTOR AI SYSTEM                            ║'));
      console.log(chalk.cyan.bold('╠══════════════════════════════════════════════════════════════════╣'));

      const orch = status.orchestrator.orchestrator;
      const learn = status.orchestrator.learning;
      console.log(`║ Active Agents: ${orch.activeAgents.padEnd(10)} | Total: ${orch.totalAgents.padEnd(15)}  ║`);
      console.log(`║ Utilization: ${orch.utilizationRate.padEnd(10)} | Queue: ${orch.queueSize.toString().padEnd(17)}  ║`);
      console.log(`║ Learning Models: ${learn.modelsActive.toString().padEnd(6)} | Patterns: ${learn.totalPatterns.toString().padEnd(6)} | Acc: ${learn.avgAccuracy.padEnd(4)} ║`);

      console.log(chalk.cyan.bold('╠══════════════════════════════════════════════════════════════════╣'));
      console.log(chalk.cyan.bold('║                      FINANCIALS                                  ║'));
      console.log(chalk.cyan.bold('╠══════════════════════════════════════════════════════════════════╣'));

      const fin = status.financials;
      console.log(`║ Revenue: ${fin.revenue.padEnd(15)} | Profit: ${fin.operatingProfit.padEnd(15)}  ║`);
      console.log(`║ Market Share: ${fin.marketShare.padEnd(48)}  ║`);

      console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════════════════════╝'));

      // Recent Events
      console.log(chalk.yellow('\n📋 Recent Events:'));
      for (const event of status.recentEvents.slice(-5)) {
        console.log(chalk.gray(`  [${event.time.slice(11, 19)}] ${event.type}: ${event.description.slice(0, 50)}`));
      }
    };

    // Update dashboard every second
    const dashboardInterval = setInterval(updateDashboard, 1000);

    // Handle Ctrl+C
    process.on('SIGINT', async () => {
      clearInterval(dashboardInterval);
      await engine.stop();
      console.log(chalk.yellow('\n\nSimulation stopped. Goodbye! 👋'));
      process.exit(0);
    });
  });

// ============================================================================
// INFO COMMAND
// ============================================================================

program
  .command('info')
  .description('Display information about the simulation')
  .action(() => {
    console.log(LOGO);
    console.log(`
${chalk.cyan.bold('Toyota Motor Corporation Simulation')}
${chalk.gray('Version 1.0.0')}

This self-learning agent simulation models the complete operations of
Toyota Motor Corporation, including:

${chalk.yellow('🏢 Organization')}
  • ~370,000 employees across all departments
  • Global locations including Japan, USA, Europe, and Asia
  • Complete organizational hierarchy from executives to workers

${chalk.yellow('🏭 Manufacturing')}
  • 19+ production lines across 15 global plants
  • Toyota Production System (TPS) implementation
  • Just-In-Time (JIT) production
  • Jidoka (automation with human touch)
  • Kaizen (continuous improvement)

${chalk.yellow('📦 Supply Chain')}
  • 12 Keiretsu core suppliers
  • 40+ Tier 1 global suppliers
  • 500+ Tier 2 and Tier 3 suppliers
  • Real-time inventory management

${chalk.yellow('🤖 AI Agent System')}
  • Self-learning agents with memory
  • Swarm optimization
  • Collective intelligence
  • Pattern recognition and adaptation

${chalk.cyan('Usage:')}
  npx ruvector simulate     - Run batch simulation
  npx ruvector interactive  - Interactive mode
  npx ruvector dashboard    - Real-time dashboard
    `);
  });

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function printFinalReport(status: any): void {
  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║              TOYOTA SIMULATION - FINAL REPORT                  ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════════╝\n'));

  const data = [
    [chalk.cyan('Metric'), chalk.cyan('Value')],
    ['Simulation Duration', status.simulation.elapsedTime],
    ['Total Ticks', status.simulation.currentTick.toString()],
    ['Total Employees', status.organization.totalEmployees],
    ['Total Suppliers', status.organization.totalSuppliers],
    ['Vehicles Produced (YTD)', status.production?.currentDailyOutput?.toLocaleString() || '0'],
    ['Quality Score', status.quality?.firstTimeThrough || 'N/A'],
    ['Market Share', status.financials.marketShare],
    ['Revenue', status.financials.revenue],
  ];

  console.log(table(data));
}

function printStatus(status: any): void {
  console.log(chalk.cyan('\n📊 Simulation Status:\n'));
  console.log(`  Status: ${chalk.green(status.simulation.status)}`);
  console.log(`  Current Tick: ${status.simulation.currentTick}`);
  console.log(`  Simulation Day: ${status.simulation.simulationDay}`);
  console.log(`  Elapsed Time: ${status.simulation.elapsedTime}`);
  console.log(`  Employees: ${status.organization.totalEmployees}`);
  console.log(`  Suppliers: ${status.organization.totalSuppliers}`);
}

function printAgentSummary(engine: ToyotaSimulationEngine): void {
  const status = engine.getSimulationStatus() as any;
  const orch = status.orchestrator;

  console.log(chalk.cyan('\n👥 Agent Summary:\n'));
  console.log(`  Total Agents: ${orch.orchestrator.totalAgents}`);
  console.log(`  Active Agents: ${orch.orchestrator.activeAgents}`);
  console.log(`  Utilization: ${orch.orchestrator.utilizationRate}`);
  console.log(`  Learning Models: ${orch.learning.modelsActive}`);
  console.log(`  Total Patterns: ${orch.learning.totalPatterns}`);
  console.log(`  Avg Accuracy: ${orch.learning.avgAccuracy}`);
}

function printSupplierSummary(engine: ToyotaSimulationEngine): void {
  const status = engine.getSimulationStatus() as any;
  const supply = status.supplyChain;

  console.log(chalk.cyan('\n📦 Supplier Summary:\n'));
  console.log(`  Total Suppliers: ${supply.totalSuppliers}`);
  console.log(`  Tier 1: ${supply.tier1Count}`);
  console.log(`  Tier 2: ${supply.tier2Count}`);
  console.log(`  Tier 3: ${supply.tier3Count}`);
  console.log(`  Keiretsu Partners: ${supply.keiretsuCount}`);
  console.log(`  Avg Quality Score: ${supply.avgQualityScore}`);
  console.log(`  Avg Delivery Score: ${supply.avgDeliveryScore}`);
}

function printProductionSummary(engine: ToyotaSimulationEngine): void {
  const status = engine.getSimulationStatus() as any;
  const prod = status.production;

  console.log(chalk.cyan('\n🏭 Production Summary:\n'));
  console.log(`  Production Lines: ${prod.totalProductionLines}`);
  console.log(`  Daily Capacity: ${prod.totalDailyCapacity.toLocaleString()}`);
  console.log(`  Current Output: ${prod.currentDailyOutput.toLocaleString()}`);
  console.log(`  Utilization: ${prod.capacityUtilization}`);

  if (prod.tps) {
    console.log(chalk.gray('\n  TPS Metrics:'));
    console.log(`    Takt Time: ${prod.tps.taktTime}`);
    console.log(`    OEE: ${prod.tps.oee}`);
    console.log(`    First Time Quality: ${prod.tps.firstTimeQuality}`);
    console.log(`    Defect Rate: ${prod.tps.defectRate}`);
    console.log(`    Kaizen Count: ${prod.tps.kaizenCount}`);
  }
}

// Parse and execute
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  console.log(LOGO);
  program.outputHelp();
}

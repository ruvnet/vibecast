/**
 * Report Generator
 * Creates comprehensive reports from simulation data and agent analyses
 */

const fs = require('fs').promises;
const path = require('path');

class ReportGenerator {
  constructor(config = {}) {
    this.plantId = config.plantId || 'NPP-01';
    this.reportsDir = path.join(process.cwd(), 'reports');
  }

  /**
   * Generate comprehensive simulation report
   */
  async generateSimulationReport(data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportId = `${this.plantId}-${timestamp}`;

    // Generate different report formats
    await Promise.all([
      this.generateJSONReport(reportId, data),
      this.generateMarkdownReport(reportId, data),
      this.generateCSVMetrics(reportId, data),
      this.generateAgentAnalysisReport(reportId, data)
    ]);

    return reportId;
  }

  /**
   * Generate JSON report
   */
  async generateJSONReport(reportId, data) {
    const reportPath = path.join(this.reportsDir, 'federated', `${reportId}.json`);

    const report = {
      reportId,
      plantId: this.plantId,
      timestamp: new Date().toISOString(),
      summary: data.summary,
      simulationData: data.simulationData,
      agentAnalyses: data.agentAnalyses,
      agentResults: data.agentResults
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`  ✓ JSON report: ${reportPath}`);
  }

  /**
   * Generate Markdown report
   */
  async generateMarkdownReport(reportId, data) {
    const reportPath = path.join(this.reportsDir, 'federated', `${reportId}.md`);
    const summary = data.summary;

    let markdown = `# Nuclear Power Plant Simulation Report\n\n`;
    markdown += `**Plant ID:** ${this.plantId}  \n`;
    markdown += `**Report ID:** ${reportId}  \n`;
    markdown += `**Generated:** ${new Date().toISOString()}  \n`;
    markdown += `**Iterations:** ${summary.totalIterations}  \n\n`;

    markdown += `## Executive Summary\n\n`;
    markdown += `**Overall Plant Health:** ${summary.finalPlantHealth.toFixed(2)}%\n\n`;

    // Reactor Performance
    markdown += `### Reactor Performance\n\n`;
    markdown += `- **Final Status:** ${summary.reactor.finalStatus}\n`;
    markdown += `- **Average Power Output:** ${summary.reactor.avgPowerOutput.toFixed(2)} MW\n`;
    markdown += `- **SCRAM Events:** ${summary.reactor.scramEvents}\n\n`;

    // Business Performance
    markdown += `### Business Performance\n\n`;
    markdown += `- **Total Revenue:** $${(summary.business.totalRevenue / 1000000).toFixed(2)}M\n`;
    markdown += `- **Total Costs:** $${(summary.business.totalCosts / 1000000).toFixed(2)}M\n`;
    markdown += `- **Net Profit:** $${(summary.business.netProfit / 1000000).toFixed(2)}M\n`;
    markdown += `- **Avg Capacity Factor:** ${(summary.business.avgCapacityFactor * 100).toFixed(2)}%\n\n`;

    // HR Status
    markdown += `### Human Resources\n\n`;
    markdown += `- **Staffing Level:** ${summary.hr.finalStaffing.toFixed(1)}%\n`;
    markdown += `- **Training Compliance:** ${summary.hr.trainingCompliance.toFixed(1)}%\n\n`;

    // Supply Chain
    markdown += `### Supply Chain\n\n`;
    markdown += `- **Fuel Inventory:** ${summary.supplyChain.finalFuelInventory.toFixed(2)} tons\n`;
    markdown += `- **High-Level Waste:** ${summary.supplyChain.wasteGenerated.toFixed(2)} m³\n\n`;

    // Agent Analyses
    markdown += `## Federated Agent Analysis\n\n`;
    if (data.agentAnalyses && data.agentAnalyses.length > 0) {
      data.agentAnalyses.forEach(analysis => {
        markdown += `### Agent ${analysis.agentId} (${analysis.role})\n\n`;

        if (analysis.findings) {
          analysis.findings.forEach(finding => {
            if (finding.type === 'llm-analysis') {
              markdown += `**AI Analysis:**\n${finding.content}\n\n`;
            } else if (finding.severity) {
              markdown += `**${finding.type}** (${finding.severity}): ${finding.message}\n`;
              if (finding.recommendation) {
                markdown += `  - *Recommendation:* ${finding.recommendation}\n`;
              }
              markdown += `\n`;
            }
          });
        }
      });
    }

    // Detailed Metrics
    markdown += `## Detailed Metrics\n\n`;
    markdown += `See accompanying CSV files for time-series data.\n\n`;

    await fs.writeFile(reportPath, markdown);
    console.log(`  ✓ Markdown report: ${reportPath}`);
  }

  /**
   * Generate CSV metrics file
   */
  async generateCSVMetrics(reportId, data) {
    const metricsPath = path.join(this.reportsDir, 'federated', `${reportId}-metrics.csv`);

    let csv = 'Iteration,Timestamp,PlantHealth,ReactorStatus,PowerOutput,Temperature,Pressure,';
    csv += 'FuelInventory,WasteStorage,StaffingLevel,Revenue,Profit,CapacityFactor\n';

    data.simulationData.forEach(step => {
      csv += `${step.iteration},`;
      csv += `${step.timestamp},`;
      csv += `${step.plantHealth.toFixed(2)},`;
      csv += `${step.reactor.status},`;
      csv += `${step.reactor.powerOutput.toFixed(2)},`;
      csv += `${step.reactor.coreTemperature.toFixed(2)},`;
      csv += `${step.reactor.pressure.toFixed(2)},`;
      csv += `${step.supplyChain.inventory.nuclearFuel.quantity.toFixed(2)},`;
      csv += `${step.supplyChain.inventory.wasteStorage.highLevel.toFixed(2)},`;
      csv += `${step.hr.metrics.staffingLevel.toFixed(2)},`;
      csv += `${step.business.financials.revenue.toFixed(2)},`;
      csv += `${step.business.financials.profit.toFixed(2)},`;
      csv += `${step.business.performance.capacityFactor.toFixed(4)}\n`;
    });

    await fs.writeFile(metricsPath, csv);
    console.log(`  ✓ CSV metrics: ${metricsPath}`);
  }

  /**
   * Generate agent analysis report
   */
  async generateAgentAnalysisReport(reportId, data) {
    const reportPath = path.join(this.reportsDir, 'federated', `${reportId}-agents.json`);

    const agentReport = {
      reportId,
      timestamp: new Date().toISOString(),
      agents: data.agentResults || [],
      latestAnalyses: data.agentAnalyses || []
    };

    await fs.writeFile(reportPath, JSON.stringify(agentReport, null, 2));
    console.log(`  ✓ Agent analysis: ${reportPath}`);
  }

  /**
   * Generate individual domain reports
   */
  async generateDomainReports(data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    await Promise.all([
      this.generateReactorReport(timestamp, data),
      this.generateSupplyChainReport(timestamp, data),
      this.generateHRReport(timestamp, data),
      this.generateBusinessReport(timestamp, data)
    ]);
  }

  /**
   * Generate reactor-specific report
   */
  async generateReactorReport(timestamp, data) {
    const reportPath = path.join(this.reportsDir, 'ics', `reactor-${timestamp}.json`);

    const reactorData = data.simulationData.map(step => ({
      iteration: step.iteration,
      timestamp: step.timestamp,
      ...step.reactor
    }));

    await fs.writeFile(reportPath, JSON.stringify(reactorData, null, 2));
  }

  /**
   * Generate supply chain report
   */
  async generateSupplyChainReport(timestamp, data) {
    const reportPath = path.join(this.reportsDir, 'supply-chain', `logistics-${timestamp}.json`);

    const scData = data.simulationData.map(step => ({
      iteration: step.iteration,
      timestamp: step.timestamp,
      ...step.supplyChain
    }));

    await fs.writeFile(reportPath, JSON.stringify(scData, null, 2));
  }

  /**
   * Generate HR report
   */
  async generateHRReport(timestamp, data) {
    const reportPath = path.join(this.reportsDir, 'hr', `workforce-${timestamp}.json`);

    const hrData = data.simulationData.map(step => ({
      iteration: step.iteration,
      timestamp: step.timestamp,
      ...step.hr
    }));

    await fs.writeFile(reportPath, JSON.stringify(hrData, null, 2));
  }

  /**
   * Generate business report
   */
  async generateBusinessReport(timestamp, data) {
    const reportPath = path.join(this.reportsDir, 'business', `operations-${timestamp}.json`);

    const businessData = data.simulationData.map(step => ({
      iteration: step.iteration,
      timestamp: step.timestamp,
      ...step.business
    }));

    await fs.writeFile(reportPath, JSON.stringify(businessData, null, 2));
  }
}

module.exports = ReportGenerator;

/**
 * Business Operations Simulation
 * Manages financial operations, regulatory compliance, power generation contracts,
 * and overall business performance
 */

const { RuvectorClient } = require('ruvector');

class BusinessOperations {
  constructor(config = {}) {
    this.plantId = config.plantId || 'NPP-01';
    this.ruvector = new RuvectorClient();

    // Financial tracking
    this.financials = {
      revenue: 0,
      operatingCosts: 0,
      capitalExpenditures: 0,
      profit: 0,
      cashReserves: 500000000, // $500M starting capital
      electricityPrice: 0.08, // $ per kWh
      contractedCapacity: 1000 // MW
    };

    // Power purchase agreements
    this.powerContracts = [
      {
        id: 'PPA-001',
        customer: 'State Grid Authority',
        capacity: 600, // MW
        price: 0.085, // $ per kWh
        startDate: Date.now() - 365 * 24 * 60 * 60 * 1000,
        endDate: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
        penalties: {
          underdelivery: 0.15, // $ per kWh
          maxDowntime: 30 // days per year
        }
      },
      {
        id: 'PPA-002',
        customer: 'Industrial Consortium',
        capacity: 300,
        price: 0.09,
        startDate: Date.now() - 180 * 24 * 60 * 60 * 1000,
        endDate: Date.now() + 5 * 365 * 24 * 60 * 60 * 1000,
        penalties: {
          underdelivery: 0.12,
          maxDowntime: 15
        }
      },
      {
        id: 'PPA-003',
        customer: 'Regional Municipality',
        capacity: 100,
        price: 0.075,
        startDate: Date.now() - 90 * 24 * 60 * 60 * 1000,
        endDate: Date.now() + 3 * 365 * 24 * 60 * 60 * 1000,
        penalties: {
          underdelivery: 0.10,
          maxDowntime: 20
        }
      }
    ];

    // Regulatory compliance
    this.compliance = {
      nrcLicense: {
        status: 'VALID',
        expirationDate: Date.now() + 20 * 365 * 24 * 60 * 60 * 1000,
        lastInspection: Date.now() - 90 * 24 * 60 * 60 * 1000,
        nextInspection: Date.now() + 90 * 24 * 60 * 60 * 1000
      },
      environmentalPermits: {
        airQuality: 'COMPLIANT',
        waterDischarge: 'COMPLIANT',
        radiationLimits: 'COMPLIANT'
      },
      safetyRecords: {
        lastIncident: Date.now() - 730 * 24 * 60 * 60 * 1000,
        incidentCount: 0,
        violationCount: 0
      }
    };

    // Performance tracking
    this.performance = {
      capacityFactor: 0.9, // percent
      availabilityFactor: 0.95,
      forcedOutageRate: 0.02,
      plannedOutageRate: 0.03,
      downtimeDays: 0
    };

    // Operating costs breakdown
    this.costStructure = {
      fuel: 0.01, // $ per kWh
      operations: 0.015,
      maintenance: 0.01,
      labor: 0.012,
      regulatory: 0.003,
      insurance: 0.005,
      waste: 0.002
    };
  }

  /**
   * Simulate business operations
   */
  async simulate(timestep = 1000, reactorState = {}) {
    const powerOutput = reactorState.powerOutput || 1000; // MW
    const status = reactorState.status || 'OPERATIONAL';

    // Calculate revenue from power generation
    this.calculateRevenue(timestep, powerOutput, status);

    // Calculate operating costs
    this.calculateOperatingCosts(timestep, powerOutput);

    // Update performance metrics
    this.updatePerformanceMetrics(status, timestep);

    // Check contract compliance
    this.checkContractCompliance();

    // Update regulatory status
    this.updateRegulatoryCompliance();

    // Calculate profit
    this.calculateProfit();

    // Store business metrics
    await this.storeMetrics();

    return this.getStatus();
  }

  /**
   * Calculate revenue from power generation
   */
  calculateRevenue(timestep, powerOutput, status) {
    if (status !== 'OPERATIONAL') {
      this.performance.downtimeDays += timestep / (24 * 60 * 60 * 1000);
      return;
    }

    const timeInHours = timestep / (60 * 60 * 1000);
    const energyGenerated = powerOutput * timeInHours; // MWh
    const energyInKWh = energyGenerated * 1000; // kWh

    let revenue = 0;
    this.powerContracts.forEach(contract => {
      const contractShare = contract.capacity / this.financials.contractedCapacity;
      const contractEnergy = energyInKWh * contractShare;
      revenue += contractEnergy * contract.price;
    });

    this.financials.revenue += revenue;
    this.financials.cashReserves += revenue;
  }

  /**
   * Calculate operating costs
   */
  calculateOperatingCosts(timestep, powerOutput) {
    const timeInHours = timestep / (60 * 60 * 1000);
    const energyGenerated = powerOutput * timeInHours * 1000; // kWh

    let totalCosts = 0;
    Object.values(this.costStructure).forEach(costPerKWh => {
      totalCosts += energyGenerated * costPerKWh;
    });

    this.financials.operatingCosts += totalCosts;
    this.financials.cashReserves -= totalCosts;
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(status, timestep) {
    const timeInHours = timestep / (60 * 60 * 1000);

    if (status === 'OPERATIONAL') {
      this.performance.capacityFactor =
        (this.performance.capacityFactor * 0.99) + (0.9 * 0.01);
      this.performance.availabilityFactor =
        (this.performance.availabilityFactor * 0.99) + (0.95 * 0.01);
    } else {
      this.performance.capacityFactor *= 0.98;
      this.performance.availabilityFactor *= 0.98;

      if (status === 'SCRAM') {
        this.performance.forcedOutageRate += 0.001;
      }
    }
  }

  /**
   * Check power purchase agreement compliance
   */
  checkContractCompliance() {
    const yearInMs = 365 * 24 * 60 * 60 * 1000;

    this.powerContracts.forEach(contract => {
      if (this.performance.downtimeDays > contract.penalties.maxDowntime) {
        const excessDowntime = this.performance.downtimeDays - contract.penalties.maxDowntime;
        const penalty = excessDowntime * 24 * contract.capacity * 1000 * contract.penalties.underdelivery;

        this.financials.operatingCosts += penalty;
        this.financials.cashReserves -= penalty;
      }
    });
  }

  /**
   * Update regulatory compliance status
   */
  updateRegulatoryCompliance() {
    const now = Date.now();

    // Check license expiration
    if (this.compliance.nrcLicense.expirationDate - now < 365 * 24 * 60 * 60 * 1000) {
      this.compliance.nrcLicense.status = 'RENEWAL-REQUIRED';
    }

    // Schedule inspections
    if (now > this.compliance.nrcLicense.nextInspection) {
      this.compliance.nrcLicense.lastInspection = now;
      this.compliance.nrcLicense.nextInspection = now + 90 * 24 * 60 * 60 * 1000;

      // Inspection costs
      const inspectionCost = 100000;
      this.financials.operatingCosts += inspectionCost;
      this.financials.cashReserves -= inspectionCost;
    }
  }

  /**
   * Calculate profit
   */
  calculateProfit() {
    this.financials.profit = this.financials.revenue -
                            this.financials.operatingCosts -
                            this.financials.capitalExpenditures;
  }

  /**
   * Store business metrics
   */
  async storeMetrics() {
    const vector = [
      this.financials.cashReserves / 1000000000,
      this.financials.profit / 100000000,
      this.performance.capacityFactor,
      this.performance.availabilityFactor,
      1 - this.performance.forcedOutageRate,
      this.compliance.safetyRecords.violationCount === 0 ? 1 : 0
    ];

    try {
      await this.ruvector.upsert({
        collection: 'business-metrics',
        id: `${this.plantId}-${Date.now()}`,
        vector: vector,
        metadata: {
          plantId: this.plantId,
          financials: this.financials,
          performance: this.performance,
          compliance: this.compliance,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Error storing business metrics:', error.message);
    }
  }

  /**
   * Get current business status
   */
  getStatus() {
    return {
      plantId: this.plantId,
      financials: {
        revenue: this.financials.revenue,
        costs: this.financials.operatingCosts,
        profit: this.financials.profit,
        cashReserves: this.financials.cashReserves
      },
      performance: this.performance,
      compliance: this.compliance,
      contracts: this.powerContracts.length,
      timestamp: Date.now()
    };
  }

  /**
   * Generate financial report
   */
  generateFinancialReport() {
    return {
      period: 'Current',
      revenue: this.financials.revenue,
      operatingCosts: this.financials.operatingCosts,
      capitalExpenditures: this.financials.capitalExpenditures,
      profit: this.financials.profit,
      profitMargin: (this.financials.profit / this.financials.revenue) * 100,
      cashReserves: this.financials.cashReserves,
      contracts: this.powerContracts,
      performance: this.performance
    };
  }
}

module.exports = BusinessOperations;

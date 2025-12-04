/**
 * Simulation Configuration
 */

module.exports = {
  // Plant configuration
  plant: {
    id: 'NPP-VIBECAST-01',
    name: 'Vibecast Next-Gen Nuclear Power Plant',
    location: 'Simulation Environment',
    capacity: 1200, // MW
    reactorType: 'PWR' // Pressurized Water Reactor
  },

  // Simulation parameters
  simulation: {
    timestep: 1000, // milliseconds (1 second)
    duration: 120000, // milliseconds (2 minutes for testing)
    realTimeFactor: 1, // 1 = real-time, >1 = accelerated

    // For longer simulations
    extended: {
      duration: 3600000, // 1 hour
      timestep: 5000 // 5 seconds
    }
  },

  // Federated agents configuration
  agents: {
    count: 5,
    roles: [
      'reactor-safety',
      'supply-chain',
      'workforce',
      'financial',
      'general'
    ],
    analysisInterval: 20, // Run analysis every N iterations
    e2bTimeout: 300000 // 5 minutes
  },

  // Reactor control system
  reactor: {
    initialTemperature: 300, // Celsius
    initialPressure: 155, // bar
    initialPowerOutput: 1000, // MW
    controlRodPosition: 50, // percent

    limits: {
      maxTemperature: 350,
      maxPressure: 175,
      maxPowerOutput: 1200
    },

    safetyThresholds: {
      scramTemperature: 345,
      scramPressure: 170,
      emergencyCoolingTemp: 335
    }
  },

  // Supply chain
  supplyChain: {
    initialFuel: 100, // tons
    fuelEnrichment: 4.5, // percent
    fuelCostPerTon: 1500000, // USD

    reorderPoints: {
      fuel: 30, // tons
      pumps: 2,
      valves: 10
    },

    wasteCapacity: {
      lowLevel: 200, // cubic meters
      intermediate: 50,
      highLevel: 30
    }
  },

  // Human resources
  hr: {
    totalPersonnel: 65,
    shiftDuration: 12, // hours
    shiftRotation: ['A', 'B', 'C', 'D'],

    trainingFrequency: {
      reactorOps: 12, // months
      emergencyResponse: 6,
      radiationSafety: 12,
      security: 6
    },

    certificationValidity: {
      reactorOperator: 24, // months
      seniorReactorOperator: 24,
      engineer: 36
    }
  },

  // Business operations
  business: {
    electricityPrice: 0.08, // USD per kWh
    contractedCapacity: 1000, // MW

    costStructure: {
      fuel: 0.01, // USD per kWh
      operations: 0.015,
      maintenance: 0.01,
      labor: 0.012,
      regulatory: 0.003,
      insurance: 0.005,
      waste: 0.002
    },

    targetMetrics: {
      capacityFactor: 0.92,
      availabilityFactor: 0.95,
      maxForcedOutageRate: 0.02,
      profitMargin: 0.30
    }
  },

  // Reporting
  reporting: {
    outputDir: './reports',
    formats: ['json', 'markdown', 'csv'],

    subdirectories: {
      federated: 'federated',
      ics: 'ics',
      supplyChain: 'supply-chain',
      hr: 'hr',
      business: 'business'
    }
  },

  // Vector database (ruvector)
  ruvector: {
    collections: {
      reactorTelemetry: 'reactor-telemetry',
      supplyChainMetrics: 'supply-chain-metrics',
      hrMetrics: 'hr-metrics',
      businessMetrics: 'business-metrics'
    },

    vectorDimensions: 6 // Standardized vector size
  },

  // RuvLLM configuration
  ruvllm: {
    model: 'claude-3-sonnet',
    simd: true, // Enable SIMD optimizations
    maxTokens: 2000,
    temperature: 0.7,

    analysisPrompts: {
      safetyFocus: true,
      detailLevel: 'high',
      includeRecommendations: true
    }
  }
};

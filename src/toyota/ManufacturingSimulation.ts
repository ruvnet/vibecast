/**
 * Toyota Production System (TPS) Simulation
 * Complete manufacturing simulation with Just-In-Time, Jidoka, Kaizen
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import {
  ProductionLine,
  ProductionStatus,
  VehicleModel,
  Equipment,
  Task,
  ComponentCategory,
  SimulationEvent,
} from '../types';
import { ToyotaAgent } from '../core/Agent';
import { SupplyChainSimulator } from './SupplyChain';

// ============================================================================
// TOYOTA PRODUCTION SYSTEM PRINCIPLES
// ============================================================================

export interface TPSMetrics {
  taktTime: number; // seconds per vehicle
  cycleTime: number;
  leadTime: number;
  oee: number; // Overall Equipment Effectiveness
  firstTimeQuality: number;
  inventoryTurns: number;
  defectRate: number; // PPM
  kaizenImprovements: number;
  andonsTriggered: number;
  setupTime: number;
}

export interface ProductionShift {
  id: string;
  name: string;
  startTime: number; // hours (0-24)
  endTime: number;
  workers: ToyotaAgent[];
  targetOutput: number;
  actualOutput: number;
  quality: number;
}

// ============================================================================
// MANUFACTURING EVENTS
// ============================================================================

export interface ManufacturingEvents {
  'vehicle:produced': (model: string, quality: number) => void;
  'line:started': (lineId: string) => void;
  'line:stopped': (lineId: string, reason: string) => void;
  'andon:triggered': (lineId: string, issue: string) => void;
  'jidoka:activated': (lineId: string, defect: string) => void;
  'kaizen:implemented': (improvement: string, impact: number) => void;
  'shift:completed': (shift: ProductionShift) => void;
  'milestone:reached': (description: string) => void;
}

// ============================================================================
// PRODUCTION LINE SIMULATOR
// ============================================================================

export class ProductionLineSimulator extends EventEmitter<ManufacturingEvents> {
  private productionLines: Map<string, ProductionLine> = new Map();
  private dailyOutput: Map<string, number> = new Map();
  private shifts: ProductionShift[] = [];
  private tpsMetrics: TPSMetrics;
  private supplyChain: SupplyChainSimulator;
  private isRunning: boolean = false;
  private kaizenLog: Array<{ timestamp: Date; description: string; impact: number }> = [];
  private andonsActive: Map<string, string> = new Map();

  constructor(supplyChain: SupplyChainSimulator) {
    super();
    this.supplyChain = supplyChain;
    this.tpsMetrics = this.initializeTPSMetrics();
  }

  private initializeTPSMetrics(): TPSMetrics {
    return {
      taktTime: 57, // Toyota's famous 57-second takt time
      cycleTime: 55,
      leadTime: 18, // hours from raw material to finished vehicle
      oee: 85,
      firstTimeQuality: 97.5,
      inventoryTurns: 12,
      defectRate: 15, // PPM
      kaizenImprovements: 0,
      andonsTriggered: 0,
      setupTime: 10, // minutes for line changeover
    };
  }

  // ============================================================================
  // PRODUCTION LINE SETUP
  // ============================================================================

  async initializeProductionLines(
    models: VehicleModel[],
    workers: ToyotaAgent[]
  ): Promise<ProductionLine[]> {
    console.log('Initializing Toyota Production Lines...');

    // Create production lines based on Toyota's actual plant structure
    const lineConfigs = [
      // Japan Plants
      { id: 'motomachi-1', name: 'Motomachi Line 1', location: 'motomachi-plant', capacity: 800, models: ['Crown', 'Mirai'] },
      { id: 'motomachi-2', name: 'Motomachi Line 2', location: 'motomachi-plant', capacity: 700, models: ['GR86', 'GR Supra'] },
      { id: 'tsutsumi-1', name: 'Tsutsumi Line 1', location: 'tsutsumi-plant', capacity: 1200, models: ['Prius', 'Prius Prime'] },
      { id: 'tsutsumi-2', name: 'Tsutsumi Line 2', location: 'tsutsumi-plant', capacity: 900, models: ['Camry'] },
      { id: 'takaoka-1', name: 'Takaoka Line 1', location: 'takaoka-plant', capacity: 1100, models: ['Corolla', 'Corolla Cross'] },
      { id: 'takaoka-2', name: 'Takaoka Line 2', location: 'takaoka-plant', capacity: 900, models: ['RAV4'] },
      { id: 'tahara-1', name: 'Tahara Line 1', location: 'tahara-plant', capacity: 600, models: ['Land Cruiser'] },
      { id: 'tahara-lexus', name: 'Tahara Lexus Line', location: 'tahara-plant', capacity: 500, models: ['Lexus LX', 'Lexus GX'] },

      // North America Plants
      { id: 'tmmk-1', name: 'TMMK Line 1', location: 'tmmk-kentucky', capacity: 1400, models: ['Camry', 'Avalon'] },
      { id: 'tmmk-2', name: 'TMMK Line 2', location: 'tmmk-kentucky', capacity: 800, models: ['ES'] },
      { id: 'tmmi-1', name: 'TMMI Line 1', location: 'tmmi-indiana', capacity: 1000, models: ['Highlander'] },
      { id: 'tmmi-2', name: 'TMMI Line 2', location: 'tmmi-indiana', capacity: 600, models: ['Sienna', 'Sequoia'] },
      { id: 'tmmtx-1', name: 'TMMTX Line 1', location: 'tmmtx-texas', capacity: 700, models: ['Tundra'] },

      // Europe Plants
      { id: 'tmuk-1', name: 'TMUK Line 1', location: 'tmuk-burnaston', capacity: 500, models: ['Corolla'] },
      { id: 'tmmf-1', name: 'TMMF Line 1', location: 'tmmf-france', capacity: 800, models: ['Yaris', 'Yaris Cross'] },

      // Asia Plants
      { id: 'tmth-1', name: 'TMT Line 1', location: 'tmc-thailand', capacity: 1500, models: ['Hilux', 'Fortuner'] },
      { id: 'tmth-2', name: 'TMT Line 2', location: 'tmc-thailand', capacity: 800, models: ['Corolla Cross'] },
      { id: 'tmmin-1', name: 'TMMIN Line 1', location: 'tki-indonesia', capacity: 700, models: ['Innova', 'Avanza'] },
    ];

    // Distribute workers across lines
    const workersPerLine = Math.floor(workers.length / lineConfigs.length);

    for (let i = 0; i < lineConfigs.length; i++) {
      const config = lineConfigs[i];
      const lineWorkers = workers.slice(i * workersPerLine, (i + 1) * workersPerLine);

      const productionLine: ProductionLine = {
        id: config.id,
        name: config.name,
        location: config.location,
        vehicleModels: config.models,
        capacity: config.capacity,
        currentOutput: 0,
        efficiency: 85 + Math.random() * 10,
        workers: lineWorkers.map(w => w.id),
        equipment: this.generateEquipment(config.id),
        status: 'running',
      };

      this.productionLines.set(config.id, productionLine);
      this.dailyOutput.set(config.id, 0);
    }

    // Initialize shifts
    this.initializeShifts(workers);

    console.log(`Initialized ${this.productionLines.size} production lines`);

    return Array.from(this.productionLines.values());
  }

  private generateEquipment(lineId: string): Equipment[] {
    const equipmentTypes = [
      'Welding Robot', 'Paint Robot', 'Assembly Robot', 'Press Machine',
      'Conveyor System', 'AGV System', 'Quality Scanner', 'Torque Tool',
      'Vision System', 'Seal Applicator', 'Glass Installation Robot', 'Tire Mounter'
    ];

    return equipmentTypes.map((type, idx) => ({
      id: `${lineId}-equip-${idx}`,
      name: `${type} ${idx + 1}`,
      type: type.toLowerCase().replace(' ', '_'),
      status: Math.random() > 0.05 ? 'running' : 'maintenance',
      efficiency: 85 + Math.random() * 15,
      lastMaintenance: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    }));
  }

  private initializeShifts(workers: ToyotaAgent[]): void {
    const shiftConfigs = [
      { name: 'Day Shift A', start: 6, end: 14 },
      { name: 'Day Shift B', start: 14, end: 22 },
      { name: 'Night Shift', start: 22, end: 6 },
    ];

    const workersPerShift = Math.floor(workers.length / 3);

    for (let i = 0; i < shiftConfigs.length; i++) {
      const config = shiftConfigs[i];
      this.shifts.push({
        id: `shift-${i}`,
        name: config.name,
        startTime: config.start,
        endTime: config.end,
        workers: workers.slice(i * workersPerShift, (i + 1) * workersPerShift),
        targetOutput: 0,
        actualOutput: 0,
        quality: 97.5,
      });
    }
  }

  // ============================================================================
  // PRODUCTION EXECUTION
  // ============================================================================

  async startProduction(): Promise<void> {
    this.isRunning = true;

    for (const [lineId, line] of this.productionLines) {
      line.status = 'running';
      this.emit('line:started', lineId);
    }
  }

  async stopProduction(reason: string = 'Scheduled shutdown'): Promise<void> {
    this.isRunning = false;

    for (const [lineId, line] of this.productionLines) {
      line.status = 'stopped';
      this.emit('line:stopped', lineId, reason);
    }
  }

  async simulateProductionCycle(): Promise<Map<string, number>> {
    if (!this.isRunning) {
      await this.startProduction();
    }

    const cycleOutput: Map<string, number> = new Map();

    for (const [lineId, line] of this.productionLines) {
      if (line.status !== 'running') continue;

      // Check material availability (JIT)
      const materialsAvailable = await this.checkMaterialAvailability();
      if (!materialsAvailable) {
        this.triggerAndon(lineId, 'Material shortage');
        continue;
      }

      // Calculate output based on TPS principles
      const output = this.calculateLineOutput(line);

      // Quality check (Jidoka)
      const qualityPass = this.performQualityCheck(line, output);

      if (!qualityPass.passed) {
        this.activateJidoka(lineId, qualityPass.defect);
        continue;
      }

      // Record output
      line.currentOutput += output;
      cycleOutput.set(lineId, output);
      this.dailyOutput.set(lineId, (this.dailyOutput.get(lineId) || 0) + output);

      // Consume components
      this.consumeComponents(output);

      // Emit vehicle produced event
      for (const model of line.vehicleModels) {
        const modelOutput = Math.floor(output / line.vehicleModels.length);
        for (let i = 0; i < modelOutput; i++) {
          this.emit('vehicle:produced', model, qualityPass.quality);
        }
      }

      // Chance of kaizen improvement
      if (Math.random() < 0.02) {
        await this.generateKaizen(lineId);
      }
    }

    return cycleOutput;
  }

  private async checkMaterialAvailability(): Promise<boolean> {
    const criticalComponents: ComponentCategory[] = [
      'powertrain', 'body', 'electronics', 'chassis', 'interior'
    ];

    for (const component of criticalComponents) {
      const available = this.supplyChain.consumeComponents(component, 1);
      if (!available) {
        await this.supplyChain.processJITDelivery(component);
        return false;
      }
    }

    return true;
  }

  private calculateLineOutput(line: ProductionLine): number {
    // Output based on takt time and efficiency
    const theoreticalOutput = 3600 / this.tpsMetrics.taktTime; // vehicles per hour
    const actualEfficiency = (line.efficiency / 100) * (this.tpsMetrics.oee / 100);

    // Account for equipment status
    const runningEquipment = line.equipment.filter(e => e.status === 'running').length;
    const equipmentFactor = runningEquipment / line.equipment.length;

    // Account for andon stoppages
    const andonFactor = this.andonsActive.has(line.id) ? 0.5 : 1;

    return Math.floor(theoreticalOutput * actualEfficiency * equipmentFactor * andonFactor);
  }

  private performQualityCheck(
    line: ProductionLine,
    output: number
  ): { passed: boolean; quality: number; defect: string } {
    const defectProbability = this.tpsMetrics.defectRate / 1000000;
    const hasDefect = Math.random() < defectProbability * output;

    if (hasDefect) {
      const defects = [
        'Paint defect', 'Weld quality issue', 'Gap/flush issue',
        'Electrical fault', 'Trim misalignment', 'Torque spec deviation'
      ];
      return {
        passed: false,
        quality: 85 + Math.random() * 10,
        defect: defects[Math.floor(Math.random() * defects.length)],
      };
    }

    return {
      passed: true,
      quality: this.tpsMetrics.firstTimeQuality + (Math.random() - 0.5) * 2,
      defect: '',
    };
  }

  private consumeComponents(vehicles: number): void {
    const componentsPerVehicle: ComponentCategory[] = [
      'powertrain', 'chassis', 'body', 'interior', 'electronics',
      'safety_systems', 'hvac', 'lighting', 'wheels_tires'
    ];

    for (const component of componentsPerVehicle) {
      this.supplyChain.consumeComponents(component, vehicles);
    }
  }

  // ============================================================================
  // ANDON & JIDOKA
  // ============================================================================

  triggerAndon(lineId: string, issue: string): void {
    this.andonsActive.set(lineId, issue);
    this.tpsMetrics.andonsTriggered++;

    const line = this.productionLines.get(lineId);
    if (line) {
      line.status = 'quality_hold';
    }

    this.emit('andon:triggered', lineId, issue);

    // Auto-resolve after delay (simulating team response)
    setTimeout(() => this.resolveAndon(lineId), 5000);
  }

  resolveAndon(lineId: string): void {
    this.andonsActive.delete(lineId);
    const line = this.productionLines.get(lineId);
    if (line) {
      line.status = 'running';
    }
  }

  private activateJidoka(lineId: string, defect: string): void {
    const line = this.productionLines.get(lineId);
    if (line) {
      line.status = 'quality_hold';
    }

    this.emit('jidoka:activated', lineId, defect);

    // Jidoka automatically stops the line to prevent defects from propagating
    this.triggerAndon(lineId, `Jidoka: ${defect}`);
  }

  // ============================================================================
  // KAIZEN (CONTINUOUS IMPROVEMENT)
  // ============================================================================

  private async generateKaizen(lineId: string): Promise<void> {
    const improvements = [
      { description: 'Reduced walking distance for tools', impact: 2 },
      { description: 'Optimized parts bin placement', impact: 3 },
      { description: 'Improved ergonomic positioning', impact: 1 },
      { description: 'Standardized work sequence update', impact: 4 },
      { description: 'Visual management enhancement', impact: 2 },
      { description: 'Poka-yoke device added', impact: 5 },
      { description: 'Setup time reduction', impact: 6 },
      { description: 'Quality checkpoint optimization', impact: 4 },
      { description: '5S workplace improvement', impact: 2 },
      { description: 'Kanban quantity adjustment', impact: 3 },
    ];

    const improvement = improvements[Math.floor(Math.random() * improvements.length)];

    this.kaizenLog.push({
      timestamp: new Date(),
      description: `${lineId}: ${improvement.description}`,
      impact: improvement.impact,
    });

    this.tpsMetrics.kaizenImprovements++;

    // Apply improvement
    const line = this.productionLines.get(lineId);
    if (line) {
      line.efficiency = Math.min(99, line.efficiency + improvement.impact * 0.1);
    }

    // Global improvements
    this.tpsMetrics.taktTime = Math.max(50, this.tpsMetrics.taktTime - improvement.impact * 0.1);
    this.tpsMetrics.defectRate = Math.max(5, this.tpsMetrics.defectRate - improvement.impact * 0.5);

    this.emit('kaizen:implemented', improvement.description, improvement.impact);
  }

  // ============================================================================
  // METRICS & REPORTING
  // ============================================================================

  getProductionMetrics(): object {
    const lines = Array.from(this.productionLines.values());
    const totalCapacity = lines.reduce((sum, l) => sum + l.capacity, 0);
    const totalOutput = Array.from(this.dailyOutput.values()).reduce((sum, o) => sum + o, 0);

    return {
      totalProductionLines: lines.length,
      totalDailyCapacity: totalCapacity,
      currentDailyOutput: totalOutput,
      capacityUtilization: ((totalOutput / totalCapacity) * 100).toFixed(1) + '%',
      tps: {
        taktTime: this.tpsMetrics.taktTime.toFixed(1) + 's',
        oee: this.tpsMetrics.oee.toFixed(1) + '%',
        firstTimeQuality: this.tpsMetrics.firstTimeQuality.toFixed(1) + '%',
        defectRate: this.tpsMetrics.defectRate.toFixed(1) + ' PPM',
        kaizenCount: this.tpsMetrics.kaizenImprovements,
        andonsToday: this.tpsMetrics.andonsTriggered,
      },
      lineStatus: Object.fromEntries(
        lines.map(l => [l.name, {
          status: l.status,
          efficiency: l.efficiency.toFixed(1) + '%',
          output: this.dailyOutput.get(l.id) || 0,
          models: l.vehicleModels.join(', '),
        }])
      ),
      recentKaizen: this.kaizenLog.slice(-5).map(k => k.description),
    };
  }

  getProductionLines(): ProductionLine[] {
    return Array.from(this.productionLines.values());
  }

  getDailyProduction(): Map<string, number> {
    return this.dailyOutput;
  }

  resetDailyCounters(): void {
    for (const lineId of this.dailyOutput.keys()) {
      this.dailyOutput.set(lineId, 0);
    }
    this.tpsMetrics.andonsTriggered = 0;
  }
}

// ============================================================================
// QUALITY MANAGEMENT SYSTEM
// ============================================================================

export class QualityManagementSystem {
  private defectLog: Array<{
    timestamp: Date;
    line: string;
    defectType: string;
    severity: number;
    resolved: boolean;
  }> = [];

  private qualityMetrics = {
    totalInspections: 0,
    totalDefects: 0,
    defectsByType: new Map<string, number>(),
    cpk: 1.67, // Process capability
    firstTimeThrough: 97.5,
  };

  recordInspection(passed: boolean, defectType?: string): void {
    this.qualityMetrics.totalInspections++;

    if (!passed && defectType) {
      this.qualityMetrics.totalDefects++;
      const current = this.qualityMetrics.defectsByType.get(defectType) || 0;
      this.qualityMetrics.defectsByType.set(defectType, current + 1);
    }

    // Update FTT
    this.qualityMetrics.firstTimeThrough =
      ((this.qualityMetrics.totalInspections - this.qualityMetrics.totalDefects) /
        this.qualityMetrics.totalInspections) * 100;
  }

  getQualityReport(): object {
    return {
      totalInspections: this.qualityMetrics.totalInspections,
      totalDefects: this.qualityMetrics.totalDefects,
      defectRate: ((this.qualityMetrics.totalDefects / this.qualityMetrics.totalInspections) * 1000000).toFixed(1) + ' PPM',
      firstTimeThrough: this.qualityMetrics.firstTimeThrough.toFixed(2) + '%',
      cpk: this.qualityMetrics.cpk.toFixed(2),
      topDefects: Array.from(this.qualityMetrics.defectsByType.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type, count]) => ({ type, count })),
    };
  }
}

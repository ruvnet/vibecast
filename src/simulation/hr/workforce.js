/**
 * Human Resources Management Simulation
 * Manages personnel, training, certifications, shifts, and safety compliance
 */

const { RuvectorClient } = require('ruvector');

class HumanResourcesManagement {
  constructor(config = {}) {
    this.plantId = config.plantId || 'NPP-01';
    this.ruvector = new RuvectorClient();

    // Personnel roster
    this.personnel = this.initializePersonnel();

    // Shift schedule
    this.shifts = {
      current: 'A',
      rotation: ['A', 'B', 'C', 'D'],
      shiftDuration: 12 * 60 * 60 * 1000, // 12 hours
      lastRotation: Date.now()
    };

    // Training programs
    this.trainingPrograms = [
      {
        id: 'TRAIN-001',
        name: 'Reactor Operations',
        duration: 160, // hours
        required: ['reactor-operator', 'senior-reactor-operator'],
        frequency: 12 // months
      },
      {
        id: 'TRAIN-002',
        name: 'Emergency Response',
        duration: 40,
        required: ['all'],
        frequency: 6
      },
      {
        id: 'TRAIN-003',
        name: 'Radiation Safety',
        duration: 24,
        required: ['all'],
        frequency: 12
      },
      {
        id: 'TRAIN-004',
        name: 'Security Protocols',
        duration: 16,
        required: ['security'],
        frequency: 6
      }
    ];

    // Performance metrics
    this.metrics = {
      safetyIncidents: 0,
      trainingCompliance: 100,
      certificationCompliance: 100,
      overtimeHours: 0,
      staffingLevel: 100
    };
  }

  /**
   * Initialize personnel database
   */
  initializePersonnel() {
    const roles = [
      { role: 'senior-reactor-operator', count: 4, certRequired: true },
      { role: 'reactor-operator', count: 8, certRequired: true },
      { role: 'mechanical-engineer', count: 6, certRequired: true },
      { role: 'electrical-engineer', count: 6, certRequired: true },
      { role: 'radiation-protection', count: 4, certRequired: true },
      { role: 'security', count: 12, certRequired: false },
      { role: 'maintenance-tech', count: 15, certRequired: false },
      { role: 'supervisor', count: 4, certRequired: true },
      { role: 'health-physics', count: 3, certRequired: true },
      { role: 'quality-assurance', count: 3, certRequired: true }
    ];

    const personnel = [];
    let employeeId = 1000;

    roles.forEach(roleConfig => {
      for (let i = 0; i < roleConfig.count; i++) {
        personnel.push({
          id: `EMP-${employeeId++}`,
          role: roleConfig.role,
          shift: this.shifts.rotation[i % 4],
          certifications: roleConfig.certRequired ? this.generateCertifications(roleConfig.role) : [],
          training: this.generateTrainingRecords(),
          performance: {
            rating: 4.0 + Math.random(),
            yearsExperience: Math.floor(Math.random() * 15) + 2,
            safetyRecord: 'EXCELLENT'
          },
          status: 'ACTIVE',
          hoursWorked: 0,
          lastTraining: Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000
        });
      }
    });

    return personnel;
  }

  /**
   * Generate certifications for personnel
   */
  generateCertifications(role) {
    const certifications = [];
    const baseDate = Date.now() - (Math.random() * 365 * 24 * 60 * 60 * 1000);

    if (role.includes('operator')) {
      certifications.push({
        type: 'NRC-Reactor-Operator',
        issueDate: baseDate,
        expirationDate: baseDate + (2 * 365 * 24 * 60 * 60 * 1000),
        status: 'VALID'
      });
    }

    if (role.includes('engineer')) {
      certifications.push({
        type: 'Professional-Engineer',
        issueDate: baseDate,
        expirationDate: baseDate + (3 * 365 * 24 * 60 * 60 * 1000),
        status: 'VALID'
      });
    }

    return certifications;
  }

  /**
   * Generate training records
   */
  generateTrainingRecords() {
    return this.trainingPrograms.map(program => ({
      programId: program.id,
      completed: true,
      completionDate: Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000,
      nextDue: Date.now() + (program.frequency * 30 * 24 * 60 * 60 * 1000)
    }));
  }

  /**
   * Simulate HR operations
   */
  async simulate(timestep = 1000) {
    // Rotate shifts if needed
    this.manageShiftRotation(timestep);

    // Track working hours
    this.trackWorkingHours(timestep);

    // Check certification expiration
    this.checkCertifications();

    // Check training compliance
    this.checkTrainingCompliance();

    // Calculate staffing levels
    this.calculateStaffingLevels();

    // Store HR metrics
    await this.storeMetrics();

    return this.getStatus();
  }

  /**
   * Manage shift rotation
   */
  manageShiftRotation(timestep) {
    const timeSinceRotation = Date.now() - this.shifts.lastRotation;

    if (timeSinceRotation >= this.shifts.shiftDuration) {
      const currentIndex = this.shifts.rotation.indexOf(this.shifts.current);
      const nextIndex = (currentIndex + 1) % this.shifts.rotation.length;
      this.shifts.current = this.shifts.rotation[nextIndex];
      this.shifts.lastRotation = Date.now();
    }
  }

  /**
   * Track employee working hours
   */
  trackWorkingHours(timestep) {
    const hoursWorked = timestep / (60 * 60 * 1000);

    this.personnel.forEach(employee => {
      if (employee.shift === this.shifts.current && employee.status === 'ACTIVE') {
        employee.hoursWorked += hoursWorked;

        // Track overtime (over 40 hours per week)
        if (employee.hoursWorked > 40) {
          this.metrics.overtimeHours += (employee.hoursWorked - 40);
        }
      }
    });
  }

  /**
   * Check certification status
   */
  checkCertifications() {
    const now = Date.now();
    let expiredCount = 0;
    let totalCerts = 0;

    this.personnel.forEach(employee => {
      employee.certifications.forEach(cert => {
        totalCerts++;
        if (cert.expirationDate < now) {
          cert.status = 'EXPIRED';
          expiredCount++;
          employee.status = 'TRAINING-REQUIRED';
        }
      });
    });

    this.metrics.certificationCompliance = totalCerts > 0
      ? ((totalCerts - expiredCount) / totalCerts) * 100
      : 100;
  }

  /**
   * Check training compliance
   */
  checkTrainingCompliance() {
    const now = Date.now();
    let overdueCount = 0;
    let totalTraining = 0;

    this.personnel.forEach(employee => {
      employee.training.forEach(training => {
        totalTraining++;
        if (training.nextDue < now) {
          overdueCount++;
          employee.status = 'TRAINING-REQUIRED';
        }
      });
    });

    this.metrics.trainingCompliance = totalTraining > 0
      ? ((totalTraining - overdueCount) / totalTraining) * 100
      : 100;
  }

  /**
   * Calculate staffing levels
   */
  calculateStaffingLevels() {
    const activePersonnel = this.personnel.filter(p => p.status === 'ACTIVE').length;
    const totalPersonnel = this.personnel.length;

    this.metrics.staffingLevel = (activePersonnel / totalPersonnel) * 100;
  }

  /**
   * Store HR metrics
   */
  async storeMetrics() {
    const vector = [
      this.metrics.staffingLevel / 100,
      this.metrics.trainingCompliance / 100,
      this.metrics.certificationCompliance / 100,
      1 - (this.metrics.safetyIncidents / 10),
      1 - (this.metrics.overtimeHours / 1000),
      this.personnel.filter(p => p.status === 'ACTIVE').length / 100
    ];

    try {
      await this.ruvector.upsert({
        collection: 'hr-metrics',
        id: `${this.plantId}-${Date.now()}`,
        vector: vector,
        metadata: {
          plantId: this.plantId,
          metrics: this.metrics,
          activeShift: this.shifts.current,
          totalPersonnel: this.personnel.length,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Error storing HR metrics:', error.message);
    }
  }

  /**
   * Get current HR status
   */
  getStatus() {
    return {
      plantId: this.plantId,
      metrics: this.metrics,
      currentShift: this.shifts.current,
      totalPersonnel: this.personnel.length,
      activePersonnel: this.personnel.filter(p => p.status === 'ACTIVE').length,
      personnelRequiringTraining: this.personnel.filter(p => p.status === 'TRAINING-REQUIRED').length,
      timestamp: Date.now()
    };
  }

  /**
   * Get personnel by role
   */
  getPersonnelByRole(role) {
    return this.personnel.filter(p => p.role === role);
  }

  /**
   * Get current shift personnel
   */
  getCurrentShiftPersonnel() {
    return this.personnel.filter(p =>
      p.shift === this.shifts.current && p.status === 'ACTIVE'
    );
  }
}

module.exports = HumanResourcesManagement;

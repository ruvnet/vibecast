/**
 * Sensor Manager for handling robot sensors
 */

import { SensorData } from '../types/index.js';
import { EventEmitter } from 'events';

export interface SensorConfig {
  id: string;
  type: string;
  updateRate: number; // Hz
  range?: { min: number; max: number };
}

export class SensorManager extends EventEmitter {
  private sensors: Map<string, SensorConfig>;
  private sensorData: Map<string, SensorData>;
  private updateIntervals: Map<string, NodeJS.Timeout>;
  private active: boolean;

  constructor() {
    super();
    this.sensors = new Map();
    this.sensorData = new Map();
    this.updateIntervals = new Map();
    this.active = false;
  }

  /**
   * Register a sensor
   */
  registerSensor(config: SensorConfig): void {
    if (this.sensors.has(config.id)) {
      throw new Error(`Sensor ${config.id} already registered`);
    }

    this.sensors.set(config.id, config);
    console.log(`Sensor ${config.id} (${config.type}) registered`);
  }

  /**
   * Unregister a sensor
   */
  unregisterSensor(sensorId: string): void {
    this.stopSensor(sensorId);
    this.sensors.delete(sensorId);
    this.sensorData.delete(sensorId);
    console.log(`Sensor ${sensorId} unregistered`);
  }

  /**
   * Start all sensors
   */
  startAll(): void {
    if (this.active) {
      console.warn('Sensors are already active');
      return;
    }

    this.active = true;

    for (const [sensorId] of this.sensors) {
      this.startSensor(sensorId);
    }

    console.log(`Started ${this.sensors.size} sensors`);
  }

  /**
   * Stop all sensors
   */
  stopAll(): void {
    this.active = false;

    for (const sensorId of this.sensors.keys()) {
      this.stopSensor(sensorId);
    }

    console.log('All sensors stopped');
  }

  /**
   * Start a specific sensor
   */
  private startSensor(sensorId: string): void {
    const config = this.sensors.get(sensorId);
    if (!config) {
      throw new Error(`Sensor ${sensorId} not found`);
    }

    // Stop existing interval if any
    this.stopSensor(sensorId);

    // Start sensor updates
    const intervalMs = 1000 / config.updateRate;
    const interval = setInterval(() => {
      this.updateSensor(sensorId);
    }, intervalMs);

    this.updateIntervals.set(sensorId, interval);
  }

  /**
   * Stop a specific sensor
   */
  private stopSensor(sensorId: string): void {
    const interval = this.updateIntervals.get(sensorId);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(sensorId);
    }
  }

  /**
   * Update sensor data
   */
  private updateSensor(sensorId: string): void {
    const config = this.sensors.get(sensorId);
    if (!config) {
      return;
    }

    // Generate simulated sensor data based on type
    const value = this.generateSensorValue(config);

    const data: SensorData = {
      timestamp: Date.now(),
      type: config.type,
      value
    };

    this.sensorData.set(sensorId, data);
    this.emit('sensorUpdate', { sensorId, data });
  }

  /**
   * Generate simulated sensor values
   */
  private generateSensorValue(config: SensorConfig): any {
    switch (config.type) {
      case 'lidar':
        // Return array of distance measurements
        return Array.from({ length: 360 }, () => Math.random() * 10);

      case 'camera':
        return {
          width: 640,
          height: 480,
          format: 'RGB',
          timestamp: Date.now()
        };

      case 'imu':
        return {
          acceleration: {
            x: (Math.random() - 0.5) * 2,
            y: (Math.random() - 0.5) * 2,
            z: 9.81 + (Math.random() - 0.5) * 0.1
          },
          gyroscope: {
            x: (Math.random() - 0.5) * 0.1,
            y: (Math.random() - 0.5) * 0.1,
            z: (Math.random() - 0.5) * 0.1
          }
        };

      case 'gps':
        return {
          latitude: 37.7749 + (Math.random() - 0.5) * 0.001,
          longitude: -122.4194 + (Math.random() - 0.5) * 0.001,
          altitude: 10 + (Math.random() - 0.5) * 1
        };

      case 'temperature':
        const range = config.range || { min: 15, max: 30 };
        return range.min + Math.random() * (range.max - range.min);

      case 'proximity':
        return Math.random() * (config.range?.max || 5);

      case 'encoder':
        return {
          position: Math.floor(Math.random() * 360),
          velocity: (Math.random() - 0.5) * 100
        };

      default:
        return Math.random() * 100;
    }
  }

  /**
   * Get latest sensor data
   */
  getSensorData(sensorId: string): SensorData | undefined {
    return this.sensorData.get(sensorId);
  }

  /**
   * Get all sensor data
   */
  getAllSensorData(): Map<string, SensorData> {
    return new Map(this.sensorData);
  }

  /**
   * Get sensor configuration
   */
  getSensorConfig(sensorId: string): SensorConfig | undefined {
    return this.sensors.get(sensorId);
  }

  /**
   * Get all sensors
   */
  getAllSensors(): SensorConfig[] {
    return Array.from(this.sensors.values());
  }

  /**
   * Check if sensor is active
   */
  isSensorActive(sensorId: string): boolean {
    return this.updateIntervals.has(sensorId);
  }

  /**
   * Get sensor status
   */
  getStatus(): any {
    return {
      totalSensors: this.sensors.size,
      activeSensors: this.updateIntervals.size,
      sensors: Array.from(this.sensors.entries()).map(([id, config]) => ({
        id,
        type: config.type,
        active: this.isSensorActive(id),
        lastUpdate: this.sensorData.get(id)?.timestamp
      }))
    };
  }
}

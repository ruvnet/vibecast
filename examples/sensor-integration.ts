/**
 * Sensor integration example
 */

import { SensorManager, SensorConfig } from '../src/index.js';

async function main() {
  console.log('🤖 Sensor Integration Example\n');

  const sensorManager = new SensorManager();

  // Set up event listener
  sensorManager.on('sensorUpdate', (data) => {
    console.log(`[${data.sensorId}] ${data.data.type}:`,
      typeof data.data.value === 'object'
        ? JSON.stringify(data.data.value).substring(0, 50) + '...'
        : data.data.value);
  });

  // Register various sensors
  console.log('Registering sensors...\n');

  const sensors: SensorConfig[] = [
    {
      id: 'lidar-main',
      type: 'lidar',
      updateRate: 2
    },
    {
      id: 'camera-front',
      type: 'camera',
      updateRate: 1
    },
    {
      id: 'imu-main',
      type: 'imu',
      updateRate: 5
    },
    {
      id: 'gps-main',
      type: 'gps',
      updateRate: 1
    },
    {
      id: 'temp-internal',
      type: 'temperature',
      updateRate: 0.5,
      range: { min: 20, max: 80 }
    },
    {
      id: 'proximity-front',
      type: 'proximity',
      updateRate: 10,
      range: { min: 0, max: 5 }
    }
  ];

  for (const sensor of sensors) {
    sensorManager.registerSensor(sensor);
  }

  // Start all sensors
  console.log('Starting sensors...\n');
  sensorManager.startAll();

  // Run for a period
  console.log('Collecting sensor data for 5 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Stop sensors
  console.log('\nStopping sensors...');
  sensorManager.stopAll();

  // Show final status
  const status = sensorManager.getStatus();
  console.log('\n=== Sensor Status ===');
  console.log(`Total Sensors: ${status.totalSensors}`);
  console.log(`Active Sensors: ${status.activeSensors}`);
  console.log('\nSensor Details:');
  for (const sensor of status.sensors) {
    console.log(`  ${sensor.id} (${sensor.type}):`);
    console.log(`    Active: ${sensor.active}`);
    console.log(`    Last Update: ${sensor.lastUpdate ? new Date(sensor.lastUpdate).toISOString() : 'N/A'}`);
  }

  // Show latest sensor data
  console.log('\n=== Latest Sensor Readings ===');
  const allData = sensorManager.getAllSensorData();
  for (const [sensorId, data] of allData) {
    console.log(`\n${sensorId}:`);
    if (typeof data.value === 'object') {
      console.log(JSON.stringify(data.value, null, 2));
    } else {
      console.log(`  Value: ${data.value}`);
    }
  }

  console.log('\n✓ Example completed');
}

main().catch(console.error);

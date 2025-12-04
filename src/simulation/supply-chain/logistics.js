/**
 * Nuclear Power Plant Supply Chain and Logistics Simulation
 * Manages fuel supply, waste disposal, parts inventory, and vendor relationships
 */

const { RuvectorClient } = require('ruvector');

class SupplyChainManagement {
  constructor(config = {}) {
    this.plantId = config.plantId || 'NPP-01';
    this.ruvector = new RuvectorClient();

    // Inventory management
    this.inventory = {
      nuclearFuel: {
        quantity: 100, // tons
        enrichment: 4.5, // percent U-235
        lastDelivery: Date.now() - 90 * 24 * 60 * 60 * 1000, // 90 days ago
        nextDelivery: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days from now
        cost: 1500000, // USD per ton
        supplier: 'Global Nuclear Fuel'
      },
      spareparts: {
        pumps: 5,
        valves: 50,
        sensors: 200,
        controlRods: 10,
        heatExchangers: 2
      },
      chemicals: {
        boricAcid: 1000, // kg
        hydrazine: 500, // kg
        resins: 200 // kg
      },
      wasteStorage: {
        lowLevel: 50, // cubic meters
        intermediate: 20, // cubic meters
        highLevel: 5, // cubic meters
        capacity: {
          lowLevel: 200,
          intermediate: 50,
          highLevel: 30
        }
      }
    };

    // Vendor relationships
    this.vendors = [
      {
        id: 'VENDOR-001',
        name: 'Global Nuclear Fuel',
        category: 'fuel',
        reliability: 0.98,
        leadTime: 180, // days
        contractValue: 50000000
      },
      {
        id: 'VENDOR-002',
        name: 'Industrial Pumps Corp',
        category: 'parts',
        reliability: 0.95,
        leadTime: 30,
        contractValue: 5000000
      },
      {
        id: 'VENDOR-003',
        name: 'Nuclear Waste Solutions',
        category: 'waste',
        reliability: 0.99,
        leadTime: 14,
        contractValue: 10000000
      }
    ];

    // Logistics tracking
    this.shipments = [];
    this.orders = [];
  }

  /**
   * Simulate supply chain operations
   */
  async simulate(timestep = 1000) {
    // Update fuel consumption
    this.consumeFuel(timestep);

    // Generate waste
    this.generateWaste(timestep);

    // Check inventory levels and reorder
    await this.checkInventoryLevels();

    // Process pending shipments
    this.processShipments(timestep);

    // Update vendor performance
    this.updateVendorMetrics();

    // Store metrics
    await this.storeMetrics();

    return this.getStatus();
  }

  /**
   * Consume nuclear fuel based on reactor operation
   */
  consumeFuel(timestep) {
    // Approximate fuel consumption: 1 ton per 30 days at full power
    const consumptionRate = 1 / (30 * 24 * 60 * 60 * 1000); // tons per millisecond
    const consumed = consumptionRate * timestep;

    this.inventory.nuclearFuel.quantity -= consumed;

    // Track fuel enrichment degradation
    this.inventory.nuclearFuel.enrichment -= consumed * 0.0001;
  }

  /**
   * Generate radioactive waste
   */
  generateWaste(timestep) {
    const timeInDays = timestep / (24 * 60 * 60 * 1000);

    this.inventory.wasteStorage.lowLevel += 0.1 * timeInDays;
    this.inventory.wasteStorage.intermediate += 0.05 * timeInDays;
    this.inventory.wasteStorage.highLevel += 0.01 * timeInDays;
  }

  /**
   * Check inventory levels and create purchase orders
   */
  async checkInventoryLevels() {
    // Check fuel levels
    if (this.inventory.nuclearFuel.quantity < 30) {
      await this.orderFuel(70); // Order 70 tons
    }

    // Check spare parts
    if (this.inventory.spareparts.pumps < 2) {
      await this.orderPart('pumps', 5);
    }

    // Check waste storage capacity
    const wasteLevels = this.inventory.wasteStorage;
    if (wasteLevels.lowLevel / wasteLevels.capacity.lowLevel > 0.8) {
      await this.scheduleWastePickup('lowLevel');
    }
    if (wasteLevels.highLevel / wasteLevels.capacity.highLevel > 0.6) {
      await this.scheduleWastePickup('highLevel');
    }
  }

  /**
   * Order nuclear fuel
   */
  async orderFuel(quantity) {
    const order = {
      id: `ORDER-FUEL-${Date.now()}`,
      type: 'fuel',
      quantity: quantity,
      vendor: this.vendors.find(v => v.category === 'fuel'),
      orderDate: Date.now(),
      expectedDelivery: Date.now() + (180 * 24 * 60 * 60 * 1000),
      cost: quantity * this.inventory.nuclearFuel.cost,
      status: 'ORDERED'
    };

    this.orders.push(order);

    // Schedule shipment
    this.shipments.push({
      orderId: order.id,
      eta: order.expectedDelivery,
      type: 'fuel',
      quantity: quantity
    });

    return order;
  }

  /**
   * Order spare parts
   */
  async orderPart(partType, quantity) {
    const vendor = this.vendors.find(v => v.category === 'parts');

    const order = {
      id: `ORDER-PART-${Date.now()}`,
      type: 'part',
      partType: partType,
      quantity: quantity,
      vendor: vendor,
      orderDate: Date.now(),
      expectedDelivery: Date.now() + (vendor.leadTime * 24 * 60 * 60 * 1000),
      status: 'ORDERED'
    };

    this.orders.push(order);

    this.shipments.push({
      orderId: order.id,
      eta: order.expectedDelivery,
      type: 'part',
      partType: partType,
      quantity: quantity
    });

    return order;
  }

  /**
   * Schedule waste pickup
   */
  async scheduleWastePickup(wasteType) {
    const vendor = this.vendors.find(v => v.category === 'waste');

    const pickup = {
      id: `PICKUP-${wasteType}-${Date.now()}`,
      type: 'waste-pickup',
      wasteType: wasteType,
      vendor: vendor,
      scheduledDate: Date.now() + (vendor.leadTime * 24 * 60 * 60 * 1000),
      status: 'SCHEDULED'
    };

    this.orders.push(pickup);

    return pickup;
  }

  /**
   * Process pending shipments
   */
  processShipments(timestep) {
    const now = Date.now();

    this.shipments = this.shipments.filter(shipment => {
      if (now >= shipment.eta) {
        // Shipment arrived
        if (shipment.type === 'fuel') {
          this.inventory.nuclearFuel.quantity += shipment.quantity;
          this.inventory.nuclearFuel.lastDelivery = now;
        } else if (shipment.type === 'part') {
          this.inventory.spareparts[shipment.partType] += shipment.quantity;
        }

        // Update order status
        const order = this.orders.find(o => o.id === shipment.orderId);
        if (order) {
          order.status = 'DELIVERED';
        }

        return false; // Remove from shipments
      }
      return true; // Keep in shipments
    });
  }

  /**
   * Update vendor performance metrics
   */
  updateVendorMetrics() {
    const deliveredOrders = this.orders.filter(o => o.status === 'DELIVERED');

    this.vendors.forEach(vendor => {
      const vendorOrders = deliveredOrders.filter(o => o.vendor.id === vendor.id);
      if (vendorOrders.length > 0) {
        // Calculate on-time delivery rate
        const onTime = vendorOrders.filter(o =>
          Math.abs(o.expectedDelivery - o.deliveryDate) < 24 * 60 * 60 * 1000
        ).length;

        vendor.reliability = (vendor.reliability * 0.9) + ((onTime / vendorOrders.length) * 0.1);
      }
    });
  }

  /**
   * Store supply chain metrics
   */
  async storeMetrics() {
    const vector = [
      this.inventory.nuclearFuel.quantity / 100,
      this.inventory.wasteStorage.lowLevel / this.inventory.wasteStorage.capacity.lowLevel,
      this.inventory.wasteStorage.highLevel / this.inventory.wasteStorage.capacity.highLevel,
      this.inventory.spareparts.pumps / 10,
      this.orders.filter(o => o.status === 'ORDERED').length / 10,
      this.shipments.length / 10
    ];

    try {
      await this.ruvector.upsert({
        collection: 'supply-chain-metrics',
        id: `${this.plantId}-${Date.now()}`,
        vector: vector,
        metadata: {
          plantId: this.plantId,
          inventory: this.inventory,
          activeOrders: this.orders.filter(o => o.status !== 'DELIVERED').length,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Error storing supply chain metrics:', error.message);
    }
  }

  /**
   * Get current supply chain status
   */
  getStatus() {
    return {
      plantId: this.plantId,
      inventory: this.inventory,
      activeOrders: this.orders.filter(o => o.status !== 'DELIVERED'),
      pendingShipments: this.shipments,
      vendorPerformance: this.vendors,
      timestamp: Date.now()
    };
  }
}

module.exports = SupplyChainManagement;

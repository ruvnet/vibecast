/**
 * Toyota Supply Chain Simulation
 * Complete supply chain network including Tier 1, 2, 3 suppliers
 * Keiretsu partners and global supplier network
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import {
  Supplier,
  SupplierCategory,
  SupplierRelationship,
  SupplierPerformance,
  Contract,
  Component,
  ComponentCategory,
  Location,
} from '../types';
import { ToyotaAgent } from '../core/Agent';
import { NameGenerator } from './OrganizationalStructure';

// ============================================================================
// TOYOTA KEIRETSU - CORE SUPPLIER GROUP
// ============================================================================

export interface KeiretsuMember {
  name: string;
  category: SupplierCategory;
  ownership: number; // Toyota ownership percentage
  components: string[];
  employees: number;
  annualRevenue: number; // in billions JPY
  founded: number;
}

export const TOYOTA_KEIRETSU: KeiretsuMember[] = [
  {
    name: 'Denso Corporation',
    category: 'electronics',
    ownership: 24.4,
    components: ['ECU', 'Sensors', 'HVAC', 'Fuel Systems', 'Starters', 'Alternators'],
    employees: 167950,
    annualRevenue: 5500,
    founded: 1949,
  },
  {
    name: 'Aisin Corporation',
    category: 'powertrain_components',
    ownership: 7.8,
    components: ['Transmissions', 'Drivetrain', 'Brakes', 'Door Systems', 'Navigation'],
    employees: 117000,
    annualRevenue: 4200,
    founded: 1949,
  },
  {
    name: 'Toyota Industries Corporation',
    category: 'powertrain_components',
    ownership: 7.6,
    components: ['Compressors', 'Forklifts', 'Textile Machinery', 'Car Electronics'],
    employees: 72000,
    annualRevenue: 2800,
    founded: 1926,
  },
  {
    name: 'JTEKT Corporation',
    category: 'chassis_suspension',
    ownership: 22.6,
    components: ['Steering Systems', 'Bearings', 'Driveline Components'],
    employees: 47000,
    annualRevenue: 1500,
    founded: 2006,
  },
  {
    name: 'Toyota Boshoku Corporation',
    category: 'interior_components',
    ownership: 39.7,
    components: ['Seats', 'Interior Trim', 'Air Filters', 'Headliners'],
    employees: 52000,
    annualRevenue: 1400,
    founded: 1918,
  },
  {
    name: 'Toyoda Gosei Co., Ltd.',
    category: 'interior_components',
    ownership: 43.2,
    components: ['Rubber Parts', 'Plastics', 'LED Lighting', 'Airbags'],
    employees: 40000,
    annualRevenue: 900,
    founded: 1949,
  },
  {
    name: 'Aichi Steel Corporation',
    category: 'raw_materials',
    ownership: 19.8,
    components: ['Special Steel', 'Forged Products', 'Electromagnetic Products'],
    employees: 4800,
    annualRevenue: 250,
    founded: 1940,
  },
  {
    name: 'Towa Rubber & Chemicals',
    category: 'chemicals',
    ownership: 15.3,
    components: ['Rubber Compounds', 'Seals', 'Weatherstripping'],
    employees: 3200,
    annualRevenue: 80,
    founded: 1943,
  },
  {
    name: 'Tokai Rika Co., Ltd.',
    category: 'electronics',
    ownership: 21.5,
    components: ['Switches', 'Smart Keys', 'Seatbelts', 'Shift Levers'],
    employees: 18000,
    annualRevenue: 500,
    founded: 1948,
  },
  {
    name: 'Futaba Industrial Co., Ltd.',
    category: 'body_stamping',
    ownership: 14.2,
    components: ['Exhaust Systems', 'Body Parts', 'Stamped Components'],
    employees: 8200,
    annualRevenue: 350,
    founded: 1945,
  },
  {
    name: 'Primearth EV Energy Co., Ltd.',
    category: 'battery_cells',
    ownership: 80.5,
    components: ['Hybrid Batteries', 'EV Batteries', 'Battery Management'],
    employees: 5100,
    annualRevenue: 420,
    founded: 1996,
  },
  {
    name: 'Cataler Corporation',
    category: 'chemicals',
    ownership: 19.0,
    components: ['Catalytic Converters', 'Diesel Particulate Filters'],
    employees: 3800,
    annualRevenue: 180,
    founded: 1967,
  },
];

// ============================================================================
// GLOBAL SUPPLIERS (NON-KEIRETSU)
// ============================================================================

export interface GlobalSupplierConfig {
  name: string;
  category: SupplierCategory;
  country: string;
  tier: 1 | 2 | 3;
  components: string[];
  employees: number;
}

export const GLOBAL_SUPPLIERS: GlobalSupplierConfig[] = [
  // Tier 1 - Major Global
  { name: 'Bosch', category: 'electronics', country: 'Germany', tier: 1, components: ['ABS', 'ESP', 'Fuel Injection'], employees: 400000 },
  { name: 'Continental AG', category: 'electronics', country: 'Germany', tier: 1, components: ['Tires', 'Brake Systems', 'Sensors'], employees: 190000 },
  { name: 'ZF Friedrichshafen', category: 'chassis_suspension', country: 'Germany', tier: 1, components: ['Transmissions', 'Chassis', 'Steering'], employees: 165000 },
  { name: 'Magna International', category: 'body_stamping', country: 'Canada', tier: 1, components: ['Body Panels', 'Mirrors', 'Seating'], employees: 158000 },
  { name: 'Valeo', category: 'electronics', country: 'France', tier: 1, components: ['Lighting', 'Wipers', 'ADAS'], employees: 110000 },
  { name: 'Panasonic Automotive', category: 'electronics', country: 'Japan', tier: 1, components: ['Infotainment', 'Batteries', 'Cameras'], employees: 55000 },
  { name: 'Bridgestone', category: 'raw_materials', country: 'Japan', tier: 1, components: ['Tires', 'Rubber Products'], employees: 140000 },
  { name: 'Sumitomo Electric', category: 'electronics', country: 'Japan', tier: 1, components: ['Wiring Harnesses', 'Cables'], employees: 280000 },
  { name: 'NGK Spark Plug', category: 'powertrain_components', country: 'Japan', tier: 1, components: ['Spark Plugs', 'Sensors', 'Ceramics'], employees: 17000 },
  { name: 'Koito Manufacturing', category: 'lighting', country: 'Japan', tier: 1, components: ['Headlights', 'Taillights', 'LED Systems'], employees: 21000 },
  { name: 'Stanley Electric', category: 'lighting', country: 'Japan', tier: 1, components: ['Automotive Lighting', 'LED Modules'], employees: 15000 },
  { name: 'NSK Ltd.', category: 'chassis_suspension', country: 'Japan', tier: 1, components: ['Bearings', 'Steering Systems'], employees: 30000 },
  { name: 'NTN Corporation', category: 'chassis_suspension', country: 'Japan', tier: 1, components: ['Bearings', 'CV Joints', 'Hubs'], employees: 24000 },

  // Tier 1 - Regional
  { name: 'LG Chem', category: 'battery_cells', country: 'South Korea', tier: 1, components: ['EV Batteries', 'Battery Cells'], employees: 40000 },
  { name: 'Samsung SDI', category: 'battery_cells', country: 'South Korea', tier: 1, components: ['Battery Cells', 'Battery Packs'], employees: 20000 },
  { name: 'CATL', category: 'battery_cells', country: 'China', tier: 1, components: ['EV Batteries', 'Energy Storage'], employees: 100000 },
  { name: 'BYD Battery', category: 'battery_cells', country: 'China', tier: 1, components: ['Blade Batteries', 'Battery Systems'], employees: 80000 },
  { name: 'Renesas Electronics', category: 'semiconductors', country: 'Japan', tier: 1, components: ['MCUs', 'SoCs', 'Power Management'], employees: 20000 },
  { name: 'Infineon Technologies', category: 'semiconductors', country: 'Germany', tier: 1, components: ['Power Semiconductors', 'Sensors'], employees: 50000 },
  { name: 'NXP Semiconductors', category: 'semiconductors', country: 'Netherlands', tier: 1, components: ['Automotive MCUs', 'Radar Chips'], employees: 31000 },
  { name: 'Texas Instruments', category: 'semiconductors', country: 'USA', tier: 1, components: ['Analog ICs', 'Embedded Processors'], employees: 34000 },
  { name: 'STMicroelectronics', category: 'semiconductors', country: 'Switzerland', tier: 1, components: ['Power Electronics', 'Sensors'], employees: 50000 },

  // Tier 2 - Specialized
  { name: 'AGC Inc.', category: 'glass', country: 'Japan', tier: 2, components: ['Windshields', 'Glass Panels'], employees: 55000 },
  { name: 'Nippon Sheet Glass', category: 'glass', country: 'Japan', tier: 2, components: ['Automotive Glass', 'Mirrors'], employees: 27000 },
  { name: 'Yazaki Corporation', category: 'electronics', country: 'Japan', tier: 2, components: ['Wire Harnesses', 'Connectors'], employees: 300000 },
  { name: 'Calsonic Kansei', category: 'hvac_systems', country: 'Japan', tier: 2, components: ['HVAC Units', 'Exhaust Systems'], employees: 22000 },
  { name: 'Mitsuba Corporation', category: 'electronics', country: 'Japan', tier: 2, components: ['Motors', 'Wipers', 'Horns'], employees: 17000 },
  { name: 'Mitsubishi Electric Auto', category: 'electronics', country: 'Japan', tier: 2, components: ['Starters', 'Alternators', 'ECUs'], employees: 45000 },
  { name: 'Hitachi Astemo', category: 'chassis_suspension', country: 'Japan', tier: 2, components: ['Suspensions', 'Brake Systems'], employees: 87000 },
  { name: 'Musashi Seimitsu', category: 'powertrain_components', country: 'Japan', tier: 2, components: ['Gears', 'Shafts', 'Forgings'], employees: 9000 },
  { name: 'Topre Corporation', category: 'body_stamping', country: 'Japan', tier: 2, components: ['Press Parts', 'Body Components'], employees: 6000 },
  { name: 'Unipres Corporation', category: 'body_stamping', country: 'Japan', tier: 2, components: ['Stamped Parts', 'Fuel Tanks'], employees: 8500 },

  // Tier 3 - Raw Materials & Sub-Components
  { name: 'Nippon Steel', category: 'raw_materials', country: 'Japan', tier: 3, components: ['Steel Sheets', 'Special Steel'], employees: 105000 },
  { name: 'JFE Steel', category: 'raw_materials', country: 'Japan', tier: 3, components: ['Automotive Steel', 'High-Tensile Steel'], employees: 65000 },
  { name: 'UACJ Corporation', category: 'raw_materials', country: 'Japan', tier: 3, components: ['Aluminum Sheets', 'Extrusions'], employees: 10000 },
  { name: 'Sumitomo Metal Mining', category: 'raw_materials', country: 'Japan', tier: 3, components: ['Nickel', 'Copper', 'Battery Materials'], employees: 7000 },
  { name: 'Mitsui Mining & Smelting', category: 'raw_materials', country: 'Japan', tier: 3, components: ['Zinc', 'Copper Foil'], employees: 11000 },
  { name: 'Asahi Kasei', category: 'chemicals', country: 'Japan', tier: 3, components: ['Battery Separators', 'Plastics'], employees: 46000 },
  { name: 'Toray Industries', category: 'chemicals', country: 'Japan', tier: 3, components: ['Carbon Fiber', 'Films', 'Resins'], employees: 48000 },
  { name: 'Teijin Limited', category: 'chemicals', country: 'Japan', tier: 3, components: ['Carbon Fiber', 'Aramid Fiber'], employees: 21000 },
  { name: 'Kuraray Co.', category: 'chemicals', country: 'Japan', tier: 3, components: ['Specialty Chemicals', 'Films'], employees: 11000 },
  { name: 'BASF Automotive', category: 'chemicals', country: 'Germany', tier: 3, components: ['Coatings', 'Catalysts', 'Plastics'], employees: 120000 },

  // Logistics Partners
  { name: 'Toyota Tsusho', category: 'logistics', country: 'Japan', tier: 1, components: ['Logistics', 'Trading', 'Materials'], employees: 66000 },
  { name: 'Nippon Express', category: 'logistics', country: 'Japan', tier: 2, components: ['Shipping', 'Warehousing'], employees: 72000 },
  { name: 'Yusen Logistics', category: 'logistics', country: 'Japan', tier: 2, components: ['Ocean Freight', 'Air Cargo'], employees: 25000 },
];

// ============================================================================
// SUPPLY CHAIN GENERATOR
// ============================================================================

export interface SupplyChainEvents {
  'supplier:added': (supplier: Supplier) => void;
  'disruption:detected': (supplier: Supplier, severity: number) => void;
  'delivery:completed': (supplier: Supplier, component: string) => void;
  'quality:issue': (supplier: Supplier, defectRate: number) => void;
  'contract:renewed': (contract: Contract) => void;
}

export class SupplyChainSimulator extends EventEmitter<SupplyChainEvents> {
  private suppliers: Map<string, Supplier> = new Map();
  private contracts: Map<string, Contract> = new Map();
  private inventoryLevels: Map<string, number> = new Map();
  private nameGenerator: NameGenerator;
  private jitEnabled: boolean = true;
  private kanbanLevels: Map<string, { min: number; max: number; current: number }> = new Map();

  constructor(seed: number = 42) {
    super();
    this.nameGenerator = new NameGenerator(seed);
  }

  /**
   * Initialize the complete Toyota supply chain network
   */
  async initializeSupplyChain(): Promise<Supplier[]> {
    console.log('Initializing Toyota Supply Chain Network...');

    // Add Keiretsu partners (Tier 1 - core)
    for (const member of TOYOTA_KEIRETSU) {
      const supplier = this.createKeiretsuSupplier(member);
      this.suppliers.set(supplier.id, supplier);
      this.emit('supplier:added', supplier);
    }

    // Add global suppliers
    for (const config of GLOBAL_SUPPLIERS) {
      const supplier = this.createGlobalSupplier(config);
      this.suppliers.set(supplier.id, supplier);
      this.emit('supplier:added', supplier);
    }

    // Generate additional Tier 2 and Tier 3 suppliers
    const additionalSuppliers = this.generateAdditionalSuppliers(500);
    for (const supplier of additionalSuppliers) {
      this.suppliers.set(supplier.id, supplier);
    }

    // Initialize inventory and Kanban
    this.initializeKanbanSystem();

    console.log(`Supply chain initialized with ${this.suppliers.size} suppliers`);

    return Array.from(this.suppliers.values());
  }

  private createKeiretsuSupplier(member: KeiretsuMember): Supplier {
    const id = uuidv4();
    const agents = this.generateSupplierAgents(member.employees, true);

    return {
      id,
      name: member.name,
      tier: 1,
      category: member.category,
      location: this.generateJapanLocation(member.name),
      relationship: {
        type: 'keiretsu',
        startDate: new Date(member.founded, 0, 1),
        investmentLevel: member.ownership,
        jointDevelopment: true,
        exclusivity: member.ownership > 30,
        trustScore: 95 + Math.random() * 5,
      },
      components: member.components,
      contracts: [this.generateContract(id, member.components)],
      performance: {
        qualityScore: 95 + Math.random() * 5,
        deliveryScore: 97 + Math.random() * 3,
        costScore: 85 + Math.random() * 10,
        flexibilityScore: 90 + Math.random() * 10,
        innovationScore: 85 + Math.random() * 15,
        overallRating: 94 + Math.random() * 6,
        defectRate: Math.random() * 50, // PPM
        onTimeDeliveryRate: 97 + Math.random() * 3,
      },
      agents,
    };
  }

  private createGlobalSupplier(config: GlobalSupplierConfig): Supplier {
    const id = uuidv4();
    const agentCount = Math.min(config.employees, 1000); // Limit for simulation
    const agents = this.generateSupplierAgents(agentCount, config.country === 'Japan');

    return {
      id,
      name: config.name,
      tier: config.tier,
      category: config.category,
      location: this.generateLocation(config.country, config.name),
      relationship: {
        type: config.tier === 1 ? 'partner' : 'preferred',
        startDate: new Date(2000 + Math.floor(Math.random() * 20), 0, 1),
        investmentLevel: config.tier === 1 ? Math.random() * 5 : 0,
        jointDevelopment: config.tier === 1,
        exclusivity: false,
        trustScore: 75 + Math.random() * 20,
      },
      components: config.components,
      contracts: [this.generateContract(id, config.components)],
      performance: {
        qualityScore: 80 + Math.random() * 15,
        deliveryScore: 85 + Math.random() * 12,
        costScore: 75 + Math.random() * 20,
        flexibilityScore: 70 + Math.random() * 25,
        innovationScore: 65 + Math.random() * 30,
        overallRating: 78 + Math.random() * 17,
        defectRate: 50 + Math.random() * 200, // PPM
        onTimeDeliveryRate: 90 + Math.random() * 8,
      },
      agents,
    };
  }

  private generateAdditionalSuppliers(count: number): Supplier[] {
    const suppliers: Supplier[] = [];
    const categories: SupplierCategory[] = [
      'powertrain_components', 'body_stamping', 'electronics', 'interior_components',
      'chassis_suspension', 'glass', 'lighting', 'hvac_systems', 'raw_materials', 'chemicals'
    ];
    const countries = ['Japan', 'China', 'Thailand', 'Indonesia', 'India', 'USA', 'Mexico', 'Germany', 'UK'];

    for (let i = 0; i < count; i++) {
      const country = countries[i % countries.length];
      const category = categories[i % categories.length];
      const tier = (i % 3) + 1 as 1 | 2 | 3;
      const isJapan = country === 'Japan';

      const companyName = isJapan
        ? `${this.nameGenerator.generateJapaneseName().split(' ')[0]} ${this.getIndustrySuffix(category)}`
        : `${this.nameGenerator.generateInternationalName().split(' ')[1]} ${this.getIndustrySuffix(category)}`;

      const id = uuidv4();
      const employees = Math.floor(100 + Math.random() * 5000);
      const agents = this.generateSupplierAgents(Math.min(employees, 100), isJapan);

      suppliers.push({
        id,
        name: companyName,
        tier,
        category,
        location: this.generateLocation(country, companyName),
        relationship: {
          type: tier === 1 ? 'preferred' : tier === 2 ? 'approved' : 'new',
          startDate: new Date(2010 + Math.floor(Math.random() * 13), 0, 1),
          investmentLevel: 0,
          jointDevelopment: false,
          exclusivity: false,
          trustScore: 50 + Math.random() * 30,
        },
        components: [this.getComponentForCategory(category)],
        contracts: [this.generateContract(id, [this.getComponentForCategory(category)])],
        performance: {
          qualityScore: 60 + Math.random() * 30,
          deliveryScore: 70 + Math.random() * 25,
          costScore: 65 + Math.random() * 30,
          flexibilityScore: 60 + Math.random() * 30,
          innovationScore: 40 + Math.random() * 40,
          overallRating: 60 + Math.random() * 30,
          defectRate: 100 + Math.random() * 500,
          onTimeDeliveryRate: 80 + Math.random() * 15,
        },
        agents,
      });
    }

    return suppliers;
  }

  private getIndustrySuffix(category: SupplierCategory): string {
    const suffixes: Partial<Record<SupplierCategory, string[]>> = {
      electronics: ['Electric', 'Electronics', 'Tech', 'Systems'],
      body_stamping: ['Metal', 'Steel Works', 'Stamping', 'Industries'],
      chemicals: ['Chemical', 'Materials', 'Polymers'],
      raw_materials: ['Steel', 'Metals', 'Mining'],
      interior_components: ['Interior', 'Parts', 'Components'],
    };
    const options = suffixes[category] || ['Industries', 'Corporation', 'Co.'];
    return options[Math.floor(Math.random() * options.length)];
  }

  private getComponentForCategory(category: SupplierCategory): string {
    const components: Record<SupplierCategory, string[]> = {
      powertrain_components: ['Gears', 'Shafts', 'Pistons', 'Valves'],
      body_stamping: ['Body Panels', 'Door Frames', 'Hood', 'Fenders'],
      electronics: ['Sensors', 'Controllers', 'Switches', 'Wiring'],
      interior_components: ['Seat Fabric', 'Trim Parts', 'Carpets'],
      chassis_suspension: ['Springs', 'Dampers', 'Control Arms'],
      glass: ['Windows', 'Mirrors'],
      lighting: ['Bulbs', 'Reflectors', 'Housings'],
      hvac_systems: ['Compressors', 'Evaporators', 'Ducts'],
      battery_cells: ['Cells', 'Modules', 'BMS'],
      semiconductors: ['Chips', 'ICs', 'Modules'],
      raw_materials: ['Steel Coils', 'Aluminum Ingots', 'Copper'],
      chemicals: ['Paint', 'Adhesives', 'Sealants'],
      logistics: ['Transportation', 'Warehousing'],
    };
    const options = components[category] || ['General Parts'];
    return options[Math.floor(Math.random() * options.length)];
  }

  private generateSupplierAgents(count: number, isJapan: boolean): ToyotaAgent[] {
    const agents: ToyotaAgent[] = [];
    const roles: Array<{ type: 'manager' | 'engineer' | 'production_worker' | 'quality_inspector'; ratio: number }> = [
      { type: 'manager', ratio: 0.1 },
      { type: 'engineer', ratio: 0.2 },
      { type: 'quality_inspector', ratio: 0.15 },
      { type: 'production_worker', ratio: 0.55 },
    ];

    for (const role of roles) {
      const roleCount = Math.floor(count * role.ratio);
      for (let i = 0; i < roleCount; i++) {
        agents.push(new ToyotaAgent({
          name: this.nameGenerator.generateName(isJapan),
          type: role.type,
          department: 'supply_chain',
        }));
      }
    }

    return agents;
  }

  private generateJapanLocation(name: string): Location {
    const cities = [
      { city: 'Nagoya', lat: 35.1815, lng: 136.9066 },
      { city: 'Toyota City', lat: 35.0833, lng: 137.1500 },
      { city: 'Osaka', lat: 34.6937, lng: 135.5023 },
      { city: 'Tokyo', lat: 35.6762, lng: 139.6503 },
      { city: 'Yokohama', lat: 35.4437, lng: 139.6380 },
    ];
    const cityData = cities[Math.floor(Math.random() * cities.length)];

    return {
      id: uuidv4(),
      name: `${name} - ${cityData.city}`,
      type: 'supplier_facility',
      country: 'Japan',
      region: 'Chubu',
      city: cityData.city,
      coordinates: { lat: cityData.lat, lng: cityData.lng },
      capacity: 5000,
      currentOccupancy: 4000,
      facilities: [],
    };
  }

  private generateLocation(country: string, name: string): Location {
    const countryData: Record<string, { region: string; city: string; lat: number; lng: number }> = {
      'Japan': { region: 'Chubu', city: 'Nagoya', lat: 35.1815, lng: 136.9066 },
      'China': { region: 'Guangdong', city: 'Guangzhou', lat: 23.1291, lng: 113.2644 },
      'Thailand': { region: 'Central', city: 'Bangkok', lat: 13.7563, lng: 100.5018 },
      'Indonesia': { region: 'Java', city: 'Jakarta', lat: -6.2088, lng: 106.8456 },
      'India': { region: 'Karnataka', city: 'Bangalore', lat: 12.9716, lng: 77.5946 },
      'USA': { region: 'Michigan', city: 'Detroit', lat: 42.3314, lng: -83.0458 },
      'Mexico': { region: 'Guanajuato', city: 'Guanajuato', lat: 21.0190, lng: -101.2574 },
      'Germany': { region: 'Bavaria', city: 'Munich', lat: 48.1351, lng: 11.5820 },
      'UK': { region: 'Midlands', city: 'Birmingham', lat: 52.4862, lng: -1.8904 },
      'South Korea': { region: 'Seoul', city: 'Seoul', lat: 37.5665, lng: 126.9780 },
      'France': { region: 'Ile-de-France', city: 'Paris', lat: 48.8566, lng: 2.3522 },
      'Canada': { region: 'Ontario', city: 'Toronto', lat: 43.6532, lng: -79.3832 },
      'Netherlands': { region: 'North Holland', city: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
      'Switzerland': { region: 'Geneva', city: 'Geneva', lat: 46.2044, lng: 6.1432 },
      'Belgium': { region: 'Brussels', city: 'Brussels', lat: 50.8503, lng: 4.3517 },
    };

    const data = countryData[country] || countryData['Japan'];

    return {
      id: uuidv4(),
      name: `${name} - ${data.city}`,
      type: 'supplier_facility',
      country,
      region: data.region,
      city: data.city,
      coordinates: { lat: data.lat + (Math.random() - 0.5) * 0.5, lng: data.lng + (Math.random() - 0.5) * 0.5 },
      capacity: 3000,
      currentOccupancy: 2000,
      facilities: [],
    };
  }

  private generateContract(supplierId: string, components: string[]): Contract {
    const startDate = new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), 1);
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 3 + Math.floor(Math.random() * 3));

    return {
      id: uuidv4(),
      supplierId,
      components,
      startDate,
      endDate,
      annualVolume: 10000 + Math.floor(Math.random() * 990000),
      priceAgreement: {
        basePrice: 10 + Math.random() * 1000,
        currency: 'JPY',
        escalationClause: Math.random() > 0.5,
        volumeDiscounts: [
          { threshold: 50000, discountPercent: 3 },
          { threshold: 100000, discountPercent: 5 },
          { threshold: 500000, discountPercent: 8 },
        ],
      },
      qualityRequirements: {
        defectRateMax: 100,
        cpkMinimum: 1.33,
        inspectionProtocol: 'TQM-Standard',
        certifications: ['ISO 9001', 'IATF 16949'],
      },
      status: 'active',
    };
  }

  private initializeKanbanSystem(): void {
    // Initialize Kanban levels for each component category
    const categories: ComponentCategory[] = [
      'powertrain', 'chassis', 'body', 'interior', 'electronics',
      'safety_systems', 'hvac', 'lighting', 'wheels_tires', 'fluid_systems',
      'battery_ev', 'fuel_cell'
    ];

    for (const category of categories) {
      this.kanbanLevels.set(category, {
        min: 1000,
        max: 5000,
        current: 3000,
      });
      this.inventoryLevels.set(category, 3000);
    }
  }

  // ============================================================================
  // SUPPLY CHAIN OPERATIONS
  // ============================================================================

  async processJITDelivery(componentCategory: ComponentCategory): Promise<boolean> {
    if (!this.jitEnabled) return false;

    const kanban = this.kanbanLevels.get(componentCategory);
    if (!kanban) return false;

    // Find supplier for this component
    const supplier = Array.from(this.suppliers.values()).find(s =>
      s.components.some(c => c.toLowerCase().includes(componentCategory))
    );

    if (!supplier) return false;

    // Simulate JIT delivery
    if (kanban.current < kanban.min) {
      const deliveryAmount = kanban.max - kanban.current;
      const deliverySuccess = Math.random() < (supplier.performance.onTimeDeliveryRate / 100);

      if (deliverySuccess) {
        kanban.current += deliveryAmount;
        this.emit('delivery:completed', supplier, componentCategory);
        return true;
      } else {
        this.emit('disruption:detected', supplier, 5);
        return false;
      }
    }

    return true;
  }

  consumeComponents(category: ComponentCategory, quantity: number): boolean {
    const kanban = this.kanbanLevels.get(category);
    if (!kanban || kanban.current < quantity) return false;

    kanban.current -= quantity;

    // Trigger reorder if below min
    if (kanban.current < kanban.min) {
      this.processJITDelivery(category);
    }

    return true;
  }

  simulateSupplyDisruption(severity: number = 5): Supplier | null {
    const suppliers = Array.from(this.suppliers.values());
    const affectedSupplier = suppliers[Math.floor(Math.random() * suppliers.length)];

    // Reduce performance temporarily
    affectedSupplier.performance.deliveryScore *= (1 - severity / 20);
    affectedSupplier.performance.overallRating *= (1 - severity / 25);

    this.emit('disruption:detected', affectedSupplier, severity);

    return affectedSupplier;
  }

  getSupplierMetrics(): object {
    const suppliers = Array.from(this.suppliers.values());

    return {
      totalSuppliers: suppliers.length,
      tier1Count: suppliers.filter(s => s.tier === 1).length,
      tier2Count: suppliers.filter(s => s.tier === 2).length,
      tier3Count: suppliers.filter(s => s.tier === 3).length,
      keiretsuCount: suppliers.filter(s => s.relationship.type === 'keiretsu').length,
      avgQualityScore: (suppliers.reduce((sum, s) => sum + s.performance.qualityScore, 0) / suppliers.length).toFixed(1),
      avgDeliveryScore: (suppliers.reduce((sum, s) => sum + s.performance.deliveryScore, 0) / suppliers.length).toFixed(1),
      totalAgents: suppliers.reduce((sum, s) => sum + s.agents.length, 0),
      inventoryStatus: Object.fromEntries(this.kanbanLevels),
    };
  }

  getSuppliers(): Supplier[] {
    return Array.from(this.suppliers.values());
  }
}

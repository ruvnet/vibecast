/**
 * Toyota Motor Company - Complete Organizational Structure
 * Simulates ~370,000 employees across all divisions, departments, and global locations
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Agent,
  AgentType,
  Department,
  Division,
  Location,
  LocationType,
  VehicleModel,
  VehicleType,
  KPI,
} from '../types';
import { ToyotaAgent } from '../core/Agent';

// ============================================================================
// TOYOTA EXECUTIVE LEADERSHIP
// ============================================================================

export interface ExecutiveRole {
  title: string;
  name: string;
  department: Department;
  type: AgentType;
  directReports: string[];
}

export const TOYOTA_EXECUTIVES: ExecutiveRole[] = [
  {
    title: 'Chairman',
    name: 'Akio Toyoda',
    department: 'executive_board',
    type: 'executive',
    directReports: ['CEO', 'President'],
  },
  {
    title: 'President & CEO',
    name: 'Koji Sato',
    department: 'executive_board',
    type: 'executive',
    directReports: ['COO', 'CFO', 'CTO', 'EVP Operations', 'EVP Sales'],
  },
  {
    title: 'Chief Operating Officer',
    name: 'Hiroki Nakajima',
    department: 'toyota_motor_corporation',
    type: 'executive',
    directReports: ['VP Manufacturing', 'VP Quality', 'VP Supply Chain'],
  },
  {
    title: 'Chief Technology Officer',
    name: 'Masahiko Maeda',
    department: 'research_development',
    type: 'executive',
    directReports: ['VP R&D', 'VP Engineering', 'VP Connected Tech'],
  },
  {
    title: 'Chief Financial Officer',
    name: 'Yoichi Miyazaki',
    department: 'finance',
    type: 'executive',
    directReports: ['VP Finance', 'VP Investor Relations', 'VP Treasury'],
  },
];

// ============================================================================
// TOYOTA GLOBAL LOCATIONS
// ============================================================================

export interface ToyotaLocation extends Location {
  employeeCount: number;
  productionCapacity?: number;
  specialization: string[];
}

export const TOYOTA_LOCATIONS: ToyotaLocation[] = [
  // Japan Headquarters & Major Facilities
  {
    id: 'toyota-city-hq',
    name: 'Toyota City Global Headquarters',
    type: 'headquarters',
    country: 'Japan',
    region: 'Aichi',
    city: 'Toyota City',
    coordinates: { lat: 35.0833, lng: 137.1500 },
    capacity: 50000,
    currentOccupancy: 42000,
    facilities: [],
    employeeCount: 42000,
    specialization: ['Corporate HQ', 'R&D', 'Engineering'],
  },
  {
    id: 'motomachi-plant',
    name: 'Motomachi Plant',
    type: 'manufacturing_plant',
    country: 'Japan',
    region: 'Aichi',
    city: 'Toyota City',
    coordinates: { lat: 35.0667, lng: 137.1333 },
    capacity: 15000,
    currentOccupancy: 12000,
    facilities: [],
    employeeCount: 12000,
    productionCapacity: 300000,
    specialization: ['Crown', 'Mirai', 'GR86'],
  },
  {
    id: 'tsutsumi-plant',
    name: 'Tsutsumi Plant',
    type: 'manufacturing_plant',
    country: 'Japan',
    region: 'Aichi',
    city: 'Toyota City',
    coordinates: { lat: 35.0500, lng: 137.1167 },
    capacity: 8000,
    currentOccupancy: 7500,
    facilities: [],
    employeeCount: 7500,
    productionCapacity: 400000,
    specialization: ['Prius', 'Camry', 'Hybrid'],
  },
  {
    id: 'takaoka-plant',
    name: 'Takaoka Plant',
    type: 'manufacturing_plant',
    country: 'Japan',
    region: 'Aichi',
    city: 'Toyota City',
    coordinates: { lat: 35.1000, lng: 137.1667 },
    capacity: 6000,
    currentOccupancy: 5500,
    facilities: [],
    employeeCount: 5500,
    productionCapacity: 350000,
    specialization: ['Corolla', 'RAV4'],
  },
  {
    id: 'tahara-plant',
    name: 'Tahara Plant',
    type: 'manufacturing_plant',
    country: 'Japan',
    region: 'Aichi',
    city: 'Tahara',
    coordinates: { lat: 34.6667, lng: 137.2833 },
    capacity: 10000,
    currentOccupancy: 9000,
    facilities: [],
    employeeCount: 9000,
    productionCapacity: 450000,
    specialization: ['Land Cruiser', 'Lexus LX', 'Lexus GX'],
  },
  {
    id: 'toyota-rd-center',
    name: 'Toyota R&D Center',
    type: 'r_and_d_center',
    country: 'Japan',
    region: 'Aichi',
    city: 'Toyota City',
    coordinates: { lat: 35.0750, lng: 137.1600 },
    capacity: 12000,
    currentOccupancy: 10000,
    facilities: [],
    employeeCount: 10000,
    specialization: ['Advanced Research', 'EV Development', 'Hydrogen'],
  },
  // North America
  {
    id: 'tmna-plano',
    name: 'Toyota Motor North America HQ',
    type: 'regional_hq',
    country: 'USA',
    region: 'Texas',
    city: 'Plano',
    coordinates: { lat: 33.0198, lng: -96.6989 },
    capacity: 7000,
    currentOccupancy: 6500,
    facilities: [],
    employeeCount: 6500,
    specialization: ['North America Operations', 'Sales', 'Marketing'],
  },
  {
    id: 'tmmk-kentucky',
    name: 'Toyota Motor Manufacturing Kentucky',
    type: 'manufacturing_plant',
    country: 'USA',
    region: 'Kentucky',
    city: 'Georgetown',
    coordinates: { lat: 38.2098, lng: -84.5589 },
    capacity: 10000,
    currentOccupancy: 9500,
    facilities: [],
    employeeCount: 9500,
    productionCapacity: 550000,
    specialization: ['Camry', 'Avalon', 'ES'],
  },
  {
    id: 'tmmi-indiana',
    name: 'Toyota Motor Manufacturing Indiana',
    type: 'manufacturing_plant',
    country: 'USA',
    region: 'Indiana',
    city: 'Princeton',
    coordinates: { lat: 38.3553, lng: -87.5675 },
    capacity: 7000,
    currentOccupancy: 6800,
    facilities: [],
    employeeCount: 6800,
    productionCapacity: 420000,
    specialization: ['Highlander', 'Sequoia', 'Sienna'],
  },
  {
    id: 'tmmtx-texas',
    name: 'Toyota Motor Manufacturing Texas',
    type: 'manufacturing_plant',
    country: 'USA',
    region: 'Texas',
    city: 'San Antonio',
    coordinates: { lat: 29.4241, lng: -98.4936 },
    capacity: 3500,
    currentOccupancy: 3200,
    facilities: [],
    employeeCount: 3200,
    productionCapacity: 280000,
    specialization: ['Tundra', 'Sequoia'],
  },
  {
    id: 'calty-california',
    name: 'Calty Design Research',
    type: 'design_studio',
    country: 'USA',
    region: 'California',
    city: 'Newport Beach',
    coordinates: { lat: 33.6189, lng: -117.9298 },
    capacity: 500,
    currentOccupancy: 450,
    facilities: [],
    employeeCount: 450,
    specialization: ['Vehicle Design', 'Concept Cars'],
  },
  // Europe
  {
    id: 'tme-brussels',
    name: 'Toyota Motor Europe',
    type: 'regional_hq',
    country: 'Belgium',
    region: 'Brussels',
    city: 'Brussels',
    coordinates: { lat: 50.8503, lng: 4.3517 },
    capacity: 3000,
    currentOccupancy: 2800,
    facilities: [],
    employeeCount: 2800,
    specialization: ['Europe Operations', 'Marketing'],
  },
  {
    id: 'tmuk-burnaston',
    name: 'Toyota Manufacturing UK',
    type: 'manufacturing_plant',
    country: 'UK',
    region: 'Derbyshire',
    city: 'Burnaston',
    coordinates: { lat: 52.8622, lng: -1.6014 },
    capacity: 4000,
    currentOccupancy: 3500,
    facilities: [],
    employeeCount: 3500,
    productionCapacity: 180000,
    specialization: ['Corolla', 'C-HR'],
  },
  {
    id: 'tmmf-france',
    name: 'Toyota Motor Manufacturing France',
    type: 'manufacturing_plant',
    country: 'France',
    region: 'Nord',
    city: 'Valenciennes',
    coordinates: { lat: 50.3518, lng: 3.5234 },
    capacity: 5000,
    currentOccupancy: 4500,
    facilities: [],
    employeeCount: 4500,
    productionCapacity: 300000,
    specialization: ['Yaris', 'Yaris Cross'],
  },
  // Asia Pacific
  {
    id: 'tmc-thailand',
    name: 'Toyota Motor Thailand',
    type: 'manufacturing_plant',
    country: 'Thailand',
    region: 'Chonburi',
    city: 'Chachoengsao',
    coordinates: { lat: 13.6904, lng: 101.0779 },
    capacity: 8000,
    currentOccupancy: 7500,
    facilities: [],
    employeeCount: 7500,
    productionCapacity: 600000,
    specialization: ['Hilux', 'Fortuner', 'Corolla Cross'],
  },
  {
    id: 'tmci-china',
    name: 'Toyota Motor China',
    type: 'regional_hq',
    country: 'China',
    region: 'Beijing',
    city: 'Beijing',
    coordinates: { lat: 39.9042, lng: 116.4074 },
    capacity: 5000,
    currentOccupancy: 4500,
    facilities: [],
    employeeCount: 4500,
    specialization: ['China Operations', 'Local Models'],
  },
  {
    id: 'tki-indonesia',
    name: 'Toyota Motor Manufacturing Indonesia',
    type: 'manufacturing_plant',
    country: 'Indonesia',
    region: 'West Java',
    city: 'Karawang',
    coordinates: { lat: -6.3225, lng: 107.3017 },
    capacity: 6000,
    currentOccupancy: 5500,
    facilities: [],
    employeeCount: 5500,
    productionCapacity: 250000,
    specialization: ['Kijang Innova', 'Avanza', 'Rush'],
  },
];

// ============================================================================
// TOYOTA VEHICLE MODELS
// ============================================================================

export const TOYOTA_VEHICLE_MODELS: Partial<VehicleModel>[] = [
  // Sedans
  { name: 'Camry', brand: 'Toyota', type: 'sedan', annualTarget: 450000 },
  { name: 'Corolla', brand: 'Toyota', type: 'sedan', annualTarget: 1200000 },
  { name: 'Crown', brand: 'Toyota', type: 'sedan', annualTarget: 100000 },
  { name: 'Avalon', brand: 'Toyota', type: 'sedan', annualTarget: 80000 },
  // SUVs & Crossovers
  { name: 'RAV4', brand: 'Toyota', type: 'suv', annualTarget: 900000 },
  { name: 'Highlander', brand: 'Toyota', type: 'suv', annualTarget: 350000 },
  { name: 'Land Cruiser', brand: 'Toyota', type: 'suv', annualTarget: 200000 },
  { name: '4Runner', brand: 'Toyota', type: 'suv', annualTarget: 150000 },
  { name: 'Sequoia', brand: 'Toyota', type: 'suv', annualTarget: 50000 },
  { name: 'Venza', brand: 'Toyota', type: 'crossover', annualTarget: 120000 },
  { name: 'C-HR', brand: 'Toyota', type: 'crossover', annualTarget: 200000 },
  { name: 'Corolla Cross', brand: 'Toyota', type: 'crossover', annualTarget: 300000 },
  // Trucks
  { name: 'Tacoma', brand: 'Toyota', type: 'truck', annualTarget: 280000 },
  { name: 'Tundra', brand: 'Toyota', type: 'truck', annualTarget: 130000 },
  { name: 'Hilux', brand: 'Toyota', type: 'truck', annualTarget: 850000 },
  // Hybrids & EVs
  { name: 'Prius', brand: 'Toyota', type: 'hybrid', annualTarget: 300000 },
  { name: 'bZ4X', brand: 'Toyota', type: 'electric', annualTarget: 150000 },
  { name: 'Mirai', brand: 'Toyota', type: 'fuel_cell', annualTarget: 30000 },
  // Minivans
  { name: 'Sienna', brand: 'Toyota', type: 'minivan', annualTarget: 150000 },
  { name: 'Alphard', brand: 'Toyota', type: 'minivan', annualTarget: 200000 },
  // Sports
  { name: 'GR Supra', brand: 'Toyota', type: 'sports', annualTarget: 50000 },
  { name: 'GR86', brand: 'Toyota', type: 'sports', annualTarget: 40000 },
  { name: 'GR Corolla', brand: 'Toyota', type: 'sports', annualTarget: 25000 },
  // Lexus
  { name: 'ES', brand: 'Lexus', type: 'sedan', annualTarget: 150000 },
  { name: 'LS', brand: 'Lexus', type: 'sedan', annualTarget: 30000 },
  { name: 'IS', brand: 'Lexus', type: 'sedan', annualTarget: 70000 },
  { name: 'RX', brand: 'Lexus', type: 'suv', annualTarget: 200000 },
  { name: 'NX', brand: 'Lexus', type: 'crossover', annualTarget: 180000 },
  { name: 'LX', brand: 'Lexus', type: 'suv', annualTarget: 50000 },
  { name: 'GX', brand: 'Lexus', type: 'suv', annualTarget: 80000 },
  { name: 'LC', brand: 'Lexus', type: 'sports', annualTarget: 15000 },
  { name: 'RC', brand: 'Lexus', type: 'sports', annualTarget: 20000 },
  { name: 'RZ', brand: 'Lexus', type: 'electric', annualTarget: 50000 },
];

// ============================================================================
// DEPARTMENT STRUCTURE
// ============================================================================

export interface DepartmentConfig {
  name: string;
  department: Department;
  headcount: number;
  subDepartments: string[];
  roles: { type: AgentType; count: number; title: string }[];
}

export const DEPARTMENT_CONFIGS: DepartmentConfig[] = [
  {
    name: 'Executive Board',
    department: 'executive_board',
    headcount: 50,
    subDepartments: ['Office of the CEO', 'Board Secretariat', 'Strategy Office'],
    roles: [
      { type: 'executive', count: 15, title: 'Board Member' },
      { type: 'manager', count: 20, title: 'Executive Assistant' },
      { type: 'hr_specialist', count: 15, title: 'Executive Support' },
    ],
  },
  {
    name: 'Research & Development',
    department: 'research_development',
    headcount: 45000,
    subDepartments: [
      'Advanced Technology',
      'Powertrain Development',
      'Vehicle Development',
      'EV/Hydrogen Research',
      'Connected Technologies',
      'Autonomous Driving',
      'Materials Science',
      'Safety Research',
    ],
    roles: [
      { type: 'research_scientist', count: 8000, title: 'Research Engineer' },
      { type: 'engineer', count: 25000, title: 'Development Engineer' },
      { type: 'designer', count: 5000, title: 'Product Designer' },
      { type: 'manager', count: 4000, title: 'R&D Manager' },
      { type: 'it_specialist', count: 3000, title: 'Systems Engineer' },
    ],
  },
  {
    name: 'Manufacturing',
    department: 'manufacturing',
    headcount: 180000,
    subDepartments: [
      'Body Assembly',
      'Paint Operations',
      'Final Assembly',
      'Powertrain Manufacturing',
      'Stamping',
      'Production Engineering',
      'Plant Maintenance',
      'Production Planning',
    ],
    roles: [
      { type: 'production_worker', count: 140000, title: 'Production Associate' },
      { type: 'manager', count: 15000, title: 'Production Supervisor' },
      { type: 'engineer', count: 12000, title: 'Manufacturing Engineer' },
      { type: 'quality_inspector', count: 8000, title: 'Quality Technician' },
      { type: 'maintenance_technician', count: 5000, title: 'Maintenance Tech' },
    ],
  },
  {
    name: 'Quality Assurance',
    department: 'quality_assurance',
    headcount: 25000,
    subDepartments: [
      'Incoming Quality',
      'In-Process Quality',
      'Final Quality',
      'Customer Quality',
      'Quality Systems',
      'Supplier Quality',
    ],
    roles: [
      { type: 'quality_inspector', count: 18000, title: 'Quality Inspector' },
      { type: 'engineer', count: 4000, title: 'Quality Engineer' },
      { type: 'manager', count: 2000, title: 'Quality Manager' },
      { type: 'it_specialist', count: 1000, title: 'Quality Systems Analyst' },
    ],
  },
  {
    name: 'Supply Chain',
    department: 'supply_chain',
    headcount: 35000,
    subDepartments: [
      'Procurement',
      'Supplier Development',
      'Logistics',
      'Inventory Management',
      'Demand Planning',
      'Import/Export',
    ],
    roles: [
      { type: 'logistics_coordinator', count: 15000, title: 'Logistics Specialist' },
      { type: 'supplier_liaison', count: 10000, title: 'Supplier Manager' },
      { type: 'manager', count: 5000, title: 'Supply Chain Manager' },
      { type: 'finance_analyst', count: 3000, title: 'Procurement Analyst' },
      { type: 'it_specialist', count: 2000, title: 'Supply Chain Systems' },
    ],
  },
  {
    name: 'Sales & Marketing',
    department: 'sales_marketing',
    headcount: 45000,
    subDepartments: [
      'Domestic Sales',
      'International Sales',
      'Marketing Communications',
      'Digital Marketing',
      'Brand Management',
      'Dealer Relations',
    ],
    roles: [
      { type: 'sales_representative', count: 30000, title: 'Sales Specialist' },
      { type: 'manager', count: 8000, title: 'Sales Manager' },
      { type: 'designer', count: 3000, title: 'Marketing Designer' },
      { type: 'it_specialist', count: 2000, title: 'Digital Marketing Specialist' },
      { type: 'finance_analyst', count: 2000, title: 'Sales Analyst' },
    ],
  },
  {
    name: 'Customer Service',
    department: 'customer_service',
    headcount: 20000,
    subDepartments: [
      'Customer Support',
      'Technical Support',
      'Warranty Administration',
      'Customer Experience',
      'Call Center Operations',
    ],
    roles: [
      { type: 'customer_service', count: 15000, title: 'Customer Service Rep' },
      { type: 'manager', count: 2500, title: 'Service Manager' },
      { type: 'engineer', count: 1500, title: 'Technical Support Engineer' },
      { type: 'it_specialist', count: 1000, title: 'Support Systems Specialist' },
    ],
  },
  {
    name: 'Human Resources',
    department: 'human_resources',
    headcount: 8000,
    subDepartments: [
      'Talent Acquisition',
      'Training & Development',
      'Compensation & Benefits',
      'Employee Relations',
      'HR Operations',
    ],
    roles: [
      { type: 'hr_specialist', count: 6000, title: 'HR Specialist' },
      { type: 'manager', count: 1500, title: 'HR Manager' },
      { type: 'it_specialist', count: 500, title: 'HRIS Analyst' },
    ],
  },
  {
    name: 'Finance',
    department: 'finance',
    headcount: 12000,
    subDepartments: [
      'Accounting',
      'Financial Planning',
      'Treasury',
      'Tax',
      'Internal Audit',
      'Investor Relations',
    ],
    roles: [
      { type: 'finance_analyst', count: 8000, title: 'Financial Analyst' },
      { type: 'manager', count: 3000, title: 'Finance Manager' },
      { type: 'it_specialist', count: 1000, title: 'Financial Systems Analyst' },
    ],
  },
  {
    name: 'Information Technology',
    department: 'information_technology',
    headcount: 15000,
    subDepartments: [
      'Enterprise Systems',
      'Manufacturing IT',
      'Cybersecurity',
      'Infrastructure',
      'Application Development',
      'Data Analytics',
    ],
    roles: [
      { type: 'it_specialist', count: 12000, title: 'IT Specialist' },
      { type: 'engineer', count: 2000, title: 'Software Engineer' },
      { type: 'manager', count: 1000, title: 'IT Manager' },
    ],
  },
  {
    name: 'Toyota Production System',
    department: 'toyota_production_system',
    headcount: 5000,
    subDepartments: [
      'TPS Training',
      'Kaizen Promotion',
      'Lean Operations',
      'Standardization',
    ],
    roles: [
      { type: 'engineer', count: 2500, title: 'TPS Specialist' },
      { type: 'manager', count: 1500, title: 'TPS Trainer' },
      { type: 'production_worker', count: 1000, title: 'Kaizen Leader' },
    ],
  },
  {
    name: 'Woven Planet (Mobility)',
    department: 'woven_planet',
    headcount: 3000,
    subDepartments: [
      'Autonomous Driving',
      'Woven City',
      'Arene Platform',
      'Mapping',
    ],
    roles: [
      { type: 'engineer', count: 2000, title: 'Mobility Engineer' },
      { type: 'research_scientist', count: 600, title: 'AI Researcher' },
      { type: 'designer', count: 200, title: 'UX Designer' },
      { type: 'manager', count: 200, title: 'Program Manager' },
    ],
  },
];

// ============================================================================
// JAPANESE NAMES GENERATOR
// ============================================================================

const JAPANESE_SURNAMES = [
  'Tanaka', 'Yamamoto', 'Watanabe', 'Suzuki', 'Sato', 'Takahashi', 'Kobayashi',
  'Ito', 'Nakamura', 'Yamada', 'Sasaki', 'Yamaguchi', 'Matsumoto', 'Inoue',
  'Kimura', 'Hayashi', 'Shimizu', 'Yamazaki', 'Mori', 'Abe', 'Ikeda', 'Hashimoto',
  'Ishikawa', 'Ogawa', 'Yoshida', 'Fujita', 'Okada', 'Goto', 'Hasegawa', 'Murakami',
  'Kondo', 'Ishii', 'Saito', 'Sakamoto', 'Endo', 'Aoki', 'Fujii', 'Nishimura',
  'Fukuda', 'Ota', 'Miura', 'Fujiwara', 'Okamoto', 'Matsuda', 'Nakagawa', 'Nakano',
  'Harada', 'Ono', 'Tamura', 'Takeuchi', 'Kaneko', 'Wada', 'Morita', 'Ishida',
];

const JAPANESE_GIVEN_NAMES_MALE = [
  'Takeshi', 'Hiroshi', 'Kenji', 'Yuki', 'Daisuke', 'Takumi', 'Ryo', 'Shota',
  'Kazuki', 'Naoki', 'Yuto', 'Kenta', 'Sho', 'Taro', 'Akira', 'Satoshi',
  'Makoto', 'Masashi', 'Koji', 'Shinji', 'Tetsuya', 'Nobuo', 'Hideki', 'Tomoya',
  'Ryota', 'Haruki', 'Kaito', 'Ren', 'Sota', 'Hayato', 'Yuma', 'Daiki',
];

const JAPANESE_GIVEN_NAMES_FEMALE = [
  'Yuki', 'Sakura', 'Aiko', 'Hana', 'Misaki', 'Haruka', 'Ayumi', 'Rina',
  'Mai', 'Yui', 'Mika', 'Nana', 'Emi', 'Kana', 'Saki', 'Momoko',
  'Keiko', 'Noriko', 'Tomoko', 'Michiko', 'Yoko', 'Akiko', 'Reiko', 'Kumiko',
  'Hikari', 'Nanami', 'Risa', 'Megumi', 'Asuka', 'Shiori', 'Mayu', 'Honoka',
];

const INTERNATIONAL_SURNAMES = [
  // American
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson',
  'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia',
  // European
  'Mueller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker',
  'Dubois', 'Leroy', 'Moreau', 'Laurent', 'Simon', 'Michel', 'Bernard', 'Robert',
  // Asian
  'Kim', 'Lee', 'Park', 'Choi', 'Chen', 'Wang', 'Li', 'Zhang', 'Liu', 'Yang',
  // Other
  'Silva', 'Santos', 'Oliveira', 'Kumar', 'Singh', 'Patel', 'Nguyen', 'Tran',
];

const INTERNATIONAL_GIVEN_NAMES_MALE = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
  'Thomas', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven',
  'Hans', 'Klaus', 'Pierre', 'Jean', 'Marco', 'Giuseppe', 'Carlos', 'Pedro',
  'Wei', 'Jun', 'Min', 'Sanjay', 'Raj', 'Amit', 'Tuan', 'Minh',
];

const INTERNATIONAL_GIVEN_NAMES_FEMALE = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica',
  'Sarah', 'Karen', 'Nancy', 'Lisa', 'Betty', 'Margaret', 'Sandra', 'Ashley',
  'Anna', 'Maria', 'Sophie', 'Emma', 'Marie', 'Laura', 'Isabella', 'Lucia',
  'Mei', 'Yan', 'Lin', 'Priya', 'Anita', 'Deepa', 'Linh', 'Thao',
];

export class NameGenerator {
  private seed: number;
  private counter: number = 0;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  private random(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  private pick<T>(array: T[]): T {
    return array[Math.floor(this.random() * array.length)];
  }

  generateJapaneseName(): string {
    const isMale = this.random() > 0.35; // 65% male (reflecting Toyota's actual ratio)
    const surname = this.pick(JAPANESE_SURNAMES);
    const givenName = isMale
      ? this.pick(JAPANESE_GIVEN_NAMES_MALE)
      : this.pick(JAPANESE_GIVEN_NAMES_FEMALE);
    return `${surname} ${givenName}`;
  }

  generateInternationalName(): string {
    const isMale = this.random() > 0.35;
    const surname = this.pick(INTERNATIONAL_SURNAMES);
    const givenName = isMale
      ? this.pick(INTERNATIONAL_GIVEN_NAMES_MALE)
      : this.pick(INTERNATIONAL_GIVEN_NAMES_FEMALE);
    return `${givenName} ${surname}`;
  }

  generateName(isJapan: boolean): string {
    this.counter++;
    return isJapan ? this.generateJapaneseName() : this.generateInternationalName();
  }
}

// ============================================================================
// ORGANIZATIONAL GENERATOR
// ============================================================================

export class OrganizationalStructureGenerator {
  private nameGenerator: NameGenerator;
  private agentIdCounter: number = 0;

  constructor(seed: number = 42) {
    this.nameGenerator = new NameGenerator(seed);
  }

  /**
   * Generate the complete Toyota organization
   */
  generateOrganization(targetEmployees: number = 370000): {
    agents: ToyotaAgent[];
    locations: ToyotaLocation[];
    divisions: Division[];
    vehicleModels: VehicleModel[];
  } {
    console.log(`Generating Toyota organization with ${targetEmployees.toLocaleString()} employees...`);

    const agents: ToyotaAgent[] = [];
    const divisions: Division[] = [];

    // Generate executives first
    const executives = this.generateExecutives();
    agents.push(...executives);

    // Calculate scaling factor
    const baseHeadcount = DEPARTMENT_CONFIGS.reduce((sum, d) => sum + d.headcount, 0);
    const scaleFactor = targetEmployees / baseHeadcount;

    // Generate each department
    for (const deptConfig of DEPARTMENT_CONFIGS) {
      const scaledHeadcount = Math.floor(deptConfig.headcount * scaleFactor);
      const { departmentAgents, departmentDivisions } = this.generateDepartment(deptConfig, scaledHeadcount);
      agents.push(...departmentAgents);
      divisions.push(...departmentDivisions);
    }

    // Generate vehicle models
    const vehicleModels = this.generateVehicleModels();

    console.log(`Generated ${agents.length.toLocaleString()} agents across ${divisions.length} divisions`);

    return {
      agents,
      locations: TOYOTA_LOCATIONS,
      divisions,
      vehicleModels,
    };
  }

  private generateExecutives(): ToyotaAgent[] {
    return TOYOTA_EXECUTIVES.map(exec => new ToyotaAgent({
      id: `exec-${++this.agentIdCounter}`,
      name: exec.name,
      type: exec.type,
      role: exec.title,
      department: exec.department,
      location: TOYOTA_LOCATIONS[0], // HQ
    }));
  }

  private generateDepartment(
    config: DepartmentConfig,
    targetHeadcount: number
  ): { departmentAgents: ToyotaAgent[]; departmentDivisions: Division[] } {
    const departmentAgents: ToyotaAgent[] = [];
    const departmentDivisions: Division[] = [];

    // Calculate role distribution
    const totalConfigured = config.roles.reduce((sum, r) => sum + r.count, 0);

    for (const role of config.roles) {
      const roleCount = Math.floor((role.count / totalConfigured) * targetHeadcount);

      // Distribute across locations
      const relevantLocations = this.getRelevantLocations(config.department);

      for (let i = 0; i < roleCount; i++) {
        const location = relevantLocations[i % relevantLocations.length];
        const isJapan = location.country === 'Japan';

        const agent = new ToyotaAgent({
          id: `agent-${++this.agentIdCounter}`,
          name: this.nameGenerator.generateName(isJapan),
          type: role.type,
          role: role.title,
          department: config.department,
          location,
        });

        departmentAgents.push(agent);
      }
    }

    // Create divisions
    for (const subDept of config.subDepartments) {
      const divisionAgents = departmentAgents.slice(0, Math.floor(departmentAgents.length / config.subDepartments.length));

      departmentDivisions.push({
        id: uuidv4(),
        name: subDept,
        department: config.department,
        parentDivision: null,
        head: divisionAgents[0]?.id || '',
        employees: divisionAgents.map(a => a.id),
        budget: Math.floor(Math.random() * 1000000000),
        kpis: this.generateKPIs(config.department),
      });
    }

    return { departmentAgents, departmentDivisions };
  }

  private getRelevantLocations(department: Department): ToyotaLocation[] {
    const typeMapping: Partial<Record<Department, LocationType[]>> = {
      manufacturing: ['manufacturing_plant', 'assembly_plant'],
      research_development: ['r_and_d_center', 'design_studio', 'headquarters'],
      sales_marketing: ['regional_hq', 'dealership', 'headquarters'],
      supply_chain: ['distribution_center', 'parts_center', 'manufacturing_plant'],
      quality_assurance: ['manufacturing_plant', 'test_facility'],
    };

    const relevantTypes = typeMapping[department] || ['headquarters', 'regional_hq'];
    const locations = TOYOTA_LOCATIONS.filter(l => relevantTypes.includes(l.type));

    return locations.length > 0 ? locations : TOYOTA_LOCATIONS;
  }

  private generateKPIs(department: Department): KPI[] {
    const kpiTemplates: Partial<Record<Department, KPI[]>> = {
      manufacturing: [
        { name: 'Units Produced', target: 1000, current: 950, unit: 'vehicles/day', trend: 'stable' },
        { name: 'First Time Quality', target: 98, current: 97.5, unit: '%', trend: 'improving' },
        { name: 'OEE', target: 85, current: 82, unit: '%', trend: 'stable' },
        { name: 'Safety Incidents', target: 0, current: 2, unit: 'incidents/month', trend: 'improving' },
      ],
      quality_assurance: [
        { name: 'Defect Rate', target: 0.5, current: 0.8, unit: 'PPM', trend: 'improving' },
        { name: 'Customer Returns', target: 100, current: 150, unit: 'units/month', trend: 'stable' },
        { name: 'Supplier Quality', target: 99, current: 98.5, unit: '%', trend: 'improving' },
      ],
      sales_marketing: [
        { name: 'Market Share', target: 15, current: 14.2, unit: '%', trend: 'stable' },
        { name: 'Customer Satisfaction', target: 95, current: 92, unit: '%', trend: 'improving' },
        { name: 'Units Sold', target: 10000000, current: 9500000, unit: 'vehicles/year', trend: 'improving' },
      ],
    };

    return kpiTemplates[department] || [
      { name: 'Performance', target: 100, current: 85, unit: '%', trend: 'stable' },
    ];
  }

  private generateVehicleModels(): VehicleModel[] {
    return TOYOTA_VEHICLE_MODELS.map((model, idx) => ({
      id: `model-${idx + 1}`,
      name: model.name!,
      brand: model.brand!,
      type: model.type!,
      platform: `TNGA-${model.type?.charAt(0).toUpperCase()}`,
      variants: ['Base', 'XLE', 'Limited'],
      productionLocations: [],
      annualTarget: model.annualTarget!,
      currentYearProduction: Math.floor(model.annualTarget! * (0.4 + Math.random() * 0.3)),
      bom: {
        vehicleModel: model.name!,
        components: [],
        totalParts: 30000,
        estimatedCost: 15000 + Math.random() * 20000,
      },
    }));
  }
}

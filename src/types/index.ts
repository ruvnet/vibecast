/**
 * Toyota Motor Company Simulation - Core Types
 * Comprehensive type definitions for simulating the entire organization
 */

// ============================================================================
// AGENT TYPES
// ============================================================================

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  role: string;
  department: Department;
  location: Location;
  skills: Skill[];
  relationships: Relationship[];
  memory: Memory;
  state: AgentState;
  learningRate: number;
  performance: PerformanceMetrics;
  createdAt: Date;
  lastActiveAt: Date;
}

export type AgentType =
  | 'executive'
  | 'manager'
  | 'engineer'
  | 'designer'
  | 'production_worker'
  | 'quality_inspector'
  | 'logistics_coordinator'
  | 'sales_representative'
  | 'customer_service'
  | 'research_scientist'
  | 'supplier_liaison'
  | 'hr_specialist'
  | 'finance_analyst'
  | 'it_specialist'
  | 'maintenance_technician';

export interface AgentState {
  status: 'active' | 'idle' | 'busy' | 'learning' | 'collaborating' | 'offline';
  currentTask: Task | null;
  energy: number; // 0-100
  morale: number; // 0-100
  stress: number; // 0-100
  expertise: Map<string, number>; // skill -> proficiency
}

export interface Memory {
  shortTerm: MemoryItem[];
  longTerm: MemoryItem[];
  episodic: Episode[];
  semantic: KnowledgeGraph;
  procedural: Procedure[];
}

export interface MemoryItem {
  id: string;
  content: string;
  type: 'observation' | 'decision' | 'outcome' | 'learning';
  importance: number;
  timestamp: Date;
  associations: string[];
  reinforcement: number;
}

export interface Episode {
  id: string;
  description: string;
  participants: string[];
  outcome: string;
  lessonsLearned: string[];
  emotionalValence: number;
  timestamp: Date;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface KnowledgeNode {
  id: string;
  concept: string;
  type: 'fact' | 'skill' | 'relationship' | 'process';
  confidence: number;
  lastUpdated: Date;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  relationship: string;
  strength: number;
}

export interface Procedure {
  id: string;
  name: string;
  steps: string[];
  successRate: number;
  executionCount: number;
}

// ============================================================================
// ORGANIZATIONAL STRUCTURE
// ============================================================================

export type Department =
  | 'executive_board'
  | 'toyota_motor_corporation'
  | 'lexus_international'
  | 'gazoo_racing'
  | 'research_development'
  | 'manufacturing'
  | 'quality_assurance'
  | 'supply_chain'
  | 'sales_marketing'
  | 'customer_service'
  | 'human_resources'
  | 'finance'
  | 'information_technology'
  | 'legal_compliance'
  | 'environmental_sustainability'
  | 'toyota_production_system'
  | 'connected_technologies'
  | 'mobility_services'
  | 'woven_planet'
  | 'daihatsu_motor'
  | 'hino_motors';

export interface Division {
  id: string;
  name: string;
  department: Department;
  parentDivision: string | null;
  head: string; // agent id
  employees: string[];
  budget: number;
  kpis: KPI[];
}

export interface KPI {
  name: string;
  target: number;
  current: number;
  unit: string;
  trend: 'improving' | 'stable' | 'declining';
}

// ============================================================================
// LOCATIONS
// ============================================================================

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  country: string;
  region: string;
  city: string;
  coordinates: { lat: number; lng: number };
  capacity: number;
  currentOccupancy: number;
  facilities: Facility[];
}

export type LocationType =
  | 'headquarters'
  | 'regional_hq'
  | 'manufacturing_plant'
  | 'assembly_plant'
  | 'r_and_d_center'
  | 'design_studio'
  | 'distribution_center'
  | 'dealership'
  | 'parts_center'
  | 'test_facility'
  | 'supplier_facility';

export interface Facility {
  id: string;
  name: string;
  type: string;
  capacity: number;
  status: 'operational' | 'maintenance' | 'offline';
  equipment: Equipment[];
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  status: 'running' | 'idle' | 'maintenance' | 'broken';
  efficiency: number;
  lastMaintenance: Date;
}

// ============================================================================
// MANUFACTURING & PRODUCTION
// ============================================================================

export interface ProductionLine {
  id: string;
  name: string;
  location: string;
  vehicleModels: string[];
  capacity: number; // vehicles per day
  currentOutput: number;
  efficiency: number;
  workers: string[];
  equipment: Equipment[];
  status: ProductionStatus;
}

export type ProductionStatus =
  | 'running'
  | 'changeover'
  | 'maintenance'
  | 'stopped'
  | 'quality_hold';

export interface VehicleModel {
  id: string;
  name: string;
  brand: 'Toyota' | 'Lexus' | 'Daihatsu' | 'Hino';
  type: VehicleType;
  platform: string;
  variants: string[];
  productionLocations: string[];
  annualTarget: number;
  currentYearProduction: number;
  bom: BillOfMaterials;
}

export type VehicleType =
  | 'sedan'
  | 'suv'
  | 'crossover'
  | 'truck'
  | 'minivan'
  | 'sports'
  | 'hatchback'
  | 'hybrid'
  | 'electric'
  | 'fuel_cell'
  | 'commercial';

export interface BillOfMaterials {
  vehicleModel: string;
  components: Component[];
  totalParts: number;
  estimatedCost: number;
}

export interface Component {
  id: string;
  name: string;
  category: ComponentCategory;
  supplier: string;
  quantity: number;
  unitCost: number;
  leadTime: number; // days
  criticalPath: boolean;
}

export type ComponentCategory =
  | 'powertrain'
  | 'chassis'
  | 'body'
  | 'interior'
  | 'electronics'
  | 'safety_systems'
  | 'hvac'
  | 'lighting'
  | 'wheels_tires'
  | 'fluid_systems'
  | 'battery_ev'
  | 'fuel_cell';

// ============================================================================
// SUPPLY CHAIN
// ============================================================================

export interface Supplier {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  category: SupplierCategory;
  location: Location;
  relationship: SupplierRelationship;
  components: string[];
  contracts: Contract[];
  performance: SupplierPerformance;
  agents: Agent[];
}

export type SupplierCategory =
  | 'powertrain_components'
  | 'body_stamping'
  | 'electronics'
  | 'interior_components'
  | 'chassis_suspension'
  | 'glass'
  | 'lighting'
  | 'hvac_systems'
  | 'battery_cells'
  | 'semiconductors'
  | 'raw_materials'
  | 'chemicals'
  | 'logistics';

export interface SupplierRelationship {
  type: 'keiretsu' | 'partner' | 'preferred' | 'approved' | 'new';
  startDate: Date;
  investmentLevel: number;
  jointDevelopment: boolean;
  exclusivity: boolean;
  trustScore: number;
}

export interface SupplierPerformance {
  qualityScore: number;
  deliveryScore: number;
  costScore: number;
  flexibilityScore: number;
  innovationScore: number;
  overallRating: number;
  defectRate: number;
  onTimeDeliveryRate: number;
}

export interface Contract {
  id: string;
  supplierId: string;
  components: string[];
  startDate: Date;
  endDate: Date;
  annualVolume: number;
  priceAgreement: PriceAgreement;
  qualityRequirements: QualityRequirements;
  status: 'active' | 'negotiating' | 'expiring' | 'terminated';
}

export interface PriceAgreement {
  basePrice: number;
  currency: string;
  escalationClause: boolean;
  volumeDiscounts: VolumeDiscount[];
}

export interface VolumeDiscount {
  threshold: number;
  discountPercent: number;
}

export interface QualityRequirements {
  defectRateMax: number;
  cpkMinimum: number;
  inspectionProtocol: string;
  certifications: string[];
}

// ============================================================================
// SKILLS & RELATIONSHIPS
// ============================================================================

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  level: number; // 1-100
  experience: number; // years
  certifications: string[];
  lastUsed: Date;
}

export type SkillCategory =
  | 'technical'
  | 'management'
  | 'communication'
  | 'problem_solving'
  | 'manufacturing'
  | 'quality'
  | 'design'
  | 'research'
  | 'sales'
  | 'customer_service'
  | 'finance'
  | 'legal'
  | 'it';

export interface Relationship {
  targetAgentId: string;
  type: RelationshipType;
  strength: number; // 0-100
  trust: number; // 0-100
  collaboration: number;
  lastInteraction: Date;
  interactionCount: number;
}

export type RelationshipType =
  | 'supervisor'
  | 'subordinate'
  | 'peer'
  | 'mentor'
  | 'mentee'
  | 'collaborator'
  | 'supplier_contact'
  | 'customer_contact';

// ============================================================================
// TASKS & WORKFLOWS
// ============================================================================

export interface Task {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'failed';
  assignedTo: string[];
  dependencies: string[];
  estimatedDuration: number; // hours
  actualDuration: number;
  deadline: Date;
  createdAt: Date;
  completedAt: Date | null;
  outcome: TaskOutcome | null;
}

export type TaskType =
  | 'production'
  | 'quality_check'
  | 'maintenance'
  | 'research'
  | 'design'
  | 'meeting'
  | 'training'
  | 'supplier_management'
  | 'customer_service'
  | 'administrative'
  | 'problem_solving'
  | 'kaizen';

export interface TaskOutcome {
  success: boolean;
  results: Record<string, any>;
  lessonsLearned: string[];
  improvements: string[];
}

// ============================================================================
// PERFORMANCE & METRICS
// ============================================================================

export interface PerformanceMetrics {
  productivity: number;
  quality: number;
  efficiency: number;
  collaboration: number;
  innovation: number;
  learning: number;
  attendance: number;
  safetyRecord: number;
}

export interface OrganizationalMetrics {
  totalEmployees: number;
  totalSuppliers: number;
  vehiclesProducedToday: number;
  vehiclesProducedYTD: number;
  qualityScore: number;
  customerSatisfaction: number;
  marketShare: number;
  revenue: number;
  operatingProfit: number;
  carbonFootprint: number;
}

// ============================================================================
// LEARNING & ADAPTATION
// ============================================================================

export interface LearningEvent {
  id: string;
  agentId: string;
  type: LearningType;
  topic: string;
  source: string;
  outcome: number; // improvement score
  timestamp: Date;
  reinforcement: number;
}

export type LearningType =
  | 'experience'
  | 'observation'
  | 'training'
  | 'feedback'
  | 'collaboration'
  | 'failure_analysis'
  | 'success_reinforcement';

export interface AdaptationRule {
  id: string;
  condition: string;
  action: string;
  confidence: number;
  successRate: number;
  usageCount: number;
}

// ============================================================================
// SIMULATION
// ============================================================================

export interface SimulationConfig {
  name: string;
  seed: number;
  tickDuration: number; // milliseconds per simulation tick
  simulationSpeed: number; // ticks per real second
  startDate: Date;
  endDate: Date | null;
  employeeCount: number;
  supplierCount: number;
  enableLearning: boolean;
  enableKaizen: boolean;
  enableJIT: boolean;
  verbosity: 'quiet' | 'normal' | 'verbose' | 'debug';
}

export interface SimulationState {
  currentTick: number;
  currentDate: Date;
  isRunning: boolean;
  isPaused: boolean;
  agents: Map<string, Agent>;
  suppliers: Map<string, Supplier>;
  locations: Map<string, Location>;
  productionLines: Map<string, ProductionLine>;
  vehicleModels: Map<string, VehicleModel>;
  tasks: Map<string, Task>;
  events: SimulationEvent[];
  metrics: OrganizationalMetrics;
}

export interface SimulationEvent {
  id: string;
  tick: number;
  timestamp: Date;
  type: EventType;
  source: string;
  target: string | null;
  description: string;
  data: Record<string, any>;
  importance: 'critical' | 'high' | 'medium' | 'low';
}

export type EventType =
  | 'production_milestone'
  | 'quality_issue'
  | 'supply_disruption'
  | 'kaizen_improvement'
  | 'training_completed'
  | 'new_hire'
  | 'promotion'
  | 'supplier_issue'
  | 'customer_feedback'
  | 'market_change'
  | 'innovation'
  | 'safety_incident'
  | 'maintenance_required';

import Database from 'better-sqlite3';
import { FranchiseLocation, FinancialMetrics, OperationalMetrics, DatabaseConfig } from '../types';
import * as path from 'path';

/**
 * Database operations layer for franchise management
 */
export class FranchiseDatabase {
  private db: Database.Database;

  constructor(config: DatabaseConfig) {
    const dbPath = path.resolve(config.path);
    this.db = new Database(dbPath, { verbose: config.verbose ? console.log : undefined });
    this.initialize();
  }

  private initialize(): void {
    // Create locations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        zip_code TEXT NOT NULL,
        country TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        opened TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create financial metrics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS financial_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location_id TEXT NOT NULL,
        revenue REAL NOT NULL,
        expenses REAL NOT NULL,
        profit REAL NOT NULL,
        profit_margin REAL NOT NULL,
        period TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (location_id) REFERENCES locations(id)
      )
    `);

    // Create operational metrics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS operational_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location_id TEXT NOT NULL,
        employee_count INTEGER NOT NULL,
        customer_count INTEGER NOT NULL,
        avg_transaction_value REAL NOT NULL,
        customer_satisfaction_score REAL NOT NULL,
        operational_efficiency REAL NOT NULL,
        period TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (location_id) REFERENCES locations(id)
      )
    `);

    // Create growth opportunities table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS growth_opportunities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        potential_revenue REAL NOT NULL,
        investment_required REAL NOT NULL,
        roi REAL NOT NULL,
        timeframe TEXT NOT NULL,
        priority TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create analysis history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analysis_history (
        id TEXT PRIMARY KEY,
        analysis_type TEXT NOT NULL,
        results TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // Location operations
  addLocation(location: FranchiseLocation): void {
    const stmt = this.db.prepare(`
      INSERT INTO locations (id, name, address, city, state, zip_code, country, latitude, longitude, opened, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      location.id,
      location.name,
      location.address,
      location.city,
      location.state,
      location.zipCode,
      location.country,
      location.coordinates?.latitude || null,
      location.coordinates?.longitude || null,
      location.opened.toISOString(),
      location.status
    );
  }

  getLocation(id: string): FranchiseLocation | undefined {
    const stmt = this.db.prepare('SELECT * FROM locations WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return undefined;

    return {
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.city,
      state: row.state,
      zipCode: row.zip_code,
      country: row.country,
      coordinates: row.latitude ? { latitude: row.latitude, longitude: row.longitude } : undefined,
      opened: new Date(row.opened),
      status: row.status
    };
  }

  getAllLocations(): FranchiseLocation[] {
    const stmt = this.db.prepare('SELECT * FROM locations ORDER BY opened DESC');
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.city,
      state: row.state,
      zipCode: row.zip_code,
      country: row.country,
      coordinates: row.latitude ? { latitude: row.latitude, longitude: row.longitude } : undefined,
      opened: new Date(row.opened),
      status: row.status
    }));
  }

  updateLocationStatus(id: string, status: 'active' | 'pending' | 'closed'): void {
    const stmt = this.db.prepare('UPDATE locations SET status = ? WHERE id = ?');
    stmt.run(status, id);
  }

  // Financial metrics operations
  addFinancialMetrics(locationId: string, metrics: FinancialMetrics): void {
    const stmt = this.db.prepare(`
      INSERT INTO financial_metrics (location_id, revenue, expenses, profit, profit_margin, period)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      locationId,
      metrics.revenue,
      metrics.expenses,
      metrics.profit,
      metrics.profitMargin,
      metrics.period
    );
  }

  getFinancialMetrics(locationId: string, limit: number = 10): FinancialMetrics[] {
    const stmt = this.db.prepare(`
      SELECT * FROM financial_metrics 
      WHERE location_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    
    const rows = stmt.all(locationId, limit) as any[];
    
    return rows.map(row => ({
      revenue: row.revenue,
      expenses: row.expenses,
      profit: row.profit,
      profitMargin: row.profit_margin,
      period: row.period
    }));
  }

  // Operational metrics operations
  addOperationalMetrics(locationId: string, metrics: OperationalMetrics): void {
    const stmt = this.db.prepare(`
      INSERT INTO operational_metrics 
      (location_id, employee_count, customer_count, avg_transaction_value, customer_satisfaction_score, operational_efficiency, period)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      locationId,
      metrics.employeeCount,
      metrics.customerCount,
      metrics.averageTransactionValue,
      metrics.customerSatisfactionScore,
      metrics.operationalEfficiency,
      new Date().toISOString()
    );
  }

  getOperationalMetrics(locationId: string, limit: number = 10): OperationalMetrics[] {
    const stmt = this.db.prepare(`
      SELECT * FROM operational_metrics 
      WHERE location_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    
    const rows = stmt.all(locationId, limit) as any[];
    
    return rows.map(row => ({
      employeeCount: row.employee_count,
      customerCount: row.customer_count,
      averageTransactionValue: row.avg_transaction_value,
      customerSatisfactionScore: row.customer_satisfaction_score,
      operationalEfficiency: row.operational_efficiency
    }));
  }

  // Growth opportunities operations
  addGrowthOpportunity(opportunity: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO growth_opportunities 
      (id, type, description, potential_revenue, investment_required, roi, timeframe, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      opportunity.id,
      opportunity.type,
      opportunity.description,
      opportunity.potentialRevenue,
      opportunity.investmentRequired,
      opportunity.roi,
      opportunity.timeframe,
      opportunity.priority
    );
  }

  getGrowthOpportunities(limit: number = 20): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM growth_opportunities 
      ORDER BY roi DESC 
      LIMIT ?
    `);
    
    return stmt.all(limit) as any[];
  }

  // Analysis history
  saveAnalysis(id: string, type: string, results: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO analysis_history (id, analysis_type, results)
      VALUES (?, ?, ?)
    `);

    stmt.run(id, type, JSON.stringify(results));
  }

  getAnalysisHistory(limit: number = 10): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM analysis_history 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    
    return stmt.all(limit) as any[];
  }

  close(): void {
    this.db.close();
  }
}

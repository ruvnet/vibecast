import express, { Express, Request, Response, NextFunction } from 'express';
import { FranchiseManager } from '../core/FranchiseManager';
import { ApiConfig } from '../types';

/**
 * RESTful API Server for Franchise Management
 */
export class FranchiseApiServer {
  private app: Express;
  private franchiseManager: FranchiseManager;
  private config: ApiConfig;

  constructor(franchiseManager: FranchiseManager, config: ApiConfig) {
    this.franchiseManager = franchiseManager;
    this.config = {
      enableCors: true,
      corsOrigins: ['*'],
      enableAuth: false,
      ...config
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());

    // CORS
    if (this.config.enableCors) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        const origin = req.headers.origin;
        if (this.config.corsOrigins?.includes('*') || this.config.corsOrigins?.includes(origin || '')) {
          res.header('Access-Control-Allow-Origin', origin || '*');
          res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        }
        if (req.method === 'OPTIONS') {
          return res.sendStatus(200);
        }
        next();
      });
    }

    // Auth middleware
    if (this.config.enableAuth) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== this.config.apiKey) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
      });
    }

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('API Error:', err);
      res.status(500).json({ error: err.message });
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date() });
    });

    // Locations endpoints
    this.app.get('/api/locations', async (req: Request, res: Response) => {
      try {
        const locations = await this.franchiseManager.getAllLocations();
        res.json({ data: locations });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.get('/api/locations/:id', async (req: Request, res: Response) => {
      try {
        const location = await this.franchiseManager.getLocation(req.params.id);
        if (!location) {
          return res.status(404).json({ error: 'Location not found' });
        }
        res.json({ data: location });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.post('/api/locations', async (req: Request, res: Response) => {
      try {
        const location = await this.franchiseManager.addLocation(req.body);
        res.status(201).json({ data: location });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });

    this.app.put('/api/locations/:id/status', async (req: Request, res: Response) => {
      try {
        await this.franchiseManager.updateLocationStatus(req.params.id, req.body.status);
        res.json({ success: true });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });

    // Metrics endpoints
    this.app.get('/api/locations/:id/financial', async (req: Request, res: Response) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const metrics = await this.franchiseManager.getFinancialMetrics(req.params.id, limit);
        res.json({ data: metrics });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.post('/api/locations/:id/financial', async (req: Request, res: Response) => {
      try {
        await this.franchiseManager.addFinancialMetrics(req.params.id, req.body);
        res.status(201).json({ success: true });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });

    this.app.get('/api/locations/:id/operational', async (req: Request, res: Response) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const metrics = await this.franchiseManager.getOperationalMetrics(req.params.id, limit);
        res.json({ data: metrics });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.post('/api/locations/:id/operational', async (req: Request, res: Response) => {
      try {
        await this.franchiseManager.addOperationalMetrics(req.params.id, req.body);
        res.status(201).json({ success: true });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });

    // Analysis endpoints
    this.app.post('/api/analysis', async (req: Request, res: Response) => {
      try {
        const result = await this.franchiseManager.runAnalysis(req.body);
        res.json({ data: result });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });

    this.app.get('/api/analysis/history', async (req: Request, res: Response) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const history = await this.franchiseManager.getAnalysisHistory(limit);
        res.json({ data: history });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.get('/api/report', async (req: Request, res: Response) => {
      try {
        const report = await this.franchiseManager.getComprehensiveReport();
        res.json({ data: report });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    // Growth opportunities endpoints
    this.app.get('/api/opportunities', async (req: Request, res: Response) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const opportunities = await this.franchiseManager.getGrowthOpportunities(limit);
        res.json({ data: opportunities });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.post('/api/opportunities', async (req: Request, res: Response) => {
      try {
        const opportunity = await this.franchiseManager.addGrowthOpportunity(req.body);
        res.status(201).json({ data: opportunity });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });

    // Agent capabilities endpoint
    this.app.get('/api/agents', async (req: Request, res: Response) => {
      try {
        const capabilities = this.franchiseManager.getAgentCapabilities();
        res.json({ data: capabilities });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.config.port, () => {
        console.log('Franchise API Server listening on port ' + this.config.port);
        resolve();
      });
    });
  }

  getApp(): Express {
    return this.app;
  }
}

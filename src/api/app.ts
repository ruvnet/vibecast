import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { documentRoutes } from './routes/documentRoutes';
import { tracingMiddleware } from './middleware/tracingMiddleware';
import { errorMiddleware } from './middleware/errorMiddleware';

/**
 * Create and configure Express application
 * with Document Intake API routes
 */
export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet()); // Security headers
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
  }));

  // Request parsing
  app.use(express.json({ limit: '10mb' })); // JSON body parser
  app.use(express.urlencoded({ extended: true, limit: '10mb' })); // URL-encoded parser
  app.use(compression()); // Response compression

  // Global request tracing
  app.use(tracingMiddleware());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'flowmanager-document-intake',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // Readiness check endpoint
  app.get('/ready', async (req, res) => {
    // TODO: Check database, blob storage, and Redis connectivity
    const checks = {
      database: true, // Placeholder
      blobStorage: true, // Placeholder
      redis: true // Placeholder
    };

    const isReady = Object.values(checks).every(check => check === true);

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not ready',
      checks,
      timestamp: new Date().toISOString()
    });
  });

  // API routes
  app.use('/api/v1/documents', documentRoutes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      code: 'ENDPOINT_NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found`,
      availableEndpoints: [
        'POST /api/v1/documents/intake',
        'GET /api/v1/documents/:documentId',
        'GET /api/v1/documents/by-capture-request/:captureRequestId'
      ]
    });
  });

  // Global error handler (must be last)
  app.use(errorMiddleware);

  return app;
}

/**
 * Start the Express server
 */
export function startServer(port: number = 3000): void {
  const app = createApp();

  app.listen(port, () => {
    console.log(`FlowManager Document Intake API listening on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`API base URL: http://localhost:${port}/api/v1/documents`);
  });
}

// Start server if this file is run directly
if (require.main === module) {
  const port = parseInt(process.env.PORT || '3000', 10);
  startServer(port);
}

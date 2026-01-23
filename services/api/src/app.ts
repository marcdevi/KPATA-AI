/**
 * KPATA AI API Application
 * Express server with routing, validation, and middleware
 */

import express, { Express, Request, Response } from 'express';

import { logger } from './logger.js';
import { correlationMiddleware } from './middleware/correlation.js';
import { errorHandler } from './middleware/errorHandler.js';
import adminCreditsRoutes from './routes/admin/credits.js';
import adminDlqRoutes from './routes/admin/dlq.js';
import adminReportsRoutes from './routes/admin/reports.js';
import authRoutes from './routes/auth.js';
import contentRoutes from './routes/content.js';
import devRoutes from './routes/dev.js';
import jobsRoutes from './routes/jobs.js';
import meRoutes from './routes/me.js';
import paymentsRoutes from './routes/payments.js';
import termsRoutes from './routes/terms.js';

export function createApp(): Express {
  const app = express();

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Correlation ID middleware
  app.use(correlationMiddleware);

  // Request logging
  app.use((req: Request, res: Response, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
      logger.info('Request completed', {
        action: 'http_request',
        correlation_id: req.correlationId,
        user_id: req.user?.id,
        duration_ms: Date.now() - startTime,
        meta: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
        },
      });
    });

    next();
  });

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
    });
  });

  // API routes
  app.use('/auth', authRoutes);
  app.use('/me', meRoutes);
  app.use('/terms', termsRoutes);
  app.use('/jobs', jobsRoutes);
  app.use('/payments', paymentsRoutes);
  app.use('/admin/credits', adminCreditsRoutes);
  app.use('/admin/dlq', adminDlqRoutes);
  app.use('/admin/reports', adminReportsRoutes);
  app.use('/content', contentRoutes);
  app.use('/dev', devRoutes);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      },
    });
  });

  // Error handler
  app.use(errorHandler);

  return app;
}

export default createApp;

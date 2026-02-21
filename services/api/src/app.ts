/**
 * KPATA AI API Application
 * Express server with routing, validation, and middleware
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';

import { logger } from './logger.js';
import { authMiddleware } from './middleware/auth.js';
import { correlationMiddleware } from './middleware/correlation.js';
import { errorHandler } from './middleware/errorHandler.js';
import adminConfigRoutes from './routes/admin/config.js';
import adminCreditsRoutes from './routes/admin/credits.js';
import adminDashboardRoutes from './routes/admin/dashboard.js';
import adminDlqRoutes from './routes/admin/dlq.js';
import adminFinopsRoutes from './routes/admin/finops.js';
import adminJobsRoutes from './routes/admin/jobs.js';
import adminPricingRoutes from './routes/admin/pricing.js';
import adminQueueRoutes from './routes/admin/queue.js';
import adminReportsRoutes from './routes/admin/reports.js';
import adminTicketsRoutes from './routes/admin/tickets.js';
import adminUsersRoutes from './routes/admin/users.js';
import authRoutes from './routes/auth.js';
import contentRoutes from './routes/content.js';
import devRoutes from './routes/dev.js';
import jobsRoutes from './routes/jobs.js';
import mannequinsRoutes from './routes/mannequins.js';
import meRoutes from './routes/me.js';
import paymentsRoutes from './routes/payments.js';
import termsRoutes from './routes/terms.js';
import voiceRoutes from './routes/voice.js';

export function createApp(): Express {
  const app = express();

  // CORS configuration for PWA development and production
  app.use(cors({
    origin: [
      'http://localhost:3001',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:8081',
      'http://localhost:8082',
      'http://192.168.0.24:3001',
      'http://192.168.0.24:3003',
      'http://192.168.0.24:3004',
      'http://192.168.0.24:8081',
      'http://192.168.0.24:8082',
      'https://app.kpata-ai.online',
      'https://kpata-ai.online',
      'https://www.kpata-ai.online',
    ],
    credentials: true,
  }));

  // Body parsing - 50mb to support base64 image uploads (~37MB image = ~50MB base64)
  app.use(express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    },
  }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Correlation ID middleware
  app.use(correlationMiddleware);

  // Authentication middleware (populates req.user from Supabase token)
  app.use(authMiddleware);

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
  app.use('/mannequins', mannequinsRoutes);
  app.use('/payments', paymentsRoutes);
  app.use('/admin/config', adminConfigRoutes);
  app.use('/admin/credits', adminCreditsRoutes);
  app.use('/admin/dashboard', adminDashboardRoutes);
  app.use('/admin/dlq', adminDlqRoutes);
  app.use('/admin/finops', adminFinopsRoutes);
  app.use('/admin/jobs', adminJobsRoutes);
  app.use('/admin/pricing', adminPricingRoutes);
  app.use('/admin/queue', adminQueueRoutes);
  app.use('/admin/reports', adminReportsRoutes);
  app.use('/admin/tickets', adminTicketsRoutes);
  app.use('/admin/users', adminUsersRoutes);
  app.use('/voice', voiceRoutes);
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

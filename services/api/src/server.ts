/**
 * KPATA AI API Server Entry Point
 */

import { createApp } from './app.js';
import { logger } from './logger.js';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = createApp();

app.listen(Number(PORT), HOST, () => {
  logger.info('API server started', {
    action: 'server_start',
    meta: {
      port: PORT,
      host: HOST,
      environment: process.env.NODE_ENV || 'development',
    },
  });
});

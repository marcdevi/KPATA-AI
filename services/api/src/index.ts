import { JobStatus, ErrorCode } from '@kpata/shared';

import { logger } from './logger.js';

logger.info('API service starting', {
  action: 'startup',
  meta: {
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'development',
  },
});

logger.info('Shared types imported successfully', {
  action: 'import_check',
  meta: {
    sampleJobStatus: JobStatus.PENDING,
    sampleErrorCode: ErrorCode.SYSTEM_INTERNAL_ERROR,
  },
});

export { logger, createLogger } from './logger.js';

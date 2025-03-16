import { serve } from '@hono/node-server';
import { startServer } from './api-service.js';
import logger from './utils/logger.js';

const PORT = 6690;

async function main() {
  try {
    const app = await startServer();
    
    serve({
      fetch: app.fetch,
      port: PORT,
    });
    
    logger.info(`🚀 API Server is running at http://localhost:${PORT}`);
  } catch (error) {
    logger.error(`❌ Failed to start API server: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exit(1);
  }
}

main().catch(error => {
  logger.error(`❌ Unhandled error: ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exit(1);
}); 
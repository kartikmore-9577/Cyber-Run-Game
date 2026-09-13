import cors from '@fastify/cors';
import Fastify from 'fastify';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  });

  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'cyber-run-api',
    timestamp: new Date().toISOString(),
  }));

  return app;
}


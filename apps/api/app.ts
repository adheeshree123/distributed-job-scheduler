import express from 'express';
import { apiRouter } from './routes/index.ts';
import { errorHandler } from './middlewares/errorHandler.ts';

export function createApiApp(): express.Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API routing
  app.use('/api', apiRouter);

  // Error handling middleware
  app.use(errorHandler);

  return app;
}

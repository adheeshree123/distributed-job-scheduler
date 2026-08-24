import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './apps/api/app.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Mount API Application
  const apiApp = createApiApp();
  app.use(apiApp);

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Distributed Job Scheduler running on http://0.0.0.0:${PORT}`);
    console.log(`API Documentation available at http://0.0.0.0:${PORT}/api/docs`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { runSeed } from './db/seed';
import { wsManager } from './websocket/server';
import { errorHandler } from './middleware/errorHandler';

// Route imports
import authRouter from './routes/auth';
import staffRouter from './routes/staff';
import menuRouter from './routes/menu';
import tablesRouter from './routes/tables';
import reservationsRouter from './routes/reservations';
import ordersRouter from './routes/orders';
import kitchenRouter from './routes/kitchen';
import inventoryRouter from './routes/inventory';
import dashboardRouter from './routes/dashboard';

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/staff', staffRouter);
app.use('/api/menu', menuRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/kitchen', kitchenRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/dashboard', dashboardRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static build if it exists
if (fs.existsSync(config.clientDistPath)) {
  app.use(express.static(config.clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(config.clientDistPath, 'index.html'));
  });
}

// Global error handler
app.use(errorHandler);

// Initialize WebSockets
wsManager.init(server);

// Ensure DB schema and default fixtures exist
try {
  runSeed();
} catch (err) {
  console.error('Error running seed:', err);
}

// Start Server
if (process.env.NODE_ENV !== 'test_embedded') {
  server.listen(config.port, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Restaurant Management Server running on port ${config.port}`);
    console.log(`📡 REST API: http://localhost:${config.port}/api`);
    console.log(`⚡ WebSocket: ws://localhost:${config.port}/ws`);
    console.log(`======================================================\n`);
  });
}

export { app, server };
export default server;

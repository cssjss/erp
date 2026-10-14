const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { initializeDatabase } = require('./config/db');
const { requireAuth } = require('./middleware/auth');
const { router: authRoutes } = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const expressQueryRoutes = require('./routes/express-query');
const grossProfitRecordRoutes = require('./routes/gross-profit-records');
const lossRecordRoutes = require('./routes/loss-records');
const productRoutes = require('./routes/products');
const userRoutes = require('./routes/users');

const app = express();

app.use(
  cors({
    origin: env.corsOrigin.split(',').map((item) => item.trim()),
  }),
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/categories', requireAuth, categoryRoutes);
app.use('/api/express', requireAuth, expressQueryRoutes);
app.use('/api/gross-profit-records', requireAuth, grossProfitRecordRoutes);
app.use('/api/loss-records', requireAuth, lossRecordRoutes);
app.use('/api/products', requireAuth, productRoutes);
app.use('/api/users', userRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    message: error.message || '服务器内部错误。',
  });
});

async function startServer() {
  if (!env.envFileLoaded) {
    console.warn(
      `Missing backend .env file. Expected at: ${env.envFilePath}. Falling back to default MySQL config.`,
    );
  }

  await initializeDatabase();

  app.listen(env.port, () => {
    console.log(`ERP backend running on http://localhost:${env.port}`);
  });
}

startServer().catch((error) => {
  if (error && error.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('MySQL authentication failed.');
    console.error(`Using MYSQL_HOST=${env.mysqlHost}`);
    console.error(`Using MYSQL_PORT=${env.mysqlPort}`);
    console.error(`Using MYSQL_USER=${env.mysqlUser}`);
    console.error(`Using MYSQL_PASSWORD=${env.mysqlPassword ? '***' : '(empty)'}`);
    console.error(`Expected env file: ${env.envFilePath}`);
    console.error(
      'Create backend/.env from backend/.env.example and fill in the correct MySQL username and password.',
    );
  }

  console.error('Failed to start server:', error);
  process.exit(1);
});

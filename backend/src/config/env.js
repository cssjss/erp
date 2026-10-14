const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envFilePath = path.resolve(__dirname, '../../.env');
const envFileLoaded = fs.existsSync(envFilePath);

dotenv.config({ path: envFilePath });

const env = {
  port: Number(process.env.PORT || 3001),
  mysqlHost: process.env.MYSQL_HOST || '127.0.0.1',
  mysqlPort: Number(process.env.MYSQL_PORT || 3306),
  mysqlUser: process.env.MYSQL_USER || 'root',
  mysqlPassword: process.env.MYSQL_PASSWORD || '',
  mysqlDatabase: process.env.MYSQL_DATABASE || 'simple_erp',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  authSecret: process.env.AUTH_SECRET || 'simple-erp-dev-secret-change-me',
  defaultAdminUsername: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com',
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123456',
  envFileLoaded,
  envFilePath,
};

module.exports = env;

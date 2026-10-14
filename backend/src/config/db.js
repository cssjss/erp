const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('./env');
const { hashPassword } = require('../services/auth');

let pool;

async function columnExists(tableName, columnName) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM information_schema.columns
     WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [env.mysqlDatabase, tableName, columnName],
  );

  return Number(rows[0]?.count || 0) > 0;
}

async function constraintExists(tableName, constraintName) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM information_schema.table_constraints
     WHERE table_schema = ? AND table_name = ? AND constraint_name = ?`,
    [env.mysqlDatabase, tableName, constraintName],
  );

  return Number(rows[0]?.count || 0) > 0;
}

async function runMigrations() {
  if (!(await columnExists('categories', 'sort_order'))) {
    await pool.query(
      'ALTER TABLE categories ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER name',
    );
  }

  if (!(await columnExists('products', 'parent_product_id'))) {
    await pool.query(
      'ALTER TABLE products ADD COLUMN parent_product_id INT NULL AFTER category_id',
    );
  }

  if (!(await columnExists('products', 'sort_order'))) {
    await pool.query(
      'ALTER TABLE products ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER parent_product_id',
    );
  }

  if (!(await columnExists('products', 'quantity'))) {
    await pool.query(
      'ALTER TABLE products ADD COLUMN quantity INT NOT NULL DEFAULT 0 AFTER category_id',
    );
  }

  if (!(await columnExists('products', 'price'))) {
    await pool.query(
      'ALTER TABLE products ADD COLUMN price DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER sort_order',
    );
  }

  if (!(await columnExists('users', 'note'))) {
    await pool.query(
      "ALTER TABLE users ADD COLUMN note VARCHAR(255) NOT NULL DEFAULT '' AFTER avatar_data_url",
    );
  }

  if (!(await columnExists('gross_profit_records', 'note'))) {
    await pool.query(
      "ALTER TABLE gross_profit_records ADD COLUMN note VARCHAR(255) NOT NULL DEFAULT '' AFTER record_date",
    );
  }

  if (!(await constraintExists('products', 'fk_products_parent'))) {
    await pool.query(
      `ALTER TABLE products
       ADD CONSTRAINT fk_products_parent
       FOREIGN KEY (parent_product_id) REFERENCES products(id)
       ON DELETE CASCADE`,
    );
  }

  await pool.query(
    `ALTER TABLE products
     MODIFY COLUMN status ENUM('待寄回', '已寄回', '已到货', '已发出', '已完成', '已收货')
     NOT NULL DEFAULT '待寄回'`,
  );

  await pool.query(`UPDATE products SET status = '已到货' WHERE status = '已收货'`);

  await pool.query(
    `ALTER TABLE products
     MODIFY COLUMN status ENUM('待寄回', '已寄回', '已到货', '已发出', '已完成')
     NOT NULL DEFAULT '待寄回'`,
  );
}

async function seedDefaultAdminUser() {
  const [rows] = await pool.execute('SELECT COUNT(*) AS count FROM users');

  if (Number(rows[0]?.count || 0) > 0) {
    return;
  }

  const { passwordHash, passwordSalt } = hashPassword(env.defaultAdminPassword);

  await pool.execute(
    `INSERT INTO users (username, email, password_hash, password_salt, avatar_data_url)
     VALUES (?, ?, ?, ?, ?)`,
    [
      env.defaultAdminUsername,
      env.defaultAdminEmail,
      passwordHash,
      passwordSalt,
      '',
    ],
  );

  console.log(`Created default ERP user: ${env.defaultAdminUsername}`);
}

async function initializeDatabase() {
  let bootstrapConnection;

  try {
    bootstrapConnection = await mysql.createConnection({
      host: env.mysqlHost,
      port: env.mysqlPort,
      user: env.mysqlUser,
      password: env.mysqlPassword,
      multipleStatements: true,
    });

    await bootstrapConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.mysqlDatabase}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } catch (error) {
    if (error && (error.code === 'ER_DBACCESS_DENIED_ERROR' || error.errno === 1044)) {
      console.warn(
        `MySQL user cannot create database "${env.mysqlDatabase}". Continuing with the existing database.`,
      );
    } else {
      throw error;
    }
  } finally {
    if (bootstrapConnection) {
      await bootstrapConnection.end();
    }
  }

  pool = mysql.createPool({
    host: env.mysqlHost,
    port: env.mysqlPort,
    user: env.mysqlUser,
    password: env.mysqlPassword,
    database: env.mysqlDatabase,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
  });

  const schemaPath = path.resolve(__dirname, '../../sql/schema.sql');
  const schemaSql = await fs.readFile(schemaPath, 'utf8');
  await pool.query(schemaSql);
  await runMigrations();
  await seedDefaultAdminUser();
}

function getPool() {
  if (!pool) {
    throw new Error('Database pool has not been initialized.');
  }

  return pool;
}

async function query(sql, params = []) {
  const activePool = getPool();
  const [rows] = await activePool.execute(sql, params);
  return rows;
}

module.exports = {
  getPool,
  initializeDatabase,
  query,
};

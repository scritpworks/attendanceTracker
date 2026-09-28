const mysql = require('mysql');
require('dotenv').config();

const db = mysql.createPool({
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 20,
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'attendance_tracker',
  acquireTimeout: Number(process.env.DB_ACQUIRE_TIMEOUT_MS) || 30000,
  timeout: Number(process.env.DB_SOCKET_TIMEOUT_MS) || 30000,
  reconnect: true,
  idleTimeout: 300000,
  multipleStatements: false,
  charset: 'utf8mb4',
});

db.on('connection', (connection) => {
  console.log('New database connection established as id', connection.threadId);
  connection.query('SET SESSION wait_timeout = 28800');
  connection.query('SET SESSION interactive_timeout = 28800');
});

db.on('error', (err) => {
  console.error('Database pool error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('Database connection lost. Pool will automatically reconnect.');
  }
});

const query = (sql, values = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, values, (error, results) => {
      if (error) {
        console.error('Database query failed:', {
          error: error.code || error.message,
          sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
          fatal: error.fatal,
        });
        return reject(error);
      }
      resolve(results);
    });
  });

const executeTransaction = async (callback) => {
  let connection;
  try {
    connection = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Connection timeout')), 10000);
      db.getConnection((err, conn) => {
        clearTimeout(timer);
        if (err) return reject(err);
        resolve(conn);
      });
    });

    await new Promise((resolve, reject) => {
      connection.beginTransaction((err) => (err ? reject(err) : resolve()));
    });

    const result = await callback(connection);

    await new Promise((resolve, reject) => {
      connection.commit((err) => (err ? reject(err) : resolve()));
    });

    return result;
  } catch (error) {
    if (connection) {
      await new Promise((resolve) => {
        connection.rollback(() => resolve());
      });
    }
    throw error;
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (_) {
        /* ignore */
      }
    }
  }
};

const executeQuery = (connection, sql, params = []) =>
  new Promise((resolve, reject) => {
    connection.query(sql, params, (err, results) => (err ? reject(err) : resolve(results)));
  });

const checkConnection = async () => {
  try {
    const result = await query('SELECT 1 AS health_check');
    return { healthy: true, result: result[0] };
  } catch (error) {
    console.error('Connection health check failed:', error);
    return { healthy: false, error: error.message };
  }
};

const shutdown = () => {
  db.end(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = {
  db,
  query,
  executeTransaction,
  executeQuery,
  checkConnection,
};

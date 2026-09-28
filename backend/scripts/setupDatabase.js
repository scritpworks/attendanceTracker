/**
 * Creates attendance_tracker DB (if needed) and applies auth_rbac_schema.sql
 * Uses the same MySQL credentials as .env (without requiring the DB to exist yet).
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const host = process.env.DB_HOST || 'localhost';
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASS || process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || 'attendance_tracker';
const schemaPath = path.join(__dirname, '..', 'database', 'auth_rbac_schema.sql');

const sql = fs.readFileSync(schemaPath, 'utf8');

const connection = mysql.createConnection({
  host,
  user,
  password,
  multipleStatements: true,
  charset: 'utf8mb4',
});

connection.connect((err) => {
  if (err) {
    console.error('Failed to connect to MySQL:', err.message);
    process.exit(1);
  }

  console.log(`Connected to MySQL @ ${host} as ${user}`);
  console.log(`Applying schema → ${database}`);

  connection.query(sql, (queryErr) => {
    if (queryErr) {
      console.error('Schema apply failed:', queryErr.message);
      connection.end();
      process.exit(1);
    }

    console.log('Schema applied successfully.');
    console.log('Default admin: admin@attendance.local / admin123');
    connection.end();
  });
});

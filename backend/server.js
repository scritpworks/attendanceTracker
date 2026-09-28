require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { checkConnection, query } = require('./db');
const authRoutes = require('./routes/auth');
const rbacRoutes = require('./routes/rbac');
const rolesRoutes = require('./routes/roles');
const staffRoutes = require('./routes/staff');
const membersRoutes = require('./routes/members');
const meetingsRoutes = require('./routes/meetings');
const attendanceRoutes = require('./routes/attendance');
const userRoutes = require('./routes/user');
const memberAuthRoutes = require('./routes/memberAuth');
const memberAttendanceRoutes = require('./routes/memberAttendance');

const app = express();
const PORT = Number(process.env.PORT) || 5001;

const frontendOrigins = String(process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        frontendOrigins.length === 0 ||
        frontendOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  const dbHealth = await checkConnection();
  res.status(dbHealth.healthy ? 200 : 503).json({
    ok: dbHealth.healthy,
    service: 'attendance-tracker-api',
    database: dbHealth.healthy ? 'connected' : 'disconnected',
    dbName: process.env.DB_NAME || 'attendance_tracker',
    error: dbHealth.error || null,
  });
});

app.get('/api/db/tables', async (_req, res) => {
  try {
    const tables = await query(
      `SELECT TABLE_NAME AS name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [process.env.DB_NAME || 'attendance_tracker']
    );
    res.json({ success: true, tables: tables.map((t) => t.name) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.use('/api', authRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/user', userRoutes);
app.use('/api/member', memberAuthRoutes);
app.use('/api/member', memberAttendanceRoutes);

async function start() {
  const health = await checkConnection();
  if (!health.healthy) {
    console.error('MySQL connection failed:', health.error);
    console.error('Run: cd backend && npm run db:setup');
  } else {
    console.log(
      `MySQL connected → ${process.env.DB_NAME || 'attendance_tracker'} @ ${process.env.DB_HOST || 'localhost'}`
    );
  }

  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

start();

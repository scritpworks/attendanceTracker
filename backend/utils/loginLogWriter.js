const { query } = require('../db');

const getRequestMeta = (req) => {
  const ipAddress =
    (req?.headers?.['x-forwarded-for'] || '')
      .toString()
      .split(',')
      .shift()
      ?.trim() ||
    req?.ip ||
    null;
  const userAgent = req?.get?.('User-Agent') || req?.headers?.['user-agent'] || null;
  return { ipAddress, userAgent };
};

const writeLoginLog = async ({
  username,
  status = 'failed',
  failureReason = null,
  ipAddress = null,
  userAgent = null,
}) => {
  if (!username || !String(username).trim()) return;

  try {
    await query(
      `INSERT INTO loginlogs (username, status, ip_address, user_agent, failure_reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        String(username).trim().toLowerCase(),
        status,
        ipAddress,
        userAgent,
        failureReason,
      ]
    );
  } catch (error) {
    console.error('Failed to write login log:', error.message);
  }
};

module.exports = {
  writeLoginLog,
  getRequestMeta,
};

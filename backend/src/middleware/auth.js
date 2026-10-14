const { query } = require('../config/db');
const { shapeUser, verifyToken } = require('../services/auth');

async function requireAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ message: '请先登录。' });
  }

  try {
    const rows = await query(
      'SELECT id, username, email, avatar_data_url, note, created_at, updated_at FROM users WHERE id = ?',
      [payload.sub],
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: '登录状态已失效，请重新登录。' });
    }

    req.user = shapeUser(rows[0]);
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requireAuth,
};


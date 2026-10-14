const express = require('express');
const { query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { hashPassword, shapeUser } = require('../services/auth');
const {
  createUser,
  normalizeAvatar,
  normalizeEmail,
  normalizeText,
  validateUserInput,
} = require('./auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, username, email, avatar_data_url, note, created_at, updated_at
       FROM users
       ORDER BY created_at DESC, id DESC`,
    );

    res.json(rows.map(shapeUser));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const username = normalizeText(req.body.username);
  const email = normalizeEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const avatarDataUrl = normalizeAvatar(req.body.avatarDataUrl);
  const note = normalizeText(req.body.note);
  const validationMessage = validateUserInput({ username, email, password });

  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }

  try {
    const user = await createUser({ username, email, password, avatarDataUrl, note });
    res.status(201).json(user);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: '用户名或邮箱已存在。' });
    }

    next(error);
  }
});

router.patch('/:id/note', async (req, res, next) => {
  const userId = Number(req.params.id);
  const note = normalizeText(req.body.note);

  if (!Number.isInteger(userId) || note.length > 255) {
    return res.status(400).json({ message: '用户备注参数无效，最多填写 255 个字符。' });
  }

  try {
    const result = await query('UPDATE users SET note = ? WHERE id = ?', [note, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '用户不存在。' });
    }

    res.json({ id: userId, note });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/password', async (req, res, next) => {
  const userId = Number(req.params.id);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!Number.isInteger(userId) || !password || password.length < 6 || password.length > 80) {
    return res.status(400).json({ message: '密码长度需要在 6 到 80 个字符之间。' });
  }

  const { passwordHash, passwordSalt } = hashPassword(password);

  try {
    const result = await query(
      'UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?',
      [passwordHash, passwordSalt, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '用户不存在。' });
    }

    res.json({ id: userId, passwordReset: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId)) {
    return res.status(400).json({ message: '用户参数无效。' });
  }

  try {
    const countRows = await query('SELECT COUNT(*) AS count FROM users');

    if (Number(countRows[0]?.count || 0) <= 1) {
      return res.status(400).json({ message: '至少需要保留一个用户。' });
    }

    const result = await query('DELETE FROM users WHERE id = ?', [userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '用户不存在。' });
    }

    res.json({ id: userId, deleted: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;


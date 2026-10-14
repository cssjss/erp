const express = require('express');
const { query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { createToken, hashPassword, shapeUser, verifyPassword } = require('../services/auth');

const router = express.Router();

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeAvatar(value) {
  const avatar = normalizeText(value);

  if (!avatar) {
    return '';
  }

  if (!avatar.startsWith('data:image/') || avatar.length > 1024 * 1024) {
    return '';
  }

  return avatar;
}

function validateUserInput({ username, email, password }, requirePassword = true) {
  if (!username || username.length < 2 || username.length > 80) {
    return '用户名长度需要在 2 到 80 个字符之间。';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    return '邮箱格式无效。';
  }

  if (requirePassword && (!password || password.length < 6 || password.length > 80)) {
    return '密码长度需要在 6 到 80 个字符之间。';
  }

  return '';
}

async function createUser({ username, email, password, avatarDataUrl, note = '' }) {
  const { passwordHash, passwordSalt } = hashPassword(password);
  const result = await query(
    `INSERT INTO users (username, email, password_hash, password_salt, avatar_data_url, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [username, email, passwordHash, passwordSalt, avatarDataUrl, note],
  );
  const rows = await query(
    'SELECT id, username, email, avatar_data_url, note, created_at, updated_at FROM users WHERE id = ?',
    [result.insertId],
  );

  return shapeUser(rows[0]);
}

router.post('/register', async (req, res, next) => {
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
    const token = createToken(user);

    res.status(201).json({ token, user });
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: '用户名或邮箱已存在。' });
    }

    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  const account = normalizeText(req.body.account);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!account || !password) {
    return res.status(400).json({ message: '账号和密码不能为空。' });
  }

  try {
    const rows = await query(
      `SELECT id, username, email, password_hash, password_salt, avatar_data_url, note, created_at, updated_at
       FROM users
       WHERE username = ? OR email = ?
       LIMIT 1`,
      [account, account.toLowerCase()],
    );
    const userRow = rows[0];

    if (!userRow || !verifyPassword(password, userRow.password_hash, userRow.password_salt)) {
      return res.status(401).json({ message: '账号或密码错误。' });
    }

    const user = shapeUser(userRow);
    const token = createToken(user);

    res.json({ token, user });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

module.exports = {
  createUser,
  normalizeAvatar,
  normalizeEmail,
  normalizeText,
  router,
  validateUserInput,
};


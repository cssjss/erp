const crypto = require('crypto');
const env = require('../config/env');

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function base64UrlDecode(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function signTokenPart(value) {
  return crypto.createHmac('sha256', env.authSecret).update(value).digest('base64url');
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const passwordHash = crypto
    .pbkdf2Sync(password, salt, 120000, 64, 'sha512')
    .toString('hex');

  return {
    passwordHash,
    passwordSalt: salt,
  };
}

function verifyPassword(password, passwordHash, passwordSalt) {
  const hashed = hashPassword(password, passwordSalt).passwordHash;
  const left = Buffer.from(hashed, 'hex');
  const right = Buffer.from(passwordHash, 'hex');

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function createToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    username: user.username,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const encodedPayload = base64UrlEncode(payload);
  const signature = signTokenPart(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');
  const expectedSignature = signTokenPart(encodedPayload);

  if (
    !signature ||
    Buffer.byteLength(signature) !== Buffer.byteLength(expectedSignature) ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return null;
  }

  try {
    const payload = base64UrlDecode(encodedPayload);
    const now = Math.floor(Date.now() / 1000);

    if (!payload.sub || !payload.exp || payload.exp < now) {
      return null;
    }

    return payload;
  } catch (_error) {
    return null;
  }
}

function shapeUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatarDataUrl: row.avatar_data_url || '',
    note: row.note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  createToken,
  hashPassword,
  shapeUser,
  verifyPassword,
  verifyToken,
};


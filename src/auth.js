'use strict';
const crypto = require('crypto');

const COOKIE = 'iles_admin';
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 heures

function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest(); }

function checkPassword(given, expected) {
  if (!expected) return false;
  return crypto.timingSafeEqual(sha256(given), sha256(expected));
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function createToken(secret, now = Date.now()) {
  const payload = `admin.${now + MAX_AGE_MS}.${crypto.randomBytes(8).toString('hex')}`;
  return `${payload}.${sign(payload, secret)}`;
}

function verifyToken(token, secret, now = Date.now()) {
  if (!token || typeof token !== 'string') return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const good = sign(payload, secret);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  const exp = Number(payload.split('.')[1]);
  return Number.isFinite(exp) && exp > now;
}

// Limiteur de tentatives très simple, en mémoire, par clé (IP).
function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  return function hit(key) {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 10000) hits.clear();
    return arr.length <= max;
  };
}

module.exports = { COOKIE, MAX_AGE_MS, checkPassword, createToken, verifyToken, rateLimiter };

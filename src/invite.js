'use strict';
const crypto = require('crypto');

const INVITE_COOKIE = 'iles_invite';
const INVITE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000; // jusqu'après le mariage

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}
function createInviteToken(secret, now = Date.now()) {
  const payload = `invite.${now + INVITE_MAX_AGE_MS}`;
  return `${payload}.${sign(payload, secret)}`;
}
function verifyInviteToken(token, secret, now = Date.now()) {
  if (!token || typeof token !== 'string') return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const payload = token.slice(0, i);
  if (!payload.startsWith('invite.')) return false;
  const sig = token.slice(i + 1);
  const good = sign(payload, secret);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  const exp = Number(payload.split('.')[1]);
  return Number.isFinite(exp) && exp > now;
}

module.exports = { INVITE_COOKIE, INVITE_MAX_AGE_MS, createInviteToken, verifyInviteToken };

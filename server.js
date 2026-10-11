'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const cookieParser = require('cookie-parser');
const { openDb, getInfos, setInfos } = require('./src/db');
const { cleanRsvp, RsvpError } = require('./src/rsvp');
const { cleanInfos } = require('./src/infos');
const { COOKIE, MAX_AGE_MS, checkPassword, createToken, verifyToken, rateLimiter } = require('./src/auth');

function csvCell(v) {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowOut(r) {
  let enfants = [];
  try { enfants = JSON.parse(r.enfants); } catch { /* ignore */ }
  return { ...r, enfants };
}

function createApp(options = {}) {
  const db = options.db || openDb();
  const adminPassword = options.adminPassword ?? process.env.ADMIN_PASSWORD;
  const secret = options.sessionSecret ?? process.env.SESSION_SECRET;
  const isProd = (options.env ?? process.env.NODE_ENV) === 'production';
  if (!adminPassword || adminPassword.length < 10) {
    throw new Error('ADMIN_PASSWORD manquant ou trop court (10 caractères minimum).');
  }
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET manquant ou trop court (32 caractères minimum).');
  }

  const loginLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
  const rsvpLimiter = rateLimiter({ windowMs: 60 * 60 * 1000, max: options.rsvpRateMax ?? 30 });

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; " +
        "font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    });
    next();
  });

  // ---------- Pages ----------
  const pub = path.join(__dirname, 'public');
  const indexTpl = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
  const sendIndex = (req, res) => {
    // Adresse absolue du site pour l'aperçu WhatsApp (og:image)
    const origin = `${req.protocol}://${req.get('host')}`;
    res.type('html').send(indexTpl.replaceAll('__ORIGIN__', origin));
  };
  app.get('/', sendIndex);
  app.get('/index.html', sendIndex);
  app.get('/admin', (req, res) => res.sendFile(path.join(pub, 'admin.html')));
  app.use(express.static(pub, { index: false, maxAge: isProd ? '1h' : 0 }));

  // ---------- API publique ----------
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/infos', (req, res) => res.json({ infos: getInfos(db) }));

  const upsert = db.prepare(`
    INSERT INTO rsvps (cle, prenom, nom, email, telephone, presence, moments, hebergement, accompagnant,
                       enfants, allergies, message, nb_personnes)
    VALUES (@cle, @prenom, @nom, @email, @telephone, @presence, @moments, @hebergement, @accompagnant,
            @enfants, @allergies, @message, @nb_personnes)
    ON CONFLICT(cle) DO UPDATE SET
      prenom = excluded.prenom, nom = excluded.nom, telephone = excluded.telephone,
      presence = excluded.presence, moments = excluded.moments, hebergement = excluded.hebergement,
      accompagnant = excluded.accompagnant, enfants = excluded.enfants, allergies = excluded.allergies,
      message = excluded.message, nb_personnes = excluded.nb_personnes, updated_at = datetime('now')
  `);

  app.post('/api/rsvp', (req, res, next) => {
    try {
      if (!rsvpLimiter(req.ip)) {
        return res.status(429).json({ error: 'TOO_MANY', message: 'Trop d\'envois, réessayez un peu plus tard.' });
      }
      const r = cleanRsvp(req.body);
      const existed = db.prepare('SELECT 1 FROM rsvps WHERE cle = ?').get(r.cle);
      upsert.run({ ...r, enfants: JSON.stringify(r.enfants) });
      res.json({ ok: true, updated: !!existed });
    } catch (e) { next(e); }
  });

  // ---------- Authentification admin ----------
  const requireAdmin = (req, res, next) => {
    if (verifyToken(req.cookies[COOKIE], secret)) return next();
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Connexion requise.' });
  };

  app.post('/api/admin/login', (req, res) => {
    if (!loginLimiter(req.ip)) {
      return res.status(429).json({ error: 'TOO_MANY', message: 'Trop de tentatives. Réessayez dans 15 minutes.' });
    }
    if (!checkPassword(req.body && req.body.password, adminPassword)) {
      return res.status(401).json({ error: 'BAD_PASSWORD', message: 'Mot de passe incorrect.' });
    }
    res.cookie(COOKIE, createToken(secret), {
      httpOnly: true, sameSite: 'strict', secure: isProd, maxAge: MAX_AGE_MS, path: '/',
    });
    res.json({ ok: true });
  });
  app.post('/api/admin/logout', (req, res) => {
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  });
  app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ ok: true }));

  const admin = express.Router();
  admin.use(requireAdmin);

  admin.get('/rsvps', (req, res) => {
    const rows = db.prepare('SELECT * FROM rsvps ORDER BY updated_at DESC, id DESC').all().map(rowOut);
    const viennent = rows.filter((r) => r.presence !== 'Non');
    const stats = {
      reponses: rows.length,
      oui: rows.filter((r) => r.presence === 'Oui').length,
      non: rows.filter((r) => r.presence === 'Non').length,
      personnes: rows.filter((r) => r.presence === 'Oui').reduce((s, r) => s + r.nb_personnes, 0),
      enfants: viennent.reduce((s, r) => s + r.enfants.length, 0),
      loges: viennent.filter((r) => r.hebergement === 'Logé sur place').reduce((s, r) => s + r.nb_personnes, 0),
      allergies: viennent.filter((r) => r.allergies).length,
      moments: Object.fromEntries(['Mairie', 'Cérémonie & cocktail', 'Dîner', 'Brunch'].map((m) => [
        m, rows.filter((r) => r.presence === 'Oui' && r.moments.split(', ').includes(m)).reduce((s, r) => s + r.nb_personnes, 0),
      ])),
    };
    res.json({ rsvps: rows, stats });
  });

  admin.delete('/rsvps/:id', (req, res) => {
    const info = db.prepare('DELETE FROM rsvps WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: info.changes > 0 });
  });

  admin.get('/export.csv', (req, res) => {
    const rows = db.prepare('SELECT * FROM rsvps ORDER BY nom, prenom').all().map(rowOut);
    const head = ['Prénom', 'Nom', 'Email', 'Téléphone', 'Présence', 'Moments', 'Hébergement', 'Accompagnant(e)',
      'Nb enfants', 'Enfants', 'Allergies / régime', 'Message', 'Nb personnes', 'Répondu le', 'Modifié le'];
    const lines = [head.join(';')];
    for (const r of rows) {
      lines.push([r.prenom, r.nom, r.email, r.telephone, r.presence, r.moments, r.hebergement, r.accompagnant,
        r.enfants.length, r.enfants.map((k) => `${k.prenom} ${k.nom} (${k.age} ans)`).join(', '),
        r.allergies, r.message, r.nb_personnes, r.created_at, r.updated_at].map(csvCell).join(';'));
    }
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="reponses-mariage.csv"');
    res.send('﻿' + lines.join('\n'));
  });

  admin.get('/export-enfants.csv', (req, res) => {
    const rows = db.prepare("SELECT * FROM rsvps WHERE presence != 'Non' ORDER BY nom, prenom").all().map(rowOut);
    const lines = [['Prénom', 'Nom', 'Âge', 'Parent', 'Email parent'].join(';')];
    for (const r of rows) for (const k of r.enfants) {
      lines.push([k.prenom, k.nom, k.age, `${r.prenom} ${r.nom}`, r.email].map(csvCell).join(';'));
    }
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="enfants-mariage.csv"');
    res.send('﻿' + lines.join('\n'));
  });

  admin.get('/infos', (req, res) => res.json({ infos: getInfos(db) }));
  admin.put('/infos', (req, res, next) => {
    try {
      const clean = cleanInfos(req.body && req.body.infos);
      setInfos(db, clean);
      res.json({ ok: true, infos: clean });
    } catch (e) { next(e); }
  });

  // Sauvegarde complète de la base (copie cohérente via l'API backup de SQLite)
  admin.get('/backup', async (req, res, next) => {
    const tmp = path.join(os.tmpdir(), `mariage-backup-${Date.now()}.db`);
    try {
      await db.backup(tmp);
      const name = `sauvegarde-mariage-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
      res.download(tmp, name, () => fs.rm(tmp, { force: true }, () => {}));
    } catch (e) { fs.rm(tmp, { force: true }, () => {}); next(e); }
  });

  app.use('/api/admin', admin);

  // ---------- Erreurs ----------
  app.use('/api', (req, res) => res.status(404).json({ error: 'NOT_FOUND', message: 'Introuvable.' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof RsvpError) return res.status(400).json({ error: err.code, message: err.message });
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'BAD_JSON', message: 'Requête invalide.' });
    console.error(err);
    res.status(500).json({ error: 'SERVER', message: 'Erreur du serveur.' });
  });

  return app;
}

if (require.main === module) {
  const db = openDb();
  const app = createApp({ db });
  const port = Number(process.env.PORT) || 3000;
  const server = app.listen(port, () => console.log(`Site Il.e.s démarré sur le port ${port}`));
  const stop = () => server.close(() => { db.close(); process.exit(0); });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

module.exports = { createApp };

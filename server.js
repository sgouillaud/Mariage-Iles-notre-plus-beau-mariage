'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const express = require('express');
const QRCode = require('qrcode');
const qrMariage = require('./src/qr');
const cookieParser = require('cookie-parser');
const { openDb, getInfos, setInfos } = require('./src/db');
const { cleanRsvp, RsvpError } = require('./src/rsvp');
const { cleanInfos } = require('./src/infos');
const { COOKIE, MAX_AGE_MS, checkPassword, createToken, verifyToken, rateLimiter } = require('./src/auth');
const { envoyerZip } = require('./src/zip');
const { INVITE_COOKIE, INVITE_MAX_AGE_MS, createInviteToken, verifyInviteToken } = require('./src/invite');

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

  // Code d'accès des invités : si défini, le site n'est visible qu'avec ce code
  const guestCode = String(options.guestCode ?? process.env.GUEST_CODE ?? '').trim();
  if (guestCode && guestCode.length < 4) throw new Error('GUEST_CODE trop court (4 caractères minimum).');
  if (!guestCode) console.warn('GUEST_CODE absent : le site des invités est public.');

  const loginLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
  const rsvpLimiter = rateLimiter({ windowMs: 60 * 60 * 1000, max: options.rsvpRateMax ?? 30 });
  const inviteLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

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
      'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self' https://fonts.googleapis.com; " +
        "font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; media-src 'self'; frame-ancestors 'none'",
    });
    next();
  });

  // ---------- Pages ----------
  const pub = path.join(__dirname, 'public');
  const withOrigin = (tpl, req) => tpl.replaceAll('__ORIGIN__', `${req.protocol}://${req.get('host')}`);
  const indexTpl = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
  const porteTpl = fs.readFileSync(path.join(pub, 'invitation.html'), 'utf8');

  // ---------- Accès invités (site privé) ----------
  const invite = (req) => !guestCode || verifyInviteToken(req.cookies[INVITE_COOKIE], secret);
  const poserCookie = (res) => res.cookie(INVITE_COOKIE, createInviteToken(secret), {
    httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: INVITE_MAX_AGE_MS, path: '/',
  });
  const codeOk = (code) => guestCode && checkPassword(String(code ?? '').trim().toLowerCase(), guestCode.toLowerCase());

  // Fichiers visibles sans code : la porte d'entrée, l'aperçu WhatsApp et l'espace admin
  const LIBRES = new Set(['/invitation.css', '/invitation.js', '/logo.webp', '/apercu-whatsapp.jpg',
    '/admin', '/admin.html', '/admin.css', '/admin.js', '/api/health', '/api/invite']);
  app.use((req, res, next) => {
    // La chanson n'est servie que si le site est protégé par un code
    if (!guestCode && req.path.startsWith('/sons/chanson')) return res.status(404).type('text').send('Introuvable.');
    if (invite(req) || LIBRES.has(req.path) || req.path.startsWith('/api/admin')) return next();
    // Les mariés voient les photos depuis /admin sans code invité
    if (req.path.startsWith('/photos/f/') && verifyToken(req.cookies[COOKIE], secret)) return next();
    // Lien d'invitation avec le code intégré : …/?code=XXXX
    if (req.method === 'GET' && req.query.code !== undefined) {
      if (inviteLimiter(req.ip) && codeOk(req.query.code)) {
        poserCookie(res);
        return res.redirect(302, req.path || '/');
      }
    }
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'INVITE_REQUIRED', message: 'Code d\'invitation requis.' });
    if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html')) {
      return res.status(200).type('html').send(withOrigin(porteTpl, req));
    }
    return res.status(404).type('text').send('Introuvable.');
  });

  app.post('/api/invite', (req, res) => {
    if (!guestCode) return res.json({ ok: true });
    if (!inviteLimiter(req.ip)) return res.status(429).json({ error: 'TOO_MANY', message: 'Trop d\'essais. Réessayez dans 15 minutes.' });
    if (!codeOk(req.body && req.body.code)) return res.status(401).json({ error: 'BAD_CODE', message: 'Ce code ne correspond pas. Vérifiez le message d\'invitation.' });
    poserCookie(res);
    res.json({ ok: true });
  });

  const sendIndex = (req, res) => res.type('html').send(withOrigin(indexTpl, req));
  app.get('/', sendIndex);
  app.get('/index.html', sendIndex);
  app.get('/admin', (req, res) => res.sendFile(path.join(pub, 'admin.html')));
  app.get('/photos', (req, res) => res.sendFile(path.join(pub, 'photos.html')));
  app.get('/diaporama', (req, res) => res.sendFile(path.join(pub, 'diaporama.html')));
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

  // ---------- Photos des invités (QR code → envoi, diaporama en direct) ----------
  const photosDir = options.photosDir ?? process.env.PHOTOS_DIR ??
    path.join(path.dirname(process.env.DB_PATH || path.join(__dirname, 'data', 'mariage.db')), 'photos');
  fs.mkdirSync(photosDir, { recursive: true });
  const photoLimiter = rateLimiter({ windowMs: 10 * 60 * 1000, max: options.photoRateMax ?? 80 });
  const MAX_PHOTO = 12 * 1024 * 1024;
  const photoOut = (p) => ({ id: p.id, auteur: p.auteur, url: `/photos/f/${p.fichier}`, le: p.created_at });
  const lienPhotos = (req) => `${req.protocol}://${req.get('host')}/photos${guestCode ? '?code=' + encodeURIComponent(guestCode) : ''}`;

  app.post('/api/photos', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_PHOTO }), (req, res) => {
    if (!photoLimiter(req.ip)) return res.status(429).json({ error: 'TOO_MANY', message: 'Beaucoup de photos d’un coup ! Réessayez dans quelques minutes.' });
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length < 100) return res.status(400).json({ error: 'BAD_PHOTO', message: 'Photo illisible.' });
    const ext = buf[0] === 0xff && buf[1] === 0xd8 ? 'jpg'
      : buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? 'png'
      : buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP' ? 'webp' : null;
    if (!ext) return res.status(400).json({ error: 'BAD_PHOTO', message: 'Format non reconnu (JPEG, PNG ou WebP).' });
    let auteur = '';
    try { auteur = decodeURIComponent(String(req.get('X-Auteur') || '')); } catch { /* ignore */ }
    auteur = auteur.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60);
    const fichier = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(photosDir, fichier), buf);
    const info = db.prepare('INSERT INTO photos (fichier, auteur, taille) VALUES (?, ?, ?)').run(fichier, auteur, buf.length);
    res.json({ ok: true, id: info.lastInsertRowid });
  });

  app.get('/api/photos', (req, res) => {
    const rows = db.prepare('SELECT * FROM photos WHERE masquee = 0 ORDER BY id DESC LIMIT 500').all();
    res.json({ photos: rows.map(photoOut) });
  });

  // Toutes les photos en un fichier .zip (nommées par date et auteur)
  const nomZip = (p, i) => {
    const auteur = (p.auteur || 'invite').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'invite';
    return `${String(i + 1).padStart(4, '0')}-${auteur}.${p.fichier.split('.').pop()}`;
  };
  const zipPhotos = (rows, res, nom) => {
    res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${nom}"`, 'Cache-Control': 'no-store' });
    return envoyerZip(res, rows.map((p, i) => ({ nom: nomZip(p, i), chemin: path.join(photosDir, p.fichier) })));
  };
  app.get('/api/photos.zip', (req, res, next) => {
    zipPhotos(db.prepare('SELECT * FROM photos WHERE masquee = 0 ORDER BY id').all(), res, 'photos-mariage-cedric-sebastien.zip').catch(next);
  });

  app.get('/photos/f/:fichier', (req, res) => {
    const f = String(req.params.fichier);
    if (!/^[0-9]+-[0-9a-f]{12}\.(jpg|png|webp)$/.test(f)) return res.status(404).type('text').send('Introuvable.');
    const p = db.prepare('SELECT masquee FROM photos WHERE fichier = ?').get(f);
    if (!p || (p.masquee && !verifyToken(req.cookies[COOKIE], secret))) return res.status(404).type('text').send('Introuvable.');
    res.set('Cache-Control', 'private, max-age=86400');
    if (req.query.dl !== undefined) res.attachment(`photo-mariage-${f}`);
    res.sendFile(path.join(photosDir, f));
  });

  // Petit QR code affiché dans le coin du diaporama
  app.get('/api/qr-photos.svg', async (req, res, next) => {
    try {
      res.type('image/svg+xml').set('Cache-Control', 'private, max-age=3600').send(qrMariage.svg(lienPhotos(req)));
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

  // Photos : modération et QR code à imprimer (le code invité y est intégré)
  admin.get('/photos', (req, res) => {
    const rows = db.prepare('SELECT * FROM photos ORDER BY id DESC').all();
    res.json({ photos: rows.map((p) => ({ ...photoOut(p), masquee: !!p.masquee, taille: p.taille })), lien: lienPhotos(req) });
  });
  admin.get('/photos.zip', (req, res, next) => {
    zipPhotos(db.prepare('SELECT * FROM photos ORDER BY id').all(), res, 'toutes-les-photos-mariage.zip').catch(next);
  });
  admin.post('/photos/:id/masquer', (req, res) => {
    const masquee = req.body && req.body.masquee ? 1 : 0;
    const info = db.prepare('UPDATE photos SET masquee = ? WHERE id = ?').run(masquee, Number(req.params.id));
    res.json({ ok: info.changes > 0 });
  });
  admin.delete('/photos/:id', (req, res) => {
    const p = db.prepare('SELECT fichier FROM photos WHERE id = ?').get(Number(req.params.id));
    if (!p) return res.json({ ok: false });
    db.prepare('DELETE FROM photos WHERE id = ?').run(Number(req.params.id));
    fs.rm(path.join(photosDir, p.fichier), { force: true }, () => {});
    res.json({ ok: true });
  });
  admin.get('/qr-photos.:fmt', async (req, res, next) => {
    try {
      // Par défaut : aux couleurs du mariage avec le logo ; ?blanc=1 : modules blancs sur fond transparent (plexi foncé)
      if (req.params.fmt === 'svg') {
        res.type('image/svg+xml').set('Content-Disposition', `attachment; filename="qr-photos-mariage${req.query.blanc ? '-blanc' : ''}.svg"`);
        if (req.query.blanc) {
          return res.send(await QRCode.toString(lienPhotos(req), { type: 'svg', margin: 2, errorCorrectionLevel: 'H', color: { dark: '#FFFFFF', light: '#00000000' } }));
        }
        return res.send(qrMariage.svg(lienPhotos(req)));
      }
      if (req.params.fmt === 'png') {
        res.type('image/png').set('Content-Disposition', 'attachment; filename="qr-photos-mariage.png"');
        return res.send(qrMariage.png(lienPhotos(req)));
      }
      res.status(404).json({ error: 'NOT_FOUND', message: 'Format inconnu.' });
    } catch (e) { next(e); }
  });

  app.use('/api/admin', admin);

  // ---------- Erreurs ----------
  app.use('/api', (req, res) => res.status(404).json({ error: 'NOT_FOUND', message: 'Introuvable.' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof RsvpError) return res.status(400).json({ error: err.code, message: err.message });
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'TOO_BIG', message: 'Photo trop lourde (12 Mo maximum).' });
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

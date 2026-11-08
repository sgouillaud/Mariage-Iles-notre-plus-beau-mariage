'use strict';
// Animations « Escales » : missions photo, cœurs, cartes postales, playlist, quiz et pronostics.
// Chaque animation est fermée par défaut (« à venir ») et s'ouvre depuis /admin → Animations.
const crypto = require('crypto');
const express = require('express');

const NOMS = ['photos', 'missions', 'coeurs', 'commentaires', 'cartes', 'playlist', 'quiz', 'pronos'];

const TIMBRES = ['Île Maurice', 'La Réunion', 'Guadeloupe', 'Martinique', 'Les Saintes', 'Koh Samui', 'Corse'];

const MISSIONS_DEFAUT = [
  'Un selfie avec les mariés 🤳',
  'La plus belle tenue de la soirée 👗',
  'Un fou rire 😂',
  'La piste de danse en feu 💃',
  'Le toast parfait 🥂',
  'Le plus beau détail de la déco 🌺',
  'Une photo avec quelqu’un que tu viens de rencontrer 🤝',
  'Les mariés quand ils ne te voient pas 💍',
].join('\n');

// Quiz : la première réponse de chaque ligne est la bonne (l'ordre est mélangé à l'affichage)
const QUIZ_DEFAUT = [
  'Quel est le nom de notre voyage ? | Il.e.s · Notre plus beau voyage | Destination bonheur | Cap sur l’amour',
  'Combien d’îles relie notre itinéraire sur la carte du site ? | 7 | 5 | 9',
  'Laquelle de ces îles n’est PAS sur notre itinéraire ? | Bali | Koh Samui | Les Saintes',
  'Où a lieu la cérémonie laïque ? | Au Prieuré Notre-Dame d’Yron | À la mairie de Montigny | À la salle des fêtes',
  'Dans quelle mairie disons-nous oui ? | Montigny-le-Gannelon | Châteaudun | Cloyes-sur-le-Loir',
  'Quelles sont les couleurs du mariage ? | Terracotta, vert canard et crème | Bleu, blanc et or | Rose, gris et argent',
].join('\n');

const PRONOS_DEFAUT = [
  'Qui versera la première larme ? | Cédric | Sébastien | Les deux en même temps',
  'Le premier invité sur la piste de danse, ce sera… | Avant 22 h | Entre 22 h et minuit | Après minuit',
  'Le discours le plus long durera… | Moins de 3 minutes | 3 à 6 minutes | Plus de 6 minutes',
  'Qui sera le dernier sur la piste ? | Cédric | Sébastien | Un invité surprise',
  'Combien de « Vive les mariés ! » pendant le dîner ? | Moins de 10 | 10 à 30 | Plus de 30',
].join('\n');

const propre = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const propreTexte = (v, max) => String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f<>]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const idDe = (texte) => crypto.createHash('sha1').update(texte).digest('hex').slice(0, 10);

class AnimError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

// « Question | choix 1 | choix 2 » → [{ id, question, choix }]
function lireLignes(texte, { min = 2, max = 6, label }) {
  const lignes = String(texte || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lignes.length > 40) throw new AnimError(400, 'TROP', `${label} : 40 lignes maximum.`);
  return lignes.map((l, i) => {
    const parts = l.split('|').map((p) => propre(p, 160)).filter(Boolean);
    if (parts.length < 1 + min) throw new AnimError(400, 'FORMAT', `${label}, ligne ${i + 1} : il faut une question puis au moins ${min} réponses, séparées par « | ».`);
    if (parts.length > 1 + max) throw new AnimError(400, 'FORMAT', `${label}, ligne ${i + 1} : ${max} réponses maximum.`);
    return { id: idDe(parts[0]), question: parts[0], choix: parts.slice(1) };
  });
}

function lireMissions(texte) {
  const m = String(texte || '').split('\n').map((l) => propre(l, 90)).filter(Boolean);
  if (m.length > 20) throw new AnimError(400, 'TROP', 'Missions : 20 maximum.');
  return [...new Set(m)];
}

function melanger(t) {
  const a = t.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function csv(lignes) {
  const cell = (v) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + lignes.map((l) => l.map(cell).join(';')).join('\n');
}

function monterAnimations({ app, admin, db, estAdmin, rateLimiter }) {
  const lire = (cle, defaut) => {
    const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(cle);
    return r ? r.value : defaut;
  };
  const ecrire = (cle, valeur) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(cle, String(valeur));
  const ouvert = (nom) => lire(`${nom}_ouvert`, '0') === '1';
  const ouverts = () => Object.fromEntries(NOMS.map((n) => [n, ouvert(n)]));
  const missions = () => lireMissions(lire('missions', MISSIONS_DEFAUT));
  const quiz = () => lireLignes(lire('quiz', QUIZ_DEFAUT), { label: 'Quiz' });
  const pronos = () => lireLignes(lire('pronos', PRONOS_DEFAUT), { label: 'Pronostics' });
  const pronosReveles = () => lire('pronos_reveles', '0') === '1';
  const limite = rateLimiter({ windowMs: 10 * 60 * 1000, max: 60 });

  // Une animation fermée n'est accessible qu'aux mariés connectés à /admin
  const exiger = (nom) => (req, res, next) => (ouvert(nom) || estAdmin(req) ? next()
    : res.status(403).json({ error: 'FERMEE', message: 'Cette escale ouvre bientôt.' }));
  const garde = (fn) => (req, res) => {
    try { fn(req, res); } catch (e) {
      if (e instanceof AnimError) return res.status(e.status).json({ error: e.code, message: e.message });
      console.error(e);
      res.status(500).json({ error: 'SERVER', message: 'Erreur du serveur.' });
    }
  };
  const anti = (req) => { if (!limite(req.ip)) throw new AnimError(429, 'TOO_MANY', 'Doucement ! Réessayez dans quelques minutes.'); };

  // ---------- Infos générales ----------
  app.get('/api/escales', (req, res) => {
    res.json({ ouverts: ouverts(), admin: estAdmin(req), missions: ouvert('missions') || estAdmin(req) ? missions() : [], timbres: TIMBRES });
  });

  // ---------- Missions : passeport de l'appareil ----------
  app.get('/api/missions/passeport', exiger('missions'), (req, res) => {
    const faites = db.prepare("SELECT mission, COUNT(*) AS n FROM photos WHERE appareil = ? AND mission <> '' AND masquee = 0 GROUP BY mission").all(req.appareil);
    const liste = missions();
    const fait = new Map(faites.map((f) => [f.mission, f.n]));
    res.json({ missions: liste.map((m) => ({ mission: m, faite: fait.has(m), photos: fait.get(m) || 0 })) });
  });

  // ---------- Cœurs sur les photos ----------
  app.post('/api/photos/:id/coeur', exiger('coeurs'), garde((req, res) => {
    anti(req);
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM photos WHERE id = ? AND masquee = 0').get(id)) throw new AnimError(404, 'NOT_FOUND', 'Photo introuvable.');
    const deja = db.prepare('SELECT 1 FROM photo_votes WHERE photo_id = ? AND appareil = ?').get(id, req.appareil);
    if (deja) db.prepare('DELETE FROM photo_votes WHERE photo_id = ? AND appareil = ?').run(id, req.appareil);
    else db.prepare('INSERT INTO photo_votes (photo_id, appareil) VALUES (?, ?)').run(id, req.appareil);
    const n = db.prepare('SELECT COUNT(*) AS n FROM photo_votes WHERE photo_id = ?').get(id).n;
    res.json({ ok: true, coeurs: n, aime: !deja });
  }));

  // ---------- Commentaires sur les photos ----------
  const commentaires = (id) => db.prepare('SELECT id, auteur, texte, created_at AS le FROM photo_commentaires WHERE photo_id = ? ORDER BY id ASC LIMIT 200').all(id);
  app.get('/api/photos/:id/commentaires', exiger('commentaires'), (req, res) => res.json({ commentaires: commentaires(Number(req.params.id)) }));
  app.post('/api/photos/:id/commentaires', exiger('commentaires'), garde((req, res) => {
    anti(req);
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM photos WHERE id = ? AND masquee = 0').get(id)) throw new AnimError(404, 'NOT_FOUND', 'Photo introuvable.');
    const auteur = propre(req.body && req.body.auteur, 60), texte = propre(req.body && req.body.texte, 300);
    if (!auteur) throw new AnimError(400, 'AUTEUR', 'Indiquez votre prénom.');
    if (!texte) throw new AnimError(400, 'TEXTE', 'Écrivez un commentaire.');
    const n = db.prepare("SELECT COUNT(*) AS n FROM photo_commentaires WHERE appareil = ? AND created_at > datetime('now', '-1 hour')").get(req.appareil).n;
    if (n >= 40) throw new AnimError(429, 'TOO_MANY', 'Beaucoup de commentaires ! Faites une petite pause 😉');
    db.prepare('INSERT INTO photo_commentaires (photo_id, auteur, texte, appareil) VALUES (?, ?, ?, ?)').run(id, auteur, texte, req.appareil);
    res.json({ ok: true, commentaires: commentaires(id) });
  }));

  // ---------- Cartes postales (livre d'or) ----------
  const carteOut = (c) => ({ id: c.id, auteur: c.auteur, message: c.message, timbre: c.timbre, le: c.created_at });
  app.get('/api/cartes', exiger('cartes'), (req, res) => {
    res.json({ cartes: db.prepare('SELECT * FROM cartes WHERE masquee = 0 ORDER BY id DESC LIMIT 300').all().map(carteOut) });
  });
  app.post('/api/cartes', exiger('cartes'), garde((req, res) => {
    anti(req);
    const b = req.body || {};
    const auteur = propre(b.auteur, 60), message = propreTexte(b.message, 600);
    const timbre = TIMBRES.includes(b.timbre) ? b.timbre : TIMBRES[0];
    if (!auteur) throw new AnimError(400, 'AUTEUR', 'Signez votre carte avec votre prénom.');
    if (message.length < 2) throw new AnimError(400, 'MESSAGE', 'Écrivez un petit mot.');
    const n = db.prepare("SELECT COUNT(*) AS n FROM cartes WHERE appareil = ? AND created_at > datetime('now', '-1 day')").get(req.appareil).n;
    if (n >= 10) throw new AnimError(429, 'TOO_MANY', 'Déjà 10 cartes aujourd’hui depuis ce téléphone !');
    const info = db.prepare('INSERT INTO cartes (auteur, message, timbre, appareil) VALUES (?, ?, ?, ?)').run(auteur, message, timbre, req.appareil);
    res.json({ ok: true, id: info.lastInsertRowid });
  }));

  // ---------- Playlist ----------
  const listePlaylist = (appareil) => db.prepare(`
    SELECT t.*, COUNT(v.appareil) AS votes, MAX(CASE WHEN v.appareil = ? THEN 1 ELSE 0 END) AS a_vote
    FROM titres t LEFT JOIN titre_votes v ON v.titre_id = t.id
    GROUP BY t.id ORDER BY votes DESC, t.id ASC`).all(appareil)
    .map((t) => ({ id: t.id, titre: t.titre, artiste: t.artiste, auteur: t.auteur, votes: t.votes, aVote: !!t.a_vote }));
  app.get('/api/playlist', exiger('playlist'), (req, res) => res.json({ titres: listePlaylist(req.appareil) }));
  app.post('/api/playlist', exiger('playlist'), garde((req, res) => {
    anti(req);
    const b = req.body || {};
    const titre = propre(b.titre, 100), artiste = propre(b.artiste, 80), auteur = propre(b.auteur, 60);
    if (titre.length < 1) throw new AnimError(400, 'TITRE', 'Indiquez le titre de la chanson.');
    const cle = `${titre}|${artiste}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9|]+/g, '');
    let t = db.prepare('SELECT id FROM titres WHERE cle = ?').get(cle);
    let nouveau = false;
    if (!t) {
      const n = db.prepare('SELECT COUNT(*) AS n FROM titres WHERE appareil = ?').get(req.appareil).n;
      if (n >= 15) throw new AnimError(429, 'TOO_MANY', '15 propositions maximum par téléphone : votez pour les autres !');
      t = { id: db.prepare('INSERT INTO titres (titre, artiste, cle, auteur, appareil) VALUES (?, ?, ?, ?, ?)').run(titre, artiste, cle, auteur, req.appareil).lastInsertRowid };
      nouveau = true;
    }
    db.prepare('INSERT OR IGNORE INTO titre_votes (titre_id, appareil) VALUES (?, ?)').run(t.id, req.appareil);
    res.json({ ok: true, nouveau, titres: listePlaylist(req.appareil) });
  }));
  app.post('/api/playlist/:id/vote', exiger('playlist'), garde((req, res) => {
    anti(req);
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM titres WHERE id = ?').get(id)) throw new AnimError(404, 'NOT_FOUND', 'Titre introuvable.');
    const deja = db.prepare('SELECT 1 FROM titre_votes WHERE titre_id = ? AND appareil = ?').get(id, req.appareil);
    if (deja) db.prepare('DELETE FROM titre_votes WHERE titre_id = ? AND appareil = ?').run(id, req.appareil);
    else db.prepare('INSERT INTO titre_votes (titre_id, appareil) VALUES (?, ?)').run(id, req.appareil);
    res.json({ ok: true, titres: listePlaylist(req.appareil) });
  }));

  // ---------- Quiz ----------
  const classement = () => db.prepare('SELECT auteur, score, total FROM quiz_reponses ORDER BY score DESC, created_at ASC LIMIT 10').all();
  app.get('/api/quiz', exiger('quiz'), garde((req, res) => {
    const deja = db.prepare('SELECT score, total FROM quiz_reponses WHERE appareil = ?').get(req.appareil);
    if (deja) return res.json({ deja: true, score: deja.score, total: deja.total, classement: classement() });
    res.json({ deja: false, questions: quiz().map((q) => ({ id: q.id, question: q.question, choix: melanger(q.choix) })) });
  }));
  app.post('/api/quiz', exiger('quiz'), garde((req, res) => {
    anti(req);
    const b = req.body || {};
    const auteur = propre(b.auteur, 60);
    if (!auteur) throw new AnimError(400, 'AUTEUR', 'Indiquez votre prénom pour le classement.');
    if (db.prepare('SELECT 1 FROM quiz_reponses WHERE appareil = ?').get(req.appareil)) throw new AnimError(409, 'DEJA', 'Vous avez déjà joué depuis ce téléphone !');
    const rep = b.reponses && typeof b.reponses === 'object' ? b.reponses : {};
    const qs = quiz();
    const corrections = qs.map((q) => ({ id: q.id, bonne: q.choix[0], juste: rep[q.id] === q.choix[0] }));
    const score = corrections.filter((c) => c.juste).length;
    db.prepare('INSERT INTO quiz_reponses (appareil, auteur, reponses, score, total) VALUES (?, ?, ?, ?, ?)')
      .run(req.appareil, auteur, JSON.stringify(rep), score, qs.length);
    res.json({ ok: true, score, total: qs.length, corrections, classement: classement() });
  }));

  // ---------- Pronostics ----------
  const resultatsPronos = () => {
    const rows = db.prepare('SELECT question, choix, COUNT(*) AS n FROM prono_votes GROUP BY question, choix').all();
    const r = {};
    for (const x of rows) (r[x.question] ||= {})[x.choix] = x.n;
    return r;
  };
  app.get('/api/pronos', exiger('pronos'), garde((req, res) => {
    const mes = Object.fromEntries(db.prepare('SELECT question, choix FROM prono_votes WHERE appareil = ?').all(req.appareil).map((v) => [v.question, v.choix]));
    const revele = pronosReveles();
    res.json({ questions: pronos(), mes, revele, resultats: revele ? resultatsPronos() : null });
  }));
  app.post('/api/pronos', exiger('pronos'), garde((req, res) => {
    anti(req);
    if (pronosReveles()) throw new AnimError(409, 'REVELE', 'Les résultats sont révélés : les votes sont clos !');
    const b = req.body || {};
    const q = pronos().find((x) => x.id === b.question);
    if (!q || !q.choix.includes(b.choix)) throw new AnimError(400, 'CHOIX', 'Choix invalide.');
    db.prepare('INSERT INTO prono_votes (question, appareil, choix) VALUES (?, ?, ?) ON CONFLICT(question, appareil) DO UPDATE SET choix = excluded.choix')
      .run(q.id, req.appareil, b.choix);
    res.json({ ok: true });
  }));

  // ---------- Admin ----------
  admin.get('/animations', garde((req, res) => {
    const m = missions();
    const parMission = Object.fromEntries(db.prepare("SELECT mission, COUNT(*) AS n FROM photos WHERE mission <> '' GROUP BY mission").all().map((x) => [x.mission, x.n]));
    const topPhotos = db.prepare(`SELECT p.id, p.fichier, p.auteur, p.mission, COUNT(v.appareil) AS coeurs FROM photos p
      JOIN photo_votes v ON v.photo_id = p.id WHERE p.masquee = 0 GROUP BY p.id ORDER BY coeurs DESC, p.id ASC LIMIT 12`).all()
      .map((p) => ({ id: p.id, url: `/photos/f/${p.fichier}`, auteur: p.auteur, mission: p.mission, coeurs: p.coeurs }));
    let quizQs = [], pronosQs = [], erreurs = [];
    try { quizQs = quiz(); } catch (e) { erreurs.push(e.message); }
    try { pronosQs = pronos(); } catch (e) { erreurs.push(e.message); }
    res.json({
      ouverts: ouverts(),
      textes: { missions: lire('missions', MISSIONS_DEFAUT), quiz: lire('quiz', QUIZ_DEFAUT), pronos: lire('pronos', PRONOS_DEFAUT) },
      missions: m.map((x) => ({ mission: x, photos: parMission[x] || 0 })),
      topPhotos,
      commentaires: db.prepare(`SELECT c.id, c.auteur, c.texte, c.created_at AS le, p.fichier FROM photo_commentaires c
        JOIN photos p ON p.id = c.photo_id ORDER BY c.id DESC LIMIT 200`).all().map((c) => ({ id: c.id, auteur: c.auteur, texte: c.texte, le: c.le, url: `/photos/f/${c.fichier}` })),
      cartes: db.prepare('SELECT * FROM cartes ORDER BY id DESC').all().map((c) => ({ ...carteOut(c), masquee: !!c.masquee })),
      playlist: listePlaylist(''),
      quiz: { questions: quizQs.length, joueurs: db.prepare('SELECT id, auteur, score, total, created_at AS le FROM quiz_reponses ORDER BY score DESC, created_at ASC').all() },
      pronos: { questions: pronosQs, resultats: resultatsPronos(), revele: pronosReveles() },
      erreurs,
    });
  }));
  admin.put('/animations/ouvert', garde((req, res) => {
    const b = req.body || {};
    if (!NOMS.includes(b.nom)) throw new AnimError(400, 'NOM', 'Animation inconnue.');
    ecrire(`${b.nom}_ouvert`, b.ouvert ? '1' : '0');
    res.json({ ok: true, ouverts: ouverts() });
  }));
  admin.put('/animations/textes', garde((req, res) => {
    const b = req.body || {};
    if (b.missions !== undefined) { const m = lireMissions(b.missions); if (!m.length) throw new AnimError(400, 'VIDE', 'Au moins une mission.'); ecrire('missions', m.join('\n')); }
    if (b.quiz !== undefined) { const q = lireLignes(b.quiz, { label: 'Quiz' }); if (!q.length) throw new AnimError(400, 'VIDE', 'Au moins une question.'); ecrire('quiz', String(b.quiz).trim()); }
    if (b.pronos !== undefined) { const p = lireLignes(b.pronos, { label: 'Pronostics' }); if (!p.length) throw new AnimError(400, 'VIDE', 'Au moins une question.'); ecrire('pronos', String(b.pronos).trim()); }
    res.json({ ok: true });
  }));
  admin.put('/pronos-revele', (req, res) => { ecrire('pronos_reveles', req.body && req.body.revele ? '1' : '0'); res.json({ ok: true }); });
  admin.post('/cartes/:id/masquer', (req, res) => {
    db.prepare('UPDATE cartes SET masquee = ? WHERE id = ?').run(req.body && req.body.masquee ? 1 : 0, Number(req.params.id));
    res.json({ ok: true });
  });
  admin.delete('/commentaires/:id', (req, res) => { db.prepare('DELETE FROM photo_commentaires WHERE id = ?').run(Number(req.params.id)); res.json({ ok: true }); });
  admin.delete('/cartes/:id', (req, res) => { db.prepare('DELETE FROM cartes WHERE id = ?').run(Number(req.params.id)); res.json({ ok: true }); });
  admin.delete('/playlist/:id', (req, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM titre_votes WHERE titre_id = ?').run(id);
    db.prepare('DELETE FROM titres WHERE id = ?').run(id);
    res.json({ ok: true });
  });
  admin.delete('/quiz/:id', (req, res) => { db.prepare('DELETE FROM quiz_reponses WHERE id = ?').run(Number(req.params.id)); res.json({ ok: true }); });
  admin.get('/playlist.csv', (req, res) => {
    res.type('text/csv; charset=utf-8').attachment('playlist-mariage.csv')
      .send(csv([['Votes', 'Titre', 'Artiste', 'Proposé par'], ...listePlaylist('').map((t) => [t.votes, t.titre, t.artiste, t.auteur])]));
  });
  admin.get('/cartes.csv', (req, res) => {
    res.type('text/csv; charset=utf-8').attachment('cartes-postales-mariage.csv')
      .send(csv([['De', 'Timbre', 'Message', 'Le'], ...db.prepare('SELECT * FROM cartes WHERE masquee = 0 ORDER BY id').all().map((c) => [c.auteur, c.timbre, c.message, c.created_at])]));
  });

  return { ouvert, ouverts, missions };
}

module.exports = { monterAnimations, NOMS, TIMBRES };

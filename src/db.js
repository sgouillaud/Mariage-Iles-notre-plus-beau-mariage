'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Infos pratiques affichées sur le site, modifiables depuis /admin
const DEFAULT_INFOS = [
  { icone: '🛏️', titre: 'Dormir sur place', texte: 'Des chambres sont disponibles au prieuré, check-in dès 14h le samedi.', bientot: false },
  {
    icone: '🚗', titre: 'Venir en voiture', bientot: false,
    texte: 'Depuis Paris (environ 140 km, 2 h) : A6 puis A10, ensuite A11 direction Chartres. Sortie Chartres, puis N10 direction Tours par Bonneval et Châteaudun, jusqu\'à Cloyes.\n\n'
      + 'Depuis Rennes (environ 260 km, 3 h) : N157 vers Laval, puis A81 et A11 direction Paris. Sortie vers Brou et Châteaudun, D955 jusqu\'à Châteaudun, puis N10 jusqu\'à Cloyes.\n\n'
      + 'Infos parking à venir.',
  },
  {
    icone: '🚆', titre: 'Train : gare de Châteaudun', bientot: false,
    texte: 'La gare la mieux desservie : TER Rémi direct depuis Paris-Austerlitz, environ 1 h 30. Châteaudun est à une douzaine de kilomètres du prieuré (prévoir voiture ou taxi).\n\n'
      + 'Aller, trains directs depuis Paris-Austerlitz : 6h25, 8h12, 9h39, 13h56, 16h25, 17h59, 19h25.\n'
      + 'Retour, trains directs depuis Châteaudun : 6h05, 7h08, 10h54, 12h09, 16h08, 17h09, 18h42.\n\n'
      + 'Horaires actuels en semaine, à titre indicatif. Ceux de juin 2027 seront publiés à la mi-décembre : nous mettrons cette rubrique à jour.',
  },
  {
    icone: '🚉', titre: 'Train : gare de Cloyes', bientot: false,
    texte: 'La gare de Cloyes est sur place, mais moins desservie : 2 trains directs par jour avec Paris-Austerlitz (environ 1 h 40). Les autres trajets passent par une correspondance.\n\n'
      + 'Aller depuis Paris-Austerlitz : 13h56 (arrivée 15h33), 19h25 (arrivée 21h17).\n'
      + 'Retour depuis Cloyes : 5h53 (arrivée 7h45), 16h56 (arrivée 18h36).\n\n'
      + 'Horaires actuels en semaine, à titre indicatif, mis à jour quand ceux de juin 2027 seront connus.',
  },
  { icone: '👗', titre: 'Dress code', texte: 'On vous dit tout très bientôt.', bientot: true },
  { icone: '🎁', titre: 'Liste de mariage', texte: 'Bientôt en ligne.', bientot: true },
];

function openDb(file) {
  const dbFile = file || process.env.DB_PATH || path.join(__dirname, '..', 'data', 'mariage.db');
  if (dbFile !== ':memory:') fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  db.exec(`
    CREATE TABLE IF NOT EXISTS rsvps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cle TEXT NOT NULL UNIQUE,              -- email + prénom (en minuscules) : une réponse par personne
      prenom TEXT NOT NULL,
      nom TEXT NOT NULL,
      email TEXT NOT NULL,
      telephone TEXT NOT NULL,
      presence TEXT NOT NULL,
      moments TEXT NOT NULL DEFAULT '',
      hebergement TEXT NOT NULL DEFAULT '',
      accompagnant TEXT NOT NULL DEFAULT '',
      enfants TEXT NOT NULL DEFAULT '[]',    -- JSON [{prenom, nom, age}]
      allergies TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      nb_personnes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('infos', JSON.stringify(DEFAULT_INFOS));
  return db;
}

function getInfos(db) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'infos'").get();
  try { return row ? JSON.parse(row.value) : DEFAULT_INFOS; } catch { return DEFAULT_INFOS; }
}

function setInfos(db, infos) {
  db.prepare("INSERT INTO settings (key, value) VALUES ('infos', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(infos));
}

module.exports = { openDb, getInfos, setInfos, DEFAULT_INFOS };

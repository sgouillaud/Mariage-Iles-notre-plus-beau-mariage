'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Infos pratiques affichées sur le site, modifiables depuis /admin
const DEFAULT_INFOS = [
  { icone: '🛏️', titre: 'Dormir sur place', texte: 'Des chambres sont disponibles au prieuré, check-in dès 14h le samedi.', bientot: false },
  { icone: '🚗', titre: 'Venir en voiture', texte: 'Infos parking et itinéraire à venir.', bientot: true },
  { icone: '🚆', titre: 'Venir en train', texte: 'Gares les plus proches et navettes à venir.', bientot: true },
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

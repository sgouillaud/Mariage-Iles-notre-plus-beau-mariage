'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Infos pratiques affichées sur le site, modifiables depuis /admin (valeurs de départ)
const DEFAULT_INFOS = require('./infos-par-defaut.json');

// Emplacement de la base : DB_PATH, sinon le volume Railway s'il existe, sinon ./data (essais en local).
// Sur Railway, seul le volume survit aux redéploiements : une base ailleurs est effacée à chaque mise à jour.
function cheminBase() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  if (process.env.RAILWAY_VOLUME_MOUNT_PATH) return path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'mariage.db');
  return path.join(__dirname, '..', 'data', 'mariage.db');
}

// La base est-elle bien sur le volume ? (null = impossible à savoir, ex. en local)
function stockage() {
  const fichier = path.resolve(cheminBase());
  const volume = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  const surRailway = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID);
  if (!surRailway) return { fichier, surVolume: null };
  if (!volume) return { fichier, surVolume: false, raison: 'Aucun volume n’est rattaché au service.' };
  const v = path.resolve(volume);
  const ok = fichier === v || fichier.startsWith(v + path.sep);
  return { fichier, volume: v, surVolume: ok, raison: ok ? '' : `La base (${fichier}) n’est pas dans le volume (${v}).` };
}

function openDb(file) {
  const dbFile = file || cheminBase();
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
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fichier TEXT NOT NULL UNIQUE,          -- nom du fichier dans le dossier des photos
      auteur TEXT NOT NULL DEFAULT '',
      masquee INTEGER NOT NULL DEFAULT 0,    -- 1 = retirée du diaporama par les mariés
      taille INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('infos', JSON.stringify(DEFAULT_INFOS));

  // Animations (missions, cœurs, cartes postales, playlist, quiz, pronostics)
  const colonnes = db.prepare('PRAGMA table_info(photos)').all().map((c) => c.name);
  if (!colonnes.includes('mission')) db.exec("ALTER TABLE photos ADD COLUMN mission TEXT NOT NULL DEFAULT ''");
  if (!colonnes.includes('appareil')) db.exec("ALTER TABLE photos ADD COLUMN appareil TEXT NOT NULL DEFAULT ''");
  db.exec(`
    CREATE TABLE IF NOT EXISTS photo_votes (
      photo_id INTEGER NOT NULL, appareil TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (photo_id, appareil)
    );
    CREATE TABLE IF NOT EXISTS cartes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auteur TEXT NOT NULL, message TEXT NOT NULL, timbre TEXT NOT NULL DEFAULT '',
      appareil TEXT NOT NULL DEFAULT '', masquee INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS titres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titre TEXT NOT NULL, artiste TEXT NOT NULL DEFAULT '', cle TEXT NOT NULL UNIQUE,
      auteur TEXT NOT NULL DEFAULT '', appareil TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS titre_votes (
      titre_id INTEGER NOT NULL, appareil TEXT NOT NULL,
      PRIMARY KEY (titre_id, appareil)
    );
    CREATE TABLE IF NOT EXISTS quiz_reponses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appareil TEXT NOT NULL UNIQUE, auteur TEXT NOT NULL,
      reponses TEXT NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS prono_votes (
      question TEXT NOT NULL, appareil TEXT NOT NULL, choix TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (question, appareil)
    );
  `);
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

module.exports = { cheminBase, stockage, openDb, getInfos, setInfos, DEFAULT_INFOS };

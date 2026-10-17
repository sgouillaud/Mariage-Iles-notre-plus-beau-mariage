'use strict';
const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createApp } = require('../server');
const { openDb } = require('../src/db');

const PWD = 'mot-de-passe-de-test';
function setup() {
  const db = openDb(':memory:');
  const app = createApp({ db, adminPassword: PWD, sessionSecret: 'x'.repeat(40), env: 'test' });
  return { app, db };
}
async function login(app) {
  const r = await request(app).post('/api/admin/login').send({ password: PWD });
  return r.headers['set-cookie'];
}
const base = {
  prenom: 'Léa', nom: 'Martin', email: 'Lea@Test.fr', telephone: '06 12 34 56 78',
  presence: 'Oui', moments: 'Mairie, Dîner, Brunch', hebergement: 'Logé sur place',
  accompagnant: 'Tom Martin', enfants: [{ prenom: 'Léo', nom: 'Martin', age: 6 }],
  allergies: 'Arachides (Léo)', message: 'Trop hâte !',
};

test('page d\'accueil : og:image en adresse absolue', async () => {
  const { app } = setup();
  const r = await request(app).get('/').set('Host', 'iles.example.com');
  assert.equal(r.status, 200);
  assert.match(r.text, /content="http:\/\/iles\.example\.com\/apercu-whatsapp\.jpg"/);
  assert.doesNotMatch(r.text, /__ORIGIN__/);
});

test('RSVP valide enregistré puis mis à jour (même email + prénom)', async () => {
  const { app, db } = setup();
  let r = await request(app).post('/api/rsvp').send(base);
  assert.equal(r.status, 200); assert.equal(r.body.updated, false);
  r = await request(app).post('/api/rsvp').send({ ...base, email: 'lea@test.fr', moments: 'Dîner' });
  assert.equal(r.body.updated, true);
  const rows = db.prepare('SELECT * FROM rsvps').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].moments, 'Dîner');
  assert.equal(rows[0].nb_personnes, 3);
});

test('RSVP invalides refusés', async () => {
  const { app } = setup();
  for (const bad of [
    { ...base, email: 'pas-un-email' },
    { ...base, telephone: 'abc' },
    { ...base, presence: 'Bof' },
    { ...base, presence: 'Peut-être' },
    { ...base, hebergement: '' },
    { ...base, enfants: [{ prenom: 'A', nom: 'B', age: 25 }] },
    { ...base, prenom: '' },
  ]) {
    const r = await request(app).post('/api/rsvp').send(bad);
    assert.equal(r.status, 400, JSON.stringify(bad));
  }
});

test('Réponse « Non » : détails ignorés, 0 personne', async () => {
  const { app, db } = setup();
  await request(app).post('/api/rsvp').send({ ...base, presence: 'Non', hebergement: '' });
  const row = db.prepare('SELECT * FROM rsvps').get();
  assert.equal(row.nb_personnes, 0);
  assert.equal(row.enfants, '[]');
  assert.equal(row.allergies, '');
});

test('Admin : accès refusé sans connexion, mauvais mot de passe, cookie falsifié', async () => {
  const { app } = setup();
  assert.equal((await request(app).get('/api/admin/rsvps')).status, 401);
  assert.equal((await request(app).post('/api/admin/login').send({ password: 'faux' })).status, 401);
  assert.equal((await request(app).get('/api/admin/rsvps').set('Cookie', 'iles_admin=admin.9999999999999.abc.faux')).status, 401);
});

test('Admin : statistiques, export CSV, suppression', async () => {
  const { app } = setup();
  await request(app).post('/api/rsvp').send(base);
  await request(app).post('/api/rsvp').send({ ...base, prenom: 'Paul', email: 'paul@test.fr', presence: 'Non' });
  const c = await login(app);
  const r = await request(app).get('/api/admin/rsvps').set('Cookie', c);
  assert.equal(r.body.stats.reponses, 2);
  assert.equal(r.body.stats.personnes, 3);
  assert.equal(r.body.stats.loges, 3);
  assert.equal(r.body.stats.enfants, 1);
  assert.equal(r.body.stats.moments.Mairie, 3);
  const csv = await request(app).get('/api/admin/export.csv').set('Cookie', c);
  assert.match(csv.text, /Léa;Martin;lea@test\.fr/);
  const enf = await request(app).get('/api/admin/export-enfants.csv').set('Cookie', c);
  assert.match(enf.text, /Léo;Martin;6;Léa Martin/);
  const id = r.body.rsvps.find((x) => x.prenom === 'Paul').id;
  await request(app).delete('/api/admin/rsvps/' + id).set('Cookie', c);
  const r2 = await request(app).get('/api/admin/rsvps').set('Cookie', c);
  assert.equal(r2.body.rsvps.length, 1);
});

test('Admin : infos pratiques modifiables et visibles publiquement', async () => {
  const { app } = setup();
  const c = await login(app);
  const infos = [{ icone: '🚗', titre: 'Parking', texte: 'Parking gratuit devant le prieuré.', bientot: false }];
  assert.equal((await request(app).put('/api/admin/infos').set('Cookie', c).send({ infos })).status, 200);
  const pub = await request(app).get('/api/infos');
  assert.deepEqual(pub.body.infos, infos);
  assert.equal((await request(app).put('/api/admin/infos').set('Cookie', c).send({ infos: [{ titre: '' }] })).status, 400);
});

test('Admin : trajets dépliables et liens vérifiés', async () => {
  const { app } = setup();
  const c = await login(app);
  const infos = [{
    icone: '🚗', titre: 'Venir en voiture', texte: '', bientot: false,
    trajets: [{ depuis: 'Paris', resume: '140 km · 2 h', details: 'A10 puis A11.', lien: 'https://www.google.com/maps', lienTexte: 'Carte' }],
    lien: { texte: 'SNCF', url: 'https://www.sncf-connect.com' },
  }];
  const r = await request(app).put('/api/admin/infos').set('Cookie', c).send({ infos });
  assert.equal(r.status, 200);
  assert.equal((await request(app).get('/api/infos')).body.infos[0].trajets[0].depuis, 'Paris');
  const bad = JSON.parse(JSON.stringify(infos)); bad[0].trajets[0].lien = 'javascript:alert(1)';
  assert.equal((await request(app).put('/api/admin/infos').set('Cookie', c).send({ infos: bad })).status, 400);
});

test('Infos par défaut : 6 trajets en voiture, Paris seul en train', async () => {
  const { app } = setup();
  const r = await request(app).get('/api/infos');
  const titres = r.body.infos.map((i) => i.titre);
  assert.ok(titres.includes('Venir en voiture') && titres.includes('Venir en train'));
  const par = (titre) => r.body.infos.find((i) => i.titre === titre).trajets.map((t) => t.depuis);
  assert.deepEqual(par('Venir en voiture'), ['Paris', 'Beauvais', 'Caen', 'Rennes', 'Vannes', 'la Guadeloupe']);
  assert.deepEqual(par('Venir en train'), ['Paris']);
});

test('Dress code : nuancier par défaut et couleurs vérifiées', async () => {
  const { app } = setup();
  const dc = (await request(app).get('/api/infos')).body.infos.find((i) => i.titre === 'Dress code');
  assert.deepEqual(dc.couleurs.map((c) => c.nom), ['Blanc', 'Ivoire', 'Écru', 'Beige', 'Sable']);
  const c = await login(app);
  const bad = [{ titre: 'Dress code', couleurs: [{ nom: 'Rouge', hex: 'red' }] }];
  assert.equal((await request(app).put('/api/admin/infos').set('Cookie', c).send({ infos: bad })).status, 400);
});

test('Site privé : code invité requis, lien avec code, aperçu WhatsApp et admin accessibles', async () => {
  const db = openDb(':memory:');
  const app = createApp({ db, adminPassword: PWD, sessionSecret: 'x'.repeat(40), env: 'test', guestCode: 'Iles2027' });
  let r = await request(app).get('/').set('Host', 'iles.example.com');
  assert.match(r.text, /Votre carte d'embarquement/);
  assert.match(r.text, /og:image" content="http:\/\/iles\.example\.com\/apercu-whatsapp\.jpg"/);
  assert.equal((await request(app).get('/api/infos')).status, 401);
  assert.equal((await request(app).post('/api/rsvp').send(base)).status, 401);
  assert.equal((await request(app).get('/site.js')).status, 404);
  assert.equal((await request(app).get('/apercu-whatsapp.jpg')).status, 200);
  assert.equal((await request(app).get('/admin')).status, 200);
  assert.equal((await request(app).post('/api/invite').send({ code: 'faux' })).status, 401);
  r = await request(app).post('/api/invite').send({ code: ' iles2027 ' });
  assert.equal(r.status, 200);
  const cookie = r.headers['set-cookie'];
  assert.equal((await request(app).get('/api/infos').set('Cookie', cookie)).status, 200);
  assert.match((await request(app).get('/').set('Cookie', cookie)).text, /Cédric <em>&amp;<\/em> Sébastien/);
  r = await request(app).get('/?code=ILES2027');
  assert.equal(r.status, 302);
  assert.ok(r.headers['set-cookie'][0].startsWith('iles_invite='));
});

test('Chanson : jamais servie sans code invité, servie aux invités connectés', async () => {
  const { app } = setup();
  assert.equal((await request(app).get('/sons/chanson.mp3')).status, 404);
  const db = openDb(':memory:');
  const prive = createApp({ db, adminPassword: PWD, sessionSecret: 'x'.repeat(40), env: 'test', guestCode: 'Iles2027' });
  assert.equal((await request(prive).get('/sons/chanson.mp3')).status, 404);
  const c = (await request(prive).post('/api/invite').send({ code: 'Iles2027' })).headers['set-cookie'];
  const r = await request(prive).get('/sons/chanson.mp3').set('Cookie', c);
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /audio\/mpeg/);
});

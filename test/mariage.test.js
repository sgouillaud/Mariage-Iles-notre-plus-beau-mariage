'use strict';
const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createApp } = require('../server');
const { openDb } = require('../src/db');

const PWD = 'mot-de-passe-de-test';
const os = require('os');
const fs = require('fs');
const path = require('path');
const tmpPhotos = () => fs.mkdtempSync(path.join(os.tmpdir(), 'photos-test-'));
function setup() {
  const db = openDb(':memory:');
  const app = createApp({ db, adminPassword: PWD, sessionSecret: 'x'.repeat(40), env: 'test', photosDir: tmpPhotos() });
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
  assert.ok(r.headers['set-cookie'].some((x) => x.startsWith('iles_invite=')));
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

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 1)]);

test('Photos : envoi, liste, diaporama, modération et QR code', async () => {
  const db = openDb(':memory:');
  const dir = tmpPhotos();
  const app = createApp({ db, adminPassword: PWD, sessionSecret: 'x'.repeat(40), env: 'test', guestCode: 'Iles2027', photosDir: dir });
  // Sans code invité : rien n'est accessible
  assert.equal((await request(app).post('/api/photos').set('Content-Type', 'image/jpeg').send(JPEG)).status, 401);
  assert.equal((await request(app).get('/photos')).status, 404);
  // Le lien du QR code ouvre la page photos avec le code
  let r = await request(app).get('/photos?code=Iles2027');
  assert.equal(r.status, 302); assert.equal(r.headers.location, '/photos');
  const c = r.headers['set-cookie'];
  // Fermé par défaut : « à venir » pour les invités, envoi refusé
  assert.match((await request(app).get('/photos').set('Cookie', c)).text, /Bientôt, vos photos/);
  assert.match((await request(app).get('/').set('Cookie', c)).text, /nav-bientot/);
  assert.equal((await request(app).post('/api/photos').set('Cookie', c).set('Content-Type', 'image/jpeg').send(JPEG)).status, 403);
  assert.equal((await request(app).get('/api/photos.zip').set('Cookie', c)).status, 403);
  const a0 = await login(app);
  assert.match((await request(app).get('/photos').set('Cookie', a0)).text, /Partagez vos photos/);
  await request(app).put('/api/admin/photos-ouvert').set('Cookie', a0).send({ ouvert: true });
  assert.match((await request(app).get('/').set('Cookie', c)).text, /<a href="\/escales">Escales<\/a>/);
  assert.equal((await request(app).get('/photos').set('Cookie', c)).status, 200);
  assert.equal((await request(app).get('/diaporama').set('Cookie', c)).status, 200);
  // Fichier qui n'est pas une image : refusé
  assert.equal((await request(app).post('/api/photos').set('Cookie', c).set('Content-Type', 'image/jpeg').send(Buffer.alloc(300, 7))).status, 400);
  r = await request(app).post('/api/photos').set('Cookie', c).set('Content-Type', 'image/jpeg')
    .set('X-Auteur', encodeURIComponent('Léa <b>')).send(JPEG);
  assert.equal(r.status, 200);
  r = await request(app).get('/api/photos').set('Cookie', c);
  assert.equal(r.body.photos.length, 1);
  assert.equal(r.body.photos[0].auteur, 'Léa b');
  const url = r.body.photos[0].url;
  assert.equal((await request(app).get(url).set('Cookie', c)).status, 200);
  assert.equal((await request(app).get(url)).status, 404);
  const zip = await request(app).get('/api/photos.zip').set('Cookie', c).buffer(true).parse((res, cb) => { const d = []; res.on('data', (x) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); });
  assert.equal(zip.status, 200);
  assert.equal(zip.body.readUInt32LE(0), 0x04034b50);
  assert.ok(zip.body.includes(Buffer.from('0001-Lea-b.jpg')));
  assert.ok(zip.body.includes(JPEG));
  assert.equal((await request(app).get('/api/photos.zip')).status, 401);
  assert.match((await request(app).get(url + '?dl=1').set('Cookie', c)).headers['content-disposition'], /attachment/);
  const qr = await request(app).get('/api/qr-photos.svg').set('Cookie', c);
  assert.equal(qr.status, 200); assert.match(qr.headers['content-type'], /image\/svg\+xml/);
  // Admin : QR à imprimer avec le code intégré, masquer puis supprimer
  const a = await login(app);
  const ad = await request(app).get('/api/admin/photos').set('Cookie', a);
  assert.match(ad.body.lien, /\/photos\?code=Iles2027$/);
  const png = await request(app).get('/api/admin/qr-photos.png').set('Cookie', a);
  assert.equal(png.status, 200); assert.match(png.headers['content-type'], /image\/png/);
  const id = ad.body.photos[0].id;
  await request(app).post(`/api/admin/photos/${id}/masquer`).set('Cookie', a).send({ masquee: true });
  assert.equal((await request(app).get('/api/photos').set('Cookie', c)).body.photos.length, 0);
  assert.equal((await request(app).get(url).set('Cookie', c)).status, 404);
  assert.equal((await request(app).get(url).set('Cookie', a)).status, 200);
  await request(app).delete(`/api/admin/photos/${id}`).set('Cookie', a);
  assert.equal((await request(app).get('/api/admin/photos').set('Cookie', a)).body.photos.length, 0);
  await new Promise((ok) => setTimeout(ok, 50));
  assert.equal(fs.readdirSync(dir).length, 0);
});

test('Restauration : réimport d’un export CSV, sans doublon', async () => {
  const { app } = setup();
  await request(app).post('/api/rsvp').send(base);
  const c = await login(app);
  const csv = (await request(app).get('/api/admin/export.csv').set('Cookie', c)).text
    + '\nPaul;Durand;paul@test.fr;0611223344;Oui;Dîner;Logé sur place;;2;Zoé Durand Petit (8 ans), Max Durand (3 ans);"Sans gluten; merci";"Bonne\nfête";3;2026-10-20 10:00:00;2026-10-21 11:00:00';
  let r = await request(app).post('/api/admin/import.csv').set('Cookie', c).set('Content-Type', 'text/csv').send(csv);
  assert.deepEqual(r.body, { ok: true, ajoutees: 1, deja: 1 });
  const rows = (await request(app).get('/api/admin/rsvps').set('Cookie', c)).body.rsvps;
  const paul = rows.find((x) => x.prenom === 'Paul');
  assert.deepEqual(paul.enfants, [{ prenom: 'Zoé', nom: 'Durand Petit', age: 8 }, { prenom: 'Max', nom: 'Durand', age: 3 }]);
  assert.equal(paul.allergies, 'Sans gluten; merci');
  assert.equal(paul.message, 'Bonne\nfête');
  assert.equal(paul.created_at, '2026-10-20 10:00:00');
  r = await request(app).post('/api/admin/import.csv').set('Cookie', c).set('Content-Type', 'text/csv').send('a;b\n1;2');
  assert.equal(r.status, 400);
  assert.equal((await request(app).post('/api/admin/import.csv').set('Content-Type', 'text/csv').send(csv)).status, 401);
});

test('Animations : fermées par défaut, puis missions, cœurs, cartes, playlist, quiz et pronostics', async () => {
  const db = openDb(':memory:');
  const app = createApp({ db, adminPassword: PWD, sessionSecret: 'x'.repeat(40), env: 'test', guestCode: 'Iles2027', photosDir: tmpPhotos() });
  const agent = request.agent(app); // un invité avec son téléphone (cookies conservés)
  await agent.get('/?code=Iles2027');
  const autre = request.agent(app); // un deuxième invité
  await autre.get('/?code=Iles2027');
  // Fermé : « à venir »
  assert.match((await agent.get('/')).text, /nav-bientot[^<]*>Escales/);
  assert.match((await agent.get('/quiz')).text, /ouvre bientôt/);
  assert.equal((await agent.post('/api/cartes').send({ auteur: 'Léa', message: 'Coucou' })).status, 403);
  assert.equal((await agent.get('/api/escales')).body.missions.length, 0);
  // Les mariés ouvrent tout
  const a = await login(app);
  for (const nom of ['photos', 'missions', 'coeurs', 'cartes', 'playlist', 'quiz', 'pronos']) {
    assert.equal((await request(app).put('/api/admin/animations/ouvert').set('Cookie', a).send({ nom, ouvert: true })).status, 200);
  }
  assert.match((await agent.get('/')).text, /<a href="\/escales">Escales<\/a>/);
  assert.match((await agent.get('/quiz')).text, /Connaissez-vous les mariés/);
  // Missions : photo envoyée avec une mission → tampon au passeport de ce téléphone seulement
  const m = (await agent.get('/api/escales')).body.missions;
  assert.ok(m.length >= 5);
  await agent.post('/api/photos').set('Content-Type', 'image/jpeg').set('X-Auteur', 'Léa').set('X-Mission', encodeURIComponent(m[0])).send(JPEG);
  await agent.post('/api/photos').set('Content-Type', 'image/jpeg').set('X-Mission', encodeURIComponent('Mission inventée')).send(JPEG);
  let pp = (await agent.get('/api/missions/passeport')).body.missions;
  assert.equal(pp.filter((x) => x.faite).length, 1);
  assert.equal((await autre.get('/api/missions/passeport')).body.missions.filter((x) => x.faite).length, 0);
  const photos = (await agent.get('/api/photos')).body.photos;
  assert.deepEqual(photos.map((p) => p.mission).sort(), ['', m[0]].sort());
  // Cœurs : un par téléphone, re-toucher retire
  const pid = photos[0].id;
  assert.equal((await agent.post(`/api/photos/${pid}/coeur`)).body.coeurs, 1);
  assert.equal((await autre.post(`/api/photos/${pid}/coeur`)).body.coeurs, 2);
  assert.equal((await agent.post(`/api/photos/${pid}/coeur`)).body.coeurs, 1);
  assert.equal((await autre.get('/api/photos')).body.photos.find((p) => p.id === pid).aime, true);
  // Cartes postales
  assert.equal((await agent.post('/api/cartes').send({ auteur: '', message: 'x' })).status, 400);
  await agent.post('/api/cartes').send({ auteur: 'Léa <b>', message: 'Tous nos vœux\nde bonheur', timbre: 'Corse' });
  const cartes = (await autre.get('/api/cartes')).body.cartes;
  assert.equal(cartes.length, 1); assert.equal(cartes[0].timbre, 'Corse'); assert.equal(cartes[0].auteur, 'Léa b');
  // Playlist : doublon fusionné, votes
  await agent.post('/api/playlist').send({ titre: 'Laisse parler les gens', artiste: 'Dry', auteur: 'Léa' });
  let pl = (await autre.post('/api/playlist').send({ titre: 'laisse parler les gens !', artiste: 'DRY' })).body;
  assert.equal(pl.nouveau, false); assert.equal(pl.titres.length, 1); assert.equal(pl.titres[0].votes, 2);
  pl = (await autre.post(`/api/playlist/${pl.titres[0].id}/vote`)).body;
  assert.equal(pl.titres[0].votes, 1);
  // Quiz : questions sans la bonne réponse, une seule tentative, score correct
  const q = (await agent.get('/api/quiz')).body;
  assert.equal(q.deja, false);
  const textes = (await request(app).get('/api/admin/animations').set('Cookie', a)).body.textes;
  const bonnes = Object.fromEntries(textes.quiz.split('\n').map((l) => l.split('|').map((x) => x.trim())).map((p) => [p[0], p[1]]));
  const reponses = Object.fromEntries(q.questions.map((x, i) => [x.id, i === 0 ? 'faux' : bonnes[x.question]]));
  const r = (await agent.post('/api/quiz').send({ auteur: 'Léa', reponses })).body;
  assert.equal(r.score, q.questions.length - 1);
  assert.equal((await agent.post('/api/quiz').send({ auteur: 'Léa', reponses })).status, 409);
  assert.equal((await agent.get('/api/quiz')).body.deja, true);
  // Pronostics : vote modifiable, puis révélation
  const pr = (await agent.get('/api/pronos')).body;
  await agent.post('/api/pronos').send({ question: pr.questions[0].id, choix: pr.questions[0].choix[0] });
  await agent.post('/api/pronos').send({ question: pr.questions[0].id, choix: pr.questions[0].choix[1] });
  await autre.post('/api/pronos').send({ question: pr.questions[0].id, choix: pr.questions[0].choix[1] });
  assert.equal((await agent.post('/api/pronos').send({ question: pr.questions[0].id, choix: 'Nimporte' })).status, 400);
  assert.equal((await agent.get('/api/pronos')).body.resultats, null);
  await request(app).put('/api/admin/pronos-revele').set('Cookie', a).send({ revele: true });
  const rev = (await autre.get('/api/pronos')).body;
  assert.deepEqual(rev.resultats[pr.questions[0].id], { [pr.questions[0].choix[1]]: 2 });
  assert.equal((await agent.post('/api/pronos').send({ question: pr.questions[0].id, choix: pr.questions[0].choix[0] })).status, 409);
  // Admin : textes vérifiés, exports
  assert.equal((await request(app).put('/api/admin/animations/textes').set('Cookie', a).send({ quiz: 'Question sans réponses' })).status, 400);
  assert.equal((await request(app).put('/api/admin/animations/textes').set('Cookie', a).send({ missions: 'Danser 💃\nChanter 🎤' })).status, 200);
  assert.deepEqual((await agent.get('/api/escales')).body.missions, ['Danser 💃', 'Chanter 🎤']);
  const ad = (await request(app).get('/api/admin/animations').set('Cookie', a)).body;
  assert.equal(ad.topPhotos[0].coeurs, 1); assert.equal(ad.quiz.joueurs.length, 1); assert.equal(ad.cartes.length, 1);
  assert.match((await request(app).get('/api/admin/playlist.csv').set('Cookie', a)).text, /Laisse parler les gens;Dry;Léa/);
  assert.equal((await agent.get('/api/admin/animations')).status, 401);
});

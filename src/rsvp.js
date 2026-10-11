'use strict';

class RsvpError extends Error {
  constructor(message) { super(message); this.code = 'BAD_INPUT'; }
}

const PRESENCES = ['Oui', 'Peut-être', 'Non'];
const MOMENTS = ['Mairie', 'Cérémonie & cocktail', 'Dîner', 'Brunch'];
const HEBERGEMENTS = ['Logé sur place', 'Par ses propres moyens'];
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_TEL = /^\+?[0-9 .\-()]{8,20}$/;

function txt(v, max, { required = false, label = 'Champ' } = {}) {
  const s = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (required && !s) throw new RsvpError(`${label} manquant.`);
  if (s.length > max) throw new RsvpError(`${label} trop long.`);
  return s;
}
function long(v, max, label) {
  const s = String(v ?? '').trim();
  if (s.length > max) throw new RsvpError(`${label} trop long.`);
  return s;
}

// Vérifie et nettoie une réponse envoyée par le formulaire
function cleanRsvp(b) {
  if (!b || typeof b !== 'object') throw new RsvpError('Réponse vide.');
  const r = {
    prenom: txt(b.prenom, 60, { required: true, label: 'Prénom' }),
    nom: txt(b.nom, 80, { required: true, label: 'Nom' }),
    email: txt(b.email, 120, { required: true, label: 'Email' }).toLowerCase(),
    telephone: txt(b.telephone, 25, { required: true, label: 'Téléphone' }),
    presence: String(b.presence || ''),
  };
  if (!RE_EMAIL.test(r.email)) throw new RsvpError('Email invalide.');
  if (!RE_TEL.test(r.telephone)) throw new RsvpError('Téléphone invalide.');
  if (!PRESENCES.includes(r.presence)) throw new RsvpError('Présence invalide.');

  const vient = r.presence !== 'Non';
  const moments = vient ? String(b.moments || '').split(',').map((s) => s.trim()).filter((m) => MOMENTS.includes(m)) : [];
  r.moments = moments.join(', ');
  r.hebergement = vient ? String(b.hebergement || '') : '';
  if (vient && !HEBERGEMENTS.includes(r.hebergement)) throw new RsvpError('Choix d\'hébergement manquant.');
  r.accompagnant = vient ? txt(b.accompagnant, 120, { label: 'Accompagnant' }) : '';

  const enfants = vient && Array.isArray(b.enfants) ? b.enfants : [];
  if (enfants.length > 10) throw new RsvpError('Trop d\'enfants déclarés.');
  r.enfants = enfants.map((k) => {
    const age = Number(k && k.age);
    if (!Number.isInteger(age) || age < 0 || age > 17) throw new RsvpError('Âge d\'enfant invalide.');
    return {
      prenom: txt(k.prenom, 60, { required: true, label: 'Prénom de l\'enfant' }),
      nom: txt(k.nom, 80, { required: true, label: 'Nom de l\'enfant' }),
      age,
    };
  });
  r.allergies = vient ? long(b.allergies, 1000, 'Allergies') : '';
  r.message = long(b.message, 2000, 'Message');
  r.nb_personnes = vient ? 1 + (r.accompagnant ? 1 : 0) + r.enfants.length : 0;
  r.cle = `${r.email}|${r.prenom.toLowerCase()}`;
  return r;
}

module.exports = { cleanRsvp, RsvpError, MOMENTS };

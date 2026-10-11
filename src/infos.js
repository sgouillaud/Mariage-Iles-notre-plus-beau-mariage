'use strict';
const { RsvpError } = require('./rsvp');

const txt = (v, max) => String(v ?? '').trim().slice(0, max);
function url(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (!/^https:\/\/[^\s"'<>]+$/.test(s) || s.length > 500) throw new RsvpError(`Lien invalide (il doit commencer par https://) : ${s.slice(0, 60)}`);
  return s;
}

// Vérifie et nettoie la liste des infos pratiques envoyée par /admin
function cleanInfos(list) {
  if (!Array.isArray(list) || list.length > 30) throw new RsvpError('Liste d\'infos invalide.');
  return list.map((i) => {
    const titre = txt(i.titre, 80);
    if (!titre) throw new RsvpError('Chaque info doit avoir un titre.');
    const out = { icone: txt(i.icone, 8) || '✦', titre, texte: txt(i.texte, 1500), bientot: !!i.bientot };
    if (Array.isArray(i.trajets) && i.trajets.length) {
      if (i.trajets.length > 20) throw new RsvpError('Trop de trajets dans une info.');
      out.trajets = i.trajets.map((t) => {
        const depuis = txt(t.depuis, 60);
        if (!depuis) throw new RsvpError(`Chaque trajet de « ${titre} » doit avoir une ville de départ.`);
        const lien = url(t.lien);
        return { depuis, resume: txt(t.resume, 60), details: txt(t.details, 2000), lien, lienTexte: lien ? (txt(t.lienTexte, 80) || 'Voir le détail') : '' };
      });
    }
    if (Array.isArray(i.couleurs) && i.couleurs.length) {
      if (i.couleurs.length > 12) throw new RsvpError('Trop de couleurs dans une info.');
      out.couleurs = i.couleurs.map((c) => {
        const hex = String(c.hex ?? '').trim().toUpperCase();
        if (!/^#[0-9A-F]{6}$/.test(hex)) throw new RsvpError(`Couleur invalide (format #RRVVBB) : ${hex || 'vide'}`);
        return { nom: txt(c.nom, 30), hex };
      });
    }
    const lienUrl = url(i.lien && i.lien.url);
    if (lienUrl) out.lien = { texte: txt(i.lien.texte, 80) || 'En savoir plus', url: lienUrl };
    return out;
  });
}

module.exports = { cleanInfos };

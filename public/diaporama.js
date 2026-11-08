// Diaporama ILESstagram en direct : chaque photo s'affiche comme une publication (cœurs, commentaires, mission).
// Les nouvelles photos passent en priorité ; sinon on fait défiler tout l'album.
(function () {
  const DUREE = 8000, SONDAGE = 6000;
  const $ = (s) => document.querySelector(s);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COULEURS = ['#C0643E', '#1F5C5B', '#9E4E2E', '#3F7F7A', '#B9814F', '#6B5E55'];
  const couleur = (n) => COULEURS[[...String(n || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % COULEURS.length];
  // Petits messages ({n} = prénom de l'invité)
  const AVEC = [
    'Photo prise avec ❤️ par {n}', 'Un souvenir signé {n} ✨', 'Escale immortalisée par {n} 🌴',
    'Vu à travers les yeux de {n} 👀', '{n} a saisi l’instant 📸', 'Clic ! Merci {n} 🥂',
    'Carte postale de {n} 💌', 'Dans l’objectif de {n} 🌺', '{n} était là, et voilà la preuve 😄', 'Un instant volé par {n} 🕊️',
  ];
  const SANS = ['Un souvenir anonyme, mais plein d’amour ❤️', 'Mystère… mais quelle belle photo ✨', 'Une escale de plus dans notre plus beau voyage 🌴', 'Merci au photographe inconnu 📸'];
  let tour = Math.floor(Math.random() * AVEC.length);
  function message(p) {
    tour++;
    if (!p.auteur) return esc(SANS[tour % SANS.length]);
    return esc(AVEC[tour % AVEC.length]).replace('{n}', `<b>${esc(p.auteur)}</b>`);
  }

  let photos = [], vues = new Set(), nouvelles = [], index = 0, premier = true, minuteur = null;
  async function sonder() {
    try {
      const r = await fetch('/api/photos', { cache: 'no-store' });
      if (!r.ok) return;
      const liste = (await r.json()).photos;
      const ids = new Set(liste.map((p) => p.id));
      for (const p of liste) if (!vues.has(p.id)) { vues.add(p.id); if (!premier) nouvelles.push(p); }
      nouvelles = nouvelles.filter((p) => ids.has(p.id));
      photos = liste.slice().reverse();
      premier = false;
      $('#attente').classList.toggle('cache', photos.length > 0);
      $('#scene').hidden = photos.length === 0;
      $('#compteur').textContent = photos.length ? `${photos.length} publication${photos.length > 1 ? 's' : ''} ce soir` : '';
      if (photos.length && !minuteur) suivante();
    } catch (e) { /* réseau coupé : on réessaie */ }
  }
  const precharger = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(true); i.onerror = () => ok(false); i.src = src; });
  async function commentaires(p) {
    if (!p.commentaires) return [];
    try { const r = await fetch(`/api/photos/${p.id}/commentaires`, { cache: 'no-store' }); return r.ok ? (await r.json()).commentaires.slice(-2) : []; } catch (e) { return []; }
  }
  async function suivante() {
    clearTimeout(minuteur);
    if (!photos.length) { minuteur = null; return; }
    let p, nouvelle = false;
    if (nouvelles.length) { p = nouvelles.shift(); nouvelle = true; } else { index %= photos.length; p = photos[index++]; }
    // Données à jour (cœurs, commentaires) depuis le dernier sondage
    p = photos.find((x) => x.id === p.id) || p;
    const [ok, coms] = await Promise.all([precharger(p.url), commentaires(p)]);
    if (ok) afficher(p, nouvelle, coms);
    minuteur = setTimeout(suivante, ok ? DUREE : 500);
  }
  function afficher(p, nouvelle, coms) {
    const nom = p.auteur || 'Un invité';
    const v = document.createElement('article');
    v.className = 'di-post';
    v.innerHTML = `<header><span class="ig-avatar">${esc((nom.trim()[0] || '📷').toUpperCase())}</span>
        <div><b>${esc(nom)}</b><span>${p.mission ? '🎯 Mission : ' + esc(p.mission) : 'Prieuré d’Yron · Il.e.s'}</span></div>
        ${nouvelle ? '<span class="di-nouveau">Nouvelle publication</span>' : ''}</header>
      <div class="di-photo"><img src="${p.url}" alt=""></div>
      <div class="di-bas">
        <div class="di-stats"><span class="c">❤ ${p.coeurs || 0}</span><span>💬 ${p.commentaires || 0}</span><span>#ILESstagram</span></div>
        <p class="di-legende">${message(p)}</p>
        <div class="di-coms">${coms.map((c) => `<p><b>${esc(c.auteur)}</b> ${esc(c.texte)}</p>`).join('')}</div>
      </div>`;
    v.querySelector('.ig-avatar').style.background = couleur(nom);
    const place = $('#emplacement');
    const anciens = [...place.children];
    anciens.forEach((a) => a.classList.remove('on'));
    setTimeout(() => anciens.forEach((a) => a.remove()), 500);
    setTimeout(() => {
      place.appendChild(v);
      requestAnimationFrame(() => requestAnimationFrame(() => v.classList.add('on')));
      $('#fond').style.backgroundImage = `url("${p.url}")`;
    }, anciens.length ? 520 : 0);
  }

  // Curseur et bouton plein écran visibles seulement quand on bouge la souris
  let cache;
  document.addEventListener('mousemove', () => {
    document.body.classList.add('souris');
    clearTimeout(cache); cache = setTimeout(() => document.body.classList.remove('souris'), 2500);
  });
  $('#plein').addEventListener('click', () => {
    const el = document.documentElement;
    (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
  });
  async function eveil() { try { if (navigator.wakeLock) await navigator.wakeLock.request('screen'); } catch (e) { /* ignore */ } }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') eveil(); });
  eveil();
  sonder();
  setInterval(sonder, SONDAGE);
})();

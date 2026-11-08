// Diaporama en direct : les nouvelles photos passent en priorité, sinon on fait défiler toutes les photos
(function () {
  const DUREE = 7000, SONDAGE = 6000;
  const scene = document.getElementById('scene');
  const attente = document.getElementById('attente');
  const legTxt = document.getElementById('leg-txt');
  // Petits messages sous chaque photo ({n} = prénom de l'invité)
  const AVEC = [
    'Photo prise avec ❤️ par {n}',
    'Un souvenir signé {n} ✨',
    'Escale immortalisée par {n} 🌴',
    'Vu à travers les yeux de {n} 👀',
    '{n} a saisi l’instant 📸',
    'Clic ! Merci {n} 🥂',
    'Carte postale de {n} 💌',
    'Dans l’objectif de {n} 🌺',
    '{n} était là, et voilà la preuve 😄',
    'Un instant volé par {n} 🕊️',
  ];
  const SANS = [
    'Un souvenir anonyme, mais plein d’amour ❤️',
    'Mystère… mais quelle belle photo ✨',
    'Une escale de plus dans notre plus beau voyage 🌴',
    'Merci au photographe inconnu 📸',
  ];
  let tour = Math.floor(Math.random() * AVEC.length);
  const esc = (t) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
      for (const p of liste) {
        if (!vues.has(p.id)) { vues.add(p.id); if (!premier) nouvelles.push(p); }
      }
      nouvelles = nouvelles.filter((p) => ids.has(p.id)); // photo retirée par les mariés
      photos = liste.slice().reverse(); // de la plus ancienne à la plus récente
      premier = false;
      attente.classList.toggle('cache', photos.length > 0);
      if (photos.length && !minuteur) suivante();
    } catch (e) { /* réseau coupé : on réessaie */ }
  }

  function precharger(src) {
    return new Promise((ok) => { const i = new Image(); i.onload = () => ok(true); i.onerror = () => ok(false); i.src = src; });
  }

  async function suivante() {
    clearTimeout(minuteur);
    if (!photos.length) { minuteur = null; return; }
    let p, nouvelle = false;
    if (nouvelles.length) { p = nouvelles.shift(); nouvelle = true; }
    else { index = index % photos.length; p = photos[index++]; }
    const ok = await precharger(p.url);
    if (ok) afficher(p, nouvelle);
    minuteur = setTimeout(suivante, ok ? DUREE : 500);
  }

  function afficher(p, nouvelle) {
    const v = document.createElement('div');
    v.className = 'vue' + (nouvelle ? ' nouvelle' : '');
    const fond = document.createElement('div'); fond.className = 'fond';
    fond.style.backgroundImage = `url("${p.url}")`;
    const img = document.createElement('img'); img.src = p.url; img.alt = '';
    v.append(fond, img);
    scene.appendChild(v);
    requestAnimationFrame(() => requestAnimationFrame(() => v.classList.add('on')));
    const anciennes = [...scene.children].slice(0, -1);
    setTimeout(() => anciennes.forEach((a) => a.remove()), 1400);
    legTxt.classList.remove('on');
    setTimeout(() => {
      legTxt.innerHTML = message(p) + (p.mission ? `<span class="leg-mission">🎯 Mission : ${esc(p.mission)}</span>` : '');
      requestAnimationFrame(() => legTxt.classList.add('on'));
    }, 350);
  }

  // Curseur et bouton plein écran visibles seulement quand on bouge la souris
  let cache;
  document.addEventListener('mousemove', () => {
    document.body.classList.add('souris');
    clearTimeout(cache); cache = setTimeout(() => document.body.classList.remove('souris'), 2500);
  });
  document.getElementById('plein').addEventListener('click', () => {
    const el = document.documentElement;
    (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
  });
  // Empêche l'écran de se mettre en veille pendant la soirée
  async function eveil() { try { if (navigator.wakeLock) await navigator.wakeLock.request('screen'); } catch (e) { /* ignore */ } }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') eveil(); });
  eveil();

  sonder();
  setInterval(sonder, SONDAGE);
})();

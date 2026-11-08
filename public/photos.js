// ILESstagram : envoi des photos (compressées sur le téléphone), fil façon réseau social,
// cœurs, commentaires, missions d'escale avec passeport, partage en story.
(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MAX = 2048, QUALITE = 0.85;
  const COULEURS = ['#C0643E', '#1F5C5B', '#9E4E2E', '#3F7F7A', '#B9814F', '#6B5E55'];
  const couleur = (n) => COULEURS[[...String(n || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % COULEURS.length];
  const initiale = (n) => (String(n || '').trim()[0] || '📷').toUpperCase();
  const avatar = (n, cls) => `<span class="ig-avatar${cls ? ' ' + cls : ''}" data-c="${couleur(n)}">${esc(initiale(n))}</span>`;
  const peindreAvatars = (root) => root.querySelectorAll('.ig-avatar[data-c]').forEach((a) => { a.style.background = a.dataset.c; });

  let minuteur;
  function toast(msg, err) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'toast on' + (err ? ' err' : '');
    clearTimeout(minuteur); minuteur = setTimeout(() => { t.className = 'toast'; }, 3000);
  }

  // ---------- Prénom ----------
  const auteur = $('#auteur');
  const majMoi = () => { const m = $('#moi'); m.textContent = initiale(auteur.value); m.style.background = auteur.value ? couleur(auteur.value) : ''; };
  try { auteur.value = localStorage.getItem('photos-auteur') || ''; } catch (e) { /* ignore */ }
  majMoi();
  auteur.addEventListener('input', majMoi);
  auteur.addEventListener('change', () => { try { localStorage.setItem('photos-auteur', auteur.value.trim()); } catch (e) { /* ignore */ } });
  const prenom = () => auteur.value.trim();

  // ---------- Compression et envoi ----------
  function charger(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file)).catch(() => parImage(file));
    }
    return parImage(file);
  }
  function parImage(file) {
    return new Promise((ok, ko) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { ok(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
      img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('illisible')); };
      img.src = url;
    });
  }
  async function compresser(file) {
    try {
      const img = await charger(file);
      const w = img.width, h = img.height, k = Math.min(1, MAX / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      if (img.close) img.close();
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', QUALITE));
      if (blob) return blob;
    } catch (e) { /* on tente l'original */ }
    if (/^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= 12 * 1024 * 1024) return file;
    throw new Error('format');
  }
  async function envoyer(blob) {
    const r = await fetch('/api/photos', {
      method: 'POST', body: blob,
      headers: { 'Content-Type': blob.type || 'image/jpeg', 'X-Auteur': encodeURIComponent(prenom()), 'X-Mission': encodeURIComponent(mission) },
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.message || 'Envoi impossible'); }
  }

  $('#fichiers').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    try { localStorage.setItem('photos-auteur', prenom()); } catch (er) { /* ignore */ }
    const file = $('#file');
    file.innerHTML = '';
    const bilan = document.createElement('p'); bilan.className = 'bilan';
    const cases = files.map((f) => {
      const d = document.createElement('div'); d.className = 'vignette';
      const im = document.createElement('img'); im.alt = '';
      try { im.src = URL.createObjectURL(f); } catch (er) { /* ignore */ }
      const i = document.createElement('i'); i.textContent = '…';
      d.append(im, i); file.appendChild(d);
      return { f, d, i };
    });
    file.appendChild(bilan);
    let ok = 0, ko = 0, dernierMsg = '';
    for (const c of cases) {
      c.d.classList.add('cours'); c.i.textContent = '↑';
      bilan.textContent = `Publication ${ok + ko + 1} sur ${cases.length}…`;
      try { await envoyer(await compresser(c.f)); ok++; c.d.className = 'vignette ok'; c.i.textContent = '✓'; }
      catch (er) { ko++; c.d.className = 'vignette err'; c.i.textContent = '!'; dernierMsg = er.message === 'format' ? 'format de photo non pris en charge' : er.message; }
    }
    bilan.className = 'bilan' + (ko ? ' err' : '');
    bilan.textContent = ko ? `${ok} publiée${ok > 1 ? 's' : ''}, ${ko} en échec (${dernierMsg}).`
      : `Publié ! ${ok} photo${ok > 1 ? 's' : ''} sur ILESstagram ✈` + (mission ? ' · tampon ajouté au passeport 🛂' : '');
    if (ok && mission) choisirMission('');
    signature = '';
    rafraichir();
    passeport();
  });

  // ---------- Missions (bulles) et passeport ----------
  let mission = '', missionsOn = false, coeursOn = false, commentairesOn = false, faites = new Set();
  const emojiDe = (m) => (m.match(/(\p{Extended_Pictographic}(‍\p{Extended_Pictographic}|️)*)\s*$/u) || [])[1] || '🎯';
  const sansEmoji = (m) => m.replace(/\s*(\p{Extended_Pictographic}(‍\p{Extended_Pictographic}|️)*)\s*$/u, '');
  function choisirMission(m) {
    mission = m;
    document.querySelectorAll('.ig-bulle[data-m]').forEach((b) => b.classList.toggle('on', b.dataset.m === m && m !== ''));
    const p = $('#mission-choisie');
    p.hidden = !m;
    p.innerHTML = m ? `🎯 Mission : <b>${esc(m)}</b> <button type="button" aria-label="Retirer la mission">✕</button>` : '';
  }
  $('#mission-choisie').addEventListener('click', (e) => { if (e.target.closest('button')) choisirMission(''); });
  async function passeport() {
    if (!missionsOn) return;
    try {
      const r = await fetch('/api/missions/passeport', { cache: 'no-store' });
      if (!r.ok) return;
      const { missions } = await r.json();
      faites = new Set(missions.filter((m) => m.faite).map((m) => m.mission));
      $('#tampons').innerHTML = missions.map((m) => `<div class="tamp${m.faite ? ' fait' : ''}">${esc(m.mission)}</div>`).join('');
      $('#pp-compte').textContent = faites.size === missions.length ? `Passeport complet : ${faites.size} / ${missions.length} 🏆 Bravo, grand voyageur !` : `${faites.size} / ${missions.length} missions accomplies`;
      const pp = $('.ig-bulle.pp small'); if (pp) pp.textContent = `${faites.size}/${missions.length}`;
      document.querySelectorAll('.ig-bulle[data-m]').forEach((b) => b.classList.toggle('fait', faites.has(b.dataset.m)));
    } catch (e) { /* hors ligne */ }
  }
  function bulles(liste) {
    const b = $('#bulles');
    b.hidden = false;
    b.innerHTML = `<button type="button" class="ig-bulle pp" aria-label="Mon passeport"><span>🛂</span><em>Passeport</em><small>…</small></button>` +
      liste.map((m) => `<button type="button" class="ig-bulle" data-m="${esc(m)}" title="${esc(m)}"><span>${emojiDe(m)}</span><em>${esc(sansEmoji(m))}</em></button>`).join('');
    b.addEventListener('click', (e) => {
      const x = e.target.closest('.ig-bulle'); if (!x) return;
      if (x.classList.contains('pp')) { const p = $('#passeport'); p.hidden = !p.hidden; return; }
      choisirMission(mission === x.dataset.m ? '' : x.dataset.m);
      if (mission) { toast('Mission choisie : publie ta photo ! 📸'); $('#envoi').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
    if (location.hash === '#missions') b.scrollIntoView({ block: 'center' });
  }

  // ---------- Fil et grille ----------
  let album = [], signature = '', grille = false;
  const ouverts = new Set(); // posts dont les commentaires sont dépliés
  const ICONES = {
    coeur: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.6 4.5 7.2 4.5c2 0 3.4 1.1 4.8 2.9 1.4-1.8 2.8-2.9 4.8-2.9 3.6 0 5.7 3.5 4.5 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>',
    bulle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5A8.5 8.5 0 1 1 21 11.5z"/></svg>',
    partage: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7 8m5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
    garder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>',
  };
  const quand = (le) => {
    const d = new Date(String(le).replace(' ', 'T') + 'Z');
    const s = (Date.now() - d) / 1000;
    if (!isFinite(s)) return '';
    if (s < 60) return 'À l’instant';
    if (s < 3600) return `Il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `Il y a ${Math.floor(s / 3600)} h`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  };
  function post(p) {
    const nom = p.auteur || 'Un invité';
    return `<article class="ig-post" id="post-${p.id}" data-id="${p.id}">
      <header>${avatar(nom)}<div><b>${esc(nom)}</b><span>${p.mission ? '🎯 ' + esc(p.mission) : 'Prieuré d’Yron · Il.e.s'}</span></div></header>
      <div class="ig-photo"><img src="${p.url}" alt="Photo de ${esc(nom)}" loading="lazy"><span class="ig-pop" aria-hidden="true">❤</span></div>
      <div class="ig-actions">
        ${coeursOn ? `<button type="button" class="ig-act coeur${p.aime ? ' on' : ''}" data-act="coeur" aria-pressed="${p.aime}" aria-label="J’aime">${ICONES.coeur}</button>` : ''}
        ${commentairesOn ? `<button type="button" class="ig-act" data-act="commenter" aria-label="Commenter">${ICONES.bulle}</button>` : ''}
        <button type="button" class="ig-act" data-act="partager" aria-label="Partager (Instagram, WhatsApp…)">${ICONES.partage}</button>
        <button type="button" class="ig-act droite" data-act="garder" aria-label="Enregistrer la photo">${ICONES.garder}</button>
      </div>
      ${coeursOn ? `<p class="ig-likes">${p.coeurs ? `<b>${p.coeurs}</b> j’aime` : 'Sois le premier à aimer ❤'}</p>` : ''}
      <p class="ig-legende"><b>${esc(nom)}</b> ${p.mission ? `Mission accomplie : ${esc(p.mission)}` : 'Une escale de plus dans notre plus beau voyage ✈'} <span class="ig-tag">#ILESstagram</span></p>
      ${commentairesOn ? `<div class="ig-coms" data-n="${p.commentaires}">
        ${p.commentaires ? `<button type="button" class="ig-voir" data-act="voir">${ouverts.has(p.id) ? 'Masquer les commentaires' : `Voir ${p.commentaires > 1 ? `les ${p.commentaires} commentaires` : 'le commentaire'}`}</button>` : ''}
        <div class="ig-liste"></div>
        <form class="ig-ajout" data-act="ajout"><input maxlength="300" placeholder="Ajouter un commentaire…" aria-label="Ajouter un commentaire"><button type="submit">Publier</button></form>
      </div>` : ''}
      <p class="ig-quand">${quand(p.le)}</p>
    </article>`;
  }
  function afficher() {
    $('#vide').hidden = album.length > 0;
    $('#tout').hidden = album.length === 0;
    $('#compte').textContent = album.length ? `${album.length} publication${album.length > 1 ? 's' : ''}` : '';
    $('#fil').hidden = grille; $('#grille').hidden = !grille;
    $('#fil').innerHTML = album.map(post).join('');
    peindreAvatars($('#fil'));
    $('#grille').innerHTML = album.map((p) => `<button type="button" data-id="${p.id}" aria-label="Voir la photo"><img src="${p.url}" alt="" loading="lazy">${coeursOn && p.coeurs ? `<span class="ph-coeur">❤ ${p.coeurs}</span>` : ''}</button>`).join('');
    ouverts.forEach((id) => chargerComs(id));
  }
  async function rafraichir() {
    // On ne redessine pas pendant qu'un invité écrit un commentaire
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('.ig-ajout')) return;
    try {
      const r = await fetch('/api/photos', { cache: 'no-store' });
      if (!r.ok) return;
      const { photos } = await r.json();
      const sig = photos.map((p) => `${p.id}:${p.coeurs}:${p.aime}:${p.commentaires}`).join(',');
      album = photos;
      if (sig === signature) return;
      signature = sig;
      afficher();
    } catch (e) { /* hors ligne */ }
  }
  $('#vue').addEventListener('click', () => {
    grille = !grille;
    $('#vue').setAttribute('aria-label', grille ? 'Afficher le fil' : 'Afficher en grille');
    $('#vue').classList.toggle('on', grille);
    afficher();
  });
  $('#grille').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    grille = false; $('#vue').classList.remove('on'); afficher();
    const el = document.getElementById('post-' + b.dataset.id);
    if (el) el.scrollIntoView({ block: 'start' });
  });

  // ---------- Interactions ----------
  const trouver = (id) => album.find((p) => p.id === Number(id));
  async function coeur(id, forcer) {
    const p = trouver(id); if (!p || (forcer && p.aime)) return;
    try {
      const r = await fetch(`/api/photos/${id}/coeur`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      p.coeurs = d.coeurs; p.aime = d.aime; signature = ''; afficher();
    } catch (e) { toast(e.message || 'Oups', true); }
  }
  async function chargerComs(id) {
    const art = document.getElementById('post-' + id); if (!art) return;
    try {
      const r = await fetch(`/api/photos/${id}/commentaires`, { cache: 'no-store' });
      if (!r.ok) return;
      const { commentaires } = await r.json();
      const l = art.querySelector('.ig-liste');
      if (l) l.innerHTML = commentaires.map((c) => `<p><b>${esc(c.auteur)}</b> ${esc(c.texte)}</p>`).join('');
    } catch (e) { /* ignore */ }
  }
  // Image « story » aux couleurs du mariage, pour la republier sur Instagram (ou WhatsApp)
  async function imageStory(p) {
    const W = 1080, H = 1920, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const charge = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
    try { await document.fonts.load('600 80px Fraunces'); await document.fonts.load('italic 600 80px Fraunces'); await document.fonts.load('500 40px Jost'); } catch (e) { /* ignore */ }
    const [photo, logo] = await Promise.all([charge(p.url), charge('/logo.webp')]);
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#F5EDE0'); g.addColorStop(1, '#EAD9C0');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // En-tête : logo + ILESstagram
    x.save(); x.beginPath(); x.arc(150, 170, 70, 0, Math.PI * 2); x.clip(); x.drawImage(logo, 80, 100, 140, 140); x.restore();
    x.textBaseline = 'middle';
    x.font = 'italic 600 84px Fraunces, Georgia, serif';
    x.fillStyle = '#C0643E'; x.fillText('ILES', 250, 172);
    const wI = x.measureText('ILES').width;
    x.fillStyle = '#1F5C5B'; x.fillText('stagram', 250 + wI, 172);
    // Photo façon tirage
    const maxW = 900, maxH = 1180, k = Math.min(maxW / photo.width, maxH / photo.height);
    const pw = photo.width * k, ph = photo.height * k, px = (W - pw) / 2, py = 320 + (maxH - ph) / 2;
    x.save(); x.shadowColor = 'rgba(43,36,32,.28)'; x.shadowBlur = 50; x.shadowOffsetY = 18;
    x.fillStyle = '#FFFFFF'; x.fillRect(px - 24, py - 24, pw + 48, ph + 48); x.restore();
    x.drawImage(photo, px, py, pw, ph);
    // Légende
    x.textAlign = 'center';
    x.font = 'italic 600 58px Fraunces, Georgia, serif'; x.fillStyle = '#1F5C5B';
    x.fillText(`Photo prise avec ❤️ par ${p.auteur || 'un invité'}`, W / 2, 1600, 980);
    if (p.mission) { x.font = '500 40px Jost, sans-serif'; x.fillStyle = '#C0643E'; x.fillText(`🎯 Mission : ${p.mission}`, W / 2, 1680, 980); }
    x.font = '600 42px Jost, sans-serif'; x.fillStyle = '#C0643E'; x.fillText('#ILESstagram', W / 2, 1780);
    x.font = '500 34px Jost, sans-serif'; x.fillStyle = '#6B5E55'; x.fillText('Cédric & Sébastien · 26.06.2027 · Notre plus beau voyage', W / 2, 1840, 1000);
    return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.92));
  }
  async function partager(p) {
    toast('Préparation de ta story… ✨');
    try {
      const blob = await imageStory(p);
      const f = new File([blob], `ilesstagram-${p.id}.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        await navigator.share({ files: [f], text: '#ILESstagram · Cédric & Sébastien 💍' });
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = f.name;
      document.body.appendChild(a); a.click(); a.remove();
      toast('Image téléchargée : publie-la en story sur Instagram 📲');
    } catch (e) { if (!e || e.name !== 'AbortError') toast('Partage impossible sur ce téléphone', true); }
  }
  async function garder(p) {
    try {
      const blob = await (await fetch(p.url)).blob();
      const f = new File([blob], `photo-mariage-${p.id}.jpg`, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = p.url + '?dl=1'; a.download = '';
    document.body.appendChild(a); a.click(); a.remove();
  }
  $('#fil').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'FORM') return;
    const art = b.closest('.ig-post'), id = Number(art.dataset.id), p = trouver(id);
    const act = b.dataset.act;
    if (act === 'coeur') coeur(id);
    if (act === 'commenter') { const i = art.querySelector('.ig-ajout input'); if (i) i.focus(); }
    if (act === 'partager') partager(p);
    if (act === 'garder') garder(p);
    if (act === 'voir') {
      if (ouverts.has(id)) { ouverts.delete(id); art.querySelector('.ig-liste').innerHTML = ''; b.textContent = 'Voir les commentaires'; }
      else { ouverts.add(id); chargerComs(id); b.textContent = 'Masquer les commentaires'; }
    }
  });
  // Double toucher sur la photo = j'aime
  let dernierToucher = 0;
  $('#fil').addEventListener('click', (e) => {
    const ph = e.target.closest('.ig-photo'); if (!ph || !coeursOn) return;
    const t = Date.now();
    if (t - dernierToucher < 350) {
      const pop = ph.querySelector('.ig-pop'); pop.classList.remove('go'); void pop.offsetWidth; pop.classList.add('go');
      coeur(ph.closest('.ig-post').dataset.id, true);
    }
    dernierToucher = t;
  });
  $('#fil').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.closest('.ig-ajout'); if (!f) return;
    const art = f.closest('.ig-post'), id = Number(art.dataset.id), input = f.querySelector('input');
    if (!input.value.trim()) return;
    if (!prenom()) { toast('Indique ton prénom en haut de la page 🙂', true); auteur.focus(); return; }
    try {
      const r = await fetch(`/api/photos/${id}/commentaires`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auteur: prenom(), texte: input.value }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      input.value = ''; input.blur();
      ouverts.add(id);
      const p = trouver(id); if (p) p.commentaires = d.commentaires.length;
      signature = ''; afficher();
    } catch (er) { toast(er.message || 'Oups', true); }
  });

  // ---------- Démarrage ----------
  async function demarrer() {
    try {
      const r = await fetch('/api/escales', { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        coeursOn = d.ouverts.coeurs || d.admin;
        commentairesOn = d.ouverts.commentaires || d.admin;
        missionsOn = (d.ouverts.missions || d.admin) && d.missions.length > 0;
        if (missionsOn) { bulles(d.missions); passeport(); }
      }
    } catch (e) { /* ignore */ }
    rafraichir();
  }
  demarrer();
  setInterval(rafraichir, 20000);
})();

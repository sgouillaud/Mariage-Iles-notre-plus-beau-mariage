// Envoi des photos par les invités : compression sur le téléphone, puis envoi une par une
(function () {
  const $ = (s) => document.querySelector(s);
  const MAX = 2048, QUALITE = 0.85;
  const auteur = $('#auteur');
  try { auteur.value = localStorage.getItem('photos-auteur') || ''; } catch (e) { /* ignore */ }
  auteur.addEventListener('change', () => { try { localStorage.setItem('photos-auteur', auteur.value.trim()); } catch (e) { /* ignore */ } });

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
      headers: { 'Content-Type': blob.type || 'image/jpeg', 'X-Auteur': encodeURIComponent(auteur.value.trim()) },
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.message || 'Envoi impossible');
    }
  }

  $('#fichiers').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    try { localStorage.setItem('photos-auteur', auteur.value.trim()); } catch (er) { /* ignore */ }
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
      bilan.textContent = `Envoi ${ok + ko + 1} sur ${cases.length}…`;
      try {
        await envoyer(await compresser(c.f));
        ok++; c.d.className = 'vignette ok'; c.i.textContent = '✓';
      } catch (er) {
        ko++; c.d.className = 'vignette err'; c.i.textContent = '!';
        dernierMsg = er.message === 'format' ? 'format de photo non pris en charge' : er.message;
      }
    }
    bilan.className = 'bilan' + (ko ? ' err' : '');
    bilan.textContent = ko
      ? `${ok} photo${ok > 1 ? 's' : ''} envoyée${ok > 1 ? 's' : ''}, ${ko} en échec (${dernierMsg}).`
      : `Merci ! ${ok} photo${ok > 1 ? 's' : ''} envoyée${ok > 1 ? 's' : ''} ✈`;
    rafraichir();
  });

  // ---------- Album : toutes les photos, visionneuse et téléchargement ----------
  let album = [], courant = 0, signature = '';
  async function rafraichir() {
    try {
      const r = await fetch('/api/photos');
      if (!r.ok) return;
      const { photos } = await r.json();
      album = photos;
      $('#vide').hidden = photos.length > 0;
      $('#tout').hidden = photos.length === 0;
      $('#compte').textContent = photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''} · touchez une photo pour l’agrandir et l’enregistrer` : '';
      const sig = photos.map((p) => p.id).join(',');
      if (sig === signature) return;
      signature = sig;
      $('#grille').innerHTML = photos
        .map((p, i) => `<button type="button" data-i="${i}" aria-label="Agrandir la photo"><img src="${p.url}" alt="" loading="lazy"></button>`).join('');
    } catch (e) { /* hors ligne */ }
  }
  const v = $('#visionneuse');
  function montrer(i) {
    if (!album.length) return;
    courant = (i + album.length) % album.length;
    const p = album[courant];
    $('#v-img').src = p.url;
    $('#v-auteur').textContent = p.auteur ? `📷 ${p.auteur}` : '';
    v.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function fermer() { v.hidden = true; document.body.style.overflow = ''; }
  $('#grille').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) montrer(Number(b.dataset.i)); });
  v.querySelector('.v-fermer').addEventListener('click', fermer);
  v.querySelector('.v-prec').addEventListener('click', () => montrer(courant - 1));
  v.querySelector('.v-suiv').addEventListener('click', () => montrer(courant + 1));
  document.addEventListener('keydown', (e) => {
    if (v.hidden) return;
    if (e.key === 'Escape') fermer();
    if (e.key === 'ArrowLeft') montrer(courant - 1);
    if (e.key === 'ArrowRight') montrer(courant + 1);
  });
  let x0 = null;
  v.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  v.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) montrer(courant + (dx < 0 ? 1 : -1));
  });
  // Enregistrer : sur téléphone, la feuille de partage propose « Enregistrer l’image » (pellicule) ; sinon, téléchargement
  $('#v-garder').addEventListener('click', async () => {
    const p = album[courant];
    try {
      const blob = await (await fetch(p.url)).blob();
      const fichier = new File([blob], `photo-mariage-${p.id}.${(blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
        await navigator.share({ files: [fichier] });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return; // l'invité a fermé la feuille de partage
    }
    const a = document.createElement('a');
    a.href = p.url + '?dl=1'; a.download = '';
    document.body.appendChild(a); a.click(); a.remove();
  });
  rafraichir();
  setInterval(rafraichir, 20000);
})();

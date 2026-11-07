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

  async function rafraichir() {
    try {
      const r = await fetch('/api/photos');
      if (!r.ok) return;
      const { photos } = await r.json();
      $('#vide').hidden = photos.length > 0;
      $('#grille').innerHTML = photos.slice(0, 30)
        .map((p) => `<figure><img src="${p.url}" alt="" loading="lazy"></figure>`).join('');
    } catch (e) { /* hors ligne */ }
  }
  rafraichir();
  setInterval(rafraichir, 20000);
})();

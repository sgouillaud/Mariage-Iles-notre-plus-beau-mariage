(function () {
  const form = document.getElementById('porte-form');
  const input = document.getElementById('code');
  const btn = document.getElementById('porte-btn');
  const err = document.getElementById('porte-err');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const code = input.value.trim();
    if (!code) { err.textContent = 'Entrez votre code d\'embarquement.'; input.focus(); return; }
    btn.disabled = true; btn.textContent = 'Vérification…';
    try {
      const r = await fetch('/api/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || 'Code refusé.');
      location.replace('/');
    } catch (ex) {
      err.textContent = ex.message === 'Failed to fetch' ? 'Connexion impossible, réessayez.' : ex.message;
      btn.disabled = false; btn.textContent = 'Ouvrir l\'invitation';
    }
  });
})();

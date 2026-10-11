(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BADGE = { Oui: 'b-oui', 'Peut-être': 'b-pe', Non: 'b-non' };

  async function api(url, opts = {}) {
    const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && url !== '/api/admin/login') { montrerLogin(); throw new Error('Connexion requise'); }
    if (!r.ok) throw new Error(d.message || 'Erreur');
    return d;
  }

  // ---------- Connexion ----------
  function montrerLogin() { $('#app').classList.add('cache'); $('#login').classList.remove('cache'); $('#pwd').focus(); }
  function montrerApp() { $('#login').classList.add('cache'); $('#app').classList.remove('cache'); charger(); }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#login-err').textContent = '';
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: $('#pwd').value }) });
      $('#pwd').value = '';
      montrerApp();
    } catch (err) { $('#login-err').textContent = err.message; }
  });
  $('#logout').onclick = async () => { await fetch('/api/admin/logout', { method: 'POST' }); montrerLogin(); };

  // ---------- Onglets ----------
  $$('.onglet').forEach((b) => b.addEventListener('click', () => {
    $$('.onglet').forEach((x) => x.classList.toggle('actif', x === b));
    $$('.tab').forEach((t) => t.classList.toggle('cache', t.id !== 'tab-' + b.dataset.tab));
    if (b.dataset.tab === 'infos') chargerInfos();
    if (b.dataset.tab === 'reponses') charger();
  }));

  // ---------- Réponses ----------
  let donnees = [];
  let filtre = 'tous';

  async function charger() {
    try {
      const d = await api('/api/admin/rsvps');
      donnees = d.rsvps;
      const s = d.stats;
      $('#stats').innerHTML = [
        ['cle', s.personnes, 'personnes confirmées', s.personnesPeutEtre ? `+ ${s.personnesPeutEtre} peut-être` : ''],
        ['', s.reponses, 'réponses reçues', ''],
        ['', s.oui, 'oui', ''],
        ['', s.peutEtre, 'peut-être', ''],
        ['', s.non, 'non', ''],
        ['', s.loges, 'à loger', `${s.enfants} enfant${s.enfants > 1 ? 's' : ''} · ${s.allergies} allergie${s.allergies > 1 ? 's' : ''}`],
      ].map(([c, n, l, x]) => `<div class="stat ${c}"><b>${n}</b><span>${l}</span>${x ? `<small>${x}</small>` : ''}</div>`).join('');
      $('#moments').innerHTML = Object.entries(s.moments)
        .map(([m, n]) => `<span>${esc(m)} : <b>${n}</b></span>`).join('');
      afficher();
    } catch (e) { /* login affiché */ }
  }

  function afficher() {
    const q = $('#recherche').value.trim().toLowerCase();
    const rows = donnees.filter((r) => {
      if (filtre === 'loges' && !(r.presence !== 'Non' && r.hebergement === 'Logé sur place')) return false;
      if (filtre === 'allergies' && !r.allergies) return false;
      if (['Oui', 'Peut-être', 'Non'].includes(filtre) && r.presence !== filtre) return false;
      if (!q) return true;
      return [r.prenom, r.nom, r.email, r.telephone, r.accompagnant, r.enfants.map((k) => k.prenom + ' ' + k.nom).join(' ')]
        .join(' ').toLowerCase().includes(q);
    });
    if (!rows.length) {
      $('#liste').innerHTML = `<p class="vide">${donnees.length ? 'Aucune réponse ne correspond.' : 'Aucune réponse pour l\'instant. Elles arriveront ici dès que les invités répondront.'}</p>`;
      return;
    }
    $('#liste').innerHTML = rows.map((r) => {
      const lignes = [];
      if (r.presence !== 'Non') {
        lignes.push(['Personnes', r.nb_personnes]);
        if (r.moments) lignes.push(['Moments', esc(r.moments)]);
        if (r.hebergement) lignes.push(['Hébergement', esc(r.hebergement)]);
        if (r.accompagnant) lignes.push(['Avec', esc(r.accompagnant)]);
        if (r.enfants.length) lignes.push(['Enfants', r.enfants.map((k) => `${esc(k.prenom)} ${esc(k.nom)} (${k.age} ans)`).join(', ')]);
        if (r.allergies) lignes.push(['Allergies', `<span class="allerg">${esc(r.allergies)}</span>`]);
      }
      const date = new Date(r.updated_at.replace(' ', 'T') + 'Z').toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
      return `<article class="rep">
        <div class="rep-head"><h3>${esc(r.prenom)} ${esc(r.nom)}</h3><span class="badge ${BADGE[r.presence] || ''}">${esc(r.presence)}</span></div>
        <p class="contact"><a href="mailto:${esc(r.email)}">${esc(r.email)}</a> · <a href="tel:${esc(r.telephone.replace(/[^0-9+]/g, ''))}">${esc(r.telephone)}</a></p>
        ${lignes.length ? `<dl>${lignes.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : ''}
        ${r.message ? `<p class="msg">« ${esc(r.message)} »</p>` : ''}
        <div class="rep-foot"><span>${r.created_at !== r.updated_at ? 'Modifiée' : 'Reçue'} le ${date}</span>
          <button class="suppr" data-id="${r.id}" data-nom="${esc(r.prenom)} ${esc(r.nom)}">Supprimer</button></div>
      </article>`;
    }).join('');
  }

  $('#recherche').addEventListener('input', afficher);
  $$('.filtre').forEach((b) => b.addEventListener('click', () => {
    filtre = b.dataset.f;
    $$('.filtre').forEach((x) => x.classList.toggle('actif', x === b));
    afficher();
  }));
  $('#liste').addEventListener('click', async (e) => {
    const b = e.target.closest('.suppr');
    if (!b) return;
    if (!confirm(`Supprimer définitivement la réponse de ${b.dataset.nom} ?`)) return;
    try { await api('/api/admin/rsvps/' + b.dataset.id, { method: 'DELETE' }); charger(); } catch (err) { alert(err.message); }
  });

  // ---------- Infos pratiques ----------
  let infos = [];
  async function chargerInfos() {
    try { infos = (await api('/api/admin/infos')).infos; dessinerInfos(); } catch (e) { /* login */ }
  }
  function lireFormulaire() {
    infos = $$('.info-ed').map((el) => ({
      icone: el.querySelector('.i-ico').value,
      titre: el.querySelector('.i-titre').value,
      texte: el.querySelector('.i-texte').value,
      bientot: el.querySelector('.i-bientot').checked,
    }));
  }
  function dessinerInfos() {
    $('#infos-liste').innerHTML = infos.map((i, n) => `
      <div class="info-ed" data-n="${n}">
        <div><label class="f">Icône</label><input class="i-ico" value="${esc(i.icone)}" maxlength="8"></div>
        <div><label class="f">Titre</label><input class="i-titre" value="${esc(i.titre)}" maxlength="80"></div>
        <div class="plein"><label class="f">Texte</label><textarea class="i-texte" maxlength="1500">${esc(i.texte)}</textarea></div>
        <div class="bas">
          <label><input type="checkbox" class="i-bientot" ${i.bientot ? 'checked' : ''}> À venir (en pointillés)</label>
          <div class="ordre">
            <button type="button" data-act="haut" aria-label="Monter">↑</button>
            <button type="button" data-act="bas" aria-label="Descendre">↓</button>
            <button type="button" data-act="suppr" class="suppr">Retirer</button>
          </div>
        </div>
      </div>`).join('');
  }
  $('#infos-liste').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    lireFormulaire();
    const n = Number(b.closest('.info-ed').dataset.n);
    if (b.dataset.act === 'suppr') infos.splice(n, 1);
    if (b.dataset.act === 'haut' && n > 0) [infos[n - 1], infos[n]] = [infos[n], infos[n - 1]];
    if (b.dataset.act === 'bas' && n < infos.length - 1) [infos[n + 1], infos[n]] = [infos[n], infos[n + 1]];
    dessinerInfos();
    $('#info-msg').textContent = 'Modifications non enregistrées.'; $('#info-msg').className = 'ok ko';
  });
  $('#info-ajout').onclick = () => {
    lireFormulaire();
    infos.push({ icone: '✦', titre: '', texte: '', bientot: false });
    dessinerInfos();
    $$('.i-titre').pop().focus();
  };
  $('#info-save').onclick = async () => {
    lireFormulaire();
    try {
      infos = (await api('/api/admin/infos', { method: 'PUT', body: JSON.stringify({ infos }) })).infos;
      dessinerInfos();
      $('#info-msg').textContent = 'Enregistré ✓ — le site est à jour.'; $('#info-msg').className = 'ok';
    } catch (err) { $('#info-msg').textContent = err.message; $('#info-msg').className = 'ok ko'; }
  };

  // ---------- Démarrage ----------
  fetch('/api/admin/me').then((r) => (r.ok ? montrerApp() : montrerLogin())).catch(montrerLogin);
})();

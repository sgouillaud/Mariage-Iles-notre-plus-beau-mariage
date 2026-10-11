(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BADGE = { Oui: 'b-oui', Non: 'b-non' };

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
        ['cle', s.personnes, 'personnes confirmées', ''],
        ['', s.reponses, 'réponses reçues', ''],
        ['', s.oui, 'oui', ''],
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
      if (['Oui', 'Non'].includes(filtre) && r.presence !== filtre) return false;
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
    infos = $$('.info-ed').map((el) => {
      const i = {
        icone: el.querySelector('.i-ico').value,
        titre: el.querySelector('.i-titre').value,
        texte: el.querySelector('.i-texte').value,
        bientot: el.querySelector('.i-bientot').checked,
        trajets: [...el.querySelectorAll('.trajet-ed')].map((t) => ({
          depuis: t.querySelector('.t-depuis').value,
          resume: t.querySelector('.t-resume').value,
          details: t.querySelector('.t-details').value,
          lien: t.querySelector('.t-lien').value,
          lienTexte: t.querySelector('.t-lientexte').value,
        })),
      };
      const coul = el.querySelector('.i-couleurs').value.trim();
      if (coul) {
        i.couleurs = coul.split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
          const m = x.match(/^(.*?)\s*(#[0-9a-fA-F]{6})$/);
          return m ? { nom: m[1].trim(), hex: m[2] } : { nom: x, hex: '' };
        });
      }
      const url = el.querySelector('.i-lien-url').value.trim();
      if (url) i.lien = { url, texte: el.querySelector('.i-lien-texte').value };
      return i;
    });
  }
  function dessinerTrajet(t, n) {
    return `<div class="trajet-ed" data-t="${n}">
      <div class="duo">
        <div><label class="f">Depuis</label><input class="t-depuis" value="${esc(t.depuis)}" maxlength="60" placeholder="Paris"></div>
        <div><label class="f">En bref</label><input class="t-resume" value="${esc(t.resume)}" maxlength="60" placeholder="140 km · 2 h"></div>
      </div>
      <label class="f">Détail</label><textarea class="t-details" maxlength="2000">${esc(t.details)}</textarea>
      <div class="duo">
        <div><label class="f">Lien (https://…)</label><input class="t-lien" value="${esc(t.lien)}" maxlength="500"></div>
        <div><label class="f">Texte du lien</label><input class="t-lientexte" value="${esc(t.lienTexte)}" maxlength="80"></div>
      </div>
      <div class="ordre"><button type="button" data-act="t-haut">↑</button><button type="button" data-act="t-bas">↓</button><button type="button" data-act="t-suppr" class="suppr">Retirer ce trajet</button></div>
    </div>`;
  }
  function dessinerInfos() {
    $('#infos-liste').innerHTML = infos.map((i, n) => `
      <div class="info-ed" data-n="${n}">
        <div><label class="f">Icône</label><input class="i-ico" value="${esc(i.icone)}" maxlength="8"></div>
        <div><label class="f">Titre</label><input class="i-titre" value="${esc(i.titre)}" maxlength="80"></div>
        <div class="plein"><label class="f">Texte</label><textarea class="i-texte" maxlength="1500">${esc(i.texte)}</textarea></div>
        <div class="plein trajets-ed">
          <label class="f">Trajets dépliables${(i.trajets || []).length ? ` (${i.trajets.length})` : ''}</label>
          ${(i.trajets || []).map(dessinerTrajet).join('')}
          <button type="button" class="btn ghost petit" data-act="t-ajout">+ Ajouter un trajet</button>
        </div>
        <div class="plein"><label class="f">Couleurs (nom #code, séparées par des virgules)</label><input class="i-couleurs" value="${esc((i.couleurs || []).map((c) => `${c.nom} ${c.hex}`).join(', '))}" placeholder="Blanc #FFFFFF, Sable #D6BF98"></div>
        <div class="plein duo">
          <div><label class="f">Lien en bas de l'info (https://…)</label><input class="i-lien-url" value="${esc(i.lien ? i.lien.url : '')}" maxlength="500"></div>
          <div><label class="f">Texte du lien</label><input class="i-lien-texte" value="${esc(i.lien ? i.lien.texte : '')}" maxlength="80"></div>
        </div>
        <div class="bas">
          <label><input type="checkbox" class="i-bientot" ${i.bientot ? 'checked' : ''}> À venir (en pointillés)</label>
          <div class="ordre">
            <button type="button" data-act="haut" aria-label="Monter">↑</button>
            <button type="button" data-act="bas" aria-label="Descendre">↓</button>
            <button type="button" data-act="suppr" class="suppr">Retirer l'info</button>
          </div>
        </div>
      </div>`).join('');
  }
  function nonEnregistre() { $('#info-msg').textContent = 'Modifications non enregistrées.'; $('#info-msg').className = 'ok ko'; }
  $('#infos-liste').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    lireFormulaire();
    const n = Number(b.closest('.info-ed').dataset.n);
    const act = b.dataset.act;
    const swap = (arr, x, y) => { if (y >= 0 && y < arr.length) [arr[x], arr[y]] = [arr[y], arr[x]]; };
    if (act === 'suppr') infos.splice(n, 1);
    if (act === 'haut') swap(infos, n, n - 1);
    if (act === 'bas') swap(infos, n, n + 1);
    if (act.startsWith('t-')) {
      const tr = infos[n].trajets;
      const k = b.closest('.trajet-ed') ? Number(b.closest('.trajet-ed').dataset.t) : -1;
      if (act === 't-ajout') tr.push({ depuis: '', resume: '', details: '', lien: '', lienTexte: '' });
      if (act === 't-suppr') tr.splice(k, 1);
      if (act === 't-haut') swap(tr, k, k - 1);
      if (act === 't-bas') swap(tr, k, k + 1);
    }
    dessinerInfos();
    nonEnregistre();
    if (act === 't-ajout') { const l = $$(`.info-ed[data-n="${n}"] .t-depuis`); l[l.length - 1].focus(); }
  });
  $('#infos-liste').addEventListener('input', nonEnregistre);
  $('#info-ajout').onclick = () => {
    lireFormulaire();
    infos.push({ icone: '✦', titre: '', texte: '', bientot: false, trajets: [] });
    dessinerInfos();
    $$('.i-titre').pop().focus();
  };
  $('#info-save').onclick = async () => {
    lireFormulaire();
    try {
      infos = (await api('/api/admin/infos', { method: 'PUT', body: JSON.stringify({ infos }) })).infos;
      dessinerInfos();
      $('#info-msg').textContent = 'Enregistré ✓ Le site est à jour.'; $('#info-msg').className = 'ok';
    } catch (err) { $('#info-msg').textContent = err.message; $('#info-msg').className = 'ok ko'; }
  };

  // ---------- Démarrage ----------
  fetch('/api/admin/me').then((r) => (r.ok ? montrerApp() : montrerLogin())).catch(montrerLogin);
})();

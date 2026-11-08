// Escales : page d'accueil des animations, cartes postales, playlist, quiz et pronostics
(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const page = document.body.dataset.page;
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const EMOJI_TIMBRE = { 'Île Maurice': '🐬', 'La Réunion': '🌋', Guadeloupe: '🌺', Martinique: '🌴', 'Les Saintes': '⛵', 'Koh Samui': '🐘', Corse: '⛰️' };

  async function api(url, opts) {
    const o = opts || {};
    const r = await fetch(url, {
      method: o.method || 'GET',
      headers: o.body ? { 'Content-Type': 'application/json' } : undefined,
      body: o.body ? JSON.stringify(o.body) : undefined,
      cache: 'no-store',
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.message || 'Oups, réessayez.');
    return d;
  }
  let minuteurToast;
  function toast(msg, erreur) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast on' + (erreur ? ' err' : '');
    clearTimeout(minuteurToast);
    minuteurToast = setTimeout(() => { t.className = 'toast'; }, 3200);
  }

  // Le prénom est retenu sur le téléphone pour toutes les escales
  const PRENOM = 'photos-auteur';
  const lirePrenom = () => { try { return localStorage.getItem(PRENOM) || ''; } catch (e) { return ''; } };
  const garderPrenom = (v) => { try { localStorage.setItem(PRENOM, v.trim()); } catch (e) { /* ignore */ } };
  document.querySelectorAll('#c-auteur, #p-auteur, #q-auteur').forEach((i) => { i.value = lirePrenom(); });

  // ---------- Accueil des escales ----------
  const CARTES_HUB = [
    { nom: 'photos', href: '/photos', icone: '📸', titre: 'ILESstagram', texte: 'Notre réseau social du mariage : publiez vos photos, likez, commentez, partagez en story. En direct sur l’écran de la soirée !' },
    { nom: 'missions', href: '/photos#missions', icone: '🎯', titre: 'Missions d’escale', texte: 'Des défis photo à relever. Chaque mission accomplie tamponne votre passeport.' },
    { nom: 'cartes', href: '/cartes', icone: '💌', titre: 'Cartes postales', texte: 'Notre livre d’or : un petit mot sur une carte timbrée de nos îles.' },
    { nom: 'playlist', href: '/playlist', icone: '🎶', titre: 'La playlist', texte: 'Proposez vos titres et votez : le DJ suivra vos envies.' },
    { nom: 'quiz', href: '/quiz', icone: '🧠', titre: 'Connaissez-vous les mariés ?', texte: 'Un petit quiz et un classement. Le meilleur repart avec une surprise !' },
    { nom: 'pronos', href: '/pronostics', icone: '🔮', titre: 'Les pronostics', texte: 'Qui pleurera en premier ? Votez, on révèle tout pendant le dîner.' },
  ];
  async function hub() {
    const d = await api('/api/escales');
    $('#hub').innerHTML = CARTES_HUB.map((c) => {
      const ok = d.ouverts[c.nom] && (c.nom !== 'missions' || d.ouverts.photos);
      const visible = ok || d.admin;
      const tag = ok ? '<span class="etat ok">Embarquement</span>'
        : d.admin ? '<span class="etat apercu">Fermé aux invités · aperçu</span>' : '<span class="etat">À venir</span>';
      const inner = `<span class="hub-ico" aria-hidden="true">${c.icone}</span><span class="hub-txt"><b>${c.titre}</b><span>${c.texte}</span>${tag}</span>`;
      return visible ? `<a class="hub-carte${ok ? '' : ' ferme'}" href="${c.href}">${inner}</a>` : `<div class="hub-carte ferme">${inner}</div>`;
    }).join('');
  }

  // ---------- Cartes postales ----------
  let timbre = '';
  function carteHtml(c) {
    return `<article class="postale">
      <div class="postale-g"><p>${esc(c.message).replace(/\n/g, '<br>')}</p><p class="sign">— ${esc(c.auteur)}</p></div>
      <div class="postale-d"><span class="timbre"><span>${EMOJI_TIMBRE[c.timbre] || '✈'}</span><small>${esc(c.timbre)}</small></span>
      <span class="tampon">Il.e.s<br>2027</span><span class="adresse">Cédric &amp; Sébastien<br>Notre plus beau voyage</span></div>
    </article>`;
  }
  async function cartes() {
    const d = await api('/api/escales');
    timbre = d.timbres[0];
    $('#timbres').innerHTML = d.timbres.map((t, i) => `<button type="button" role="radio" aria-checked="${i === 0}" class="timbre-choix${i === 0 ? ' on' : ''}" data-t="${esc(t)}"><span>${EMOJI_TIMBRE[t] || '✈'}</span><small>${esc(t)}</small></button>`).join('');
    $('#timbres').addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      timbre = b.dataset.t;
      document.querySelectorAll('.timbre-choix').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
    });
    $('#f-carte').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.submitter || $('#f-carte button[type=submit]');
      btn.disabled = true;
      try {
        await api('/api/cartes', { method: 'POST', body: { auteur: $('#c-auteur').value, message: $('#c-message').value, timbre } });
        garderPrenom($('#c-auteur').value);
        $('#c-message').value = '';
        toast('Carte postée ! Merci ✉️');
        murCartes();
      } catch (er) { toast(er.message, true); }
      btn.disabled = false;
    });
    murCartes();
  }
  async function murCartes() {
    const d = await api('/api/cartes');
    $('#vide').hidden = d.cartes.length > 0;
    $('#mur').innerHTML = d.cartes.map(carteHtml).join('');
  }

  // ---------- Playlist ----------
  function afficherTitres(titres) {
    $('#vide').hidden = titres.length > 0;
    $('#titres').innerHTML = titres.map((t) => `<li>
      <span class="t-txt"><b>${esc(t.titre)}</b>${t.artiste ? `<span>${esc(t.artiste)}</span>` : ''}${t.auteur ? `<small>proposé par ${esc(t.auteur)}</small>` : ''}</span>
      <button type="button" class="vote${t.aVote ? ' on' : ''}" data-v="${t.id}" aria-pressed="${t.aVote}" aria-label="Voter pour ${esc(t.titre)}">❤ <b>${t.votes}</b></button>
    </li>`).join('');
  }
  async function playlist() {
    afficherTitres((await api('/api/playlist')).titres);
    $('#titres').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      b.disabled = true;
      try { afficherTitres((await api(`/api/playlist/${b.dataset.v}/vote`, { method: 'POST' })).titres); } catch (er) { toast(er.message, true); b.disabled = false; }
    });
    $('#f-titre').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const d = await api('/api/playlist', { method: 'POST', body: { titre: $('#p-titre').value, artiste: $('#p-artiste').value, auteur: $('#p-auteur').value } });
        garderPrenom($('#p-auteur').value);
        $('#p-titre').value = ''; $('#p-artiste').value = '';
        toast(d.nouveau ? 'Ajouté à la playlist 🎵' : 'Déjà proposé : on a compté votre vote ❤');
        afficherTitres(d.titres);
      } catch (er) { toast(er.message, true); }
    });
  }

  // ---------- Quiz ----------
  function podium(liste) {
    $('#classement').hidden = false;
    const medaille = ['🥇', '🥈', '🥉'];
    $('#podium').innerHTML = liste.map((j, i) => `<li><span>${medaille[i] || i + 1 + '.'}</span><b>${esc(j.auteur)}</b><em>${j.score} / ${j.total}</em></li>`).join('')
      || '<li class="aide">Personne n’a encore joué.</li>';
  }
  function resultat(score, total) {
    const r = $('#resultat');
    r.hidden = false;
    const mot = score === total ? 'Sans faute ! Vous nous connaissez par cœur 😍' : score >= total / 2 ? 'Bravo, vous avez bien suivi notre voyage ✈' : 'Il va falloir venir nous voir plus souvent 😉';
    r.innerHTML = `<p class="score">${score}<small> / ${total}</small></p><p class="sous">${mot}</p>`;
  }
  async function quiz() {
    const d = await api('/api/quiz');
    if (d.deja) { resultat(d.score, d.total); podium(d.classement); return; }
    const f = $('#f-quiz');
    f.hidden = false;
    $('#questions').innerHTML = d.questions.map((q, i) => `<fieldset class="q" data-q="${q.id}">
      <legend><span>${i + 1}</span>${esc(q.question)}</legend>
      ${q.choix.map((c) => `<label class="choix"><input type="radio" name="q-${q.id}" value="${esc(c)}" required><span>${esc(c)}</span></label>`).join('')}
    </fieldset>`).join('');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const reponses = {};
      f.querySelectorAll('fieldset[data-q]').forEach((fs) => { const c = fs.querySelector('input:checked'); if (c) reponses[fs.dataset.q] = c.value; });
      try {
        const r = await api('/api/quiz', { method: 'POST', body: { auteur: $('#q-auteur').value, reponses } });
        garderPrenom($('#q-auteur').value);
        r.corrections.forEach((c) => {
          const fs = f.querySelector(`fieldset[data-q="${c.id}"]`);
          fs.classList.add(c.juste ? 'juste' : 'faux');
          fs.querySelectorAll('label.choix').forEach((l) => { if (l.querySelector('input').value === c.bonne) l.classList.add('bonne'); });
          fs.querySelectorAll('input').forEach((i) => { i.disabled = true; });
        });
        f.querySelector('button[type=submit]').hidden = true;
        resultat(r.score, r.total);
        podium(r.classement);
        $('#resultat').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (er) { toast(er.message, true); }
    });
  }

  // ---------- Pronostics ----------
  async function pronos() {
    const d = await api('/api/pronos');
    const box = $('#pronos');
    box.innerHTML = (d.revele ? '<p class="bandeau">🎉 Les résultats sont révélés !</p>' : '') + d.questions.map((q) => {
      const res = d.resultats && d.resultats[q.id] || {};
      const total = Object.values(res).reduce((a, b) => a + b, 0);
      return `<section class="carte prono" data-q="${q.id}">
        <h3>${esc(q.question)}</h3>
        <div class="prono-choix">${q.choix.map((c) => {
          const n = res[c] || 0, pct = total ? Math.round((n / total) * 100) : 0;
          return `<button type="button" class="pc${d.mes[q.id] === c ? ' on' : ''}" data-c="${esc(c)}" ${d.revele ? 'disabled' : ''}>
            ${d.revele ? `<span class="barre" data-pct="${pct}"></span>` : ''}<span class="pc-txt">${esc(c)}</span>${d.revele ? `<b>${pct} %</b>` : ''}</button>`;
        }).join('')}</div>
      </section>`;
    }).join('');
    box.querySelectorAll('.barre').forEach((b) => { b.style.width = b.dataset.pct + '%'; });
    if (d.revele) return;
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      const q = b.closest('[data-q]');
      try {
        await api('/api/pronos', { method: 'POST', body: { question: q.dataset.q, choix: b.dataset.c } });
        q.querySelectorAll('.pc').forEach((x) => x.classList.toggle('on', x === b));
        toast('Pronostic enregistré 🔮');
      } catch (er) { toast(er.message, true); }
    });
  }

  const PAGES = { escales: hub, cartes, playlist, quiz, pronostics: pronos };
  if (PAGES[page]) PAGES[page]().catch((e) => toast(e.message, true));
})();

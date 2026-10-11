(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Infos pratiques (modifiables depuis /admin) ----------
  function afficherInfos(infos) {
    $('#infos').innerHTML = infos.map((i) =>
      `<div class="info reveal${i.bientot ? ' vide' : ''}"><div class="ico" aria-hidden="true">${esc(i.icone || '✦')}</div>` +
      `<div><h4>${esc(i.titre)}${i.bientot ? ' <small>· À VENIR</small>' : ''}</h4><p>${esc(i.texte)}</p></div></div>`
    ).join('');
    $$('#infos .reveal').forEach((el) => observer && observer.observe(el));
  }

  // ---------- Apparitions au défilement ----------
  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('vu'); observer.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    : null;
  if (observer) $$('.reveal').forEach((el) => observer.observe(el));
  else $$('.reveal').forEach((el) => el.classList.add('vu'));

  fetch('/api/infos').then((r) => r.json()).then((d) => afficherInfos(d.infos || [])).catch(() => {});

  // ---------- Tableau des départs (palettes qui défilent) ----------
  const JEU = " ABCDEFGHIJKLMNOPQRSTUVWXYZÀÈÉ'-0123456789";
  const reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function cellule() {
    const c = document.createElement('span');
    c.className = 'cell';
    c.innerHTML = '<span class="half top"><b></b></span><span class="half bot"><b></b></span>'
      + '<span class="half ftop"><b></b></span><span class="half fbot"><b></b></span>';
    c.car = ' ';
    return c;
  }
  function poser(c, car) {
    c.querySelectorAll('b').forEach((b) => { b.textContent = car; });
    c.car = car;
  }
  function palette(c, car, ms) {
    const [top, bot, ftop, fbot] = c.querySelectorAll('.half');
    const ancien = c.car;
    top.firstChild.textContent = car;
    bot.firstChild.textContent = ancien;
    ftop.firstChild.textContent = ancien;
    fbot.firstChild.textContent = car;
    c.car = car;
    if (!ftop.animate) { poser(c, car); return Promise.resolve(); }
    const a1 = ftop.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-90deg)' }], { duration: ms / 2, easing: 'ease-in', fill: 'forwards' });
    return a1.finished.then(() => {
      const a2 = fbot.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0deg)' }], { duration: ms / 2, easing: 'ease-out', fill: 'forwards' });
      return a2.finished;
    }).then(() => { bot.firstChild.textContent = car; ftop.firstChild.textContent = car; });
  }
  // Fait défiler une cellule de caractère en caractère jusqu'à la cible, comme un vrai tableau
  async function defiler(c, cible, delai) {
    await new Promise((r) => setTimeout(r, delai));
    if (reduit) { poser(c, cible); return; }
    let fin = JEU.indexOf(cible);
    if (fin < 0) fin = 0;
    let i = (fin - 6 - Math.floor(Math.random() * 9) + JEU.length) % JEU.length;
    poser(c, JEU[i]);
    let pas = 0;
    while (i !== fin && pas < 60) {
      i = (i + 1) % JEU.length; pas++;
      await palette(c, JEU[i], 70);
    }
  }
  function preparer(el) {
    const n = Number(el.dataset.len);
    el.innerHTML = '';
    for (let k = 0; k < n; k++) {
      const c = cellule();
      poser(c, JEU[1 + Math.floor(Math.random() * 26)]);
      el.appendChild(c);
    }
    return [...el.children];
  }
  function afficherTexte(el, texte, delai0, alignDroite) {
    const cells = el.cells || (el.cells = preparer(el));
    const n = cells.length;
    const t = (alignDroite ? texte.padStart(n, ' ') : texte.padEnd(n, ' ')).slice(0, n).toUpperCase();
    return Promise.all(cells.map((c, k) => defiler(c, t[k], delai0 + k * 70)));
  }
  function joursRestants() {
    const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).reduce((o, x) => (o[x.type] = x.value, o), {});
    const auj = Date.UTC(+p.year, +p.month - 1, +p.day);
    return Math.round((Date.UTC(2027, 5, 26) - auj) / 864e5);
  }
  [$('#flaps-dest1'), $('#flaps-dest2'), $('#flaps-jours'), $('#flaps-unite'), $('#flaps-statut')].forEach((el) => { el.cells = preparer(el); });
  let tableauLance = false;
  function lancerTableau() {
    if (tableauLance) return; tableauLance = true;
    const j = joursRestants();
    const jours = j > 0 ? String(j) : '0';
    const unite = j > 1 ? 'JOURS' : 'JOUR';
    const statut = j > 0 ? "À L'HEURE" : j === 0 ? 'EMBARQUEMENT' : 'ARRIVÉ';
    $('#board').setAttribute('aria-label', `Tableau des départs : vol IL 2627 pour Cloyes-les-Trois-Rivières, départ dans ${jours} ${unite.toLowerCase()}, ${statut.toLowerCase()}`);
    afficherTexte($('#flaps-dest1'), 'CLOYES LES', 300);
    afficherTexte($('#flaps-dest2'), 'TROIS RIVIÈRES', 450);
    afficherTexte($('#flaps-jours'), jours, 500, true);
    afficherTexte($('#flaps-unite'), unite, 800);
    afficherTexte($('#flaps-statut'), statut, 1100);
  }
  if (window.ilesGo && window.ilesGo()) lancerTableau();
  else document.addEventListener('iles:go', lancerTableau);
  setTimeout(lancerTableau, 9500);

  // ---------- Formulaire : affichages conditionnels ----------
  const val = (n) => (document.querySelector(`input[name="${n}"]:checked`) || {}).value;
  function maj() {
    const p = val('presence');
    const vient = p === 'Oui' || p === 'Peut-être';
    $('#bloc-venue').classList.toggle('cache', !vient);
    $('#bloc-details').classList.toggle('cache', !vient);
    $('#bloc-accomp').classList.toggle('cache', val('accomp') !== 'Oui');
    const avecEnf = val('enfants') === 'Oui';
    $('#bloc-enfants').classList.toggle('cache', !avecEnf);
    if (avecEnf && !$('#liste-enfants').children.length) ajoutEnfant();
    if (p) $('#err-presence').style.display = 'none';
    if (val('hebergement')) $('#err-heberg').style.display = 'none';
  }
  $$('input[type=radio]').forEach((r) => r.addEventListener('change', maj));

  function renum() {
    $$('#liste-enfants .enfant').forEach((e, i) => { e.querySelector('.num').textContent = 'Enfant ' + (i + 1); });
  }
  function ajoutEnfant() {
    const div = document.createElement('div');
    div.className = 'enfant';
    div.innerHTML = `<div class="num"></div><button type="button" class="suppr">Retirer</button>
      <div class="grid3">
        <div><label class="f">Prénom <i>*</i></label><input type="text" class="e-prenom" maxlength="60"><p class="msg-err">Prénom</p></div>
        <div><label class="f">Nom <i>*</i></label><input type="text" class="e-nom" maxlength="80"><p class="msg-err">Nom</p></div>
        <div class="age"><label class="f">Âge <i>*</i></label><input type="number" class="e-age" min="0" max="17" inputmode="numeric"><p class="msg-err">Âge</p></div>
      </div>`;
    div.querySelector('.suppr').onclick = () => {
      div.remove(); renum();
      if (!$('#liste-enfants').children.length) { document.querySelector('input[name=enfants][value=Non]').checked = true; maj(); }
    };
    div.querySelectorAll('input').forEach((el) => el.addEventListener('input', () => el.classList.remove('invalid')));
    $('#liste-enfants').appendChild(div); renum();
  }
  $('#ajout-enfant').onclick = ajoutEnfant;

  // ---------- Validation ----------
  const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const reTel = /^\+?[0-9 .\-()]{8,20}$/;
  const check = (el, ok) => { el.classList.toggle('invalid', !ok); return ok; };
  $$('input,textarea').forEach((el) => el.addEventListener('input', () => el.classList.remove('invalid')));

  function valider() {
    let ok = true;
    ok = check($('#prenom'), !!$('#prenom').value.trim()) && ok;
    ok = check($('#nom'), !!$('#nom').value.trim()) && ok;
    ok = check($('#email'), reEmail.test($('#email').value.trim())) && ok;
    ok = check($('#tel'), reTel.test($('#tel').value.trim())) && ok;
    const p = val('presence');
    if (!p) { $('#err-presence').style.display = 'block'; ok = false; }
    if (p && p !== 'Non') {
      if (!val('hebergement')) { $('#err-heberg').style.display = 'block'; ok = false; }
      if (val('accomp') === 'Oui') {
        ok = check($('#acc_prenom'), !!$('#acc_prenom').value.trim()) && ok;
        ok = check($('#acc_nom'), !!$('#acc_nom').value.trim()) && ok;
      }
      if (val('enfants') === 'Oui') {
        $$('#liste-enfants .enfant').forEach((e) => {
          ok = check(e.querySelector('.e-prenom'), !!e.querySelector('.e-prenom').value.trim()) && ok;
          ok = check(e.querySelector('.e-nom'), !!e.querySelector('.e-nom').value.trim()) && ok;
          const a = e.querySelector('.e-age').value;
          ok = check(e.querySelector('.e-age'), a !== '' && +a >= 0 && +a < 18 && Number.isInteger(+a)) && ok;
        });
      }
    }
    return ok;
  }

  function donnees() {
    const p = val('presence');
    const vient = p && p !== 'Non';
    const enfants = vient && val('enfants') === 'Oui'
      ? $$('#liste-enfants .enfant').map((e) => ({
        prenom: e.querySelector('.e-prenom').value.trim(),
        nom: e.querySelector('.e-nom').value.trim(),
        age: Number(e.querySelector('.e-age').value),
      }))
      : [];
    return {
      prenom: $('#prenom').value.trim(), nom: $('#nom').value.trim(),
      email: $('#email').value.trim(), telephone: $('#tel').value.trim(),
      presence: p,
      moments: vient ? $$('input[name=moments]:checked').map((c) => c.value).join(', ') : '',
      hebergement: vient ? val('hebergement') : '',
      accompagnant: vient && val('accomp') === 'Oui' ? `${$('#acc_prenom').value.trim()} ${$('#acc_nom').value.trim()}` : '',
      enfants,
      allergies: vient ? $('#allergies').value.trim() : '',
      message: $('#message').value.trim(),
    };
  }

  // ---------- Envoi ----------
  $('#form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    $('#alerte').style.display = 'none';
    if (!valider()) {
      const first = document.querySelector('.invalid')
        || (!val('presence') ? $('#presence-choix') : $('#heberg-choix'));
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const d = donnees();
    const btn = $('#btn-envoi');
    btn.disabled = true; btn.textContent = 'Envoi en cours…';
    try {
      const r = await fetch('/api/rsvp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d),
      });
      const res = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(res.message || 'Erreur');
      $('#form').style.display = 'none';
      $('#merci').style.display = 'block';
      const t = $('#tampon'); t.classList.remove('frappe'); void t.offsetWidth; t.classList.add('frappe');
      $('#merci-titre').textContent = `Merci ${d.prenom} !`;
      const base =
        d.presence === 'Oui' ? 'Votre place est réservée à bord. On a hâte de vivre ce voyage avec vous !'
          : d.presence === 'Peut-être' ? 'C\'est noté ! Revenez confirmer dès que vous savez, avec le même email.'
            : 'Vous allez nous manquer. Merci d\'avoir pris le temps de répondre.';
      $('#merci-texte').textContent = res.updated ? `Votre réponse a bien été mise à jour. ${base}` : base;
      $('#reponse').scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      $('#alerte').textContent = e.message && e.message !== 'Erreur' && e.message !== 'Failed to fetch'
        ? e.message
        : 'Oups, l\'envoi n\'a pas fonctionné. Vérifie ta connexion et réessaie.';
      $('#alerte').style.display = 'block';
      $('#alerte').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally {
      btn.disabled = false; btn.textContent = 'Valider ma carte d\'embarquement';
    }
  });

  $('#autre').onclick = () => {
    $('#form').reset(); $('#liste-enfants').innerHTML = ''; maj();
    $('#merci').style.display = 'none'; $('#form').style.display = 'block';
    $('#reponse').scrollIntoView({ behavior: 'smooth' });
  };
})();

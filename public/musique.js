// Musique de fond « notre chanson » : joue par défaut après l'intro, bouton flottant pour couper.
// - Lecteur audio simple (pas de Web Audio) : sur iPhone il joue même en mode silencieux, comme une vidéo.
// - Le fichier est déjà mixé doucement, car l'iPhone ignore le réglage de volume des pages web.
// - Les téléphones exigent un toucher avant tout son : le toucher « Embarquer » débloque la lecture ;
//   sinon (intro déjà vue), la musique démarre au premier toucher sur la page.
(function () {
  const SRC = window.ILES_MUSIQUE || '/sons/chanson.mp3';
  let audio = null, joue = false, bouton = null, demarre = false, attente = false;
  let coupe = false; // coupé par l'invité pendant cette visite
  try { coupe = sessionStorage.getItem('musique-coupee') === '1'; } catch (e) { /* ignore */ }

  function construire() {
    if (audio) return;
    audio = new Audio(SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
  }

  function fondu(vers, ms) {
    // Ordinateur : fondu doux. iPhone : le volume est fixe (fichier déjà doux), ce code est sans effet.
    if (!audio) return;
    const depart = audio.volume, t0 = performance.now();
    (function pas(now) {
      const k = Math.min(1, (now - t0) / ms);
      try { audio.volume = depart + (vers - depart) * k; } catch (e) { return; }
      if (k < 1) requestAnimationFrame(pas);
    })(t0);
  }

  function majBouton() {
    if (!bouton) return;
    bouton.classList.toggle('joue', joue);
    bouton.setAttribute('aria-pressed', joue ? 'true' : 'false');
    bouton.setAttribute('aria-label', joue ? 'Couper la musique' : 'Écouter notre chanson');
    bouton.title = joue ? 'Couper la musique' : 'Écouter notre chanson';
  }

  function jouer(depuisDebut) {
    construire();
    if (depuisDebut) { try { audio.currentTime = 0; } catch (e) { /* ignore */ } }
    audio.muted = false;
    const p = audio.play();
    return (p && p.then ? p : Promise.resolve()).then(() => {
      joue = true; majBouton();
      try { audio.volume = 0; } catch (e) { /* ignore */ }
      fondu(1, 2000);
    });
  }

  // Si le téléphone a bloqué le démarrage : on relance au tout premier toucher sur la page
  function auPremierToucher() {
    if (attente) return;
    attente = true;
    const go = (e) => {
      if (bouton && e && bouton.contains(e.target)) return; // le bouton gère lui-même
      ['pointerup', 'touchend', 'click', 'keydown'].forEach((t) => document.removeEventListener(t, go, true));
      attente = false;
      if (!coupe && !joue) jouer(false).catch(() => {});
    };
    ['pointerup', 'touchend', 'click', 'keydown'].forEach((t) => document.addEventListener(t, go, true));
  }

  // Appelé pendant le toucher « Embarquer » : lecture muette pour obtenir l'autorisation du téléphone
  function debloquer() {
    construire();
    audio.muted = true;
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
  }

  // Appelé à la fin de l'intro
  function demarrer() {
    if (bouton) bouton.hidden = false;
    if (demarre) return;
    demarre = true;
    if (coupe) { if (audio) audio.pause(); majBouton(); return; }
    jouer(true).catch(() => { joue = false; majBouton(); auPremierToucher(); });
  }

  function basculer() {
    if (joue) {
      coupe = true; joue = false;
      fondu(0, 350);
      setTimeout(() => { if (!joue && audio) audio.pause(); }, 380);
    } else {
      coupe = false;
      jouer(false).catch(() => {});
    }
    try { sessionStorage.setItem('musique-coupee', coupe ? '1' : '0'); } catch (e) { /* ignore */ }
    majBouton();
  }

  document.addEventListener('DOMContentLoaded', () => {
    bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'musique';
    bouton.hidden = true;
    bouton.innerHTML =
      '<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<svg class="muet" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    bouton.addEventListener('click', basculer);
    document.body.appendChild(bouton);
    majBouton();
    if (demarre || (window.ilesGo && window.ilesGo())) { bouton.hidden = false; demarrer(); }
  });
  document.addEventListener('iles:go', demarrer);

  window.ilesMusique = { debloquer, demarrer };
})();

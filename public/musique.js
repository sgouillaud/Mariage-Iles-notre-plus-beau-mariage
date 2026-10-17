// Musique de fond « notre chanson » : démarre après l'intro, volume doux, bouton flottant pour couper.
// Les téléphones n'autorisent le son qu'après un toucher : intro.js appelle ilesMusique.debloquer()
// au moment où l'invité touche « Embarquer ».
(function () {
  const SRC = window.ILES_MUSIQUE || '/sons/chanson.mp3';
  const VOLUME = 0.22; // pas trop fort
  let audio = null, ac = null, gain = null, joue = false, bouton = null, demarre = false;
  let coupe = false;
  try { coupe = localStorage.getItem('musique-coupee') === '1'; } catch (e) { /* stockage indisponible */ }

  function construire() {
    if (audio) return;
    audio = new Audio(SRC);
    audio.loop = true;
    audio.preload = 'auto';
    const AC = window.AudioContext || window.webkitAudioContext;
    try {
      ac = window.ilesAudio || (AC ? new AC() : null);
      if (ac) {
        window.ilesAudio = ac;
        const src = ac.createMediaElementSource(audio);
        gain = ac.createGain();
        gain.gain.value = 0;
        src.connect(gain); gain.connect(ac.destination);
      }
    } catch (e) { gain = null; }
    if (!gain) audio.volume = 0;
  }

  function volume(v, duree) {
    if (gain && ac) {
      const t = ac.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(v, t + duree);
    } else if (audio) {
      audio.volume = v;
    }
  }

  function lire() {
    if (ac && ac.resume) ac.resume();
    const p = audio.play();
    return p && p.then ? p : Promise.resolve();
  }

  function majBouton() {
    if (!bouton) return;
    bouton.classList.toggle('joue', joue);
    bouton.setAttribute('aria-pressed', joue ? 'true' : 'false');
    bouton.setAttribute('aria-label', joue ? 'Couper la musique' : 'Écouter notre chanson');
    bouton.title = joue ? 'Couper la musique' : 'Écouter notre chanson';
  }

  // Appelé pendant le toucher « Embarquer » : lance la lecture en silence pour la débloquer
  function debloquer() {
    construire();
    lire().catch(() => {});
  }

  // Appelé à la fin de l'intro
  function demarrer() {
    if (bouton) bouton.hidden = false;
    if (demarre) return;
    demarre = true;
    if (coupe) { if (audio) audio.pause(); joue = false; majBouton(); return; }
    construire();
    try { audio.currentTime = 0; } catch (e) { /* ignore */ }
    lire().then(() => { joue = true; volume(VOLUME, 2.5); majBouton(); })
      .catch(() => { joue = false; majBouton(); }); // pas de toucher préalable : l'invité lancera via le bouton
  }

  function basculer() {
    construire();
    if (joue) {
      coupe = true; joue = false;
      volume(0, 0.4);
      setTimeout(() => { if (!joue && audio) audio.pause(); }, 450);
    } else {
      coupe = false;
      lire().then(() => { joue = true; volume(VOLUME, 1); majBouton(); }).catch(() => {});
      joue = true;
    }
    try { localStorage.setItem('musique-coupee', coupe ? '1' : '0'); } catch (e) { /* ignore */ }
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

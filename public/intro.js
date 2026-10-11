// Intro « la marée se retire » — jouée une fois par visite, désactivée si l'appareil demande moins d'animations
(function () {
  var html = document.documentElement;
  html.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen = false;
  try { seen = sessionStorage.getItem('maree') === '1'; sessionStorage.setItem('maree', '1'); } catch (e) { /* stockage indisponible */ }
  function go() { html.classList.add('go'); }
  setTimeout(go, 4000); // filet de sécurité

  if (reduce || seen) { document.addEventListener('DOMContentLoaded', go); return; }

  document.addEventListener('DOMContentLoaded', function () {
    var m = document.createElement('div');
    m.className = 'maree';
    m.setAttribute('aria-hidden', 'true');
    m.innerHTML =
      '<div class="eau"></div>' +
      '<svg class="bord" viewBox="0 0 1440 90" preserveAspectRatio="none"><path d="M0 0 H1440 V42 C1260 88 1080 12 900 48 C720 86 540 14 360 50 C180 86 90 30 0 56 Z"/></svg>' +
      '<svg class="ecume" viewBox="0 0 1440 90" preserveAspectRatio="none"><path d="M0 56 C90 30 180 86 360 50 C540 14 720 86 900 48 C1080 12 1260 88 1440 42"/></svg>' +
      '<div class="titre">Il.e.s</div>';
    document.body.appendChild(m);
    requestAnimationFrame(function () { requestAnimationFrame(function () { m.classList.add('part'); }); });
    setTimeout(go, 1400);
    setTimeout(function () { m.remove(); }, 2700);
  });
})();

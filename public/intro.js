// Intro « notre itinéraire » : sur une carte de voyage ancienne, un petit avion relie nos îles une à une
// (Maurice, La Réunion, Guadeloupe, Martinique, les Saintes, Koh Samui, la Corse) jusqu'à Yron.
// Environ 6 secondes ; un toucher la fait passer. Jouée une fois par visite ;
// désactivée si l'appareil demande moins d'animations.
(function () {
  var html = document.documentElement;
  html.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen = false;
  try { seen = sessionStorage.getItem('intro') === '1'; sessionStorage.setItem('intro', '1'); } catch (e) { /* stockage indisponible */ }
  var parti = false;
  function go() {
    if (parti) return; parti = true;
    html.classList.add('go');
    document.dispatchEvent(new Event('iles:go'));
  }
  window.ilesGo = function () { return parti; };
  var secours = setTimeout(go, 9000); // filet de sécurité

  if (reduce || seen) { document.addEventListener('DOMContentLoaded', go); return; }

  var NS = 'http://www.w3.org/2000/svg';
  var ILES = [
    { nom: 'Île Maurice', x: 262, y: 590, r: 24 },
    { nom: 'La Réunion', x: 100, y: 548, r: 22 },
    { nom: 'Guadeloupe', x: 258, y: 462, r: 25, papillon: true },
    { nom: 'Martinique', x: 92, y: 392, r: 22 },
    { nom: 'Les Saintes', x: 246, y: 322, r: 9, archipel: true },
    { nom: 'Koh Samui', x: 98, y: 248, r: 21 },
    { nom: 'Corse', x: 250, y: 176, r: 23 },
  ];
  var YRON = { x: 180, y: 86 };

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  // Contour d'île organique (forme stable pour chaque île)
  function ile(cx, cy, r, graine) {
    var pts = [], n = 22;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var k = 1 + 0.18 * Math.sin(a * 3 + graine) + 0.1 * Math.sin(a * 5 + graine * 2) + 0.05 * Math.sin(a * 9 + graine);
      pts.push([cx + Math.cos(a) * r * k * 1.15, cy + Math.sin(a) * r * k * 0.85]);
    }
    var d = 'M' + pts[0].join(' ');
    for (var j = 0; j < n; j++) {
      var p0 = pts[(j - 1 + n) % n], p1 = pts[j], p2 = pts[(j + 1) % n], p3 = pts[(j + 2) % n];
      d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6) + ',' +
        (p2[0] - (p3[0] - p1[0]) / 6) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6) + ',' + p2[0] + ' ' + p2[1];
    }
    return d + 'Z';
  }
  // Courbe douce passant par tous les points (Catmull-Rom)
  function route(pts) {
    var d = 'M' + pts[0].x + ' ' + pts[0].y;
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ' C' + (p1.x + (p2.x - p0.x) / 5) + ' ' + (p1.y + (p2.y - p0.y) / 5) + ',' +
        (p2.x - (p3.x - p1.x) / 5) + ' ' + (p2.y - (p3.y - p1.y) / 5) + ',' + p2.x + ' ' + p2.y;
    }
    return d;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var box = document.createElement('div');
    box.className = 'ouverture';
    box.setAttribute('aria-hidden', 'true');
    document.body.appendChild(box);
    var svg = el('svg', { viewBox: '0 0 360 680', preserveAspectRatio: 'xMidYMid meet' }, box);

    // Mer : petites vaguelettes gravées, rose des vents
    var mer = el('g', { class: 'i-mer' }, svg);
    for (var v = 0; v < 26; v++) {
      var vx = (v * 97) % 330 + 15, vy = (v * 151) % 640 + 25;
      el('path', { d: 'M' + vx + ' ' + vy + ' q4 -4 8 0 t8 0', class: 'i-vaguelette' }, mer);
    }
    var rose = el('g', { class: 'i-rose', transform: 'translate(52 92)' }, svg);
    el('circle', { r: 20 }, rose);
    el('path', { d: 'M0 -28 L4 0 L0 28 L-4 0 Z M-28 0 L0 -4 L28 0 L0 4 Z' }, rose);
    var nord = el('text', { y: -32, 'text-anchor': 'middle' }, rose); nord.textContent = 'N';

    // Les îles
    var groupes = ILES.map(function (p, i) {
      var g = el('g', { class: 'i-ile' }, svg);
      if (p.archipel) {
        el('path', { d: ile(p.x - 9, p.y + 2, 7, i + 1), class: 'i-terre' }, g);
        el('path', { d: ile(p.x + 6, p.y - 5, 6, i + 3), class: 'i-terre' }, g);
        el('path', { d: ile(p.x + 4, p.y + 9, 4, i + 5), class: 'i-terre' }, g);
      } else if (p.papillon) {
        el('path', { d: ile(p.x - 12, p.y, p.r * 0.62, i + 1), class: 'i-terre' }, g);
        el('path', { d: ile(p.x + 13, p.y + 2, p.r * 0.55, i + 2), class: 'i-terre' }, g);
      } else {
        el('path', { d: ile(p.x, p.y, p.r, i * 1.7 + 1), class: 'i-terre' }, g);
      }
      var gauche = p.x > 180;
      var t = el('text', {
        x: gauche ? p.x - p.r - 26 : p.x + p.r + 26, y: p.y + 4,
        'text-anchor': gauche ? 'end' : 'start', class: 'i-nom',
      }, g);
      t.textContent = p.nom;
      return g;
    });

    // L'itinéraire : pointillés révélés par un masque
    var pts = ILES.map(function (p) { return { x: p.x, y: p.y }; }).concat([YRON]);
    var d = route(pts);
    var defs = el('defs', {}, svg);
    var mask = el('mask', { id: 'i-masque', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 360, height: 680 }, defs);
    var revele = el('path', { d: d, class: 'i-revele' }, mask);
    el('path', { d: d, class: 'i-route', mask: 'url(#i-masque)' }, svg);
    var L = revele.getTotalLength();
    revele.style.strokeDasharray = L;
    revele.style.strokeDashoffset = L;

    // Position de chaque île le long de l'itinéraire
    var seuils = ILES.map(function (p) {
      var best = 0, dmin = 1e9;
      for (var s = 0; s <= 400; s++) {
        var q = revele.getPointAtLength((s / 400) * L);
        var dd = (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y);
        if (dd < dmin) { dmin = dd; best = s / 400; }
      }
      return best;
    });

    // Yron : épingle en forme de cœur
    var arrivee = el('g', { class: 'i-arrivee' }, svg);
    el('path', { d: 'M' + YRON.x + ' ' + (YRON.y + 9) + ' c-14 -10 -16 -22 -8 -26 c5 -2 8 1 8 4 c0 -3 3 -6 8 -4 c8 4 6 16 -8 26 z', class: 'i-coeur' }, arrivee);
    var ty = el('text', { x: YRON.x, y: YRON.y + 32, 'text-anchor': 'middle', class: 'i-yron' }, arrivee); ty.textContent = 'Cloyes-les-Trois-Rivières';
    var td = el('text', { x: YRON.x, y: YRON.y + 48, 'text-anchor': 'middle', class: 'i-date' }, arrivee); td.textContent = '26 · 06 · 2027';

    // L'avion
    var avion = el('g', { class: 'i-avion' }, svg);
    el('path', { d: 'M12 0 L-6 -3 L-10 -12 L-13 -12 L-11 -3 L-16 -2 L-19 -6 L-21 -6 L-20 0 L-21 6 L-19 6 L-16 2 L-11 3 L-13 12 L-10 12 L-6 3 Z' }, avion);

    // Légende du bas
    var leg = document.createElement('div');
    leg.className = 'i-legende';
    leg.innerHTML = '<span class="i-eyebrow">Notre itinéraire</span><span class="i-titre">Il.e.s</span><span class="i-sous">Notre plus beau voyage</span>';
    box.appendChild(leg);
    var passer = document.createElement('div');
    passer.className = 'i-passer'; passer.textContent = 'Touchez pour passer';
    box.appendChild(passer);

    var T_VOL0 = 0.7, T_VOL1 = 4.6, T_FIN = 5.7;
    var t0 = null, decalage = 0, fini = false;
    var easeInOut = function (k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; };
    var clamp = function (k) { return Math.max(0, Math.min(1, k)); };

    box.addEventListener('pointerdown', function () {
      if (t0 === null) return;
      var t = (performance.now() - t0) / 1000 + decalage;
      if (t < T_FIN) decalage += T_FIN - t;
    });

    function frame(now) {
      if (t0 === null) { t0 = now; box.classList.add('on'); }
      var t = (now - t0) / 1000 + decalage;
      var p = easeInOut(clamp((t - T_VOL0) / (T_VOL1 - T_VOL0)));
      revele.style.strokeDashoffset = L * (1 - p);

      var a = revele.getPointAtLength(Math.max(0, p * L - 0.5));
      var b = revele.getPointAtLength(Math.min(L, p * L + 0.5));
      var ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      avion.setAttribute('transform', 'translate(' + b.x + ' ' + b.y + ') rotate(' + ang + ')');
      avion.style.opacity = t < T_VOL0 - 0.3 ? 0 : (p >= 1 ? Math.max(0, 1 - (t - T_VOL1) * 3) : 1);

      groupes.forEach(function (g, i) { if (p >= seuils[i] - 0.01) g.classList.add('vue'); });
      if (p >= 0.999) { arrivee.classList.add('vue'); leg.classList.add('vue'); }

      if (t >= T_FIN && !fini) {
        fini = true;
        box.classList.add('part');
        clearTimeout(secours);
        go();
        setTimeout(function () { box.remove(); }, 900);
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
})();

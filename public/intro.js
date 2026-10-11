// Intro « la vague » : une eau claire et turquoise vient lécher le sable, une seconde vague recouvre l'écran,
// puis la mer se retire en dévoilant le site. Environ 6 secondes ; un toucher la fait passer.
// Jouée une fois par visite ; désactivée si l'appareil demande moins d'animations.
(function () {
  var html = document.documentElement;
  html.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen = false;
  try { seen = sessionStorage.getItem('maree') === '1'; sessionStorage.setItem('maree', '1'); } catch (e) { /* stockage indisponible */ }
  function go() { html.classList.add('go'); }
  var secours = setTimeout(go, 9000); // filet de sécurité

  if (reduce || seen) { document.addEventListener('DOMContentLoaded', go); return; }

  document.addEventListener('DOMContentLoaded', function () {
    var c = document.createElement('canvas');
    c.className = 'maree';
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    var ctx = c.getContext('2d');
    if (!ctx) { c.remove(); go(); return; }
    var W, H, dpr = Math.min(2, window.devicePixelRatio || 1);
    function size() { W = window.innerWidth; H = window.innerHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size();
    window.addEventListener('resize', size);

    // Grain du sable, avec quelques petits coquillages clairs
    var grain = document.createElement('canvas'); grain.width = grain.height = 160;
    var g = grain.getContext('2d');
    for (var i = 0; i < 1100; i++) {
      g.fillStyle = Math.random() < 0.55 ? 'rgba(150,110,60,.16)' : 'rgba(255,255,255,.4)';
      g.fillRect(Math.random() * 160, Math.random() * 160, Math.random() < 0.85 ? 1 : 2, 1);
    }
    var grainPat = ctx.createPattern(grain, 'repeat');

    var s1 = Math.random() * 6, s2 = Math.random() * 6, s3 = Math.random() * 6;
    function ligne(px, t, base, amp) {
      return base + amp * (16 * Math.sin(px * 0.011 + t * 1.5 + s1) + 9 * Math.sin(px * 0.029 - t * 2.1 + s2) + 4 * Math.sin(px * 0.071 + t * 3.2 + s3));
    }
    var easeOut = function (k) { return 1 - Math.pow(1 - k, 3); };
    var easeInOut = function (k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
    var clamp = function (k) { return Math.max(0, Math.min(1, k)); };
    var mix = function (a, b, k) { return a + (b - a) * k; };

    // Chronologie (secondes) : clapotis, 1re vague, ressac, 2e vague qui couvre, titre, retrait
    var K = [
      [0.0, 0.82], [0.7, 0.80],   // clapotis au bas de l'écran
      [2.0, 0.34],                // 1re vague monte
      [2.9, 0.58],                // ressac
      [4.0, -0.40],               // 2e vague recouvre tout
      [4.9, -0.40],               // le titre flotte
      [6.6, 1.25],                // la mer se retire
    ];
    var T_RETRAIT = 4.9, T_FIN = 6.7;
    function niveau(t) {
      for (var j = 1; j < K.length; j++) {
        if (t <= K[j][0]) {
          var k = clamp((t - K[j - 1][0]) / (K[j][0] - K[j - 1][0]));
          var e = (K[j][1] < K[j - 1][1]) ? easeOut(k) : easeInOut(k); // monte vite, redescend en douceur
          return mix(K[j - 1][1], K[j][1], e) * H;
        }
      }
      return K[K.length - 1][1] * H;
    }

    var t0 = null, decalage = 0, devoile = false;
    // Un toucher fait passer directement au retrait de la mer
    c.addEventListener('pointerdown', function () {
      if (t0 === null) return;
      var t = (performance.now() - t0) / 1000 + decalage;
      if (t < T_RETRAIT) decalage += T_RETRAIT - t;
    });

    function chemin(t, base, amp) {
      ctx.beginPath();
      ctx.moveTo(-10, ligne(-10, t, base, amp));
      for (var px = -10; px <= W + 20; px += 8) ctx.lineTo(px, ligne(px, t, base, amp));
    }
    function eauChemin(t, base, amp) { chemin(t, base, amp); ctx.lineTo(W + 20, H + 10); ctx.lineTo(-10, H + 10); ctx.closePath(); }

    function sable(clipBase, t, amp) {
      ctx.save();
      if (clipBase !== null) { eauChemin(t, clipBase, amp); ctx.clip(); }
      var sg = ctx.createLinearGradient(0, 0, 0, H);
      sg.addColorStop(0, '#F5E8CF'); sg.addColorStop(1, '#E4CB9F');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = grainPat; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Reflets de lumière au fond de l'eau (caustiques)
    function caustiques(t, base, amp) {
      ctx.save();
      eauChemin(t, base, amp); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 2.2;
      for (var n = 0; n < 16; n++) {
        var y0 = (n / 16) * (H + 120) - 60;
        ctx.beginPath();
        for (var px = -10; px <= W + 20; px += 10) {
          var y = y0 + 14 * Math.sin(px * 0.025 + t * 1.3 + n * 1.7) + 8 * Math.sin(px * 0.06 - t * 1.9 + n);
          if (px === -10) ctx.moveTo(px, y); else ctx.lineTo(px, y);
        }
        ctx.strokeStyle = 'rgba(255,255,240,' + (0.07 + 0.04 * Math.sin(t * 2 + n)) + ')';
        ctx.stroke();
      }
      for (var m = 0; m < 12; m++) {
        var x0 = (m / 12) * (W + 120) - 60;
        ctx.beginPath();
        for (var py = -10; py <= H + 20; py += 12) {
          var x = x0 + 16 * Math.sin(py * 0.022 + t * 1.1 + m * 2.1) + 7 * Math.sin(py * 0.05 - t * 1.6 + m);
          if (py === -10) ctx.moveTo(x, py); else ctx.lineTo(x, py);
        }
        ctx.strokeStyle = 'rgba(255,255,240,' + (0.06 + 0.03 * Math.sin(t * 1.7 + m)) + ')';
        ctx.stroke();
      }
      ctx.restore();
    }

    function frame(now) {
      if (t0 === null) t0 = now;
      var t = (now - t0) / 1000 + decalage;
      var base = niveau(t);
      var amp = t < T_RETRAIT ? 1 : 1.25;
      var retrait = t >= T_RETRAIT;

      ctx.clearRect(0, 0, W, H);

      // Le sable : partout avant le retrait, seulement sous l'eau pendant le retrait
      sable(retrait ? base : null, t, amp);

      // Sable mouillé laissé derrière la mer, qui sèche (et s'efface) en un instant
      if (retrait) {
        var f = 1 - clamp((t - T_RETRAIT) / 0.9);
        if (f > 0) {
          ctx.save(); chemin(t, base, amp); ctx.lineTo(W + 20, -10); ctx.lineTo(-10, -10); ctx.closePath();
          ctx.fillStyle = 'rgba(200,172,128,' + (0.55 * f) + ')'; ctx.fill(); ctx.restore();
        }
      } else {
        // trace humide juste devant l'écume
        chemin(t, base - 30, amp); ctx.lineTo(W + 20, H + 10); ctx.lineTo(-10, H + 10); ctx.closePath();
        ctx.fillStyle = 'rgba(140,110,70,.16)'; ctx.fill();
      }

      // Ombre de l'écume sur le fond
      chemin(t, base + 10, amp);
      ctx.strokeStyle = 'rgba(90,70,40,.12)'; ctx.lineWidth = 10; ctx.stroke();

      // L'eau claire : transparente au bord, turquoise puis bleu lagon au large
      eauChemin(t, base, amp);
      var prof = Math.max(H * 0.9, 260);
      var wg = ctx.createLinearGradient(0, base - 10, 0, base + prof);
      wg.addColorStop(0, 'rgba(190,240,232,.18)');
      wg.addColorStop(0.10, 'rgba(120,222,214,.30)');
      wg.addColorStop(0.35, 'rgba(48,190,192,.55)');
      wg.addColorStop(0.75, 'rgba(18,150,165,.80)');
      wg.addColorStop(1, 'rgba(10,120,140,.92)');
      ctx.fillStyle = wg; ctx.fill();

      caustiques(t, base, amp);

      // L'écume
      chemin(t, base, amp);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,.30)'; ctx.lineWidth = 15; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 4; ctx.stroke();
      for (var k = 1; k <= 3; k++) {
        chemin(t * 1.2 + k, base + k * 13 + 5 * Math.sin(t * 3 + k), amp * 0.9);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 / k) + ')'; ctx.lineWidth = 2.2 / k + 0.6;
        ctx.setLineDash([18 / k + 6, 9 + k * 5]); ctx.stroke();
      }
      ctx.setLineDash([]);

      // Le titre, porté par l'eau
      var ta = clamp((t - 3.7) / 0.5) * (1 - clamp((t - 5.0) / 0.4));
      if (ta > 0) {
        ctx.save();
        ctx.globalAlpha = ta;
        ctx.fillStyle = '#FBF7F0';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(10,80,90,.45)'; ctx.shadowBlur = 18;
        ctx.font = '600 ' + Math.round(Math.min(W * 0.14, 68)) + 'px Fraunces, Georgia, serif';
        ctx.fillText('Il.e.s', W / 2, H / 2 - 14);
        ctx.font = 'italic 400 ' + Math.round(Math.min(W * 0.05, 22)) + 'px Fraunces, Georgia, serif';
        ctx.fillText('Notre plus beau voyage', W / 2, H / 2 + 30);
        ctx.restore();
      }

      // Indication discrète pour passer
      var pa = 0.75 * clamp(t / 0.6) * (1 - clamp((t - (T_RETRAIT - 0.4)) / 0.4));
      if (pa > 0) {
        ctx.save(); ctx.globalAlpha = pa;
        ctx.fillStyle = t < 3.6 ? 'rgba(80,60,35,1)' : '#FBF7F0';
        ctx.font = '500 12px Jost, system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Touchez pour passer', W / 2, 34);
        ctx.restore();
      }

      if (!devoile && t > T_RETRAIT + 0.3) { devoile = true; clearTimeout(secours); go(); }
      if (t < T_FIN) requestAnimationFrame(frame);
      else { window.removeEventListener('resize', size); c.remove(); }
    }
    requestAnimationFrame(frame);
  });
})();

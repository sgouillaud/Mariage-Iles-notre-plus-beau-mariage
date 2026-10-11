// Intro « la vague » : une vague turquoise monte sur le sable, recouvre l'écran puis se retire en dévoilant le site.
// Jouée une fois par visite ; désactivée si l'appareil demande moins d'animations.
(function () {
  var html = document.documentElement;
  html.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen = false;
  try { seen = sessionStorage.getItem('maree') === '1'; sessionStorage.setItem('maree', '1'); } catch (e) { /* stockage indisponible */ }
  function go() { html.classList.add('go'); }
  setTimeout(go, 5000); // filet de sécurité

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

    // Grain du sable (texture pré-calculée)
    var grain = document.createElement('canvas'); grain.width = grain.height = 140;
    var g = grain.getContext('2d');
    for (var i = 0; i < 900; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(150,110,60,.18)' : 'rgba(255,255,255,.35)';
      g.fillRect(Math.random() * 140, Math.random() * 140, Math.random() < 0.8 ? 1 : 2, 1);
    }
    var grainPat = ctx.createPattern(grain, 'repeat');

    var s1 = Math.random() * 6, s2 = Math.random() * 6, s3 = Math.random() * 6;
    function ligne(px, t, base, amp) {
      return base + amp * (16 * Math.sin(px * 0.011 + t * 1.6 + s1) + 9 * Math.sin(px * 0.029 - t * 2.2 + s2) + 4 * Math.sin(px * 0.071 + t * 3.4 + s3));
    }
    var easeOut = function (k) { return 1 - Math.pow(1 - k, 3); };
    var easeInOut = function (k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
    var clamp = function (k) { return Math.max(0, Math.min(1, k)); };

    // Chronologie (secondes)
    var T_MONTE = 0.35, T_HAUT = 1.35, T_RETRAIT = 1.75, T_FIN = 3.3;
    var t0 = null, devoile = false;

    function chemin(t, base, amp) {
      ctx.beginPath();
      ctx.moveTo(-10, ligne(-10, t, base, amp));
      for (var px = -10; px <= W + 20; px += 8) ctx.lineTo(px, ligne(px, t, base, amp));
    }

    function frame(now) {
      if (t0 === null) t0 = now;
      var t = (now - t0) / 1000;
      var base;
      if (t < T_MONTE) base = H * 0.8 - 10 * Math.sin(t * 6);
      else if (t < T_HAUT) base = H * 0.8 - easeOut(clamp((t - T_MONTE) / (T_HAUT - T_MONTE))) * H * 1.15;
      else if (t < T_RETRAIT) base = H * -0.35;
      else base = H * -0.35 + easeInOut(clamp((t - T_RETRAIT) / (T_FIN - T_RETRAIT - 0.15))) * H * 1.6;
      var amp = t < T_HAUT ? 1 : 1.25;

      ctx.clearRect(0, 0, W, H);

      // Sable (avant la vague) ou reflet de sable mouillé (pendant le retrait)
      if (t < T_HAUT) {
        var sg = ctx.createLinearGradient(0, 0, 0, H);
        sg.addColorStop(0, '#F4E6CC'); sg.addColorStop(1, '#E6CFA6');
        ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = grainPat; ctx.fillRect(0, 0, W, H);
      } else if (t > T_RETRAIT) {
        var f = 1 - clamp((t - T_RETRAIT) / 1.2);
        if (f > 0) {
          chemin(t, base, amp); ctx.lineTo(W + 20, -10); ctx.lineTo(-10, -10); ctx.closePath();
          ctx.fillStyle = 'rgba(64,190,186,' + (0.22 * f) + ')'; ctx.fill();
        }
      }

      // Zone mouillée juste devant l'écume (sable assombri)
      if (t < T_HAUT) {
        chemin(t, base - 26, amp); ctx.lineTo(W + 20, H + 10); ctx.lineTo(-10, H + 10); ctx.closePath();
        ctx.fillStyle = 'rgba(150,120,80,.18)'; ctx.fill();
      }

      // L'eau
      chemin(t, base, amp); ctx.lineTo(W + 20, H + 10); ctx.lineTo(-10, H + 10); ctx.closePath();
      var wg = ctx.createLinearGradient(0, base - 40, 0, Math.max(base + H * 0.9, base + 200));
      wg.addColorStop(0, 'rgba(170,236,228,.92)');
      wg.addColorStop(0.12, '#5FD0CB');
      wg.addColorStop(0.45, '#22A9AE');
      wg.addColorStop(1, '#0E7F8A');
      ctx.fillStyle = wg; ctx.fill();

      // Reflets qui ondulent dans l'eau
      ctx.lineWidth = 1.5;
      for (var r = 1; r <= 5; r++) {
        var off = 40 + r * 55 + 12 * Math.sin(t * 1.8 + r);
        chemin(t + r * 0.4, base + off, amp * 0.6);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.16 - r * 0.02) + ')'; ctx.stroke();
      }

      // L'écume
      chemin(t, base, amp);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 16; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 4.5; ctx.stroke();
      for (var k = 1; k <= 3; k++) {
        chemin(t * 1.2 + k, base + k * 13 + 5 * Math.sin(t * 3 + k), amp * 0.9);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 / k) + ')'; ctx.lineWidth = 2.2 / k + 0.6;
        ctx.setLineDash([18 / k + 6, 9 + k * 5]); ctx.stroke();
      }
      ctx.setLineDash([]);

      // Le titre, porté par l'eau
      var ta = clamp((t - 1.0) / 0.35) * (1 - clamp((t - 1.85) / 0.35));
      if (ta > 0) {
        ctx.save();
        ctx.globalAlpha = ta;
        ctx.fillStyle = '#FBF7F0';
        ctx.font = '600 ' + Math.round(Math.min(W * 0.13, 64)) + 'px Fraunces, Georgia, serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(10,80,90,.35)'; ctx.shadowBlur = 18;
        ctx.fillText('Il.e.s', W / 2, H / 2);
        ctx.restore();
      }

      if (!devoile && t > T_RETRAIT + 0.15) { devoile = true; go(); }
      if (t < T_FIN) requestAnimationFrame(frame);
      else { window.removeEventListener('resize', size); c.remove(); }
    }
    requestAnimationFrame(frame);
  });
})();

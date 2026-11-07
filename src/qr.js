'use strict';
// QR code aux couleurs du mariage : modules vert canard, yeux terracotta, fond crème.
// Sans logo au centre (le logo est déjà sur les affiches et l'écran) : niveau de correction M, modules plus gros.
const QRCode = require('qrcode');
const { PNG } = require('pngjs');

const CANARD = '#1F5C5B', TERRACOTTA = '#C0643E', CREME = '#FBF7F0';
const MARGE = 3;

function matrice(texte) {
  const m = QRCode.create(texte, { errorCorrectionLevel: 'M' }).modules;
  const n = m.size;
  const oeil = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const libre = () => false;
  return { n, noir: (r, c) => !!m.data[r * n + c], oeil, libre };
}

function svg(texte) {
  const { n, noir, oeil, libre } = matrice(texte);
  const t = n + 2 * MARGE;
  // Modules carrés (yeux compris) : c'est la forme la plus sûre à scanner
  let d = '', e = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!noir(r, c) || libre(r, c)) continue;
    const m = `M${c + MARGE} ${r + MARGE}h1v1h-1z`;
    if (oeil(r, c)) e += m; else d += m;
  }
  const yeux = `<path d="${e}" fill="${TERRACOTTA}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges">` +
    `<rect width="${t}" height="${t}" rx="2" fill="${CREME}"/>` +
    `<path d="${d}" fill="${CANARD}"/>${yeux}` +
    `</svg>`;
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// PNG haute définition pour l'imprimeur (~2000 px de côté)
function png(texte) {
  const { n, noir, oeil, libre } = matrice(texte);
  const t = n + 2 * MARGE, k = Math.floor(2000 / t), W = t * k;
  const img = new PNG({ width: W, height: W });
  const [fr, fg, fb] = hex(CREME), [cr, cg, cb] = hex(CANARD), [tr, tg, tb] = hex(TERRACOTTA);
  const set = (x, y, r, g, b) => { const i = (y * W + x) * 4; img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255; };
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) set(x, y, fr, fg, fb);
  const carre = (r, c, R, G, B) => { for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) set((c + MARGE) * k + x, (r + MARGE) * k + y, R, G, B); };
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!noir(r, c) || libre(r, c)) continue;
    if (oeil(r, c)) carre(r, c, tr, tg, tb); else carre(r, c, cr, cg, cb);
  }
  return PNG.sync.write(img);
}

module.exports = { svg, png };

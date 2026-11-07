'use strict';
// QR code aux couleurs du mariage : modules vert canard, yeux terracotta, fond crème, logo au centre.
// Niveau de correction H (30 %) : le logo central ne gêne pas la lecture.
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { PNG } = require('pngjs');

const CANARD = '#1F5C5B', TERRACOTTA = '#C0643E', CREME = '#FBF7F0';
const LOGO_PNG = fs.readFileSync(path.join(__dirname, 'logo-qr-480.png'));
const LOGO_PETIT = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'logo-qr-240.png')).toString('base64');
const MARGE = 3;

function matrice(texte) {
  const m = QRCode.create(texte, { errorCorrectionLevel: 'H' }).modules;
  const n = m.size;
  const oeil = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const zone = Math.round(n * 0.26) | 1; // zone libre centrale pour le logo (nombre impair de modules)
  const z0 = (n - zone) / 2, z1 = z0 + zone;
  const libre = (r, c) => r >= z0 && r < z1 && c >= z0 && c < z1;
  return { n, noir: (r, c) => !!m.data[r * n + c], oeil, libre, zone, z0 };
}

function svg(texte) {
  const { n, noir, oeil, libre, zone, z0 } = matrice(texte);
  const t = n + 2 * MARGE;
  // Modules carrés (yeux compris) : c'est la forme la plus sûre à scanner
  let d = '', e = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!noir(r, c) || libre(r, c)) continue;
    const m = `M${c + MARGE} ${r + MARGE}h1v1h-1z`;
    if (oeil(r, c)) e += m; else d += m;
  }
  const yeux = `<path d="${e}" fill="${TERRACOTTA}"/>`;
  const lx = z0 + MARGE, cx = lx + zone / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges">` +
    `<rect width="${t}" height="${t}" rx="2" fill="${CREME}"/>` +
    `<path d="${d}" fill="${CANARD}"/>${yeux}` +
    `<circle cx="${cx}" cy="${cx}" r="${zone / 2}" fill="${CREME}"/>` +
    `<image href="${LOGO_PETIT}" x="${lx + 0.4}" y="${lx + 0.4}" width="${zone - 0.8}" height="${zone - 0.8}"/>` +
    `</svg>`;
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// PNG haute définition pour l'imprimeur (~2000 px de côté)
function png(texte) {
  const { n, noir, oeil, libre, zone, z0 } = matrice(texte);
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
  // Logo rond au centre (réduit par moyenne de zones)
  const logo = PNG.sync.read(LOGO_PNG);
  const taille = zone * k, x0 = (z0 + MARGE) * k, ratio = logo.width / taille;
  for (let y = 0; y < taille; y++) for (let x = 0; x < taille; x++) {
    let r = 0, g = 0, b = 0, a = 0, cpt = 0;
    const ya = Math.floor(y * ratio), yb = Math.min(logo.height, Math.max(ya + 1, Math.floor((y + 1) * ratio)));
    const xa = Math.floor(x * ratio), xb = Math.min(logo.width, Math.max(xa + 1, Math.floor((x + 1) * ratio)));
    for (let yy = ya; yy < yb; yy++) for (let xx = xa; xx < xb; xx++) {
      const i = (yy * logo.width + xx) * 4, al = logo.data[i + 3] / 255;
      r += logo.data[i] * al; g += logo.data[i + 1] * al; b += logo.data[i + 2] * al; a += al; cpt++;
    }
    if (!cpt || !a) continue;
    const al = a / cpt;
    const i = ((x0 + y) * W + x0 + x) * 4;
    img.data[i] = Math.round(r / cpt + img.data[i] * (1 - al));
    img.data[i + 1] = Math.round(g / cpt + img.data[i + 1] * (1 - al));
    img.data[i + 2] = Math.round(b / cpt + img.data[i + 2] * (1 - al));
  }
  return PNG.sync.write(img);
}

module.exports = { svg, png };

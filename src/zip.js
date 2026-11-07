'use strict';
// Archive ZIP simple (sans compression : les photos sont déjà compressées), écrite au fil de l'eau
const fs = require('fs');
const zlib = require('zlib');

function dosTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

// entrees : [{ nom, chemin }] ; écrit dans le flux `out` (réponse HTTP)
async function envoyerZip(out, entrees) {
  const centrales = [];
  let offset = 0;
  const ecrire = (buf) => new Promise((ok) => { offset += buf.length; if (out.write(buf)) ok(); else out.once('drain', ok); });
  const { time, date } = dosTime(new Date());
  for (const e of entrees) {
    let data;
    try { data = await fs.promises.readFile(e.chemin); } catch { continue; }
    const nom = Buffer.from(e.nom, 'utf8');
    const crc = zlib.crc32(data) >>> 0;
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8);
    h.writeUInt16LE(time, 10); h.writeUInt16LE(date, 12); h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nom.length, 26); h.writeUInt16LE(0, 28);
    const debut = offset;
    await ecrire(h); await ecrire(nom); await ecrire(data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10);
    c.writeUInt16LE(time, 12); c.writeUInt16LE(date, 14); c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nom.length, 28);
    c.writeUInt32LE(debut, 42);
    centrales.push(Buffer.concat([c, nom]));
  }
  const dir = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(centrales.length, 8); fin.writeUInt16LE(centrales.length, 10);
  fin.writeUInt32LE(dir.length, 12); fin.writeUInt32LE(offset, 16);
  await ecrire(dir); await ecrire(fin);
  out.end();
}

module.exports = { envoyerZip };

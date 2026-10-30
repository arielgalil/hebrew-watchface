// Derives, per year type (קביעות), which of the 7 pairs are joined, from Hebcal data.
// Usage: TZ=Asia/Jerusalem node derive_table.cjs <fromYear> <toYear>
'use strict';
const fs = require('fs');
const path = require('path');
const m = require('./parasha.cjs');
const [from, to] = process.argv.slice(2).map(Number);
const PAIRS = ['Vayakhel-Pekudei', 'Tazria-Metzora', 'Achrei Mot-Kedoshim', 'Behar-Bechukotai', 'Chukat-Balak', 'Matot-Masei', 'Nitzavim-Vayeilech'];
const table = {};
let conflicts = 0;
for (let y = from; y <= to; y += 1) {
  const type = m.yearType(y);
  for (const k of ['on', 'off']) {
    const titles = JSON.parse(fs.readFileSync(path.join(__dirname, 'hebcal', `${y}_i${k}.json`))).items.map(it => it.title.replace('Parashat ', ''));
    const flags = PAIRS.map(p => (titles.includes(p) ? '1' : '0')).join('');
    const key = type + (k === 'on' ? 'i' : 'd');
    if (table[key] && table[key] !== flags) { conflicts += 1; console.log('conflict', y, key, table[key], flags); }
    table[key] = flags;
  }
}
const types = Object.keys(table).sort();
console.log(JSON.stringify(table));
console.log(types.length / 2, 'year types seen, conflicts:', conflicts);

// Prototype: weekly Torah portion (parashat hashavua) for a Shabbat, Israel or diaspora.
// Pure ES2015, no imports, so it can be pasted into the watch face next to the calendar helpers.
// Validate: TZ=Asia/Jerusalem node parasha.cjs   (compares with research/hebcal/*.json)
'use strict';

// ---- Calendar helpers (copied from src/watchface/default-target/index.js) ----
const HEBREW_EPOCH = -1373427; // fixed day number of 1 Tishri, year 1
const UNIX_EPOCH_RD = 719163; // fixed day number of 1970-01-01

function isHebrewLeapYear(year) {
  return ((7 * year + 1) % 19) < 7;
}

function monthsElapsed(year) {
  return Math.floor((235 * year - 234) / 19);
}

function elapsedDays(year) {
  const months = monthsElapsed(year);
  let days = 29 * months + Math.floor((12084 + 13753 * months) / 25920);
  if ((3 * (days + 1)) % 7 < 3) days += 1;
  return days;
}

function newYearDelay(year) {
  const prev = elapsedDays(year - 1);
  const cur = elapsedDays(year);
  const next = elapsedDays(year + 1);
  if (next - cur === 356) return 2;
  if (cur - prev === 382) return 1;
  return 0;
}

function hebrewNewYear(year) {
  return HEBREW_EPOCH + elapsedDays(year) + newYearDelay(year);
}

function hebrewYearLength(year) {
  return hebrewNewYear(year + 1) - hebrewNewYear(year);
}

// Months of a Hebrew year in civil order, starting from Tishri.
// Keys are used as indexes into HEBREW_MONTH_NAMES.
function hebrewMonths(year) {
  const yearLength = hebrewYearLength(year);
  const months = [
    { key: 'tishri', days: 30 },
    { key: 'heshvan', days: yearLength % 10 === 5 ? 30 : 29 },
    { key: 'kislev', days: yearLength % 10 === 3 ? 29 : 30 },
    { key: 'tevet', days: 29 },
    { key: 'shevat', days: 30 },
  ];
  if (isHebrewLeapYear(year)) {
    months.push({ key: 'adar1', days: 30 }, { key: 'adar2', days: 29 });
  } else {
    months.push({ key: 'adar', days: 29 });
  }
  months.push(
    { key: 'nisan', days: 30 },
    { key: 'iyar', days: 29 },
    { key: 'sivan', days: 30 },
    { key: 'tammuz', days: 29 },
    { key: 'av', days: 30 },
    { key: 'elul', days: 29 }
  );
  return months;
}

// Gregorian calendar date (local components) to fixed day number.
function fixedDayFromDate(date) {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round(utc / 86400000) + UNIX_EPOCH_RD;
}

// Fixed day number to { year, month (key), day } in the Hebrew calendar.
function hebrewDateFromFixed(fixed) {
  let year = Math.floor((fixed - HEBREW_EPOCH) / 365.2468) + 1;
  while (hebrewNewYear(year) > fixed) year -= 1;
  while (hebrewNewYear(year + 1) <= fixed) year += 1;

  let monthStart = hebrewNewYear(year);
  const months = hebrewMonths(year);
  for (let i = 0; i < months.length; i += 1) {
    if (fixed < monthStart + months[i].days) {
      return { year: year, month: months[i].key, day: fixed - monthStart + 1 };
    }
    monthStart += months[i].days;
  }
  throw new Error('fixed day out of range: ' + fixed);
}

function fixedFromHebrew(year, monthKey, day) {
  let fixed = hebrewNewYear(year);
  const months = hebrewMonths(year);
  for (let i = 0; i < months.length; i += 1) {
    if (months[i].key === monthKey) return fixed + day - 1;
    fixed += months[i].days;
  }
  return null;
}

// ---- Parasha ----------------------------------------------------------------

// The 53 Shabbat readings in order (V'Zot HaBracha is read on Simchat Torah, never on Shabbat).
const PARASHOT = ['בראשית', 'נח', 'לך לך', 'וירא', 'חיי שרה', 'תולדות', 'ויצא', 'וישלח', 'וישב', 'מקץ',
  'ויגש', 'ויחי', 'שמות', 'וארא', 'בא', 'בשלח', 'יתרו', 'משפטים', 'תרומה', 'תצוה', 'כי תשא', 'ויקהל',
  'פקודי', 'ויקרא', 'צו', 'שמיני', 'תזריע', 'מצורע', 'אחרי מות', 'קדושים', 'אמור', 'בהר', 'בחוקותי',
  'במדבר', 'נשא', 'בהעלותך', 'שלח', 'קרח', 'חוקת', 'בלק', 'פינחס', 'מטות', 'מסעי', 'דברים', 'ואתחנן',
  'עקב', 'ראה', 'שופטים', 'כי תצא', 'כי תבוא', 'נצבים', 'וילך', 'האזינו'];
const P = {}; // name -> index
PARASHOT.forEach((name, i) => { P[name] = i; });

const nextShabbat = fixed => fixed + ((6 - (fixed % 7) + 7) % 7); // fixed itself if Shabbat

// A Shabbat that is a festival or Chol HaMoed has its own reading; returns its name or ''.
function festivalShabbat(fixed, israel) {
  const hd = hebrewDateFromFixed(fixed);
  const m = hd.month;
  const d = hd.day;
  if (m === 'tishri') {
    if (d <= 2) return 'ראש השנה';
    if (d === 10) return 'יום כיפור';
    if (d === 15 || (!israel && d === 16)) return 'סוכות';
    if (d >= 16 && d <= 21) return 'שבת חול המועד';
    if (d === 22) return 'שמיני עצרת';
    if (!israel && d === 23) return 'שמחת תורה';
  }
  if (m === 'nisan') {
    if (d === 15 || (!israel && d === 16)) return 'פסח';
    if (d >= 16 && d <= 20) return 'שבת חול המועד';
    if (d === 21 || (!israel && d === 22)) return 'שביעי של פסח';
  }
  if (m === 'sivan' && (d === 6 || (!israel && d === 7))) return 'שבועות';
  return '';
}

// Year type (קביעות): leap or plain, weekday of Rosh Hashana (0 = Sunday) and length in days.
// The 14 possible types decide which pairs are joined.
function yearType(year) {
  const length = hebrewNewYear(year + 1) - hebrewNewYear(year);
  return (isHebrewLeapYear(year) ? 'L' : 'P') + (hebrewNewYear(year) % 7) + '_' + length;
}

// Pairs that may be read together, in Torah order.
const PAIRS = [['ויקהל', 'פקודי'], ['תזריע', 'מצורע'], ['אחרי מות', 'קדושים'], ['בהר', 'בחוקותי'],
  ['חוקת', 'בלק'], ['מטות', 'מסעי'], ['נצבים', 'וילך']];

// For each year type and Israel (i) / diaspora (d): '1' where the pair in PAIRS is joined.
// Derived from Hebcal 5760-5790 by derive_table.cjs; validated on 5760-5820 (5791-5820 not used to derive).
const JOINED = {
  L1_383d: '0000111',
  L1_383i: '0000011',
  L1_385d: '0000010',
  L1_385i: '0000000',
  L2_384d: '0000010',
  L2_384i: '0000000',
  L4_383d: '0000000',
  L4_383i: '0000000',
  L4_385d: '0000001',
  L4_385i: '0000001',
  L6_383d: '0000011',
  L6_383i: '0000011',
  L6_385d: '0000111',
  L6_385i: '0000011',
  P1_353d: '1111011',
  P1_353i: '1111011',
  P1_355d: '1111111',
  P1_355i: '1111011',
  P2_354d: '1111111',
  P2_354i: '1111011',
  P4_354d: '1111010',
  P4_354i: '1110010',
  P4_355d: '0111010',
  P4_355i: '0111010',
  P6_353d: '1111010',
  P6_353i: '1111010',
  P6_355d: '1111011',
  P6_355i: '1111011',
};

// Readings of one cycle: from Bereshit of Hebrew year `year` until Bereshit of the next year.
// Festival Shabbatot are skipped; every other Shabbat gets the next reading (a pair if joined).
// Returns a map fixed -> name (joined pairs as 'ויקהל-פקודי').
function parashaCycle(year, israel) {
  const simchatTorah = y => fixedFromHebrew(y, 'tishri', israel ? 22 : 23);
  const start = nextShabbat(simchatTorah(year) + 1);
  const end = nextShabbat(simchatTorah(year + 1) + 1); // exclusive
  const flags = JOINED[yearType(year) + (israel ? 'i' : 'd')];
  if (!flags) throw new Error('no table entry for year type ' + yearType(year));
  const readings = [];
  for (let i = 0; i < PARASHOT.length; i += 1) {
    const pair = PAIRS.findIndex(p => p[0] === PARASHOT[i]);
    if (pair >= 0 && flags[pair] === '1') {
      readings.push(PARASHOT[i] + '-' + PARASHOT[i + 1]);
      i += 1;
    } else {
      readings.push(PARASHOT[i]);
    }
  }
  const result = {};
  let n = 0;
  for (let f = start; f < end; f += 7) {
    if (festivalShabbat(f, israel)) continue;
    if (n >= readings.length) throw new Error('year ' + year + ': more Shabbatot than readings');
    result[f] = readings[n];
    n += 1;
  }
  if (n !== readings.length) throw new Error('year ' + year + ': ' + readings.length + ' readings for ' + n + ' Shabbatot');
  return result;
}

const cycleCache = {};
// Name to show for the Shabbat on or after `fixed`: a parasha, or the festival read that Shabbat.
function parashaForShabbat(fixed, israel) {
  const shabbat = nextShabbat(fixed);
  const festival = festivalShabbat(shabbat, israel);
  if (festival) return festival;
  let year = hebrewDateFromFixed(shabbat).year;
  if (shabbat < nextShabbat(fixedFromHebrew(year, 'tishri', israel ? 23 : 24))) year -= 1;
  const key = year + (israel ? 'i' : 'd');
  if (!cycleCache[key]) cycleCache[key] = parashaCycle(year, israel);
  return cycleCache[key][shabbat];
}

module.exports = { yearType, parashaForShabbat, parashaCycle, festivalShabbat, PARASHOT, fixedFromHebrew, hebrewDateFromFixed, fixedDayFromDate };

// ---- Validation against Hebcal ---------------------------------------------------
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  // Hebcal transliteration -> our Hebrew names.
  const HEBCAL = {
    'Bereshit': 'בראשית', 'Noach': 'נח', 'Lech-Lecha': 'לך לך', 'Vayera': 'וירא', 'Chayei Sara': 'חיי שרה',
    'Toldot': 'תולדות', 'Vayetzei': 'ויצא', 'Vayishlach': 'וישלח', 'Vayeshev': 'וישב', 'Miketz': 'מקץ',
    'Vayigash': 'ויגש', 'Vayechi': 'ויחי', 'Shemot': 'שמות', 'Vaera': 'וארא', 'Bo': 'בא', 'Beshalach': 'בשלח',
    'Yitro': 'יתרו', 'Mishpatim': 'משפטים', 'Terumah': 'תרומה', 'Tetzaveh': 'תצוה', 'Ki Tisa': 'כי תשא',
    'Vayakhel': 'ויקהל', 'Pekudei': 'פקודי', 'Vayikra': 'ויקרא', 'Tzav': 'צו', 'Shmini': 'שמיני',
    'Tazria': 'תזריע', 'Metzora': 'מצורע', 'Achrei Mot': 'אחרי מות', 'Kedoshim': 'קדושים', 'Emor': 'אמור',
    'Behar': 'בהר', 'Bechukotai': 'בחוקותי', 'Bamidbar': 'במדבר', 'Nasso': 'נשא', 'Beha’alotcha': 'בהעלותך',
    'Sh’lach': 'שלח', 'Korach': 'קרח', 'Chukat': 'חוקת', 'Balak': 'בלק', 'Pinchas': 'פינחס', 'Matot': 'מטות',
    'Masei': 'מסעי', 'Devarim': 'דברים', 'Vaetchanan': 'ואתחנן', 'Eikev': 'עקב', 'Re’eh': 'ראה',
    'Shoftim': 'שופטים', 'Ki Teitzei': 'כי תצא', 'Ki Tavo': 'כי תבוא', 'Nitzavim': 'נצבים',
    'Vayeilech': 'וילך', 'Ha’azinu': 'האזינו',
  };
  const toHebrew = title => {
    const t = title.replace(/^Parashat /, '');
    if (HEBCAL[t]) return HEBCAL[t];
    // joined pair, e.g. 'Achrei Mot-Kedoshim' (split on the hyphen that separates two known names)
    for (let i = 0; i < t.length; i += 1) {
      if (t[i] === '-' && HEBCAL[t.slice(0, i)] && HEBCAL[t.slice(i + 1)]) return HEBCAL[t.slice(0, i)] + '-' + HEBCAL[t.slice(i + 1)];
    }
    throw new Error('unknown Hebcal name ' + title);
  };
  const dir = path.join(__dirname, 'hebcal');
  const stats = { i: [0, 0], d: [0, 0] };
  const mismatches = [];
  const reference = { i: {}, d: {} };
  fs.readdirSync(dir).filter(f => f.endsWith('.json')).forEach(f => {
    const israel = f.includes('_ion');
    JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).items
      .filter(it => it.category === 'parashat')
      .forEach(it => {
        const [y, m, d] = it.date.split('-').map(Number);
        reference[israel ? 'i' : 'd'][fixedDayFromDate(new Date(y, m - 1, d))] = toHebrew(it.title);
      });
  });
  ['i', 'd'].forEach(k => {
    const israel = k === 'i';
    const days = Object.keys(reference[k]).map(Number).sort((a, b) => a - b);
    // every Shabbat in the covered range: Hebcal's parasha, or none (festival Shabbat)
    for (let f = days[0]; f <= days[days.length - 1]; f += 7) {
      const ours = parashaForShabbat(f, israel);
      const ref = reference[k][f] || '';
      const ok = ref ? ours === ref : !!festivalShabbat(f, israel);
      stats[k][0] += 1;
      if (!ok) { stats[k][1] += 1; mismatches.push([k, f, hebrewDateFromFixed(f), ref, ours]); }
    }
  });
  console.log('Israel:   ', stats.i[0], 'Shabbatot checked,', stats.i[1], 'mismatches');
  console.log('Diaspora: ', stats.d[0], 'Shabbatot checked,', stats.d[1], 'mismatches');
  mismatches.slice(0, 20).forEach(m => console.log('  ', JSON.stringify(m)));
  // longest display strings
  const names = new Set();
  Object.values(reference.i).concat(Object.values(reference.d)).forEach(n => names.add(n));
  const longest = [...names].sort((a, b) => b.length - a.length).slice(0, 5);
  console.log('distinct readings:', names.size, '| longest:', longest);
}

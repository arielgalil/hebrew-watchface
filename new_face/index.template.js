(function () {
// Hebrew calendar and gematria helpers. Pure functions, no watch APIs,
// so the same code runs on the watch and in Node tests.

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

const HEBREW_MONTH_NAMES = {
  tishri: '\u05ea\u05e9\u05e8\u05d9',
  heshvan: '\u05d7\u05e9\u05d5\u05d5\u05df',
  kislev: '\u05db\u05e1\u05dc\u05d5',
  tevet: '\u05d8\u05d1\u05ea',
  shevat: '\u05e9\u05d1\u05d8',
  adar: '\u05d0\u05d3\u05e8',
  adar1: '\u05d0\u05d3\u05e8 \u05d0\u05f3',
  adar2: '\u05d0\u05d3\u05e8 \u05d1\u05f3',
  nisan: '\u05e0\u05d9\u05e1\u05df',
  iyar: '\u05d0\u05d9\u05d9\u05e8',
  sivan: '\u05e1\u05d9\u05d5\u05df',
  tammuz: '\u05ea\u05de\u05d5\u05d6',
  av: '\u05d0\u05d1',
  elul: '\u05d0\u05dc\u05d5\u05dc',
};

const HEBREW_WEEKDAY_NAMES = [
  '\u05d9\u05d5\u05dd \u05e8\u05d0\u05e9\u05d5\u05df', // Sunday
  '\u05d9\u05d5\u05dd \u05e9\u05e0\u05d9',
  '\u05d9\u05d5\u05dd \u05e9\u05dc\u05d9\u05e9\u05d9',
  '\u05d9\u05d5\u05dd \u05e8\u05d1\u05d9\u05e2\u05d9',
  '\u05d9\u05d5\u05dd \u05d7\u05de\u05d9\u05e9\u05d9',
  '\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9',
  '\u05e9\u05d1\u05ea',
];

// Gematria as a list of single Hebrew letters, with the 15/16 rule applied.
function gematriaLetters(number) {
  const out = [];
  let rest = number;
  while (rest >= 400) {
    out.push('\u05ea');
    rest -= 400;
  }
  const hundreds = { 100: '\u05e7', 200: '\u05e8', 300: '\u05e9' };
  const hundredsValue = Math.floor(rest / 100) * 100;
  if (hundredsValue) out.push(hundreds[hundredsValue]);
  rest -= hundredsValue;

  if (rest === 15) return out.concat(['\u05d8', '\u05d5']);
  if (rest === 16) return out.concat(['\u05d8', '\u05d6']);

  const tens = ['', '\u05d9', '\u05db', '\u05dc', '\u05de', '\u05e0', '\u05e1', '\u05e2', '\u05e4', '\u05e6'];
  const units = ['', '\u05d0', '\u05d1', '\u05d2', '\u05d3', '\u05d4', '\u05d5', '\u05d6', '\u05d7', '\u05d8'];
  const tensDigit = Math.floor(rest / 10);
  if (tensDigit) out.push(tens[tensDigit]);
  if (rest % 10) out.push(units[rest % 10]);
  return out;
}

// Adds the geresh (single letter) or gershayim (before the last letter).
function withGereshOrGershayim(letters) {
  if (letters.length === 1) return letters.concat(['\u05f3']);
  return letters.slice(0, -1).concat(['\u05f4'], letters.slice(-1));
}

function hebrewDayText(day) {
  return withGereshOrGershayim(gematriaLetters(day));
}

// Year without the thousands, e.g. 5786 -> \u05ea\u05e9\u05e4\u05f4\u05d5
function hebrewYearText(year) {
  return withGereshOrGershayim(gematriaLetters(year % 1000));
}

// Full line as a flat list of characters, read right to left: day/month/year, e.g. \u05d8\u05f4\u05d6/\u05d7\u05e9\u05d5\u05d5\u05df/\u05ea\u05e9\u05e4\u05f4\u05d6
function hebrewDateChars(hebrewDate) {
  return []
    .concat(hebrewDayText(hebrewDate.day))
    .concat(['/'])
    .concat(HEBREW_MONTH_NAMES[hebrewDate.month].split(''))
    .concat(['/'])
    .concat(hebrewYearText(hebrewDate.year));
}

function hebrewWeekdayChars(weekday) {
  return HEBREW_WEEKDAY_NAMES[weekday].split('');
}

// Day of week of a fixed day number, 0 = Sunday (1970-01-01, fixed 719163, was a Thursday).
function weekdayFromFixed(fixed) {
  return ((fixed % 7) + 7) % 7;
}

// The night belongs to the coming Hebrew day: 'אור ל-י״ח/חשוון/תשפ״ז'.
function nightDateChars(hebrewDate) {
  return 'אור ל-'.split('').concat(hebrewDateChars(hebrewDate));
}

// Fixed day number of a Hebrew date, or null if the month is not in that year.
function fixedFromHebrew(year, monthKey, day) {
  let fixed = hebrewNewYear(year);
  const months = hebrewMonths(year);
  for (let i = 0; i < months.length; i += 1) {
    if (months[i].key === monthKey) return fixed + day - 1;
    fixed += months[i].days;
  }
  return null;
}

// Holidays, fasts and memorial days as observed in Israel; '' for an ordinary day.
function holidayName(fixed) {
  const hd = hebrewDateFromFixed(fixed);
  const y = hd.year;
  const m = hd.month;
  const d = hd.day;
  const purimMonth = isHebrewLeapYear(y) ? 'adar2' : 'adar';
  const at = (month, day) => fixedFromHebrew(y, month, day);
  // A fast that falls on Shabbat moves by `shift` days.
  const fast = (month, day, shift) => {
    const f = at(month, day);
    return weekdayFromFixed(f) === 6 ? f + shift : f;
  };

  if (m === 'tishri') {
    if (d <= 2) return 'ראש השנה';
    if (fixed === fast('tishri', 3, 1)) return 'צום גדליה';
    if (d === 9) return 'ערב יום כיפור';
    if (d === 10) return 'יום כיפור';
    if (d === 14) return 'ערב סוכות';
    if (d === 15) return 'סוכות';
    if (d >= 16 && d <= 20) return 'חול המועד סוכות';
    if (d === 21) return 'הושענא רבה';
    if (d === 22) return 'שמחת תורה';
  }
  // Kislev and Tevet are in the same Hebrew year, so 25 Kislev of this year starts Chanukah.
  const chanukah = at('kislev', 25);
  // 'נר ג׳ של חנוכה': the candle lit on the night that starts this Hebrew day.
  if (fixed >= chanukah && fixed < chanukah + 8) {
    return 'נר ' + withGereshOrGershayim(gematriaLetters(fixed - chanukah + 1)).join('') + ' של חנוכה';
  }
  if (m === 'tevet' && d === 10) return 'עשרה בטבת';
  if (m === 'shevat' && d === 15) return 'ט״ו בשבט';
  if (m === 'adar1' && d === 14) return 'פורים קטן';
  // Ta'anit Esther on Shabbat moves back to Thursday.
  if (fixed === fast(purimMonth, 13, -2)) return 'תענית אסתר';
  if (m === purimMonth && d === 14) return 'פורים';
  if (m === purimMonth && d === 15) return 'שושן פורים';
  if (m === 'nisan') {
    if (d === 14) return 'ערב פסח';
    if (d === 15) return 'פסח';
    if (d >= 16 && d <= 20) return 'חול המועד פסח';
    if (d === 21) return 'שביעי של פסח';
  }
  // Yom HaShoah: 27 Nisan, moved off Friday (to Thursday) and Sunday (to Monday).
  let shoah = at('nisan', 27);
  if (weekdayFromFixed(shoah) === 5) shoah -= 1;
  else if (weekdayFromFixed(shoah) === 0) shoah += 1;
  if (fixed === shoah) return 'יום השואה';
  // Yom HaAtzmaut: 5 Iyar; Friday/Shabbat -> Thursday before, Monday -> Tuesday. Yom HaZikaron the day before.
  let atzmaut = at('iyar', 5);
  const aw = weekdayFromFixed(atzmaut);
  if (aw === 5) atzmaut -= 1;
  else if (aw === 6) atzmaut -= 2;
  else if (aw === 1) atzmaut += 1;
  if (fixed === atzmaut - 1) return 'יום הזיכרון';
  if (fixed === atzmaut) return 'יום העצמאות';
  if (m === 'iyar' && d === 18) return 'ל״ג בעומר';
  if (m === 'iyar' && d === 28) return 'יום ירושלים';
  if (m === 'sivan' && d === 5) return 'ערב שבועות';
  if (m === 'sivan' && d === 6) return 'שבועות';
  if (fixed === fast('tammuz', 17, 1)) return 'י״ז בתמוז';
  if (fixed === fast('av', 9, 1)) return 'תשעה באב';
  if (m === 'av' && d === 15) return 'ט״ו באב';
  if (m === 'elul' && d === 29) return 'ערב ראש השנה';
  // Rosh Chodesh with the month it opens (day 30 belongs to the next month): 'ראש חודש כסלו'.
  if (d === 30) return 'ראש חודש ' + HEBREW_MONTH_NAMES[hebrewDateFromFixed(fixed + 1).month];
  if (d === 1 && m !== 'tishri') return 'ראש חודש ' + HEBREW_MONTH_NAMES[m];
  return '';
}

// Sunrise and sunset (minutes after local midnight) by the NOAA sunrise equation, accurate to a
// minute or two. `offsetMinutes` is the local offset from UTC (120 in winter, 180 in summer time
// in Israel): the face measures it from the system clock, so the times follow the clock change.
// `elevation` (metres) lowers the horizon: seen from higher up the sun rises earlier and sets later.
function computeSunTimes(date, lat, lon, offsetMinutes, elevation) {
  const rad = Math.PI / 180;
  const jd = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12) / 86400000 + 2440587.5;
  const n = Math.round(jd - 2451545.0 + 0.0008);
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const transit = 2451545.0 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const sinDec = Math.sin(lambda * rad) * Math.sin(23.4397 * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const horizon = -0.833 - 0.0347 * Math.sqrt(Math.max(0, elevation || 0));
  const cosW = (Math.sin(horizon * rad) - Math.sin(lat * rad) * sinDec) / (Math.cos(lat * rad) * cosDec);
  const w = Math.acos(Math.max(-1, Math.min(1, cosW))) / rad;
  const toMinutes = j => {
    const t = new Date((j - 2440587.5) * 86400000);
    return ((Math.round(t.getTime() / 60000) + offsetMinutes) % 1440 + 1440) % 1440;
  };
  return { rise: toMinutes(transit - w / 360), set: toMinutes(transit + w / 360) };
}

// Sun times the Zepp app synced for the phone's location: { rise, set } for `dayIndex` (0 = today), or null.
// After a clock change the hours can stay on the old offset, so they are compared with `expected` (our
// own computation): a shift of a whole hour, within 10 minutes, is that error and is taken off. Solar noon
// is compared because the latitude cancels out. Any other difference means the phone is elsewhere: kept as is.
function syncedSunTimes(weather, dayIndex, expected) {
  try {
    const item = weather.getForecastWeather().tideData.data[dayIndex];
    let rise = item.sunrise.hour * 60 + item.sunrise.minute;
    let set = item.sunset.hour * 60 + item.sunset.minute;
    if (!(rise > 0 && set > rise && set < 1440)) return null;
    const shift = (rise + set - expected.rise - expected.set) / 2;
    const hours = Math.abs(Math.abs(shift) - 60) <= 10 ? (shift > 0 ? 60 : -60) : 0;
    rise -= hours;
    set -= hours;
    return { rise: rise, set: set };
  } catch (e) {
    return null; // nothing synced yet
  }
}

// Minutes before sunset for candle lighting, and after sunset for the end of Shabbat/holiday.
// Common Israeli practice outside Jerusalem (Jerusalem lights 40 minutes before).
const CANDLE_MINUTES = 20;
const HAVDALAH_MINUTES = 40;

// Days of rest in Israel: Shabbat and the Yom Tov days (one day each, two of Rosh Hashana).
function isRestDay(fixed) {
  if (weekdayFromFixed(fixed) === 6) return true;
  const hd = hebrewDateFromFixed(fixed);
  const m = hd.month;
  const d = hd.day;
  return (m === 'tishri' && (d === 1 || d === 2 || d === 10 || d === 15 || d === 22)) ||
    (m === 'nisan' && (d === 15 || d === 21)) || (m === 'sivan' && d === 6);
}

// Omer day (1-49) of a fixed day, counted from 16 Nisan, or 0 outside the count.
function omerDay(fixed) {
  const year = hebrewDateFromFixed(fixed).year;
  const day = fixed - fixedFromHebrew(year, 'nisan', 16) + 1;
  return day >= 1 && day <= 49 ? day : 0;
}

function clockText(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

// A line read right to left; numbers keep their left-to-right order on screen.
function rtlChars(text) {
  const out = [];
  text.split(/(\d[\d:]*)/).forEach((part, i) => {
    const chars = part.split('');
    out.push.apply(out, i % 2 ? chars.reverse() : chars);
  });
  return out;
}

// The two lines under the dashboard for the Hebrew day `fixed`, whose sunset is `sunset`
// (minutes). Line a: holiday, else the omer. Line b: candle lighting / end of Shabbat or
// holiday, else the omer when line a holds a holiday. Candle lighting appears only on the civil day
// of the eve (`eveDay`), not already on the evening before it, when the Hebrew day has already
// turned to the eve (Thursday night is 'אור לערב שבת', but the candles are lit on Friday).
function infoLines(fixed, sunset, eveDay) {
  const holiday = holidayName(fixed);
  const omer = omerDay(fixed);
  const omerText = omer ? withGereshOrGershayim(gematriaLetters(omer)).join('') + ' לעומר' : '';
  const restToday = isRestDay(fixed);
  const restNext = isRestDay(fixed + 1);
  let times = '';
  if (restNext && !restToday) times = eveDay ? 'הדלקת נרות ' + clockText(sunset - CANDLE_MINUTES) : '';
  else if (restNext) times = 'הדלקת נרות ' + clockText(sunset + HAVDALAH_MINUTES); // after nightfall
  else if (restToday) {
    times = (weekdayFromFixed(fixed) === 6 ? 'צאת שבת ' : 'צאת החג ') + clockText(sunset + HAVDALAH_MINUTES);
  }
  // 'ל״ג בעומר' already says the count.
  const showOmer = omerText && holiday !== 'ל״ג בעומר';
  const a = holiday || (showOmer ? omerText : '');
  const b = times || (holiday && showOmer ? omerText : '');
  return { a: a, b: b };
}

// Calendar date (noon, local) of a fixed day number, for computing its sun times.
function dateFromFixed(fixed) {
  const utc = new Date((fixed - UNIX_EPOCH_RD) * 86400000);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), 12);
}

// What the Hebrew lines show now: from sunset the next Hebrew day, as 'אור ל...' until sunrise.
function hebrewDayNow(now, minutes, sun) {
  const afterSunset = minutes >= sun.set;
  const fixed = fixedDayFromDate(now) + (afterSunset ? 1 : 0);
  return { fixed: fixed, night: afterSunset || minutes < sun.rise };
}

// Image name for one Hebrew character, e.g. ('\u05d0', 'h_') -> 'h_5d0.png'.
function glyphFileName(ch, prefix) {
  return prefix + ch.charCodeAt(0).toString(16) + '.png';
}

// Places a right-to-left line of glyph images centred on centerX. Each glyph takes its own
// advance width (from the font), words are separated by font.wordGap.
// Returns [{ ch, src, x }] for every visible glyph, first character first.
function layoutRtlLine(chars, centerX, font, prefix) {
  const widths = chars.map(ch => (ch === ' ' ? font.wordGap : font.advances[ch]));
  const total = widths.reduce((sum, w) => sum + w, 0) + font.tracking * (chars.length - 1);
  let right = centerX + total / 2;
  const items = [];
  chars.forEach((ch, i) => {
    const left = right - widths[i];
    if (ch !== ' ') {
      items.push({ ch: ch, src: glyphFileName(ch, prefix), x: left + widths[i] / 2 - font.imageW / 2 });
    }
    right = left - font.tracking;
  });
  return items;
}

// ---- Generated by tools/build_v3.py: layout and glyph metrics ------------

const L = __LAYOUT__;
const DATE_FONT = __DATE_FONT__;
const WEEKDAY_FONT = __WEEKDAY_FONT__;
const HOLIDAY_FONT = __HOLIDAY_FONT__;
const TIMES_FONT = __TIMES_FONT__;
const DEFAULT_LAT = 31.778; // Jerusalem, until the watch has given its own position
const DEFAULT_LON = 35.235;
const LOCATION_MAX_AGE = 6 * 3600 * 1000; // a fix is refreshed after 6 hours
const LOCATION_RETRY = 15 * 60 * 1000; // after a failed search, try again on a wake-up 15 minutes later
const LOCATION_SEARCH = 90 * 1000; // the GPS stays on at most 90 seconds per search

function digitNames(prefix) {
  const out = [];
  for (let i = 0; i < 10; i += 1) out.push(prefix + i + '.png');
  return out;
}

// ---- Watch face ----------------------------------------------------------

try {
  ((() => {
    const __$$app$$__ = __$$hmAppManager$$__.currentApp;
    const __$$module$$__ = __$$app$$__.current;
    let timeSensor = null;
    const weekdaySlots = [];
    const yearSlots = [];
    const hebrewSlots = [];
    const aodWeekdaySlots = [];
    const aodYearSlots = [];
    const aodHebrewSlots = [];
    const holidaySlots = [];
    const aodHolidaySlots = [];
    const timesSlots = [];
    const aodTimesSlots = [];
    const stepSlots = [];
    let stepSensor = null;
    let shownDayKey = null; // fixed day + day/night of what the Hebrew lines show
    let sunCache = null;
    // Where the watch is: last GPS fix and barometer height, kept between restarts of the face.
    let place = { lat: DEFAULT_LAT, lon: DEFAULT_LON, alt: 0, time: 0 };
    let sensors = null; // the @zos/sensor module, null where the firmware does not offer it
    let storage = null;
    let gps = null;
    let gpsTimer = null;
    let lastSearch = 0;
    let placeMark = null;
    let weather = null;
    const NORMAL = hmUI.show_level.ONLY_NORMAL;
    const AOD = hmUI.show_level.ONLY_AOD;

    function img(x, y, w, h, src, showLevel) {
      return hmUI.createWidget(hmUI.widget.IMG, { x: x, y: y, w: w, h: h, src: src, show_level: showLevel });
    }

    // Dynamic image: a full-screen canvas, the image placed with pos_x/pos_y (as in the other faces).
    function canvasImg(posX, posY, src, showLevel) {
      const slot = hmUI.createWidget(hmUI.widget.IMG, {
        x: 0,
        y: 0,
        w: 466,
        h: 466,
        center_x: 0,
        center_y: posY,
        pos_x: posX,
        pos_y: posY,
        angle: 0,
        src: src,
        show_level: showLevel,
      });
      slot.setProperty(hmUI.prop.VISIBLE, false);
      return slot;
    }

    function createGlyphSlots(slots, count, y, src, showLevel) {
      for (let i = 0; i < count; i += 1) slots.push(canvasImg(0, y, src, showLevel));
    }

    function renderLine(slots, chars, font, prefix) {
      const items = layoutRtlLine(chars, L.CENTER_X, font, prefix);
      slots.forEach((slot, i) => {
        const item = items[i];
        if (item) {
          slot.setProperty(hmUI.prop.POS_X, Math.round(item.x));
          slot.setProperty(hmUI.prop.SRC, item.src);
          slot.setProperty(hmUI.prop.VISIBLE, true);
        } else {
          slot.setProperty(hmUI.prop.VISIBLE, false);
        }
      });
    }

    // Steps with a thousands comma, e.g. 8,432: digits in fixed cells, a narrow comma.
    function renderSteps(value) {
      const digits = String(Math.max(0, Math.floor(value || 0))).split('').reverse();
      const chars = [];
      digits.forEach((d, i) => {
        if (i > 0 && i % 3 === 0) chars.push('comma');
        chars.push(d);
      });
      chars.reverse();
      let x = L.STEPS_X;
      stepSlots.forEach((slot, i) => {
        const ch = chars[i];
        if (ch === undefined) {
          slot.setProperty(hmUI.prop.VISIBLE, false);
          return;
        }
        slot.setProperty(hmUI.prop.POS_X, x);
        slot.setProperty(hmUI.prop.SRC, ch === 'comma' ? 'sm_comma.png' : 'sm_' + ch + '.png');
        slot.setProperty(hmUI.prop.VISIBLE, true);
        x += ch === 'comma' ? L.COMMA_W : L.SMALL_W;
      });
    }

    function updateYear() {
      const year = String(new Date().getFullYear());
      year.split('').forEach((d, i) => {
        yearSlots[i].setProperty(hmUI.prop.SRC, 'sd_' + d + '.png');
        aodYearSlots[i].setProperty(hmUI.prop.SRC, 'as_' + d + '.png');
      });
    }

    // Local time as the system clock shows it, and its offset from UTC measured against the real
    // UTC time, so a stale time zone in the runtime cannot shift anything by an hour.
    function localClock() {
      const now = new Date();
      let minutes = now.getHours() * 60 + now.getMinutes();
      let offset = -now.getTimezoneOffset();
      if (timeSensor && typeof timeSensor.hour === 'number') {
        minutes = timeSensor.hour * 60 + timeSensor.minute;
        const utc = now.getUTCHours() * 60 + now.getUTCMinutes();
        offset = Math.round((((minutes - utc + 720) % 1440 + 1440) % 1440 - 720) / 30) * 30;
      }
      return { now: now, minutes: minutes, offset: offset };
    }

    // A coordinate from the GPS: a decimal number, or degrees/minutes/seconds on some firmware.
    function toDegrees(value) {
      if (value && typeof value === 'object') {
        const deg = Number(value.degrees) + Number(value.minutes) / 60 + Number(value.seconds) / 3600;
        return value.direction === 'S' || value.direction === 'W' ? -deg : deg;
      }
      return Number(value);
    }

    function readAltitude() {
      try {
        const alt = Number(new sensors.Barometer().getAltitude());
        if (alt > -500 && alt < 9000) return alt;
      } catch (e) {
        // no barometer: keep the last height
      }
      return place.alt;
    }

    // Takes the new position into use: every time on the screen is computed from it.
    function applyPlace() {
      sunCache = null;
      updateHebrewDate(true);
    }

    function loadPlace() {
      try {
        weather = hmSensor.createSensor(hmSensor.id.WEATHER);
      } catch (e) {
        weather = null;
      }
      try {
        sensors = __$$R$$__('@zos/sensor');
      } catch (e) {
        sensors = null;
      }
      try {
        storage = new (__$$R$$__('@zos/storage').LocalStorage)();
        const saved = JSON.parse(storage.getItem('place', 'null'));
        if (saved && saved.time) place = saved;
      } catch (e) {
        storage = null;
      }
    }

    function stopSearch() {
      if (gpsTimer) {
        timer.stopTimer(gpsTimer);
        gpsTimer = null;
      }
      if (gps) {
        try {
          gps.stop();
        } catch (e) {
          // already stopped
        }
        gps = null;
      }
    }

    function onGpsChange() {
      if (!gps || gps.getStatus() !== 'A') return;
      const lat = toDegrees(gps.getLatitude());
      const lon = toDegrees(gps.getLongitude());
      if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180) || (lat === 0 && lon === 0)) return;
      place = { lat: lat, lon: lon, alt: readAltitude(), time: Date.now() };
      stopSearch();
      try {
        if (storage) storage.setItem('place', JSON.stringify(place));
      } catch (e) {
        // the position stays in memory
      }
      applyPlace();
    }

    // On a wake-up: looks for a position if the last one is old, for a limited time, to spare the battery.
    function refreshPlace() {
      if (!sensors) return;
      const now = Date.now();
      if (gps || now - place.time < LOCATION_MAX_AGE || now - lastSearch < LOCATION_RETRY) return;
      lastSearch = now;
      try {
        gps = new sensors.Geolocation();
        gps.onChange(onGpsChange);
        gps.start();
        gpsTimer = timer.createTimer(LOCATION_SEARCH, LOCATION_SEARCH, stopSearch, {});
      } catch (e) {
        gps = null;
      }
    }

    // Sun times of a fixed day, best source first: a recent GPS fix with the barometer height, then the
    // times synced from the Zepp app (the GPS keeps searching in the background), then the last GPS fix
    // however old, and only then Jerusalem.
    function sunTimesFor(fixed, offset) {
      if (sunCache && sunCache.day === fixed && sunCache.offset === offset) return sunCache.times;
      const computed = computeSunTimes(dateFromFixed(fixed), place.lat, place.lon, offset, place.alt);
      const fresh = place.time && Date.now() - place.time < LOCATION_MAX_AGE;
      const fromSync = !fresh && weather ?
        syncedSunTimes(weather, fixed - fixedDayFromDate(new Date()), computed) : null;
      sunCache = { day: fixed, offset: offset, times: fromSync || computed };
      if (placeMark) {
        placeMark.setProperty(hmUI.prop.SRC, fromSync ? 'place_sync.png' : place.time ? 'place_on.png' : 'place_off.png');
      }
      return sunCache.times;
    }

    // Redraws the Hebrew lines when the Hebrew day or day/night changed (or when forced).
    function updateHebrewDate(force) {
      const clock = localClock();
      const now = clock.now;
      const today = fixedDayFromDate(now);
      const state = hebrewDayNow(now, clock.minutes, sunTimesFor(today, clock.offset));
      const key = state.fixed + (state.night ? 'n' : 'd');
      if (!force && key === shownDayKey) return;
      shownDayKey = key;
      // The weekday stays the civil one; only the Hebrew date moves on at sunset.
      const weekdayChars = hebrewWeekdayChars(now.getDay());
      const hebrewDate = hebrewDateFromFixed(state.fixed);
      const dateChars = state.night ? nightDateChars(hebrewDate) : hebrewDateChars(hebrewDate);
      const info = infoLines(state.fixed, sunTimesFor(state.fixed, clock.offset).set, state.fixed === today);
      // No candle lighting or end of Shabbat to show: the next sun event instead, sunset from sunrise to
      // sunset, sunrise from sunset to sunrise ('שקיעה 16:52').
      let timesText = info.b;
      if (!timesText) {
        const sun = sunTimesFor(today, clock.offset);
        if (clock.minutes < sun.rise) timesText = '\u05d6\u05e8\u05d9\u05d7\u05d4 ' + clockText(sun.rise);
        else if (clock.minutes < sun.set) timesText = '\u05e9\u05e7\u05d9\u05e2\u05d4 ' + clockText(sun.set);
        else timesText = '\u05d6\u05e8\u05d9\u05d7\u05d4 ' + clockText(sunTimesFor(today + 1, clock.offset).rise);
      }
      const holidayChars = rtlChars(info.a);
      const timesChars = rtlChars(timesText);
      renderLine(weekdaySlots, weekdayChars, WEEKDAY_FONT, 'w_');
      renderLine(hebrewSlots, dateChars, DATE_FONT, 'h_');
      renderLine(holidaySlots, holidayChars, HOLIDAY_FONT, 'e_');
      renderLine(timesSlots, timesChars, TIMES_FONT, 'n_');
      renderLine(aodWeekdaySlots, weekdayChars, WEEKDAY_FONT, 'aw_');
      renderLine(aodHebrewSlots, dateChars, DATE_FONT, 'ah_');
      renderLine(aodHolidaySlots, holidayChars, HOLIDAY_FONT, 'ae_');
      renderLine(aodTimesSlots, timesChars, TIMES_FONT, 'an_');
    }

    // Time (IMG_TIME): every element is followed by `space`, so minutes start after
    // two digits, the colon and their spaces.
    function createTime(digitPrefix, colon, showLevel) {
      const digits = digitNames(digitPrefix);
      hmUI.createWidget(hmUI.widget.IMG_TIME, {
        hour_startX: L.TIME_X,
        hour_startY: L.TIME_Y,
        hour_array: digits,
        hour_zero: 1,
        hour_space: L.TIME_SPACE,
        hour_angle: 0,
        hour_unit_sc: colon,
        hour_unit_tc: colon,
        hour_unit_en: colon,
        hour_align: hmUI.align.LEFT,
        minute_startX: L.MINUTE_X,
        minute_startY: L.TIME_Y,
        minute_array: digits,
        minute_zero: 1,
        minute_space: L.TIME_SPACE,
        minute_angle: 0,
        minute_align: hmUI.align.LEFT,
        show_level: showLevel,
      });
    }

    // Gregorian date DD/MM/YYYY: day and month from IMG_DATE, slashes and year as images.
    function createDate(digitPrefix, slash, years, showLevel) {
      const digits = digitNames(digitPrefix);
      hmUI.createWidget(hmUI.widget.IMG_DATE, {
        month_startX: L.MONTH_X,
        month_startY: L.DATE_Y,
        month_sc_array: digits,
        month_tc_array: digits,
        month_en_array: digits,
        month_zero: 1,
        month_space: L.DATE_SPACE,
        month_align: hmUI.align.LEFT,
        month_is_character: false,
        day_startX: L.DAY_X,
        day_startY: L.DATE_Y,
        day_sc_array: digits,
        day_tc_array: digits,
        day_en_array: digits,
        day_zero: 1,
        day_space: L.DATE_SPACE,
        day_align: hmUI.align.LEFT,
        day_is_character: false,
        show_level: showLevel,
      });
      L.SLASH_XS.forEach(x => img(x, L.DATE_Y, L.SLASH_W, L.DATE_H, slash, showLevel));
      L.YEAR_XS.forEach(x => years.push(img(x, L.DATE_Y, L.DATE_W, L.DATE_H, digitPrefix + '0.png', showLevel)));
    }

    function smallValue(x, y, type, extra) {
      const props = {
        x: x,
        y: y,
        font_array: digitNames('sm_'),
        padding: false,
        h_space: 0,
        align_h: hmUI.align.LEFT,
        type: type,
        show_level: NORMAL,
      };
      Object.keys(extra).forEach(k => { props[k] = extra[k]; });
      hmUI.createWidget(hmUI.widget.TEXT_IMG, props);
    }

    __$$module$$__.module = DeviceRuntimeCore.WatchFace({
      init_view() {
        img(0, 0, 466, 466, 'bg.png', NORMAL);

        // ---- Normal screen ----
        createGlyphSlots(weekdaySlots, L.WEEKDAY_SLOTS, L.WEEKDAY_Y, 'w_5d9.png', NORMAL);
        createGlyphSlots(hebrewSlots, L.HEBREW_SLOTS, L.HEBREW_Y, 'h_5d0.png', NORMAL);
        createTime('time_', 'colon.png', NORMAL);
        createDate('sd_', 'slash.png', yearSlots, NORMAL);

        // Status row: battery on the left, steps on the right.
        // A small mark under the 12 o'clock tick: gold = GPS of the watch, blue = synced from Zepp, grey = Jerusalem.
        placeMark = img(L.PLACE_X, L.PLACE_Y, L.PLACE_SIZE, L.PLACE_SIZE, 'place_off.png', NORMAL);
        L.ICONS.forEach(icon => img(icon[1], icon[2], L.ICON_SIZE, L.ICON_SIZE, icon[0], NORMAL));
        smallValue(L.BATTERY_X, L.ROW_Y, hmUI.data_type.BATTERY,
          { unit_sc: 'pct.png', unit_tc: 'pct.png', unit_en: 'pct.png' });
        for (let i = 0; i < L.STEP_SLOTS; i += 1) {
          stepSlots.push(canvasImg(L.STEPS_X + i * L.SMALL_W, L.ROW_Y, 'sm_0.png', NORMAL));
        }
        stepSensor = hmSensor.createSensor(hmSensor.id.STEP);
        renderSteps(stepSensor.current);
        stepSensor.addEventListener(hmSensor.event.CHANGE, function() {
          renderSteps(stepSensor.current);
        });

        createGlyphSlots(holidaySlots, L.HOLIDAY_SLOTS, L.HOLIDAY_Y, 'e_5d7.png', NORMAL);
        createGlyphSlots(timesSlots, L.TIMES_SLOTS, L.TIMES_Y, 'n_5d4.png', NORMAL);

        // Seconds: a dot circling on the minute ring. TIME_POINTER with only second_* set,
        // as in the GTR 4 faces of the store; the image is rotated about (posX, posY).
        hmUI.createWidget(hmUI.widget.TIME_POINTER, {
          second_path: 'sec_dot.png',
          second_centerX: L.CENTER_X,
          second_centerY: L.CENTER_X,
          second_posX: L.SEC_POS_X,
          second_posY: L.SEC_POS_Y,
          show_level: NORMAL,
        });

        // Tap areas (transparent buttons, after the other normal-screen widgets so they are on top):
        // the date block opens the calendar, the time opens the timers (countdown) app.
        L.SHORTCUTS.forEach(s => {
          hmUI.createWidget(hmUI.widget.BUTTON, {
            x: s[0],
            y: s[1],
            w: s[2],
            h: s[3],
            text: '',
            press_src: 'transparent.png',
            normal_src: 'transparent.png',
            click_func: () => {
              hmApp.startApp({ url: s[4], native: true });
            },
            show_level: NORMAL,
          });
        });

        // ---- Always-on (AOD): Hebrew lines, time, date and holiday, dimmed ----
        createGlyphSlots(aodWeekdaySlots, L.WEEKDAY_SLOTS, L.WEEKDAY_Y, 'aw_5d9.png', AOD);
        createGlyphSlots(aodHebrewSlots, L.HEBREW_SLOTS, L.HEBREW_Y, 'ah_5d0.png', AOD);
        createTime('at_', 'ac.png', AOD);
        createDate('as_', 'asl.png', aodYearSlots, AOD);
        createGlyphSlots(aodHolidaySlots, L.HOLIDAY_SLOTS, L.HOLIDAY_Y, 'ae_5d7.png', AOD);
        createGlyphSlots(aodTimesSlots, L.TIMES_SLOTS, L.TIMES_Y, 'an_5d4.png', AOD);

        // Refresh on day change, every minute (cheap unless sunset/sunrise passed) and on wake.
        if (!timeSensor) timeSensor = hmSensor.createSensor(hmSensor.id.TIME);
        timeSensor.addEventListener(timeSensor.event.DAYCHANGE, function() {
          updateHebrewDate(true);
          updateYear();
        });
        if (timeSensor.event.MINUTEEND !== undefined) {
          timeSensor.addEventListener(timeSensor.event.MINUTEEND, function() {
            updateHebrewDate(false);
          });
        }
        hmUI.createWidget(hmUI.widget.WIDGET_DELEGATE, {
          resume_call: function() {
            refreshPlace();
            sunCache = null; // a sync may have brought new times
            updateHebrewDate(true);
            updateYear();
          },
          pause_call: function() {
            stopSearch();
          },
        });
      },
      onInit() {},
      build() {
        this.init_view();
        loadPlace();
        updateHebrewDate(true);
        updateYear();
        refreshPlace();
      },
      onDestroy() {
        stopSearch();
      },
    });
  })());
} catch (e) {
  console.log('Hebrew date face error', e);
}

})();

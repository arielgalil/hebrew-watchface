// Checks every day in a range: the Hebrew lines fit their slots and stay inside the round screen.
// Usage: node check_dates.cjs <index.js> [fromYear] [toYear]
'use strict';
const fs = require('fs');
const vm = require('vm');

const [, , file, from = '2024', to = '2035'] = process.argv;
const src = fs.readFileSync(file, 'utf8');
const body = src.slice(src.indexOf('\n') + 1, src.indexOf('// ---- Watch face'));
const ctx = { Math, Date, String, Object, Array, Error, JSON };
vm.createContext(ctx);
vm.runInContext(body + '\nthis.api = { hebrewDateFromFixed, fixedDayFromDate, hebrewDateChars, hebrewWeekdayChars, nightDateChars, weekdayFromFixed, holidayName, computeSunTimes, infoLines, rtlChars, dateFromFixed, layoutRtlLine, L, DATE_FONT, WEEKDAY_FONT, HOLIDAY_FONT, TIMES_FONT };', ctx);
const api = ctx.api;

// Visible width of the round screen at height y.
function halfChord(y) {
  const r = api.L.SAFE_R || 233;
  const dy = Math.abs(233 - y);
  return Math.sqrt(Math.max(0, r * r - dy * dy));
}

function check(chars, font, y, h, slots, label, worst, maxHalf) {
  const items = api.layoutRtlLine(chars, api.L.CENTER_X, font, 'x_');
  const left = Math.min(...items.map(i => i.x));
  const right = Math.max(...items.map(i => i.x)) + font.imageW;
  const half = Math.min(halfChord(y), halfChord(y + h), maxHalf || 233);
  const margin = Math.min(left - (233 - half), (233 + half) - right);
  if (!worst[label] || margin < worst[label].margin) worst[label] = { margin: Math.round(margin), text: chars.join(''), width: Math.round(right - left) };
  if (items.length > slots) throw new Error(label + ' needs ' + items.length + ' slots: ' + chars.join(''));
}

const worst = {};
let days = 0;
for (let d = new Date(Number(from), 0, 1); d.getFullYear() <= Number(to); d.setDate(d.getDate() + 1)) {
  const hd = api.hebrewDateFromFixed(api.fixedDayFromDate(d));
  check(api.hebrewDateChars(hd), api.DATE_FONT, api.L.HEBREW_Y, 40, api.L.HEBREW_SLOTS, 'date', worst);
  check(api.hebrewWeekdayChars(d.getDay()), api.WEEKDAY_FONT, api.L.WEEKDAY_Y, 34, api.L.WEEKDAY_SLOTS, 'weekday', worst);
  const fixed = api.fixedDayFromDate(d);
  if (api.weekdayFromFixed(fixed) !== d.getDay()) throw new Error('weekdayFromFixed wrong on ' + d.toDateString());
  check(api.nightDateChars(hd), api.DATE_FONT, api.L.HEBREW_Y, 40, api.L.HEBREW_SLOTS, 'night date', worst);
  const info = api.infoLines(fixed, api.computeSunTimes(api.dateFromFixed(fixed), 31.778, 35.235, -api.dateFromFixed(fixed).getTimezoneOffset()).set, true);
  if (info.a) check(api.rtlChars(info.a), api.HOLIDAY_FONT, api.L.HOLIDAY_Y, 30, api.L.HOLIDAY_SLOTS, 'line a', worst, api.L.INFO_HALF);
  if (info.b) check(api.rtlChars(info.b), api.TIMES_FONT, api.L.TIMES_Y, 28, api.L.TIMES_SLOTS, 'line b', worst, api.L.INFO_HALF);
  days += 1;
}
// Holidays of one Gregorian year, for checking against a calendar.
const listYear = Number(process.env.LIST_YEAR || 0);
if (listYear) {
  const names = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  for (let d = new Date(listYear, 0, 1); d.getFullYear() === listYear; d.setDate(d.getDate() + 1)) {
    const fx = api.fixedDayFromDate(d);
    const info = api.infoLines(fx, api.computeSunTimes(d, 31.778, 35.235, -d.getTimezoneOffset()).set, true);
    const name = [info.a, info.b].filter(Boolean).join(' | ');
    if (name) console.log(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), names[d.getDay()], name);
  }
  const sun = api.computeSunTimes(new Date(listYear, 9, 28), 31.778, 35.235, -new Date(listYear, 9, 28).getTimezoneOffset());
  const f = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  console.log('Jerusalem ' + listYear + '-10-28 sunrise ' + f(sun.rise) + ' sunset ' + f(sun.set));
}
console.log(days + ' days checked');
console.log(JSON.stringify(worst, null, 1));

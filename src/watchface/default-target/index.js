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

// Image name for one Hebrew character, e.g. '\u05d0' -> 'h_5d0.png'.
function glyphFileName(ch) {
  return 'h_' + ch.charCodeAt(0).toString(16) + '.png';
}

// Places a right-to-left line of glyph images centred on centerX. Each glyph takes its own
// advance width (from the font), words are separated by wordGap.
// Returns [{ ch, src, x }] for every visible glyph, first character first.
function layoutRtlLine(chars, centerX, advances, imageWidth, tracking, wordGap) {
  const widths = chars.map(ch => (ch === ' ' ? wordGap : advances[ch]));
  const total = widths.reduce((sum, w) => sum + w, 0) + tracking * (chars.length - 1);
  let right = centerX + total / 2;
  const items = [];
  chars.forEach((ch, i) => {
    const left = right - widths[i];
    if (ch !== ' ') {
      items.push({ ch: ch, src: glyphFileName(ch), x: left + widths[i] / 2 - imageWidth / 2 });
    }
    right = left - tracking;
  });
  return items;
}

// Advance width in pixels of every Hebrew glyph image (generated by build.py).
const HEBREW_ADVANCES = {"\u05d0": 23.0, "\u05d1": 20.2, "\u05d2": 14.0, "\u05d3": 19.4, "\u05d4": 22.4, "\u05d5": 11.5, "\u05d6": 12.6, "\u05d7": 23.4, "\u05d8": 22.4, "\u05d9": 11.3, "\u05da": 19.4, "\u05db": 18.0, "\u05dc": 18.9, "\u05dd": 23.9, "\u05de": 23.9, "\u05df": 12.1, "\u05e0": 13.7, "\u05e1": 23.1, "\u05e2": 21.4, "\u05e3": 22.2, "\u05e4": 21.4, "\u05e5": 20.0, "\u05e6": 20.1, "\u05e7": 22.2, "\u05e8": 18.4, "\u05e9": 26.8, "\u05ea": 24.5, "\u05f3": 7.6, "\u05f4": 15.1, "/": 14.1};

// ---- Watch face ----------------------------------------------------------

const CENTER_X = 233;
const LINE_IMAGE_W = 32; // width of every Hebrew glyph image
const LINE_TRACKING = 0; // extra space between letters
const WORD_GAP = 22; // space between words
const WEEKDAY_Y = 230;
const HEBREW_Y = 276;
const HEBREW_SLOTS = 18;
const WEEKDAY_SLOTS = 10; // longest name: \u05d9\u05d5\u05dd \u05e9\u05dc\u05d9\u05e9\u05d9
const TIME_Y = 78;
const DATE_Y = 184;
const SUN_Y = 332;
const INFO_Y = 372;
const ALT_Y = 408;
const COMPASS_CX = 233;
const COMPASS_CY = 42;
const DATE_LEFT = 105; // x of the day group; DD/MM/YY is centred on CENTER_X
const STEP_X = 275; // steps: digit-by-digit, with a thousands comma
const STEP_SLOTS = 8;
const SMALL_DIGITS = ['sm_0.png', 'sm_1.png', 'sm_2.png', 'sm_3.png', 'sm_4.png',
  'sm_5.png', 'sm_6.png', 'sm_7.png', 'sm_8.png', 'sm_9.png'];

try {
  ((() => {
    const __$$app$$__ = __$$hmAppManager$$__.currentApp;
    const __$$module$$__ = __$$app$$__.current;
    let timeSensor = null;
    let compass = null;
    let compassNeedle = null;
    let compassTimer = null;
    let needleCalibrated = null;
    const screenType = hmSetting.getScreenType();
    const weekdaySlots = [];
    const yearSlots = [];
    const hebrewSlots = [];
    const aodWeekdaySlots = [];
    const aodYearSlots = [];
    const aodHebrewSlots = [];
    const stepSlots = [];
    let stepSensor = null;

    // prefix 'a' selects the always-on (grey) images; showLevel keeps each pool on its own screen.
    function createGlyphSlots(slots, count, y, prefix, showLevel) {
      for (let i = 0; i < count; i += 1) {
        // Same pattern as the other faces' dynamic text: a full-screen canvas, the image placed with pos_x/pos_y.
        const slot = hmUI.createWidget(hmUI.widget.IMG, {
          x: 0,
          y: 0,
          w: 466,
          h: 466,
          center_x: 0,
          center_y: y,
          pos_x: 0,
          pos_y: y,
          angle: 0,
          src: prefix + 'h_5d0.png',
          show_level: showLevel,
        });
        slot.setProperty(hmUI.prop.VISIBLE, false);
        slots.push(slot);
      }
    }

    function renderLine(slots, chars, prefix) {
      const items = layoutRtlLine(chars, CENTER_X, HEBREW_ADVANCES, LINE_IMAGE_W, LINE_TRACKING, WORD_GAP);
      slots.forEach((slot, i) => {
        const item = items[i];
        if (item) {
          slot.setProperty(hmUI.prop.POS_X, Math.round(item.x));
          slot.setProperty(hmUI.prop.SRC, prefix + item.src);
          slot.setProperty(hmUI.prop.VISIBLE, true);
        } else {
          slot.setProperty(hmUI.prop.VISIBLE, false);
        }
      });
    }

    // Rotates the needle and shows the heading in degrees. Grey needle = not calibrated.
    function applyCompass(rawAngle, calibrated) {
      const angle = parseInt(rawAngle);
      const valid = rawAngle !== 'INVALID' && !isNaN(angle);
      compassNeedle.setProperty(hmUI.prop.ANGLE, valid ? -angle : 0);
      if (calibrated !== needleCalibrated) {
        compassNeedle.setProperty(hmUI.prop.SRC, calibrated ? 'compass_needle.png' : 'compass_needle_gray.png');
        needleCalibrated = calibrated;
      }
    }

    function pollCompass() {
      if (compass) applyCompass(compass.direction_angle, !!compass.calibration_status);
    }

    // The event normally drives the needle; the timer is a fallback while the screen is on.
    function startCompass() {
      if (!compass) return;
      compass.start();
      if (!compassTimer) compassTimer = timer.createTimer(0, 400, pollCompass, {});
    }

    function stopCompass() {
      if (compass) compass.stop();
      if (compassTimer) {
        timer.stopTimer(compassTimer);
        compassTimer = null;
      }
    }

    // Steps shown with a thousands comma, e.g. 8,432. Each character has a fixed 16 px cell.
    function renderSteps(value) {
      const digits = String(Math.max(0, Math.floor(value || 0))).split('').reverse();
      const chars = [];
      digits.forEach((d, i) => {
        if (i > 0 && i % 3 === 0) chars.push('comma');
        chars.push(d);
      });
      chars.reverse();
      stepSlots.forEach((slot, i) => {
        const ch = chars[i];
        if (ch === undefined) {
          slot.setProperty(hmUI.prop.VISIBLE, false);
          return;
        }
        slot.setProperty(hmUI.prop.POS_X, STEP_X + i * 16);
        slot.setProperty(hmUI.prop.SRC, ch === 'comma' ? 'sm_comma.png' : 'sm_' + ch + '.png');
        slot.setProperty(hmUI.prop.VISIBLE, true);
      });
    }

    function updateYear() {
      const yy = new Date().getFullYear() % 100;
      const tens = Math.floor(yy / 10);
      const units = yy % 10;
      yearSlots[0].setProperty(hmUI.prop.SRC, 'sd_' + tens + '.png');
      yearSlots[1].setProperty(hmUI.prop.SRC, 'sd_' + units + '.png');
      aodYearSlots[0].setProperty(hmUI.prop.SRC, 'as_' + tens + '.png');
      aodYearSlots[1].setProperty(hmUI.prop.SRC, 'as_' + units + '.png');
    }

    function updateHebrewDate() {
      const now = new Date();
      const hebrewDate = hebrewDateFromFixed(fixedDayFromDate(now));
      const weekdayChars = hebrewWeekdayChars(now.getDay());
      const dateChars = hebrewDateChars(hebrewDate);
      renderLine(weekdaySlots, weekdayChars, '');
      renderLine(hebrewSlots, dateChars, '');
      renderLine(aodWeekdaySlots, weekdayChars, 'a');
      renderLine(aodHebrewSlots, dateChars, 'a');
    }

    __$$module$$__.module = DeviceRuntimeCore.WatchFace({
      init_view() {
        hmUI.createWidget(hmUI.widget.IMG, {
          x: 0,
          y: 0,
          w: 466,
          h: 466,
          src: 'bg.png',
          show_level: hmUI.show_level.ONLY_NORMAL,
        });

        // Time: hour digits (64 px cells), colon (32 px), minute digits.
        hmUI.createWidget(hmUI.widget.IMG_TIME, {
          hour_startX: 81,
          hour_startY: TIME_Y,
          hour_array: ['time_0.png', 'time_1.png', 'time_2.png', 'time_3.png', 'time_4.png',
            'time_5.png', 'time_6.png', 'time_7.png', 'time_8.png', 'time_9.png'],
          hour_zero: 1,
          hour_space: 4,
          hour_angle: 0,
          hour_unit_sc: 'colon.png',
          hour_unit_tc: 'colon.png',
          hour_unit_en: 'colon.png',
          hour_align: hmUI.align.LEFT,
          minute_startX: 253,
          minute_startY: TIME_Y,
          minute_array: ['time_0.png', 'time_1.png', 'time_2.png', 'time_3.png', 'time_4.png',
            'time_5.png', 'time_6.png', 'time_7.png', 'time_8.png', 'time_9.png'],
          minute_zero: 1,
          minute_space: 4,
          minute_angle: 0,
          minute_align: hmUI.align.LEFT,
          show_level: hmUI.show_level.ONLY_NORMAL,
        });

        // Gregorian date: month, separator, day (32 px digit cells).
        const digits = ['sd_0.png', 'sd_1.png', 'sd_2.png', 'sd_3.png', 'sd_4.png',
          'sd_5.png', 'sd_6.png', 'sd_7.png', 'sd_8.png', 'sd_9.png'];
        hmUI.createWidget(hmUI.widget.IMG_DATE, {
          month_startX: DATE_LEFT + 92,
          month_startY: DATE_Y,
          month_sc_array: digits,
          month_tc_array: digits,
          month_en_array: digits,
          month_zero: 1,
          month_space: 4,
          month_align: hmUI.align.LEFT,
          month_is_character: false,
          day_startX: DATE_LEFT,
          day_startY: DATE_Y,
          day_sc_array: digits,
          day_tc_array: digits,
          day_en_array: digits,
          day_zero: 1,
          day_space: 4,
          day_align: hmUI.align.LEFT,
          day_is_character: false,
          show_level: hmUI.show_level.ONLY_NORMAL,
        });
        // Slashes between day, month and year.
        [DATE_LEFT + 76, DATE_LEFT + 168].forEach(x => {
          hmUI.createWidget(hmUI.widget.IMG, {
            x: x,
            y: DATE_Y,
            w: 16,
            h: 40,
            src: 'slash.png',
            show_level: hmUI.show_level.ONLY_NORMAL,
          });
        });
        // Two-digit year, set from the current date.
        [DATE_LEFT + 184, DATE_LEFT + 216].forEach(x => {
          yearSlots.push(hmUI.createWidget(hmUI.widget.IMG, {
            x: x,
            y: DATE_Y,
            w: 32,
            h: 40,
            src: 'sd_0.png',
            show_level: hmUI.show_level.ONLY_NORMAL,
          }));
        });

        createGlyphSlots(weekdaySlots, WEEKDAY_SLOTS, WEEKDAY_Y, '', hmUI.show_level.ONLY_NORMAL);
        createGlyphSlots(hebrewSlots, HEBREW_SLOTS, HEBREW_Y, '', hmUI.show_level.ONLY_NORMAL);

        // Always-on (AOD): time, date, weekday and the Hebrew line only, in white and grey.
        // Battery, steps, sun times, altitude and compass are not shown, which keeps it light.
        const AOD = hmUI.show_level.ONLY_AOD;
        hmUI.createWidget(hmUI.widget.IMG_TIME, {
          hour_startX: 81,
          hour_startY: TIME_Y,
          hour_array: ['at_0.png', 'at_1.png', 'at_2.png', 'at_3.png', 'at_4.png',
            'at_5.png', 'at_6.png', 'at_7.png', 'at_8.png', 'at_9.png'],
          hour_zero: 1,
          hour_space: 4,
          hour_angle: 0,
          hour_unit_sc: 'ac.png',
          hour_unit_tc: 'ac.png',
          hour_unit_en: 'ac.png',
          hour_align: hmUI.align.LEFT,
          minute_startX: 253,
          minute_startY: TIME_Y,
          minute_array: ['at_0.png', 'at_1.png', 'at_2.png', 'at_3.png', 'at_4.png',
            'at_5.png', 'at_6.png', 'at_7.png', 'at_8.png', 'at_9.png'],
          minute_zero: 1,
          minute_space: 4,
          minute_angle: 0,
          minute_align: hmUI.align.LEFT,
          show_level: AOD,
        });
        const aodDigits = ['as_0.png', 'as_1.png', 'as_2.png', 'as_3.png', 'as_4.png',
          'as_5.png', 'as_6.png', 'as_7.png', 'as_8.png', 'as_9.png'];
        hmUI.createWidget(hmUI.widget.IMG_DATE, {
          month_startX: DATE_LEFT + 92,
          month_startY: DATE_Y,
          month_sc_array: aodDigits,
          month_tc_array: aodDigits,
          month_en_array: aodDigits,
          month_zero: 1,
          month_space: 4,
          month_align: hmUI.align.LEFT,
          month_is_character: false,
          day_startX: DATE_LEFT,
          day_startY: DATE_Y,
          day_sc_array: aodDigits,
          day_tc_array: aodDigits,
          day_en_array: aodDigits,
          day_zero: 1,
          day_space: 4,
          day_align: hmUI.align.LEFT,
          day_is_character: false,
          show_level: AOD,
        });
        [DATE_LEFT + 76, DATE_LEFT + 168].forEach(x => {
          hmUI.createWidget(hmUI.widget.IMG, {
            x: x,
            y: DATE_Y,
            w: 16,
            h: 40,
            src: 'asl.png',
            show_level: AOD,
          });
        });
        [DATE_LEFT + 184, DATE_LEFT + 216].forEach(x => {
          aodYearSlots.push(hmUI.createWidget(hmUI.widget.IMG, {
            x: x,
            y: DATE_Y,
            w: 32,
            h: 40,
            src: 'as_0.png',
            show_level: AOD,
          }));
        });
        createGlyphSlots(aodWeekdaySlots, WEEKDAY_SLOTS, WEEKDAY_Y, 'a', AOD);
        createGlyphSlots(aodHebrewSlots, HEBREW_SLOTS, HEBREW_Y, 'a', AOD);

        // Icons next to the sun times, battery and steps (text widgets follow).
        [['ic_sunrise.png', 103, SUN_Y - 4], ['ic_sunset.png', 247, SUN_Y - 4],
          ['ic_battery.png', 111, INFO_Y - 4], ['ic_steps.png', 239, INFO_Y - 4]].forEach(icon => {
          hmUI.createWidget(hmUI.widget.IMG, {
            x: icon[1],
            y: icon[2],
            w: 32,
            h: 32,
            src: icon[0],
            show_level: hmUI.show_level.ONLY_NORMAL,
          });
        });

        // Sunrise and sunset, supplied by the system.
        hmUI.createWidget(hmUI.widget.TEXT_IMG, {
          x: 139,
          y: SUN_Y,
          font_array: SMALL_DIGITS,
          padding: false,
          h_space: 0,
          dot_image: 'smc.png',
          align_h: hmUI.align.LEFT,
          type: hmUI.data_type.SUN_RISE,
          show_level: hmUI.show_level.ONLY_NORMAL,
        });
        hmUI.createWidget(hmUI.widget.TEXT_IMG, {
          x: 283,
          y: SUN_Y,
          font_array: SMALL_DIGITS,
          padding: false,
          h_space: 0,
          dot_image: 'smc.png',
          align_h: hmUI.align.LEFT,
          type: hmUI.data_type.SUN_SET,
          show_level: hmUI.show_level.ONLY_NORMAL,
        });

        // Steps: one image per character, updated from the step sensor.
        for (let i = 0; i < STEP_SLOTS; i += 1) {
          // Full-screen canvas, positioned with pos_x/pos_y (the way the other faces place dynamic images).
          const slot = hmUI.createWidget(hmUI.widget.IMG, {
            x: 0,
            y: 0,
            w: 466,
            h: 466,
            center_x: 0,
            center_y: INFO_Y,
            pos_x: STEP_X + i * 16,
            pos_y: INFO_Y,
            angle: 0,
            src: 'sm_0.png',
            show_level: hmUI.show_level.ONLY_NORMAL,
          });
          slot.setProperty(hmUI.prop.VISIBLE, false);
          stepSlots.push(slot);
        }
        stepSensor = hmSensor.createSensor(hmSensor.id.STEP);
        renderSteps(stepSensor.current);
        stepSensor.addEventListener(hmSensor.event.CHANGE, function() {
          renderSteps(stepSensor.current);
        });

        // Battery and steps, supplied by the system.
        hmUI.createWidget(hmUI.widget.TEXT_IMG, {
          x: 147,
          y: INFO_Y,
          font_array: SMALL_DIGITS,
          padding: false,
          h_space: 0,
          unit_sc: 'pct.png',
          unit_tc: 'pct.png',
          unit_en: 'pct.png',
          align_h: hmUI.align.LEFT,
          type: hmUI.data_type.BATTERY,
          show_level: hmUI.show_level.ONLY_NORMAL,
        });


        // Altitude: icon, then the value from the system (negative values use minus.png).
        hmUI.createWidget(hmUI.widget.IMG, {
          x: 173,
          y: ALT_Y - 4,
          w: 32,
          h: 32,
          src: 'ic_altitude.png',
          show_level: hmUI.show_level.ONLY_NORMAL,
        });
        hmUI.createWidget(hmUI.widget.TEXT_IMG, {
          x: 209,
          y: ALT_Y,
          font_array: SMALL_DIGITS,
          padding: false,
          h_space: 0,
          unit_sc: 'm.png',
          unit_tc: 'm.png',
          unit_en: 'm.png',
          negative_image: 'minus.png',
          align_h: hmUI.align.LEFT,
          type: hmUI.data_type.ALTITUDE, // ALTIMETER would be air pressure
          show_level: hmUI.show_level.ONLY_NORMAL,
        });

        // Compass: static dial, needle rotated live around the dial centre.
        hmUI.createWidget(hmUI.widget.IMG, {
          x: COMPASS_CX - 40,
          y: COMPASS_CY - 40,
          w: 80,
          h: 80,
          src: 'compass_dial.png',
          show_level: hmUI.show_level.ONLY_NORMAL,
        });
        compassNeedle = hmUI.createWidget(hmUI.widget.IMG, {
          x: 0,
          y: 0,
          w: 466,
          h: 466,
          pos_x: COMPASS_CX - 16,
          pos_y: COMPASS_CY - 32,
          center_x: COMPASS_CX,
          center_y: COMPASS_CY,
          src: 'compass_needle.png',
          angle: 0,
          show_level: hmUI.show_level.ONLY_NORMAL,
        });
        if (screenType == hmSetting.screen_type.WATCHFACE) {
          compass = hmSensor.createSensor(hmSensor.id.COMPASS);
          applyCompass(compass.direction_angle, !!compass.calibration_status);
          startCompass();
          compass.addEventListener(hmSensor.event.CHANGE, function(res) {
            applyCompass(res.direction_angle, !!res.calibration_status);
          });
        }

        // Same pattern as the other faces: sensor created in init_view, refresh on day change and on wake.
        if (!timeSensor) timeSensor = hmSensor.createSensor(hmSensor.id.TIME);
        timeSensor.addEventListener(timeSensor.event.DAYCHANGE, function() {
          updateHebrewDate();
          updateYear();
        });
        hmUI.createWidget(hmUI.widget.WIDGET_DELEGATE, {
          resume_call: function() {
            if (compass && screenType == hmSetting.screen_type.WATCHFACE) startCompass();
            updateHebrewDate();
            updateYear();
          },
          pause_call: function() {
            stopCompass();
          },
        });
      },
      onInit() {},
      build() {
        this.init_view();
        updateHebrewDate();
        updateYear();
      },
      onDestroy() {},
    });
  })());
} catch (e) {
  console.log('Hebrew date face error', e);
}

})();

// Runs a watch face index.js against a fake Zepp OS API and prints the widgets it created.
// Usage: TZ=Asia/Jerusalem node simulate.cjs <index.js> <ISO date> [steps] [compassAngle] [calibrated 0|1]
// The system clock sensor (hour/minute) follows the date; set SYSTEM_OFFSET=<minutes from UTC> to make the clock sensor differ from the JS Date's time zone (a stale zone).
'use strict';
const fs = require('fs');
const vm = require('vm');

const [, , file, iso, steps = '8432', angle = '35', calibrated = '1'] = process.argv;
const RealDate = Date;
const sysLocal = () => new RealDate(fixed.getTime() + (process.env.SYSTEM_OFFSET
  ? Number(process.env.SYSTEM_OFFSET) : -fixed.getTimezoneOffset()) * 60000); // read with getUTC*
const fixed = new RealDate(iso);
class FakeDate extends RealDate {
  constructor(...args) { if (args.length) super(...args); else super(fixed.getTime()); }
  static now() { return fixed.getTime(); }
}

const widgets = [];
const prop = { VISIBLE: 'visible', POS_X: 'pos_x', POS_Y: 'pos_y', SRC: 'src', ANGLE: 'angle' };
const hmUI = {
  widget: { IMG: 'IMG', IMG_TIME: 'IMG_TIME', IMG_DATE: 'IMG_DATE', TEXT_IMG: 'TEXT_IMG', WIDGET_DELEGATE: 'WIDGET_DELEGATE',
    TIME_POINTER: 'TIME_POINTER', BUTTON: 'BUTTON', IMG_LEVEL: 'IMG_LEVEL' },
  show_level: { ONLY_NORMAL: 'normal', ONLY_AOD: 'aod' },
  align: { LEFT: 'left', RIGHT: 'right', CENTER_H: 'center' },
  data_type: { SUN_RISE: 'SUN_RISE', SUN_SET: 'SUN_SET', BATTERY: 'BATTERY', ALTITUDE: 'ALTITUDE', ALTIMETER: 'ALTIMETER', STEP: 'STEP' },
  prop: prop,
  createWidget(type, props) {
    const w = { type: type, props: Object.assign({ visible: true }, props) };
    widgets.push(w);
    return { setProperty(k, v) { w.props[k] = v; }, getProperty(k) { return w.props[k]; } };
  },
};
function sensor(extra) {
  return Object.assign({ addEventListener() {}, start() {}, stop() {} }, extra);
}
const hmSensor = {
  id: { STEP: 'STEP', TIME: 'TIME', COMPASS: 'COMPASS', WEATHER: 'WEATHER' },
  event: { CHANGE: 'CHANGE' },
  createSensor(id) {
    if (id === 'STEP') return sensor({ current: Number(steps) });
    if (id === 'TIME') return sensor({ hour: sysLocal().getUTCHours(), minute: sysLocal().getUTCMinutes(), event: { DAYCHANGE: 'DAYCHANGE', MINUTEEND: 'MINUTEEND' } });
    // WEATHER='06:54,17:52;06:55,17:51' are the sun times synced from Zepp: today;tomorrow (unset: nothing synced).
    if (id === 'WEATHER') {
      const hm = t => ({ hour: Number(t.split(':')[0]), minute: Number(t.split(':')[1]) });
      const data = (process.env.WEATHER || '').split(';').filter(Boolean).map(d => ({ sunrise: hm(d.split(',')[0]), sunset: hm(d.split(',')[1]) }));
      return sensor({ getForecastWeather() { return { cityName: 'x', tideData: { count: data.length, data: data } }; } });
    }
    if (id === 'COMPASS') return sensor({ direction_angle: angle, calibration_status: calibrated === '1' });
    throw new Error('unknown sensor ' + id);
  },
};

// FIX=lat,lon,alt gives the face a watch with GPS and barometer (STATUS=V: no fix yet); without it, none.
const store = {};
const moduleApi = process.env.FIX === undefined ? null : {
  '@zos/sensor': {
    Geolocation: class {
      start() {} stop() { process.stderr.write('gps stopped\n'); }
      onChange(cb) { process.nextTick ? (this.cb = cb, cb()) : cb(); }
      getStatus() { return process.env.STATUS || 'A'; }
      getLatitude() { return Number(process.env.FIX.split(',')[0]); }
      getLongitude() {
        const lon = Number(process.env.FIX.split(',')[1]);
        return process.env.DMS ? { direction: 'E', degrees: Math.floor(lon), minutes: Math.floor((lon % 1) * 60), seconds: ((lon * 60) % 1) * 60 } : lon;
      }
    },
    Barometer: class { getAltitude() { return Number(process.env.FIX.split(',')[2]); } },
  },
  '@zos/storage': {
    LocalStorage: class {
      getItem(k, d) { return k in store ? store[k] : (process.env.SAVED && k === 'place' ? process.env.SAVED : d); }
      setItem(k, v) { store[k] = v; process.stderr.write('saved ' + v + '\n'); }
    },
  },
};

const app = { current: {} };
const context = {
  console, Date: FakeDate, Math, String, Number, Object, Array, parseInt, isNaN, Error, JSON,
  __$$R$$__(name) { if (!moduleApi) throw new Error('no module ' + name); return moduleApi[name]; },
  hmUI, hmSensor,
  hmApp: { startApp(o) { process.stderr.write('startApp ' + JSON.stringify(o) + '\n'); } },
  hmSetting: { getScreenType: () => 'WATCHFACE', screen_type: { WATCHFACE: 'WATCHFACE', AOD: 'AOD' } },
  timer: { createTimer: () => ({}), stopTimer() {} },
  __$$hmAppManager$$__: { currentApp: app },
  DeviceRuntimeCore: { WatchFace(obj) { return obj; } },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
if (!app.current.module) throw new Error('watch face module was not registered');
app.current.module.build();
// Press every button once; startApp calls are logged to stderr.
if (process.env.CLICK) widgets.filter(w => w.type === 'BUTTON').forEach(w => w.props.click_func({}));
process.stdout.write(JSON.stringify(widgets, null, 1));

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'tecnova-splash.js'), 'utf8');

function scenario({ mode = 'session', seen = false, reduced = false, lang = 'pt-PT' } = {}) {
  const timers = [];
  const events = [];
  const classes = new Set();
  const stored = new Map(seen ? [['tecnova:splash:v1', 'seen']] : []);
  const status = { textContent: '' };
  let removed = false;

  const root = {
    hidden: true,
    attrs: new Map([
      ['data-mode', mode],
      ['data-duration', '5000'],
      ['data-fade', '480']
    ]),
    style: { setProperty() {} },
    classList: { add(name) { classes.add(name); } },
    getAttribute(name) { return this.attrs.get(name) || null; },
    setAttribute(name, value) { this.attrs.set(name, value); },
    querySelector(selector) { return selector === '[data-splash-status]' ? status : null; },
    remove() { removed = true; }
  };

  const documentElement = {
    lang,
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); }
    }
  };

  const window = {
    matchMedia() { return { matches: reduced }; },
    sessionStorage: {
      getItem(key) { return stored.get(key) || null; },
      setItem(key, value) { stored.set(key, value); }
    },
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
    clearTimeout() {},
    dispatchEvent(event) { events.push(event.type); }
  };

  const context = {
    document: { getElementById() { return root; }, documentElement },
    window,
    navigator: { language: lang },
    performance: { now() { return 0; } },
    requestAnimationFrame(callback) { callback(); },
    CustomEvent: function CustomEvent(type) { this.type = type; }
  };

  vm.runInNewContext(source, context, { filename: 'tecnova-splash.js' });
  return { timers, events, classes, stored, status, root, get removed() { return removed; } };
}

const firstVisit = scenario();
assert.equal(firstVisit.removed, false);
assert.equal(firstVisit.root.hidden, false);
assert.equal(firstVisit.stored.get('tecnova:splash:v1'), 'seen');
assert.equal(firstVisit.status.textContent, 'A carregar TECNOVA Digital');
assert.ok(firstVisit.timers.some((timer) => timer.delay === 4520));
assert.ok(firstVisit.events.includes('tecnova:splash:shown'));

const repeatedVisit = scenario({ seen: true });
assert.equal(repeatedVisit.removed, true);

const appLaunch = scenario({ mode: 'always', seen: true, lang: 'en' });
assert.equal(appLaunch.removed, false);
assert.equal(appLaunch.status.textContent, 'Loading TECNOVA Digital');

const reducedMotion = scenario({ reduced: true, lang: 'es' });
assert.ok(reducedMotion.timers.some((timer) => timer.delay === 720));
assert.equal(reducedMotion.status.textContent, 'Cargando TECNOVA Digital');

console.log('4 cenários do splash: OK');


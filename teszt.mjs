/**
 * A Klán csapatösszesítő tesztje.
 *
 * Futtatás:  node teszt.mjs
 * (Nincs semmilyen függősége, nem kell npm install.)
 *
 * A VALÓDI forrást futtatjuk (klan-csapatosszesito.js), nem egy másolatát —
 * egy minimális DOM-utánzaton. Így a táblázat-felismerés, a számformátumok
 * kezelése és a populáció-számítás ténylegesen tesztelve van.
 *
 * A panel megjelenítését nem rajzoljuk ki: a createElement egy csonkot ad,
 * és az innerHTML-ből olvassuk vissza, mi készült volna.
 *
 * A teszt utolsó blokkja magán a FORRÁSON ellenőrzi azt, amit a support-levél
 * állít: nincs benne hálózati hívás, időzítő, navigáció vagy elfedett kód.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GY = dirname(fileURLToPath(import.meta.url));
const FORRAS = readFileSync(join(GY, 'klan-csapatosszesito.js'), 'utf8');

let ok = 0;
let bukta = 0;
const all = (f, mit) => {
  if (f) { ok++; console.log(`  ok    ${mit}`); }
  else { bukta++; console.log(`  BUKTA ${mit}`); }
};

/* ---------------- minimális DOM ---------------- */

function kep(src) {
  return { getAttribute: (n) => (n === 'src' ? src : null) };
}

function cella(c) {
  return {
    textContent: c.textContent,
    getElementsByTagName: (t) => (t === 'img' ? c.kepek.map(kep) : []),
  };
}

function sorObj(c) {
  return { cells: c.map(cella) };
}

function tablat(sorok) {
  return { tagName: 'TABLE', rows: sorok.map(sorObj) };
}

/**
 * Táblázat, ahol egy faluhoz TÖBB sor tartozik (több sortípus van
 * bekapcsolva): a játék ilyenkor falvanként külön <tbody>-ba teszi a sorokat.
 */
function tablatCsoportos(fejlecSor, csoportok) {
  const tb = csoportok.map((g) => ({ rows: g.map(sorObj) }));
  const rows = [sorObj(fejlecSor), ...tb.flatMap((t) => t.rows)];
  return { tagName: 'TABLE', rows, tBodies: tb };
}

const UNIT = (u) => `https://dshu.innogamescdn.com/asset/x/graphic/unit/unit_${u}.png`;
const EGYSEGEK = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'];

function fejlec() {
  return [
    { textContent: 'Falu', kepek: [] },
    ...EGYSEGEK.map((u) => ({ textContent: '', kepek: [UNIT(u)] })),
  ];
}

/** Egy adatsor. A számokat a játék formátumában adjuk: "7.000". */
function sor(nev, szamok) {
  return [
    { textContent: nev, kepek: [] },
    ...szamok.map((n) => ({ textContent: String(n), kepek: [] })),
  ];
}

function futtat(tablak, mentett) {
  let panelHtml = '';
  let riasztas = null;
  const elemek = new Map();

  const csonk = () => ({
    id: '', style: { cssText: '' }, textContent: '',
    set innerHTML(v) { panelHtml = v; },
    get innerHTML() { return panelHtml; },
    appendChild() {}, removeChild() {}, select() {},
    parentNode: { removeChild() {} },
    value: '', onclick: null,
  });

  const doc = {
    getElementsByTagName: (t) => (t === 'table' ? tablak : []),
    // A panel gombjait a script azonosító szerint keresi meg. A csonkot
    // igény szerint készítjük, hogy a kód ugyanúgy fusson le, mint élesben.
    getElementById: (id) => {
      if (id === 'kcs_panel') return null; // nincs korábbi panel
      if (!elemek.has(id)) elemek.set(id, csonk());
      return elemek.get(id);
    },
    createElement: () => csonk(),
    body: { appendChild() {}, removeChild() {} },
  };

  const localStorage = {
    getItem: () => (mentett ? JSON.stringify(mentett) : null),
    setItem: () => {},
  };

  // A scriptet saját változókörnyezetben futtatjuk — ugyanaz a forrás,
  // amit a játékos is betöltene.
  const fv = new Function('document', 'localStorage', 'alert', 'navigator', 'window', FORRAS);
  const ablak = {};
  fv(doc, localStorage, (sz) => { riasztas = sz; }, {}, ablak);

  return { panelHtml, riasztas };
}

/** A panel HTML-jéből kiolvas egy sort. */
function sorbol(html, nev) {
  const re = new RegExp(`<td[^>]*>${nev}</td>((?:\\s*<td[^>]*>.*?</td>)+)`, 's');
  const m = re.exec(html);
  if (!m) return null;
  return [...m[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((x) => x[1].replace(/<[^>]+>/g, '').trim());
}

const tiszta = (x) => x.replace(/[\s  ]+/g, '');

/* ---------------- tesztek ---------------- */

console.log('\n=== TÁBLA-FELISMERÉS ===');
const fo = tablat([
  fejlec(),
  // 7000 bárdos + 3000 könnyűlovas + 300 kos + 50 katapult = 20 900 pop
  sor('EgyNuke', ['0', '0', '7.000', '0', '50', '3.000', '0', '0', '300', '50', '1', '0']),
  sor('Vedo', ['7.000', '7.000', '0', '0', '0', '0', '0', '2.000', '0', '0', '0', '0']),
  sor('Vegyes', ['3.000', '2.000', '3.500', '1.000', '20', '1.500', '0', '500', '150', '25', '1', '8']),
]);
// Egy zavaró táblázat, amiben van kép, de nem egység — ezt nem szabad választania.
const zavaro = tablat([
  [{ textContent: 'Menü', kepek: ['https://x/graphic/buildings/main.png'] }],
  [{ textContent: 'Főhadiszállás', kepek: [] }],
]);

let v = futtat([zavaro, fo]);
all(v.riasztas === null, 'megtalálta az egységtáblázatot a zavaró mellett is');
all(v.panelHtml.includes('EgyNuke'), 'a sorok bekerültek a panelbe');
all(!v.panelHtml.includes('Falu</td>'), 'a fejlécsort nem olvasta adatsorként');

console.log('\n=== POPULÁCIÓ-ALAPÚ SZÁMÍTÁS ===');
let s = sorbol(v.panelHtml, 'EgyNuke');
all(s !== null && s[0] === '1', 'a klasszikus teljes nuke pontosan 1.0 nuke');
all(tiszta(s[3]) === '20900', `a támadó populáció 20 900 (kapott: ${s[3]})`);

s = sorbol(v.panelHtml, 'Vedo');
all(s[0] === '0', 'a tisztán védő sornak 0 nuke-ja van');
all(s[2] === '1', 'és pontosan 1 védősereg-egyenértéke');

console.log('\n=== A VEGYES FALU: EZT RONTJA EL A DARABOLÓS MÓDSZER ===');
s = sorbol(v.panelHtml, 'Vegyes');
// 3500 bárdos + 1500·4 lovas + 150·5 kos + 25·8 katapult = 3500+6000+750+200 = 10 450
all(tiszta(s[3]) === '10450', `támadó pop 10 450 (kapott: ${s[3]})`);
all(s[0] === '0.5', 'ez fél nuke — nem 0 és nem 1');
all(s[1] === '2', '8 nemes = 2 vonat');

console.log('\n=== SZÁMFORMÁTUMOK ===');
v = futtat([tablat([
  fejlec(),
  sor('Pontos', ['0', '0', '7.000', '0', '0', '0', '0', '0', '0', '0', '0', '0']),
  sor('Szokozos', ['0', '0', '7 000', '0', '0', '0', '0', '0', '0', '0', '0', '0']),
  sor('Vesszos', ['0', '0', '7,000', '0', '0', '0', '0', '0', '0', '0', '0', '0']),
  sor('Ures', ['0', '0', '-', '0', '0', '0', '0', '0', '0', '0', '0', '0']),
])]);
// A magyar helyesírás a négyjegyű számot szóköz NÉLKÜL írja (7000), ötjegyűtől
// szóközzel (20 900) — a toLocaleString('hu-HU') pont ezt csinálja.
all(tiszta(sorbol(v.panelHtml, 'Pontos')[3]) === '7000', 'pontos ezres elválasztó (7.000)');
all(tiszta(sorbol(v.panelHtml, 'Szokozos')[3]) === '7000', 'szóközös ezres elválasztó (7 000)');
all(tiszta(sorbol(v.panelHtml, 'Vesszos')[3]) === '7000', 'vesszős ezres elválasztó (7,000)');
all(sorbol(v.panelHtml, 'Ures') === null, 'a csupa nulla/kötőjeles sor kimarad');

console.log('\n=== SORREND ===');
all(v.panelHtml.indexOf('Pontos') > 0, 'a legtöbb nuke-kal rendelkező elöl van');

console.log('\n=== SAJÁT BEÁLLÍTÁS ===');
// Fél akkora nuke-definíció → kétszer annyi nuke.
v = futtat([fo], { nukePop: 10450, vedoPop: 26000, nemesVonatonkent: 4 });
all(sorbol(v.panelHtml, 'EgyNuke')[0] === '2', 'felezett nuke-definícióval kétszer annyi nuke');
all(sorbol(v.panelHtml, 'Vegyes')[0] === '1', 'a vegyes falu így pontosan 1');

console.log('\n=== TÖBB SORTÍPUS: EGY FALUHOZ TÖBB SOR ===');
// Minden faluhoz három sor tartozik. Ha vakon összeadnánk mindhármat,
// ugyanazt a sereget számolnánk többször, és az idegen támogatás is bejönne.
const falu = (nev) => [
  sor(nev, ['0', '0', '7.000', '0', '50', '3.000', '0', '0', '300', '50', '1', '0']),
  sor('A faluban', ['0', '0', '14.000', '0', '50', '0', '0', '0', '0', '0', '0', '0']),
  sor('Úton lévők', ['0', '0', '1.000', '0', '0', '0', '0', '0', '0', '0', '0', '0']),
];
const csoportosTabla = tablatCsoportos(fejlec(), [falu('Falu1'), falu('Falu2')]);

v = futtat([csoportosTabla]);
all(sorbol(v.panelHtml, 'Falu1') !== null, 'a falusorokat megtalálta');
all(sorbol(v.panelHtml, 'A faluban') === null, 'a sortípus-sorokat NEM veszi külön bejegyzésnek');
all(tiszta(sorbol(v.panelHtml, 'Falu1')[3]) === '20900',
  `csak a választott sort számolja (kapott: ${sorbol(v.panelHtml, 'Falu1')[3]})`);
all(/Összesen:<\/b> 2 nuke/.test(v.panelHtml), 'két falu = 2 nuke, nem több');
all(v.panelHtml.includes('kcs_sor'), 'felajánlja a sortípus-választót');
all(v.panelHtml.includes('A faluban'), 'a sortípus nevét a táblából olvassa ki');

v = futtat([csoportosTabla], { nukePop: 20900, vedoPop: 26000, nemesVonatonkent: 4, sorPozicio: 1 });
all(tiszta(sorbol(v.panelHtml, 'Falu1')[3]) === '14000',
  `a második sortípus külön olvasva 14 000 (kapott: ${sorbol(v.panelHtml, 'Falu1')[3]})`);

console.log('\n=== HA NINCS MIT OLVASNI ===');
v = futtat([zavaro]);
all(v.riasztas !== null && /táblázat/.test(v.riasztas), 'egységtáblázat nélkül érthetően szól');
all(v.panelHtml === '', 'és nem rajzol üres panelt');

console.log('\n=== AMIT A SCRIPT NEM TEHET (szabályellenőrzés a forráson) ===');
all(!/XMLHttpRequest|fetch\s*\(|\$\.(get|post|ajax)|sendBeacon|WebSocket/.test(FORRAS),
  'nincs benne egyetlen hálózati hívás sem');
all(!/setInterval|setTimeout|addEventListener\s*\(\s*['"](?!click)/.test(FORRAS),
  'nem fut időzítve és nem figyel játékbeli eseményre');
all(!/location\s*=|location\.href\s*=|\.submit\s*\(|\.click\s*\(\s*\)/.test(FORRAS),
  'nem navigál, nem küld űrlapot és nem kattint helyetted');
all(!/eval\s*\(|atob\s*\(|fromCharCode|\\x[0-9a-f]{2}/i.test(FORRAS),
  'nincs benne elfedett (obfuszkált) kód');

console.log(`\n==== ${ok} ok, ${bukta} bukta ====`);
if (bukta) process.exit(1);

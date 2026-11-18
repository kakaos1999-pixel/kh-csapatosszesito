import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
/**
 * A Klan csapatosszesito tesztje.
 *
 * Futtatas:  node teszt.mjs   (nincs semmilyen fuggosege)
 *
 * A VALODI forrast futtatjuk (klan-csapatosszesito.js), nem egy
 * masolatat -- egy minimalis DOM-utanzaton. Igy a tabla-felismeres, az
 * oszlopterkep, a populacio-szamitas es a klantabla-gyujtes tenylegesen
 * tesztelve van.
 *
 * A panel megjeleniteset nem rajzoljuk ki: a createElement egy csonkot ad,
 * es az innerHTML-bol olvassuk vissza, mi keszult volna. A gombokat a
 * csonkok onclick-jen keresztul nyomjuk meg.
 */
const GY = dirname(fileURLToPath(import.meta.url));
const FORRAS = readFileSync(join(GY, 'klan-csapatosszesito.js'), 'utf8');
let ok = 0, bukta = 0;
const all = (f, mit) => {
    if (f) {
        ok++;
        console.log(`  ok    ${mit}`);
    }
    else {
        bukta++;
        console.log(`  BUKTA ${mit}`);
    }
};
const kep = (src) => ({ getAttribute: (n) => (n === 'src' ? src : null) });
const link = (href, szoveg = '') => ({
    textContent: szoveg,
    getAttribute: (n) => (n === 'href' ? href : null),
});
function cella(c) {
    return {
        textContent: c.textContent,
        getElementsByTagName: (t) => t === 'img' ? (c.kepek ?? []).map(kep) : t === 'a' ? (c.linkek ?? []).map((h) => link(h)) : [],
    };
}
const sorObj = (c) => ({ cells: c.map(cella) });
const tablat = (sorok) => ({ tagName: 'TABLE', rows: sorok.map(sorObj) });
/** Tabla, ahol egy faluhoz tobb sor tartozik (tobb sortipus bekapcsolva). */
function tablatCsoportos(fejlecSor, csoportok) {
    const tb = csoportok.map((g) => ({ rows: g.map(sorObj) }));
    return { tagName: 'TABLE', rows: [sorObj(fejlecSor), ...tb.flatMap((t) => t.rows)], tBodies: tb };
}
const UNIT = (u) => `https://dshu.innogamescdn.com/asset/x/graphic/unit/unit_${u}.png`;
const EGYSEGEK = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'];
/** Fejlec: Falu | Pontok | <egyseg-ikonok>. A pontoszlop szandekosan ott van:
 *  a klan-csapatattekintoben is van, es az oszlopterkep-nek at kell ugrania. */
function fejlec(elsoNev = 'Falu') {
    return [
        { textContent: elsoNev },
        { textContent: 'Pontok' },
        ...EGYSEGEK.map((u) => ({ textContent: '', kepek: [UNIT(u)] })),
    ];
}
/** Falusor: nev (falulinkkel) | pont | 12 szam. */
function faluSor(nev, faluId, szamok) {
    return [
        { textContent: nev, linkek: [`/game.php?screen=info_village&id=${faluId}`] },
        { textContent: '9.735' },
        ...szamok.map((n) => ({ textContent: String(n) })),
    ];
}
/** Jatekossor: nev (profillinkkel) | pont | 12 szam. */
function jatekosSor(nev, id, szamok) {
    return [
        { textContent: nev, linkek: [`/game.php?screen=info_player&id=${id}`] },
        { textContent: '9.735' },
        ...szamok.map((n) => ({ textContent: String(n) })),
    ];
}
/**
 * Egy "bongeszo": sajat localStorage, ami tullep a kattintasokon.
 * A kattint() egyszer lefuttatja a script forrasat az adott lapon.
 */
function bongeszo(mentett) {
    const tar = new Map();
    if (mentett)
        tar.set('kcs_beallitasok', JSON.stringify(mentett));
    let panelHtml = '';
    let riasztas = null;
    let elemek = new Map();
    const csonk = () => ({
        id: '', style: { cssText: '' }, textContent: '',
        set innerHTML(v) { panelHtml = v; },
        get innerHTML() { return panelHtml; },
        appendChild() { }, removeChild() { }, select() { },
        parentNode: { removeChild() { } },
        value: '', onclick: null,
    });
    function kattint(tablak) {
        elemek = new Map();
        panelHtml = '';
        riasztas = null;
        const keres = (id) => {
            if (!elemek.has(id))
                elemek.set(id, csonk());
            return elemek.get(id);
        };
        const doc = {
            getElementsByTagName: (t) => (t === 'table' ? tablak : []),
            getElementById: (id) => (id === 'kcs_panel' ? null : keres(id)),
            createElement: () => csonk(),
            body: { appendChild() { }, removeChild() { } },
        };
        const localStorage = {
            getItem: (k) => (tar.has(k) ? tar.get(k) : null),
            setItem: (k, v) => { tar.set(k, v); },
        };
        const ablak = { location: { search: '' } };
        const fv = new Function('document', 'localStorage', 'alert', 'navigator', 'window', FORRAS);
        fv(doc, localStorage, (sz) => { riasztas = sz; }, {}, ablak);
        return {
            get panelHtml() { return panelHtml; },
            get riasztas() { return riasztas; },
            elem: keres,
        };
    }
    return { kattint, tar };
}
/** A panel HTML-jebol kiolvas egy tag sorat. */
function sorbol(html, nev) {
    const re = new RegExp(`<td[^>]*>${nev}</td>((?:\\s*<td[^>]*>.*?</td>)+)`, 's');
    const m = re.exec(html);
    if (!m)
        return null;
    return [...m[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((x) => x[1].replace(/<[^>]+>/g, '').trim());
}
const tiszta = (x) => x.replace(/[\s  ]+/g, '');
/* 7000 bardos + 3000 konnyulovas + 300 kos + 50 katapult = 20 900 pop */
const NUKE = ['0', '0', '7.000', '0', '50', '3.000', '0', '0', '300', '50', '1', '0'];
const VEDO = ['7.000', '7.000', '0', '0', '0', '0', '0', '2.000', '0', '0', '0', '0'];
/* ================================================================== */
console.log('\n=== OSZLOPTERKEP: A PONTOSZLOPOT ATUGORJA ===');
// Ha az oszlopokat sorszam szerint olvasnank, a pontszam lenne a landzsas.
// Az ikonok alapjan terkepezunk, ezert a pontoszlop nem csuszik bele.
let b = bongeszo();
let v = b.kattint([tablat([fejlec(), faluSor('001 - Alfa', 11, NUKE)])]);
all(v.riasztas === null, 'megtalalta az egysegtablazatot');
all(/1 falu ezen az oldalon/.test(v.panelHtml), 'egy falusort olvasott be');
all(!/9\.?735/.test(v.panelHtml.replace(/width:min\(620px,94vw\)/, '')), 'a pontszam nem szivargott be egysegkent');
console.log('\n=== FALUSOROS LAP: NEV NELKUL NEM ROGZIT ===');
all(/A tag nevét nem találtam meg/.test(v.panelHtml), 'szol, hogy a tag neve hianyzik');
all(/A klántábla még üres/.test(v.panelHtml), 'addig a klantabla ures marad');
console.log('\n=== ROGZITES A KLANTABLABA ===');
v.elem('kcs_jatekos').value = 'Gabengocia';
v.elem('kcs_rogzit').onclick();
let html = v.panelHtml;
all(sorbol(html, 'Gabengocia') !== null, 'a tag bekerult a klantablaba');
all(sorbol(html, 'Gabengocia')[0] === '1', 'egy teljes nuke = 1.0');
console.log('\n=== UGYANAZ A LAP MEGEGYSZER: NEM DUPLAZ ===');
// Falvanként tárolunk, ezért a lap újbóli megnyitása nem adja hozzá mégegyszer.
let v2 = b.kattint([tablat([fejlec(), faluSor('001 - Alfa', 11, NUKE)])]);
all(sorbol(v2.panelHtml, 'Gabengocia')[0] === '1', 'ket kattintas utan is 1.0 nuke');
all(sorbol(v2.panelHtml, 'Gabengocia')[4] === '1', 'es tovabbra is 1 falu');
console.log('\n=== A LISTA MASODIK OLDALA HOZZAADODIK ===');
let v3 = b.kattint([tablat([fejlec(), faluSor('002 - Beta', 12, NUKE)])]);
v3.elem('kcs_jatekos').value = 'Gabengocia';
v3.elem('kcs_rogzit').onclick();
html = v3.panelHtml;
all(sorbol(html, 'Gabengocia')[0] === '2', 'masodik oldal utan 2.0 nuke');
all(sorbol(html, 'Gabengocia')[4] === '2', 'ket falu');
console.log('\n=== A FELDERITO SEM TAMADO, SEM VEDO ===');
// Ez a legfontosabb kulonbseg a ma hasznalt osszesitohoz kepest: az a
// felderito populaciojat a tamado ES a vedo osszeghez is hozzaadja, igy egy
// felderitofalu egyszerre szamit fel nuke-nak es fel vedoseregnek.
const b2 = bongeszo();
let f = b2.kattint([tablat([fejlec(), faluSor('Felderito falu', 21, ['0', '0', '0', '0', '5.000', '0', '0', '0', '0', '0', '0', '0'])])]);
f.elem('kcs_jatekos').value = 'Scoutos';
f.elem('kcs_rogzit').onclick();
html = f.panelHtml;
let s = sorbol(html, 'Scoutos');
all(s[0] === '0', '5000 felderito = 0 nuke');
all(s[2] === '0', '5000 felderito = 0 vedosereg');
all(tiszta(s[3]) === '5000', 'de a felderito kulon oszlopban latszik');
console.log('\n=== A KATAPULT CSAK A TAMADO OLDALON ===');
const b3 = bongeszo();
let c = b3.kattint([tablat([fejlec(), faluSor('Katapultos', 31, ['0', '0', '0', '0', '0', '0', '0', '0', '0', '1.000', '0', '0'])])]);
c.elem('kcs_jatekos').value = 'Katos';
c.elem('kcs_rogzit').onclick();
html = c.panelHtml;
s = sorbol(html, 'Katos');
all(s[2] === '0', '1000 katapult nem no a vedoszamon');
all(s[0] === '0.4', 'de a tamado oldalon szamit: 8000 pop = 0.4 nuke');
console.log('\n=== TAGONKENTI LAP: MINDEN SOR EGY TAG ===');
const b4 = bongeszo();
let j = b4.kattint([tablat([
        fejlec('Tag'),
        jatekosSor('Giccse', 101, NUKE),
        jatekosSor('Goku0709', 102, VEDO),
    ])]);
all(/2 tag sorát olvastam be/.test(j.panelHtml), 'felismerte, hogy tagonkenti a tabla');
all(sorbol(j.panelHtml, 'Giccse')[0] === '1', 'Giccse 1.0 nuke');
all(sorbol(j.panelHtml, 'Goku0709')[2] === '1', 'Goku0709 1.0 vedosereg');
all(!/A tag nevét nem találtam/.test(j.panelHtml), 'tagonkenti lapon nem ker nevet');
console.log('\n=== „?" = ISMERETLEN, NEM NULLA ===');
const b5 = bongeszo();
let q = b5.kattint([tablat([fejlec(), faluSor('Rejtozo', 41, ['?', '?', '7.000', '0', '0', '3.000', '0', '0', '300', '50', '0', '0'])])]);
all(/2 cellában/.test(q.panelHtml), 'megszamolja a „?" cellakat');
all(/alsó becslés/.test(q.panelHtml), 'es megmondja, hogy az osszeg alsó becsles');
console.log('\n=== SZAMFORMATUMOK ===');
const b6 = bongeszo();
let n = b6.kattint([tablat([
        fejlec(),
        faluSor('Pontos', 51, ['0', '0', '7.000', '0', '0', '0', '0', '0', '0', '0', '0', '0']),
        faluSor('Szokozos', 52, ['0', '0', '7 000', '0', '0', '0', '0', '0', '0', '0', '0', '0']),
        faluSor('Vesszos', 53, ['0', '0', '7,000', '0', '0', '0', '0', '0', '0', '0', '0', '0']),
    ])]);
n.elem('kcs_jatekos').value = 'Formatum';
n.elem('kcs_rogzit').onclick();
html = n.panelHtml;
// 3 x 7000 bardos = 21 000 pop; a nuke-definicio 20 900 -> 1.0
all(sorbol(html, 'Formatum')[0] === '1', 'mindharom szamformatumot ugyanugy olvassa');
all(sorbol(html, 'Formatum')[4] === '3', 'harom falu');
console.log('\n=== SAJAT NUKE-DEFINICIO ===');
const b7 = bongeszo({ nukePop: 10450, vedoPop: 26000, nemesVonatonkent: 4 });
let d = b7.kattint([tablat([fejlec(), faluSor('001', 61, NUKE)])]);
d.elem('kcs_jatekos').value = 'Felezo';
d.elem('kcs_rogzit').onclick();
html = d.panelHtml;
all(sorbol(html, 'Felezo')[0] === '2', 'felezett nuke-definicioval ketszer annyi nuke');
console.log('\n=== TOBB SORTIPUS: EGY FALUHOZ TOBB SOR ===');
// Ha vakon osszeadnank mindharom sort, ugyanazt a sereget szamolnank tobbszor,
// es az idegen tamogatas is bejonne.
const falu = (nev, id) => [
    faluSor(nev, id, NUKE),
    [{ textContent: 'A faluban' }, { textContent: '' },
        ...['0', '0', '14.000', '0', '0', '0', '0', '0', '0', '0', '0', '0'].map((x) => ({ textContent: x }))],
    [{ textContent: 'Úton lévők' }, { textContent: '' },
        ...['0', '0', '1.000', '0', '0', '0', '0', '0', '0', '0', '0', '0'].map((x) => ({ textContent: x }))],
];
const csopTabla = tablatCsoportos(fejlec(), [falu('001 - Alfa', 71), falu('002 - Beta', 72)]);
const b8 = bongeszo();
let t = b8.kattint([csopTabla]);
all(/2 falu ezen az oldalon/.test(t.panelHtml), 'ket falut lat, nem hatot');
all(t.panelHtml.includes('kcs_sor'), 'felajanlja a sortipus-valasztot');
all(t.panelHtml.includes('A faluban'), 'a sortipus nevet a tablabol olvassa ki');
t.elem('kcs_jatekos').value = 'Sortipus';
t.elem('kcs_rogzit').onclick();
html = t.panelHtml;
all(sorbol(html, 'Sortipus')[0] === '2', 'csak a valasztott sort szamolja: 2 nuke');
console.log('\n=== KLANTABLA URITESE ===');
const b9 = bongeszo();
let u = b9.kattint([tablat([fejlec(), faluSor('001', 81, NUKE)])]);
u.elem('kcs_jatekos').value = 'Torlendo';
u.elem('kcs_rogzit').onclick();
u.elem('kcs_urit').onclick();
html = u.panelHtml;
all(/A klántábla még üres/.test(html), 'urites utan ures a tabla');
console.log('\n=== HA NINCS MIT OLVASNI ===');
const zavaro = tablat([
    [{ textContent: 'Menü', kepek: ['https://x/graphic/buildings/main.png'] }],
    [{ textContent: 'Főhadiszállás' }],
]);
const b10 = bongeszo();
let z = b10.kattint([zavaro]);
all(z.riasztas !== null && /táblázat/.test(z.riasztas), 'egysegtablazat nelkul erthetoen szol');
all(z.panelHtml === '', 'es nem rajzol ures panelt');
console.log('\n=== AMIT A SCRIPT NEM TEHET (szabalyellenorzes a forrason) ===');
all(!/XMLHttpRequest|fetch\s*\(|\$\.(get|post|ajax)|getScript|sendBeacon|WebSocket/.test(FORRAS), 'nincs benne egyetlen halozati hivas sem (mas tag lapjat sem keri le)');
all(!/setInterval|setTimeout|addEventListener\s*\(\s*['"](?!click)/.test(FORRAS), 'nem fut idozitve es nem figyel jatekbeli esemenyre');
all(!/location\s*=|location\.href\s*=|location\.assign|\.submit\s*\(|\.click\s*\(\s*\)/.test(FORRAS), 'nem navigal, nem kuld urlapot es nem kattint helyetted');
all(!/eval\s*\(|atob\s*\(|fromCharCode|\\x[0-9a-f]{2}/i.test(FORRAS), 'nincs benne elfedett (obfuszkalt) kod');
console.log(`\n==== ${ok} ok, ${bukta} bukta ====`);
if (bukta)
    process.exit(1);

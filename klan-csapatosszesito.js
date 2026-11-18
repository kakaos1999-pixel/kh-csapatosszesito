/*
 * Klán csapatösszesítő  -  v2.0.0
 * ---------------------------------------------------------------------------
 * Kinek szól:  KLÁNVEZETŐNEK. A klán csapatáttekintőjén (Klán -> Tagok ->
 *              Csapatok) a vezető látja a tagok falvait és egységeit. Ez a
 *              script azt a lapot adja össze helyette - pontosan.
 *
 * Mit csinál:  a MÁR MEGNYITOTT lap táblázatát összegzi populáció (farm-hely)
 *              alapján, és kiírja, kinek mennyi a támadó- és védősereg-
 *              egyenértéke, plusz hány nemesvonata. Tagonként gyűjti: ahogy a
 *              vezető végigmegy a tagokon, úgy áll össze a klántábla.
 *
 * Mit NEM csinál:  nem kér le egyetlen oldalt sem a játékból - se másik tag
 *              lapját, se a következő oldalt. Nem küld sehova semmit, nem
 *              kattint, nem indít csapatot, nem reagál semmilyen eseményre,
 *              és nem fut magától. Egy kattintás = egy lap összesítése.
 *
 * Szabály-megfelelés (klanhaboru.hu/page/rules, §6 + Script Szabályok):
 *   - 1 kattintást helyettesít (a kézi összeadást), semmi mást,
 *   - nem küld automatikus információt, és nem reagál a fiók eseményeire,
 *   - nem nyit meg magától lapokat: amit a vezető nem nyitott meg, azt a
 *     script sem látja,
 *   - nem nyúl a gyülekezőtérhez, a Támadás/Támogatás/OK gombokhoz,
 *   - nem küld csapatot és nem gyorsítja az egységküldést,
 *   - nem működik együtt a Prémium Tőzsdével és a Farmkezelővel,
 *   - a forráskód nincs elfedve: olvasható, kommentezett, tömörítetlen.
 *
 * Az összegyűjtött tábla a böngésző saját tárolójában marad (localStorage),
 * és a vágólapra másolás is csak kattintásra fut. Hálózati hívás nincs benne.
 *
 * Licenc: MIT - szabadon használható és ellenőrizhető.
 */

(function () {
  'use strict';

  var NEV = 'Klán csapatösszesítő';
  var VERZIO = '2.0.0';
  var TAROLO = 'kcs_beallitasok';
  var KLAN_TAROLO = 'kcs_klantabla';

  /* ---------------------------------------------------------------------
   * 1) Egységadatok
   *
   * A populáció (farm/parasztház-hely) a játék hivatalos értéke. EZ a helyes
   * mérőszám, nem a darabszám: 1 könnyűlovas négy bárdossal egyenértékű helyet
   * foglal, tehát négyszer annyit is nyom a latba egy nuke összetételében.
   * ------------------------------------------------------------------- */
  var POP = {
    spear: 1, sword: 1, axe: 1, archer: 1,
    spy: 2, light: 4, marcher: 5, heavy: 6,
    ram: 5, catapult: 8, knight: 10, snob: 100
  };

  var MAGYAR = {
    spear: 'Lándzsás', sword: 'Kardforgató', axe: 'Bárdos', archer: 'Íjász',
    spy: 'Felderítő', light: 'Könnyűlovas', marcher: 'Lovas íjász',
    heavy: 'Nehézlovas', ram: 'Faltörő kos', catapult: 'Katapult',
    knight: 'Lovag', snob: 'Nemes'
  };

  /* Támadó és védő egységek.
   *
   * A FELDERÍTŐ egyik oldalon sem szerepel. Ez a legfontosabb különbség a ma
   * használt összesítőhöz képest: az a felderítő populációját a támadó ÉS a
   * védő összeghez is hozzáadja, így egy felderítőfalu egyszerre számít fél
   * nuke-nak és fél védőseregnek. A felderítő nem harcol - sem támadni, sem
   * védeni nem lehet vele. Külön oszlopban mutatjuk.
   *
   * A katapult csak a támadó oldalon van. A lovag és a nemes egyikben sincs:
   * a lovag egyedi, a nemes külön számít (vonat).
   *
   * A milícia nem foglal farmhelyet, így populáció alapon magától kimarad. */
  var TAMADO = ['axe', 'light', 'marcher', 'ram', 'catapult'];
  var VEDO = ['spear', 'sword', 'archer', 'heavy'];

  /* ---------------------------------------------------------------------
   * 2) Beállítások
   *
   * Nincs beégetett "mi a teljes nuke": világonként és klánonként más. Ezért
   * populációban kérjük be, és a számítás átlátszó marad.
   *
   * Az alapérték egy klasszikus teljes nuke: 7000 bárdos + 3000 könnyűlovas
   * + 300 faltörő + 50 katapult = 7000 + 12000 + 1500 + 400 = 20 900 pop.
   * A teljes védősereg: 7000 lándzsás + 7000 kardforgató + 2000 nehézlovas
   * = 7000 + 7000 + 12000 = 26 000 pop.
   * ------------------------------------------------------------------- */
  var ALAP = {
    nukePop: 20900,
    vedoPop: 26000,
    nemesVonatonkent: 4,
    sorPozicio: 0
  };

  function olvasTarolo(kulcs, alap) {
    try {
      var nyers = localStorage.getItem(kulcs);
      return nyers ? JSON.parse(nyers) : alap;
    } catch (e) {
      return alap;
    }
  }

  function irTarolo(kulcs, ertek) {
    try { localStorage.setItem(kulcs, JSON.stringify(ertek)); return true; }
    catch (e) { return false; }
  }

  function beallitasok() {
    var m = olvasTarolo(TAROLO, {}) || {};
    return {
      nukePop: +m.nukePop > 0 ? +m.nukePop : ALAP.nukePop,
      vedoPop: +m.vedoPop > 0 ? +m.vedoPop : ALAP.vedoPop,
      nemesVonatonkent: +m.nemesVonatonkent > 0 ? +m.nemesVonatonkent : ALAP.nemesVonatonkent,
      sorPozicio: +m.sorPozicio > 0 ? +m.sorPozicio : ALAP.sorPozicio
    };
  }

  /** A klántábla: játékosnév -> { falvak: { faluKulcs: egysegek } }. */
  function klantabla() {
    var t = olvasTarolo(KLAN_TAROLO, {});
    return t && typeof t === 'object' ? t : {};
  }

  /* ---------------------------------------------------------------------
   * 3) A táblázat megtalálása és az oszlopok beazonosítása
   *
   * Az egységeket a fejléc KÉPEIRŐL ismerjük fel (unit_axe.png), nem a
   * feliratról és nem az oszlop sorszámából. Így a script nyelvfüggetlen, és
   * nem csúszik el akkor sem, ha a lapon van egy pont- vagy kontinensoszlop
   * az egységek előtt.
   * ------------------------------------------------------------------- */
  function egysegKulcs(img) {
    var m = /unit_([a-z_]+)\.(?:png|webp|gif)/i.exec(img.getAttribute('src') || '');
    if (!m) return null;
    var kulcs = m[1].toLowerCase();
    return POP[kulcs] !== undefined ? kulcs : null;
  }

  function egysegOszlopok(sor) {
    var terkep = {};
    var db = 0;
    var cellak = sor.cells;
    for (var j = 0; j < cellak.length; j++) {
      var kepek = cellak[j].getElementsByTagName('img');
      for (var k = 0; k < kepek.length; k++) {
        var kulcs = egysegKulcs(kepek[k]);
        if (kulcs && terkep[j] === undefined) { terkep[j] = kulcs; db++; }
      }
    }
    return { terkep: terkep, db: db };
  }

  function oszlopterkep(tabla) {
    for (var i = 0; i < tabla.rows.length && i < 5; i++) {
      var t = egysegOszlopok(tabla.rows[i]);
      // Legalább négy egységoszlop kell, hogy ne egy véletlen ikonos táblázatot
      // kezdjünk el olvasni.
      if (t.db >= 4) return { fejlec: i, terkep: t.terkep, db: t.db };
    }
    return null;
  }

  function fotabla() {
    var tablak = document.getElementsByTagName('table');
    var legjobb = null;
    for (var i = 0; i < tablak.length; i++) {
      var t = oszlopterkep(tablak[i]);
      if (t && (!legjobb || t.db > legjobb.terkepInfo.db)) {
        legjobb = { tabla: tablak[i], terkepInfo: t };
      }
    }
    return legjobb;
  }

  /**
   * „1.234" / „1 234" / „1,234" -> 1234.
   * A „?" nem nulla: azt jelenti, hogy a tag nem osztja meg az adatot. Ezt
   * külön jelezzük, mert különben csendben lefelé hazudna az összeg.
   */
  function szam(szoveg) {
    var sz = (szoveg || '').trim();
    if (sz.indexOf('?') >= 0) return { ertek: 0, ismeretlen: true };
    var tiszta = sz.replace(/[^\d]/g, '');
    if (!tiszta) return { ertek: 0, ismeretlen: false };
    var n = parseInt(tiszta, 10);
    return { ertek: isFinite(n) ? n : 0, ismeretlen: false };
  }

  /**
   * A sor neve: a falu vagy a tag neve.
   *
   * Elsőként a LINKES cellát nézzük (a falu- vagy profillink mindig a néven
   * van) - ettől a „001"-féle, csupa számjegyből álló falunév sem vész el.
   * Ha nincs link, az első olyan cella jön, ami nem puszta szám: így a
   * pontoszlop nem lesz névvé.
   */
  function sorCimke(sor, terkep) {
    var elsoNemUres = '';
    for (var j = 0; j < sor.cells.length; j++) {
      if (terkep[j] !== undefined) break;
      var sz = (sor.cells[j].textContent || '').replace(/\s+/g, ' ').trim();
      if (!sz) continue;
      if (sor.cells[j].getElementsByTagName('a').length) return sz;
      if (!elsoNemUres && !/^\d[\d.,\s]*$/.test(sz)) elsoNemUres = sz;
    }
    return elsoNemUres;
  }

  /** A sor azonosítója: faluazonosító a linkből, vagy koordináta a szövegből. */
  function sorKulcs(sor, terkep, cimke) {
    for (var j = 0; j < sor.cells.length; j++) {
      if (terkep[j] !== undefined) break;
      var linkek = sor.cells[j].getElementsByTagName('a');
      for (var k = 0; k < linkek.length; k++) {
        var href = linkek[k].getAttribute('href') || '';
        var m = /(?:[?&](?:village|id)=)(\d+)/.exec(href);
        if (m) return 'v' + m[1];
      }
    }
    var koord = /(\d{1,3}\|\d{1,3})/.exec(cimke || '');
    if (koord) return 'k' + koord[1];
    return cimke ? 'n' + cimke : '';
  }

  /**
   * Játékossorok-e, vagy falusorok?
   *
   * Játékossor: az első cellából info_player linkre mutat. Falusor: falulink
   * vagy koordináta van benne. Ettől függ, hogy egy sor egy TAG összesenje,
   * vagy egy FALU.
   */
  function jatekossorE(sor, terkep) {
    for (var j = 0; j < sor.cells.length; j++) {
      if (terkep[j] !== undefined) break;
      var linkek = sor.cells[j].getElementsByTagName('a');
      for (var k = 0; k < linkek.length; k++) {
        var href = linkek[k].getAttribute('href') || '';
        if (/info_player|mode=member_wall|player_id=/.test(href)) return true;
      }
    }
    return false;
  }

  /* ---------------------------------------------------------------------
   * 3/b) Sortípusok
   *
   * Egy faluhoz TÖBB sor is tartozhat, ha több sortípus van bekapcsolva
   * („saját csapatok", „a faluban - idegennel együtt", „úton lévők").
   * Ilyenkor a játék falvanként külön <tbody>-ba teszi a sorokat. Ha vakon
   * összeadnánk őket, ugyanazt a sereget számolnánk többször, az idegen
   * támogatást pedig sajátként vennénk be. Ezért választani kell.
   * ------------------------------------------------------------------- */
  function adatSorE(sor, terkep) {
    for (var j in terkep) {
      if (!Object.prototype.hasOwnProperty.call(terkep, j)) continue;
      if (sor.cells[j]) return true;
    }
    return false;
  }

  function csoportok(tabla, terkepInfo) {
    var tbodyk = tabla.tBodies || [];
    if (!tbodyk.length || tbodyk.length < 2) return null;

    var ki = [];
    var max = 0;
    for (var i = 0; i < tbodyk.length; i++) {
      var sorok = [];
      var tsorok = tbodyk[i].rows || [];
      for (var j = 0; j < tsorok.length; j++) {
        if (egysegOszlopok(tsorok[j]).db >= 4) continue;       // fejléc
        if (!adatSorE(tsorok[j], terkepInfo.terkep)) continue;
        sorok.push(tsorok[j]);
      }
      if (!sorok.length) continue;
      if (sorok.length > max) max = sorok.length;
      ki.push(sorok);
    }

    if (!ki.length || max < 2 || max > 6) return null;
    return { csoportok: ki, sortipusDb: max };
  }

  function sortipusNev(csoportLista, p, terkep) {
    var szamlalo = {};
    for (var i = 0; i < csoportLista.length; i++) {
      var sor = csoportLista[i][p];
      if (!sor) continue;
      var sz = sorCimke(sor, terkep);
      if (!sz) continue;
      szamlalo[sz] = (szamlalo[sz] || 0) + 1;
    }
    var legtobb = '', db = 0;
    for (var k in szamlalo) {
      if (szamlalo[k] > db) { db = szamlalo[k]; legtobb = k; }
    }
    if (db >= 2 && db >= csoportLista.length / 2) return legtobb;
    return '';
  }

  /* ---------------------------------------------------------------------
   * 4) Kinek a lapját nézzük?
   *
   * A tag-csapatáttekintő címében ott a player_id. A nevet a lapon keressük
   * meg hozzá (legördülő vagy profil-link). Ha nem találjuk, a panelen be
   * lehet írni - nem tippelünk a vezető helyett.
   * ------------------------------------------------------------------- */
  function cimParameter(nev) {
    try {
      var keres = (window && window.location && window.location.search) || '';
      var m = new RegExp('[?&]' + nev + '=([^&]+)').exec(keres);
      return m ? decodeURIComponent(m[1]) : '';
    } catch (e) {
      return '';
    }
  }

  function jatekosNev() {
    var id = cimParameter('player_id');
    if (!id) return '';

    // 1) Legördülő, amiben a tag ki van választva.
    var selectek = document.getElementsByTagName('select');
    for (var i = 0; i < selectek.length; i++) {
      var opciok = selectek[i].getElementsByTagName('option');
      for (var j = 0; j < opciok.length; j++) {
        if (String(opciok[j].value) === String(id)) {
          var sz = (opciok[j].textContent || '').trim();
          if (sz) return sz;
        }
      }
    }

    // 2) Profil-link ugyanerre az azonosítóra.
    var linkek = document.getElementsByTagName('a');
    for (var k = 0; k < linkek.length; k++) {
      var href = linkek[k].getAttribute('href') || '';
      if (!/info_player/.test(href)) continue;
      var m = /[?&]id=(\d+)/.exec(href);
      if (m && m[1] === id) {
        var sz2 = (linkek[k].textContent || '').replace(/\s+/g, ' ').trim();
        if (sz2) return sz2;
      }
    }
    return '';
  }

  /* ---------------------------------------------------------------------
   * 5) Beolvasás
   * ------------------------------------------------------------------- */
  function sorEgysegei(sor, terkep) {
    var egysegek = {};
    var vanSzam = false;
    var ismeretlen = 0;
    for (var j in terkep) {
      if (!Object.prototype.hasOwnProperty.call(terkep, j)) continue;
      var cella = sor.cells[j];
      if (!cella) continue;
      var sz = szam(cella.textContent);
      egysegek[terkep[j]] = sz.ertek;
      if (sz.ismeretlen) ismeretlen++;
      if (sz.ertek > 0) vanSzam = true;
    }
    return { egysegek: egysegek, vanSzam: vanSzam, ismeretlen: ismeretlen };
  }

  function beolvas(b) {
    var talalat = fotabla();
    if (!talalat) return null;

    var terkep = talalat.terkepInfo.terkep;
    var cs = csoportok(talalat.tabla, talalat.terkepInfo);
    var nyersSorok = [];
    var sortipusok = [];
    var pozicio = 0;

    if (cs) {
      pozicio = Math.min(b.sorPozicio || 0, cs.sortipusDb - 1);
      for (var p = 0; p < cs.sortipusDb; p++) {
        sortipusok.push(sortipusNev(cs.csoportok, p, terkep));
      }
      for (var i = 0; i < cs.csoportok.length; i++) {
        var fejsor = cs.csoportok[i][0];
        var valasztott = cs.csoportok[i][pozicio];
        if (!valasztott) continue;
        nyersSorok.push({ fejsor: fejsor, adatsor: valasztott });
      }
    } else {
      for (var r = talalat.terkepInfo.fejlec + 1; r < talalat.tabla.rows.length; r++) {
        nyersSorok.push({ fejsor: talalat.tabla.rows[r], adatsor: talalat.tabla.rows[r] });
      }
    }

    var sorok = [];
    var ismeretlen = 0;
    var jatekosSorok = 0;
    for (var s = 0; s < nyersSorok.length; s++) {
      var fej = nyersSorok[s].fejsor;
      var e = sorEgysegei(nyersSorok[s].adatsor, terkep);
      var cimke = sorCimke(fej, terkep);
      // Név és legalább egy szám kell. Az összegző sorokban jellemzően nincs
      // név, így azok kimaradnak - nem adjuk hozzá a részletekhez.
      if (!cimke || !e.vanSzam) continue;
      ismeretlen += e.ismeretlen;
      var jatekos = jatekossorE(fej, terkep);
      if (jatekos) jatekosSorok++;
      sorok.push({
        cimke: cimke,
        kulcs: sorKulcs(fej, terkep, cimke),
        egysegek: e.egysegek,
        jatekos: jatekos
      });
    }

    // Ha a sorok többsége játékosprofilra mutat, akkor ez egy tagokat
    // felsoroló tábla; különben egy tag falvai.
    var mod = sorok.length && jatekosSorok >= sorok.length / 2 ? 'jatekos' : 'falu';

    return {
      sorok: sorok,
      mod: mod,
      egysegDb: talalat.terkepInfo.db,
      sortipusok: sortipusok,
      sorPozicio: pozicio,
      ismeretlen: ismeretlen
    };
  }

  /* ---------------------------------------------------------------------
   * 6) Rögzítés a klántáblába
   *
   * Falusorok: a megnyitott lap falvai egy taghoz tartoznak. Faluazonosító
   * szerint tároljuk, ezért ugyanannak a lapnak az újbóli megnyitása NEM
   * duplázza az összeget, és a több oldalra tördelt lista oldalai szépen
   * összeadódnak, ahogy a vezető lapoz.
   *
   * Játékossorok: minden sor egy tag összesenje, egy kulcs alatt.
   * ------------------------------------------------------------------- */
  function rogzit(tabla, adat, jatekos) {
    if (adat.mod === 'jatekos') {
      for (var i = 0; i < adat.sorok.length; i++) {
        var s = adat.sorok[i];
        tabla[s.cimke] = { falvak: { osszesen: s.egysegek } };
      }
      return adat.sorok.length;
    }
    if (!jatekos) return 0;
    if (!tabla[jatekos]) tabla[jatekos] = { falvak: {} };
    if (!tabla[jatekos].falvak) tabla[jatekos].falvak = {};
    for (var j = 0; j < adat.sorok.length; j++) {
      var f = adat.sorok[j];
      if (!f.kulcs) continue;
      tabla[jatekos].falvak[f.kulcs] = f.egysegek;
    }
    return adat.sorok.length;
  }

  /* ---------------------------------------------------------------------
   * 7) Számítás
   *
   * Populáció-összegzés, utána osztás. NEM kategorizálunk falvanként: ha
   * valakinek két fél nuke-ja van, az egy egész - a darabolós módszer ezt
   * vagy elveszti, vagy kétszer számolja.
   * ------------------------------------------------------------------- */
  function popOsszeg(egysegek, lista) {
    var osszeg = 0;
    for (var i = 0; i < lista.length; i++) {
      var u = lista[i];
      osszeg += (egysegek[u] || 0) * POP[u];
    }
    return osszeg;
  }

  function szamol(tabla, b) {
    var ki = [];
    for (var nev in tabla) {
      if (!Object.prototype.hasOwnProperty.call(tabla, nev)) continue;
      var falvak = (tabla[nev] && tabla[nev].falvak) || {};
      var ossz = {};
      var faluDb = 0;
      for (var kulcs in falvak) {
        if (!Object.prototype.hasOwnProperty.call(falvak, kulcs)) continue;
        faluDb++;
        var e = falvak[kulcs];
        for (var u in e) {
          if (!Object.prototype.hasOwnProperty.call(e, u)) continue;
          ossz[u] = (ossz[u] || 0) + (e[u] || 0);
        }
      }
      var tamadoPop = popOsszeg(ossz, TAMADO);
      var vedoPop = popOsszeg(ossz, VEDO);
      var nemes = ossz.snob || 0;
      ki.push({
        cimke: nev,
        egysegek: ossz,
        faluDb: faluDb,
        tamadoPop: tamadoPop,
        vedoPop: vedoPop,
        nuke: tamadoPop / b.nukePop,
        vedo: vedoPop / b.vedoPop,
        nemes: nemes,
        felderito: ossz.spy || 0,
        vonat: Math.floor(nemes / b.nemesVonatonkent)
      });
    }
    ki.sort(function (a, c) { return c.nuke - a.nuke; });
    return ki;
  }

  function kerekit(n) { return Math.round(n * 10) / 10; }
  function szoveg(sz) { return String(sz == null ? '' : sz).replace(/[<>&"]/g, ''); }

  /* ---------------------------------------------------------------------
   * 8) Megjelenítés
   * ------------------------------------------------------------------- */
  function panelt(eredmeny, b, adat, allapot) {
    var regi = document.getElementById('kcs_panel');
    if (regi) regi.parentNode.removeChild(regi);

    var osszNuke = 0, osszVonat = 0, osszVedo = 0, osszFalu = 0;
    for (var i = 0; i < eredmeny.length; i++) {
      osszNuke += eredmeny[i].nuke;
      osszVonat += eredmeny[i].vonat;
      osszVedo += eredmeny[i].vedo;
      osszFalu += eredmeny[i].faluDb;
    }

    var panel = document.createElement('div');
    panel.id = 'kcs_panel';
    panel.style.cssText =
      'position:fixed;top:40px;right:20px;z-index:99999;width:min(620px,94vw);' +
      'max-height:86vh;overflow:auto;background:#f4e4bc;border:2px solid #7d510f;' +
      'border-radius:6px;padding:10px 12px;font:12px Verdana,Arial,sans-serif;' +
      'color:#000;box-shadow:0 6px 22px rgba(0,0,0,.4);';

    var html = '';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">';
    html += '<b style="font-size:13px;">' + NEV + ' <span style="font-weight:normal;color:#603000;">v' + VERZIO + '</span></b>';
    html += '<button id="kcs_bezar" style="cursor:pointer;">Bezár</button>';
    html += '</div>';

    /* Mit olvastunk be ezen a lapon. */
    html += '<div style="margin:8px 0;padding:6px;background:#f6e0c0;border:1px solid #c1a264;">';
    if (adat.mod === 'jatekos') {
      html += '<b>Ez a lap tagonként összesít.</b> ' + adat.sorok.length + ' tag sorát olvastam be.';
    } else {
      html += '<b>Ez a lap egy tag falvait mutatja.</b> ' + adat.sorok.length + ' falu ezen az oldalon.';
      html += '<br>Tag: <input id="kcs_jatekos" type="text" value="' + szoveg(allapot.jatekos) + '" ' +
              'placeholder="a tag neve" style="width:180px"> ' +
              '<button id="kcs_rogzit" style="cursor:pointer;">Hozzáadás a klántáblához</button>';
      if (!allapot.jatekos) {
        html += '<br><span style="color:#8a2a00;">A tag nevét nem találtam meg a lapon - írd be, mielőtt hozzáadod.</span>';
      }
      html += '<br><span style="color:#603000;">Több oldalas lista: lapozz a játékban, és minden oldalon kattints ' +
              'újra. Falvanként tárolom, ezért semmi nem duplázódik.</span>';
    }
    if (adat.ismeretlen) {
      html += '<br><span style="color:#8a2a00;"><b>' + adat.ismeretlen + ' cellában „?" áll</b> ' +
              '(a tag nem osztja meg) - ezek nullaként szerepelnek, tehát az összeg alsó becslés.</span>';
    }
    if (allapot.uzenet) {
      html += '<br><b style="color:#1d5c2a;">' + szoveg(allapot.uzenet) + '</b>';
    }
    html += '</div>';

    /* Sortípus-választó: csak ha egy faluhoz tényleg több sor tartozik. */
    if (adat.sortipusok && adat.sortipusok.length > 1) {
      html += '<div style="margin:8px 0;padding:6px;background:#f6e0c0;border:1px solid #c1a264;">';
      html += '<b>Több sortípus van bekapcsolva</b> - egy faluhoz ' + adat.sortipusok.length +
              ' sor tartozik. Csak a kiválasztott sort számolom, hogy ne adódjon össze kétszer ' +
              'ugyanaz a sereg (és ne kerüljön bele idegen támogatás).<br>';
      html += 'Számolt sor: <select id="kcs_sor">';
      for (var p = 0; p < adat.sortipusok.length; p++) {
        var snev = adat.sortipusok[p] ? szoveg(adat.sortipusok[p]) : (p + 1) + '. sor';
        html += '<option value="' + p + '"' + (p === adat.sorPozicio ? ' selected' : '') + '>' +
                (p + 1) + '. - ' + snev + '</option>';
      }
      html += '</select> <button id="kcs_sorujra" style="cursor:pointer;">Újraolvasás</button>';
      html += '</div>';
    }

    html += '<div style="margin:8px 0;padding:6px;background:#e3d5b0;border:1px solid #c1a264;">';
    html += '<b>Klántábla összesen:</b> ' + kerekit(osszNuke) + ' nuke · ' + osszVonat + ' nemesvonat · ' +
            kerekit(osszVedo) + ' védősereg <span style="color:#603000;">(' + eredmeny.length +
            ' tag, ' + osszFalu + ' falu)</span>';
    html += '</div>';

    html += '<div style="margin:8px 0;padding:6px;background:#e3d5b0;border:1px solid #c1a264;">';
    html += '<b>Mihez viszonyítunk</b> (populáció, módosítható):<br>';
    html += '1 teljes nuke = <input id="kcs_nuke" type="number" min="1" step="100" value="' + b.nukePop + '" style="width:80px"> pop · ';
    html += '1 teljes védősereg = <input id="kcs_vedo" type="number" min="1" step="100" value="' + b.vedoPop + '" style="width:80px"> pop · ';
    html += 'vonat = <input id="kcs_nemes" type="number" min="1" step="1" value="' + b.nemesVonatonkent + '" style="width:44px"> nemes ';
    html += '<button id="kcs_ujra" style="cursor:pointer;">Újraszámol</button>';
    html += '</div>';

    html += '<table style="width:100%;border-collapse:collapse;">';
    html += '<tr style="background:#c1a264;"><th style="text-align:left;padding:3px;">Tag</th>' +
            '<th style="padding:3px;">Nuke</th><th style="padding:3px;">Vonat</th>' +
            '<th style="padding:3px;">Védő</th><th style="padding:3px;">Felderítő</th>' +
            '<th style="padding:3px;">Falu</th></tr>';
    if (!eredmeny.length) {
      html += '<tr><td colspan="6" style="padding:8px;color:#603000;">A klántábla még üres. ' +
              'Nyisd meg egy tag csapatáttekintőjét, és add hozzá.</td></tr>';
    }
    for (var k = 0; k < eredmeny.length; k++) {
      var s = eredmeny[k];
      html += '<tr style="border-bottom:1px solid #d7c096;">' +
        '<td style="padding:3px;">' + szoveg(s.cimke) + '</td>' +
        '<td style="padding:3px;text-align:right;"><b>' + kerekit(s.nuke) + '</b></td>' +
        '<td style="padding:3px;text-align:right;">' + s.vonat + '</td>' +
        '<td style="padding:3px;text-align:right;">' + kerekit(s.vedo) + '</td>' +
        '<td style="padding:3px;text-align:right;color:#603000;">' + s.felderito.toLocaleString('hu-HU') + '</td>' +
        '<td style="padding:3px;text-align:right;color:#603000;">' + s.faluDb + '</td>' +
        '</tr>';
    }
    html += '</table>';

    html += '<div style="margin-top:8px;">';
    html += '<button id="kcs_masol" style="cursor:pointer;">Klántábla másolása</button> ';
    html += '<button id="kcs_urit" style="cursor:pointer;">Klántábla ürítése</button> ';
    html += '<span id="kcs_uzenet" style="color:#603000;"></span>';
    html += '</div>';

    html += '<div style="margin-top:8px;font-size:11px;color:#603000;line-height:1.5;">' +
      'A számítás populáció alapján megy: minden egység a játékbeli farm-helyével súlyozva, ' +
      'és csak a végén osztunk - így két fél nuke egy egész. ' +
      'A felderítő SEM a támadó, SEM a védő összegben nincs benne (nem harcol), a lovag és a ' +
      'nemes szintén nincs; a katapult csak a támadó oldalon. ' +
      'A script nem kér le egyetlen lapot sem és nem küld sehova adatot - csak azt adja össze, ' +
      'ami a megnyitott lapon amúgy is látszik.' +
      '</div>';

    panel.innerHTML = html;
    document.body.appendChild(panel);

    document.getElementById('kcs_bezar').onclick = function () {
      panel.parentNode.removeChild(panel);
    };

    function mentBeallitas(sorPozicio) {
      irTarolo(TAROLO, {
        nukePop: +document.getElementById('kcs_nuke').value || ALAP.nukePop,
        vedoPop: +document.getElementById('kcs_vedo').value || ALAP.vedoPop,
        nemesVonatonkent: +document.getElementById('kcs_nemes').value || ALAP.nemesVonatonkent,
        sorPozicio: sorPozicio
      });
    }

    document.getElementById('kcs_ujra').onclick = function () {
      mentBeallitas(adat.sorPozicio || 0);
      futtat({ jatekos: allapot.jatekos });
    };

    if (adat.sortipusok && adat.sortipusok.length > 1) {
      document.getElementById('kcs_sorujra').onclick = function () {
        mentBeallitas(+document.getElementById('kcs_sor').value || 0);
        futtat({ jatekos: allapot.jatekos });
      };
    }

    if (adat.mod === 'falu') {
      document.getElementById('kcs_rogzit').onclick = function () {
        var nev = (document.getElementById('kcs_jatekos').value || '').trim();
        if (!nev) {
          document.getElementById('kcs_uzenet').textContent = 'Írd be a tag nevét.';
          return;
        }
        var t = klantabla();
        var db = rogzit(t, adat, nev);
        irTarolo(KLAN_TAROLO, t);
        futtat({ jatekos: nev, uzenet: nev + ': ' + db + ' falu hozzáadva.' });
      };
    }

    document.getElementById('kcs_urit').onclick = function () {
      irTarolo(KLAN_TAROLO, {});
      futtat({ jatekos: allapot.jatekos, uzenet: 'A klántábla kiürítve.' });
    };

    document.getElementById('kcs_masol').onclick = function () {
      masol(tsv(eredmeny), function (ok) {
        document.getElementById('kcs_uzenet').textContent =
          ok ? 'Kimásolva.' : 'A vágólap nem elérhető - jelöld ki a táblázatot kézzel.';
      });
    };
  }

  /* ---------------------------------------------------------------------
   * 9) Másolás
   *
   * Tabulátorral tagolt sorok: ez illeszthető be táblázatkezelőbe, jegyzetbe,
   * bárhova. A másolás KIZÁRÓLAG a felhasználó kattintására fut le, és a
   * szöveg a saját gépén marad.
   * ------------------------------------------------------------------- */
  function tsv(eredmeny) {
    var sorok = ['nev\tnuke\tvonat\tvedo\ttamado_pop\tvedo_pop\tnemes\tfelderito\tfalu'];
    for (var i = 0; i < eredmeny.length; i++) {
      var s = eredmeny[i];
      sorok.push([
        s.cimke, kerekit(s.nuke), s.vonat, kerekit(s.vedo),
        s.tamadoPop, s.vedoPop, s.nemes, s.felderito, s.faluDb
      ].join('\t'));
    }
    return sorok.join('\n');
  }

  function masol(sz, kesz) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(sz).then(function () { kesz(true); }, function () { tartalek(); });
    } else {
      tartalek();
    }
    function tartalek() {
      var ta = document.createElement('textarea');
      ta.value = sz;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      kesz(ok);
    }
  }

  /* ---------------------------------------------------------------------
   * 10) Indítás - ez az EGY kattintás, amit a script helyettesít
   * ------------------------------------------------------------------- */
  function futtat(allapot) {
    allapot = allapot || {};
    var b = beallitasok();
    var adat = beolvas(b);
    if (!adat) {
      alert(NEV + ':\n\nNem találtam egységeket tartalmazó táblázatot ezen a lapon.\n\n' +
            'Nyisd meg a klán csapatáttekintőjét (Klán -> Tagok -> Csapatok), ' +
            'és ott indítsd el.');
      return;
    }
    if (!adat.sorok.length) {
      alert(NEV + ':\n\nMegtaláltam a táblázatot, de egyetlen értékelhető sort sem olvastam ki belőle.');
      return;
    }

    var tabla = klantabla();
    var jatekos = allapot.jatekos || jatekosNev();

    // A tagonkénti tábla minden sora egy kész összesen: azt rögtön felvesszük.
    // A falusoros lapot a vezető erősíti meg, mert a név tőle jön.
    if (adat.mod === 'jatekos') {
      rogzit(tabla, adat, null);
      irTarolo(KLAN_TAROLO, tabla);
    }

    panelt(szamol(tabla, b), b, adat, { jatekos: jatekos, uzenet: allapot.uzenet });
  }

  futtat();
})();

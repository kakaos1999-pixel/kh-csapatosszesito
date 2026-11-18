/*
 * Klán csapatösszesítő  -  v1.1.0
 * ---------------------------------------------------------------------------
 * Mit csinál:  a MÁR MEGNYITOTT csapatáttekintő táblázatát összeadja, és
 *              populáció (farm) alapján kiszámolja, mennyi támadó- és
 *              védősereg-egyenértéke van, plusz hány nemesvonata.
 *
 * Mit NEM csinál:  nem küld sehova semmit, nem kér le egyetlen oldalt sem a
 *              játékból, nem kattint, nem nevez át, nem indít csapatot, nem
 *              reagál semmilyen eseményre, és nem fut magától. Egy kattintás
 *              = egy összesítés a képernyőn. Utána nem csinál többet semmit.
 *
 * Miért kell:  a vezetőnek ma kézzel kell összeadnia 12 oszlopot sok száz
 *              soron, vagy a tagok bediktálják a számokat - mindkettő hibázik.
 *              Ez a script ugyanazt az adatot adja össze, ami már ott van a
 *              képernyőn.
 *
 * Szabály-megfelelés (klanhaboru.hu/page/rules, §6 + Script Szabályok):
 *   - 1 kattintást helyettesít (a kézi összeadást), semmi mást,
 *   - nem küld automatikus információt, és nem reagál a fiók eseményeire,
 *   - nem nyúl a gyülekezőtérhez, a Támadás/Támogatás/OK gombokhoz,
 *   - nem küld csapatot és nem gyorsítja az egységküldést,
 *   - nem működik együtt a Prémium Tőzsdével és a Farmkezelővel,
 *   - a forráskód nincs elfedve: olvasható, kommentezett, tömörítetlen.
 *
 * A vágólapra másolás CSAK a felhasználó kattintására történik, és a saját
 * gépén marad - a script semmilyen hálózati hívást nem végez.
 *
 * Licenc: szabadon használható és ellenőrizhető.
 */

(function () {
  'use strict';

  var NEV = 'Klán csapatösszesítő';
  var VERZIO = '1.1.0';
  var TAROLO = 'kcs_beallitasok';

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
   * A katapult SZÁNDÉKOSAN csak a támadó oldalon szerepel. Több elterjedt
   * összesítő mindkét listába beteszi, és így ugyanazt a populációt kétszer
   * számolja - attól a védőszám felfelé hazudik.
   *
   * A felderítő, a lovag és a nemes egyikbe sem tartozik: a felderítő nem
   * harcol, a lovag egyedi, a nemes pedig külön számít (vonat). Ezeket külön
   * soroljuk fel, nem keverjük a sereg-egyenértékbe.
   *
   * A milícia nem szerepel: nem foglal farmhelyet, tehát populáció alapon
   * önmagától kimarad. */
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

  function beallitasok() {
    try {
      var mentett = JSON.parse(localStorage.getItem(TAROLO) || '{}');
      return {
        nukePop: +mentett.nukePop > 0 ? +mentett.nukePop : ALAP.nukePop,
        vedoPop: +mentett.vedoPop > 0 ? +mentett.vedoPop : ALAP.vedoPop,
        nemesVonatonkent: +mentett.nemesVonatonkent > 0 ? +mentett.nemesVonatonkent : ALAP.nemesVonatonkent,
        sorPozicio: +mentett.sorPozicio > 0 ? +mentett.sorPozicio : ALAP.sorPozicio
      };
    } catch (e) {
      return {
        nukePop: ALAP.nukePop, vedoPop: ALAP.vedoPop,
        nemesVonatonkent: ALAP.nemesVonatonkent, sorPozicio: ALAP.sorPozicio
      };
    }
  }

  function beallitastMent(b) {
    try { localStorage.setItem(TAROLO, JSON.stringify(b)); } catch (e) { /* privát ablak */ }
  }

  /* ---------------------------------------------------------------------
   * 3) A táblázat megtalálása és az oszlopok beazonosítása
   *
   * Az egységeket a fejléc KÉPEIRŐL ismerjük fel (unit_axe.png), nem a
   * feliratról: így a script nyelvfüggetlen, és akkor sem áll le, ha a játék
   * átfogalmaz egy fejlécet.
   * ------------------------------------------------------------------- */
  function egysegKulcs(img) {
    var m = /unit_([a-z_]+)\.(?:png|webp|gif)/i.exec(img.getAttribute('src') || '');
    if (!m) return null;
    var kulcs = m[1].toLowerCase();
    return POP[kulcs] !== undefined ? kulcs : null;
  }

  /** Egy sorban hány egység-ikonos oszlop van (fejléc-felismeréshez). */
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

  /** Egy táblázat fejlécsorának feltérképezése: oszlopindex → egység. */
  function oszlopterkep(tabla) {
    for (var i = 0; i < tabla.rows.length && i < 5; i++) {
      var t = egysegOszlopok(tabla.rows[i]);
      // Legalább négy egységoszlop kell, hogy ne egy véletlen ikonos táblázatot
      // kezdjünk el olvasni.
      if (t.db >= 4) return { fejlec: i, terkep: t.terkep, db: t.db };
    }
    return null;
  }

  /** A legtöbb egységoszlopot tartalmazó táblázat a lapon. */
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

  /** „1.234" / „1 234" / „1,234" → 1234. Üres vagy kötőjel → 0. */
  function szam(szoveg) {
    var tiszta = (szoveg || '').replace(/[^\d]/g, '');
    if (!tiszta) return 0;
    var n = parseInt(tiszta, 10);
    return isFinite(n) ? n : 0;
  }

  /** A sor címkéje: a játékos vagy falu neve az első értelmes cellából. */
  function sorCimke(sor, terkep) {
    for (var j = 0; j < sor.cells.length; j++) {
      if (terkep[j] !== undefined) break;
      var sz = (sor.cells[j].textContent || '').replace(/\s+/g, ' ').trim();
      if (sz && !/^\d+$/.test(sz)) return sz;
    }
    return '';
  }

  /* ---------------------------------------------------------------------
   * 3/b) Sortípusok
   *
   * Az egység-áttekintőben egy faluhoz TÖBB sor is tartozhat, ha a játékos
   * több sortípust kapcsolt be: „saját csapatok", „a faluban (idegennel
   * együtt)", „úton lévők". Ilyenkor a játék falvanként külön <tbody>-ba
   * teszi a sorokat.
   *
   * Ha ezeket vakon összeadnánk, ugyanazt a sereget többször számolnánk, az
   * idegen támogatást pedig sajátként vennénk be. Ezért: felismerjük a
   * sortípusokat, és a felhasználó választja ki, melyiket összegezzük.
   * Alapértelmezés az első sor. Semmit nem adunk össze a háta mögött.
   * ------------------------------------------------------------------- */
  function adatSorE(sor, terkep) {
    for (var j in terkep) {
      if (!Object.prototype.hasOwnProperty.call(terkep, j)) continue;
      if (sor.cells[j]) return true;
    }
    return false;
  }

  /** Falvankénti <tbody>-csoportok, vagy null, ha a tábla egysoros szerkezetű. */
  function csoportok(tabla, terkepInfo) {
    var tbodyk = tabla.tBodies || [];
    if (!tbodyk.length || tbodyk.length < 2) return null;

    var ki = [];
    var max = 0;
    for (var i = 0; i < tbodyk.length; i++) {
      var sorok = [];
      var tsorok = tbodyk[i].rows || [];
      for (var j = 0; j < tsorok.length; j++) {
        // A fejlécsort (négy vagy több egység-ikon) kihagyjuk.
        if (egysegOszlopok(tsorok[j]).db >= 4) continue;
        if (!adatSorE(tsorok[j], terkepInfo.terkep)) continue;
        sorok.push(tsorok[j]);
      }
      if (!sorok.length) continue;
      if (sorok.length > max) max = sorok.length;
      ki.push(sorok);
    }

    // Egy sor per falu → nincs mit választani, marad a sima olvasás.
    // Hatnál több sor per csoport már nem sortípus, hanem valami más tábla.
    if (!ki.length || max < 2 || max > 6) return null;
    return { csoportok: ki, sortipusDb: max };
  }

  /** A p. sorpozíció neve, a sorok első cellájából (nyelvfüggetlen). */
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
    // Ha minden sorban más a szöveg (pl. falunevek), az nem sortípusnév.
    if (db >= 2 && db >= csoportLista.length / 2) return legtobb;
    return '';
  }

  /* ---------------------------------------------------------------------
   * 4) Beolvasás
   * ------------------------------------------------------------------- */
  function sorEgysegei(sor, terkep) {
    var egysegek = {};
    var vanSzam = false;
    for (var j in terkep) {
      if (!Object.prototype.hasOwnProperty.call(terkep, j)) continue;
      var cella = sor.cells[j];
      if (!cella) continue;
      var db = szam(cella.textContent);
      egysegek[terkep[j]] = db;
      if (db > 0) vanSzam = true;
    }
    return { egysegek: egysegek, vanSzam: vanSzam };
  }

  function beolvas(b) {
    var talalat = fotabla();
    if (!talalat) return null;

    var terkep = talalat.terkepInfo.terkep;
    var cs = csoportok(talalat.tabla, talalat.terkepInfo);
    var sorok = [];
    var sortipusok = [];
    var pozicio = 0;

    if (cs) {
      /* Falvankénti csoportok: egy falu = egy sorozat sortípus. */
      pozicio = Math.min(b.sorPozicio || 0, cs.sortipusDb - 1);
      for (var p = 0; p < cs.sortipusDb; p++) {
        sortipusok.push(sortipusNev(cs.csoportok, p, terkep));
      }
      for (var i = 0; i < cs.csoportok.length; i++) {
        var csoport = cs.csoportok[i];
        var cimke = sorCimke(csoport[0], terkep);
        var valasztott = csoport[pozicio];
        if (!cimke || !valasztott) continue;
        var e = sorEgysegei(valasztott, terkep);
        if (!e.vanSzam) continue;
        sorok.push({ cimke: cimke, egysegek: e.egysegek });
      }
    } else {
      /* Egy sor = egy bejegyzés (klántábla, egysoros falulista). */
      for (var r = talalat.terkepInfo.fejlec + 1; r < talalat.tabla.rows.length; r++) {
        var sor = talalat.tabla.rows[r];
        var e2 = sorEgysegei(sor, terkep);
        var cimke2 = sorCimke(sor, terkep);
        // Csak olyan sor érdekel, aminek van neve ÉS van benne szám. Az
        // összegző sorokat (jellemzően nincs nevük) így kihagyjuk.
        if (!cimke2 || !e2.vanSzam) continue;
        sorok.push({ cimke: cimke2, egysegek: e2.egysegek });
      }
    }

    return {
      sorok: sorok,
      egysegDb: talalat.terkepInfo.db,
      sortipusok: sortipusok,
      sorPozicio: pozicio
    };
  }

  /* ---------------------------------------------------------------------
   * 5) Számítás
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

  function szamol(sorok, b) {
    var ki = [];
    for (var i = 0; i < sorok.length; i++) {
      var e = sorok[i].egysegek;
      var tamadoPop = popOsszeg(e, TAMADO);
      var vedoPop = popOsszeg(e, VEDO);
      var nemes = e.snob || 0;
      ki.push({
        cimke: sorok[i].cimke,
        egysegek: e,
        tamadoPop: tamadoPop,
        vedoPop: vedoPop,
        nuke: tamadoPop / b.nukePop,
        vedo: vedoPop / b.vedoPop,
        nemes: nemes,
        felderito: e.spy || 0,
        vonat: Math.floor(nemes / b.nemesVonatonkent)
      });
    }
    ki.sort(function (a, c) { return c.nuke - a.nuke; });
    return ki;
  }

  function kerekit(n) { return Math.round(n * 10) / 10; }

  function szoveg(sz) { return String(sz == null ? '' : sz).replace(/[<>&"]/g, ''); }

  /* ---------------------------------------------------------------------
   * 6) Megjelenítés
   * ------------------------------------------------------------------- */
  function panelt(eredmeny, b, adat) {
    var regi = document.getElementById('kcs_panel');
    if (regi) regi.parentNode.removeChild(regi);

    var osszNuke = 0, osszVonat = 0, osszVedo = 0, osszFelderito = 0;
    for (var i = 0; i < eredmeny.length; i++) {
      osszNuke += eredmeny[i].nuke;
      osszVonat += eredmeny[i].vonat;
      osszVedo += eredmeny[i].vedo;
      osszFelderito += eredmeny[i].felderito;
    }

    var panel = document.createElement('div');
    panel.id = 'kcs_panel';
    panel.style.cssText =
      'position:fixed;top:40px;right:20px;z-index:99999;width:min(560px,94vw);' +
      'max-height:82vh;overflow:auto;background:#f4e4bc;border:2px solid #7d510f;' +
      'border-radius:6px;padding:10px 12px;font:12px Verdana,Arial,sans-serif;' +
      'color:#000;box-shadow:0 6px 22px rgba(0,0,0,.4);';

    var html = '';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">';
    html += '<b style="font-size:13px;">' + NEV + ' <span style="font-weight:normal;color:#603000;">v' + VERZIO + '</span></b>';
    html += '<button id="kcs_bezar" style="cursor:pointer;">Bezár</button>';
    html += '</div>';

    html += '<div style="margin:8px 0;padding:6px;background:#e3d5b0;border:1px solid #c1a264;">';
    html += '<b>Összesen:</b> ' + kerekit(osszNuke) + ' nuke · ' + osszVonat + ' nemesvonat · ' +
            kerekit(osszVedo) + ' védősereg · ' + osszFelderito.toLocaleString('hu-HU') + ' felderítő ' +
            '<span style="color:#603000;">(' + eredmeny.length + ' sor)</span>';
    html += '</div>';

    /* Sortípus-választó: csak akkor, ha a táblában tényleg több sor tartozik
     * egy faluhoz. Így sosem adunk össze kétszer ugyanazt. */
    if (adat.sortipusok && adat.sortipusok.length > 1) {
      html += '<div style="margin:8px 0;padding:6px;background:#f6e0c0;border:1px solid #c1a264;">';
      html += '<b>Több sortípus van bekapcsolva</b> - egy faluhoz ' + adat.sortipusok.length +
              ' sor tartozik. Csak az alább kiválasztott sort számolom, hogy ne adódjon össze kétszer ' +
              'ugyanaz a sereg (és ne kerüljön bele idegen támogatás).<br>';
      html += 'Számolt sor: <select id="kcs_sor">';
      for (var p = 0; p < adat.sortipusok.length; p++) {
        var nev = adat.sortipusok[p] ? szoveg(adat.sortipusok[p]) : (p + 1) + '. sor';
        html += '<option value="' + p + '"' + (p === adat.sorPozicio ? ' selected' : '') + '>' +
                (p + 1) + '. - ' + nev + '</option>';
      }
      html += '</select> <button id="kcs_sorujra" style="cursor:pointer;">Újraszámol</button>';
      html += '</div>';
    }

    html += '<div style="margin:8px 0;padding:6px;background:#e3d5b0;border:1px solid #c1a264;">';
    html += '<b>Mihez viszonyítunk</b> (populáció, módosítható):<br>';
    html += '1 teljes nuke = <input id="kcs_nuke" type="number" min="1" step="100" value="' + b.nukePop + '" style="width:80px"> pop · ';
    html += '1 teljes védősereg = <input id="kcs_vedo" type="number" min="1" step="100" value="' + b.vedoPop + '" style="width:80px"> pop · ';
    html += 'vonat = <input id="kcs_nemes" type="number" min="1" step="1" value="' + b.nemesVonatonkent + '" style="width:44px"> nemes ';
    html += '<button id="kcs_ujra" style="cursor:pointer;">Újraszámol</button>';
    html += '</div>';

    html += '<table style="width:100%;border-collapse:collapse;">';
    html += '<tr style="background:#c1a264;"><th style="text-align:left;padding:3px;">Név</th>' +
            '<th style="padding:3px;">Nuke</th><th style="padding:3px;">Vonat</th>' +
            '<th style="padding:3px;">Védő</th><th style="padding:3px;">Támadó pop</th></tr>';
    for (var k = 0; k < eredmeny.length; k++) {
      var s = eredmeny[k];
      html += '<tr style="border-bottom:1px solid #d7c096;">' +
        '<td style="padding:3px;">' + szoveg(s.cimke) + '</td>' +
        '<td style="padding:3px;text-align:right;"><b>' + kerekit(s.nuke) + '</b></td>' +
        '<td style="padding:3px;text-align:right;">' + s.vonat + '</td>' +
        '<td style="padding:3px;text-align:right;">' + kerekit(s.vedo) + '</td>' +
        '<td style="padding:3px;text-align:right;color:#603000;">' + s.tamadoPop.toLocaleString('hu-HU') + '</td>' +
        '</tr>';
    }
    html += '</table>';

    html += '<div style="margin-top:8px;">';
    html += '<button id="kcs_masol" style="cursor:pointer;">Másolás vágólapra</button> ';
    html += '<span id="kcs_uzenet" style="color:#603000;"></span>';
    html += '</div>';

    html += '<div style="margin-top:8px;font-size:11px;color:#603000;line-height:1.5;">' +
      'A számítás populáció alapján megy: minden egység a játékbeli farm-helyével súlyozva. ' +
      'A felderítő, a lovag és a nemes nincs beleszámítva sem a támadó, sem a védő összegbe; ' +
      'a katapult csak a támadó oldalon szerepel. ' +
      'A script nem küld sehova adatot és nem végez semmilyen játékbeli műveletet - ' +
      'csak azt adja össze, ami ezen a lapon amúgy is látszik.' +
      '</div>';

    panel.innerHTML = html;
    document.body.appendChild(panel);

    document.getElementById('kcs_bezar').onclick = function () {
      panel.parentNode.removeChild(panel);
    };

    function ujraszamol(sorPozicio) {
      var uj = {
        nukePop: +document.getElementById('kcs_nuke').value || ALAP.nukePop,
        vedoPop: +document.getElementById('kcs_vedo').value || ALAP.vedoPop,
        nemesVonatonkent: +document.getElementById('kcs_nemes').value || ALAP.nemesVonatonkent,
        sorPozicio: sorPozicio
      };
      beallitastMent(uj);
      futtat();
    }

    document.getElementById('kcs_ujra').onclick = function () {
      ujraszamol(adat.sorPozicio || 0);
    };

    if (adat.sortipusok && adat.sortipusok.length > 1) {
      document.getElementById('kcs_sorujra').onclick = function () {
        ujraszamol(+document.getElementById('kcs_sor').value || 0);
      };
    }

    document.getElementById('kcs_masol').onclick = function () {
      var sz = tsv(eredmeny);
      masol(sz, function (ok) {
        document.getElementById('kcs_uzenet').textContent =
          ok ? 'Kimásolva.' : 'A vágólap nem elérhető - jelöld ki a táblázatot kézzel.';
      });
    };
  }

  /* ---------------------------------------------------------------------
   * 7) Másolás
   *
   * Tabulátorral tagolt sorok: ez illeszthető be táblázatkezelőbe, jegyzetbe,
   * bárhova. A másolás KIZÁRÓLAG a felhasználó kattintására fut le, és a
   * szöveg a saját gépén marad.
   * ------------------------------------------------------------------- */
  function tsv(eredmeny) {
    var sorok = ['nev\tnuke\tvonat\tvedo\ttamado_pop\tvedo_pop\tnemes\tfelderito'];
    for (var i = 0; i < eredmeny.length; i++) {
      var s = eredmeny[i];
      sorok.push([
        s.cimke, kerekit(s.nuke), s.vonat, kerekit(s.vedo),
        s.tamadoPop, s.vedoPop, s.nemes, s.felderito
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
   * 8) Indítás - ez az EGY kattintás, amit a script helyettesít
   * ------------------------------------------------------------------- */
  function futtat() {
    var b = beallitasok();
    var adat = beolvas(b);
    if (!adat) {
      alert(NEV + ':\n\nNem találtam egységeket tartalmazó táblázatot ezen a lapon.\n\n' +
            'Nyisd meg a saját falvaid egység-áttekintőjét (Áttekintés → Csapatok), ' +
            'és ott indítsd el.');
      return;
    }
    if (!adat.sorok.length) {
      alert(NEV + ':\n\nMegtaláltam a táblázatot, de egyetlen értékelhető sort sem olvastam ki belőle.');
      return;
    }
    panelt(szamol(adat.sorok, b), b, adat);
  }

  futtat();
})();

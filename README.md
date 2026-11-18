# Klán csapatösszesítő

Játékbeli segédscript a **Klánháborúhoz** (Tribal Wars). Egy kattintásra
összeadja a csapatáttekintőn **már látható** oszlopokat, és megmondja, mennyi
**nuke**, **nemesvonat** és **védősereg** van - tört értékkel, nem dobozokba
sorolva.

Nem szerez új információt, nem kérdez le semmit a szervertől, és nem automatizál
semmilyen játékbeli műveletet. Pontosan azt adja össze, ami a képernyőn amúgy is
ott van.

- Forrás: [`klan-csapatosszesito.js`](klan-csapatosszesito.js) - kommentezett,
  tömörítetlen, nem obfuszkált
- Teszt: [`teszt.mjs`](teszt.mjs) - `node teszt.mjs`, nincs függősége

---

## ⚠️ Engedélyeztetni kell

A Klánháború szabályzata szerint **minden scriptet a Support Csapatnak
engedélyeznie kell**, és a userscript-kezelők (Tampermonkey, Greasemonkey) meg a
böngésző-kiegészítők **tiltottak**. Ez a script ezért **gyorssáv-linkként**
indul, nem bővítményként.

Ha használni szeretnéd, előbb kérd a saját világodon a jóváhagyást. A jóváhagyás
után **ne írd át** - a módosítást is engedélyeztetni kell.

## Telepítés

**Beállítások → Gyorssáv → Új link**

- Név: `Csapatösszesítő`
- Cím:

```
javascript:$.getScript('https://cdn.jsdelivr.net/gh/kakaos1999-pixel/kh-csapatosszesito@main/klan-csapatosszesito.js');
```

Aztán nyisd meg az **Áttekintés → Csapatok** lapot
(`game.php?screen=overview_villages&mode=units`), és kattints a gyorssávban a
linkre.

> A jsDelivr azért kell, mert a GitHub nyers (raw) linkjét a böngésző
> `text/plain`-ként kapja, és nem futtatja le. A **forrás** olvasásához a
> fenti `klan-csapatosszesito.js` link való.

## Hogyan számol

Populáció (farm-hely) alapján összegez, és **csak a végén oszt**:

```
támadó populáció = bárdos·1 + könnyűlovas·4 + lovas íjász·5 + faltörő·5 + katapult·8
nuke             = támadó populáció / (1 teljes nuke populációja)
```

Így két fél nuke tényleg egy egész, és a lovasság súlya is a helyére kerül: egy
könnyűlovas négyszer annyi farmhelyet foglal, mint egy bárdos.

A populációértékek a játék hivatalos adatai (lándzsás 1, kardforgató 1, bárdos 1,
íjász 1, felderítő 2, könnyűlovas 4, lovas íjász 5, faltörő 5, nehézlovas 6,
katapult 8, lovag 10, nemes 100).

Hogy mennyi „1 teljes nuke", az világonként és klánonként más, ezért **nincs
beégetve**: a panelen átírható. Az alapérték egy klasszikus nuke -
7000 bárdos + 3000 könnyűlovas + 300 faltörő + 50 katapult = **20 900** populáció.

Besorolás:

- **támadó**: bárdos, könnyűlovas, lovas íjász, faltörő, **katapult** (csak itt)
- **védő**: lándzsás, kardforgató, íjász, nehézlovas
- **egyik sem**: felderítő (nem harcol), lovag (egyedi), nemes (külön,
  vonatként) - ezek külön jelennek meg, nem a sereg-egyenértékben
- a milícia nem foglal farmhelyet, így populáció alapon magától kimarad

## Miben más, mint a megszokott összesítők

A ma elterjedt **Troops Counter** (eredetileg *dalesmckay*, a karbantartott
változat *RedAlert*-é, v8.6) ugyanezen a lapon, ugyanezt az adatot olvassa.
A különbség a számtan: az **falvanként kategóriákba sorol** (teljes / ¾ / ½ / ¼),
ez pedig összead, és csak a végén oszt. A kategóriás módszer négy helyen visz
félre:

1. **A maradék elvész.** 19 999 populáció „¾ nuke", 20 000 pedig „1". Két fél
   nuke két „½" marad, soha nem áll össze egy egésszé.
2. **A vegyes falu kétszer számít.** Minden kategória külön feltételként fut le,
   nincs „első találat nyer" - egy 12 000 támadó- és 12 000 védőpopulációs falu
   egyszerre lesz ½ nuke **és** ½ védő.
3. **A nemessel álló nuke kiesik.** A nuke-kategóriák feltétele nulla nemes, a
   vonaté négy nemes, a köztes eseté pedig 19 600 alatti támadóerő. Egy falu
   1-3 nemessel és egy teljes nuke-kal egyetlen kategóriába sem esik bele -
   nem hibát ír, csendben kimarad.
4. **A katapult mindkét oldalon szerepel** nála (a támadó és a védő listában is),
   tehát ugyanaz a populáció kétszer számít.

Ezért ad ez a script tört számot kategória helyett, és ezért van a katapult csak
a támadó oldalon.

## Ha több sortípus van bekapcsolva

Az egység-áttekintőben egy faluhoz több sor is tartozhat („saját csapatok",
„a faluban - idegennel együtt", „úton lévők"). Ilyenkor a script **nem adja
össze** őket - ez lenne a legkönnyebb módja annak, hogy ugyanaz a sereg
többször számítson, és hogy idegen támogatás sajátként kerüljön be. Helyette
felismeri a sortípusokat, és a panelen **kiválasztható**, melyiket összegezze.
Alapértelmezés az első sor.

## Mit nem csinál

- nem küld sehova adatot - **egyetlen hálózati hívás sincs benne**
- nem automatizál játékbeli műveletet: nem küld csapatot, nem támad, nem
  támogat, nem nevez át, nem épít, nem kutat
- nem fut magától, nincs benne időzítő, és nem figyel a fiók eseményeire
- nem nyúl a gyülekezőtérhez, és nem kattint a Támadás / Támogatás / OK gombokra
- nem helyettesít prémium funkciót, és nem működik együtt a Farmkezelővel vagy a
  Prémium Tőzsdével
- nincs elfedve: a forrás olvasható és tömörítetlen

A „Másolás vágólapra" gomb a **saját géped** vágólapjára teszi a táblázatot,
kizárólag akkor, ha rákattintasz. Ez sem küld sehova semmit.

A `teszt.mjs` ezeket a forráson is ellenőrzi, nem csak ígéri:

```
node teszt.mjs
```

## Licenc

MIT - lásd [`LICENSE`](LICENSE).

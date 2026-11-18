# Klán csapatösszesítő

Játékbeli segédscript a **Klánháborúhoz** (Tribal Wars), **klánvezetőknek**.

A vezető a klán csapatáttekintőjén (**Klán → Tagok → Csapatok**) látja a tagok
falvait és egységeit. Ez a script azt a lapot adja össze helyette - egy
kattintásra, **populáció (farm-hely) alapján**, tört értékkel. Ahogy a vezető
végigmegy a tagokon, úgy áll össze a teljes klántábla.

Nem szerez új információt, **nem kér le egyetlen oldalt sem** a játékból, és nem
automatizál semmilyen játékbeli műveletet. Pontosan azt adja össze, ami a
megnyitott lapon amúgy is ott van.

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

> A jsDelivr azért kell, mert a GitHub nyers (raw) linkjét a böngésző
> `text/plain`-ként kapja, és nem futtatja le. A **forrás** olvasásához a fenti
> `klan-csapatosszesito.js` link való.

## Használat

1. Nyisd meg egy tag csapatáttekintőjét (**Klán → Tagok → Csapatok**).
2. Kattints a gyorssávban a linkre. A panel kiírja, mit olvasott be.
3. Írd be (vagy hagyd jóvá) a tag nevét, és nyomd meg a **Hozzáadás a
   klántáblához** gombot.
4. Lapozz a következő tagra, és ismételd. A klántábla gyűlik.

Ha a lista **több oldalas**, minden oldalon kattints újra: a script falvanként
tárolja az adatot, ezért **sem a lapozás, sem az újranyitás nem duplázza** az
összeget.

Ha a megnyitott lap **tagonként** összesít (minden sor egy tag), akkor egyetlen
kattintással az egész klánt beolvassa.

Végül a **Klántábla másolása** gomb tabulátorral tagolt táblázatot tesz a
vágólapra - táblázatkezelőbe, jegyzetbe, bárhova beilleszthető.

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
- **egyikbe sem**: **felderítő** (nem harcol - sem támadni, sem védeni nem lehet
  vele), lovag (egyedi), nemes (külön, vonatként). Ezek külön oszlopban
  jelennek meg, nem a sereg-egyenértékben.
- a milícia nem foglal farmhelyet, így populáció alapon magától kimarad

Ha egy cellában **`?`** áll (a tag nem osztja meg az adatot), azt nem nézzük
nullának: a panel kiírja, hány ilyen volt, és hogy az összeg emiatt alsó becslés.

## Miben más, mint a ma használt összesítő

A klánvezetők ma jellemzően a **Tribe member troops calculator**-t (Shinko to
Kuma, 2021, `.net` jegyszám t13993699) használják. Ugyanarról a lapról dolgozik,
de **falvanként kategóriákba sorol** (teljes / ¾ / ½ / ¼), és ez négy helyen
visz félre:

1. **A felderítőt mindkét oldalon beszámolja.** A `spy` ág a felderítő
   populációját a *támadó* és a *védő* összeghez is hozzáadja. Egy
   felderítőfalu így egyszerre jelenik meg fél nuke-ként és fél védőseregként -
   pedig felderítővel sem támadni, sem védeni nem lehet. Ez a legnagyobb
   torzítás, mert a felderítőfalvak száma sokszor több tucat tagonként.
2. **A vegyes falu kétszer számít.** A támadó és a védő besorolás egymástól
   függetlenül fut le, nincs „első találat nyer" - egy felerészt támadó,
   felerészt védő falu egyszerre lesz ½ nuke **és** ½ védő.
3. **A maradék elvész.** Egy 97%-os nuke „¾"-ként jelenik meg, és két fél nuke
   soha nem áll össze egy egésszé. A küszöb alatti falvak pedig sehol nem
   látszanak. Emiatt fordulhat elő, hogy egy tagnál „1 teljes nuke" és
   „94 háromnegyed nuke" szerepel, miközben a valóságban közel 94 bevethető
   nuke-ja van.
4. **A lovag és a milícia kimarad** a számításból.

Mellékesen: az a script **minden tag lapját, és annak minden aloldalát letölti**
magától. A `.net`-en ezt engedélyezték; a magyar szabály viszont azt mondja,
hogy *„csak azok a scriptek szabályosak, amelyek 1 klikkelést helyettesítenek"*.
Ez a script ezért **semmit nem tölt le**: csak azt a lapot olvassa, amit a
vezető megnyitott.

## Ha több sortípus van bekapcsolva

Egy faluhoz több sor is tartozhat („saját csapatok", „a faluban - idegennel
együtt", „úton lévők"). Ilyenkor a script **nem adja össze** őket - ez lenne a
legkönnyebb módja annak, hogy ugyanaz a sereg többször számítson, és hogy idegen
támogatás sajátként kerüljön be. Helyette felismeri a sortípusokat, és a panelen
**kiválasztható**, melyiket összegezze. Alapértelmezés az első sor.

## Mit nem csinál

- **nem kér le egyetlen lapot sem** a játékból - se másik tag lapját, se a
  következő oldalt
- nem küld sehova adatot - egyetlen hálózati hívás sincs benne
- nem automatizál játékbeli műveletet: nem küld csapatot, nem támad, nem
  támogat, nem nevez át, nem épít, nem kutat
- nem fut magától, nincs benne időzítő, és nem figyel a fiók eseményeire
- nem nyúl a gyülekezőtérhez, és nem kattint a Támadás / Támogatás / OK gombokra
- nem helyettesít prémium funkciót, és nem működik együtt a Farmkezelővel vagy a
  Prémium Tőzsdével
- nincs elfedve: a forrás olvasható és tömörítetlen

Az összegyűjtött klántábla a böngésző saját tárolójában (localStorage) marad, a
gépen. A **Klántábla másolása** gomb a saját vágólapodra tesz szöveget,
kizárólag akkor, ha rákattintasz.

A `teszt.mjs` ezeket a forráson is ellenőrzi, nem csak ígéri:

```
node teszt.mjs
```

## Licenc

MIT - lásd [`LICENSE`](LICENSE).

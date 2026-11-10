# Filmų katalogas – REST API (3 lab.) ir Vanilla UI (4 lab.)

Tema: **filmai** (ta pati, kaip XML / JSON Schema darbuose).
Serveris: Node.js + Express. Sąsaja: gryni HTML5, CSS3, JavaScript (be karkasų).

## Paleidimas

```bash
npm install
npm start          # http://localhost:3000  (sąsaja ir API tame pačiame serveryje)
npm test           # 7 automatiniai API testai (veikia su laikina duomenų kopija)
```

## Struktūra

| Failas | Paskirtis |
|---|---|
| `server.js` | Express serveris, maršrutai, Accept / Content-Type valdymas, klaidų kodai |
| `src/store.js` | Saugojimas faile `data/filmai.json` (skaitoma ir rašoma kiekvienos užklausos metu) |
| `src/validate.js` | Validacija pagal `schema/filmai_schema.json` (Ajv, draft-06) |
| `src/xml.js` | XML ↔ objektas pagal `schema/filmai.xsd` (vardų sritis `https://PasaulioFilmai.lt/filmai`) |
| `schema/` | JSON Schema ir XSD iš ankstesnio laboratorinio |
| `public/index.html`, `css/styles.css`, `js/*.js` | Vartotojo sąsaja (moduliai: `api.js`, `render.js`, `form.js`, `main.js`) |

## 3 laboratorinis: API

| Metodas | Adresas | Veiksmas | Sėkmės kodas |
|---|---|---|---|
| GET | `/api/filmai` | sąrašas (`?q=`, `?zanras=`, `?regionas=`) | 200 |
| GET | `/api/filmai/:id` | vienas įrašas | 200 / 404 |
| POST | `/api/filmai` | sukurti (ID, jei nenurodytas, suteikia serveris) | 201 + `Location` |
| PUT | `/api/filmai/:id` | pakeisti visą įrašą | 200 / 404 |
| DELETE | `/api/filmai/:id` | pašalinti | 204 / 404 |

Kiti kodai: **400** – duomenys neatitinka schemos arba blogas JSON/XML; **409** – toks ID jau yra; **406** – nepalaikomas `Accept`; **415** – nepalaikomas `Content-Type`.

**JSON ir XML.** Atsakymo formatą parenka `Accept`, užklausos kūno – `Content-Type` (`application/json` arba `application/xml`). XML atvaizdas atitinka `filmai.xsd` (patikrinta: sugeneruotas katalogas validuojasi pagal XSD). XML užklausa paverčiama objektu ir tikrinama ta pačia JSON Schema.

```bash
curl http://localhost:3000/api/filmai/F001
curl -H "Accept: application/xml" http://localhost:3000/api/filmai/F001
curl -X POST -H "Content-Type: application/json" -d '{"pavadinimas":"x"}' http://localhost:3000/api/filmai
```

**Validacija (POST ir PUT).** Klaidos atsakymas (400):

```json
{ "status": 400, "klaida": "Duomenys neatitinka schemos",
  "detales": [ { "kelias": "/metai", "laukas": "metai", "pranesimas": "Reikšmė turi būti ne mažesnė nei 1888" } ] }
```

Be schemos taisyklių serveris tikrina ir XSD `xs:key` atitikmenį: aktoriaus ID turi būti unikalus filmo viduje.

## 4 laboratorinis: sąsaja

* **Semantinis HTML5:** `header`, `nav`, `main`, `section`, `aside`, `article` (kiekviena filmo kortelė), `footer`, `form`, `fieldset`/`legend`, `dialog`, `details`/`summary`, `dl`, `template`.
* **Responsive:** `@media (max-width: 62rem)` – šoninė juosta pereina po katalogu; `@media (max-width: 40rem)` – vienas stulpelis, dialogai per visą ekraną; `prefers-reduced-motion`.
* **Fetch API + async/await:** `js/api.js`; sąrašas, kūrimas (POST), redagavimas (PUT), šalinimas (DELETE) be puslapio perkrovimo.
* **Šalinimas:** patvirtinimo dialogas (`<dialog>`), tik tada siunčiamas DELETE.
* **Būsenos:** užkrovimo sukutys (sąrašui) ir mygtukų sukutys (kol vyksta užklausa); klaidų pranešimai su „Bandyti dar kartą“.
* **Klaidos:** kliento pusėje tikrinami tik privalomi laukai (`required`), o formatus, ribas ir žanrus tikrina serveris. 400 klaidos rodomos prie laukų (raudoni laukai) ir pranešimų bloke `#klaidu-blokas`. Demonstracijai: kalbos kodą įveskite `lt` arba metus `1500`.
* **API žurnalas** šoninėje juostoje rodo paskutines užklausas, o mygtukas **XML** prie filmo parodo atsakymą su `Accept: application/xml`.

## CSS: ką žinoti paaiškinti

Visi selektoriai pažymėti `styles.css` komentarais.

| Selektorius | Pavyzdys | Reikšmė |
|---|---|---|
| **Įpėdinio (descendant)** | `.svetaines-antraste nav a` | `a` bet kokiame gylyje elemento viduje (vaikas, vaikaitis…) |
| **Vaiko (child)** | `.filmu-sarasas > .kortele`, `.tagai > li` | tik **tiesioginis** vaikas |
| **Atributo** | `input[type="number"]`, `button[data-veiksmas="salinti"]`, `a[href^="http"]` | pagal atributo buvimą ar reikšmę |
| **Klasės** | `.kortele`, `.mygtukas` | elementai su `class="..."`; kartojasi |
| **ID** | `#klaidu-blokas`, `#api-zurnalas` | vienas unikalus elementas; didesnis specifiškumas nei klasė |

**Skirtumas tarp įpėdinio ir vaiko:** `div p` randa **visus** `p` div viduje, o `div > p` – tik tuos, kurie yra tiesiogiai div viduje. Jei elementas įdėtas giliau (ul → li → ul → li), `>` paliestų tik pirmo lygio, o tarpas – visus.

**Kaskada** – mechanizmas, kuriuo naršyklė išsprendžia, kuri taisyklė laimi, kai kelios liečia tą pačią savybę. Eiga: (1) svarba (`!important` laimi), (2) specifiškumas (ID > klasė/atributas/pseudoklasė > elementas), (3) eilės tvarka (vėlesnė laimi). Specifiškumas rašomas kaip (ID, klasės, elementai).

**`!important` pavyzdžiai (ištrynus pasikeistų vaizdas):**

1. *Šalinimo mygtukas kortelėje.* Taisyklė `.kortele .veiksmai button` (0,2,1) specifiškesnė už `.pavojus` (0,1,0), todėl be `!important` „Šalinti“ atrodytų pilkas kaip kiti mygtukai. Su `!important` `.pavojus` visada raudonas.
2. *Klaidingas laukas.* `.neteisinga` (0,1,0) pralaimėtų `.laukas input` (0,1,1) ir fokuso taisyklei (0,2,1): be `!important` raudonas rėmelis ir rausvas fonas išnyktų.

## Atsakymai į dažnus klausimus

* **REST:** resursai identifikuojami URL (`/api/filmai/F001`), veiksmus nusako HTTP metodai, serveris be būsenos (kiekviena užklausa savarankiška), atsakymai su būsenos kodais.
* **PUT vs POST:** POST kuria naują resursą (serveris suteikia ID), PUT pakeičia visą esamą pagal ID adrese.
* **Content-Type vs Accept:** `Content-Type` – kokiu formatu siunčiami duomenys, `Accept` – kokiu formatu norima gauti atsakymą.
* **Kodėl serverio validacija:** kliento tikrinimą galima apeiti (curl, kitas klientas), todėl schema taikoma serveryje.
* **XSS apsauga:** sąsaja turinį kuria per `textContent`, ne `innerHTML`.

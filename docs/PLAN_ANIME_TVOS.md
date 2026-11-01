# Piano: Sezione Anime in itaflix-tvos (provider unico: AnimeUnity)

Repo: `https://github.com/Paliddo86/itaflix-tvos.git` — app **TVML/JavaScript** per Apple TV
Branch di lavoro: `feature/anime-section` (creato da `master`)
Riferimento di logica: progetto **Kotlin** `Itaflix` (`animeunity.so` / `Provider.kt`), da **convertire**, non copiare.

---

## 0. Verità accertate (verificate live, non ipotesi)

### Domini reali (oggi)
| Host | Stato |
|---|---|
| `animeunity.so` | **morto** (curl 000) — è l'hardcoded del provider Kotlin |
| `animeunity.to` | 302 → `.co` |
| **`animeunity.co`** | **vivo**, 200, 194 KB |
| `vixcloud.co` | **morto** (000) — hardcoded in `VixcloudExtractor.kt:19` |
| **`vixcloud.cc`** | **vivo** |

→ Nel port JS usare `.co` (AnimeUnity) e `.cc` (Vixcloud). Il Kotlin è disallineato.

### Endpoint AnimeUnity verificati
| Endpoint | Esito | Note |
|---|---|---|
| `GET /` | 200 | marker: `layout-items`, `the-carousel`, `home-sidebar`, `csrf-token`, `latest-anime-container` ×11 |
| `GET /archivio` | 200 | cookie `XSRF-TOKEN` + `<meta name="csrf-token">` (40 char) |
| `POST /archivio/get-animes` | 200 | JSON `records[]`, richiede `X-CSRF-TOKEN` + `Content-Type: application/json` |
| `GET /anime/{id}-{slug}` | 200 | `episodes_count`, `embed_url`, attributo `anime` con `anilist_id` |

### Catena video verificata end-to-end
```
GET vixcloud.cc/embed/{id}?token=..&canPlayFHD=1        → 200
  estrae window.masterPlaylist.params.{token,expires}
GET vixcloud.cc/playlist/{id}?token={T}&expires={E}&h=1
  Referer: https://vixcloud.cc/                        → 200, master m3u8 (720p/1080p)
GET .../playlist/{id}?type=video&rendition=720p&...    → 200, 58 KB, AES-128
GET .../0000-0250.ts                                   → 200, 223 KB, video/mp2t ✅
```

**I 3 errori che causavano 403** (tutti miei, non del server):
1. `Referer` deve essere **`https://vixcloud.cc/`** (host root), NON l'URL embed. Referer sbagliato = peggio di nessun Referer.
2. `token`+`expires` vanno presi da **`window.masterPlaylist.params`**, non dall'URL di input.
3. Serve **`h=1`** se l'URL input contiene `canPlayFHD`; `b=1` se lo script contiene `b=1` (`VixcloudExtractor.kt:102,113,114,126`).

### Fatti architetturali su itaflix-tvos
- Backend **unico e hardcoded**: TMDB (`src/request/tmdb.js:1076`). `adc.js`/`sc.js` sono legacy non importati.
- Sezione anime **non esiste**: zero hit UI per "anime" (solo una shelf TMDB "Popular Anime" a `tmdb.js:282`, che è altra cosa).
- Menu ↔ route: `handleRoute('main')` + `menuRoute([...])` (`src/index.js:98-121`), route table `src/index.js:123-130`.
- Label menu = i18n **`menu-${route}`** (`src/routes/menu.js:97`) → `anime` richiede `menu-anime` in `it.js` + `en.js`.
- `Category` = `{name, values}` (`src/helpers/models.js:1-7`); `home.js:64-82` rende `<shelf>` per categoria.
- Player pattern: oggetto `{title, description, stream, artworkImageURL, resumeTime}` → `createMediaItems` (`src/utils.js:137-143`) → `player.playlist.push` → `player.play()` (`movie.js:384-401`, `season.js:445-462`).
- Errori utente: solo `TVDML.renderModal` + `alertTemplate` via `defaultErrorHandlers` (`src/helpers/auth/handlers.js:6-33`). Nessun Toast.
- `Tile` naviga con `link(attrs.type, attrs)` (`src/components/tile.js:23`, `utils.js:33`) → per il dettaglio anime serve `type: 'animeSeries'`.
- **Bug preesistente**: `Tile` fa `{ key, attrs = {} }` ma tutti i call site passano props flat → `attrs` sempre `{}`. Non correggerlo in questo branch (fuori scope, rischio regressione su tutta la UI).

### Ambiente di test
- Xcode presente. `xcode-select -p` = `/Library/Developer/CommandLineTools` → **`simctl` non risolve**.
  Workaround confermato: `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.
- Runtime **tvOS 15.2** disponibile. Device: `Apple TV OLD` (E247FE1A-B925-405A-B5CD-ED14B44A6D11), `Apple TV 4K (2nd gen)` (1B308AEB-…), `+1080p`.
- Serve `yarn serve` (porta **9001**, `webpack.config.js:113`) allineata a `AppDelegate.swift:21` (`localhost:9001`).
- Node: `.nvmrc` = **8.9.0**, engines `>=8.9.0`, `engine-strict: true`. Babel 6 + webpack 3.

---

## 1. Scope

**Dentro:** sezione Anime con AnimeUnity come **unica** sorgente, organizzata **per categorie (shelf)**; dettaglio serie; lista episodi; player.

**Fuori:** nessuna astrazione provider (l'app resta TMDB-centrica, anime è un'isola); nessun supporto Server1/Server2; nessuna persistenza "continua a guardare" per anime; nessuna modifica alle route TMDB esistenti.

---

## 2. Architettura del graft

4 file nuovi + 4 modifiche. AnimeUnity resta **confinato** nella sua request layer.

```
src/request/animeunity.js      NUOVO  — HTTP + parsing AnimeUnity (no route, no UI)
src/extractors/vixcloud.js     ESISTE ma è morto/WIP: NON riusarlo (usa DOMParser+fetch)
src/extractors/animeunity.js   NUOVO  — catena vixcloud.cc → m3u8 (clone pattern vixsrc.js)
src/routes/anime.js            NUOVO  — sezione a shelf (clone home.js:33-82)
src/routes/animeSeries.js      NUOVO  — dettaglio + episodi (clone season.js:160-231)

src/index.js                   MOD    — +import, +menu item, +2 handleRoute
src/localization/it.js         MOD    — +menu-anime, +label categorie
src/localization/en.js         MOD    — idem
```

**Scelta tecnica deliberata:** `src/extractors/vixcloud.js` esiste già ma è **codice morto** (0 call site) e usa `DOMParser`/`fetch` (inaffidabili su tvOS, `fetch` non è standard in TVJS). Il repo ha già risolto questo problema in `vixsrc.js` con **regex + brace-matching** (`vixsrc.js:70-141,180-219`) che è l'approccio **provato** su tvOS. → si clona `vixsrc.js`, non `vixcloud.js`.

---

## 3. Fase A — `src/request/animeunity.js`

Adattamento di `AnimeUnityProvider.kt` (Kotlin) a JS. Solo dati, nessuna logica UI.

### A1. Costanti e sessione
- `BASE_URL = 'https://www.animeunity.co'`
- `UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'`
- Stato modulo: `let cookieHeader = ''`, `let csrfToken = ''` (equivalente di `savedCookieHeader`/`savedCsrfToken` in `AnimeUnityProvider.kt:126-127`)
- **Divergenza dal Kotlin:** niente `var` condivisi senza guardia. In JS single-thread l'unico rischio è interleaving fra promise → usare una `let archivioBootstrap = null` che memoizza la promise (dedup), non il risultato.

### A2. Bootstrap sessione (`ensureSession()`)
```js
// 1. GET /archivio con prepare che cattura Set-Cookie
// 2. parse <meta name="csrf-token" content="...">
// 3. salva cookieHeader + csrfToken; memoizza la promise
```
- Cookie: `XHR.getResponseHeader('Set-Cookie')` non è affidabile per header multipli → **leggere solo se presente** e degradare a `''` se assente (il POST funziona con solo `X-CSRF-TOKEN` in header, verificato live).
- Riusare il pattern `prepare`/`addHeaders` di `vixsrc.js:40-45`.

### A3. Funzioni esportate

| Funzione | Origine Kotlin | API |
|---|---|---|
| `getHome()` | `getHome()` :355-410 | `GET /` → 3 `Category` |
| `searchAnimes(offset)` | `search('')` + `getAnimes` | `POST /archivio/get-animes` |
| `getAnimesByType(type, offset)` | `getTvShows`/`getMovies` :760-900 | idem, `type: 'TV'\|'Movie'` |
| `getAnime(id)` | `getTvShow` :1000-1100 | `GET /anime/{id}` |
| `getEpisodes(id)` | `getEpisodesNormal` :1150-1220 | da `video-player` attr `episodes` |
| `getEmbedUrl(episodeId)` | `getServers` :1250-1310 | `GET /embed-url/{episodeId}` → testo |

### A4. Parsing: le 3 categorie della home
Da `parseLatestEpisodes` (:412), `parseLatestAdditions` (:470), `parseFeaturedAnime` (:530):

| Categoria | Sorgente HTML | Note |
|---|---|---|
| **Ultimi Episodi** | `<layout-items items-json="...">` → JSON `data[]` | HTML-entity encoded (`&quot;`), dedup per `anime.id` |
| **Ultime Aggiunte** | `div.home-sidebar div.latest-anime-container` ×11 | `<a class="unstile-a" href>` + `strong.latest-anime-title` + `img` |
| **In Evidenza** | `<the-carousel animes="...">` | JSON entity-encoded, `imageurl_cover`, `plot`, `score`, `date` |

- **Parsing HTML senza DOM**: clone di `vixsrc.js` (regex + `findObjectEnd`), **non** `DOMParser`. Per gli attributi JSON serve solo: `match(/items-json="([^"]*)"/)` + `unescape` entity (`&quot;`→`"`, `&amp;`→`&`) + `JSON.parse`.
- Le prime due categorie danno `TvShow`; la terza può dare `Movie` se `type === 'Movie'` → **lista mista**, gestita da `AppAdapter`-equivalente tramite `Tile` (già per-item, `home.js:64-82`).

### A5. Modelli
Riusare `Category` (`models.js:1`) e `TvShow` (`models.js:81`, campi: `id/title/overview/released/rating/poster/genres/banner/slug/type`).
- `type: 'animeSeries'` → instrada a `src/routes/animeSeries.js` via `link(attrs.type, attrs)`.
- Poster: `https://img.animeunity.co/anime/{filename}` dove `filename` = ultimo segmento di `imageurl` (`AnimeUnityProvider.kt:166-176`), **ma** verificato live che gli URL `imageurl` sono già assoluti su `s4.anilist.co` → usare `imageurl` così com'è se inizia per `http`, altrimenti ricostruire. **NON fidarsi** del rewrite incondizionato.

### A6. Paginazione
`offset = (page-1) * 30` (hardcoded 30 in `AnimeUnityProvider.kt:700`).
Per la sezione anime serve una **"load more" per shelf**: una sola request per shelf, poi al focus sull'ultimo item si chiede la pagina successiva (pattern `onHighlightTile` di `tvShowsGenres.js:215-235`, soglia `index >= length-5`).

**Verifica A:** test manuale in console Node? No — Node 8 non ha `fetch`. Verifica reale solo nel simulatore (o con `curl` per gli endpoint, già fatto).

---

## 4. Fase B — `src/extractors/animeunity.js`

Port **fedele** di `VixcloudExtractor.kt`, **non** di `vixcloud.js`.

- `BASE_VIXCLOUD = 'https://vixcloud.cc'` (⚠ `.cc`, il Kotlin ha `.co` morto)
- `UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'` — **esattamente** quello del Kotlin (`VixcloudExtractor.kt:142`), non lo UA Safari di `vixsrc.js`

### B1. Sequenza
```
1. GET embedUrl (solo header UA, NO Referer)          ← VixcloudExtractor.kt:51,142
2. estrai window.masterPlaylist.params.{token,expires}
3. costruisci playlistUrl:
     {BASE}/playlist/{id}?token={T}&expires={E}
     + '&b=1' se script.url contiene 'b=1'           ← :113
     + '&h=1' se embedUrl contiene 'canPlayFHD'      ← :114
4. return { url: playlistUrl, headers: { Referer: 'https://vixcloud.cc/', 'User-Agent': UA } }
     ← header esatti da VixcloudExtractor.kt:126
```

### B2. Parsing `window.masterPlaylist`
Il Kotlin fa `substringAfter("params: {").substringBefore("},")` poi sanitizza con regex `(\b(?:id|filename|token|expires|asn)\b)\s*:` e Gson (`:70-74,96-97`).
In JS: stesse slice + `JSON.parse` dopo convergenza apici `'` → `"` e quoting delle chiavi. **Usare `token` da qui, mai dall'URL.**

### B3. Cosa NON fare
- Non fetchare il master m3u8 per scegliere la qualità: il Kotlin **non lo fa** (player fa tutto). AVPlayer su tvOS gestisce master + ABR + AES-128 con URI relativo `/storage/enc.key`.
- Non implementare `window.streams` (Server1/Server2): il Kotlin lo ignora.
- Non usare DoH: `VixcloudExtractor` usa DNS di sistema (`:132-137`).

**Verifica B:** catena già validata con curl (embed→playlist→sub→segment, 200 ovunque). In simulatore: video parte entro ~3 s.

---

## 5. Fase C — `src/routes/anime.js` (sezione a categorie)

Clone strutturale di `home.js:13-82`.

- `getInitialState()`: `{ loading: true, categories: [] }`
- `loadData()`: `AnimeUnity.getHome()` → `this.setState({ loading: false, categories })`, `.catch(defaultErrorHandlers)`
- `render()`: `<document><head>{styles}</head><stackTemplate><banner>{logo + <title>{i18n('menu-anime')}</title>}</banner><collectionList id="collection" autoHighlight="true">{categories.map(renderCategory)}</collectionList></stackTemplate></document>`
- `renderCategory()`: identico a `home.js:64-82` — guard su `values.length`, `<shelf><header><title>` + `<section>` di `<Tile {...item} />`
- **Load more per shelf**: opzionale in fase C1, solo se le API reggono bene (rimandabile a C2).

**Decisione:** 3 shelf fisse dall'API — **nessuna griglia piatta, nessun elenco A-Z**. Richiesta esplicita tua: "con le sezioni delle categorie".

---

## 6. Fase D — `src/routes/animeSeries.js` (dettaglio + episodi)

`tvshow.js` e `season.js` sono **TMDB-coupled** (`tmdb_id`, `settings.getTvShowGenresById`, `getAccountStates`) → **non riusabili**. Route dedicata.

- Clone del render episodi da `season.js:160-231`: `<compilationTemplate><list>` + `<listItemLockup>` con `<ordinal minLength="3">` + `<title>` + `<relatedContent><lockup><img><description>`
- `loadData()`: `AnimeUnity.getAnime(id)` → header (titolo, poster/banner, overview, generi, rating, anno)
- `playEpisode(episode)`:
  ```js
  AnimeUnity.getEmbedUrl(episode.id)
    .then(embed => AnimeUnityExtractor.getStream(embed))
    .then(({ url, headers }) => preparePlayer(url, headers))
    .catch(defaultErrorHandlers)
  ```
- `preparePlayer` = clone esatto di `season.js:445-462`: `{title, description, stream, artworkImageURL, resumeTime: 0}` → `createMediaItems` → `playlist.push` → `player.play()`
- **Header sul player**: `createMediaItems` (`utils.js:137-143`) **non passa header**. TVML `MediaItem` supporta `mediaItem.httpHeaders = {...}`. → dopo `createMediaItems`, assegnare `mediaItem.httpHeaders = headers`. **Da proteggere con try/catch**: se tvOS 15 non lo supporta, il video fallisce comunque senza Referer → verifica obbligatoria in simulatore (è il punto di rischio #1 del piano).

**Verifica D:** episodio reale `4354` (Mou Ippon!, 13 ep) in simulatore tvOS 15.2.

---

## 7. Fase E — Wiring

### E1. `src/index.js`
```js
// import (blocco :1-20)
import animeRoute from './routes/anime';
import animeSeriesRoute from './routes/animeSeries';

// menu (:98-121) — inserire dopo 'tvShowsGenres'
{ route: 'anime' },

// route table (:123-130)
TVDML.handleRoute('anime').pipe(animeRoute());
TVDML.handleRoute('animeSeries').pipe(animeSeriesRoute());
```

### E2. Localization
`src/localization/it.js` (~:5-18) e `en.js` (~:8-15):
```js
'menu-anime': 'Anime',
'Popular Anime': ... // NON toccare, è TMDB
'anime-latest-episodes': 'Ultimi Episodi',
'anime-latest-additions': 'Ultime Aggiunte',
'anime-featured': 'In Evidenza',
'anime-episodes': 'Episodi',
```
⚠ I nomi delle prime due categorie arrivano **già in italiano** dalle API (`AnimeUnityProvider.kt` usa `"Ultimi Episodi"`/`"Ultime Aggiunte"` hardcoded) → **usare le label i18n**, non il nome dal server, per coerenza lingua.

**Verifica E:** menu mostra "Anime"; label corrette in IT e switchando EN.

---

## 8. Fase F — Test in simulatore tvOS 15.2

Setup (una volta):
```bash
cd /Users/paliddo/Hack/PROGRAMMAZIONE/GIT/itaflix-tvos
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
nvm use                                   # .nvmrc = 8.9.0
yarn install --frozen-lockfile
yarn serve                                # porta 9001
xcrun simctl boot E247FE1A-B925-405A-B5CD-ED14B44A6D11   # Apple TV OLD (tvOS 15.2)
open -a Simulator
xcodebuild -project tvos/itaflix.xcodeproj -scheme itaflix \
  -destination 'id=E247FE1A-B925-405A-B5CD-ED14B44A6D11' build
xcrun simctl install E247FE1A-B925-405A-B5CD-ED14B44A6D11 <path>.app
xcrun simctl launch E247FE1A-B925-405A-B5CD-ED14B44A6D11 <bundleid>
```

Checklist:
- [ ] F1. App avvia, menu include **Anime**
- [ ] F2. Sezione Anime carica 3 shelf popolate
- [ ] F3. Poster renderizzati (no placeholder rotti)
- [ ] F4. Focus su tile → dettaglio serie apre
- [ ] F5. Lista episodi completa (13 ep per `4354`)
- [ ] F6. **Tap episodio → video parte** ← punto critico (httpHeaders)
- [ ] F7. Seek / pausa / ripresa funzionano
- [ ] F8. Back navigation pulita (menu → anime → serie → player → back ×3)
- [ ] F9. Errore di rete → `alertTemplate` leggibile, nessun crash
- [ ] F10. Nessuna regressione: Home TMDB, Film, Serie TV, Cerca, Settings

Log debug: `xcrun simctl spawn <udid> log stream --predicate 'processImagePath CONTAINS "itaflix"'`

---

## 9. Rischi ordinati per probabilità

| # | Rischio | Prob. | Mitigazione |
|---|---|---|---|
| 1 | `MediaItem.httpHeaders` non applicato su tvOS 15 → video 403 | **alta** | Prototipo isolato in F6 **prima** di costruire D. Fallback: proxy locale (`yarn serve` su 9001) che inietta il Referer e riscrive il m3u8 → l'app punta a `localhost:9001/proxy/...` |
| 2 | XHR non permette di settare `Referer`/`Cookie` (header proibiti) | media | Per il **player** non serve XHR: serve `httpHeaders` su MediaItem. Per l'**estrazione** il Referer non serve (verificato: solo UA basta) |
| 3 | `Set-Cookie` non leggibile via XHR → POST `get-animes` fallisce | bassa | Verificato live: POST funziona con solo `X-CSRF-TOKEN` in header, senza cookie |
| 4 | Regex parsing HTML fragile a variazioni markup | media | Parsing limitato ad attributi JSON (`items-json`, `animes`), non al DOM. Se manca → shelf vuota, non crash |
| 5 | `DOMParser` inaffidabile | evitato | Non usato: si clona il pattern regex di `vixsrc.js` |
| 6 | Node 8 + webpack 3: sintassi moderna non transpilata | bassa | Seguire lo stile esistente (class properties sì, optional chaining NO) |
| 7 | AES-128 con `URI="/storage/enc.key"` relativo | media | AVPlayer risolve relativo all'URL playlist; se fallisce, quel rendition è FHD-only → preferire 720p |
| 8 | Rate-limit/anti-bot per IP su AnimeUnity | media | `ensureSession()` memoizzata; 1 request per shelf, non per item |

---

## 10. Ordine operativo

1. **Branch** — `feature/anime-section` da `master` (✅ creato)
2. `docs/PLAN_ANIME_TVOS.md` (questo file) → commit
3. **Fase B** (`extractors/animeunity.js`) — il pezzo con più incognite; **prototipo + test video in simulatore su URL hardcoded**, PRIMA di costruire il resto. Se `httpHeaders` non funziona, si scopre qui, non alla fine.
4. **Fase A** (`request/animeunity.js`) — endpoint già validati con curl
5. **Fase C** (`routes/anime.js`) — 3 shelf
6. **Fase D** (`routes/animeSeries.js`) — dettaglio + episodi + player
7. **Fase E** (wiring + i18n) — si può anticipare se serve navigare per testare A/C
8. **Fase F** (checklist simulatore)
9. Commit finale + eventuale PR

**Ordine deliberato:** B prima di A, contro l'ordine "naturale" dati→UI, perché B contiene il **rischio esistenziale** (se il video non parte su tvOS, cambia l'architettura verso un proxy). Meglio scoprirlo con 60 righe di extractor che con 800 righe di UI già scritte.

---

## 11. Differenze consapevoli dal riferimento Kotlin

| Aspetto | Kotlin | Port tvos | Perché |
|---|---|---|---|
| Host AnimeUnity | `.so` (morto) | `.co` | verificato live |
| Host Vixcloud | `.co` (morto) | `.cc` | verificato live |
| Parser HTML | Jsoup | regex + JSON attr | tvOS non ha Jsoup/DOM affidabile |
| Cookie jar | `var` su singleton | promise memoizzata | evita interleaving |
| Server1/Server2 | ignorati | ignorati | fedeltà al riferimento |
| DoH | solo provider, non extractor | assente | fedeltà al riferimento |
| Player | ExoPlayer | AVPlayer + httpHeaders | unico punto non portabile |

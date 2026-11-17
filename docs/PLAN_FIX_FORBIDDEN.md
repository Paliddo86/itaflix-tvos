# Fix "Forbidden" su riproduzione (vixsrc)

## Sintomo

Aprendo un film o un episodio compariva il modal di errore con descrizione
`Forbidden` (`defaultErrorHandlers` in `src/helpers/auth/handlers.js` mostra
`error.message` / `statusText`; la stringa "Forbidden" non esiste nel codice,
arriva dal server).

## Root cause

Catena in `src/extractors/vixsrc.js`:

1. `GET /api/movie/{id}` -> `{ src: "/embed/..." }` — **200 senza Referer**
2. `GET /embed/{id}?token=...` -> HTML con `window.masterPlaylist` — **403 senza Referer**
3. `/playlist/{id}?token=..&expires=..` -> m3u8 — **200 senza Referer**

**vixsrc richiede l'header `Referer` sul passo 2.** Verificato da shell:

| richiesta | Referer | esito |
|---|---|---|
| `/api/movie/550` | assente | 200 |
| `/embed/...` | **assente** | **403 `<title>Forbidden</title>`** |
| `/embed/...` | qualsiasi valore | 200 |

Il controllo e' di sola presenza. Senza `Accept: application/json` il body del
403 e' la pagina HTML `Forbidden`; con quell'header e' `{"message": ""}` — che
e' esattamente la risposta vista in app.

Conferma incrociata: il progetto `streamflix-reborn2` (commit `d060a2b3`)
risolve lo stesso problema aggiungendo `Referer` via interceptor OkHttp.

## Perche' non bastava aggiungerlo agli header JS

Su tvOS `Referer` e' un *forbidden header* per `XMLHttpRequest`: il webview lo
scarta **in silenzio** (`setRequestHeader` non lancia errore). Aggiungerlo a
`VixSrcService.headers()` non ha effetto — verificato in emulatore: la richiesta
parte senza header e torna 403.

## Soluzione

Il fetch della pagina embed viene fatto in nativo, dove `URLSession` permette di
impostare `Referer`.

**`tvos/itaflix/AppDelegate.swift`** — due bridge JS:

```
FetchWithReferer(url, referer, requestId)   // avvia la GET, esito in UserDefaults
ReadFetchResult(requestId)                  // getter sincrono: {done,status,body,error}
```

**`src/extractors/vixsrc.js`** — `getEmbed()` avvia il fetch nativo e legge
l'esito con polling (60 ms, timeout 15 s). Se i bridge non esistono ricade su XHR.

### Perche' niente callback JS

Il primo tentativo passava una `JSValue` come callback e la invocava al termine
del fetch. **Questo faceva crashare l'app**:

```
AppDelegate.swift  callback.call(withArguments:)
  -> JSValue callWithArguments
    -> drain microtask JS
      -> costruzione MediaItem
        -> -[__NSSetM addObject:] con nil -> SIGABRT
```

Trattenere una `JSValue` in una closure asincrona la rende invalida (il contesto
JS e' cambiato); `callWithArguments` su una JSValue morta corrompe JavaScriptCore
e il crash emerge **dopo**, in un punto non correlato. Per questo lo stack
puntava a `MediaItem`/`createMediaItems`, che erano innocenti.

Il risultato passa quindi da `UserDefaults`: thread-safe, nessun oggetto JS
attraversa il confine.

## Altri fix inclusi

**Lingua (`lang=it`)** — vixsrc marca `DEFAULT=YES` sulla traccia audio indicata
da `lang`. Senza il parametro l'audio di default era **inglese**:

| richiesta | audio DEFAULT |
|---|---|
| senza `lang` | English |
| `lang=it` | Italian |

`VixSrcService.lang = 'it'`, applicato a `buildUrl`, `buildTvShowUrl` e
`buildFinalUrl`.

**Loop infinito** — il vecchio codice usava `do { ... } while (true)` gestendo
solo `200` e `410`: qualunque altro status (403, 404, 500) generava un ciclo
infinito di richieste. Ora `fetchEmbedHtml()` fa al massimo **5** tentativi e
lancia un errore esplicito sugli altri status.

**Guard su `link`** (`src/routes/movie.js`) — se lo stream e' vuoto o non stringa
si mostra un errore invece di costruire un `MediaItem` invalido.

## Verifica

- Film: play OK (verificato in emulatore).
- Log atteso in console: `GET(native) https://vixsrc.to/embed/... 200 ...`
- Anime: **non coperto** — `animeunity.co` ora redirige a `animeunity.cx` e i
  path sono cambiati. Problema separato.

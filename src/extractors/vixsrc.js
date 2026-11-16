import * as request from '../request';

//***************************************************** */
// VixSrc Extractor by Pal0X
//***************************************************** */

export class VixSrcService{
  static baseUrl = "https://vixsrc.to";

  static requestLogger(...params) {
    return [
      response => {
        if (process.env.NODE_ENV === 'development') console.info(...params, response);
        return response;
      },

      xhr => {
        console.error(...params, xhr.status, xhr);
        return Promise.reject(xhr);
      },
    ];
  }

  static headers() {
    const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.2 Safari/605.1.15";

    let headers = {
      'User-Agent': userAgent,
      'Host': "vixsrc.to",
      'Origin': "https://vixsrc.to",
      'X-Requested-With': "XMLHttpRequest",
      'Accept': 'application/json'
    };

    return headers;
  }

  static addHeaders(dict) {
    return XHR => {
      Object.keys(dict).forEach(key => XHR.setRequestHeader(key, dict[key]));
      return XHR;
    };
  }

  static get(url, withStatusCode = false) {
    return request
      .get(url, { prepare: this.addHeaders(this.headers()) })
      .then(response => {
        const html = response.responseText;
        return withStatusCode ? { status: response.status, html } : html;
      })
      .then(...this.requestLogger('GET', url));
  }

  static getJson(url) {
    return request
      .get(url, { prepare: this.addHeaders(this.headers()) })
      .then(request.toJSON())
      .then(...this.requestLogger('GET', url));
  }

  /**
   * Contatore per gli id di richiesta del bridge nativo.
   */
  static fetchSeq = 0;

  /**
   * GET della pagina embed con header `Referer`.
   *
   * PERCHE' NON BASTA XHR: su tvOS `Referer` e' un forbidden header, il
   * webview lo scarta in silenzio e vixsrc risponde 403.
   *
   * Il nativo espone due funzioni (tvos/itaflix/AppDelegate.swift):
   *   FetchWithReferer(url, referer, requestId)  avvia la richiesta
   *   ReadFetchResult(requestId)                 legge l'esito
   *
   * Non si usa una callback JS dal nativo: trattenere una JSValue in una
   * closure asincrona la rende invalida e fa crashare ITMLKit in
   * -[__NSSetM addObject:]. Il risultato passa quindi da UserDefaults e qui
   * viene letto con un polling breve.
   */
  static getEmbed(url) {
    const referer = `${this.baseUrl}/`;

    const scope = typeof globalThis !== 'undefined' ? globalThis : null;
    const fetchNative = scope && typeof scope.FetchWithReferer === 'function'
      ? scope.FetchWithReferer
      : null;
    const readNative = scope && typeof scope.ReadFetchResult === 'function'
      ? scope.ReadFetchResult
      : null;

    if (fetchNative && readNative) {
      this.fetchSeq += 1;
      const requestId = `r${Date.now()}_${this.fetchSeq}`;

      fetchNative(url, referer, requestId);

      const started = Date.now();
      const timeoutMs = 15000;

      return new Promise((resolve, reject) => {
        const tick = () => {
          const res = readNative(requestId) || {};

          if (res.done) {
            if (res.error) {
              reject(new Error(String(res.error)));
              return;
            }
            resolve({
              status: Number(res.status) || 0,
              html: res.body == null ? '' : String(res.body),
            });
            return;
          }

          if (Date.now() - started > timeoutMs) {
            reject(new Error('Timeout nel recupero della pagina embed'));
            return;
          }

          setTimeout(tick, 60);
        };

        setTimeout(tick, 60);
      }).then(result => {
        if (process.env.NODE_ENV === 'development') {
          console.info('GET(native)', url, result.status, `${result.html.length}b`);
        }
        return result;
      });
    }

    // Fallback: XHR diretto (su tvOS il Referer viene scartato).
    return request
      .get(url, { prepare: this.addHeaders(this.headers()) })
      .then(response => ({ status: response.status, html: response.responseText }))
      .then(...this.requestLogger('GET', url));
  }

  /**
   * Lingua preferita passata a vixsrc.
   *
   * Determina quale traccia audio vixsrc marca DEFAULT=YES nella playlist:
   * con `lang=it` l'audio italiano, senza parametro l'inglese.
   * (Verificato: senza `lang` -> "English" DEFAULT=YES.)
   */
  static lang = 'it';

  static buildUrl(id) {
    return `${this.baseUrl}/api/movie/${id}?lang=${this.lang}`;
  }

  /**
   * Numero massimo di tentativi sulla pagina embed.
   *
   * Il vecchio codice usava `do { ... } while (true)` gestendo solo 200 e 410:
   * qualunque altro status (403, 404, 500...) causava un ciclo infinito di
   * richieste. Qui ogni caso e' gestito e i tentativi sono limitati.
   */
  static maxEmbedAttempts = 5;

  /**
   * Scarica l'HTML della pagina embed.
   *
   * 200 -> ok, si restituisce l'HTML.
   * 410 -> token scaduto: si richiede un nuovo `src` all'API e si riprova.
   * altro -> errore esplicito (niente loop).
   *
   * @param {string} apiUrl URL dell'API che espone `src`
   * @param {object} data   risposta corrente dell'API (contiene `src`)
   * @returns {Promise<string>} HTML della pagina embed
   */
  static async fetchEmbedHtml(apiUrl, data) {
    let current = data;

    for (let attempt = 1; attempt <= this.maxEmbedAttempts; attempt += 1) {
      const embedUrl = `${this.baseUrl}${current.src}`;
      const response = await this.getEmbed(embedUrl);

      if (response.status === 200) {
        return response.html;
      }

      if (response.status === 410) {
        const refreshed = await this.getJson(apiUrl);
        if (!refreshed || !refreshed.src) {
          throw new Error("Field 'src' mancante nel JSON.");
        }
        current = refreshed;
      } else {
        throw new Error(`Status code: ${response.status}`);
      }
    }

    throw new Error(
      `Impossibile recuperare la pagina embed dopo ${this.maxEmbedAttempts} tentativi.`,
    );
  }

  static buildTvShowUrl(id, seasonNumber, episodeNumber) {
    return `${this.baseUrl}/api/tv/${id}/${seasonNumber}/${episodeNumber}?lang=${this.lang}`;
  }

  static findObjectEnd(str) {
    let depth = 0;
    let inString = false;
    let stringChar = '';
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (inString) {
        if (c === stringChar && str[i - 1] !== '\\') inString = false;
      } else {
        if (c === '"' || c === "'") {
          inString = true;
          stringChar = c;
        } else if (c === '{') {
          depth++;
        } else if (c === '}') {
          depth--;
          if (depth === 0) return i + 1;
        }
      }
    }
    return str.length;
  }

  static parseWindowAssignments(code) {
    const windowData = {};

    code = code
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      .replace(/\s+/g, ' ');

    const regex = /window\.(\w+(?:\.\w+)*)\s*=\s*([\s\S]*?);/g;
    let match;

    while ((match = regex.exec(code)) !== null) {
      const path = match[1];
      let value = match[2].trim();

      // Migliorato: estrai oggetto completo anche con graffe annidate/stringhe
      if (value.startsWith('{')) {
        const end = this.findObjectEnd(value);
        value = value.slice(0, end);
      }

      try {
        if (/^[{\[]/.test(value)) {
          value = eval('(' + value + ')');
        } else if (/^['"].*['"]$/.test(value)) {
          value = value.slice(1, -1);
        } else if (value === 'true' || value === 'false') {
          value = value === 'true';
        } else if (!isNaN(Number(value))) {
          value = Number(value);
        } else {
          value = value.toString();
        }
      } catch (_) {
        value = value.toString();
      }

      const keys = path.split('.');
      let current = windowData;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in current)) current[keys[i]] = {};
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
    }

    return windowData;
  }

  static extractWindowObject(code, key) {
    // Cerca la posizione di window.key =
    const assignPattern = new RegExp(`window\\.${key}\\s*=\\s*{`);
    const assignMatch = assignPattern.exec(code);
    if (!assignMatch) return null;

    // Prendi tutto il testo dopo l'assegnamento
    const startIdx = assignMatch.index + assignMatch[0].length - 1;
    const rest = code.slice(startIdx);

    // Trova la vera fine dell'oggetto
    const endIdx = this.findObjectEnd(rest);
    if (endIdx === 0) return null;

    return rest.slice(0, endIdx);
  }

  static extractWindowPrimitive(code, key) {
    // Cerca solo il valore sulla riga, ignorando tutto dopo
    const pattern = new RegExp(`window\\.${key}\\s*=\\s*([^;\\n]+)`);
    const match = pattern.exec(code);
    if (!match) return undefined;
    let value = match[1].trim();
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(Number(value))) return Number(value);
    return value.replace(/^['"]|['"]$/g, '');
  }

  /**
   * Estrae l'URL dal codice HTML fornito.
   * @param {string} html 
   * @returns {{
   * masterPlaylist: {params: {token: string, expires: number}, url: string},
   * canPlayFHD: boolean,
   * }} Json con i dati della url
   */
  static extractUrl(html) {
    // Estrai masterPlaylist
    const masterStr = this.extractWindowObject(html, 'masterPlaylist');
    let masterPlaylist = null;
    if (masterStr) {
      try {
        masterPlaylist = eval('(' + masterStr + ')');
      } catch (e) {
        console.warn("Errore nel parsing di masterPlaylist:", e);
      }
    }

    // Estrai canPlayFHD direttamente
    const canPlayFHD = this.extractWindowPrimitive(html, 'canPlayFHD');

    // Estrai gli altri window.xxx (escludi masterPlaylist e canPlayFHD)
    const windowData = {};
    const regex = /window\.(\w+)\s*=\s*([^;]+);/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const key = match[1];
      if (key === 'masterPlaylist' || key === 'canPlayFHD') continue;
      let value = match[2].trim();
      try {
        if (/^[{\[]/.test(value)) {
          value = eval('(' + value + ')');
        } else if (/^['"].*['"]$/.test(value)) {
          value = value.slice(1, -1);
        } else if (value === 'true' || value === 'false') {
          value = value === 'true';
        } else if (!isNaN(Number(value))) {
          value = Number(value);
        } else {
          value = value.toString();
        }
      } catch (_) {
        value = value.toString();
      }
      windowData[key] = value;
    }

    // Costruisci il JSON finale
    const result = {
      masterPlaylist,
      canPlayFHD,
      ...windowData,
    };

    // Check campi essenziali
    if (!masterPlaylist || !masterPlaylist.url || !masterPlaylist.params || !masterPlaylist.params.token || !masterPlaylist.params.expires) {
      throw new Error("masterPlaylist incompleto:", masterPlaylist);
    }

    // Puoi aggiungere altri check qui se vuoi

    return result;
  }

  /**
   * Costruisce l'URL finale per la riproduzione del video.
   * @param {Object} vixParsedData
   * @returns {string}
   */
  static buildFinalUrl(vixParsedData) {
    const { masterPlaylist, canPlayFHD } = vixParsedData;
    if (!masterPlaylist || !masterPlaylist.url) {
      throw new Error("Dati insufficienti per costruire l'URL finale.");
    }

    let url = masterPlaylist.url;
    const params = [];

    // Aggiungi token ed expires
    if (masterPlaylist.params && masterPlaylist.params.token) {
      params.push(`token=${encodeURIComponent(masterPlaylist.params.token)}`);
    }
    if (masterPlaylist.params && masterPlaylist.params.expires) {
      params.push(`expires=${encodeURIComponent(masterPlaylist.params.expires)}`);
    }
    // Aggiungi h=1 se canPlayFHD true
    if (canPlayFHD) {
      params.push("h=1");
    }

    // Lingua: allinea le tracce marcate DEFAULT nella playlist.
    params.push(`lang=${this.lang}`);

    // Verifica se la URL ha già parametri
    if (url.includes("?")) {
      url += "&" + params.join("&");
    } else if (params.length > 0) {
      url += "?" + params.join("&");
    }

    return url;
  }

  static async getMovieUrl(id) {
    const url = this.buildUrl(id);
    const data = await this.getJson(url);

    if (!data.src) {
      throw new Error("Field 'src' mancante nel JSON.");
    }

    const html = await this.fetchEmbedHtml(url, data);
    return this.buildFinalUrl(this.extractUrl(html));
  }

  static async getTvShowUrl(id, seasonNumber, episodeNumber) {
    const url = this.buildTvShowUrl(id, seasonNumber, episodeNumber);
    const data = await this.getJson(url);

    if (!data.src) {
      throw new Error("Field 'src' mancante nel JSON.");
    }

    const html = await this.fetchEmbedHtml(url, data);
    return this.buildFinalUrl(this.extractUrl(html));
  }
}

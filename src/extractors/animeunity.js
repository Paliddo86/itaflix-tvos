import * as request from '../request';

/*
 * AnimeUnity Extractor by Pal0X
 * Port di VixcloudExtractor.kt dal provider AnimeUnity del progetto
 * Kotlin Itaflix. Host vixcloud.cc (il .co del riferimento non risolve),
 * parsing con regex e brace matching perche' su tvOS il DOM non e'
 * affidabile. Nessun header richiesto in riproduzione.
 */

export class AnimeUnityExtractor {
  static baseUrl = 'https://vixcloud.cc';

  static userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

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

  /**
   * Header per la GET della pagina embed.
   * Il Kotlin (VixcloudExtractor.kt:142) manda SOLO lo User-Agent:
   * nessun Referer, nessun Origin, nessun Cookie.
   */
  static pageHeaders() {
    return {
      'User-Agent': this.userAgent,
    };
  }

  static addHeaders(dict) {
    return XHR => {
      Object.keys(dict).forEach(key => XHR.setRequestHeader(key, dict[key]));
      return XHR;
    };
  }

  static get(url, withStatusCode = false) {
    return request
      .get(url, { prepare: this.addHeaders(this.pageHeaders()) })
      .then(response => {
        const html = response.responseText;
        return withStatusCode ? { status: response.status, html } : html;
      })
      .then(...this.requestLogger('GET', url));
  }

  /**
   * Trova la fine di un oggetto/array bilanciato, ignorando
   * le graffe dentro le stringhe. Stesso approccio di vixsrc.js:
   * su tvOS il parsing del DOM non e' affidabile.
   */
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
        } else if (c === '{' || c === '[') {
          depth++;
        } else if (c === '}' || c === ']') {
          depth--;
          if (depth === 0) return i + 1;
        }
      }
    }
    return str.length;
  }

  /**
   * Estrae l'oggetto assegnato a window.<key>.
   * Equivalente di extractWindowObject in vixsrc.js.
   */
  static extractWindowObject(code, key) {
    const assignPattern = new RegExp(`window\\.${key}\\s*=\\s*[{[]`);
    const assignMatch = assignPattern.exec(code);
    if (!assignMatch) return null;

    const startIdx = assignMatch.index + assignMatch[0].length - 1;
    const rest = code.slice(startIdx);

    const endIdx = this.findObjectEnd(rest);
    if (!endIdx) return null;

    return rest.slice(0, endIdx);
  }

  /**
   * Equivalente di extractWindowPrimitive: legge un valore scalare
   * assegnato a window.<key>.
   */
  static extractWindowPrimitive(code, key) {
    const pattern = new RegExp(`window\\.${key}\\s*=\\s*([^;\\n]+)`);
    const match = pattern.exec(code);
    if (!match) return undefined;
    const value = match[1].trim();
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(Number(value))) return Number(value);
    return value.replace(/^['"]|['"]$/g, '');
  }

  /**
   * Ricava lo script inline che contiene window.video / window.masterPlaylist.
   * Il Kotlin usa il PRIMO <script> della pagina (VixcloudExtractor.kt:53).
   */
  static extractScript(html) {
    const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptPattern.exec(html)) !== null) {
      const code = match[1];
      if (code.indexOf('window.masterPlaylist') !== -1) return code;
    }
    // Fallback: primo script disponibile
    scriptPattern.lastIndex = 0;
    const first = scriptPattern.exec(html);
    return first ? first[1] : '';
  }

  /**
   * Estrae id, masterPlaylist e canPlayFHD dalla pagina embed.
   * Equivalente di quanto fatto in VixcloudExtractor.kt:56-97.
   */
  static extractPlaylistData(html) {
    const code = this.extractScript(html);

    let video = null;
    const videoStr = this.extractWindowObject(code, 'video');
    if (videoStr) {
      try {
        video = eval('(' + videoStr + ')');
      } catch (e) {
        console.warn('AnimeUnityExtractor: parsing window.video fallito', e);
      }
    }

    const masterStr = this.extractWindowObject(code, 'masterPlaylist');
    let masterPlaylist = null;
    if (masterStr) {
      try {
        masterPlaylist = eval('(' + masterStr + ')');
      } catch (e) {
        console.warn('AnimeUnityExtractor: parsing window.masterPlaylist fallito', e);
      }
    }

    // canPlayFHD: il Kotlin lo legge dall'URL di input, qui lo leggiamo
    // anche dallo script per robustezza (VixcloudExtractor.kt:114).
    const canPlayFHD = this.extractWindowPrimitive(code, 'canPlayFHD');

    if (
      !masterPlaylist ||
      !masterPlaylist.url ||
      !masterPlaylist.params ||
      !masterPlaylist.params.token ||
      !masterPlaylist.params.expires
    ) {
      throw new Error('masterPlaylist incompleto nella pagina embed vixcloud');
    }

    return { video, masterPlaylist, canPlayFHD, code };
  }

  /**
   * Costruisce l'URL finale della playlist.
   * Ordine dei parametri fedele a VixcloudExtractor.kt:100-119:
   * token, expires, b=1, h=1.
   *
   * @param {Object} data risultato di extractPlaylistData
   * @param {string} embedUrl URL della pagina embed ricevuto in input
   */
  static buildFinalUrl(data, embedUrl) {
    const { masterPlaylist, canPlayFHD, code } = data;

    let url = masterPlaylist.url;

    // Il Kotlin forza l'host della playlist: https://vixcloud.co/playlist/{id}
    // Qui usiamo il baseUrl reale (vixcloud.cc) mantenendo il path del server.
    if (url.indexOf('http') !== 0) {
      url = `${this.baseUrl}${url.indexOf('/') === 0 ? '' : '/'}${url}`;
    }

    url = url
      .replace('https://vixcloud.co', this.baseUrl)
      .replace('https://www.vixcloud.co', this.baseUrl);

    const params = [
      `token=${encodeURIComponent(masterPlaylist.params.token)}`,
      `expires=${encodeURIComponent(masterPlaylist.params.expires)}`,
    ];

    // b=1 se presente nell'url dello script (VixcloudExtractor.kt:113)
    const scriptUrlMatch = /url:\s*['"]([^'"]*)['"]/.exec(code);
    if (scriptUrlMatch && scriptUrlMatch[1].indexOf('b=1') !== -1) {
      params.push('b=1');
    }

    // h=1 se canPlayFHD (dall'url di input o dallo script)
    const fhdFromInput = embedUrl && embedUrl.indexOf('canPlayFHD') !== -1;
    if (fhdFromInput || canPlayFHD) {
      params.push('h=1');
    }

    if (url.indexOf('?') !== -1) {
      url += '&' + params.join('&');
    } else {
      url += '?' + params.join('&');
    }

    return url;
  }

  /**
   * Catena completa: pagina embed -> URL playlist m3u8.
   *
   * NOTA IMPORTANTE: la playlist vixcloud e le sue sub-playlist/segmenti
   * rispondono 200 SENZA alcun header (verificato il 2026-11). Non serve
   * Referer ne' User-Agent in riproduzione: TVMediaItem di TVMLKit non
   * espone httpHeaders, quindi va bene cosi'.
   *
   * @param {string} embedUrl URL embed restituito da AnimeUnity
   * @returns {Promise<string>} URL della playlist pronto per il player
   */
  static async getStreamUrl(embedUrl) {
    if (!embedUrl) {
      throw new Error('AnimeUnityExtractor: embedUrl mancante');
    }

    const html = await this.get(embedUrl);
    const data = this.extractPlaylistData(html);

    return this.buildFinalUrl(data, embedUrl);
  }

  /**
   * Alias mantenuto per compatibilita' con il resto del codice.
   */
  static getStream(embedUrl) {
    return this.getStreamUrl(embedUrl).then(url => ({ url }));
  }
}

export default AnimeUnityExtractor;

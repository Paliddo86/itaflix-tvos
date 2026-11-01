import * as request from '../request';

/*
 * AnimeUnity request layer by Pal0X
 * Port di AnimeUnityProvider.kt dal progetto Kotlin Itaflix.
 * Host animeunity.co (il .so del Kotlin non risolve piu'), parsing HTML
 * con regex e JSON degli attributi perche' su tvOS il DOM non e' affidabile.
 */

const BASE_URL = 'https://www.animeunity.co';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Pagina di archivio usata come base per il POST /archivio/get-animes
const ARCHIVIO_URL = `${BASE_URL}/archivio`;

// Dimensione pagina lato AnimeUnity: hardcoded nel Kotlin (AnimeUnityProvider.kt:700)
const PAGE_SIZE = 30;

// Sessione: csrf token ricavato dalla pagina /archivio.
// Memoizziamo la PROMISE, non il risultato, per evitare richieste concorrenti
// duplicate (il Kotlin usa due `var` condivisi, qui evitiamo l'interleaving).
let sessionPromise = null;

function decodeHtml(value) {
  if (!value) return '';
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function addHeaders(dict) {
  return XHR => {
    Object.keys(dict).forEach(key => XHR.setRequestHeader(key, dict[key]));
    return XHR;
  };
}

function get(url, headers = {}) {
  return request.get(url, { prepare: addHeaders(headers) }).then(request.toString());
}

function postJson(url, payload, headers = {}) {
  return request
    .post(url, payload, { prepare: addHeaders(headers) })
    .then(request.toString());
}

/**
 * Ricava un attributo da un tag tramite regex (no DOM su tvOS).
 */
function readAttr(html, tagPattern, attrName) {
  const tagMatch = new RegExp(`<${tagPattern}[^>]*>`, 'i').exec(html);
  if (!tagMatch) return null;
  const attrMatch = new RegExp(`${attrName}="([^"]*)"`, 'i').exec(tagMatch[0]);
  return attrMatch ? decodeHtml(attrMatch[1]) : null;
}

function safeJsonParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(decodeHtml(raw));
  } catch (e) {
    console.warn('AnimeUnity: JSON non valido', e);
    return fallback;
  }
}

/**
 * Poster: gli URL imageurl sono gia' assoluti (anilist).
 * Se relativi, ricostruisce come fa il Kotlin (AnimeUnityProvider.kt:166).
 */
function imageUrl(imageurl) {
  if (!imageurl) return '';
  if (/^https?:/i.test(imageurl)) return imageurl;

  const parts = imageurl.split(/[\\/]/);
  const filename = parts[parts.length - 1] || '';
  const domain = BASE_URL.replace('https://', '').replace('www.', '');

  return `https://img.${domain}/anime/${filename}`;
}

/**
 * Costruisce l'id usato dalle route: "id-slug".
 */
function buildId(id, slug) {
  return slug ? `${id}-${slug}` : String(id);
}

/* ------------------------------------------------------------------ */
/* Sessione / CSRF                                                     */
/* ------------------------------------------------------------------ */

function ensureSession() {
  if (!sessionPromise) {
    sessionPromise = get(ARCHIVIO_URL, { 'User-Agent': USER_AGENT })
      .then(html => {
        const match = /<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/i.exec(html);
        return match ? match[1] : '';
      })
      .catch(error => {
        // Se il bootstrap fallisce azzeriamo la memoizzazione: un retry
        // successivo deve poter ritentare.
        sessionPromise = null;
        throw error;
      });
  }

  return sessionPromise;
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

function toShow(anime) {
  const title = anime.title_eng || anime.title || '';
  if (!anime.id || !title) return null;

  return {
    type: 'animeSeries',
    id: buildId(anime.id, anime.slug),
    title,
    poster: imageUrl(anime.imageurl),
    overview: anime.plot || '',
    rating: anime.score ? Number(anime.score) || 10 : 10,
  };
}

/**
 * "Ultimi Episodi": <layout-items items-json="..."> -> data[] con anime annidato.
 * Equivalente di parseLatestEpisodes (AnimeUnityProvider.kt:412).
 */
function parseLatestEpisodes(html) {
  const itemsJson = readAttr(html, 'layout-items', 'items-json');
  const parsed = safeJsonParse(itemsJson, null);
  if (!parsed || !parsed.data) return [];

  const seen = {};
  const shows = [];

  parsed.data.forEach(item => {
    if (!item || !item.anime) return;
    const anime = item.anime;
    const key = String(anime.id);
    if (seen[key]) return;
    seen[key] = true;

    const show = toShow(anime);
    if (show) shows.push(show);
  });

  return shows;
}

/**
 * "Ultime Aggiunte": div.home-sidebar div.latest-anime-container.
 * Equivalente di parseLatestAdditions (AnimeUnityProvider.kt:470).
 */
function parseLatestAdditions(html) {
  const containerPattern = /<div[^>]*class="[^"]*latest-anime-container[^"]*"[\s\S]*?(?=<div[^>]*class="[^"]*latest-anime-container|$)/gi;

  const shows = [];
  let match = containerPattern.exec(html);

  while (match !== null) {
    const chunk = match[0];

    // Nel markup l'ordine degli attributi non e' garantito: cerchiamo
    // prima il tag <a class="unstile-a"> e poi il suo href.
    const anchorMatch = /<a\b([^>]*class="[^"]*unstile-a[^"]*"[^>]*)>/i.exec(chunk);
    const hrefMatch = anchorMatch ? /href="([^"]+)"/i.exec(anchorMatch[1]) : null;
    const titleMatch = /<strong[^>]*class="[^"]*latest-anime-title[^"]*"[^>]*>([\s\S]*?)<\/strong>/i.exec(chunk);
    const imgMatch = /<img[^>]+src="([^"]+)"/i.exec(chunk);

    if (hrefMatch && titleMatch) {
      const href = hrefMatch[1];
      const id = href.substring(href.lastIndexOf('/') + 1);
      const title = decodeHtml(titleMatch[1]).replace(/<[^>]*>/g, '').trim();

      if (title) {
        shows.push({
          type: 'animeSeries',
          id,
          title,
          poster: imageUrl(imgMatch ? decodeHtml(imgMatch[1]) : ''),
          rating: 10,
        });
      }
    }

    match = containerPattern.exec(html);
  }

  return shows;
}

/**
 * "In Evidenza": <the-carousel animes="..."> JSON entity-encoded.
 * Equivalente di parseFeaturedAnime (AnimeUnityProvider.kt:530).
 */
function parseFeaturedAnime(html) {
  const animesJson = readAttr(html, 'the-carousel', 'animes');
  const parsed = safeJsonParse(animesJson, null);
  if (!Array.isArray(parsed)) return [];

  const items = [];

  parsed.forEach(anime => {
    if (!anime || !anime.id) return;

    const title = anime.title_eng || anime.title || '';
    if (!title) return;

    items.push({
      type: 'animeSeries',
      id: buildId(anime.id, anime.slug),
      title,
      poster: imageUrl(anime.imageurl_cover || anime.imageurl),
      overview: anime.plot || '',
      rating: anime.score ? Number(anime.score) || 10 : 10,
    });
  });

  return items;
}

/**
 * Records dell'archivio (POST /archivio/get-animes).
 * Equivalente di parseAnimeFromJson (AnimeUnityProvider.kt:580).
 */
function parseRecords(responseText) {
  const parsed = safeJsonParse(responseText, null);
  if (!parsed || !parsed.records) return [];

  return parsed.records
    .map(record => toShow(record))
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* API pubblica                                                        */
/* ------------------------------------------------------------------ */

/**
 * Home a categorie: le 3 shelf native di AnimeUnity.
 * Equivalente di AnimeUnityProvider.getHome() (:355).
 */
export function getHome() {
  return get(`${BASE_URL}/`, { 'User-Agent': USER_AGENT }).then(html => {
    const categories = [];

    const latestEpisodes = parseLatestEpisodes(html);
    const latestAdditions = parseLatestAdditions(html);
    const featured = parseFeaturedAnime(html);

    if (latestEpisodes.length) {
      categories.push({ key: 'latest-episodes', name: null, values: latestEpisodes });
    }
    if (latestAdditions.length) {
      categories.push({ key: 'latest-additions', name: null, values: latestAdditions });
    }
    if (featured.length) {
      categories.push({ key: 'featured', name: null, values: featured });
    }

    return { categories };
  });
}

/**
 * Archivio paginato. Usato per "carica altri" su una categoria.
 *
 * @param {number} page pagina 1-based
 * @param {string|null} type 'TV' | 'Movie' | null
 */
export function getAnimes(page = 1, type = null) {
  const offset = (page - 1) * PAGE_SIZE;

  return ensureSession()
    .then(csrf => {
      const payload = {
        title: false,
        type: type || false,
        year: false,
        order: false,
        status: false,
        genres: false,
        offset,
        dubbed: false,
        season: false,
      };

      return postJson(`${BASE_URL}/archivio/get-animes`, payload, {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrf,
        'X-Requested-With': 'XMLHttpRequest',
      });
    })
    .then(parseRecords);
}

/**
 * Ricerca per titolo.
 */
export function search(query, page = 1) {
  const offset = (page - 1) * PAGE_SIZE;

  return ensureSession()
    .then(csrf => {
      const payload = {
        title: query,
        type: false,
        year: false,
        order: false,
        status: false,
        genres: false,
        offset,
        dubbed: false,
        season: false,
      };

      return postJson(`${BASE_URL}/archivio/get-animes`, payload, {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrf,
        'X-Requested-With': 'XMLHttpRequest',
      });
    })
    .then(parseRecords);
}

/**
 * Dettaglio anime.
 */
export function getAnime(id) {
  return get(`${BASE_URL}/anime/${id}`, { 'User-Agent': USER_AGENT }).then(html => {
    const titleMatch = /<h1[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    const plotMatch = /<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html);
    const coverMatch = /<img[^>]*class="[^"]*cover[^"]*"[^>]*src="([^"]+)"/i.exec(html);

    const episodesCountRaw = readAttr(html, 'video-player', 'episodes_count');

    return {
      type: 'animeSeries',
      id,
      title: titleMatch ? decodeHtml(titleMatch[1]).replace(/<[^>]*>/g, '').trim() : '',
      overview: plotMatch ? decodeHtml(plotMatch[1]).replace(/<[^>]*>/g, '').trim() : '',
      poster: imageUrl(coverMatch ? decodeHtml(coverMatch[1]) : ''),
      rating: 10,
      episodesCount: episodesCountRaw ? Number(episodesCountRaw) || 0 : 0,
    };
  });
}

/**
 * Lista episodi.
 * Equivalente di getEpisodesBySeason/getEpisodesNormal (AnimeUnityProvider.kt:1140).
 * Per serie con piu' di 120 episodi il Kotlin pagina via API: qui leggiamo
 * solo l'attributo `episodes`, che copre il caso normale.
 */
export function getEpisodes(id) {
  return get(`${BASE_URL}/anime/${id}`, { 'User-Agent': USER_AGENT }).then(html => {
    const episodesRaw = readAttr(html, 'video-player', 'episodes');

    // Il payload e' JSON gia' decodificato dalle entita HTML. Alcune versioni
    // del sito lo URL-encodano: proviamo entrambe le strade, senza mai lanciare.
    let episodes = safeJsonParse(episodesRaw, null);

    if (!Array.isArray(episodes) && episodesRaw) {
      try {
        episodes = JSON.parse(decodeURIComponent(episodesRaw));
      } catch (e) {
        episodes = null;
      }
    }

    if (!Array.isArray(episodes)) return { episodes: [], embedUrl: null };

    const list = episodes.map((episode, index) => {
      const number = Number(episode.number) || (index + 1);

      return {
        id: String(episode.id),
        number,
        title: `Episodio ${number}`,
        overview: '',
        poster: '',
      };
    });

    // embed_url sulla video-player copre film / episodio 1
    const embedUrl = readAttr(html, 'video-player', 'embed_url');

    return { episodes: list, embedUrl };
  });
}

/**
 * URL embed di un singolo episodio.
 */
export function getEmbedUrl(animeId, episodeId) {
  return get(`${BASE_URL}/embed-url/${episodeId}`, { 'User-Agent': USER_AGENT }).then(
    text => text.trim(),
  );
}

export default {
  getHome,
  getAnimes,
  search,
  getAnime,
  getEpisodes,
  getEmbedUrl,
};

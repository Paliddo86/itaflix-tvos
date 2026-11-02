import * as request from '../request';
import { Anime, Episode } from '../helpers/models';

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

  return new Anime({
    ...anime,
    imageurl: imageUrl(anime.imageurl),
    cover: imageUrl(anime.cover),
    imageurl_cover: imageUrl(anime.imageurl_cover),
  });
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
        shows.push(new Anime({
          id,
          slug: id,
          title,
          imageurl: imageUrl(imgMatch ? decodeHtml(imgMatch[1]) : ''),
        }));
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

    items.push(new Anime({
      ...anime,
      title,
      imageurl: imageUrl(anime.imageurl),
      cover: imageUrl(anime.cover),
      imageurl_cover: imageUrl(anime.imageurl_cover),
    }));
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

    // Il tag <img class="cover"> e' spesso un placeholder (es. 640x960):
    // i dati veri stanno nel JSON dell'attributo `anime` di <video-player>.
    let meta = null;
    const animeJson = readAttr(html, 'video-player', 'anime');

    if (animeJson) {
      meta = safeJsonParse(animeJson, null);
    }

    const coverMatch = /<img[^>]*class="[^"]*cover[^"]*"[^>]*src="([^"]+)"/i.exec(html);
    const htmlCover = coverMatch ? decodeHtml(coverMatch[1]) : '';

    // Gerarchia: imageurl (poster verticale), poi cover, poi l'img della pagina.
    const poster = meta
      ? imageUrl(meta.imageurl || meta.cover || htmlCover)
      : imageUrl(htmlCover);

    // imageurl_cover e' il banner orizzontale usato come sfondo.
    const banner = meta ? imageUrl(meta.imageurl_cover) : '';

    const episodesCountRaw = readAttr(html, 'video-player', 'episodes_count');

    const title = titleMatch
      ? decodeHtml(titleMatch[1]).replace(/<[^>]*>/g, '').trim()
      : (meta && (meta.title_eng || meta.title)) || '';

    if (!meta) {
      console.error('AnimeUnity: JSON del video-player non leggibile, dati ridotti');
    }

    const anime = new Anime({
      ...(meta || {}),
      id: meta && meta.id ? meta.id : String(id).split('-')[0],
      slug: (meta && meta.slug) || String(id).split('-').slice(1).join('-'),
      title,
      plot: plotMatch ? decodeHtml(plotMatch[1]).replace(/<[^>]*>/g, '').trim() : (meta && meta.plot),
      imageurl: poster,
      imageurl_cover: banner,
      episodes_count: episodesCountRaw,
    });

    // La route usa l'id richiesto, che puo' includere lo slug.
    anime.id = id;
    anime.sid = id;
    anime.episodesCount = episodesCountRaw ? Number(episodesCountRaw) || 0 : 0;

    return anime;
  });
}

/**
 * Lista episodi.
 * Equivalente di getEpisodesBySeason/getEpisodesNormal (AnimeUnityProvider.kt:1140).
 * Per serie con piu' di 120 episodi il Kotlin pagina via API: qui leggiamo
 * solo l'attributo `episodes`, che copre il caso normale.
 */
const EPISODES_INLINE_LIMIT = 120;

function toEpisode(episode, index) {
  const number = Number(episode.number) || (index + 1);

  return new Episode({
    id: String(episode.id),
    number,
    title: `Episodio ${number}`,
    overview: '',
    poster: '',
    created_at: episode.created_at || null,
    updated_at: episode.created_at || null,
  });
}

/**
 * Episodi di un intervallo, per le serie che ne hanno piu' di 120.
 * Equivalente di getEpisodesFromApiRange (AnimeUnityProvider.kt:1180).
 *
 * @param {number} animeId id numerico dell'anime
 * @param {number} startRange
 * @param {number} endRange
 */
export function getEpisodesByRange(animeId, startRange, endRange) {
  const url = `${BASE_URL}/info_api/${animeId}/1`
    + `?start_range=${startRange}&end_range=${endRange}`;

  return get(url, {
    'User-Agent': USER_AGENT,
    'X-Requested-With': 'XMLHttpRequest',
  }).then(body => {
    const parsed = safeJsonParse(body, null);
    if (!parsed || !Array.isArray(parsed.episodes)) return [];

    return parsed.episodes.map(toEpisode);
  });
}

export function getEpisodes(id) {
  return get(`${BASE_URL}/anime/${id}`, { 'User-Agent': USER_AGENT }).then(html => {
    const episodesRaw = readAttr(html, 'video-player', 'episodes');
    const episodesCount = Number(readAttr(html, 'video-player', 'episodes_count')) || 0;

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

    // embed_url sulla video-player copre film / episodio 1
    const embedUrl = readAttr(html, 'video-player', 'embed_url');

    if (!Array.isArray(episodes)) {
      return { episodes: [], embedUrl, episodesCount };
    }

    const list = episodes.map(toEpisode);

    // La pagina espone al massimo 120 episodi inline (confermato su One Piece
    // ITA: 944 totali, 120 inline). Il resto arriva da info_api a blocchi.
    return { episodes: list, embedUrl, episodesCount };
  });
}

/**
 * Carica tutti gli episodi di una serie, paginando via info_api quando
 * superano il limite inline.
 */
export function getAllEpisodes(animeId, episodesCount) {
  const total = Number(episodesCount) || 0;

  const first = getEpisodes(`${animeId}`);

  if (total <= EPISODES_INLINE_LIMIT) {
    return first.then(result => result);
  }

  const numericId = String(animeId).split('-')[0];
  const ranges = [];

  for (let start = 1; start <= total; start += EPISODES_INLINE_LIMIT) {
    ranges.push([start, Math.min(start + EPISODES_INLINE_LIMIT - 1, total)]);
  }

  return first.then(result =>
    Promise.all(ranges.map(([start, end]) => getEpisodesByRange(numericId, start, end)))
      .then(chunks => {
        const episodes = chunks.reduce((all, chunk) => all.concat(chunk), []);

        return {
          episodes: episodes.length ? episodes : result.episodes,
          embedUrl: result.embedUrl,
          episodesCount: total,
        };
      }),
  );
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

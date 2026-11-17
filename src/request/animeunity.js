import * as request from '../request';
import { Anime, Episode } from '../helpers/models';

/*
 * AnimeUnity request layer by Pal0X
 *
 * Riscritto sulle API JSON di animeunity.cx (novembre 2026).
 * Il sito e' stato rifatto: la vecchia versione (animeunity.co) usava HTML
 * server-side con POST /archivio/get-animes e /info_api/{id}/1; il dominio
 * .co ora redirige su .cx e quegli endpoint restituiscono 404.
 *
 * Endpoint usati (dal route manifest del sito):
 *   GET  api/home/latest-episodes   ultimi episodi pubblicati
 *   GET  api/top-anime              in evidenza / top
 *   GET  api/archive?page=N         archivio paginato
 *   GET  api/search?q=              ricerca
 *   GET  api/anime/{id}/episodes    episodi di una serie
 *   GET  anime/{id}-{slug}/{videoId} pagina episodio (contiene embedUrl)
 *
 * Lo streaming arriva da vixcloud.cc, lo stesso host gia' gestito da
 * extractors/animeunity.js. Come per vixsrc, la pagina /embed/ di vixcloud
 * risponde 403 senza header Referer: il fetch va fatto dal bridge nativo
 * (vedi VixSrcService.getEmbed).
 */

const BASE_URL = 'https://animeunity.cx';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const JSON_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
};

function addHeaders(dict) {
  return XHR => {
    Object.keys(dict).forEach(key => XHR.setRequestHeader(key, dict[key]));
    return XHR;
  };
}

function getText(url, headers = {}) {
  return request
    .get(url, { prepare: addHeaders({ 'User-Agent': USER_AGENT, ...headers }) })
    .then(request.toString());
}

function getJson(url, headers = JSON_HEADERS) {
  return request
    .get(url, { prepare: addHeaders(headers) })
    .then(request.toJSON());
}

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

/**
 * `default_status` dell'API ('ongoing' | 'completed' ...) -> etichetta
 * italiana usata dalla UI (vedi localization: status-in corso / status-completo).
 */
function statusToIt(status) {
  if (!status) return '';
  if (status === 'ongoing') return 'In Corso';
  if (status === 'completed') return 'Completo';
  return status;
}

/**
 * Un item di `api/archive`, `api/search`, `api/top-anime` -> Anime.
 */
function toAnime(raw) {
  if (!raw || !raw.id) return null;

  const images = raw.images || {};
  const genres = Array.isArray(raw.genres)
    ? raw.genres.map(g => (typeof g === 'string' ? g : g && g.name)).filter(Boolean)
    : [];

  return new Anime({
    id: raw.id,
    slug: raw.slug,
    title: raw.title_it || raw.title,
    plot: raw.plot || '',
    // poster verticale, cover come fallback
    imageurl: images.poster || images.cover || '',
    cover: images.cover || images.poster || '',
    score: raw.score,
    date: raw.year ? `${raw.year}-01-01` : '',
    type: raw.type === 'movie' ? 'Movie' : 'TV',
    episodes_count: raw.total_episodes,
    episodes_length: raw.episode_runtime,
    status: statusToIt(raw.default_status),
    genres,
  });
}

function mapList(payload) {
  const data = payload && Array.isArray(payload.data) ? payload.data : [];
  return data.map(toAnime).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Home                                                                */
/* ------------------------------------------------------------------ */

/**
 * Home a categorie: le 3 shelf native.
 *
 * Le vecchie categorie erano Ultimi Episodi / Ultime Aggiunte / In Evidenza.
 * Con le API diventano: Ultimi Episodi / Top Anime / Archivio (prima pagina).
 */
export function getHome() {
  const latest = getJson(`${BASE_URL}/api/home/latest-episodes`)
    .then(payload => {
      const data = payload && Array.isArray(payload.data) ? payload.data : [];

      // Ogni voce e' un VIDEO (episodio), con l'anime annidato.
      return data
        .map(item => {
          const anime = item && item.episode && item.episode.anime;
          if (!anime) return null;

          const mapped = toAnime(anime);
          // Il tile della shelf mostra il numero di episodio.
          if (mapped && item.episode && item.episode.number) {
            mapped.nextEpisodeNumber = item.episode.number;
          }
          return mapped;
        })
        .filter(Boolean);
    })
    .catch(() => []);

  const top = getJson(`${BASE_URL}/api/top-anime`)
    .then(mapList)
    .catch(() => []);

  const archive = getJson(`${BASE_URL}/api/archive?page=1`)
    .then(mapList)
    .catch(() => []);

  return Promise.all([latest, top, archive]).then(
    ([latestEpisodes, topAnime, archiveList]) => {
      const categories = [];

      if (latestEpisodes.length) {
        categories.push({ key: 'latest-episodes', name: null, values: latestEpisodes });
      }
      if (topAnime.length) {
        categories.push({ key: 'featured', name: null, values: topAnime });
      }
      if (archiveList.length) {
        categories.push({ key: 'latest-additions', name: null, values: archiveList });
      }

      return { categories };
    },
  );
}

/* ------------------------------------------------------------------ */
/* Archivio e ricerca                                                  */
/* ------------------------------------------------------------------ */

/**
 * Archivio paginato.
 *
 * @param {number} page pagina 1-based
 */
export function getAnimes(page = 1) {
  return getJson(`${BASE_URL}/api/archive?page=${page}`).then(mapList);
}

/**
 * Ricerca per titolo.
 */
export function search(query, page = 1) {
  const q = encodeURIComponent(query || '');
  return getJson(`${BASE_URL}/api/search?q=${q}&page=${page}`).then(mapList);
}

/* ------------------------------------------------------------------ */
/* Dettaglio e episodi                                                 */
/* ------------------------------------------------------------------ */

/**
 * Estrae il payload Inertia (`data-page`) dalla pagina anime.
 *
 * Il sito e' un'app Inertia: ogni pagina porta un attributo
 *   data-page="{"component":...,"props":{...}}"
 * con tutte le entita' HTML-encoded. Li' dentro ci sono `anime`,
 * `loadedEpisodes` e `embedUrl`: molto piu' affidabile del parsing del DOM.
 *
 * @returns {object|null} l'oggetto props, o null se non presente
 */
function readPageProps(html) {
  if (!html) return null;

  const match = /data-page\s*=\s*"([^"]+)"/.exec(html);
  if (!match) return null;

  const decoded = match[1]
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

  try {
    const page = JSON.parse(decoded);
    return page && page.props ? page.props : null;
  } catch (e) {
    console.error('AnimeUnity: data-page non parsabile', e);
    return null;
  }
}

/**
 * Dettaglio anime.
 *
 * I dati completi (trama, generi, studi, score, numero episodi) stanno solo
 * nella pagina /anime/{id}-{slug}, dentro il payload Inertia.
 */
export function getAnime(id) {
  const numericId = String(id).split('-')[0];
  const slug = String(id).split('-').slice(1).join('-');
  const path = slug ? `${numericId}-${slug}` : numericId;

  return getText(`${BASE_URL}/anime/${path}`).then(html => {
    const props = readPageProps(html);
    const raw = props && props.anime ? props.anime : null;

    if (!raw) {
      console.error('AnimeUnity: blocco anime assente nella pagina', path);
      const fallback = new Anime({ id: numericId, slug, title: slug });
      fallback.id = id;
      fallback.sid = id;
      return fallback;
    }

    const anime = toAnime(raw);

    // Il numero reale di episodi e' in episodes_count / loadedEpisodes.total:
    // total_episodes puo' essere 0 per le serie in corso.
    const loaded = props.loadedEpisodes || {};
    const count = Number(raw.episodes_count)
      || Number(loaded.total)
      || Number(raw.total_episodes)
      || 0;

    anime.id = id;
    anime.sid = id;
    anime.episodesCount = count;
    anime.episodes_count = count;

    // Studi: la UI mostra `studio` come stringa.
    if (Array.isArray(raw.studios) && raw.studios.length) {
      anime.studio = raw.studios.map(s => s && s.name).filter(Boolean).join(', ');
    }

    return anime;
  });
}

/**
 * Converte un episodio dell'API in Episode.
 *
 * Un episodio puo' avere piu' video (ita / jpn): si sceglie l'italiano se
 * presente, altrimenti il primo disponibile. L'id usato nei link e' quello
 * del VIDEO, non dell'episodio.
 */
function toEpisode(ep, index) {
  const number = Number(ep.number) || (index + 1);
  const videos = Array.isArray(ep.videos) ? ep.videos : [];
  const ita = videos.find(v => v.language === 'ita' && !v.is_hidden);
  const chosen = ita || videos.find(v => !v.is_hidden) || videos[0] || {};

  return new Episode({
    id: String(chosen.id || ep.id),
    number,
    title: `Episodio ${number}`,
    overview: '',
    poster: '',
    created_at: null,
    updated_at: null,
    // extra usati da getEmbedUrl
    videoId: chosen.id || null,
    language: chosen.language || null,
    scwsId: chosen.scws_id || null,
  });
}

/**
 * Scarica una pagina di episodi a partire da `start` (1-based).
 *
 * L'API restituisce al massimo `tab_size` episodi per chiamata (120) e
 * riporta il totale reale in `total` (es. One Piece: 1180).
 */
function fetchEpisodePage(numericId, start) {
  return getJson(`${BASE_URL}/api/anime/${numericId}/episodes?start=${start}`)
    .then(payload => ({
      episodes: payload && Array.isArray(payload.episodes) ? payload.episodes : [],
      total: Number(payload && payload.total) || 0,
      tabSize: Number(payload && payload.tab_size) || 120,
    }));
}

/**
 * Deduplica e ordina le pagine grezze, poi converte in Episode.
 */
function buildEpisodesResult(pages, total) {
  const raw = pages.reduce((all, chunk) => all.concat(chunk), []);

  // Dedup per numero: le pagine potrebbero sovrapporsi.
  const seen = {};
  const unique = raw.filter(ep => {
    const number = Number(ep.number);
    if (!number || seen[number]) return false;
    seen[number] = true;
    return true;
  });

  unique.sort((a, b) => Number(a.number) - Number(b.number));

  const episodes = unique.map(toEpisode);

  return {
    episodes,
    embedUrl: '',
    episodesCount: total || episodes.length,
  };
}

/**
 * Episodi di una serie, tutti.
 *
 * Le serie lunghe (One Piece: 1180 episodi) richiedono piu' chiamate: la
 * prima pagina viene usata per scoprire `total` e `tab_size`, poi si
 * scaricano i blocchi mancanti in parallelo.
 */
export function getEpisodes(id) {
  const numericId = String(id).split('-')[0];

  return fetchEpisodePage(numericId, 1).then(first => {
    const pages = [first.episodes];
    const total = first.total;
    const tabSize = first.tabSize || 120;

    if (total > tabSize) {
      const requests = [];

      for (let start = tabSize + 1; start <= total; start += tabSize) {
        requests.push(fetchEpisodePage(numericId, start).then(p => p.episodes));
      }

      return Promise.all(requests).then(rest => {
        rest.forEach(chunk => pages.push(chunk));
        return buildEpisodesResult(pages, total);
      });
    }

    return buildEpisodesResult(pages, total || first.episodes.length);
  });
}

/**
 * Episodi di un intervallo.
 *
 * Il sito non espone piu' endpoint a blocchi (info_api/{id}/1 e' morto):
 * api/anime/{id}/episodes restituisce tutti gli episodi in una volta.
 * La funzione resta per compatibilita' con le route, che chiedono un range.
 *
 * @param {string|number} animeId id (anche con slug)
 * @param {number} [startRange] primo episodio richiesto (1-based)
 * @param {number} [endRange] ultimo episodio richiesto
 */
export function getEpisodesByRange(animeId, startRange, endRange) {
  const numericId = String(animeId).split('-')[0];
  const from = Number(startRange) || 1;
  const to = Number(endRange) || 0;

  // Senza limite superiore non c'e' un range: si scarica tutto.
  if (!to) {
    return getEpisodes(animeId).then(result => result.episodes);
  }

  // Si scaricano solo le pagine che coprono [from, to].
  // L'API pagina con ?start=<numero episodio> e blocchi da 120.
  const TAB = 120;
  const firstStart = Math.max(1, Math.floor((from - 1) / TAB) * TAB + 1);
  const requests = [];

  for (let start = firstStart; start <= to; start += TAB) {
    requests.push(fetchEpisodePage(numericId, start).then(p => p.episodes));
  }

  return Promise.all(requests).then(pages => {
    const raw = pages.reduce((all, chunk) => all.concat(chunk), []);

    const seen = {};
    const unique = raw.filter(ep => {
      const number = Number(ep.number);
      if (!number || seen[number]) return false;
      seen[number] = true;
      return true;
    });

    unique.sort((a, b) => Number(a.number) - Number(b.number));

    return unique
      .filter(ep => Number(ep.number) >= from && Number(ep.number) <= to)
      .map(toEpisode);
  });
}

/**
 * Tutti gli episodi. L'API non e' piu' paginata a blocchi: basta getEpisodes.
 */
export function getAllEpisodes(animeId) {
  return getEpisodes(animeId);
}

/**
 * URL embed di un episodio.
 *
 * Si apre la pagina dell'episodio e si estrae `embedUrl` dal JSON inline
 * (il payload e' entity-encoded, quindi prima si decodificano le entita').
 *
 * @param {string|number} animeId id (anche con slug)
 * @param {string|number} videoId id del video
 */
export function getEmbedUrl(animeId, videoId) {
  const numericId = String(animeId).split('-')[0];
  const slug = String(animeId).split('-').slice(1).join('-');
  const path = slug ? `${numericId}-${slug}` : `${numericId}`;

  return getText(`${BASE_URL}/anime/${path}/${videoId}`).then(html => {
    const props = readPageProps(html);

    if (props && props.embedUrl) {
      return props.embedUrl;
    }

    // Fallback: il video richiesto potrebbe essere nascosto o giapponese.
    // Si prova l'italiano dello stesso episodio.
    const episode = props && props.episode ? props.episode : null;
    const videos = episode && Array.isArray(episode.videos) ? episode.videos : [];
    const alternate = videos.find(v => String(v.id) !== String(videoId) && !v.is_hidden);

    if (alternate && alternate.id) {
      return getText(`${BASE_URL}/anime/${path}/${alternate.id}`).then(nextHtml => {
        const nextProps = readPageProps(nextHtml);
        return (nextProps && nextProps.embedUrl) || '';
      });
    }

    return '';
  });
}

export default {
  getHome,
  getAnimes,
  search,
  getAnime,
  getEpisodes,
  getAllEpisodes,
  getEmbedUrl,
};

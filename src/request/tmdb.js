import * as request from '../request';

const HOST = 'https://api.themoviedb.org';
const API_URL = `${HOST}/3`;
const API_KEY = 'fdecbcda829d6945e9a630936a2294c6';
const TMDB_IMAGE_SRC = 'https://image.tmdb.org/t/p/';

// TODO TMDB STATUS
// ['Returning Series', 'Planned', 'In Production', 'Ended', 'Canceled', 'Pilot']

export const tmdbTVShowStatusStrings = {
  'Ended': 'tvshow-status-ended',
  'Canceled': 'tvshow-status-closed',
  'Returning Series': 'tvshow-status-running',
  'Pilot': 'tvshow-status-pilot',
  'Planned': 'tvshow-status-planned',
  'In Production': 'tvshow-status-production',
};

function requestLogger(...params) {
  return [
    response => {
      console.info(...params, response);
      return response;
    },

    xhr => {
      console.error(...params, xhr.status, xhr);
      return Promise.reject(xhr);
    },
  ];
}

function headers() {
  const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36`;

  return {
    'Referer': HOST,
    'User-Agent': userAgent,
  };
}

function addHeaders(dict) {
  return XHR => {
    Object.keys(dict).forEach(key => XHR.setRequestHeader(key, dict[key]));
    return XHR;
  };
}

function getTmdbIdFromImdbId(imdbId) {
  return get(`${API_URL}/find/${imdbId}?api_key=${API_KEY}&language=it-IT&external_source=imdb_id`)
    .then(response => {
      const {movie_results, tv_results} = response;
      if(movie_results.length) return Promise.resolve(movie_results[0].id);
      if(tv_results.length) return Promise.resolve(tv_results[0].id);
    });
}

export function get(url) {
  return request
    .get(url, { prepare: addHeaders(headers()) })
    .then(request.toJSON())
    .then(...requestLogger('GET', url));
}

export function post(url, parameters) {
  return request
    .post(url, parameters, { prepare: addHeaders(headers()) })
    .then(request.toJSON())
    .then(...requestLogger('POST', url, parameters));
}

export function getTmdbShowDetails(id, imdbId) {
  if (!id) {
    return getTmdbIdFromImdbId(imdbId).then(tmIdId => {
      return get(`${API_URL}/tv/${tmIdId}?api_key=${API_KEY}&language=it-IT`);
    })
  }
  return get(`${API_URL}/tv/${id}?api_key=${API_KEY}&language=it-IT`);
}

export function getTmdbImageUrl(posterPath, episode = false) {
  let resolution = episode ? "w400" : "w185";
  return `${TMDB_IMAGE_SRC}${resolution}${posterPath}`;
}

export function getTmdbShowSeasonDetail(id, seasonNumber, imdbId) {
  if (!id) {
    return getTmdbIdFromImdbId(imdbId).then(tmIdId => {
      return get(`${API_URL}/tv/${tmIdId}/season/${seasonNumber}?api_key=${API_KEY}&language=it-IT`);
    })
  }
  return get(`${API_URL}/tv/${id}/season/${seasonNumber}?api_key=${API_KEY}&language=it-IT`);
}

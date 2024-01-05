/* global Device */

import config from '../../package.json';

import { getFingerprint, getListId, getLoginData, getToken, isAuthorized, set } from '../user';
import * as request from '../request';
import * as settings from '../settings';
import * as topShelf from '../helpers/topShelf';
import { get as i18n } from '../localization';
import { isQello, groupSeriesByCategory } from '../utils';

const { VIDEO_QUALITY, TRANSLATION } = settings.params;
const { SD, HD, FULLHD, UHD } = settings.values[VIDEO_QUALITY];
const { LOCALIZATION, SUBTITLES } = settings.values[TRANSLATION];

const TOP_SHELF_MIN_ITEMS = 4;
const HOST = 'https://altadefinizione-originale.online';
const ONLY_HOST = 'altadefinizione-originale.online';
const API_URL = `${HOST}/api`;

function getLatest(tvshows, count = 10) {
  return tvshows.sort(({ sid: a }, { sid: b }) => b - a).slice(0, count);
}

export const supportUHD = Device.productType !== 'AppleTV5,3';

export const version = `v${config.version}`;

export const tvshow = {
  ENDED: 'ended',
  CLOSED: 'closed',
  RUNNING: 'running',
};

export const localization = {
  ORIGINAL: 'original',
  ORIGINAL_SUBTITLES: 'original_subtitles',
  LOCALIZATION: 'localization',
  LOCALIZATION_SUBTITLES: 'localization_subtitles',
};

export const mediaQualities = {
  1: SD,
  2: HD,
  3: FULLHD,
  4: UHD,
};

export const mediaQualityRanking = [supportUHD && UHD, FULLHD, HD, SD].filter(
  Boolean,
);

export const mediaLocalizationRanking = {
  [LOCALIZATION]: [
    localization.LOCALIZATION,
    localization.LOCALIZATION_SUBTITLES,
    localization.ORIGINAL_SUBTITLES,
    localization.ORIGINAL,
  ],

  [SUBTITLES]: [
    localization.ORIGINAL_SUBTITLES,
    localization.LOCALIZATION_SUBTITLES,
    localization.LOCALIZATION,
    localization.ORIGINAL,
  ],
};

export const mediaLocalizations = {
  1: localization.ORIGINAL,
  2: localization.ORIGINAL_SUBTITLES,
  3: localization.LOCALIZATION_SUBTITLES,
  4: localization.LOCALIZATION,
};

export const mediaLocalizationStrings = {
  [localization.ORIGINAL]: 'Original',
  [localization.ORIGINAL_SUBTITLES]: 'Original with subtitles',
  [localization.LOCALIZATION]: 'Localization',
  [localization.LOCALIZATION_SUBTITLES]: 'Localization with subtitles',
};

export const TVShowStatuses = {
  0: tvshow.RUNNING,
  1: tvshow.ENDED,
  2: tvshow.CLOSED,
};

export const TVShowStatusStrings = {
  [tvshow.ENDED]: 'tvshow-status-ended',
  [tvshow.CLOSED]: 'tvshow-status-closed',
  [tvshow.RUNNING]: 'tvshow-status-running',
};

function emptyOrErrorsResolvers(defaults) {
  return [
    // eslint-disable-next-line no-confusing-arrow
    response => (response != null ? response : defaults),
    () => defaults,
  ];
}

function resolveCodeToIndex(code, collection = []) {
  const index = collection.indexOf(code);
  return index < 0 ? collection.length : index;
}

function requestLogger(...params) {
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

function headers(token = '', noToken = false) {
  const authToken = token || getToken();
  const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.2 Safari/605.1.15";

  let headers = {
    'User-Agent': userAgent,
    'Host': ONLY_HOST,
    'Origin': HOST,
    'X-Requested-With': "XMLHttpRequest",
    'Accept': 'application/json'
  };

  if (!noToken) {
    headers["Authorization"] = `Bearer ${authToken}`
  }

  return headers;
}

function addHeaders(dict) {
  return XHR => {
    Object.keys(dict).forEach(key => XHR.setRequestHeader(key, dict[key]));
    return XHR;
  };
}

// Generates a random "Gmail"
function generateRandomEmail() {
  const chars = 'abcdefghijklmnopqrstuvwxyz1234567890.';
  let email = '';
  let ii = 0;
  for (ii = 0; ii < 15; ii++) {
    email += chars[Math.floor(Math.random() * chars.length)];
  }
  return email + '@gmail.com';
}

// Generates a random password
function generateRandomPass() {
  const chars = 'abcdefghijklmnopqrstuvwxyz1234567890.$-';
  let pass = '';
  let ii = 0;
  for (ii = 0; ii < 10; ii++) {
    pass += chars[Math.floor(Math.random() * chars.length)];
  }
  return pass;
}

// Generates a fake fingerprint
function generateFakeFingerPrint() {
  const chars = '1234567890';
  let finger = '';
  let ii = 0;
  for (ii = 0; ii < 16; ii++) {
    finger += chars[Math.floor(Math.random() * chars.length)];
  }
  set({fingerprint: finger});
  return finger;
}

export function get(url, token = '', noToken = false) {
  return request
    .get(url, { prepare: addHeaders(headers(token, noToken)) })
    .then(request.toJSON())
    .then(...requestLogger('GET', url));
}

export function post(url, parameters, token = "", noToken = false) {
  return request
    .post(url, parameters, { prepare: addHeaders(headers(token, noToken)) })
    .then(request.toJSON())
    .then(...requestLogger('POST', url, parameters));
}

export function del(url, parameters, token = "", noToken = false) {
  return request
    .del(url, parameters, { prepare: addHeaders(headers(token, noToken)) })
    .then(request.toJSON())
    .then(...requestLogger('DELETE', url, parameters));
}

export function verifyMail(userId, verifyCode, token) {
  return get(`${API_URL}/verify/email/${userId}/${verifyCode}`, token);
}

export function registerAccount(email, password, fingerprint) {
  const body = {
    email,
    password,
    password_confirmation: password,
    fingerprint,
    selected_plan: 1
  }
  return post(`${API_URL}/register`, body, null, true);
}

export function login(email, password, fingerprint) {
  const body = {
    email,
    password,
    fingerprint
  }
  return post(`${API_URL}/login`, body, null, true).then(response => {
    const result = {
      token: response.token,
      user_id: response.user.id,
      fingerprint,
      verified_at: response.user.email_verified_at,
      email,
      password,
      logged: response.status ? 1 : 0,
      list_id: response.user_lists[0].id
    }
    return Promise.resolve(result);
  });
}

export function authorizeAccount() {
  const email = generateRandomEmail();
  const pass = generateRandomPass();

  return registerAccount(email, pass, fingerprint).then(response => {
    const result = {
      token: response.token,
      user_id: response.user.id,
      fingerprint,
      email,
      password: pass
    }
    return verifyMail(result.user_id, response.user.verification_code, result.token).then(verifyRes => {
      if (!verifyRes.status) return Promise.reject(new Error("Fail to verify email"));
      return Promise.resolve(result);
    }).catch(error => {
      console.error("errore", error)
    })
  })
}

function check() {
  let fingerprint = getFingerprint() || generateFakeFingerPrint();
  return get(`${API_URL}/check?fingerprint=${fingerprint}`).then(result => {
    if(process.env.NODE_ENV === "development") {
      console.log("Check On Free Time %s", result.user.on_free_time);
    }
    return Promise.resolve(result.user.on_free_time);
  }).catch(() => {
    if(process.env.NODE_ENV === "development") {
      console.log("Check Failed, fingerprint= %s", fingerprint);
    }
    return Promise.resolve(false);
  })
}

export function checkSession() {
  let { email, password } = getLoginData();
  let list_id = getListId();
  if (!email) return Promise.resolve({ logged: 0, token: "" });
  if (!password) return Promise.resolve({ logged: 0, token: "" });

  return check().then(checked => {
    return new Promise(resolve => {
    if (!checked || !list_id) {
      let fingerprint = getFingerprint() || generateFakeFingerPrint();
        logout().catch(() => {
          if(process.env.NODE_ENV === "development") {
            console.log("Fail to logout relogin");
          }
        }).finally(() => {
          login(email, password, fingerprint).then(result => {
            return reAuthorize(result).then((auth) => {
              return resolve({ ...result, verified_at: auth.user.email_verified_at });
            });
          })
        })
      } else {
        // Autorizzato non faccio nulla
        return resolve(null);
      }
    })
  })
}

export function authorize({ email, password }) {
  let fingerprint = getFingerprint() || generateFakeFingerPrint();
  return login(email, password, fingerprint).catch(xhr => {
    if (xhr.status === 403) {
      return request.toJSON()(xhr);
    }
    return Promise.reject(xhr);
  });
}

export function reAuthorize({ token }) {
  return post(`${API_URL}/user/disable_forced_on_subscription`, {}, token).catch(xhr => {
    if (xhr.status === 403) {
      return request.toJSON()(xhr);
    }
    return Promise.reject(xhr);
  });
}

export function getFamilyAccounts() {
  return get(`${API_URL}/family/`);
}

export function migrateToFamilyAccount() {
  return post(`${API_URL}/family/migrate/`);
}

export function turnOffFamilyAccount() {
  return post(`${API_URL}/family/unset/`);
}

export function selectAccount(fid) {
  return post(`${API_URL}/family/set/${fid}/`, { fid });
}

export function addAccount(name) {
  return post(`${API_URL}/family/add/`, { name });
}

export function renameAccount(fid, name) {
  return post(`${API_URL}/family/rename/${fid}/`, { fid, name });
}

export function deleteAccount(fid) {
  return post(`${API_URL}/family/remove/${fid}/`, { fid });
}

export function logout() {
  return post(`${API_URL}/logout`);
}

export function getMyTVShows() {
  return get(`${API_URL}/soap/my/`)
    .then(...emptyOrErrorsResolvers([]))
    .then(series => {
      if (isAuthorized() && !isQello()) {
        const { unwatched, watched, closed } = groupSeriesByCategory(series);
        const sections = [];

        if (unwatched.length) {
          sections.push({
            id: 'unwatched',
            title: i18n('my-new-episodes'),
            items: unwatched.map(topShelf.mapSeries),
          });
        }

        if (unwatched.length < TOP_SHELF_MIN_ITEMS && watched.length) {
          sections.push({
            id: 'watched',
            title: i18n('my-watched'),
            items: watched.map(topShelf.mapSeries),
          });
        }

        if (unwatched.length + watched.length < TOP_SHELF_MIN_ITEMS) {
          if (closed.length) {
            sections.push({
              id: 'closed',
              title: i18n('my-closed'),
              items: closed.map(topShelf.mapSeries),
            });
          }
        }

        topShelf.set({ sections });
      }

      return series;
    });
}

export function getAllTVShows() {
  return get(`${API_URL}/soap/`).then(series => {
    if (!isAuthorized() && !isQello()) {
      const latest = getLatest(series);

      topShelf.set({
        sections: [
          {
            id: 'latest',
            title: i18n('search-latest'),
            items: latest.map(topShelf.mapSeries),
          },
        ],
      });
    }

    return series;
  });
}

export function getAllMovies(page = 1) {
  return get(`${API_URL}/category/film?type=movie&page=${page}`).then(({data}) => {
    topShelf.set({
      sections: [
        {
          id: 'latest',
          title: i18n('all-group-latest'),
          items: data.map(topShelf.mapBaseTile),
        },
      ],
    });
    return data;
  });
}

export function getLatestUpdates() {
  return get(`${API_URL}/home/posts/categories?page=1`).then(response => {
    let data = response.categories.data;

    return {
      latest: {
        name: data[0].homepage_name,
        values: data[0].posts.map(topShelf.mapBaseTile)
      },
      news: {
        name: data[1].homepage_name,
        values: data[1].posts.map(topShelf.mapBaseTile)
      },
      seriesUpdate: {
        name: i18n('tv-show-updates'),
        values: data[2].posts.map(topShelf.mapBaseTile)
      }
    }

    // if (!isAuthorized() && !isQello()) {
    //   const latest = getLatest(series);

    //   topShelf.set({
    //     sections: [
    //       {
    //         id: 'latest',
    //         title: i18n('search-latest'),
    //         items: latest.map(topShelf.mapSeries),
    //       },
    //     ],
    //   });
    // }

    // return series;
  });
}

export function getPopularTVShows(count = 10) {
  return getAllTVShows().then(tvshows =>
    tvshows.sort(({ likes: a }, { likes: b }) => b - a).slice(0, count),
  );
}

export function getTVShowsByGenre(genre, page = 1) {
  return get(`${API_URL}/category/${genre}?type=tvshow&page=${page}`).then(response => {
    const data = response.data;
    let tvshows = data.map(topShelf.mapBaseTile);
    return {total: response.total, current_page: response.current_page, last_page: response.last_page, tvshows};
  });
}

export function getMoviesByGenre(genre, page = 1) {
  return get(`${API_URL}/category/${genre}?type=movie&page=${page}`).then(response => {
    const data = response.data;
    let movies = data.map(topShelf.mapBaseTile);
    return {total: response.total, current_page: response.current_page, last_page: response.last_page, movies};
  });
}

export function getTVShowDescription(sid) {
  return get(`${API_URL}/posts/id/${sid}`).then(response => { return { result: response.post } });
}

export function getMovieDescription(sid) {
  return get(`${API_URL}/posts/id/${sid}`).then(response => { return { result: response.post } });
}

export function getCountriesList() {
  return get(`${API_URL}/soap/countrys/`);
}

export function getGenresList() {
  return get(`${API_URL}/soap/genres/`);
}

export function getTVShowEpisodes(sid) {
  return get(`${API_URL}/episodes/${sid}/`);
}

export function getMyRecommendations() {
  return get(`${API_URL}/soap/recommendations/personal/`).then(
    ...emptyOrErrorsResolvers([]),
  );
}

export function getTVShowRecommendations(sid) {
  return get(`${API_URL}/soap/recommendations/${sid}/`).then(
    ...emptyOrErrorsResolvers([]),
  );
}

export function getTVShowReviews(sid) {
  return get(`${API_URL}/reviews/${sid}/`).then(...emptyOrErrorsResolvers([]));
}

export function markReviewAsLiked(rid) {
  return post(`${API_URL}/rate/review/${rid}/like/`);
}

export function markReviewAsDisliked(rid) {
  return post(`${API_URL}/rate/review/${rid}/dislike/`);
}

export function rateTVShow(sid, rating) {
  return post(`${API_URL}/rate/soap/${sid}/${rating}/`, {
    sid,
    rating,
  });
}

export function rateEpisode(sid, season, episode, rating) {
  return post(
    `${API_URL}/rate/episode/${sid}/${season}/${episode}/rating/${rating}/`,
    {
      sid,
      season,
      rating,
      episode,
    },
  );
}

export function getTVShowTrailers(sid) {
  return get(`${API_URL}/trailers/${sid}/`).then(...emptyOrErrorsResolvers([]));
}

export function getTVShowSeasons(slug) {
  return get(`${API_URL}/posts/seasons/${slug}`).then(response => { 
    if(Array.isArray(response.seasons)) return response.seasons;
    else {
      let seasons = [];
      for (let [key, value] of Object.entries(response.seasons)) {
        value.seasonId = (parseInt(key) + 1).toString();
        seasons.push(value);
      }
      return seasons;
    }
  });
}

export function getTVShowSeason(sid, id) {
  return getTVShowSeasons(sid).then(seasons => {
    const [season] = seasons.filter(item => item.season === id);
    return season;
  });
}

export function getTVShowSchedule(sid) {
  return get(`${API_URL}/shedule/${sid}/`)
    .then(schedule =>
      schedule.reduce((result, item) => {
        if (!result[item.season - 1]) {
          // eslint-disable-next-line no-param-reassign
          result[item.season - 1] = {
            episodes: [],
            season: `${item.season}`,
          };
        }
        result[item.season - 1].episodes.unshift(item);
        return result;
      }, []),
    )
    .catch(() => []);
}

export function getMySchedule() {
  return get(`${API_URL}/shedule/my/`).catch(() => []);
}

export function getActorInfo(id) {
  return get(`${API_URL}/soap/person/${id}/`);
}

export function getEpisodeMedia({ files = [] }, translation) {
  const qualitySettings = settings.get(VIDEO_QUALITY);
  const translationSettings = translation || settings.get(TRANSLATION);

  const mediaQualityIndex = mediaQualityRanking.indexOf(qualitySettings);
  const qualityRanking = mediaQualityRanking.slice(mediaQualityIndex);
  const localizationRanking = mediaLocalizationRanking[translationSettings];

  const [rankedFile] = files
    .slice(0)
    .sort(
      (
        { quality: qualityA, translate: translateA },
        { quality: qualityB, translate: translateB },
      ) => {
        const qualityIndexA = resolveCodeToIndex(
          ...[mediaQualities[qualityA], qualityRanking],
        );

        const qualityIndexB = resolveCodeToIndex(
          ...[mediaQualities[qualityB], qualityRanking],
        );

        const localizationIndexA = resolveCodeToIndex(
          ...[mediaLocalizations[translateA], localizationRanking],
        );

        const localizationIndexB = resolveCodeToIndex(
          ...[mediaLocalizations[translateB], localizationRanking],
        );

        const qualityWeight = qualityIndexA - qualityIndexB;
        const localizationWeight = localizationIndexA - localizationIndexB;

        return qualityWeight + localizationWeight;
      },
    );

  return rankedFile;
}

export function markTVShowAsWatched(sid) {
  return post(`${API_URL}/episodes/watch/full/${sid}/`);
}

export function markTVShowAsUnwatched(sid) {
  return post(`${API_URL}/episodes/unwatch/full/${sid}/`);
}

export function markSeasonAsWatched(sid, season) {
  return post(`${API_URL}/episodes/watch/full/${sid}/${season}/`);
}

export function markSeasonAsUnwatched(sid, season) {
  return post(`${API_URL}/episodes/unwatch/full/${sid}/${season}/`);
}

export function markEpisodeAsWatched(sid, season, episodeNumber) {
  return post(`${API_URL}/episodes/watch/${sid}/${season}/${episodeNumber}/`);
}

export function markEpisodeAsUnwatched(sid, season, episodeNumber) {
  return post(`${API_URL}/episodes/unwatch/${sid}/${season}/${episodeNumber}/`);
}

export function getMediaStream(slug, seasonId, episodeId) {
  return get(`${API_URL}/post/urls/stream/${slug}/${seasonId}/${episodeId}`);
}

export function getMovieMediaStream(slug) {
  return get(`${API_URL}/post/urls/stream/${slug}`);
}

export function getTrailerStream(tid) {
  return post(`${API_URL}/play/trailer/${tid}/`);
}

export function addToMyTVShows(sid) {
  return post(`${API_URL}/soap/watch/${sid}/`);
}

export function removeFromMyTVShows(sid) {
  return post(`${API_URL}/soap/unwatch/${sid}/`);
}

export function getSearchResults(query, page = 1) {
  return get(`${API_URL}/search?search=${encodeURIComponent(query)}&page=${page}`).then(response => {
    let moviesFounded = [];
    let tvshowFounded = [];

    for (let data of response.data) {
      if (data.type === "tvshow") {
        tvshowFounded.push(topShelf.mapBaseTile(data));
      } else if (data.type === "movie") {
        moviesFounded.push(topShelf.mapBaseTile(data));
      }
    }

    return {
      searchResults: {
        moviesFounded,
        tvshowFounded
      }
    };
  })

}

export function saveElapsedTime(eid, time) {
  return post(`${API_URL}/play/episode/${eid}/savets/`, {
    eid,
    time,
  });
}

export function getSpeedTestServers() {
  return get(`${API_URL}/speedtest/servers/`);
}

export function saveSpeedTestResults(results) {
  return post(`${API_URL}/speedtest/save/`, results);
}

export function getUiData() {
  return get(`${API_URL}/generic/ui`).then(response => {
    let genresMovie = {};
    let genresTvShows = {};
    // let keys = [
    //   "featured_categories",
    //   "movie_categories",
    //   "tvshow_categories",
    //   "tvprogram_categories"
    // ];
    
    // MOVIES GENRES
    response[settings.params.MOVIE_CATEGORIES].forEach(elem => {
      if(elem.name === "Film") return;
      genresMovie[elem.id] = {name: elem.homepage_name, slug: elem.slug};
    });

    settings.set(settings.params.MOVIE_CATEGORIES, genresMovie);

    // TV SHOW GENRES
    response[settings.params.TV_SHOW_CATEGORIES].forEach(elem => {
      if(elem.name === "Serie TV") return;
      genresTvShows[elem.id] = {name: elem.homepage_name, slug: elem.slug};
    });

    settings.set(settings.params.TV_SHOW_CATEGORIES, genresTvShows);
  });
}

export function getRelated(slug) {
  return new Promise(resolve => {
    let timeout = setTimeout(() => {
      return resolve({ relatedData: [] });
    }, 2000)
    get(`${API_URL}/posts/related/${slug}?page=1`).then((response) => {
      clearTimeout(timeout);
      return resolve({ relatedData: response.data.map(topShelf.mapBaseTile) });
    }).catch(() => {
      resolve({ relatedData: [] })
    })
  })
}

export function getAllUpdates() {
  return get(`${API_URL}/posts/updates`).then((response) => {
    let moviesUpdates = [];
    let tvshowUpdates = [];

    for (let key in response.updates) {
      for (let data of response.updates[key]) {
        if (data.post.type === "tvshow") {
          tvshowUpdates.push(topShelf.mapBaseTile({ ...data.post, update_type: data.update_type }));
        } else if (data.post.type === "movie") {
          moviesUpdates.push(topShelf.mapBaseTile({ ...data.post, update_type: data.update_type }));
        }
      }
    }

    return {
      moviesUpdate: {
        name: i18n('movie-updates'),
        values: moviesUpdates
      },
      seriesUpdate: {
        name: i18n('tv-show-updates'),
        values: tvshowUpdates
      }
    }
  })
}

export function getCollection(collection_slug) {
  if (!collection_slug) return Promise.resolve({ collectionData: [] });
  
  return new Promise(resolve => {
    let timeout = setTimeout(() => {
      return resolve({ collectionData: [] });
    }, 2000)
    get(`${API_URL}/collection/${collection_slug}`).then((response) => {
      clearTimeout(timeout);
      return resolve({ collectionData: response.data.map(topShelf.mapBaseTile) });
    }).catch(() => {
      resolve({ collectionData: [] })
    })
  })
}

export function getMyListCollection(listId) {
      return get(`${API_URL}/user/list/${listId}/posts`).then(response => {
        let myMovies = [];
        let myTvShows = [];
    
        for (let element of response.data) {
          if (element.type === "tvshow") {
            myTvShows.push(topShelf.mapBaseTile(element));
          } else if (element.type === "movie") {
            myMovies.push(topShelf.mapBaseTile(element));
          }
        }
        return { myMovies, myTvShows };
      })
}

export function addToMyList(listId, itemId) {
  return post(`${API_URL}/user/list/post/${listId}/${itemId}`);
}

export function removeFromMyList(listId, itemId) {
  return del(`${API_URL}/user/list/post/${listId}/${itemId}`);
}

export function isPreferred(itemId) {
  return get(`${API_URL}/user/lists/posts/${itemId}`).then(result => {
    return result.lists.length > 0;
  });
}

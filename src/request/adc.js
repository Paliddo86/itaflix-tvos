/* global Device */

import md5 from 'blueimp-md5';

import config from '../../package.json';

import { getToken, isAuthorized, isSessionValid } from '../user';
import * as request from '../request';
import * as settings from '../settings';
import * as topShelf from '../helpers/topShelf';
import { get as i18n } from '../localization';
import { genreToId, isQello, groupSeriesByCategory } from '../utils';

const { VIDEO_QUALITY, TRANSLATION } = settings.params;
const { SD, HD, FULLHD, UHD } = settings.values[VIDEO_QUALITY];
const { LOCALIZATION, SUBTITLES } = settings.values[TRANSLATION];

const TOP_SHELF_MIN_ITEMS = 4;
const HOST = 'https://altadefinizionecommunity.online';
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
      console.info(...params, response);
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
  const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36`;

  let headers = {
    'Referer': HOST,
    'User-Agent': userAgent,
  };

  if (!noToken) {
    headers["Authentication"] = `Bearer ${authToken}`
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

export function login(email, password, fingerprint, token) {
  const body = {
    email,
    password,
    fingerprint
  }
  return post(`${API_URL}/login`, body, token).then(response => {
    const result = {
      token: response.token,
      user_id: response.user.id,
      fingerprint,
      verified_at: response.user.email_verified_at,
      email,
      password,
      logged: 1
    }
    return Promise.resolve(result);
  });
}

export function authorizeAccount() {
  const email = generateRandomEmail();
  const pass = generateRandomPass();
  const fingerprint = generateFakeFingerPrint();

  return registerAccount(email, pass, fingerprint).then(response => {
    console.log("register new account", response)
    const result = {
      token: response.token,
      user_id: response.user.id,
      fingerprint,
      email,
      password: pass
    }
    return verifyMail(result.user_id, response.user.verification_code, result.token).then(verifyRes => {
      if(!verifyRes.status) return Promise.reject(new Error("Fail to verify email"));
      return Promise.resolve(result);
    }).catch(error => {
      console.error("errore", error)
    })
  })
}

export function checkSession() {
  if(!isSessionValid()) {
    return authorizeAccount().then(res => {return login(res.email, res.password, res.fingerprint, res.token)});
  }
  return Promise.resolve({logged: 1});
}

export function authorize({ login, password }) {
  return post(`${API_URL}/auth/`, { login, password }).catch(xhr => {
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
  return post(`${API_URL}/auth/logout/`);
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

export function getLatestTVShows(count = 10) {
  return getAllTVShows().then(tvshows => getLatest(tvshows, count));
}

export function getPopularTVShows(count = 10) {
  return getAllTVShows().then(tvshows =>
    tvshows.sort(({ likes: a }, { likes: b }) => b - a).slice(0, count),
  );
}

export function getTVShowsByGenre(genre) {
  return get(`${API_URL}/soap/genre/${genreToId(genre)}/`);
}

export function getTVShowDescription(sid) {
  return get(`${API_URL}/soap/description/${sid}/`);
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

export function getTVShowSeasons(sid) {
  return (
    getTVShowEpisodes(sid)
      // eslint-disable-next-line arrow-body-style
      .then(({ covers, episodes }) => {
        return (episodes || []).reduce((result, episode) => {
          if (!result[episode.season]) {
            // eslint-disable-next-line no-param-reassign
            result[episode.season] = {
              episodes: [],
              unwatched: 0,
              season: episode.season,
              covers: covers.filter(
                ({ season }) => season === episode.season,
              )[0],
            };
          }
          result[episode.season].episodes.push(episode);

          // eslint-disable-next-line no-param-reassign
          if (!episode.watched) result[episode.season].unwatched += 1;
          return result;
        }, {});
      })
      // eslint-disable-next-line arrow-body-style
      .then(seasonsCollection => {
        return Object.keys(seasonsCollection)
          .sort((a, b) => a - b)
          .map(seasonNumber => seasonsCollection[seasonNumber])
          .map(season => ({
            ...season,
            episodes: season.episodes
              .slice(0)
              .sort((a, b) => a.episode - b.episode),
          }));
      })
  );
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

export function getMediaStream(media) {
  const { sid, file } = media;
  const { eid, hash: episodeHash } = file;

  const token = getToken();
  const hash = md5(token + eid + sid + episodeHash);

  return post(`${API_URL}/play/episode/${eid}/`, { eid, hash });
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

export function getSearchResults(query) {
  return get(`${API_URL}/search/?q=${encodeURIComponent(query)}`);
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

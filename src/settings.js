/* global localStorage */

import EventBus from './event-bus';

const bus = new EventBus();

export const subscription = bus.subscription.bind(bus);

const STORAGE_KEY = 'itaflix-settings';

const quality = {
  SD: 'sd',
  HD: 'hd',
  FULLHD: 'fullhd',
  UHD: '4k',
};

const streamQuality = {
  SD: '720p',
  HD: '1080p',
  FULLHD: '2k',
  UHD: '4k',
}

const translation = {
  LOCALIZATION: 'localization',
  SUBTITLES: 'subtitles',
};

const playback = {
  CONTINUES: 'continues',
  BY_EPISODE: 'by_episode',
};

const language = {
  AUTO: 'auto',
  IT: 'it',
  EN: 'en',
  RU: 'ru',
};

export const params = {
  VIDEO_QUALITY: 'video-quality',
  TRANSLATION: 'translation',
  VIDEO_PLAYBACK: 'video-playback',
  LANGUAGE: 'language',
  GENRES: 'genres'
};

export const values = {
  [params.VIDEO_QUALITY]: quality,
  [params.TRANSLATION]: translation,
  [params.VIDEO_PLAYBACK]: playback,
  [params.LANGUAGE]: language,
  [params.GENRES]: {},
};

const defaults = {
  [params.VIDEO_QUALITY]: quality.FULLHD,
  [params.TRANSLATION]: translation.LOCALIZATION,
  [params.VIDEO_PLAYBACK]: playback.CONTINUES,
  [params.LANGUAGE]: language.AUTO,
};

function checkKeyValidity(key) {
  return Object.keys(params).some(param => params[param] === key);
}

function checkKeyValueValidity(key, value) {
  if (!checkKeyValidity(key)) return false;

  return Object.keys(values[key]).some(param => values[key][param] === value);
}

function getSettingsFromStorage(defaultSettings = {}) {
  const settings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const validatedSettings = Object.keys(settings)
    .filter(checkKeyValidity)
    .map(key => ({ key, value: settings[key] }))
    .filter(({ key, value }) => checkKeyValueValidity(key, value))
    .reduce((result, { key, value }) => {
      // eslint-disable-next-line no-param-reassign
      result[key] = value;
      return result;
    }, {});

  return {
    ...defaultSettings,
    ...validatedSettings,
  };
}

const settings = getSettingsFromStorage(defaults);

export function set(key, value) {
  const hasParam = checkKeyValidity(key);
  const hasValue = key === params.GENRES ? true : checkKeyValueValidity(key, value);

  if (!hasParam) throw new Error(`Unsupported settings param "${key}"`);
  if (!hasValue) {
    throw new Error(`Unsupported value "${value}" for settings param "${key}"`);
  }

  const prevValue = settings[key];

  settings[key] = value;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  bus.broadcast({ key, value, prevValue });
}

export function get(key) {
  return settings[key];
}

export function getAll() {
  let setting = {}
  for (let key in settings) {
    if(key === params.GENRES) continue;
    setting[key] = settings[key];
  }
  return setting;
}

export function getGenresById(id) {
  return settings[params.GENRES][id];
}

export function getPreferredVideoQuality() {
  let quality = streamQuality[settings[params.VIDEO_QUALITY].toUpperCase()];
  return quality;
}

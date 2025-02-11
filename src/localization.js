/* global Settings */

import moment from 'moment';

import EventBus from './event-bus';
import * as settings from './settings';

import English from './localization/en';
import Italian from './localization/it';

const bus = new EventBus();

const { LANGUAGE } = settings.params;
const { AUTO, IT, EN } = settings.values[LANGUAGE];

const translations = {
  default: Italian,
  [IT]: Italian,
  [EN]: English
};

export function getSystemLanguage() {
  return Settings.language;
}

export function getLanguage() {
  if (settings.get(LANGUAGE) === AUTO) {
    return getSystemLanguage();
  }
  return settings.get(LANGUAGE);
}

// Configuring initial locale.
moment.locale(getLanguage());

settings.subscription().pipe(({ key }) => {
  if (key === LANGUAGE) {
    const language = getLanguage();

    // Updating locale
    moment.locale(language);
    bus.broadcast({ language });
  }
});

export const subscription = bus.subscription.bind(bus);

export function get(name, params = {}) {
  const translation = translations[getLanguage()] || translations.default;
  const key = translation[name];

  if (typeof key === 'function') {
    return key(params);
  }

  return key || name;
}

export function getSystemCountryCode() {
  return Settings.storefrontCountryCode;
}

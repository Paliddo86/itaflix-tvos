/* global StoreInUserDefaults */

import url from 'url';
import { get as i18n } from '../localization';

export function set(data) {
  StoreInUserDefaults('topShelf', JSON.stringify(data));
}

export function mapSeries(item) {
  const title = i18n('tvshow-title', item);
  return {
    id: item.sid,
    title,
    imageURL: item.covers.big,
    displayURL: url.format({
      protocol: 'soap4atv:',
      query: {
        sid: item.sid,
        title,
        poster: item.covers.big,
      },
      pathname: '/tvshow',
    }),
    playURL: url.format({
      protocol: 'soap4atv:',
      query: {
        sid: item.sid,
        title,
        poster: item.covers.big,
        continueWatchingAndPlay: 1,
      },
      pathname: '/tvshow',
    }),
  };
}

export function mapBaseTile(item) {
  return {
    title: item.title,
    sid: item.id,
    poster: item.poster_image,
    quality: item.final_quality,
    type: item.type,
    isUpdated: item.show_next_episode_flag,
    slug: item.slug,
    tmdb_id: item.tmdb_id,
    imdb_id:item.imdb_id
  };
}

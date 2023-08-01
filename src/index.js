/* global sessionStorage, navigationDocument */

import * as TVDML from 'tvdml';

import * as user from './user';

import { get as i18n } from './localization';
import { checkSession, getUiData } from './request/adc';
import { getOpenURLParams } from './utils';

import myRoute from './routes/my';
import tvShows from './routes/tvshows';
import movies from './routes/movies';
import menuRoute from './routes/menu';
import userRoute from './routes/user';
import actorRoute from './routes/actor';
import seasonRoute from './routes/season';
import tvShowRoute from './routes/tvshow';
import searchRoute from './routes/search';
import genresRoute from './routes/genres';
import moviesGenresRoute from './routes/moviesGenres';
import settingsRoute from './routes/settings';
import speedTestRoute from './routes/speedtest';
import movieRoute from './routes/movie';
import homeRoute from './routes/home';
import tvShowsGenresRoute from './routes/tvShowsGenres';
import myRecomendations from './routes/recomendations';

import { AUTH, BASIC, GUEST } from './routes/menu/constants';

import Loader from './components/loader';

function openURLHandler(openURL) {
  const mainRoute = navigationDocument.documents.find(
    ({ route }) => route === 'main',
  );

  if (mainRoute) {
    navigationDocument.popToDocument(mainRoute);
  }

  TVDML.navigate(...getOpenURLParams(openURL));
}

TVDML.subscribe(TVDML.event.LAUNCH).pipe(params => {
  /**
   * TODO: Need to save initial params in a better way then
   * using `sessionStorage`. Maybe some in-memory storage.
   */
  sessionStorage.setItem('startParams', JSON.stringify(params));
  return TVDML.navigate('get-token');
});

TVDML.handleRoute('get-token')
  .pipe(TVDML.render(<Loader title={i18n('auth-checking')} />))
  .pipe(getUiData)
  .pipe(checkSession)
  .pipe(payload => {
    if(process.env.NODE_ENV === "development") console.log("Paylod User", payload); 
    user.set({ ...payload });
    return payload;
  })
  .pipe(() => {
    TVDML.redirect('main');
  });

TVDML.handleRoute('main').pipe(
  menuRoute([
    {
      route: 'home',
      active: AUTH,
      active: GUEST,
    },
    {
      route: 'search',
      active: AUTH,
      active: GUEST,
    },
    // {
    //   route: 'movies',
    //   active: GUEST,
    // },
    // {
    //   route: 'tvshows',
    //   active: GUEST,
    // },
    // {
    //   route: 'recomendations',
    //   hidden: [GUEST, BASIC],
    // },
    {
      route: 'moviesGenres',
    },
    {
      route: 'tvShowsGenres',
    },
    {
      route: 'my',
    },
    {
      route: 'settings',
    },
  ]),
);

TVDML.handleRoute('my').pipe(myRoute());

TVDML.handleRoute('tvshows').pipe(tvShows());

TVDML.handleRoute('movies').pipe(movies());

TVDML.handleRoute('search').pipe(searchRoute());

TVDML.handleRoute('settings').pipe(settingsRoute());

TVDML.handleRoute('tvshow').pipe(tvShowRoute());

TVDML.handleRoute('movie').pipe(movieRoute());

TVDML.handleRoute('season').pipe(seasonRoute());

TVDML.handleRoute('actor').pipe(actorRoute());

TVDML.handleRoute('speedtest').pipe(speedTestRoute());

TVDML.handleRoute('user').pipe(userRoute());

TVDML.handleRoute('moviesGenres').pipe(moviesGenresRoute());

TVDML.handleRoute('tvShowsGenres').pipe(tvShowsGenresRoute());

//TVDML.handleRoute('genres').pipe(genresRoute());

TVDML.handleRoute('home').pipe(homeRoute());

//TVDML.handleRoute('recomendations').pipe(myRecomendations());

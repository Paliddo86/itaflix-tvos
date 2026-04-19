/* global sessionStorage, navigationDocument */

import * as TVDML from 'tvdml';

import * as user from './user';

import { get as i18n } from './localization';

import menuRoute from './routes/menu';
import myRoute from './routes/my';
import seasonRoute from './routes/season';
import tvShowRoute from './routes/tvshow';
import searchRoute from './routes/search';
import moviesGenresRoute from './routes/moviesGenres';
import settingsRoute from './routes/settings';
import movieRoute from './routes/movie';
import tvShowsGenresRoute from './routes/tvShowsGenres';
import homeRoute from './routes/home';
import Loader from './components/loader';
import TMDB from './request/tmdb';

/**
 * Auto-login TMDB if credentials are saved
 */
async function attemptTmdbAutoLogin() {
  try {
    const tmdbUsername = user.getTmdbUsername();
    const savedPassword = user.getLoginData().password;
    
    // If we have saved credentials and session hasn't expired, try auto-login
    if (tmdbUsername && savedPassword) {
      if (user.isTmdbSessionExpired()) {
        // Session expired, attempt re-login
        console.log('TMDB session expired, attempting auto-login...');
        const requestToken = await TMDB.createRequestToken();
        const sessionData = await TMDB.createSessionWithCredentials(
          tmdbUsername,
          savedPassword,
          requestToken
        );
        const accountDetails = await TMDB.getAccountDetails(sessionData.session_id);
        
        user.setTmdbSession(
          sessionData.session_id,
          tmdbUsername,
          accountDetails.id
        );
        
        console.log('TMDB auto-login successful');
        return true;
      } else if (user.isTmdbAuthenticated()) {
        // Session still valid
        console.log('TMDB session still valid');
        return true;
      }
    }
  } catch (error) {
    console.error('TMDB auto-login failed:', error);
    // Clear the session on failed auto-login
    user.clearTmdbSession();
  }
  return false;
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
  .pipe(TVDML.render(<Loader title={i18n('start-application')} />))
  .pipe(payload => {
    if(process.env.NODE_ENV === "development") console.log("Paylod User", payload); 
    user.set({ logged: 0});
    return payload;
  })
  .pipe(() => {
    // Attempt TMDB auto-login
    return attemptTmdbAutoLogin();
  })
  .pipe(() => {
    TVDML.redirect('main');
  });

TVDML.handleRoute('main').pipe(
  menuRoute([
    {
      route: 'home',
    },
    {
      route: 'search',
    },
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

TVDML.handleRoute('search').pipe(searchRoute());

TVDML.handleRoute('settings').pipe(settingsRoute());

TVDML.handleRoute('tvshow').pipe(tvShowRoute());

TVDML.handleRoute('movie').pipe(movieRoute());

TVDML.handleRoute('season').pipe(seasonRoute());

TVDML.handleRoute('moviesGenres').pipe(moviesGenresRoute());

TVDML.handleRoute('tvShowsGenres').pipe(tvShowsGenresRoute());

TVDML.handleRoute('home').pipe(homeRoute());


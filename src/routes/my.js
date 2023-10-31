import moment from 'moment';
import * as TVDML from 'tvdml';

import * as user from '../user';
import { get as i18n } from '../localization';

import { checkSession, getMyListCollection } from '../request/adc';

import {
  link,
  groupSeriesByCategory,
  isMenuButtonPressNavigatedTo,
  sortTvShows,
  getStartParams,
} from '../utils';

import logo from '../assets/img/logo.png';

import { deepEqualShouldUpdate } from '../utils/components';

import Tile from '../components/tile';
import Loader from '../components/loader';

import commonStyles from '../common/styles';

export default function myRoute() {
  return TVDML.createPipeline().pipe(
    TVDML.render(
      TVDML.createComponent({
        getInitialState() {
          const token = user.getToken();
          const authorized = user.isAuthorized();

          return {
            token,
            authorized,
            updating: false,
            loading: !!authorized
          };
        },

        componentDidMount() {
          const setState = this.setState.bind(this);

          // eslint-disable-next-line no-underscore-dangle
          const currentDocument = this._rootNode.ownerDocument;

          this.menuButtonPressStream = TVDML.subscribe('menu-button-press');
          this.menuButtonPressStream
            .pipe(isMenuButtonPressNavigatedTo(currentDocument))
            .pipe(isNavigated => isNavigated && this.loadData().then(setState));

          this.userStateChangeStream = user.subscription();
          this.userStateChangeStream.pipe(() => {
            const token = user.getToken();

            if (token !== this.state.token) {
              this.setState({ updating: true, token });
            }
          });

          this.appResumeStream = TVDML.subscribe(TVDML.event.RESUME);
          this.appResumeStream.pipe(() => this.loadData().then(setState));

          this.loadData().then(payload => {
            this.setState({ loading: false, ...payload });
          });
        },

        componentWillReceiveProps() {
          this.setState({ updating: true });
        },

        componentDidUpdate(prevProps, prevState) {
          if (
            this.state.updating &&
            prevState.updating !== this.state.updating
          ) {
            this.loadData().then(payload => {
              this.setState({ updating: false, ...payload });
            });
          }
        },

        componentWillUnmount() {
          this.menuButtonPressStream.unsubscribe();
          this.userStateChangeStream.unsubscribe();
          this.appResumeStream.unsubscribe();
        },

        shouldComponentUpdate: deepEqualShouldUpdate,

        loadData() {
          if (!user.isAuthorized()) {
            return Promise.resolve({});
          }
          
          const listId = user.getListId();
          if (!listId) {
            return Promise.resolve({});
          }
          
          return checkSession().then(payload => {
            if(payload) user.set({ ...payload });
            return getMyListCollection(listId);
          })
        },

        render() {
          const { myMovies, myTvShows, loading } = this.state;
          if (loading) {
            return <Loader />;
          }
          
          const { BASEURL } = getStartParams();
          // if ( !myMovies || !myMovies.length) {
          //   return (
          //     <document>
          //       <head>{commonStyles}</head>
          //       <alertTemplate>
          //         <title class="grey_text">{i18n('my-empty-list-title')}</title>
          //         <description class="grey_description">
          //           {i18n('my-empty-list-description')}
          //         </description>
          //       </alertTemplate>
          //     </document>
          //   );
          // }

          //const { unwatched, watched, closed } = groupSeriesByCategory(series);

          return (
            <document>
              <stackTemplate>
              <banner>
                  <img
                    style="tv-align:left; tv-position:top-left"
                    src={BASEURL + logo}
                    width="200"
                    height="75"
                  />
                  <title style="tv-align:center; tv-position:top">
                    {i18n('my-caption')}
                  </title>
                </banner>
                <collectionList>
                  {myMovies && myMovies.length &&
                    this.renderSectionGrid(myMovies, 'my-movies')}
                  {myTvShows && myTvShows.length &&
                    this.renderSectionGrid(myTvShows, 'my-tv-show')}
                  {/* {closed.length && this.renderSectionGrid(closed, 'my-closed')} */}
                </collectionList>
              </stackTemplate>
            </document>
          );
        },

        renderSectionGrid(collection, title, schedule = []) {
          // const scheduleDictionary = schedule.reduce((result, item) => {
          //   // eslint-disable-next-line no-param-reassign
          //   result[item.sid] = item;
          //   return result;
          // }, {});

          // const currentMoment = moment();

          // const nextDay = currentMoment
          //   .clone()
          //   .add(moment.relativeTimeThreshold('h'), 'hour');

          // const nextMonth = currentMoment
          //   .clone()
          //   .add(moment.relativeTimeThreshold('d'), 'day');

          //const sortedCollection = sortTvShows(collection);

          return (
            <grid>
              {title && (
                <header>
                  <title>{i18n(title)}</title>
                </header>
              )}
              <section>
                {collection.map(element => {

                  // const isUHD = !!tvshow['4k'];
                  // const tvShowTitle = i18n('tvshow-title', tvshow);
                  // const scheduleEpisode = scheduleDictionary[sid];

                  // let isWatched = !unwatched;
                  // let dateTitle;
                  // let date;

                  // if (scheduleEpisode) {
                  //   date = moment(scheduleEpisode.date, 'DD.MM.YYYY');

                  //   if (!date.isValid() || nextMonth < date) {
                  //     dateTitle = i18n('new-episode-soon');
                  //   } else if (nextDay > date) {
                  //     dateTitle = i18n('new-episode-day');
                  //   } else {
                  //     dateTitle = i18n('new-episode-custom-date', {
                  //       date: date.fromNow(),
                  //     });
                  //   }
                  //   if (currentMoment < date) isWatched = false;
                  // }

                  return (
                    <Tile
                      key={element.sid}
                      title={element.title}
                      quality={element.quality}
                      isUpdated={element.isUpdated}
                      route={element.type}
                      poster={element.poster}
                      payload={element}
                    />
                  );
                })}
              </section>
            </grid>
          );
        },
      }),
    ),
  );
}

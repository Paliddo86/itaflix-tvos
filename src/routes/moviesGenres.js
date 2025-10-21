import * as TVDML from 'tvdml';

import * as user from '../user';

import { get as i18n } from '../localization';

import * as settings from '../settings';

import {
  capitalizeText,
  isMenuButtonPressNavigatedTo,
  getStartParams,
} from '../utils';

import { deepEqualShouldUpdate } from '../utils/components';

import Tile from '../components/tile';
import Loader from '../components/loader';

import logo from '../assets/img/logo.png';
import { Genre, Service } from '../helpers/models';
import {getGenreMovies, MAX_SEARCH_RESULTS} from '../request/sc';
import { defaultErrorHandlers } from '../helpers/auth/handlers';

export default function moviesGenresRoute() {
  return TVDML.createPipeline().pipe(
    TVDML.render(
      TVDML.createComponent({
        getInitialState() {
          const token = user.getToken();

          return {
            token,
            genres: [],
            active: null,
            loading: true,
            updated_genres: [],
            updating: false,
          };
        },

        componentDidMount() {
          // eslint-disable-next-line no-underscore-dangle
          const currentDocument = this._rootNode.ownerDocument;

          this.menuButtonPressStream = TVDML.subscribe('menu-button-press');
          this.menuButtonPressStream
            .pipe(isMenuButtonPressNavigatedTo(currentDocument))
            .pipe(isNavigated => {
              if (isNavigated) {
                this.setState({ updated_genres: [] });
                this.onGenreSelect(this.state.active);
              }
            });

          this.userStateChangeStream = user.subscription();
          this.userStateChangeStream.pipe(() => {
            const token = user.getToken();

            if (token !== this.state.token) {
              this.setState({ updating: true, token });
            }
          });

          this.loadData().then(payload => {
            this.setState({ loading: false, ...payload, active: 0 });
          });
        },

        componentWillReceiveProps() {
          this.setState({ updating: true });
        },

        componentDidUpdate(prevProps, prevState) {
        },

        componentWillUnmount() {
          this.menuButtonPressStream.unsubscribe();
          this.userStateChangeStream.unsubscribe();
        },

        shouldComponentUpdate: deepEqualShouldUpdate,

        loadData() {
          let genres = [];
          let result = {};

          /** @type {Genre[]} */
          const allgenres = settings.getAllMovieGenres();
          const services = settings.getService();

          services.forEach((service, index) => {
            genres.push(service);
            result[index] = {}
          })
          Object.values(allgenres).sort((a, b) => {
            return a.name > b.name;
          }).forEach((value) => {
            let newIndex = genres.push(value) -1;
            result[newIndex] = {};
          })
          return Promise.resolve({genres, ...result});
        },

        render() {
          const { genres, loading } = this.state;
          if (loading) {
            return <Loader />;
          }
          const { BASEURL } = getStartParams();

          return (
            <document>
              <head>
                <style
                  content={`
                    @media tv-template and (tv-theme:dark) {
                      .tile-title {
                        color: rgb(152, 151, 152);
                      }
                    }
                  `}
                />
              </head>
              <catalogTemplate>
                <banner>
                  <img
                    style="tv-align:left; tv-position:top-left"
                    src={BASEURL + logo}
                    width="200"
                    height="75"
                  />
                  <title style="tv-align:center; tv-position:top">
                    {i18n('movie-caption')}
                  </title>
                </banner>
                <list>
                  <section>
                    {genres.map((genre, index) => {
                      const id = index;
                      const {movies} = this.state[id];

                      return (
                        <listItemLockup
                          key={id}
                          // eslint-disable-next-line react/jsx-no-bind
                          onHighlight={this.onGenreSelect.bind(this, id)}
                        >
                          <title>{capitalizeText(genre.name)}</title>
                          <decorationLabel>
                            {movies ? movies.length : "..."}
                          </decorationLabel>
                          <relatedContent>
                            { movies ? (
                              <grid>
                                <section>
                                  {movies.map((movie, index) => {
                                    return (
                                      <Tile
                                        {...movie}
                                        autoHighlight={false}
                                        onHighlight={this.onHighlightTile.bind(this, index)}
                                      />
                                    );
                                  })}
                                </section>
                              </grid>
                            ): <activityIndicator />}
                          </relatedContent>
                        </listItemLockup>
                      );
                    })}
                  </section>
                </list>
              </catalogTemplate>
            </document>
          );
        },

        onGenreSelect(id) {
          const { genres } = this.state;
          let activeSection = this.state[id];
          this.setState({ active: id });

          /** @type {Genre | Service} */
          let genre = genres[id];

          if(!activeSection.movies || !activeSection.movies.length) {
            let service = (genre instanceof Service)? genre.id : undefined;
            let genreSlug = (genre instanceof Genre)? genre.id : undefined;
            getGenreMovies(0, service, genreSlug).then((result) => {
                this.setState({
                  [id]: result,
                });
  
            }).catch((error) => {
              defaultErrorHandlers(error);
            });
          }
        },

        onHighlightTile(index) {
          const { genres, active } = this.state;

          /** @type {Genre | Service} */
          let genre = genres[active];
          let activeSection = this.state[active];

          if (activeSection.movies.length % MAX_SEARCH_RESULTS !== 0) return;
          
          if (index >= (activeSection.movies.length - 5)) {
            let service = (genre instanceof Service)? genre.id : undefined;
            let genreSlug = (genre instanceof Genre)? genre.id : undefined;
            let offset = Math.floor(activeSection.movies.length / MAX_SEARCH_RESULTS) * MAX_SEARCH_RESULTS;
            getGenreMovies(offset, service, genreSlug).then((result) => {
                this.setState({
                  [active]: {movies: activeSection.movies.concat(result.movies)},
                });
            });

          }
        },
      }),
    ),
  );
}

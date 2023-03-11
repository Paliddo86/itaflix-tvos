import * as TVDML from 'tvdml';

import * as user from '../user';

import { get as i18n } from '../localization';

import { getTVShowsByGenre } from '../request/adc';
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

export default function tvShowsGenresRoute() {
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
            this.setState({ loading: false, ...payload });
          });
        },

        componentWillReceiveProps() {
          this.setState({ updating: true });
        },

        componentDidUpdate(prevProps, prevState) {
          // if (
          //   this.state.updating &&
          //   prevState.updating !== this.state.updating
          // ) {
          //   console.log("updated")
          //   this.loadData().then(payload => {
          //     this.setState({ updating: false, ...payload });
          //   });
          // }
        },

        componentWillUnmount() {
          this.menuButtonPressStream.unsubscribe();
          this.userStateChangeStream.unsubscribe();
        },

        shouldComponentUpdate: deepEqualShouldUpdate,

        loadData() {
          let genres = [];
          let result = {};
          let allTvShows = i18n("menu-tvshows");
          genres.push({name: allTvShows, slug: "serie-tv"});
          result[0] = {};
          const allgenres = settings.getAllTvShowGenres();

          Object.values(allgenres).sort((a, b) => {
            return a.name > b.name;
          }).forEach((value, index) => {
            genres.push(value);
            result[index + 1] = {};
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
                    {i18n('menu-tvshows')}
                  </title>
                </banner>
                <list>
                  <section>
                    {genres.map((genre, index) => {
                      const id = index;
                      const {tvshows, total} = this.state[id];

                      return (
                        <listItemLockup
                          key={id}
                          // eslint-disable-next-line react/jsx-no-bind
                          onHighlight={this.onGenreSelect.bind(this, id)}
                        >
                          <title>{capitalizeText(genre.name)}</title>
                          <decorationLabel>
                            {total ? total : '…'}
                          </decorationLabel>
                          <relatedContent>
                            {tvshows == null ? (
                              <activityIndicator />
                            ) : (
                              <grid>
                                <section>
                                  {tvshows.map((tvshow, index) => {
                                    const {
                                      title,
                                      quality,
                                      isUpdated,
                                      poster,
                                    } = tvshow;

                                    return (
                                      <Tile
                                        title={title}
                                        route="tvshow"
                                        poster={poster}
                                        quality={quality}
                                        isUpdated={isUpdated}
                                        payload={tvshow}
                                        autoHighlight={false}
                                        onHighlight={this.onHighlightTile.bind(this, index)}
                                      />
                                    );
                                  })}
                                </section>
                              </grid>
                            )}
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

          this.setState({ active: id });

          //if (~updated_genres.indexOf(id)) return;
          let activeSection = this.state[id];
          let genre = genres[id];

          if(!activeSection.tvshows || !activeSection.tvshows.length) {
            getTVShowsByGenre(genre.slug).then((result) => {
                this.setState({
                  [id]: result,
                  //updated_genres: updated_genres.concat(id),
                })
  
            });
          }
        },

        onHighlightTile(index) {
          const { genres, active } = this.state;


          //if (~updated_genres.indexOf(id)) return;

          let genre = genres[active];
          let activeSection = this.state[active];
          
          if (index >= (activeSection.tvshows.length - 4) && activeSection.current_page < activeSection.last_page) {
            let page = activeSection.current_page + 1;
            if(page === activeSection.current_page) return;
            
            getTVShowsByGenre(genre.slug, ++activeSection.current_page).then((result) => {
                this.setState({
                  [active]: Object.assign({}, result, {tvshows: [...activeSection.tvshows, ...result.tvshows]})
                });
            });

          }
        },
      }),
    ),
  );
}

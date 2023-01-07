import * as TVDML from 'tvdml';

import { get as i18n } from '../localization';

import {
  getSearchResults,
  getAllUpdates,
} from '../request/adc';

import Tile from '../components/tile';
import styles from '../common/styles';

const THROTTLE_TIMEOUT = 500;

export default function searchRoute() {
  return TVDML.createPipeline().pipe(
    TVDML.render(
      TVDML.createComponent({
        getInitialState() {
          return {
            value: '',
            loading: false,
            updating: false,
            searchResults: {tvshowFounded: [], moviesFounded: []},
            seriesUpdate: [],
            moviesUpdate: [],
          };
        },

        render() {
          return (
            <document>
              <head> {styles} </head>
              <searchTemplate>
                <searchField
                  ref={node => (this.searchField = node)}
                  showSpinner={this.state.loading ? 'true' : undefined}
                />
                <collectionList>
                  {this.renderMoviesUpdate()}
                  {this.renderSeriesUpdate()}
                  {this.renderSearchMovies()}
                  {this.renderSearchTvShow()}
                </collectionList>
              </searchTemplate>
            </document>
          );
        },

        renderMoviesUpdate() {
          if (!this.state.moviesUpdate.values.length || this.state.value) return null;
          return (
            <shelf>
              <header>
                <title>{this.state.moviesUpdate.name}</title>
              </header>
              <section>
                {this.state.moviesUpdate.values.map(movie => {
                  const {
                    title,
                    poster,
                    quality,
                    isUpdated,
                  } = movie;

                  return (
                    <Tile
                      title={title}
                      route="movie"
                      poster={poster}
                      quality={quality}
                      isUpdated={isUpdated}
                      payload={movie}
                    />
                  );
                })}
              </section>
            </shelf>
          );
        },

        renderSeriesUpdate() {
          if (!this.state.seriesUpdate.values.length || this.state.value) return null;
          return (
            <shelf>
              <header>
                <title>{this.state.seriesUpdate.name}</title>
              </header>
              <section>
                {this.state.seriesUpdate.values.map(tvshow => {
                  const {
                    title,
                    poster,
                    quality,
                    isUpdated,
                    sid
                  } = tvshow;

                  return (
                    <Tile
                      key={sid}
                      title={title}
                      route="tvshow"
                      poster={poster}
                      quality={quality}
                      isUpdated={isUpdated}
                      payload={tvshow}
                    />
                  );
                })}
              </section>
            </shelf>
          );
        },

        renderSearchTvShow() {
          if (!this.state.searchResults.tvshowFounded.length ) return null;

          return (
            <shelf class="shelf_indent">
              <header>
                <title>{i18n('search-result-tvshow')}</title>
              </header>
              <section>
              {this.state.searchResults.tvshowFounded.map(result => {
                  const {
                    title,
                    poster,
                    quality,
                    isUpdated,
                  } = result;

                  return (
                    <Tile
                      title={title}
                      route="tvshow"
                      poster={poster}
                      quality={quality}
                      isUpdated={isUpdated}
                      payload={result}
                    />
                  );
                })}
              </section>
            </shelf>
          );
        },

        renderSearchMovies() {
          if (!this.state.searchResults.moviesFounded.length ) return null;

          return (
            <shelf class="shelf_indent">
              <header>
                <title>{i18n('search-result-movie')}</title>
              </header>
              <section>
              {this.state.searchResults.moviesFounded.map(result => {
                  const {
                    title,
                    poster,
                    quality,
                    isUpdated,
                  } = result;

                  return (
                    <Tile
                      title={title}
                      route="movie"
                      poster={poster}
                      quality={quality}
                      isUpdated={isUpdated}
                      payload={result}
                    />
                  );
                })}
              </section>
            </shelf>
          );
        },

        componentDidMount() {
          const keyboard = this.searchField.getFeature('Keyboard');

          keyboard.onTextChange = () => this.search(keyboard.text);

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

        loadData() {
          return getAllUpdates();
        },

        search(query) {
          this.setState({ value: query });
          if (this.throttle) clearTimeout(this.throttle);
          this.throttle = setTimeout(() => {
            this.loadResults(query);
          }, THROTTLE_TIMEOUT);
        },

        loadResults(query) {
          this.setState({ loading: true });
          if(!query) {
            let searchResults = {tvshowFounded: [], moviesFounded: []};
            this.setState({ loading: false, updating: true, searchResults })
            return Promise.resolve({searchResults})
          }
          return getSearchResults(query)
            .catch(() => ({}))
            .then(result => this.setState({ loading: false, ...result }));
        },
      }),
    ),
  );
}

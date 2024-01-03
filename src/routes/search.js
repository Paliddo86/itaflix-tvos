import * as TVDML from 'tvdml';

import { get as i18n } from '../localization';

import {
  getSearchResults
} from '../request/adc';

import Tile from '../components/tile';
import styles from '../common/styles';

const THROTTLE_TIMEOUT = 1000;

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
                  {this.renderSearchMovies()}
                  {this.renderSearchTvShow()}
                </collectionList>
              </searchTemplate>
            </document>
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

          keyboard.onTextChange = () => {
            this.search(keyboard.text);
          }
        },

        componentWillReceiveProps() {
          this.setState({ updating: true });
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

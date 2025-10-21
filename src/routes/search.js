import * as TVDML from 'tvdml';

import { get as i18n } from '../localization';

import Tile from '../components/tile';
import styles from '../common/styles';
import { searchMovieAndTvShow } from '../request/sc';
import { defaultErrorHandlers } from '../helpers/auth/handlers';

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
                  return (
                    <Tile {...result}/>
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
                  return (
                    <Tile {...result}/>
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
          return searchMovieAndTvShow(query)
          .then(result => this.setState({ loading: false, ...result }))
          .catch((error) => {
            defaultErrorHandlers(error);
          });
        },
      }),
    ),
  );
}

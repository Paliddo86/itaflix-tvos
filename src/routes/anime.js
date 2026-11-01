import * as TVDML from 'tvdml';

import Tile from '../components/tile';
import styles from '../common/styles';

import { getStartParams } from '../utils';
import logo from '../assets/img/logo.png';
import { getHome } from '../request/animeunity';
import { defaultErrorHandlers } from '../helpers/auth/handlers';
import Loader from '../components/loader';
import { get as i18n } from '../localization';

// Chiave i18n per categoria, indicizzata dal `key` della Category.
const CATEGORY_LABEL = {
  'latest-episodes': 'anime-latest-episodes',
  'latest-additions': 'anime-latest-additions',
  featured: 'anime-featured',
};

export default function animeRoute() {
  return TVDML.createPipeline().pipe(
    TVDML.render(
      TVDML.createComponent({
        getInitialState() {
          return {
            loading: true,
            updating: false,
            categories: [],
          };
        },

        render() {
          const { BASEURL } = getStartParams();

          if (this.state.loading || this.state.updating) {
            return <Loader title={i18n('loading')} />;
          }

          return (
            <document>
              <head> {styles} </head>
              <stackTemplate>
                <banner id="header-banner">
                  <img
                    style="tv-align:left;tv-position:top-left"
                    src={BASEURL + logo}
                    width="200"
                    height="75"
                  />
                </banner>
                <collectionList id="collection" autoHighlight="true">
                  {this.state.categories.map((category, idx) =>
                    this.renderCategory(category, idx),
                  )}
                </collectionList>
              </stackTemplate>
            </document>
          );
        },

        renderCategory(category, idx) {
          if (!category || !category.values || !category.values.length) return null;

          const title = CATEGORY_LABEL[category.key]
            ? i18n(CATEGORY_LABEL[category.key])
            : category.name;

          return (
            <shelf key={idx}>
              <header>
                <title>{title}</title>
              </header>
              <section>
                {category.values.map(item => (
                  <Tile {...item} />
                ))}
              </section>
            </shelf>
          );
        },

        componentDidMount() {
          this.loadData();
        },

        componentWillReceiveProps() {
          this.setState({ updating: true });
        },

        componentDidUpdate(prevProps, prevState) {
          if (this.state.updating && prevState.updating !== this.state.updating) {
            this.loadData(true);
          }
        },

        loadData(updating) {
          this.setState(updating ? { updating: true } : { loading: true });

          return getHome()
            .then(({ categories }) => {
              const list = categories || [];

              if (!list.length) {
                console.warn('Anime: nessuna categoria parsata dalla home');
              }

              this.setState({
                loading: false,
                updating: false,
                categories: list,
              });
            })
            .catch(error => {
              console.error('Anime: getHome fallita', error);
              this.setState({ loading: false, updating: false, categories: [] });
              defaultErrorHandlers(error);
            });
        },
      }),
    ),
  );
}

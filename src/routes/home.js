import * as TVDML from 'tvdml';

import Tile from '../components/tile';
import styles from '../common/styles';

import { getStartParams } from '../utils';
import logo from '../assets/img/logo.png';
import { getHome } from '../request/sc';
import { defaultErrorHandlers } from '../helpers/auth/handlers';
import Loader from '../components/loader';
import { get as i18n } from '../localization';

export default function homeRoute() {
  return TVDML.createPipeline().pipe(
    TVDML.render(
      TVDML.createComponent({
        getInitialState() {
          return {
            value: '',
            loading: true,
            updating: false,
            seriesUpdate: [],
            moviesUpdate: [],
          };
        },

        render() {
          const { BASEURL } = getStartParams();
            if (this.state.loading || this.state.updating) {
              return (
                <Loader title={i18n('loading')} />
              );
            }

          return (
            <document>
              <head> {styles} </head>
              <stackTemplate>
                <banner>
                  <img
                    style="tv-align:left;tv-position:top-left"
                    src={BASEURL + logo}
                    width="200"
                    height="75"
                  />
                </banner>
                <collectionList>
                  {this.renderMoviesUpdate()}
                  {this.renderSeriesUpdate()}
                </collectionList>
              </stackTemplate>
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

        componentDidMount() {
          this.loadData();
        },

        componentWillReceiveProps() {
          this.setState({ updating: true });
        },

        componentDidUpdate(prevProps, prevState) {
          if (
            this.state.updating &&
            prevState.updating !== this.state.updating
          ) {
            this.loadData(true);
          }
        },

        loadData(updating) {
          let state = updating ? {updating: true} : {loading: true}
          this.setState(state);
          return getHome().then(categories => {
            state = updating ? {updating: false, ...categories} : {loading: false, ...categories}
            this.setState(state);
          }).catch(error => {
            defaultErrorHandlers(error);
          })
        }
      }),
    ),
  );
}

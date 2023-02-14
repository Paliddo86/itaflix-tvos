import * as TVDML from 'tvdml';

import { get as i18n } from '../localization';

import {
  getAllUpdates,
} from '../request/adc';

import Tile from '../components/tile';
import styles from '../common/styles';

export default function homeRoute() {
  return TVDML.createPipeline().pipe(
    TVDML.render(
      TVDML.createComponent({
        getInitialState() {
          return {
            value: '',
            loading: false,
            updating: false,
            seriesUpdate: [],
            moviesUpdate: [],
          };
        },

        render() {
          return (
            <document>
              <head> {styles} </head>
              <stackTemplate>
                <banner>
                  <title>{i18n('home-caption')}</title>
                  <description>{i18n('home-desc')}</description>
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
        }
      }),
    ),
  );
}

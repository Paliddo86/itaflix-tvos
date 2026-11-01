import * as TVDML from 'tvdml';

import Tile from '../components/tile';
import styles from '../common/styles';

import { getAllEpisodes, getAnime } from '../request/animeunity';
import { defaultErrorHandlers } from '../helpers/auth/handlers';
import Loader from '../components/loader';
import { get as i18n } from '../localization';

// Soglia oltre la quale la lista episodi viene divisa in "stagioni" virtuali,
// come fa la controparte Kotlin (AnimeUnityProvider.kt:1160).
const EPISODES_PER_SEASON = 120;

/**
 * Divide gli episodi in blocchi da EPISODES_PER_SEASON.
 * Restituisce [] se non serve spezzare: in quel caso il dettaglio
 * mostra la lista episodi direttamente.
 */
function buildSeasons(episodes) {
  if (!episodes || episodes.length <= EPISODES_PER_SEASON) return [];

  const seasons = [];

  for (let start = 0; start < episodes.length; start += EPISODES_PER_SEASON) {
    const chunk = episodes.slice(start, start + EPISODES_PER_SEASON);
    const from = chunk[0].number;
    const to = chunk[chunk.length - 1].number;

    seasons.push({
      type: 'animeSeason',
      number: seasons.length + 1,
      title: `Episodi ${from}-${to}`,
      episodes: chunk,
      episodes_count: chunk.length,
      poster: '',
    });
  }

  return seasons;
}

export default function animeSeriesRoute() {
  return TVDML.createPipeline()
    .pipe(
      TVDML.passthrough(({ navigation }) => ({
        id: (navigation && (navigation.id || navigation.sid)) || '',
        title: navigation && navigation.title,
        poster: navigation && navigation.poster,
        episodes: navigation && navigation.episodes,
        seasonTitle: navigation && navigation.seasonTitle,
      })),
    )
    .pipe(
      TVDML.render(
        TVDML.createComponent({
          getInitialState() {
            const episodes = this.props.episodes || [];

            return {
              loading: episodes.length === 0,
              highlightEpisode: 0,
              show: null,
              episodes,
            };
          },

          render() {
            if (this.state.loading) {
              return <Loader title={this.props.title || i18n('loading')} />;
            }

            return this.renderDetail();
          },

          /* ---------------------------------------------------------- */
          /* Dettaglio: replica di tvshow.js (productTemplate)          */
          /* ---------------------------------------------------------- */

          renderDetail() {
            const { show } = this.state;

            if (!show) {
              return (
                <document>
                  <head>{styles}</head>
                  <alertTemplate>
                    <title>{i18n('generic-error')}</title>
                    <button onSelect={TVDML.navigateBack}>
                      <text>{i18n('go-back')}</text>
                    </button>
                  </alertTemplate>
                </document>
              );
            }

            return (
              <document>
                <head>{styles}</head>
                <productTemplate>
                  <banner style="background-color: rgba(0, 0, 0, 0.5);">
                    {this.renderInfo(show)}
                    <heroImg src={show.poster} />
                  </banner>
                  {this.renderSeasons(show)}
                </productTemplate>
              </document>
            );
          },

          renderInfo(show) {
            return (
              <stack>
                <title>{show.title}</title>
                {show.rating && (
                  <row>
                    <ratingBadge value={String(show.rating / 10)} />
                  </row>
                )}
                <description>{show.overview || i18n('no-description')}</description>
              </stack>
            );
          },

          renderSeasons(show) {
            const seasons = buildSeasons(this.state.episodes);

            if (!seasons.length) {
              // Pochi episodi: si entra direttamente nella lista episodi
              return (
                <shelf>
                  <header>
                    <title>
                      {i18n('anime-episodes-count', { count: this.state.episodes.length })}
                    </title>
                  </header>
                  <section>
                    <Tile
                      type="animeSeason"
                      title={i18n('anime-episodes')}
                      poster={show.poster}
                      counter={this.state.episodes.length}
                      episodes={this.state.episodes}
                      seasonTitle={i18n('anime-episodes')}
                      animeTitle={show.title}
                      animePoster={show.poster}
                      animeId={show.id}
                    />
                  </section>
                </shelf>
              );
            }

            return (
              <shelf>
                <header>
                  <title>{i18n('anime-seasons')} - {seasons.length}</title>
                </header>
                <section>
                  {seasons.map(season => (
                    <Tile
                      key={`${show.id}-${season.number}`}
                      type="animeSeason"
                      title={season.title}
                      poster={show.poster}
                      counter={season.episodes_count}
                      episodes={season.episodes}
                      seasonTitle={season.title}
                      animeTitle={show.title}
                      animePoster={show.poster}
                      animeId={show.id}
                    />
                  ))}
                </section>
              </shelf>
            );
          },

          /* ---------------------------------------------------------- */
          /* Dati                                                       */
          /* ---------------------------------------------------------- */

          componentDidMount() {
            this.loadData();
          },

          loadData() {
            const { id } = this.props;

            // Si arriva dalla stagione virtuale: gli episodi sono gia' in props.
            if (this.state.episodes.length) return Promise.resolve();

            if (!id) {
              this.setState({ loading: false, show: null });
              return Promise.resolve();
            }

            return getAnime(id)
              .then(show =>
                getAllEpisodes(id, show.episodesCount).then(({ episodes, embedUrl }) => {
                  this.setState({
                    loading: false,
                    show,
                    episodes,
                    embedUrl,
                  });
                }),
              )
              .catch(error => {
                console.error('Anime: caricamento serie fallito', error);
                this.setState({ loading: false, show: null });
                defaultErrorHandlers(error);
              });
          },

        }),
      ),
    );
}

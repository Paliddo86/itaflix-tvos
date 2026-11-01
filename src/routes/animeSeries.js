import * as TVDML from 'tvdml';

import Tile from '../components/tile';
import styles from '../common/styles';

import { buildAnimeSeasons } from '../helpers/models';
import { getAllEpisodes, getAnime } from '../request/animeunity';
import { defaultErrorHandlers } from '../helpers/auth/handlers';
import Loader from '../components/loader';
import { get as i18n } from '../localization';

// Soglia oltre la quale la lista episodi viene divisa in "stagioni" virtuali,
// come fa la controparte Kotlin (AnimeUnityProvider.kt:1160).
const EPISODES_PER_SEASON = 120;

export default function animeSeriesRoute() {
  return TVDML.createPipeline()
    .pipe(
      TVDML.passthrough(({ navigation }) => ({
        id: (navigation && (navigation.id || navigation.sid)) || '',
        title: navigation && navigation.title,
        poster: navigation && navigation.poster,
        banner: navigation && navigation.banner,
      })),
    )
    .pipe(
      TVDML.render(
        TVDML.createComponent({
          getInitialState() {
            return {
              loading: true,
              highlightEpisode: 0,
              anime: null,
              seasons: [],
            };
          },

          render() {
            if (this.state.loading) {
              return <Loader title={this.props.title || i18n('loading')} />;
            }

            const { anime } = this.state;

            if (!anime) {
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
                  {anime.banner && (
                    <background>
                      <img src={anime.banner} scaleToFill="true" />
                    </background>
                  )}
                  <banner style="background-color: rgba(0, 0, 0, 0.5);">
                    {this.renderStatus(anime)}
                    {this.renderInfo(anime)}
                    {!anime.banner && <heroImg src={anime.poster} />}
                  </banner>
                  {this.renderSeasons(anime)}
                </productTemplate>
              </document>
            );
          },

          renderStatus(anime) {
            if (!anime.genres || !anime.genres.length) return null;

            return (
              <infoList>
                <info>
                  <header>
                    <title>{i18n('tvshow-genres')}</title>
                  </header>
                  <description>{anime.genres.map(g => g.name).join(', ')}</description>
                </info>
              </infoList>
            );
          },

          renderInfo(anime) {
            return (
              <stack>
                <title>{anime.title}</title>
                {anime.rating && (
                  <row>
                    <ratingBadge value={String(anime.rating / 10)} />
                  </row>
                )}
                {anime.released && (
                  <row>
                    <text>{anime.released}</text>
                  </row>
                )}
                <description>{anime.overview || i18n('no-description')}</description>
              </stack>
            );
          },

          renderSeasons(anime) {
            const { seasons } = this.state;

            if (!seasons || !seasons.length) {
              return (
                <shelf>
                  <header>
                    <title>{i18n('anime-no-episodes')}</title>
                  </header>
                </shelf>
              );
            }

            return (
              <shelf>
                <header>
                  <title>
                    {seasons.length > 1
                      ? `${i18n('anime-seasons')} - ${seasons.length}`
                      : i18n('anime-episodes-count', { count: anime.episodes_count })}
                  </title>
                </header>
                <section>
                  {seasons.map(season => (
                    <Tile
                      key={season.id}
                      type={season.type}
                      title={season.title || i18n('anime-episodes')}
                      poster={season.poster || anime.poster}
                      counter={season.episodes_count}
                      episodes={season.episodes}
                      seasonTitle={season.title}
                      animeTitle={anime.title}
                      animePoster={anime.poster}
                      animeBanner={anime.banner}
                      animeId={anime.id}
                    />
                  ))}
                </section>
              </shelf>
            );
          },

          componentDidMount() {
            this.loadData();
          },

          loadData() {
            const { id } = this.props;

            if (!id) {
              this.setState({ loading: false, anime: null });
              return Promise.resolve();
            }

            return getAnime(id)
              .then(anime =>
                getAllEpisodes(id, anime.episodesCount).then(({ episodes }) => {
                  const seasons = buildAnimeSeasons(
                    episodes,
                    {
                      animeId: anime.id,
                      animeTitle: anime.title,
                      animeBanner: anime.banner,
                      poster: anime.poster,
                    },
                    EPISODES_PER_SEASON,
                  );

                  this.setState({
                    loading: false,
                    anime,
                    seasons,
                  });
                }),
              )
              .catch(error => {
                console.error('Anime: caricamento serie fallito', error);
                this.setState({ loading: false, anime: null });
                defaultErrorHandlers(error);
              });
          },
        }),
      ),
    );
}

import * as TVDML from 'tvdml';
import moment from 'moment';

import Tile from '../components/tile';

import { buildAnimeSeasons } from '../helpers/models';
import { getAllEpisodes, getAnime } from '../request/animeunity';
import { defaultErrorHandlers } from '../helpers/auth/handlers';
import Loader from '../components/loader';
import { get as i18n } from '../localization';

// Soglia oltre la quale la lista episodi viene divisa in blocchi,
// come fa la controparte Kotlin (AnimeUnityProvider.kt:1160).
const EPISODES_PER_SEASON = 120;

/**
 * Dettaglio serie anime.
 * Struttura copiata da src/routes/tvshow.js: productTemplate, background
 * condizionale, banner con renderStatus/renderInfo, heroImg solo quando
 * manca il banner, shelf delle stagioni.
 */
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
              anime: null,
              seasons: [],
            };
          },

          render() {
            if (this.state.loading) {
              return (
                <Loader title={this.props.title} heroImg={this.props.poster} />
              );
            }

            const { anime } = this.state;

            if (!anime) {
              return (
                <document>
                  <alertTemplate>
                    <title>{i18n('generic-error')}</title>
                    <button onSelect={TVDML.navigateBack}>
                      <text>{i18n('generic-error-close')}</text>
                    </button>
                  </alertTemplate>
                </document>
              );
            }

            return (
              <document>
                <productTemplate>
                  {anime.banner && (
                    <background>
                      <img
                        src={anime.banner}
                        scaleToFill="true"
                      />
                    </background>
                  )}
                  <banner style="background-color: rgba(0, 0, 0, 0.5);">
                    {this.renderStatus()}
                    {this.renderInfo()}
                    {!anime.banner && <heroImg src={anime.poster} />}
                  </banner>
                  {this.renderSeasons()}
                </productTemplate>
              </document>
            );
          },

          renderStatus() {
            const { anime } = this.state;
            const { genres } = anime;

            return (
              <infoList>
                <info>
                  <header>
                    <title>{i18n('tvshow-status')}</title>
                  </header>
                  <text>{i18n('status-ongoing') || 'N/A'}</text>
                </info>
                <info>
                  <header>
                    <title>{i18n('tvshow-genres')}</title>
                  </header>
                  {(genres || []).map(genre => (
                    <text key={genre.id}>{genre.name}</text>
                  ))}
                </info>
              </infoList>
            );
          },

          renderInfo() {
            const { anime } = this.state;
            const { title, released, rating, overview: description, runtime } = anime;

            return (
              <stack>
                <title>{title}</title>
                <row>
                  <ratingBadge value={rating / 10} />
                  <text>{`${i18n('tvshow-information-year').toUpperCase()}: ${released}`}</text>
                  {runtime ? (
                    <text>
                      {`${i18n('tvshow-information-runtime').toUpperCase()}: ${moment.duration(runtime, 'minutes').humanize()}`}
                    </text>
                  ) : null}
                </row>
                <description
                  allowsZooming="true"
                  handlesOverflow="true"
                  onSelect={this.onShowFullDescription}
                  style={`
                    tv-text-max-lines: 1;
                  `}
                >
                  {description}
                </description>
              </stack>
            );
          },

          renderSeasons() {
            const { anime, seasons } = this.state;

            if (!seasons.length) return null;

            return (
              <shelf>
                <header>
                  <title>{i18n('tvshow-seasons')} - {seasons.length}</title>
                </header>
                <section>
                  {seasons.map(season => (
                    <Tile
                      type={season.type}
                      season={season}
                      title={season.title || i18n('anime-season-title')}
                      poster={season.poster || anime.poster}
                      counter={season.range || season.episodes_count}
                      isWatched={false}
                      isUpdated={season.isUpdated}
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

          onShowFullDescription() {
            // Replica di tvshow.js: la descrizione si espande nativamente.
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

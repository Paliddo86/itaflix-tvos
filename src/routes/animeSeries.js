import * as TVDML from 'tvdml';
import moment from 'moment';

import Tile from '../components/tile';

import { buildAnimeSeasons } from '../helpers/models';
import { getAllEpisodes, getAnime } from '../request/animeunity';
import { defaultErrorHandlers } from '../helpers/auth/handlers';
import Loader from '../components/loader';
import { get as i18n } from '../localization';
import * as user from '../user';
import * as settings from '../settings';

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
        // Fallback: il tile della sezione anime porta gia' lo status.
        status: navigation && navigation.status,
      })),
    )
    .pipe(
      TVDML.render(
        TVDML.createComponent({
          getInitialState() {
            return {
              loading: true,
              isPreferred: false,
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
            const { genres, status } = anime;

            return (
              <infoList>
                <info>
                  <header>
                    <title>{i18n('tvshow-status')}</title>
                  </header>
                  <text key={status}>
                    {status ? i18n(`status-${status.toLowerCase()}`) || status : 'N/A'}
                  </text>
                </info>
                <info>
                  <header>
                    <title>{i18n('tvshow-genres')}</title>
                  </header>
                  {(genres || []).map(genre => {
                    const genreName = settings.getTvShowGenresById(genre.id);
                    return <text key={genre.id}>{genreName || genre.name}</text>;
                  })}
                </info>
              </infoList>
            );
          },

          renderInfo() {
            const { anime, isPreferred } = this.state;
            const {
              title, released, rating, overview: description, runtime,
            } = anime;

            const addToMyBtn = (
              <buttonLockup onSelect={this.onMy}>
                <badge src="resource://button-rate" />
                <title>{i18n('add-to-my')}</title>
              </buttonLockup>
            );

            const isOnMyBtn = (
              <buttonLockup onSelect={this.removeFromMy}>
                <badge src="resource://button-rated" />
                <title>{i18n('remove-from-my')}</title>
              </buttonLockup>
            );

            const buttons = (
              <row>
                {isPreferred ? isOnMyBtn : addToMyBtn}
              </row>
            );

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
                {buttons}
              </stack>
            );
          },

          onMy() {
            const { anime } = this.state;

            user.toggleAnimeFavorite({
              id: anime.id,
              title: anime.title,
              poster: anime.poster,
              banner: anime.banner,
              slug: anime.slug,
            });

            this.setState({ isPreferred: user.isAnimeFavorite(anime.id) });
          },

          removeFromMy() {
            const { anime } = this.state;

            user.toggleAnimeFavorite({
              id: anime.id,
              title: anime.title,
              poster: anime.poster,
              banner: anime.banner,
              slug: anime.slug,
            });

            this.setState({ isPreferred: user.isAnimeFavorite(anime.id) });
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
                      title={i18n('anime-season-title')}
                      subtitle={season.range}
                      poster={season.poster || anime.poster}
                      counter={season.episodes_count}
                      isWatched={false}
                      isUpdated={season.isUpdated}
                      animeId={anime.id}
                      animeTitle={anime.title}
                      animePoster={anime.poster}
                      episodeStart={season.episodeStart}
                      episodeEnd={season.episodeEnd}
                    />
                  ))}
                </section>
              </shelf>
            );
          },

          onShowFullDescription() {
            const { anime } = this.state;

            if (!anime) return;

            TVDML.renderModal(
              <document>
                <descriptiveAlertTemplate>
                  <title>{anime.title}</title>
                  <description>{anime.overview}</description>
                </descriptiveAlertTemplate>
              </document>,
            ).sink();
          },

          componentDidMount() {
            const setState = this.setState.bind(this);

            this.appResumeStream = TVDML.subscribe(TVDML.event.RESUME);
            this.appResumeStream.pipe(() => this.loadData().then(setState));

            this.loadData().then(payload => this.setState(payload));
          },

          componentWillUnmount() {
            if (this.appResumeStream) this.appResumeStream.unsubscribe();
          },

          loadData() {
            const { id } = this.props;

            if (!id) {
              this.setState({ loading: false, anime: null });
              return Promise.resolve();
            }

            return getAnime(id)
              .then(rawAnime => {
                const anime = rawAnime;

                if (!anime.status && this.props.status) {
                  anime.status = this.props.status;
                }

                return getAllEpisodes(id, anime.episodesCount).then(({ episodes }) => {
                  const seasons = buildAnimeSeasons(
                    episodes,
                    {
                      animeId: anime.id,
                      animeTitle: anime.title,
                      poster: anime.poster,
                    },
                    EPISODES_PER_SEASON,
                  );

                  this.setState({
                    loading: false,
                    anime,
                    seasons,
                    isPreferred: user.isAnimeFavorite(anime.id),
                  });
                });
              })
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

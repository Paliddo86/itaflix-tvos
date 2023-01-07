/* global Player Playlist */

import moment from 'moment';
import * as TVDML from 'tvdml';
import formatNumber from 'simple-format-number';

import * as user from '../user';
import { processFamilyAccount } from '../user/utils';

import * as settings from '../settings';

import authFactory from '../helpers/auth';
import { defaultErrorHandlers } from '../helpers/auth/handlers';

import {
  link,
  createMediaItem,
  getMonogramImageUrl,
  isMenuButtonPressNavigatedTo,
  createMediaItems,
} from '../utils';

import { processEntitiesInString } from '../utils/parser';
import { deepEqualShouldUpdate } from '../utils/components';

import { get as i18n } from '../localization';

import {
  getEpisodeMedia,
  getTrailerStream,
  markTVShowAsWatched,
  markTVShowAsUnwatched,
  markSeasonAsWatched,
  markSeasonAsUnwatched,
  markReviewAsLiked,
  markReviewAsDisliked,
  addToMyTVShows,
  removeFromMyTVShows,
  rateTVShow,
  getRelated,
  getMovieDescription,
  getMovieMediaStream,
} from '../request/adc';

import Tile from '../components/tile';
import Loader from '../components/loader';
import Authorize from '../components/authorize';
import { 
  tmdbTVShowStatusStrings,
  getTmdbMovieDetails
} from '../request/tmdb';

const MARK_AS_WATCHED_PERCENTAGE = 90;
const SHOW_RATING_PERCENTAGE = 50;
const RATING_SCREEN_TIMEOUT = 10;

function calculateUnwatchedCount(season) {
  return season.unwatched || 0;
}

function getTrailerItem(trailer) {
  const { tid } = getEpisodeMedia(trailer);

  return getTrailerStream(tid).then(({ stream }) => ({
    id: tid,
    url: stream,
  }));
}

export default function movieRoute() {
  return TVDML.createPipeline()
    .pipe(
      TVDML.passthrough(
        ({ navigation: { sid, title, poster, slug, tmdb_id, imdb_id, continueWatchingAndPlay } }) => ({
          sid,
          title,
          poster,
          slug,
          tmdb_id,
          imdb_id,
          continueWatchingAndPlay: continueWatchingAndPlay === '1'
        }),
      ),
    )
    .pipe(
      TVDML.render(
        TVDML.createComponent({
          getInitialState() {
            const extended = user.isExtended();
            const authorized = user.isAuthorized();

            return {
              likes: 0,
              extended,
              authorized,
              loading: true,
              watching: false,
              continueWatching: false,
            };
          },

          componentDidMount() {
            const setState = this.setState.bind(this);

            // eslint-disable-next-line no-underscore-dangle
            const currentDocument = this._rootNode.ownerDocument;

            this.menuButtonPressStream = TVDML.subscribe('menu-button-press');
            this.menuButtonPressStream
              .pipe(isMenuButtonPressNavigatedTo(currentDocument))
              .pipe(
                isNavigated => isNavigated && this.loadData().then(setState),
              );

            this.userStateChangeStream = user.subscription();
            this.userStateChangeStream.pipe(() =>
              this.setState({
                extended: user.isExtended(),
                authorized: user.isAuthorized(),
              }),
            );

            this.appResumeStream = TVDML.subscribe(TVDML.event.RESUME);
            this.appResumeStream.pipe(() => this.loadData().then(setState));

            // To improuve UX on fast request we are adding rendering timeout.
            const waitForAnimations = new Promise(done =>
              setTimeout(done, 500),
            );

            Promise.all([this.loadData(), waitForAnimations]).then(
              ([payload]) => {
                this.setState(payload);
                if (
                  this.props.continueWatchingAndPlay &&
                  this.canContinueWatching()
                ) {
                  this.onContinueWatchingAndPlay(null);
                } else {
                  this.setState({ loading: false });
                }
              },
            );
          },

          componentWillUnmount() {
            this.menuButtonPressStream.unsubscribe();
            this.userStateChangeStream.unsubscribe();
            this.appResumeStream.unsubscribe();
          },

          shouldComponentUpdate: deepEqualShouldUpdate,

          loadData() {
            const { sid, slug, tmdb_id, imdb_id } = this.props;
            return Promise.all([
              getMovieDescription(sid),
              getTmdbMovieDetails(tmdb_id, imdb_id),
              getRelated(slug)
            ])
              .then(payload => {
                const [
                  movieResponse,
                  tmdbMovieResponse,
                  recomendations,
                ] = payload;

                return {
                  movie: movieResponse.result, 
                  tmdb: tmdbMovieResponse,
                  recomendations: recomendations.relatedData
                };

              //   return Promise.all([
              //     tvshow.reviews > 0 ? getTVShowReviews(sid) : [],
              //     tvshow.trailers > 0 ? getTVShowTrailers(sid) : [],
              //   ]).then(([reviews, trailers]) => ({
              //     tvshow,
              //     reviews,
              //     seasons,
              //     schedule,
              //     trailers,
              //     contries,
              //     recomendations,
              //   }));
              // })
              // .then(payload => ({
              //   likes: +payload.tvshow.likes,
              //   watching: payload.tvshow.watching > 0,
              //   continueWatching: !!this.getSeasonToWatch(payload.seasons),
              //   ...payload,
              });
          },
          render() {
            if (this.state.loading) {
              return (
                <Loader title={this.props.title} heroImg={this.props.poster} />
              );
            }

            return (
              <document>
                <productTemplate>
                  <banner>
                    {this.renderStatus()}
                    {this.renderInfo()}
                    <heroImg src={this.props.poster.replace("/thumbnail_241/", "/original/")} />
                  </banner>
                  {this.renderRecomendations()}
                </productTemplate>
              </document>
            );
          },

          playMovie() {
            const { slug, poster } = this.props;
            const { overview } = this.state.tmdb;

            // const {episodes, translation } = this.state;

            const player = new Player();

            player.playlist = new Playlist();
            player.interactiveOverlayDismissable = false;

            let overlayDocument;

            player.addEventListener(
              'timeDidChange',
              ({ time }) => {
                const { currentMediaItem, currentMediaItemDuration } = player;

                currentMediaItem.currentTime = time;

                if (!currentMediaItem.duration) {
                  currentMediaItem.duration = currentMediaItemDuration;
                }

                // const [, , currentEpisodeNumber] = currentMediaItem.id.split(
                //   '-',
                // );
                // const currentEpisode = getEpisode(
                //   currentEpisodeNumber,
                //   episodes,
                // );

                const watchedPercent = (time * 100) / currentMediaItemDuration;
                const passedBoundary =
                  watchedPercent >= MARK_AS_WATCHED_PERCENTAGE;

                if (passedBoundary && !currentMediaItem.markedAsWatched) {
                  currentMediaItem.markedAsWatched = true;

                  const index = episodeNumber;
                  const nextEpisodeNumber = (season.episodes[index + 1] || {}).number;

                  this.onMarkAsWatched(episodeNumber);

                  // Setting next episode as highlighted if exist
                  if (nextEpisodeNumber) {
                    this.setState({ highlightEpisode: nextEpisodeNumber });
                  }

                  /**
                   * If user configured app for continues playback then loading next
                   * episode media file and adding it to current playlist.
                   */
                  // if (settings.get(VIDEO_PLAYBACK) === CONTINUES) {
                  //   const nextEpisode = getEpisode(nextEpisodeNumber, episodes);

                  //   getEpisodeItem(sid, nextEpisode, poster, translation)
                  //     .then(createMediaItem)
                  //     .then(episodeMediaItem => {
                  //       player.playlist.push(episodeMediaItem);
                  //     });
                  // }
                }

                const { duration, markedAsRated } = currentMediaItem;

                /**
                 * Rounding time values to lower integer and checking if it's last
                 * second of the episode.
                 */
                if (
                  !isNaN(duration) &&
                  time >= duration - 1 &&
                  !markedAsRated
                ) {
                  currentMediaItem.markedAsRated = true;

                  const minimalWatchTime =
                    (duration * SHOW_RATING_PERCENTAGE) / 100;

                  /**
                   * Creating bound closure for rate method to be able to use in
                   * child component.
                   */
                  const onRateChange = this.onRateChange.bind(this);

                  /**
                   * Don't show rating screen if watched time less than minimum
                   * allowed time. This means that user didn't watch episode enough
                   * to rate it.
                   */
                  if (time < minimalWatchTime) return;

                  /**
                   * Pausing player so we can show rating screen with blocked
                   * controls.
                   * All thanks to `player.interactiveOverlayDismissable`.
                   */
                  player.pause();

                  /**
                   * Parsing document because we don't want to show rating screen
                   * as normal screen. It must be rendered
                   * as `interactiveOverlayDocument`.
                   */
                  TVDML.parseDocument(
                    TVDML.createComponent({
                      getInitialState() {
                        return {
                          timeout: RATING_SCREEN_TIMEOUT,
                        };
                      },

                      componentDidMount() {
                        this.timer = setInterval(() => {
                          if (this.state.timeout > 1) {
                            this.setState({
                              timeout: this.state.timeout - 1,
                            });
                          } else {
                            this.resumePlayback();
                          }
                        }, 1000);
                      },

                      componentWillUnmount() {
                        if (this.timer) clearInterval(this.timer);
                      },

                      resumePlayback() {
                        if (this.timer) clearInterval(this.timer);

                        /**
                         * Also we need to manually unmount previously created
                         * document.
                         */
                        player.interactiveOverlayDocument.destroyComponent();
                        player.interactiveOverlayDocument = null;
                        player.play();
                      },

                      render() {
                        const { timeout } = this.state;

                        return (
                          <document>
                            <ratingTemplate style="background-color: rgba(0,0,0,0.8)">
                              <title>
                                {i18n('episode-rate-title', { timeout })}
                              </title>
                              <ratingBadge
                                onChange={event => {
                                  onRateChange(currentEpisode, event).then(
                                    () => {
                                      this.resumePlayback();
                                    },
                                  );
                                }}
                              />
                            </ratingTemplate>
                          </document>
                        );
                      },
                    }),
                  )
                    .pipe(payload => {
                      const { parsedDocument: document } = payload;
                      player.interactiveOverlayDocument = document;
                      overlayDocument = document;

                      /**
                       * Because we created document bypassing normal rendering
                       * pipeline we need to mount document manually by invoking
                       * `didMount` method.
                       */
                      document.didMount();
                    })
                    .sink();
                }
              },
              { interval: 1 },
            );

            player.addEventListener('stateWillChange', event => {
              console.log("addEventListener", event)
              const { currentMediaItem } = player;
              const isEnded = event.state === 'end';
              const isPaused = event.state === 'paused';
              const isProperState = isEnded || isPaused;
              const shouldSaveTime =
                currentMediaItem &&
                !currentMediaItem.markedAsWatched &&
                isProperState;

              if (isEnded && overlayDocument) {
                overlayDocument.destroyComponent();
              }

              // if (shouldSaveTime) {
              //   const { id, currentTime } = currentMediaItem;

              //   const [, , currentEpisodeNumber] = id.split('-');
              //   const currentEpisode = getEpisode(
              //     currentEpisodeNumber,
              //     episodes,
              //   );
              //   const { eid } = getEpisodeMedia(currentEpisode, translation);

              //   saveElapsedTime(eid, currentTime);
              // }
            });

            // Loading and starting playback.
            getMovieMediaStream(slug).then((response) => {
              console.log("getMovieMediaStream response", response)
              const { streams, backdrop_url, title, id, poster_url } = response;
              let movie = {
                id,
                title,
                description: overview,
                streams,
                artworkImageURL: backdrop_url || poster_url || poster,
                resumeTime: 0
              }
              console.log("movie", movie)
                let videoQuality = settings.getPreferredVideoQuality();
                let movieMediaItem =  createMediaItems(movie, videoQuality);

                console.log("movieMediaItem", movieMediaItem)
                player.playlist.push(movieMediaItem);
                console.log(player.playlist)
                player.play();
              });
          },

          renderStatus() {
            const { categories_ids } = this.state.movie;
            const { status } = this.state.tmdb;

            return (
              <infoList>
                <info>
                  <header>
                    <title>{i18n('movie-status')}</title>
                  </header>
                  <text>
                    {i18n(tmdbTVShowStatusStrings[status])}
                  </text>
                </info>
                <info>
                  <header>
                    <title>{i18n('movie-genres')}</title>
                  </header>
                  {categories_ids.map(id => {
                      let genre = settings.getGenresById(id);
                      return (<text key={genre}>{genre}</text>);
                    })
                  }
                </info>
              </infoList>
            );
          },

          renderInfo() {

            const { title, year, quality } = this.state.movie;
            const { 
              overview: description, 
              vote_average: rating,
              runtime
            } = this.state.tmdb;

            // const hasTrailers = !!this.state.trailers.length;
            // const hasMultipleTrailers = this.state.trailers.length > 1;

            let buttons = <row />;
            const onSelectPlay = this.playMovie.bind(this);
            const playBtn = (
              <buttonLockup
                onPlay={onSelectPlay}
                onSelect={onSelectPlay}
              >
                <badge src="resource://button-play" />
                <title>{i18n('movie-control-start-watching')}</title>
              </buttonLockup>
            );

            // const trailerBtnTitleCode = hasMultipleTrailers
            //   ? 'tvshow-control-show-trailers'
            //   : 'tvshow-control-show-trailer';

            // const showTrailerBtn = (
            //   <buttonLockup
            //     onPlay={this.onShowFirstTrailer}
            //     onSelect={this.onShowTrailer}
            //   >
            //     <badge src="resource://button-preview" />
            //     <title>{i18n(trailerBtnTitleCode)}</title>
            //   </buttonLockup>
            // );

            const startWatchingBtn = quality.map((quality) => {
                return (
                  <buttonLockup onSelect={this.onAddToSubscriptions}>
                    <badge src="resource://button-play" />
                    <title>{i18n('tvshow-control-play', {quality})}</title>
                  </buttonLockup>
                );
              });

            const stopWatchingBtn = (
              <buttonLockup onSelect={this.onRemoveFromSubscription}>
                <badge src="resource://button-remove" />
                <title>{i18n('tvshow-control-stop-watching')}</title>
              </buttonLockup>
            );

            const moreBtn = (
              <buttonLockup onSelect={this.onMore}>
                <badge src="resource://button-more" />
                <title>{i18n('tvshow-control-more')}</title>
              </buttonLockup>
            );

            const rateBtn = (
              <buttonLockup onSelect={this.onRate}>
                <badge src="resource://button-rate" />
                <title>{i18n('tvshow-control-rate')}</title>
              </buttonLockup>
            );

            // if (this.state.watching) {
            //   buttons = (
            //     <row>
            //       {this.canContinueWatching() && continueWatchingBtn}
            //       {hasTrailers && showTrailerBtn}
            //       {this.state.authorized && stopWatchingBtn}
            //       {this.state.authorized && rateBtn}
            //       {this.state.authorized && moreBtn}
            //     </row>
            //   );
            // } else {
              //   );
              // }
            buttons = (
              <row>
                {playBtn}
              </row>)

            return (
              <stack>
                <title>{title}</title>
                <row>
                  <ratingBadge value={rating / 10} />
                  <text>{`${i18n('tvshow-information-year').toUpperCase()}: ${year}`}</text>
                  <text>{`${i18n('movie-information-runtime').toUpperCase()}: ${moment.duration(+runtime, 'minutes').humanize()}`}</text>
                </row>
                <description
                  allowsZooming="true"
                  handlesOverflow="true"
                  onSelect={this.onShowFullDescription}
                  style={`
                    tv-text-max-lines: 2;
                  `}
                >
                  {description}
                </description>
                {playBtn}
              </stack>
            );
          },

          onMarkSeasonAsWatched(id) {
            const { sid } = this.state.movie;

            return markSeasonAsWatched(sid, id)
              .then(this.loadData.bind(this))
              .then(this.setState.bind(this))
              .then(TVDML.removeModal);
          },

          onMarkSeasonAsUnwatched(id) {
            const { sid } = this.state.movie;

            return markSeasonAsUnwatched(sid, id)
              .then(this.loadData.bind(this))
              .then(this.setState.bind(this))
              .then(TVDML.removeModal);
          },

          renderRecomendations() {
            if (!this.state.recomendations.length) return null;

            return (
              <shelf>
                <header>
                  <title>{i18n('tvshow-also-watched')}</title>
                </header>
                <section>
                  {this.state.recomendations.map(movie => {
                    const {
                      sid,
                      poster,
                      quality,
                      isUpdated
                    } = movie;

                    const title = i18n('tvshow-title', movie);

                    return (
                      <Tile
                        key={sid}
                        title={title}
                        poster={poster}
                        route="movie"
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

          canContinueWatching() {
            return this.state.continueWatching && this.state.extended;
          },

          onContinueWatchingAndPlay(event) {
            this.onContinueWatching(event, true);
          },

          onContinueWatching(event, shouldPlayImmediately) {
            this.setState({ loading: false });
          },

          onShowTrailer() {
              const title = i18n('tvshow-title', this.state.movie);

              TVDML.renderModal(
                <document>
                  <alertTemplate>
                    <title>{title}</title>
                      <button
                        // eslint-disable-next-line react/jsx-no-bind
                        onSelect={this.playTrailer.bind(this, trailer)}
                      >
                        <text>Play</text>
                      </button>
                  </alertTemplate>
                </document>
              ).sink();
          },

          onShowFirstTrailer() {
            const [trailer] = this.state.trailers;
            this.playTrailer(trailer);
          },

          playTrailer(trailer) {
            const player = new Player();

            player.playlist = new Playlist();

            getTrailerItem(trailer)
              .then(createMediaItem)
              .then(trailerMediaItem => {
                // Adding available meta information about tvshow and trailer.
                Object.assign(trailerMediaItem, {
                  title: i18n('tvshow-title', this.state.tvshow),
                  description: trailer.name,
                  artworkImageURL: this.props.poster,
                });

                // Adding to playlist and starting player.
                player.playlist.push(trailerMediaItem);
                player.play();
              });
          },

          onAddToSubscriptions() {
            const {
              authorized,
              movie: { sid },
            } = this.state;

            if (!authorized) {
              const authHelper = authFactory({
                onError: defaultErrorHandlers,
                onSuccess: ({ token, till, login }) => {
                  user.set({ token, till, logged: 1 });
                  processFamilyAccount(login)
                    .then(this.loadData.bind(this))
                    .then(payload => {
                      this.setState(payload);
                      authHelper.dismiss();
                      this.onAddToSubscriptions();
                    });
                },
              });

              return TVDML.renderModal(
                <Authorize
                  description={i18n('authorize-tvshow-description')}
                  onAuthorize={() => authHelper.present()}
                />,
              ).sink();
            }

            this.setState({
              watching: true,
              likes: this.state.likes + 1,
            });

            return addToMyTVShows(sid);
          },

          onRemoveFromSubscription() {
            const { sid } = this.state.movie;

            this.setState({
              watching: false,
              likes: this.state.likes - 1,
            });

            return removeFromMyTVShows(sid);
          },

          onShowFullDescription() {
            const title = i18n('tvshow-title', this.state.movie);
            const { overview: description } = this.state.tmdb;

            TVDML.renderModal(
              <document>
                <descriptiveAlertTemplate>
                  <title>{title}</title>
                  <description>{description}</description>
                </descriptiveAlertTemplate>
              </document>,
            ).sink();
          },

          onShowFullReview(review) {
            const {
              id,
              text,
              user: userName,
              you_liked: youLiked,
              you_disliked: youDisliked,
            } = review;

            TVDML.renderModal(
              <document>
                <descriptiveAlertTemplate>
                  <title>{userName}</title>
                  <description>{processEntitiesInString(text)}</description>
                  {!youLiked && !youDisliked && (
                    <row>
                      <button
                        // eslint-disable-next-line react/jsx-no-bind
                        onSelect={this.onReviewLiked.bind(this, id)}
                      >
                        <text>👍</text>
                      </button>
                      <button
                        // eslint-disable-next-line react/jsx-no-bind
                        onSelect={this.onReviewDisliked.bind(this, id)}
                      >
                        <text>👎</text>
                      </button>
                    </row>
                  )}
                </descriptiveAlertTemplate>
              </document>,
            ).sink();
          },

          onReviewLiked(id) {
            return markReviewAsLiked(id)
              .then(this.loadData.bind(this))
              .then(this.setState.bind(this))
              .then(TVDML.removeModal);
          },

          onReviewDisliked(id) {
            return markReviewAsDisliked(id)
              .then(this.loadData.bind(this))
              .then(this.setState.bind(this))
              .then(TVDML.removeModal);
          },

          onRate() {
            const { title } = this.props;

            TVDML.renderModal(
              <document>
                <ratingTemplate>
                  <title>{title}</title>
                  <ratingBadge onChange={this.onRateChange} />
                </ratingTemplate>
              </document>,
            ).sink();
          },

          onRateChange(event) {
            return this.onRateTVShow(event.value * 10);
          },

          onRateTVShow(rating) {
            const { sid } = this.props;

            return rateTVShow(sid, rating)
              .then(({ votes: soap_votes, rating: soap_rating }) => ({
                soap_votes,
                soap_rating,
              }))
              .then(processedRating =>
                this.setState({
                  movie: {
                    ...this.state.movie,
                    ...processedRating,
                  },
                }),
              )
              .then(TVDML.removeModal);
          },

          onMore() {
            const { seasons } = this.state;
            const hasWatchedEps = seasons.some(({ unwatched }) => !unwatched);
            const hasUnwatchedEps = seasons.some(
              ({ unwatched }) => !!unwatched,
            );

            TVDML.renderModal(
              <document>
                <alertTemplate>
                  <title>{i18n('tvshow-title-more')}</title>
                  {hasUnwatchedEps && (
                    <button onSelect={this.onMarkTVShowAsWatched}>
                      <text>{i18n('tvshow-mark-as-watched')}</text>
                    </button>
                  )}
                  {hasWatchedEps && (
                    <button onSelect={this.onMarkTVShowAsUnwatched}>
                      <text>{i18n('tvshow-mark-as-unwatched')}</text>
                    </button>
                  )}
                </alertTemplate>
              </document>,
            ).sink();
          },

          onMarkTVShowAsWatched() {
            const { sid } = this.props;

            return markTVShowAsWatched(sid)
              .then(this.loadData.bind(this))
              .then(this.setState.bind(this))
              .then(TVDML.removeModal);
          },

          onMarkTVShowAsUnwatched() {
            const { sid } = this.props;

            return markTVShowAsUnwatched(sid)
              .then(this.loadData.bind(this))
              .then(this.setState.bind(this))
              .then(TVDML.removeModal);
          },
        }),
      ),
    );
}

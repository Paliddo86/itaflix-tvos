/* global Player Playlist */

import moment from 'moment';
import * as TVDML from 'tvdml';

import * as user from '../user';

import * as settings from '../settings';

import authFactory from '../helpers/auth';
import { defaultErrorHandlers } from '../helpers/auth/handlers';

import {
  createMediaItem,
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
  getRelated,
  getMovieDescription,
  getMovieMediaStream,
  getCollection,
  isPreferred,
  addToMyList,
  removeFromMyList,
  checkSession,
} from '../request/adc';

import Tile from '../components/tile';
import Loader from '../components/loader';
import Authorize from '../components/authorize';
import { getMovieDetails } from '../request/sc';
import { Movie } from '../helpers/models';
import { extractVix, VixSrcService } from '../extractors/vixsrc';

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

// #region START
export default function movieRoute() {
  return TVDML.createPipeline()
    .pipe(
      TVDML.passthrough(
        ({ navigation: { sid, title, poster, slug, tmdb_id, imdb_id, banner, continueWatchingAndPlay } }) => ({
          sid,
          title,
          poster,
          slug,
          tmdb_id,
          imdb_id,
          banner,
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
              error: null,
              /**
               * @type {Movie}
               */
              movie: undefined
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
                this.setState({ loading: false });
                if (
                  this.props.continueWatchingAndPlay &&
                  this.canContinueWatching()
                ) {
                  this.onContinueWatchingAndPlay(null);
                } else {
                  this.setState({ loading: false });
                }
              },
            ).catch(error => {
              this.setState({ loading: false });
              defaultErrorHandlers(error);
            });
          },

          componentWillUnmount() {
            this.menuButtonPressStream.unsubscribe();
            this.userStateChangeStream.unsubscribe();
            this.appResumeStream.unsubscribe();
          },

          shouldComponentUpdate: deepEqualShouldUpdate,

          loadData() {
            const { sid, slug } = this.props;

            return getMovieDetails(sid, slug).then(movie => ({
              movie
            }));

            // const preferred = () => {
            //   return checkSession().then(payload => {
            //     if(payload) user.set({...payload});
            //     return isPreferred(sid);
            //   })
            // }

            // return Promise.all([
            //   getMovieDescription(slug),
            //   getRelated(slug),
            //   getCollection(collection_slug),
            //   preferred()
            // ])
            //   .then(payload => {
            //     const [
            //       movieResponse,
            //       recomendations,
            //       collection,
            //       isPreferred
            //     ] = payload;

            //   });
          },
          // #region RENDER
          render() {
            if (this.state.loading) {
              return (
                <Loader title={this.props.title} />
              );
            }
            if (this.state.error) {
              defaultErrorHandlers(this.state.error);
              return null;
            }
            return (
              <document>
                <productTemplate>
                  {this.props.banner && (
                    <background>
                      <img
                        src={this.props.banner}
                        style="width: 100%; height: 100%; "
                      />
                    </background>
                  )}
                  <banner>
                    {this.renderStatus()}
                    {this.renderInfo()}
                    {!this.props.banner && <heroImg src={this.props.poster} />}
                  </banner>
                  {/* {this.renderCollection()}*/}
                  {this.renderRecomendations()}
                </productTemplate>
              </document>
            );
          },

          // #region PLAY MOVIE
          playMovie() {
            /**@type {Movie} */
            const movie = this.state.movie;
            const { tmdb_id, overview, poster, cover, title } = movie;

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

                const watchedPercent = (time * 100) / currentMediaItemDuration;
                const passedBoundary =
                  watchedPercent >= MARK_AS_WATCHED_PERCENTAGE;

                if (passedBoundary && !currentMediaItem.markedAsWatched) {
                  // currentMediaItem.markedAsWatched = true;

                  // const index = episodeNumber;
                  // const nextEpisodeNumber = (season.episodes[index + 1] || {}).number;

                  // this.onMarkAsWatched(episodeNumber);

                  // // Setting next episode as highlighted if exist
                  // if (nextEpisodeNumber) {
                  //   this.setState({ highlightEpisode: nextEpisodeNumber });
                  // }

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

            // #region LOAD MOVIE
            // Loading and starting playback.
            const preparePlayer = (link) => {
              let movie = {
                title,
                description: overview,
                stream: link,
                artworkImageURL: cover|| poster,
                resumeTime: 0
              }
                let movieMediaItem =  createMediaItems(movie);
                player.playlist.push(movieMediaItem);
                player.play();
            }

            console.log("playMovie", tmdb_id);
            VixSrcService.getMovieUrl(tmdb_id).then((result) => {
              preparePlayer(result);
            }).catch((error) => {
              console.error("extractVix error", error);
              defaultErrorHandlers(error);
            });

            // checkSession().then(payload => {
            //   user.set({ ...payload });
            //   getMovieMediaStream(slug).then((response) => { preparePlayer(response)});
            // })
          },

          // #region RENDER STATUS
          renderStatus() {
            /**@type {Movie} */
            const movie = this.state.movie;
            const { genres, status } = movie;


            return (
              <infoList>
                <info>
                  <header>
                    <title>{i18n('movie-status')}</title>
                  </header>
                  <text key={status}>{status ? i18n(`status-${status.toLowerCase()}`) || status: "N/A"}</text>
                </info>
                <info>
                  <header>
                    <title>{i18n('movie-genres')}</title>
                  </header>
                  {genres.map(genre => {
                    let genreName = settings.getMovieGenresById(genre.id);
                    return (<text key={genre.id}>{genreName || genre.name}</text>);

                    })
                  }
                </info>
              </infoList>
            );
          },

          // #region RENDER INFO
          renderInfo() {
            /**@type {Movie} */
            const movie = this.state.movie;
            const { title, released, rating, overview, runtime, quality} = movie;
            const isPreferred = this.state.isPreferred;

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
                {isPreferred ? isOnMyBtn : addToMyBtn}
              </row>)

            return (
              <stack>
                <title>{title}</title>
                <row>
                  <ratingBadge value={rating / 10} />
                  <text>{`${i18n('tvshow-information-year').toUpperCase()}: ${released}`}</text>
                  <text>{`${i18n('movie-information-runtime').toUpperCase()}: ${moment.duration(+runtime, 'minutes').humanize()}`}</text>
                  <text>{`${i18n('movie-quality').toUpperCase()}:`}</text><textBadge style={`font-size: 20;`}>{quality}</textBadge>
                </row>
                <description
                  allowsZooming="true"
                  handlesOverflow="true"
                  onSelect={this.onShowFullDescription}
                  style={`
                    tv-text-max-lines: 2;
                  `}
                >
                  {overview}
                </description>
                {buttons}
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

          // #region RENDER RECOMM
          renderRecomendations() {
            /** @type {Movie} */
            const movie = this.state.movie;
            const {recommendations} = movie;
            if (!recommendations.length) return null;

            return (
              <shelf>
                <header>
                  <title>{i18n('movie-also-watched')}</title>
                </header>
                <section>
                  {recommendations.map(movie => {
                    return (
                      <Tile {...movie} asCover/>
                    );
                  })}
                </section>
              </shelf>
            );
          },

          renderCollection() {
            if (!this.state.collection.length) return null;

            return (
              <shelf>
                <header>
                  <title>{i18n('movie-collection')}</title>
                </header>
                <section>
                  {this.state.collection.map(movie => {
                    const {
                      sid,
                      poster,
                      quality,
                      isUpdated
                    } = movie;

                    const title = i18n('movie-title', movie);

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
                  this.onAddToSubscriptions();
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
          },

          onRemoveFromSubscription() {
            const { sid } = this.state.movie;

            this.setState({
              watching: false,
              likes: this.state.likes - 1,
            });
          },

          onShowFullDescription() {
            const title = i18n('tvshow-title', this.state.movie);
            const { overview } = this.state.movie;

            TVDML.renderModal(
              <document>
                <descriptiveAlertTemplate>
                  <title>{title}</title>
                  <description>{overview}</description>
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

          onMy() {
            // const { sid } = this.props;
            // const listId = user.getListId();

            // checkSession().then(payload => {
            //   if(payload) user.set({ ...payload });
            //   addToMyList(listId, sid).then(() => this.setState({isPreferred: true}));
            // })
            defaultErrorHandlers(new Error("Non Implementata!!!"))
          },

          removeFromMy() {
            // const { sid } = this.props;
            // const listId = user.getListId();

            // checkSession().then(payload => {
            //   if(payload) user.set({ ...payload });
            //   removeFromMyList(listId, sid).then(() => this.setState({isPreferred: false}));
            // })
            defaultErrorHandlers(new Error("Non Implementata!!!"))

          },

          onRateChange(event) {
            return this.onRateTVShow(event.value * 10);
          },

          onRateTVShow(rating) {
            const { sid } = this.props;

            // return rateTVShow(sid, rating)
              // .then(({ votes: soap_votes, rating: soap_rating }) => ({
              //   soap_votes,
              //   soap_rating,
              // }))
              // .then(processedRating =>
              //   this.setState({
              //     movie: {
              //       ...this.state.movie,
              //       ...processedRating,
              //     },
              //   }),
              // )
              // .then(TVDML.removeModal);
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

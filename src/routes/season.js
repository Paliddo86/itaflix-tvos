/* global Player Playlist */

import * as TVDML from 'tvdml';

import { getStartParams, createMediaItems, isMoreThanDaysAhead } from '../utils';
import { processEntitiesInString } from '../utils/parser';
import { deepEqualShouldUpdate } from '../utils/components';

import * as settings from '../settings';
import * as user from '../user';

import { get as i18n } from '../localization';


import Loader from '../components/loader';

import hand from '../assets/icons/hand.png';
import hand2x from '../assets/icons/hand@2x.png';
import { Season } from '../helpers/models';
import { getSeasonDetails } from '../request/sc';
import { VixSrcService } from '../extractors/vixsrc';
import { defaultErrorHandlers } from '../helpers/auth/handlers';

const MARK_AS_WATCHED_PERCENTAGE = 90;
const SHOW_RATING_PERCENTAGE = 50;
const RATING_SCREEN_TIMEOUT = 10;

const { VIDEO_PLAYBACK } = settings.params;
const { CONTINUES } = settings.values[VIDEO_PLAYBACK];

// #region ROUTE
export default function seasonRoute() {
  return TVDML.createPipeline()
    .pipe(
      TVDML.passthrough(
        ({
          navigation: {
            shouldPlayImmediately,
            activeTvShow,
            season,
            title
          },
        }) => ({
          shouldPlayImmediately,
          activeTvShow,
          season,
          title,}),
      ),
    )
    .pipe(
      TVDML.render(
        TVDML.createComponent({
          getInitialState() {
            const { shouldPlayImmediately } = this.props;

            const extended = user.isExtended();
            const authorized = user.isAuthorized();

            return {
              extended,
              authorized,
              loading: true,
              shouldPlayImmediately,
              highlightEpisode: 0
            };
          },

          componentDidMount() {
            const setState = this.setState.bind(this);

            this.appResumeStream = TVDML.subscribe(TVDML.event.RESUME);
            //this.appResumeStream.pipe(() => this.loadData().then(setState));

            // To improuve UX on fast request we are adding rendering timeout.
            const waitForAnimations = new Promise(done =>
              setTimeout(done, 500),
            );

            Promise.all([this.loadData(), waitForAnimations]).then(
              ([payload]) => this.setState({ ...payload, loading: false }),
            );
          },

          componentWillUnmount() {
            this.appResumeStream.unsubscribe();
          },

          shouldComponentUpdate: deepEqualShouldUpdate,

          loadData() {
            console.log("Loading season data...", this.props, this.state);
            return getSeasonDetails(this.props.season.number, this.props.activeTvShow).then(() => {
              return { highlightEpisode: 0 };
            });
          },

          // #region RENDER
          render() {
            /**@type {TvShow} */
            const activeTvShow = this.props.activeTvShow;
            /**@type {Season} */
            const season = this.props.season;
            const seasonTitle = this.props.title;
            if (this.state.loading) {
              return (
                <Loader title={`${activeTvShow.title} - ${seasonTitle}`} />
              );
            }


            const { BASEURL } = getStartParams();

            return (
              <document>
                <head>
                  <style
                    content={`
                      .controls_container {
                        margin: 40 0 0;
                        tv-align: center;
                        tv-content-align: top;
                        tv-interitem-spacing: 24;
                      }

                      .item {
                        background-color: rgba(255, 255, 255, 0.05);
                        tv-highlight-color: rgba(255, 255, 255, 0.9);
                      }

                      .item-content {
                        margin: 60 75 0 0;
                      }

                      .item-desc {
                        margin: 40 0 0;
                      }

                      .item--disabled {
                        color: rgba(0, 0, 0, 0.3);
                      }

                      @media tv-template and (tv-theme:dark) {
                        .item--disabled {
                          color: rgba(255, 255, 255, 0.3);
                        }
                      }

                      .title {
                        tv-text-highlight-style: marquee-on-highlight;
                      }

                      @media tv-template and (tv-theme:dark) {
                        .badge {
                          tv-tint-color: rgb(255, 255, 255);
                        }
                      }
                    `}
                  />
                </head>
                <compilationTemplate>
                  <list>
                    <relatedContent>
                      <lockup><img src={activeTvShow.poster} style="tv-placeholder: tv" width={"100%"} height={"100%"} /></lockup>
                    </relatedContent>
                    <segmentBarHeader>
                      <title>{activeTvShow.title}</title>
                      <subtitle>{seasonTitle}</subtitle>
                    </segmentBarHeader>
                    <section>
                      {season.episodes.map((episode, index) => {
                        const highlight = index === this.state.highlightEpisode;

                        const epTitle = i18n('episode-number', {epLabel: episode.number || ""});
                        const description = episode.overview || i18n('no-description');
                        const isNewEpisode = isMoreThanDaysAhead(episode.updated_at)

                        // eslint-disable-next-line react/jsx-no-bind
                        const onSelectDesc = this.onShowMenu.bind(
                          this,
                          episode,
                        );

                        const onSelectEpisode = this.playEpisode.bind(this, episode);

                        const listItemRef = highlight
                          ? // eslint-disable-next-line react/jsx-no-bind
                            this.onHighlightedItemRender.bind(this, episode)
                          : undefined;

                        return (
                          <listItemLockup
                            class="item"
                            ref={listItemRef}
                            onPlay={onSelectEpisode}
                            onSelect={onSelectEpisode}
                            onHoldselect={onSelectDesc}
                            autoHighlight={highlight ? 'true' : undefined}
                          >
                            <ordinal minLength="3">{episode.label}</ordinal>
                            <title class="title">{epTitle}</title>
                            {isNewEpisode && <decorationLabel>
                              <text>{i18n('tvshow-new')}</text>
                            </decorationLabel>}
                            <relatedContent>
                              <lockup class="item-content">
                                <img src={episode.poster} style="tv-placeholder: tv" width={"100%"} height={"100%"} />
                                <description class="item-desc">
                                  {description}
                                </description>
                                <description class="item-desc">
                                  <badge
                                    class="badge"
                                    style="margin: 0 0 -5"
                                    width="30"
                                    height="30"
                                    srcset={`
                                  ${BASEURL + hand} 1x,
                                  ${BASEURL + hand2x} 2x
                                `}
                                  />{' '}
                                  {i18n('tvshow-episode-menu-hint')}
                                </description>
                              </lockup>
                            </relatedContent>
                          </listItemLockup>
                        );
                      })}
                    </section>
                  </list>
                </compilationTemplate>
              </document>
            );
          },

          /**
           * 
           * @param {Episode} episode 
           */
          onHighlightedItemRender(episode) {

            if (this.state.shouldPlayImmediately) {
              this.setState({ shouldPlayImmediately: false });
              this.playEpisode(episode);
            }
          },
          /**
           * 
           * @param {Episode} episode
           */
          playEpisode(episode) {
            /**@type {TvShow} */
            const tvshow = this.props.activeTvShow;
            /**@type {Season} */
            const season = this.props.season;

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
                  currentMediaItem.markedAsWatched = true;

                  const index = episode.number - 1;
                  const nextEpisodeNumber = (season.episodes[index + 1] || {}).number;

                  this.onMarkAsWatched(episode.number);

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

                  //   getEpisodeItem(sid, nextEpisode, poster)
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
                                  this.resumePlayback();
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
              //   const { eid } = getEpisodeMedia(currentEpisode);

              //   saveElapsedTime(eid, currentTime);
              // }
            });

            //const episode = getEpisode(episodeNumber, episodes);

            const preparePlayer = (link) => {
              let episodeMedia = {
                  title: `${tvshow.title} - ${i18n('tvshow-season-episode', { seasonNumber: season.number, episodeNumber: episode.number })}`,
                  description: episode.overview|| "",
                  stream: link,
                  artworkImageURL: episode.poster || tvshow.cover,
                  resumeTime: 0
                };
                
                let movieMediaItem =  createMediaItems(episodeMedia);
                player.playlist.push(movieMediaItem);
                player.play();
            }

            VixSrcService.getTvShowUrl(tvshow.tmdb_id, season.number, episode.number).then(link => {
              preparePlayer(link);
            }).catch((error) => {
              defaultErrorHandlers(error);
            });
          },

          onShowMenu(episode) {
            const { authorized } = this.state;

            const { spoiler, episode: episodeNumber } = episode;

            const epId = `eid-${episodeNumber}`;

            const titleCode = i18n('tvshow-episode-title', episode);
            const title = processEntitiesInString(titleCode);
            const description = processEntitiesInString(spoiler);

            TVDML.renderModal(
              <document>
                <descriptiveAlertTemplate>
                  <title>{title}</title>
                  <description>{description}</description>
                  <row style="tv-content-align: top">
                    {authorized &&
                      (this.state[epId] ? (
                        <buttonLockup
                          // eslint-disable-next-line react/jsx-no-bind
                          onSelect={this.onMarkAsNew.bind(
                            ...[this, episodeNumber],
                          )}
                        >
                          <badge src="resource://button-remove" />
                          <title>{i18n('episode-mark-as-unwatched')}</title>
                        </buttonLockup>
                      ) : (
                        <buttonLockup
                          // eslint-disable-next-line react/jsx-no-bind
                          onSelect={this.onMarkAsWatched.bind(
                            ...[this, episodeNumber, true],
                          )}
                        >
                          <badge src="resource://button-add" />
                          <title>{i18n('episode-mark-as-watched')}</title>
                        </buttonLockup>
                      ))}
                  </row>
                </descriptiveAlertTemplate>
              </document>,
            ).sink();
          },

          onMarkAsNew(episodeNumber) {
            // const { id, sid } = this.props;

            // this.setState({ [`eid-${episodeNumber}`]: false });

            // return markEpisodeAsUnwatched(sid, id, episodeNumber).then(
            //   TVDML.removeModal,
            // );
            defaultErrorHandlers(new Error("Mark as watched/unwatched not implemented"));
          },

          onMarkAsWatched(episodeNumber, addTVShowToSubscriptions) {
            // const { id, sid } = this.props;

            // const { tvshow } = this.state;

            // this.setState({ [`eid-${episodeNumber}`]: true });

            // return Promise.all([
            //   markEpisodeAsWatched(sid, id, episodeNumber),
            //   Promise.resolve(),
            // ]).then(TVDML.removeModal);
            defaultErrorHandlers(new Error("Mark as watched/unwatched not implemented"));
          },
        }),
      ),
    );
}

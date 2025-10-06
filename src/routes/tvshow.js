/* global Player Playlist */

import moment from 'moment';
import * as TVDML from 'tvdml';
import formatNumber from 'simple-format-number';

import * as user from '../user';
import * as settings from '../settings';

import authFactory from '../helpers/auth';
import { defaultErrorHandlers } from '../helpers/auth/handlers';

import {
  link,
  createMediaItem,
  getMonogramImageUrl,
  isMenuButtonPressNavigatedTo,
} from '../utils';

import { processEntitiesInString } from '../utils/parser';
import { deepEqualShouldUpdate } from '../utils/components';

import { get as i18n } from '../localization';

import {
  getEpisodeMedia,
  getTrailerStream,
  getTVShowSeasons,
  getTVShowDescription,
  markTVShowAsWatched,
  markTVShowAsUnwatched,
  markSeasonAsWatched,
  markSeasonAsUnwatched,
  markReviewAsLiked,
  markReviewAsDisliked,
  getRelated,
  isPreferred,
  addToMyList,
  removeFromMyList,
  checkSession,
  tvshow,
} from '../request/adc';

import Tile from '../components/tile';
import Loader from '../components/loader';
import Authorize from '../components/authorize';
import { TvShow } from '../helpers/models';
import { getTvShowDetails } from '../request/sc';

const { VIDEO_QUALITY } = settings.params;
const { UHD } = settings.values[VIDEO_QUALITY];

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

// #region ROUTE
export default function tvShowRoute() {
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
          continueWatchingAndPlay: continueWatchingAndPlay === '1',
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
                this.setState({...payload, loading: false});
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

          // #region LOAD DATA
          loadData() {
            const { sid, slug } = this.props;

            return getTvShowDetails(sid, slug).then(tvshow => ({
                          tvshow
                        }));
          },

          // #region RENDERING
          render() {
            if (this.state.loading) {
              return (
                <Loader title={this.props.title} heroImg={this.props.poster} />
              );
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
                  {this.renderSeasons()}
                  {this.renderRecommendations()}
                </productTemplate>
              </document>
            );
          },

          // #region STATUS
          renderStatus() {
            /**@type {TvShow} */
            const tvshow = this.state.tvshow;
            const { genres, status } = tvshow;


            return (
              <infoList>
                <info>
                  <header>
                    <title>{i18n('tvshow-status')}</title>
                  </header>
                  <text key={status}>{status ? i18n(`status-${status.toLowerCase()}`) || status: "N/A"}</text>
                </info>
                <info>
                  <header>
                    <title>{i18n('tvshow-genres')}</title>
                  </header>
                  {genres.map(genre => {
                    let genreName = settings.getTvShowGenresById(genre.id);
                    return (<text key={genre.id}>{genreName || genre.name}</text>);

                    })
                  }
                </info>
              </infoList>
            );
          },

          // #region INFO
          renderInfo() {

            /** @type {TvShow} */
            const tvshow = this.state.tvshow;
            const { title, released, quality, rating, overview: description, runtime } = tvshow;
            const isPreferred = this.state.isPreferred

            let buttons = <row />;

            const continueWatchingBtn = (
              <buttonLockup
                onPlay={this.onContinueWatchingAndPlay}
                onSelect={this.onContinueWatching}
              >
                <badge src="resource://button-play" />
                <title>{i18n('tvshow-control-continue-watching')}</title>
              </buttonLockup>
            );

            // const startWatchingBtn = quality.map((quality) => {
            //     return (
            //       <buttonLockup onSelect={this.onAddToSubscriptions}>
            //         <badge src="resource://button-play" />
            //         <title>{i18n('tvshow-control-play', {quality})}</title>
            //       </buttonLockup>
            //     );
            //   });

            // const stopWatchingBtn = (
            //   <buttonLockup onSelect={this.onRemoveFromSubscription}>
            //     <badge src="resource://button-remove" />
            //     <title>{i18n('tvshow-control-stop-watching')}</title>
            //   </buttonLockup>
            // );

            // const moreBtn = (
            //   <buttonLockup onSelect={this.onMore}>
            //     <badge src="resource://button-more" />
            //     <title>{i18n('tvshow-control-more')}</title>
            //   </buttonLockup>
            // );

            // const rateBtn = (
            //   <buttonLockup onSelect={this.onRate}>
            //     <badge src="resource://button-rate" />
            //     <title>{i18n('tvshow-control-rate')}</title>
            //   </buttonLockup>
            // );

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
                {isPreferred ? isOnMyBtn : addToMyBtn}
              </row>)

            return (
              <stack>
                <title>{title}</title>
                <row>
                  <ratingBadge value={rating / 10} />
                  <text>{`${i18n('tvshow-information-year').toUpperCase()}: ${released}`}</text>
                  <text>{`${i18n('tvshow-information-runtime').toUpperCase()}: ${moment.duration(runtime, 'minutes').humanize()}`}</text>
                  <text>{`${i18n('tvshow-quality').toUpperCase()}:`}</text><textBadge style={`font-size: 20;`}>{quality}</textBadge>
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

          // #region SEASONS
          renderSeasons() {
            /** @type {TvShow} */
            const tvshow = this.state.tvshow;
            const {cover } = tvshow;
            const seasons = tvshow.seasons || [];
            if (!seasons.length) return null;

            return (
              <shelf>
                <header>
                  <title>{i18n('tvshow-seasons')} - {seasons.length}</title>
                </header>
                <section>
                  {seasons.map((season, i) => {
                    let isWatched = false;

                    return (
                      <Tile
                        type={season.type}
                        season={season}
                        activeTvShow={tvshow}
                        title={i18n('tvshow-season', season.number)}
                        cover={cover}
                        asCover={true}
                        counter={season.episodes_count}
                        isWatched={isWatched}
                        // eslint-disable-next-line react/jsx-no-bind
                        onHoldselect={this.onSeasonOptions.bind(
                          ...[this, season.id, season.title, season, isWatched],
                        )}
                      />
                    );
                  })}
                </section>
              </shelf>
            );
          },

          onSeasonOptions(id, title, isWatched) {
            TVDML.renderModal(
              <document>
                <alertTemplate>
                  <title>{title}</title>
                  {isWatched ? (
                    <button
                      // eslint-disable-next-line react/jsx-no-bind
                      onSelect={this.onMarkSeasonAsUnwatched.bind(this, id)}
                    >
                      <text>{i18n('season-mark-as-unwatched')}</text>
                    </button>
                  ) : (
                    <button
                      // eslint-disable-next-line react/jsx-no-bind
                      onSelect={this.onMarkSeasonAsWatched.bind(this, id)}
                    >
                      <text>{i18n('season-mark-as-watched')}</text>
                    </button>
                  )}
                </alertTemplate>
              </document>,
            ).sink();
          },

          onMarkSeasonAsWatched(id) {
            const { sid } = this.state.tvshow;

            return markSeasonAsWatched(sid, id)
              .then(this.loadData.bind(this))
              .then(this.setState.bind(this))
              .then(TVDML.removeModal);
          },

          onMarkSeasonAsUnwatched(id) {
            const { sid } = this.state.tvshow;

            return markSeasonAsUnwatched(sid, id)
              .then(this.loadData.bind(this))
              .then(this.setState.bind(this))
              .then(TVDML.removeModal);
          },

          // #region RECOMMENDATIONS
          renderRecommendations() {
            /**@type {TvShow} */
            const tvshow = this.state.tvshow;
            if (!tvshow.recommendations.length) return null;

            return (
              <shelf>
                <header>
                  <title>{i18n('tvshow-also-watched')}</title>
                </header>
                <section>
                  {tvshow.recommendations.map(tvshow => {
                    return (
                      <Tile {...tvshow} asCover />
                    );
                  })}
                </section>
              </shelf>
            );
          },

          getSeasonToWatch(seasons = []) {
            return seasons.reduce((result, season) => {
              if (!result && calculateUnwatchedCount(season)) return season;
              return result;
            }, null);
          },

          canContinueWatching() {
            return this.state.continueWatching && this.state.extended;
          },

          onContinueWatchingAndPlay(event) {
            this.onContinueWatching(event, true);
          },

          onContinueWatching(event, shouldPlayImmediately) {
            const uncompletedSeason = this.getSeasonToWatch(this.state.seasons);
            const {
              season: seasonNumber,
              covers: { big: poster },
            } = uncompletedSeason;

            const seasonTitle = i18n('tvshow-season', { seasonNumber });
            const title = i18n('tvshow-title', this.state.tvshow);
            const { sid } = this.state.tvshow;

            TVDML.navigate('season', {
              sid,
              poster,
              id: seasonNumber,
              title: `${title} — ${seasonTitle}`,
              shouldPlayImmediately,
            }).then(() => this.setState({ loading: false }));
          },

          onShowTrailer() {
            const { trailers } = this.state;

            if (trailers.length < 2) {
              this.onShowFirstTrailer();
            } else {
              const title = i18n('tvshow-title', this.state.tvshow);

              TVDML.renderModal(
                <document>
                  <alertTemplate>
                    <title>{title}</title>
                    {trailers.map(trailer => (
                      <button
                        // eslint-disable-next-line react/jsx-no-bind
                        onSelect={this.playTrailer.bind(this, trailer)}
                      >
                        <text>{trailer.name}</text>
                      </button>
                    ))}
                  </alertTemplate>
                </document>,
              ).sink();
            }
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
              tvshow: { sid },
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
            const { sid } = this.state.tvshow;

            this.setState({
              watching: false,
              likes: this.state.likes - 1,
            });
          },

          onShowFullDescription() {
            /**@type {TvShow} */
            const tvshow = this.state.tvshow;
            const { title, overview } = tvshow;

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
            //   .then(({ votes: soap_votes, rating: soap_rating }) => ({
            //     soap_votes,
            //     soap_rating,
            //   }))
            //   .then(processedRating =>
            //     this.setState({
            //       tvshow: {
            //         ...this.state.tvshow,
            //         ...processedRating,
            //       },
            //     }),
            //   )
            //   .then(TVDML.removeModal);
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

/* global Player Playlist */

import * as TVDML from 'tvdml';

import { createMediaItems, getStartParams, isMoreThanDaysAhead } from '../utils';
import { getEpisodesByRange, getEmbedUrl } from '../request/animeunity';
import AnimeUnityExtractor from '../extractors/animeunity';
import { defaultErrorHandlers } from '../helpers/auth/handlers';
import Loader from '../components/loader';
import { get as i18n } from '../localization';

import hand from '../assets/icons/hand.png';
import hand2x from '../assets/icons/hand@2x.png';

/**
 * Lista episodi di un blocco anime.
 * Copia della struttura di src/routes/season.js: stesso compilationTemplate,
 * stesso blocco <style>, relatedContent con <img> sempre presente
 * (tv-placeholder: tv disegna il placeholder quando l'immagine manca),
 * stessi listItemLockup e stessa gestione del player.
 *
 * Gli episodi NON arrivano come attributo di navigazione (TVML non sa
 * serializzare array di oggetti): si ricaricano qui per range.
 */
export default function animeSeasonRoute() {
  return TVDML.createPipeline()
    .pipe(
      TVDML.passthrough(payload => {
        // navigation puo' mancare: la destrutturazione in profondita'
        // farebbe esplodere il passthrough e la route non renderizzerebbe.
        const navigation = (payload && payload.navigation) || {};

        return {
          animeId: navigation.animeId,
          animeTitle: navigation.animeTitle,
          animePoster: navigation.animePoster,
          seasonTitle: navigation.title,
          episodeStart: Number(navigation.episodeStart) || 0,
          episodeEnd: Number(navigation.episodeEnd) || 0,
        };
      }),
    )
    .pipe(
      TVDML.render(
        TVDML.createComponent({
          getInitialState() {
            return {
              loading: true,
              highlightEpisode: 0,
              episodes: [],
            };
          },

          render() {
            if (this.state.loading) {
              return (
                <Loader
                  title={`${this.props.animeTitle || ''} - ${this.props.seasonTitle || ''}`}
                />
              );
            }

            const { episodes } = this.state;
            const seasonTitle = this.props.seasonTitle;

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
                      <lockup>
                        <img
                          src={this.props.animePoster}
                          style="tv-placeholder: tv"
                          width="100%"
                          height="100%"
                        />
                      </lockup>
                    </relatedContent>
                    <segmentBarHeader>
                      <title>{this.props.animeTitle}</title>
                      <subtitle>{seasonTitle}</subtitle>
                    </segmentBarHeader>
                    <section>
                      {episodes.map((episode, index) => {
                        const highlight = index === this.state.highlightEpisode;

                        const epTitle = i18n('episode-number', { epLabel: episode.number || '' });
                        const description = episode.overview || i18n('no-description');
                        const isNewEpisode = isMoreThanDaysAhead(episode.updated_at);

                        // eslint-disable-next-line react/jsx-no-bind
                        const onSelectDesc = this.onShowMenu.bind(this, episode);

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
                            <ordinal minLength="3">{episode.number}</ordinal>
                            <title class="title">{epTitle}</title>
                            {isNewEpisode && (
                              <decorationLabel>
                                <text>{i18n('tvshow-new')}</text>
                              </decorationLabel>
                            )}
                            <relatedContent>
                              <lockup class="item-content">
                                <img
                                  src={episode.poster}
                                  style="tv-placeholder: tv"
                                  width="100%"
                                  height="100%"
                                />
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
                                  />
                                  {' '}
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

          componentDidMount() {
            this.loadData();
          },

          loadData() {
            const { animeId, episodeStart, episodeEnd } = this.props;
            const numericId = String(animeId || '').split('-')[0];

            if (!numericId) {
              this.setState({ loading: false, episodes: [] });
              return Promise.resolve();
            }

            return getEpisodesByRange(numericId, episodeStart, episodeEnd)
              .then(episodes => {
                this.setState({ loading: false, episodes });
              })
              .catch(error => {
                console.error('Anime: caricamento episodi fallito', error);
                this.setState({ loading: false, episodes: [] });
                defaultErrorHandlers(error);
              });
          },

          onHighlightedItemRender(episode) {
            this.setState({ highlightEpisode: episode.number - 1 });
          },

          onShowMenu(episode) {
            const description = episode.overview || i18n('no-description');

            TVDML.renderModal(
              <document>
                <alertTemplate>
                  <title>{i18n('episode-number', { epLabel: episode.number })}</title>
                  <description>{description}</description>
                  <button onSelect={TVDML.removeModal}>
                    <text>{i18n('generic-error-close')}</text>
                  </button>
                </alertTemplate>
              </document>,
            ).sink();
          },

          playEpisode(episode) {
            const player = new Player();
            player.playlist = new Playlist();
            player.interactiveOverlayDismissable = false;

            const preparePlayer = link => {
              const media = {
                title: `${this.props.animeTitle} - ${i18n('episode-number', { epLabel: episode.number })}`,
                description: episode.overview || '',
                stream: link,
                artworkImageURL: this.props.animePoster,
                resumeTime: 0,
              };

              const mediaItem = createMediaItems(media);
              player.playlist.push(mediaItem);
              player.play();
            };

            getEmbedUrl(this.props.animeId, episode.id)
              .then(embed => AnimeUnityExtractor.getStreamUrl(embed))
              .then(preparePlayer)
              .catch(error => {
                console.error('Anime: estrazione stream fallita', error);
                defaultErrorHandlers(error);
              });

            return player;
          },
        }),
      ),
    );
}

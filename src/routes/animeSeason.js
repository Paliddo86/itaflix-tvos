/* global Player Playlist */

import * as TVDML from 'tvdml';

import { createMediaItems, getStartParams } from '../utils';
import { AnimeSeason } from '../helpers/models';
import { getEmbedUrl } from '../request/animeunity';
import AnimeUnityExtractor from '../extractors/animeunity';
import { defaultErrorHandlers } from '../helpers/auth/handlers';
import { get as i18n } from '../localization';

import hand from '../assets/icons/hand.png';
import hand2x from '../assets/icons/hand@2x.png';

/**
 * Lista episodi di una "stagione" anime.
 * Replica di src/routes/season.js: stesso compilationTemplate, stessi
 * stili inline, stesso pattern dei listItemLockup e del player.
 *
 * Riceve tutto via navigation dal dettaglio della serie:
 * episodes, seasonTitle, animeTitle, animePoster, animeId.
 */
export default function animeSeasonRoute() {
  return TVDML.createPipeline()
    .pipe(
      TVDML.passthrough(
        ({ navigation: { episodes, seasonTitle, animeTitle, animePoster, animeBanner, animeId } }) => ({
          episodes: episodes || [],
          seasonTitle,
          animeTitle,
          animePoster,
          animeBanner,
          animeId,
        }),
      ),
    )
    .pipe(
      TVDML.render(
        TVDML.createComponent({
          getInitialState() {
            // Ricostruisce il modello AnimeSeason dai parametri di navigazione,
            // cosi' la vista episodi lavora con lo stesso oggetto della serie TV.
            this.season = new AnimeSeason({
              number: 1,
              title: this.props.seasonTitle,
              episodes: this.props.episodes,
              poster: this.props.animePoster,
              animeId: this.props.animeId,
              animeTitle: this.props.animeTitle,
              animeBanner: this.props.animeBanner,
            });

            return {
              highlightEpisode: 0,
            };
          },

          render() {
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
                          src={this.season.animeBanner || this.season.poster}
                          style="tv-placeholder: tv"
                          width="100%"
                          height="100%"
                        />
                      </lockup>
                    </relatedContent>
                    <segmentBarHeader>
                      <title>{this.season.animeTitle}</title>
                      <subtitle>
                        {this.season.title
                          || i18n('anime-episodes-count', {
                            count: this.season.episodes.length,
                          })}
                      </subtitle>
                    </segmentBarHeader>
                    <section>
                      {this.season.episodes.map((episode, index) => {
                        const highlight = index === this.state.highlightEpisode;

                        // eslint-disable-next-line react/jsx-no-bind
                        const onSelectEpisode = this.playEpisode.bind(this, episode);

                        return (
                          <listItemLockup
                            class="item"
                            onPlay={onSelectEpisode}
                            onSelect={onSelectEpisode}
                            autoHighlight={highlight ? 'true' : undefined}
                          >
                            <ordinal minLength="3">{episode.number}</ordinal>
                            <title class="title">
                              {i18n('episode-number', { epLabel: episode.number })}
                            </title>
                            <relatedContent>
                              <lockup class="item-content">
                                <description class="item-desc">
                                  {episode.overview || i18n('no-description')}
                                </description>
                                <description class="item-desc">
                                  <badge
                                    srcset={`${BASEURL + hand} 1x, ${BASEURL + hand2x} 2x`}
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

          playEpisode(episode) {
            const player = new Player();
            player.playlist = new Playlist();
            player.interactiveOverlayDismissable = false;

            const preparePlayer = streamUrl => {
              const media = {
                title: `${this.season.animeTitle} - ${episode.title}`,
                description: '',
                stream: streamUrl,
                artworkImageURL: this.season.poster || this.season.animeBanner,
                resumeTime: 0,
              };

              player.playlist.push(createMediaItems(media));
              player.play();
            };

            getEmbedUrl(this.season.animeId, episode.id)
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

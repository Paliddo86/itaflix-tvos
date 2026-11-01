/* global Player Playlist */

import * as TVDML from 'tvdml';

import styles from '../common/styles';

import { createMediaItems } from '../utils';
import { getAnime, getEpisodes, getEmbedUrl } from '../request/animeunity';
import AnimeUnityExtractor from '../extractors/animeunity';
import { defaultErrorHandlers } from '../helpers/auth/handlers';
import Loader from '../components/loader';
import { get as i18n } from '../localization';

export default function animeSeriesRoute() {
  return TVDML.createPipeline()
    .pipe(
      TVDML.passthrough(({ navigation }) => ({
        id: (navigation && navigation.id) || (navigation && navigation.sid),
        title: navigation && navigation.title,
        poster: navigation && navigation.poster,
      })),
    )
    .pipe(
      TVDML.render(
        TVDML.createComponent({
          getInitialState() {
            return {
              loading: true,
              highlightEpisode: 0,
              show: null,
              episodes: [],
            };
          },

          render() {
            if (this.state.loading) {
              return <Loader title={i18n('loading')} />;
            }

            const { show, episodes } = this.state;

            if (!show) {
              return (
                <document>
                  <head> {styles} </head>
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
                <head> {styles} </head>
                <compilationTemplate>
                  <list>
                    <relatedContent>
                      <lockup>
                        <img
                          src={show.poster}
                          style="tv-placeholder: tv"
                          width="100%"
                          height="100%"
                        />
                      </lockup>
                    </relatedContent>
                    <segmentBarHeader>
                      <title>{show.title}</title>
                      <subtitle>
                        {i18n('anime-episodes-count', { count: episodes.length })}
                      </subtitle>
                    </segmentBarHeader>
                    <section>
                      {episodes.map((episode, index) => this.renderEpisode(episode, index))}
                    </section>
                  </list>
                </compilationTemplate>
              </document>
            );
          },

          renderEpisode(episode, index) {
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
                <title class="title">{episode.title}</title>
                <relatedContent>
                  <lockup class="item-content">
                    <description class="item-desc">
                      {`${this.state.show.title} - ${episode.title}`}
                    </description>
                  </lockup>
                </relatedContent>
              </listItemLockup>
            );
          },

          componentDidMount() {
            this.loadData();
          },

          loadData() {
            const { id } = this.props;

            if (!id) {
              this.setState({ loading: false, show: null });
              return Promise.resolve();
            }

            return getAnime(id)
              .then(show =>
                getEpisodes(id).then(({ episodes, embedUrl }) => {
                  this.setState({
                    loading: false,
                    show,
                    episodes,
                    embedUrl,
                  });
                }),
              )
              .catch(error => {
                this.setState({ loading: false, show: null });
                defaultErrorHandlers(error);
              });
          },

          playEpisode(episode) {
            const { show, embedUrl: showEmbedUrl } = this.state;

            const player = new Player();
            player.playlist = new Playlist();
            player.interactiveOverlayDismissable = false;

            const preparePlayer = streamUrl => {
              const media = {
                title: `${show.title} - ${episode.title}`,
                description: show.overview || '',
                stream: streamUrl,
                artworkImageURL: show.poster,
                resumeTime: 0,
              };

              const mediaItem = createMediaItems(media);
              player.playlist.push(mediaItem);
              player.play();
            };

            // Episodio 1 o film: il dettaglio espone gia' un embed_url.
            // Per gli altri si chiede /embed-url/{episodeId}.
            const embedPromise =
              episode.number === 1 && showEmbedUrl
                ? Promise.resolve(showEmbedUrl)
                : getEmbedUrl(this.props.id, episode.id);

            embedPromise
              .then(embed => AnimeUnityExtractor.getStreamUrl(embed))
              .then(preparePlayer)
              .catch(error => {
                defaultErrorHandlers(error);
              });

            return player;
          },
        }),
      ),
    );
}

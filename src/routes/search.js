import * as TVDML from 'tvdml';

import { get as i18n } from '../localization';

import {
  link,
  prettifyEpisodeNum,
  getMonogramImageUrl,
  sortTvShows,
} from '../utils';

import { processEntitiesInString } from '../utils/parser';

import {
  getSearchResults,
  getLatestUpdates,
} from '../request/adc';

import Tile from '../components/tile';
import styles from '../common/styles';

const THROTTLE_TIMEOUT = 500;

export default function searchRoute() {
  return TVDML.createPipeline().pipe(
    TVDML.render(
      TVDML.createComponent({
        getInitialState() {
          return {
            value: '',
            loading: false,
            updating: false,
            latest: [],
            searchResults: [],
            news: [],
            seriesUpdate: [],
            persons: [],
            episodes: [],
          };
        },

        render() {
          const tvshows = this.state.episodes.reduce((result, item) => {
            const title = i18n('tvshow-title-from-episode', item);
            // eslint-disable-next-line no-param-reassign
            if (!result[title]) result[title] = [];
            result[title].push(item);
            return result;
          }, {});

          const episodes = Object.keys(tvshows);

          return (
            <document>
              <head> {styles} </head>
              <searchTemplate>
                <searchField
                  ref={node => (this.searchField = node)}
                  showSpinner={this.state.loading ? 'true' : undefined}
                />
                <collectionList>
                  {this.renderLatest()}
                  {this.renderNewest()}
                  {this.renderSeriesUpdate()}
                  {this.renderShows()}
                  {/* {episodes.map((name, i) =>
                    this.renderEpisodes(
                      ...[name, tvshows[name], i + 1 === episodes.length],
                    ),
                  )} */}
                </collectionList>
              </searchTemplate>
            </document>
          );
        },

        renderLatest() {
          if (!this.state.latest.values.length || this.state.value) return null;
          return (
            <shelf>
              <header>
                <title>{this.state.latest.name}</title>
              </header>
              <section>
                {this.state.latest.values.map(tvshow => {
                  const {
                    title,
                    poster,
                    quality,
                    isUpdated,
                  } = tvshow;

                  return (
                    <Tile
                      title={title}
                      route="tvshow"
                      poster={poster}
                      quality={quality}
                      isUpdated={isUpdated}
                      payload={tvshow}
                    />
                  );
                })}
              </section>
            </shelf>
          );
        },

        renderNewest() {
          if (!this.state.news.values.length || this.state.value) return null;
          return (
            <shelf>
              <header>
                <title>{this.state.news.name}</title>
              </header>
              <section>
                {this.state.news.values.map(tvshow => {
                  const {
                    title,
                    poster,
                    quality,
                    isUpdated,
                  } = tvshow;

                  return (
                    <Tile
                      title={title}
                      route="tvshow"
                      poster={poster}
                      quality={quality}
                      isUpdated={isUpdated}
                      payload={tvshow}
                    />
                  );
                })}
              </section>
            </shelf>
          );
        },

        renderSeriesUpdate() {
          if (!this.state.seriesUpdate.values.length || this.state.value) return null;
          return (
            <shelf>
              <header>
                <title>{this.state.seriesUpdate.name}</title>
              </header>
              <section>
                {this.state.seriesUpdate.values.map(tvshow => {
                  const {
                    title,
                    poster,
                    quality,
                    isUpdated,
                    sid
                  } = tvshow;

                  return (
                    <Tile
                      key={sid}
                      title={title}
                      route="tvshow"
                      poster={poster}
                      quality={quality}
                      isUpdated={isUpdated}
                      payload={tvshow}
                    />
                  );
                })}
              </section>
            </shelf>
          );
        },

        renderPersons() {
          if (!this.state.persons.length) return null;

          return (
            <shelf class="shelf_indent">
              <header>
                <title>{i18n('search-persons')}</title>
              </header>
              <section>
                {this.state.persons.map(actor => {
                  const {
                    id,
                    name_en: actorName,
                    image_original: actorImage,
                  } = actor;

                  const [firstName, lastName] = actorName.split(' ');

                  return (
                    <monogramLockup
                      key={id}
                      onSelect={link('actor', {
                        id,
                        actor: actorName,
                        poster: actorImage,
                      })}
                    >
                      <monogram
                        style="tv-placeholder: monogram"
                        src={getMonogramImageUrl(actorImage)}
                        firstName={firstName}
                        lastName={lastName}
                      />
                      <title>{actorName}</title>
                      <subtitle>{i18n('search-actor')}</subtitle>
                    </monogramLockup>
                  );
                })}
              </section>
            </shelf>
          );
        },

        renderShows() {
          if (!this.state.searchResults.length) return null;

          return (
            <shelf class="shelf_indent">
              <header>
                <title>{i18n('search-result')}</title>
              </header>
              <section>
              {this.state.searchResults.map(result => {
                  const {
                    sid,
                    title,
                    poster,
                    quality,
                    isUpdated,
                    slug,
                    tmdb_id,
                    imdb_id
                  } = result;

                  return (
                    <Tile
                      title={title}
                      route="tvshow"
                      poster={poster}
                      quality={quality}
                      isUpdated={isUpdated}
                      payload={{ title, sid, slug, poster, tmdb_id, imdb_id }}
                    />
                  );
                })}
              </section>
            </shelf>
          );
        },

        renderEpisodes(title, list, isLast) {
          return (
            <shelf class={isLast ? undefined : 'shelf_indent'}>
              <header>
                <title>{title}</title>
              </header>
              <section>
                {list.map(episode => {
                  const {
                    sid,
                    season: seasonNumber,
                    episode: episodeNumber,
                    covers: { big: poster },
                  } = episode;

                  const seasonTitle = i18n('tvshow-season', { seasonNumber });
                  const episodeTitle = i18n('tvshow-episode-title', episode);

                  return (
                    <Tile
                      title={processEntitiesInString(episodeTitle)}
                      route="season"
                      poster={poster}
                      payload={{
                        sid,
                        poster,
                        episodeNumber,
                        id: seasonNumber,
                        title: `${title} — ${seasonTitle}`,
                      }}
                      subtitle={prettifyEpisodeNum(seasonNumber, episodeNumber)}
                    />
                  );
                })}
              </section>
            </shelf>
          );
        },

        componentDidMount() {
          const keyboard = this.searchField.getFeature('Keyboard');

          keyboard.onTextChange = () => this.search(keyboard.text);

          this.loadData().then(payload => {
            this.setState({ loading: false, ...payload });
          });
        },

        componentWillReceiveProps() {
          this.setState({ updating: true });
        },

        componentDidUpdate(prevProps, prevState) {
          if (
            this.state.updating &&
            prevState.updating !== this.state.updating
          ) {
            this.loadData().then(payload => {
              this.setState({ updating: false, ...payload });
            });
          }
        },

        loadData() {
          return getLatestUpdates();
        },

        search(query) {
          this.setState({ value: query });
          if (this.throttle) clearTimeout(this.throttle);
          this.throttle = setTimeout(() => {
            this.loadResults(query);
          }, THROTTLE_TIMEOUT);
        },

        loadResults(query) {
          this.setState({ loading: true });
          if(!query) {
            let searchResults = [];
            this.setState({ loading: false, updating: true, searchResults })
            return Promise.resolve({searchResults})
          }
          return getSearchResults(query)
            .catch(() => ({}))
            .then(result => this.setState({ loading: false, ...result }));
        },
      }),
    ),
  );
}

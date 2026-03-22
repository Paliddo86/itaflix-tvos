import { defaultErrorHandlers } from '../helpers/auth/handlers';
import { Category, Movie, TvShow, Episode, Genre, Season, People } from '../helpers/models';
import * as request from '../request';
import * as settings from '../settings';

/**
 * TMDB Provider - Static class for TMDB API interactions
 * Adapted to project models (Movie, TvShow, Season, Episode, Genre, People)
 */
class TMDB {
  static API_BASE = 'https://api.themoviedb.org/3';
  static IMAGE_BASE = 'https://image.tmdb.org/t/p/original';
  
  static _apiKey = process.env.TMDB_API || '';
  static _language = 'it';

  /**
   * Set the language for API responses (default: 'it')
   */
  static setLanguage(lang) {
    this._language = lang || 'it';
  }

  /**
   * Ensure API key is set before making requests
   */
  static _ensureKey() {
    if (!this._apiKey) throw new Error('TMDB API key not set. Call TMDB.setApiKey(key) or set TMDB_API env var');
  }

  /**
   * Build image URL
   */
  static _buildImage(path, size = 'w300') {
    if (!path) return '';
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }

  /**
   * Make a GET request to TMDB API
   */
  static async _tmdbGet(path, params = {}) {
    this._ensureKey();
    const qs = Object.keys(params)
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');

    const lang = this._language && this._language.length === 2 ? `${this._language}-IT` : this._language;
    const url = `${this.API_BASE}${path}?api_key=${this._apiKey}&language=${lang}${qs ? `&${qs}` : ''}`;
    return request.get(url).then(request.toJSON());
  }

  /**
   * Fetch and cache genres
   */
  static async _fetchAndMapGenres() {
    try {
      const [movieGenresRes, tvGenresRes] = await Promise.all([
        this._tmdbGet('/genre/movie/list'),
        this._tmdbGet('/genre/tv/list'),
      ]);

      const movieGenres = {};
      (movieGenresRes.genres || []).forEach(g => (movieGenres[g.id] = new Genre({ id: g.id, name: g.name, type: 'movie' })));

      const tvGenres = {};
      (tvGenresRes.genres || []).forEach(g => (tvGenres[g.id] = new Genre({ id: g.id, name: g.name, type: 'tv' })));

      settings.set(settings.params.MOVIE_CATEGORIES, movieGenres);
      settings.set(settings.params.TV_SHOW_CATEGORIES, tvGenres);

      console.log('Fetched and cached genres:', { movieGenres, tvGenres });
      return { movieGenres, tvGenres };
    } catch (e) {
      defaultErrorHandlers(e);
      return { movieGenres: {}, tvGenres: {} };
    }
  }

  /**
   * Generate slug from text
   */
  static _makeSlug(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  /**
   * Get translated string
   */
  static _getTranslation(key) {
    const translations = {
      it: {
        'Trending': 'Di tendenza',
        'Popular Movies': 'Film popolari',
        'Popular TV Shows': 'Serie TV popolari',
        'Popular Anime': 'Anime popolari',
        'Popular on Netflix': 'Popolari su Netflix',
        'Popular on Amazon': 'Popolari su Amazon',
        'Popular on Disney+': 'Popolari su Disney+',
        'Popular on Hulu': 'Popolari su Hulu',
        'Popular on Apple TV+': 'Popolari su Apple TV+',
        'Popular on HBO': 'Popolari su HBO',
      },
      es: {
        'Trending': 'Tendencias',
        'Popular Movies': 'Películas populares',
        'Popular TV Shows': 'Series de TV populares',
        'Popular Anime': 'Anime populares',
        'Popular on Netflix': 'Popular en Netflix',
        'Popular on Amazon': 'Popular en Amazon',
        'Popular on Disney+': 'Popular en Disney+',
        'Popular on Hulu': 'Popular en Hulu',
        'Popular on Apple TV+': 'Popular en Apple TV+',
        'Popular on HBO': 'Popular en HBO',
      },
    };

    return (translations[this._language] && translations[this._language][key]) || key;
  }

  /**
   * Map TMDB movie response to Movie model
   */
  static _mapMovieToItem(it) {
    return new Movie({
      id: it.id,
      title: it.title || it.name,
      poster: this._buildImage(it.poster_path),
      //cover: this._buildImage(it.poster_path),
      banner: this._buildImage(it.backdrop_path),
      rating: it.vote_average,
      slug: this._makeSlug(it.title || it.original_title || it.name),
      isUpdated: false,
      type: 'movie',
    });
  }

  /**
   * Map TMDB TV response to TvShow model
   */
  static _mapTvToItem(it) {
    return new TvShow({
      id: it.id,
      title: it.name || it.title,
      poster: this._buildImage(it.poster_path),
      //cover: this._buildImage(it.poster_path),
      banner: this._buildImage(it.backdrop_path),
      rating: it.vote_average,
      slug: this._makeSlug(it.name || it.original_name || it.title),
      isUpdated: false,
      type: 'tv',
    });
  }

  /**
   * Map TMDB multi-type response (movie/tv/person) to appropriate model
   */
  static _mapMultiToItem(it) {
    if (!it) return null;
    if (it.media_type === 'movie' || it.title) return this._mapMovieToItem(it);
    return this._mapTvToItem(it);
  }

  /**
   * Get home page categories (Trending, Popular Movies, Popular TV Shows, Anime, Netflix, Amazon, Disney+, Hulu, Apple TV+, HBO)
   */
  static async getHome() {
    try {

    await this._fetchAndMapGenres();

      const categories = [];
      const watchRegion = this._language === 'en' ? 'US' : this._language.toUpperCase();

      // 2. Fetch Popular Movies (pages 1-3)
      const [popMoviesRes1, popMoviesRes2, popMoviesRes3] = await Promise.all([
        this._tmdbGet('/movie/popular', { page: 1 }),
        this._tmdbGet('/movie/popular', { page: 2 }),
        this._tmdbGet('/movie/popular', { page: 3 }),
      ]);
      const popMoviesList = [
        ...(popMoviesRes1.results || []),
        ...(popMoviesRes2.results || []),
        ...(popMoviesRes3.results || []),
      ];

      // 3. Fetch Popular TV Shows (pages 1-3)
      const [popTvRes1, popTvRes2, popTvRes3] = await Promise.all([
        this._tmdbGet('/tv/popular', { page: 1 }),
        this._tmdbGet('/tv/popular', { page: 2 }),
        this._tmdbGet('/tv/popular', { page: 3 }),
      ]);
      const popTvList = [
        ...(popTvRes1.results || []),
        ...(popTvRes2.results || []),
        ...(popTvRes3.results || []),
      ];

      // 4. Fetch Anime (keyword-based)
      const animeRes = await this._tmdbGet('/discover/movie', { with_keywords: '210024,180547' });
      const animeList = (animeRes.results || []).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

      // 5. Fetch Netflix content
      const [netflixMoviesRes, netflixTvRes] = await Promise.all([
        this._tmdbGet('/discover/movie', { page: 1, with_watch_providers: '8', watch_region: watchRegion }),
        this._tmdbGet('/discover/tv', { page: 1, with_networks: '213' }),
      ]);
      const netflixList = [
        ...(netflixMoviesRes.results || []),
        ...(netflixTvRes.results || []),
      ].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

      // 6. Fetch Amazon Prime content
      const [amazonMoviesRes, amazonTvRes] = await Promise.all([
        this._tmdbGet('/discover/movie', { page: 1, with_watch_providers: '119', watch_region: watchRegion }),
        this._tmdbGet('/discover/tv', { page: 1, with_networks: '1024' }),
      ]);
      const amazonList = [
        ...(amazonMoviesRes.results || []),
        ...(amazonTvRes.results || []),
      ].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

      // 7. Fetch Disney+ content
      const [disneyMoviesRes, disneyTvRes] = await Promise.all([
        this._tmdbGet('/discover/movie', { page: 1, with_watch_providers: '137', watch_region: watchRegion }),
        this._tmdbGet('/discover/tv', { page: 1, with_networks: '2739' }),
      ]);
      const disneyList = [
        ...(disneyMoviesRes.results || []),
        ...(disneyTvRes.results || []),
      ].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

      // 8. Fetch Hulu content
      const [huluMoviesRes, huluTvRes] = await Promise.all([
        this._tmdbGet('/discover/movie', { page: 1, with_watch_providers: '15', watch_region: watchRegion }),
        this._tmdbGet('/discover/tv', { page: 1, with_networks: '453' }),
      ]);
      const huluList = [
        ...(huluMoviesRes.results || []),
        ...(huluTvRes.results || []),
      ].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

      // 9. Fetch Apple TV+ content
      const [appleMoviesRes, appleTvRes] = await Promise.all([
        this._tmdbGet('/discover/movie', { page: 1, with_watch_providers: '192', watch_region: watchRegion }),
        this._tmdbGet('/discover/tv', { page: 1, with_networks: '2552' }),
      ]);
      const appleList = [
        ...(appleMoviesRes.results || []),
        ...(appleTvRes.results || []),
      ].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

      // 10. Fetch HBO content
      const hboRes = await this._tmdbGet('/discover/tv', { page: 1, with_networks: '49' });
      const hboList = (hboRes.results || []).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

      // Build categories array

      categories.push(
        new Category({
          name: this._getTranslation('Popular Movies'),
          values: popMoviesList.map(it => this._mapMovieToItem(it)),
        })
      );

      categories.push(
        new Category({
          name: this._getTranslation('Popular TV Shows'),
          values: popTvList.map(it => this._mapTvToItem(it)),
        })
      );

      categories.push(
        new Category({
          name: this._getTranslation('Popular Anime'),
          values: animeList.map(it => this._mapMultiToItem(it)).filter(Boolean),
        })
      );

      categories.push(
        new Category({
          name: this._getTranslation('Popular on Netflix'),
          values: netflixList.map(it => this._mapMultiToItem(it)).filter(Boolean),
        })
      );

      categories.push(
        new Category({
          name: this._getTranslation('Popular on Amazon'),
          values: amazonList.map(it => this._mapMultiToItem(it)).filter(Boolean),
        })
      );

      categories.push(
        new Category({
          name: this._getTranslation('Popular on Disney+'),
          values: disneyList.map(it => this._mapMultiToItem(it)).filter(Boolean),
        })
      );

      categories.push(
        new Category({
          name: this._getTranslation('Popular on Hulu'),
          values: huluList.map(it => this._mapMultiToItem(it)).filter(Boolean),
        })
      );

      categories.push(
        new Category({
          name: this._getTranslation('Popular on Apple TV+'),
          values: appleList.map(it => this._mapMultiToItem(it)).filter(Boolean),
        })
      );

      categories.push(
        new Category({
          name: this._getTranslation('Popular on HBO'),
          values: hboList.map(it => this._mapMultiToItem(it)).filter(Boolean),
        })
      );

      return { categories };
    } catch (e) {
      defaultErrorHandlers(e);
      return { categories: [] };
    }
  }

  /**
   * Get movie details by ID
   */
  static async getMovieDetails(id) {
    try {
      const res = await this._tmdbGet(`/movie/${id}`, { append_to_response: 'recommendations' });

      if (!Object.keys(settings.getAllMovieGenres()).length) await this._fetchAndMapGenres();

      const target = new Movie({
        id: res.id,
        title: res.title,
        poster: this._buildImage(res.poster_path),
        cover: this._buildImage(res.poster_path),
        banner: this._buildImage(res.backdrop_path),
        rating: res.vote_average,
        slug: this._makeSlug(res.title || res.original_title),
        isUpdated: false,
        type: 'movie',
        quality: '',
        overview: res.overview,
        genres: res.genres ? res.genres.map(g => ({ id: g.id, name: g.name })) : [],
        released: res.release_date,
        tmdb_id: res.id,
        runtime: res.runtime,
        status: res.status,
      });

      if (res.recommendations && res.recommendations.results) {
        res.recommendations.results.forEach(it => {
          target.addToRecommendations(new Movie({
            id: it.id,
            title: it.title || it.name,
            poster: this._buildImage(it.poster_path),
            cover: this._buildImage(it.poster_path),
            banner: this._buildImage(it.backdrop_path),
            rating: it.vote_average,
            slug: this._makeSlug(it.title || it.original_title || it.name),
            isUpdated: false,
            type: 'movie',
          }));
        });
      }

      return target;
    } catch (e) {
      defaultErrorHandlers(e);
    }
  }

  /**
   * Get TV show details by ID
   */
  static async getTvShowDetails(id) {
    try {
      const res = await this._tmdbGet(`/tv/${id}`, { append_to_response: 'credits,recommendations,videos,external_ids' });

      if (!Object.keys(settings.getAllTvShowGenres()).length) await this._fetchAndMapGenres();

      const target = new TvShow({
        id: res.id,
        title: res.name,
        poster: this._buildImage(res.poster_path),
        cover: this._buildImage(res.poster_path),
        banner: this._buildImage(res.backdrop_path),
        rating: res.vote_average,
        slug: this._makeSlug(res.name || res.original_name),
        isUpdated: false,
        type: 'tv',
        quality: '',
        overview: res.overview,
        genres: res.genres ? res.genres.map(g => ({ id: g.id, name: g.name })) : [],
        released: res.first_air_date,
        tmdb_id: res.id,
        runtime: res.episode_run_time && res.episode_run_time.length ? res.episode_run_time[0] : 0,
        status: res.status,
        trailer: (() => {
          try {
            if (res.videos && res.videos.results && res.videos.results.length) {
              const you = res.videos.results.find(v => v.site && v.site.toLowerCase().includes('youtube')) || res.videos.results[0];
              if (you && you.key) return `https://www.youtube.com/watch?v=${you.key}`;
            }
          } catch (e) {}
          return undefined;
        })(),
        imdb_id: res.external_ids && res.external_ids.imdb_id ? res.external_ids.imdb_id : undefined,
        cast: res.credits && res.credits.cast ? (res.credits.cast.slice(0, 15).map(c => new People({ id: c.id ? c.id.toString() : '', name: c.name, image: c.profile_path ? this._buildImage(c.profile_path, 'w500') : '' }))) : [],
      });

      if (res.seasons && res.seasons.length) {
        res.seasons.forEach(season => {
          target.addToSeasons(new Season({
            id: `${res.id}-${season.season_number}`,
            number: season.season_number,
            title: season.name,
            plot: season.overview,
            release_date: season.air_date,
            created_at: '',
            updated_at: '',
            episodes_count: season.episode_count,
            isUpdated: false,
          }));
        });
      }

      if (res.recommendations && res.recommendations.results) {
        res.recommendations.results.forEach(it => {
          target.addToRecommendations(new TvShow({
            id: it.id,
            title: it.name || it.title,
            poster: this._buildImage(it.poster_path),
            cover: this._buildImage(it.poster_path),
            banner: this._buildImage(it.backdrop_path),
            rating: it.vote_average,
            slug: this._makeSlug(it.name || it.original_name || it.title),
            isUpdated: false,
            type: 'tv',
          }));
        });
      }

      return target;
    } catch (e) {
      defaultErrorHandlers(e);
    }
  }

  /**
   * Get season details and populate episodes
   */
  static async getSeasonDetails(seasonNumber, tvShow) {
    try {
      if (!tvShow || !tvShow.tmdb_id) return;
      const res = await this._tmdbGet(`/tv/${tvShow.tmdb_id}/season/${seasonNumber}`, { language: this._language });

      const season = tvShow.getSeasonById(seasonNumber);
      if (!season) return;

      if ((!season.episodes || !season.episodes.length) && season.episodes_count > 0) {
        (res.episodes || []).forEach(ep => {
          season.addEpisode(new Episode({
            id: ep.id || ep.episode_number,
            number: ep.episode_number,
            title: ep.name,
            overview: ep.overview,
            poster: this._buildImage(ep.still_path),
            runtime: ep.runtime || 0,
            created_at: '',
            updated_at: '',
          }));
        });
      }
    } catch (e) {
      defaultErrorHandlers(e);
    }
  }

  /**
   * Search for movies and TV shows
   */
  static async searchMovieAndTvShow(query, page = 1) {
    try {
      if (!query || query.trim() === '') return { searchResults: { moviesFounded: [], tvshowFounded: [] } };

      const res = await this._tmdbGet('/search/multi', { query, page });

      const moviesFounded = [];
      const tvshowFounded = [];

      (res.results || []).forEach(it => {
        if (it.media_type === 'movie') {
          moviesFounded.push(new Movie({
            id: it.id,
            title: it.title || it.original_title,
            poster: this._buildImage(it.poster_path),
            cover: this._buildImage(it.poster_path),
            banner: this._buildImage(it.backdrop_path),
            isSubIta: false,
            slug: this._makeSlug(it.title || it.original_title || it.name),
            isUpdated: false,
            type: 'movie',
          }));
        } else if (it.media_type === 'tv') {
          tvshowFounded.push(new TvShow({
            id: it.id,
            title: it.name || it.original_name,
            poster: this._buildImage(it.poster_path),
            cover: this._buildImage(it.poster_path),
            banner: this._buildImage(it.backdrop_path),
            isSubIta: false,
            slug: this._makeSlug(it.name || it.original_name || it.title),
            isUpdated: false,
            type: 'tv',
          }));
        }
      });

      return { searchResults: { moviesFounded, tvshowFounded } };
    } catch (e) {
      defaultErrorHandlers(e);
      return { searchResults: { moviesFounded: [], tvshowFounded: [] } };
    }
  }

  /**
   * Get genre movies with pagination
   */
  static async getGenreMovies(offset = 0, genreService = undefined, genreSlug = undefined) {
    try {
      const page = Math.floor(offset / 20) + 1;
      const res = await this._tmdbGet('/discover/movie', { page, with_genres: genreSlug });

      const movies = (res.results || []).map(it => new Movie({
        id: it.id,
        title: it.title,
        poster: this._buildImage(it.poster_path),
        cover: this._buildImage(it.poster_path),
        banner: this._buildImage(it.backdrop_path),
        rating: it.vote_average,
        slug: this._makeSlug(it.title || it.original_title),
        isUpdated: false,
        type: 'movie',
      }));

      return { movies };
    } catch (e) {
      defaultErrorHandlers(e);
      return { movies: [] };
    }
  }

  /**
   * Search/list genres and content
   */
  static async search(query, page = 1) {
    try {
      if (!query || query.trim() === '') {
        const [movieGenresRes, tvGenresRes] = await Promise.all([
          this._tmdbGet('/genre/movie/list'),
          this._tmdbGet('/genre/tv/list'),
        ]);

        const combined = {};
        (movieGenresRes.genres || []).forEach(g => (combined[g.id] = { id: g.id.toString(), name: g.name }));
        (tvGenresRes.genres || []).forEach(g => (combined[g.id] = { id: g.id.toString(), name: g.name }));

        return Object.values(combined).map(g => ({ id: g.id, name: g.name }));
      }

      const res = await this._tmdbGet('/search/multi', { query, page });
      return (res.results || []).map(multi => {
        if (multi.media_type === 'movie') {
          return new Movie({
            id: multi.id,
            title: multi.title,
            overview: multi.overview,
            released: multi.release_date,
            rating: multi.vote_average,
            poster: this._buildImage(multi.poster_path),
            banner: this._buildImage(multi.backdrop_path),
            slug: this._makeSlug(multi.title || multi.original_title),
          });
        }

        if (multi.media_type === 'tv') {
          return new TvShow({
            id: multi.id,
            title: multi.name,
            overview: multi.overview,
            released: multi.first_air_date,
            rating: multi.vote_average,
            poster: this._buildImage(multi.poster_path),
            banner: this._buildImage(multi.backdrop_path),
            slug: this._makeSlug(multi.name || multi.original_name),
          });
        }

        return null;
      }).filter(Boolean);
    } catch (e) {
      defaultErrorHandlers(e);
      return [];
    }
  }

  /**
   * Get popular movies
   */
  static async getMovies(page = 1) {
    try {
      const res = await this._tmdbGet('/movie/popular', { page });
      return (res.results || []).map(m => new Movie({
        id: m.id,
        title: m.title,
        overview: m.overview,
        released: m.release_date,
        rating: m.vote_average,
        poster: this._buildImage(m.poster_path),
        banner: this._buildImage(m.backdrop_path),
        slug: this._makeSlug(m.title || m.original_title),
      }));
    } catch (e) {
      defaultErrorHandlers(e);
      return [];
    }
  }

  /**
   * Get popular TV shows
   */
  static async getTvShows(page = 1) {
    try {
      const res = await this._tmdbGet('/tv/popular', { page });
      return (res.results || []).map(t => new TvShow({
        id: t.id,
        title: t.name,
        overview: t.overview,
        released: t.first_air_date,
        rating: t.vote_average,
        poster: this._buildImage(t.poster_path),
        banner: this._buildImage(t.backdrop_path),
        slug: this._makeSlug(t.name || t.original_name),
      }));
    } catch (e) {
      defaultErrorHandlers(e);
      return [];
    }
  }

  /**
   * Alias for getMovieDetails
   */
  static async getMovie(id) {
    return this.getMovieDetails(id);
  }

  /**
   * Alias for getTvShowDetails
   */
  static async getTvShow(id) {
    return this.getTvShowDetails(id);
  }

  /**
   * Get episodes by season ID (format: "tvId-seasonNumber")
   */
  static async getEpisodesBySeason(seasonId) {
    try {
      const parts = String(seasonId).split('-');
      if (parts.length < 2) return [];
      const tvId = parts[0];
      const seasonNumber = parts[1];

      const res = await this._tmdbGet(`/tv/${tvId}/season/${seasonNumber}`);
      return (res.episodes || []).map(ep => ({
        id: ep.id ? ep.id.toString() : `${tvId}-${seasonNumber}-${ep.episode_number}`,
        number: ep.episode_number,
        title: ep.name || '',
        released: ep.air_date,
        poster: this._buildImage(ep.still_path),
      }));
    } catch (e) {
      defaultErrorHandlers(e);
      return [];
    }
  }

  /**
   * Get movies/shows by genre
   */
  static async getGenre(id, page = 1) {
    try {
      const moviesRes = await this._tmdbGet('/discover/movie', { page, with_genres: id });
      const tvRes = await this._tmdbGet('/discover/tv', { page, with_genres: id });

      const shows = [];
      (moviesRes.results || []).forEach(m => shows.push(new Movie({
        id: m.id,
        title: m.title,
        overview: m.overview,
        released: m.release_date,
        rating: m.vote_average,
        poster: this._buildImage(m.poster_path),
        banner: this._buildImage(m.backdrop_path),
        slug: this._makeSlug(m.title || m.original_title),
      })));
      (tvRes.results || []).forEach(t => shows.push(new TvShow({
        id: t.id,
        title: t.name,
        overview: t.overview,
        released: t.first_air_date,
        rating: t.vote_average,
        poster: this._buildImage(t.poster_path),
        banner: this._buildImage(t.backdrop_path),
        slug: this._makeSlug(t.name || t.original_name),
      })));

      return { id: id.toString(), name: '', shows };
    } catch (e) {
      defaultErrorHandlers(e);
      return { id: id.toString(), name: '', shows: [] };
    }
  }

  /**
   * Get person details and filmography
   */
  static async getPeople(id, page = 1) {
    try {
      const append = page > 1 ? '' : 'combined_credits';
      const res = await this._tmdbGet(`/person/${id}`, { append_to_response: append });
      const filmography = (res.combined_credits && res.combined_credits.cast ? res.combined_credits.cast : [])
        .map(multi => {
          if (multi.media_type === 'movie') {
            return new Movie({
              id: multi.id,
              title: multi.title,
              overview: multi.overview,
              released: multi.release_date,
              rating: multi.vote_average,
              poster: this._buildImage(multi.poster_path),
              banner: this._buildImage(multi.backdrop_path),
              slug: this._makeSlug(multi.title || multi.original_title),
            });
          }

          if (multi.media_type === 'tv') {
            return new TvShow({
              id: multi.id,
              title: multi.name,
              overview: multi.overview,
              released: multi.first_air_date,
              rating: multi.vote_average,
              poster: this._buildImage(multi.poster_path),
              banner: this._buildImage(multi.backdrop_path),
              slug: this._makeSlug(multi.name || multi.original_name),
            });
          }

          return null;
        }).filter(Boolean);

      return new People({
        id: res.id ? res.id.toString() : id,
        name: res.name,
        image: res.profile_path ? this._buildImage(res.profile_path, 'w500') : '',
        biography: res.biography,
        placeOfBirth: res.place_of_birth,
        birthday: res.birthday,
        deathday: res.deathday,
        filmography,
      });
    } catch (e) {
      defaultErrorHandlers(e);
      return null;
    }
  }

  /**
   * Export image helper
   */
  static getImageLink(path, size = 'w500') {
    return this._buildImage(path, size);
  }
}

export default TMDB;

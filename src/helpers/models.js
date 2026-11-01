export class Category {
    constructor({ name, values, shows }) {
        this.name = name;
        this.values = values;
        this.shows = shows;
    }
}

export class Movie{
    /**
     * @type {Movie[]}
     */
    recommendations = [];
    /**
     * 
     * @param {{id: number, 
     * title: string, 
     * overview: string, 
     * released: string, 
     * rating: string, 
     * poster: string, 
     * genres: Genre[],
     * recommendations: Movie[], 
     * banner: string,
     * slug: string,
     * isUpdated: boolean,
     * quality: string,
     * type: "movie" | "tv"
     * cover: string
     * tmdb_id: number
     * runtime: number
     * status: string
     * isSubIta: boolean
     * }} param0 
     */
    constructor({ id, title, overview, released, rating, poster, genres, cast, trailer, recommendations, banner, slug, isUpdated, updateType, quality, type, cover, tmdb_id, runtime, status, isSubIta }) {
        this.sid = id;
        this.title = title;
        this.overview = overview;
        this.released = released ? new Date(released).getFullYear().toString() : "";
        this.rating = parseInt(rating) || 10;
        this.poster = poster;
        this.genres = genres || [];
        this.cast = cast;
        this.trailer = trailer;
        this.recommendations = recommendations || [];
        this.banner = banner;
        this.slug = slug;
        this.isUpdated = isUpdated;
        this.updateType = isUpdated ? "Aggiornato": updateType;
        this.quality = quality || "HD";
        this.type = type;
        this.cover = cover;
        this.tmdb_id = tmdb_id || id;
        this.runtime = runtime;
        this.status = status;
        this.isSubIta = isSubIta;
        this.collection = null;
    }

    /**
     * 
     * @param {Movie} movie 
     */
    addToRecommendations(movie) {
        this.recommendations.push(movie);
    }

    /**
     * 
     * @param {Movie} movie 
     */
    addToCollection(movie) {
        if (!this.collection){
            this.collection = []
        }
        this.collection.push(movie);
    }
}

export class TvShow {
        /**
         * @type {TvShow[]}
         */
        recommendations = [];
        /**
         * @type {Season[]}
         */
        seasons = [];
        /**
         * 
         * @param {{id: number, 
         * title: string, 
         * overview: string, 
         * released: string, 
         * rating: string, 
         * poster: string, 
         * genres: Genre[],
         * recommendations: TvShow[], 
         * banner: string,
         * slug: string,
         * isUpdated: boolean,
         * quality: string,
         * type: "movie" | "tv"
         * cover: string
         * tmdb_id: number
         * runtime: number
         * status: string
         * isSubIta: boolean
         * }} param0 
         */
    constructor({ id, title, overview, released, rating, poster, genres, cast, trailer, recommendations, banner, slug, isUpdated, updateType, quality, type, cover, tmdb_id, runtime, status, isSubIta }) {
        this.sid = id;
        this.title = title;
        this.overview = overview;
        this.released = released ? new Date(released).getFullYear().toString() : "";
        this.rating = parseInt(rating) || 10;
        this.poster = poster;
        this.genres = genres || [];
        this.cast = cast;
        this.trailer = trailer;
        this.recommendations = recommendations || [];
        this.banner = banner;
        this.slug = slug;
        this.isUpdated = isUpdated;
        this.updateType = isUpdated ? "Nuovi Episodi": updateType;
        this.quality = quality || "HD";
        this.type = type === "tv" ? "tvshow" : type;
        this.cover = cover;
        this.tmdb_id = tmdb_id || id;
        this.runtime = runtime || 0;
        this.status = status;
        this.seasons = [];
        this.isSubIta = isSubIta;
    }

    /**
     * 
     * @param {TvShow} tvshow 
     */
    addToRecommendations(tvshow) {
        this.recommendations.push(tvshow);
    }

    /**
     * 
     * @param {Season} season 
     */
    addToSeasons(season) {
        this.seasons.push(season);
    }

    getSeasonById(seasonId) {
        return this.seasons.find(s => s.number === seasonId);
    }
}

export class Genre {
    constructor({ id, name, type }) {
        this.id = id;
        this.name = name;
        this.type = type;
    }
}

export class People {
    /**
     * @param {{id: string, name: string, image?: string, biography?: string, placeOfBirth?: string, birthday?: string, deathday?: string, filmography?: Array}} param0
     */
    constructor({ id, name, image, biography, placeOfBirth, birthday, deathday, filmography }) {
        this.id = id;
        this.name = name;
        this.image = image || '';
        this.biography = biography || '';
        this.placeOfBirth = placeOfBirth || '';
        this.birthday = birthday || '';
        this.deathday = deathday || '';
        this.filmography = filmography || [];
    }
}

export class Service {
    /**
     * 
     * @param {{id: string, name: string}} param0 
     */
    constructor({ id, name }) {
        this.id = id;
        this.name = name;
    }
}

export class Season {
    /**
     * @type {Episode[]}
     */
    episodes = [];

    /**
     * @param {{
     *   id: number,
     *   number: number,
     *   title?: string,
     *   name?: string,
     *   plot?: string,
     *   release_date?: string,
     *   title_id?: number,
     *   created_at?: string,
     *   updated_at?: string,
     *   episodes_count?: number,
     *   isUpdated?: boolean,
     *   episodes?: Episode[]
     *   poster?: string
     * }} param0
     */
    constructor({ id, number, title, name, plot, release_date, title_id, created_at, updated_at, episodes_count, isUpdated, episodes, poster }) {
        this.id = id;
        this.number = number;
        this.title = title || name || "";
        this.plot = plot || "";
        this.released = release_date || "";
        this.title_id = title_id || null;
        this.created_at = created_at || "";
        this.updated_at = updated_at || "";
        this.episodes_count = episodes_count || (episodes ? episodes.length : 0);
        this.episodes = (episodes || []).map(e => new Episode(e));
        this.type = "season";
        this.isUpdated = isUpdated || false;
        this.poster = poster || "";
    }

    /**
     * Aggiunge un episodio alla stagione.
     * @param {Episode} episode
     */
    addEpisode(episode) {
        this.episodes.push(episode);
        this.episodes_count = this.episodes.length;
    }
}

export class Episode {
    /**
     * @param {{
     *   id: number,
     *   number: number,
     *   title?: string,
     *   overview?: string,
     *   poster?: string,
     *   runtime?: number,
     *   created_at?: string,
     *   updated_at?: string
     * }} param0
     */
    constructor({ id, number, title, overview, poster, runtime, created_at, updated_at }) {
        this.id = id;
        this.number = number;
        this.title = title || "";
        this.overview = overview || "";
        this.poster = poster || "";
        this.runtime = runtime || 0;
        this.created_at = created_at || null;
        this.updated_at = updated_at || null;
    }
}
/**
 * Serie anime da AnimeUnity.
 * Rispecchia TvShow ma normalizza i campi che arrivano dal provider:
 * AnimeUnity espone id + slug separati (id usato nella route),
 * imageurl come poster verticale e imageurl_cover come banner orizzontale.
 */
export class Anime {
    /**
     * @param {{
     *   id: number|string,
     *   slug?: string,
     *   title?: string,
     *   title_eng?: string,
     *   plot?: string,
     *   imageurl?: string,
     *   cover?: string,
     *   imageurl_cover?: string,
     *   score?: number|string,
     *   date?: string,
     *   type?: string,
     *   episodes_count?: number,
     *   genres?: Genre[],
     *   recommendations?: Anime[]
     * }} param0
     */
    constructor({ id, slug, title, title_eng, plot, imageurl, cover, imageurl_cover, score, date, type, episodes_count, genres, recommendations }) {
        const cleanTitle = title_eng || title || "";
        const animeType = type || "TV";

        this.id = slug ? `${id}-${slug}` : String(id);
        this.sid = this.id;
        this.slug = slug || String(id);
        this.title = cleanTitle;
        this.overview = plot || "";
        this.released = date ? new Date(date).getFullYear().toString() : "";
        this.rating = parseInt(score) || 10;

        // Poster verticale; cover come fallback. Mai imageurl_cover (banner).
        this.poster = imageurl || cover || "";
        this.cover = cover || imageurl || "";
        this.banner = imageurl_cover || "";

        this.genres = genres || [];
        this.recommendations = recommendations || [];
        this.episodes_count = parseInt(episodes_count) || 0;
        this.isMovie = animeType === "Movie";
        this.quality = "HD";
        this.type = "animeSeries";
        this.seasons = [];
    }

    /**
     * @param {AnimeSeason} season
     */
    addToSeasons(season) {
        this.seasons.push(season);
    }

    getSeasonById(seasonNumber) {
        return this.seasons.find(s => s.number === seasonNumber);
    }
}

/**
 * Blocco di episodi di una serie anime.
 * Replica Season: stessa forma, cosi' la lista episodi puo' usare
 * lo stesso template della controparte serie TV.
 */
export class AnimeSeason {
    /**
     * @type {Episode[]}
     */
    episodes = [];

    /**
     * @param {{
     *   id?: string,
     *   number: number,
     *   title?: string,
     *   episodes?: Episode[],
     *   poster?: string,
     *   animeId?: string,
     *   animeTitle?: string,
     *   animeBanner?: string
     * }} param0
     */
    constructor({ id, number, title, episodes, poster, animeId, animeTitle, animeBanner }) {
        this.id = id || `${animeId || "anime"}-${number}`;
        this.number = number;
        this.title = title || "";
        this.plot = "";
        this.episodes_count = episodes ? episodes.length : 0;
        this.episodes = (episodes || []).map(e => (e instanceof Episode ? e : new Episode(e)));
        this.type = "animeSeason";
        this.isUpdated = false;
        this.poster = poster || "";
        this.animeId = animeId || "";
        this.animeTitle = animeTitle || "";
        this.animeBanner = animeBanner || "";
    }

    /**
     * @param {Episode} episode
     */
    addEpisode(episode) {
        this.episodes.push(episode);
        this.episodes_count = this.episodes.length;
    }
}

/**
 * Divide gli episodi in blocchi, come fa la controparte Kotlin
 * (AnimeUnityProvider.kt:1160, CalculateEpisodeRanges).
 *
 * @param {Episode[]} episodes
 * @param {Object} meta { animeId, animeTitle, animeBanner, poster }
 * @param {number} perSeason
 * @returns {AnimeSeason[]}
 */
export function buildAnimeSeasons(episodes, meta = {}, perSeason = 120) {
    if (!episodes || !episodes.length) return [];

    // Sotto il limite non serve spezzare: un unico blocco.
    if (episodes.length <= perSeason) {
        return [new AnimeSeason({
            number: 1,
            title: meta.seasonTitle || "",
            episodes,
            poster: meta.poster,
            animeId: meta.animeId,
            animeTitle: meta.animeTitle,
            animeBanner: meta.animeBanner,
        })];
    }

    const seasons = [];

    for (let start = 0; start < episodes.length; start += perSeason) {
        const chunk = episodes.slice(start, start + perSeason);
        const from = chunk[0].number;
        const to = chunk[chunk.length - 1].number;

        seasons.push(new AnimeSeason({
            number: seasons.length + 1,
            title: `Episodi ${from}-${to}`,
            episodes: chunk,
            poster: meta.poster,
            animeId: meta.animeId,
            animeTitle: meta.animeTitle,
            animeBanner: meta.animeBanner,
        }));
    }

    return seasons;
}

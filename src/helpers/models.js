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
     * }} param0 
     */
    constructor({ id, title, overview, released, rating, poster, genres, cast, trailer, recommendations, banner, slug, isUpdated, updateType, quality, type, cover, tmdb_id, runtime, status }) {
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
        this.quality = quality;
        this.type = type;
        this.cover = cover;
        this.tmdb_id = tmdb_id;
        this.runtime = runtime;
        this.status = status;
    }

    /**
     * 
     * @param {Movie} movie 
     */
    addToRecommendations(movie) {
        this.recommendations.push(movie);
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
         * }} param0 
         */
    constructor({ id, title, overview, released, rating, poster, genres, cast, trailer, recommendations, banner, slug, isUpdated, updateType, quality, type, cover, tmdb_id, runtime, status }) {
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
        this.quality = quality;
        this.type = type === "tv" ? "tvshow" : type;
        this.cover = cover;
        this.tmdb_id = tmdb_id;
        this.runtime = runtime || 0;
        this.status = status;
        this.seasons = [];
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
    constructor({ id, name, filmography }) {
        this.id = id;
        this.name = name;
        this.filmography = filmography;
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
     *   episodes?: Episode[]
     * }} param0
     */
    constructor({ id, number, title, name, plot, release_date, title_id, created_at, updated_at, episodes_count, episodes }) {
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

export class Video {
    constructor({ id, src, server }) {
        this.id = id;
        this.src = src;
        this.server = server;
    }
}

// Types
Video.Server = class {
    constructor({ id, name, src }) {
        this.id = id;
        this.name = name;
        this.src = src;
    }
};
Video.Type = {
    Movie: 'Movie',
    Episode: 'Episode'
};
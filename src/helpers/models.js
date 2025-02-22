export class Category {
    constructor({ name, list, shows }) {
        this.name = name;
        this.list = list;
        this.shows = shows;
    }
}

export class Movie {
    constructor({ id, title, overview, released, rating, poster, genres, cast, trailer, recommendations, banner, slug, isUpdated, updateType, quality, type }) {
        this.sid = id;
        this.title = title;
        this.overview = overview;
        this.released = released;
        this.rating = rating;
        this.poster = poster;
        this.genres = genres;
        this.cast = cast;
        this.trailer = trailer;
        this.recommendations = recommendations;
        this.banner = banner;
        this.slug = slug;
        this.isUpdated = isUpdated;
        this.updateType = updateType;
        this.quality = quality;
        this.type = type;
    }
}

export class TvShow {
    constructor({ id, title, overview, released, rating, poster, genres, cast, trailer, recommendations, seasons, banner, slug, isUpdated, updateType, quality, type }) {
        this.sid = id;
        this.title = title;
        this.overview = overview;
        this.released = released;
        this.rating = rating;
        this.poster = poster;
        this.genres = genres;
        this.cast = cast;
        this.trailer = trailer;
        this.recommendations = recommendations;
        this.seasons = seasons;
        this.banner = banner;
        this.slug = slug;
        this.isUpdated = isUpdated;
        this.updateType = updateType;
        this.quality = quality;
        this.type = type;
    }
}

export class Genre {
    constructor({ id, name, shows }) {
        this.id = id;
        this.name = name;
        this.shows = shows;
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
    constructor({ id, number, title }) {
        this.id = id;
        this.number = number;
        this.title = title;
    }
}

export class Episode {
    constructor({ id, number, title, poster }) {
        this.id = id;
        this.number = number;
        this.title = title;
        this.poster = poster;
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
import { defaultErrorHandlers } from '../helpers/auth/handlers';
import { Category, Movie, TvShow, Episode, Genre, People, Video, Season } from '../helpers/models';
import * as request from '../request';
import * as settings from '../settings';
import { isMoreThanDaysAhead } from '../utils';

/* VixcloudExtractor mimics the extraction behavior */

function addHeaders(dict) {
    return XHR => {
      Object.keys(dict).forEach(key => XHR.setRequestHeader(key, dict[key]));
      return XHR;
    };
}

class StreamingCommunityService {
    url = ""
    constructor(url) {
        this.url = url;
    }

    buildUrl(path) {
        return this.url + path;
    }

    headers(version = '') {
        const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.2 Safari/605.1.15";
      
        let headers = {
          'User-Agent': userAgent,
          'Host': DOMAIN,
          'Origin': this.url,
          'X-Requested-With': "XMLHttpRequest",
          'Accept': 'application/json',
          "x-inertia": "true",
          "x-inertia-version": version,
        };
      
        return headers;
      }

    // GET "/" returning Document equivalent
    async getHomeDocument() {
        try {
            let response = await request.get(this.buildUrl("/")).then(request.toString());
            return response;
        } catch (error) {
           defaultErrorHandlers(error); 
        }
    }
    // GET "/" with inertia headers returning HomeRes (JSON)
    async getHome(version) {
        try {
            let response = await request.get(this.buildUrl("/"), {
                prepare: addHeaders({
                    "x-inertia": "true",
                    "x-inertia-version": version,
                })
            }).then(request.toJSON());
            return response; 
        } catch (error) {
            defaultErrorHandlers(error); 
        }
    }

    async search(keyword, version, offset = 0) {
        try {
            let response = await request.get(this.buildUrl("/api/search?q=" + encodeURIComponent(keyword)), {
                prepare: addHeaders(this.headers(version))
            }).then(request.toJSON());
            return response;
        } catch (error) {
            defaultErrorHandlers(error); 
        }
    }

    async getMovies(version) {
        try {
            let response = await request.get(this.buildUrl("/film"), {
                prepare: addHeaders(this.headers(version))
            }).then(request.toJSON());
            return response;
        } catch (error) {
            defaultErrorHandlers(error); 
        }
    }

    async getTvSeries(version) {
        try {
            let response = await request.get(this.buildUrl("/serie-tv"), {
                prepare: addHeaders({
                    "x-inertia": "true",
                    "x-inertia-version": version,
                })
            }).then(request.toJSON());
            return response;
        } catch (error) {
            defaultErrorHandlers(error); 
        }
    }

    async getDetails(id, slug, version) {
        try {
            let response = await request.get(this.buildUrl("/it/titles/" + id + "-" + slug), {
                prepare: addHeaders(this.headers(version))
            }).then(request.toJSON());
            return response;
        } catch (error) {
            defaultErrorHandlers(error); 
        }
    }

    async getSeasonDetails(id, slug, seasonId,  version) {
        try {
            let response = await request.get(this.buildUrl("/it/titles/" + id + "-" + slug + "/season-" + seasonId), {
                prepare: addHeaders(this.headers(version))
            }).then(request.toJSON());
            return response;
        } catch (error) {
            defaultErrorHandlers(error); 
        }
    }
    async getGenre(type, version, offset = 0, service = null, genreId = null) {
        try {
            const url = this.buildUrl("/api/archive?type=" + encodeURIComponent(type) + "&offset=" + offset + (service ? "&service=" + encodeURIComponent(service) : "") + (genreId ? "&genre[]=" + encodeURIComponent(genreId) : ""));
            let response = await request.get(url, {
                prepare: addHeaders(this.headers(version))
            }).then(request.toJSON());
            return response;
        } catch (error) {
            defaultErrorHandlers(error); 
        }
    }
}

const DOMAIN =  "streamingunity.co";
const URL = "https://" + DOMAIN;
export const MAX_SEARCH_RESULTS = 60;
const language = "it";
const IMAGEKIT_URL = "https://ik.imagekit.io/itaflix/webp/"
let _version = ""

const service =  new StreamingCommunityService(URL);

function getImageLink(filename, gradient = false) {
    if (!filename) return null;
    return IMAGEKIT_URL + "https://cdn." + DOMAIN + "/images/" + filename + (gradient ? "?tr=fo-auto,e-gradient-ld-280_from-FFFFFF00_to-black_sp-iw_div_0.4" : "");
}

function getFilenameFromImageLink(it, type) {
    let founded = it.images.find(img => img.type === type);
    if (founded) {
        return getImageLink(founded.filename, founded.type === "background");
    }

    return "";
}

function decodeHTMLEntities(text) {
    let map = {
        '&quot;': '"',  // HTML escaped double quote
        '&#x27;': "'",  // HTML escaped single quote
        '&lt;': '<', 
        '&gt;': '>',
        '&amp;': '&',
        '&#x2F;': '/',
        '&#39;': "'",
    };

    return text.replace(/&quot;|&#x27;|&lt;|&gt;|&amp;|&#x2F;|&#39;/g, match => map[match]).replace(/\\"/g, '"');
}

function extractVersionUsingRegex(str) {
    const regex = /"version":"([^"]+)"/;
    const match = str.match(regex);
    
    if (match && match[1]) {
        return match[1];  // Restituisce il valore catturato
    }
    
    return null;  // Se non trova una corrispondenza
}

async function _initVersion() {
    const htmlRes = await service.getHomeDocument();

    // Trova l'attributo `data-page` dentro il tag con id "app"
    let match = htmlRes.match(/id=["']app["'][^>]+data-page=["']([^"']+)["']/);

    if (match && match[1]) {
        try {
            let decoded = decodeHTMLEntities(match[1]);
            let index = decoded.lastIndexOf('"version":');
    
            if (index !== -1) {
                decoded = decoded.slice(index); // Ritorna la stringa dalla prima occorrenza trovata
            }
            _version = extractVersionUsingRegex(decoded);
        } catch (e) {
            defaultErrorHandlers(e);
        }
    }
    return _version;
}

/**
 * 
 * @param {Genre[]} genres 
 */
function mapGenres(genres) {
    let genresMovie = {};
    let genresTvShows = {};
    genres.forEach((data) => {
        switch (data.type) {
            case "movie":
                genresMovie[data.id] = new Genre(data);
                break;
            case "tv":
                genresTvShows[data.id] = new Genre(data);
                break;
                    
            default:
                genresTvShows[data.id] = new Genre(data);
                genresMovie[data.id] = new Genre(data);
                break;
        }
    });

    settings.set(settings.params.MOVIE_CATEGORIES, genresMovie);
    settings.set(settings.params.TV_SHOW_CATEGORIES, genresTvShows);
}

export async function getHome() {
    let categories = [];
    let res = await service.getHome(_version || await _initVersion());
    if (!res) return categories;

    if (_version !== res.version) _version = res.version;

    let topTen = null;
    let latest = null;
    let tranding = null;

    mapGenres(res.props.genres);

    res.props.sliders.forEach(({titles, label}, index) => {
        let isTopTen = index === 2;
        let current = new Category({
            name: label,
            values: titles.map(it => {
                if (it.type === "movie") {
                    return new Movie({
                        id: it.id,
                        title: isTopTen ? `${it.top10_index} - ${it.name}`: it.name,
                        poster: getFilenameFromImageLink(it, "poster"),
                        cover: getFilenameFromImageLink(it, "cover"),
                        banner: getFilenameFromImageLink(it, "background"),
                        rating: it.score,
                        slug: it.slug,
                        isUpdated: it.updated_at || it.last_air_date ? isMoreThanDaysAhead(it.updated_at || it.last_air_date) : false,
                        type: it.type
                    });
                } else {
                    return new TvShow({
                        id: it.id,
                        title: isTopTen ? `${it.top10_index} - ${it.name}`: it.name,
                        poster: getFilenameFromImageLink(it, "poster"),
                        cover: getFilenameFromImageLink(it, "cover"),
                        banner: getFilenameFromImageLink(it, "background"),
                        rating: it.score,
                        slug: it.slug,
                        isUpdated: it.updated_at || it.last_air_date ? isMoreThanDaysAhead(it.updated_at || it.last_air_date) : false,
                        type: "tvshow"
                    });
                }
            })
        })
        switch (index) {
            case 0:
                tranding = current;
                break;
            case 1:
                latest = current;
                break;
            case 2:
                topTen = current;
                break;
        }
    })

        return {
        topTen,
        latest,
        tranding
        }
}

export async function getMovieDetails(id, slug) {
    let res = await service.getDetails(id, slug, _version || await _initVersion());
    if (_version !== res.version) _version = res.version;
    let it = res.props.title;

    const target = new Movie({
        id: it.id,
        title: it.name,
        poster: getFilenameFromImageLink(it, "poster"),
        cover: getFilenameFromImageLink(it, "cover"),
        banner: getFilenameFromImageLink(it, "background"),
        rating: it.score,
        slug: it.slug,
        isUpdated: it.last_air_date ? isMoreThanDaysAhead(it.last_air_date) : true,
        type: it.type,
        quality: it.quality,
        overview: it.plot,
        genres: it.genres,
        released: it.release_date,
        tmdb_id: it.tmdb_id,
        runtime: it.runtime,
        status: it.status
    });

    // Map recommentations
    if (res.props.sliders && res.props.sliders.length) {
        res.props.sliders[0].titles.forEach(it => {
            if (it.type === "movie") {
                target.addToRecommendations(new Movie({
                    id: it.id,
                    slug: it.slug,
                    title: it.name,
                    rating: it.score,
                    poster: getFilenameFromImageLink(it, "poster"),
                    cover: getFilenameFromImageLink(it, "cover"),
                    banner: getFilenameFromImageLink(it, "background"),
                    isUpdated: it.last_air_date ? isMoreThanDaysAhead(it.last_air_date) : true,
                    type: it.type
                }));
            } 
        })
    }
    return target;
}

export async function getTvShowDetails(id, slug) {
    let res = await service.getDetails(id, slug, _version || await _initVersion());
    if (_version !== res.version) _version = res.version;
    let it = res.props.title;

    const target = new TvShow({
        id: it.id,
        title: it.name,
        poster: getFilenameFromImageLink(it, "poster"),
        cover: getFilenameFromImageLink(it, "cover"),
        banner: getFilenameFromImageLink(it, "background"),
        rating: it.score,
        slug: it.slug,
        isUpdated: it.updated_at || it.last_air_date ? isMoreThanDaysAhead(it.updated_at || it.last_air_date) : false,
        type: it.type,
        quality: it.quality,
        overview: it.plot,
        genres: it.genres,
        released: it.release_date,
        tmdb_id: it.tmdb_id,
        runtime: it.runtime,
        status: it.status
    });

    if (!target.runtime &&res.props.loadedSeason && res.props.loadedSeason.episodes && res.props.loadedSeason.episodes.length) {
        target.runtime = res.props.loadedSeason.episodes[0].duration;
    }

    if (it.seasons && it.seasons.length) {
        it.seasons.forEach(season => {
            target.addToSeasons(new Season({
                id: season.id,
                number: season.number,
                title: season.name,
                plot: season.plot,
                release_date: season.release_date,
                created_at: season.created_at,
                updated_at: season.updated_at,
                episodes_count: season.episodes_count,
                isUpdated: season.updated_at || season.last_air_date ? isMoreThanDaysAhead(season.updated_at || season.last_air_date) : false
            }));
        });
    }

    // Map recommentations
    if (res.props.sliders && res.props.sliders.length) {
        res.props.sliders[0].titles.forEach(it => {
            if (it.type === "tv") {
                target.addToRecommendations(new TvShow({
                    id: it.id,
                    slug: it.slug,
                    title: it.name,
                    rating: it.score,
                    poster: getFilenameFromImageLink(it, "poster"),
                    cover: getFilenameFromImageLink(it, "cover"),
                    banner: getFilenameFromImageLink(it, "background"),
                    isUpdated: it.updated_at || it.last_air_date ? isMoreThanDaysAhead(it.updated_at || it.last_air_date) : false,
                    type: it.type
                }));
            } 
        })
    }
    return target;
}

/**
 * Popolate the episodes for the given season if not already done inside the TvShow
 * @param {number} seasonId 
 * @param {TvShow} tvShow 
 */
export async function getSeasonDetails(seasonId, tvShow) {
    const season = tvShow.getSeasonById(seasonId);
    if (!season) return;

    if ((!season.episodes || !season.episodes.length) && season.episodes_count > 0) {
        const seasonData = await service.getSeasonDetails(tvShow.sid, tvShow.slug, seasonId, _version || await _initVersion());
        if (_version !== seasonData.version) _version = seasonData.version;

        seasonData.props.loadedSeason.episodes.forEach(episode => {  
            season.addEpisode(new Episode({
                id: episode.id,
                number: episode.number,
                title: episode.name,
                overview: episode.plot,
                poster: getFilenameFromImageLink(episode, "cover"),
                runtime: episode.duration,
                created_at: episode.created_at,
                updated_at: episode.updated_at
            }));
        });
    }
}

export async function searchMovieAndTvShow(query, page) {
    let moviesFounded = [];
    let tvshowFounded = [];
    if (query === "") {
        return {
            searchResults: {
                moviesFounded,
                tvshowFounded
            }
        };
    }

    let res = await service.search(query, _version || await _initVersion());
    if (res.currentPage === null) {
        return {
            searchResults: {
                moviesFounded,
                tvshowFounded
            }
        };
    }

    res.data.map(it => {
        const poster = getFilenameFromImageLink(it, "poster");
        const cover = getFilenameFromImageLink(it, "cover");
        const banner = getFilenameFromImageLink(it, "background");
        if (it.type === "movie") {
            moviesFounded.push(new Movie({
               id: it.id,
                title: it.name,
                poster: poster,
                cover: cover,
                banner: banner,
                isSubIta: Boolean(it.sub_ita),
                slug: it.slug,
                isUpdated: it.updated_at || it.last_air_date ? isMoreThanDaysAhead(it.updated_at || it.last_air_date) : false,
                type: it.type
            }));
        } else {
            tvshowFounded.push(new TvShow({
                id: it.id,
                title: it.name,
                poster: poster,
                cover: cover,
                banner: banner,
                isSubIta: Boolean(it.sub_ita),
                slug: it.slug,
                isUpdated: it.updated_at || it.last_air_date ? isMoreThanDaysAhead(it.updated_at || it.last_air_date) : false,
                type: "tvshow"
            }));
        }
    });

     return {
      searchResults: {
        moviesFounded,
        tvshowFounded
      }
    };
}

export async function getGenreMovies(offset = 0, genreService = undefined, genreSlug = undefined) {
    let movies = [];
    let res = await service.getGenre("movie", _version || await _initVersion(), offset, genreService, genreSlug);
    if (!res) return {movies};

    if (_version !== res.version) _version = res.version;

    res.titles.forEach(it => {
        movies.push(new Movie({
            id: it.id,
            title: it.name,
            poster: getFilenameFromImageLink(it, "poster"),
            cover: getFilenameFromImageLink(it, "cover"),
            banner: getFilenameFromImageLink(it, "background"),
            rating: it.score,
            slug: it.slug,
            isUpdated: it.updated_at || it.last_air_date ? isMoreThanDaysAhead(it.updated_at || it.last_air_date) : false,
            type: it.type
        }));
    });

    return {
        movies
    };
}


  

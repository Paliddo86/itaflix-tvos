import { defaultErrorHandlers } from '../helpers/auth/handlers';
import { Category, Movie, TvShow, Episode, Genre, People, Video, Season } from '../helpers/models';
import * as request from '../request';
import { get as i18n } from '../localization';
import * as settings from '../settings';

/* VixcloudExtractor mimics the extraction behavior */
class VixcloudExtractor {
    async extract(src) {
        // Here we simulate video extraction. In a full implementation,
        // this method would fetch and parse the video source.
        return new Video({
            id: src,
            src: src,
            server: new Video.Server({ id: src, name: "Vixcloud", src: src })
        });
    }
}

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

    async search(keyword, offset = 0) {
        try {
            let response = await request.get(this.buildUrl("/api/search"), {
                params: {
                    q: keyword,
                    offset: offset
                }
            });
            return response.toJSON();
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

    async getSeasonDetails(id, version) {
        try {
            let response = await request.get(this.buildUrl("/titles/" + id), {
                headers: {
                    "x-inertia": "true",
                    "x-inertia-version": version
                }
            });
            return response.toJSON();
        } catch (error) {
            defaultErrorHandlers(error); 
        }
    }
    async getGenre(id, version) {
        try {
            let response = await request.get(this.buildUrl("/archivio"), {
                params: { "genre[]": id },
                headers: {
                    "x-inertia": "true",
                    "x-inertia-version": version
                }
            });
            return response.toJSON();
        } catch (error) {
            defaultErrorHandlers(error); 
        }
    }
    async getIframe(id, episodeId, nextEpisode = '1') {
        try {
            if (episodeId === undefined) {
                let response = await request.get(this.buildUrl("/iframe/" + id));
                return response.toJSON();
            } else {
                let response = await request.get(this.buildUrl("/iframe/" + id), {
                    params: {
                        episode_id: episodeId,
                        next_episode: nextEpisode
                    }
                });
                return response.toJSON();
            }
        } catch (error) {
            defaultErrorHandlers(error); 
        }
    }
}

const DOMAIN =  "streamingunity.co";
const URL = "https://" + DOMAIN;
const MAX_SEARCH_RESULTS = 60;
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

function isMoreThanDaysAhead(dateString) {
    const inputDate = new Date(dateString);
    const currentDate = new Date();

    // Imposta l'ora di entrambe le date a mezzanotte per un confronto solo sulla data
    inputDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);

    // Calcola la differenza in millisecondi e convertila in giorni
    const diffInDays = (inputDate - currentDate) / (1000 * 60 * 60 * 24);

    return diffInDays > 2;
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
                        isUpdated: it.last_air_date ? isMoreThanDaysAhead(it.last_air_date) : true,
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
                        isUpdated: it.last_air_date ? isMoreThanDaysAhead(it.last_air_date) : false,
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

/* StreamingCommunityProvider as a singleton object exactly mapped from Kotlin */
// class StreamingCommunityProvider {
//     static DOMAIN =  "streamingcommunity.paris";
//     static URL = "https://streamingcommunity.paris/";
//     static MAX_SEARCH_RESULTS = 60;

//     static name = "StreamingCommunity";
//     static logo = "https://streamingcommunity.paris/apple-touch-icon.png";
//     static language = "it";

//     _version;

//     get version() {
//         return this._version;
//     }

//     set version(val) {
//         this._version = val;
//     }

//     static service =  new StreamingCommunityService(StreamingCommunityProvider.URL);


//     // Helper: getImageLink
//     static getImageLink(filename) {
//         if (!filename) return null;
//         return "https://cdn." + this.DOMAIN + "/images/" + filename;
//     }

//     static getFilenameFromImageLink(it, type) {
//         let imageLink = this.getImageLink(it.images.find(img => img.type === type));
//         if (imageLink) return imageLink.filename;

//         return "";
//     }

//     // getHome implementation
//     static async getHome() {
//         let res = await StreamingCommunityProvider.service.getHome(this.version || await this._initVersion());
//         if (this.version !== res.version) this.version = res.version;

//         let mainTitles = res.props.sliders[2].titles;

//         let categories = [];

//         // 2: top10 (Featured)
//         categories.push(new Category({
//             name: "FEATURED",
//             list: mainTitles.map(it => {
//                 if (it.type === "movie") {
//                     return new Movie({
//                         id: it.id + "-" + it.slug,
//                         title: it.name,
//                         banner: this.getFilenameFromImageLink(it, "background"),
//                         rating: it.score
//                     });
//                 } else {
//                     return new TvShow({
//                         id: it.id + "-" + it.slug,
//                         title: it.name,
//                         banner: this.getFilenameFromImageLink(it, "background"),
//                         rating: it.score
//                     });
//                 }
//             })
//         }));

//         // 0: trending, 1: latest
//         let extraCategories = [0, 1].map(index => {
//             let slider = res.props.sliders[index];
//             return new Category({
//                 name: slider.label,
//                 list: slider.titles.map(it => {
//                     if (it.type === "movie") {
//                         return new Movie({
//                             id: it.id + "-" + it.slug,
//                             title: it.name,
//                             released: it.lastAirDate,
//                             rating: it.score,
//                             poster: this.getFilenameFromImageLink(it, "poster"),
//                             banner: this.getFilenameFromImageLink(it, "background")
//                         });
//                     } else {
//                         return new TvShow({
//                             id: it.id + "-" + it.slug,
//                             title: it.name,
//                             released: it.lastAirDate,
//                             rating: it.score,
//                             poster: this.getFilenameFromImageLink(it, "poster"),
//                             banner: this.getFilenameFromImageLink(it, "background")
//                         });
//                     }
//                 })
//             });
//         });
//         categories.push(...extraCategories);

//         return categories;
//     }

//     static async _initVersion() {
//         const document = await StreamingCommunityProvider.service.getHomeDocument();
        
//         // Trova l'attributo `data-page` dentro il tag con id "app"
//         const match = document.match(/id="app"[^>]*data-page='([^']+)'/) || 
//                       document.match(/id="app"[^>]*data-page="([^"]+)"/);
    
//         let parsed = {};
//         if (match) {
//             try {
//                 parsed = JSON.parse(match[1]);
//             } catch (e) {
//                 parsed = {};
//             }
//         }
    
//         this.version = parsed.version || "";
//         return this.version;
//     }

//     static async search(query, page) {
//         if (query === "") {
//             let res = await StreamingCommunityProvider.service.getHome(this.version || await this._initVersion());
//             if (this.version !== res.version) this.version = res.version;
//             return res.props.genres.map(it => new Genre({
//                 id: it.id,
//                 name: it.name
//             })).sort((a, b) => a.name.localeCompare(b.name));
//         }

//         let res = await StreamingCommunityProvider.service.search(query, (page - 1) * this.MAX_SEARCH_RESULTS);
//         if (res.currentPage === null || res.lastPage === null || res.currentPage > res.lastPage) {
//             return [];
//         }

//         return res.data.map(it => {
//             let poster = this.getFilenameFromImageLink(it, "poster");
//             if (it.type === "movie") {
//                 return new Movie({
//                     id: it.id + "-" + it.slug,
//                     title: it.name,
//                     released: it.lastAirDate,
//                     rating: it.score,
//                     poster: poster
//                 });
//             } else {
//                 return new TvShow({
//                     id: it.id + "-" + it.slug,
//                     title: it.name,
//                     released: it.lastAirDate,
//                     rating: it.score,
//                     poster: poster
//                 });
//             }
//         });
//     }

//     static async getMovies(page) {
//         if (page > 1) return [];
//         let res = await StreamingCommunityProvider.service.getMovies(this.version || await this._initVersion());
//         if (this.version !== res.version) this.version = res.version;

//         let movies = [];
//         res.props.sliders.forEach(slider => {
//             slider.titles.forEach(title => {
//                 let poster = this.getFilenameFromImageLink(it, "poster");
//                 movies.push(new Movie({
//                     id: title.id + "-" + title.slug,
//                     title: title.name,
//                     released: title.lastAirDate,
//                     rating: title.score,
//                     poster: poster
//                 }));
//             });
//         });

//         let seen = new Set();
//         return movies.filter(movie => {
//             if (seen.has(movie.id)) {
//                 return false;
//             } else {
//                 seen.add(movie.id);
//                 return true;
//             }
//         });
//     }

//     async getTvShows(page) {
//         if (page > 1) return [];
//         let res = await StreamingCommunityProvider.service.getTvSeries(this.version || await this._initVersion());
//         if (this.version !== res.version) this.version = res.version;

//         let tvShows = [];
//         res.props.sliders.forEach(slider => {
//             slider.titles.forEach(title => {
//                 let poster = this.getFilenameFromImageLink(it, "poster");
//                 tvShows.push(new TvShow({
//                     id: title.id + "-" + title.slug,
//                     title: title.name,
//                     released: title.lastAirDate,
//                     rating: title.score,
//                     poster: poster
//                 }));
//             });
//         });

//         let seen = new Set();
//         return tvShows.filter(show => {
//             if (seen.has(show.id)) return false;
//             seen.add(show.id);
//             return true;
//         });
//     }

//     static getTrailerUrl(title) {
//         if(title.trailers) {
//             let founded = title.trailers.find(t => t.youtubeId && t.youtubeId !== "");
//             if(founded) return "https://youtube.com/watch?v=" + founded.youtubeId;
//             return null;
//         }
//         return null;
//     }

//     static async getMovie(id) {
//         let res = await StreamingCommunityProvider.service.getDetails(id, this.version || await this._initVersion());
//         if (this.version !== res.version) this.version = res.version;
//         let title = res.props.title;

//         return new Movie({
//             id: id,
//             title: title.name,
//             overview: title.plot,
//             released: title.lastAirDate,
//             rating: title.score,
//             poster: this.getFilenameFromImageLink(it, "poster"),
//             genres: (title.genres || []).map(it => new Genre({
//                 id: it.id,
//                 name: it.name
//             })),
//             cast: (title.actors || []).map(it => new People({
//                 id: it.name,
//                 name: it.name
//             })),
//             trailer: this.getTrailerUrl(title),
//             recommendations: res.props.sliders[0].titles.map(it => {
//                 if (it.type === "movie") {
//                     return new Movie({
//                         id: it.id + "-" + it.slug,
//                         title: it.name,
//                         rating: it.score,
//                         poster: this.getFilenameFromImageLink(it, "poster")
//                     });
//                 } else {
//                     return new TvShow({
//                         id: it.id + "-" + it.slug,
//                         title: it.name,
//                         rating: it.score,
//                         poster: this.getFilenameFromImageLink(it, "poster")
//                     });
//                 }
//             })
//         });
//     }

//     static async getTvShow(id) {
//         let res = await StreamingCommunityProvider.service.getDetails(id, this.version || await this._initVersion());
//         if (this.version !== res.version) this.version = res.version;
//         let title = res.props.title;

//         return new TvShow({
//             id: id,
//             title: title.name,
//             overview: title.plot,
//             released: title.lastAirDate,
//             rating: title.score,
//             poster: this.getFilenameFromImageLink(it, "poster"),
//             genres: (title.genres || []).map(it => new Genre({
//                 id: it.id,
//                 name: it.name
//             })),
//             cast: (title.actors || []).map(it => new People({
//                 id: it.name,
//                 name: it.name
//             })),
//             trailer: this.getTrailerUrl(title),
//             recommendations: res.props.sliders[0].titles.map(it => {
//                 if (it.type === "movie") {
//                     return new Movie({
//                         id: it.id + "-" + it.slug,
//                         title: it.name,
//                         rating: it.score,
//                         poster: this.getFilenameFromImageLink(it, "poster")
//                     });
//                 } else {
//                     return new TvShow({
//                         id: it.id + "-" + it.slug,
//                         title: it.name,
//                         rating: it.score,
//                         poster: this.getFilenameFromImageLink(it, "poster")
//                     });
//                 }
//             }),
//             seasons: (title.seasons || []).map(it => new Season({
//                 id: id + "/stagione-" + it.number,
//                 number: parseInt(it.number) || (title.seasons.indexOf(it) + 1),
//                 title: it.name
//             }))
//         });
//     }

//     static async getEpisodesBySeason(seasonId) {
//         let res = await StreamingCommunityProvider.service.getSeasonDetails(seasonId, this.version || await this._initVersion());
//         if (this.version !== res.version) this.version = res.version;
//         return res.props.loadedSeason.episodes.map(it => new Episode({
//             id: seasonId.split("-")[0] + "?episode_id=" + it.id,
//             number: parseInt(it.number) || (res.props.loadedSeason.episodes.indexOf(it) + 1),
//             title: it.name,
//             poster: this.getFilenameFromImageLink(it, "poster")
//         }));
//     }

//     static async getGenre(id, page) {
//         let res = await StreamingCommunityProvider.service.getGenre(id, this.version || await this._initVersion());
//         if (res.version && res.version !== this.version) this.version = res.version;

//         if (page > 1) {
//             return new Genre({
//                 id: id,
//                 name: ""
//             });
//         }

//         let titles = res.titles || res.props.titles;
//         let genreName = "";
//         if (res.props.genres) {
//             let found = res.props.genres.find(g => g.id === id);
//             genreName = found ? found.name : "";
//         }
//         return new Genre({
//             id: id,
//             name: genreName,
//             shows: titles.map(it => {
//                 let poster = this.getFilenameFromImageLink(it, "poster");
//                 if (it.type === "movie") {
//                     return new Movie({
//                         id: it.id + "-" + it.slug,
//                         title: it.name,
//                         released: it.lastAirDate,
//                         rating: it.score,
//                         poster: poster
//                     });
//                 } else {
//                     return new TvShow({
//                         id: it.id + "-" + it.slug,
//                         title: it.name,
//                         released: it.lastAirDate,
//                         rating: it.score,
//                         poster: poster
//                     });
//                 }
//             })
//         });
//     }

//     static async getPeople(id, page) {
//         let res = await StreamingCommunityProvider.service.search(id, (page - 1) * this.MAX_SEARCH_RESULTS);
//         if (res.currentPage === null || res.lastPage === null || res.currentPage > res.lastPage) {
//             return new People({
//                 id: id,
//                 name: id
//             });
//         }

//         return new People({
//             id: id,
//             name: id,
//             filmography: res.data.map(it => {
//                 let poster = this.getFilenameFromImageLink(it, "poster");
//                 if (it.type === "movie") {
//                     return new Movie({
//                         id: it.id + "-" + it.slug,
//                         title: it.name,
//                         released: it.lastAirDate,
//                         rating: it.score,
//                         poster: poster
//                     });
//                 } else {
//                     return new TvShow({
//                         id: it.id + "-" + it.slug,
//                         title: it.name,
//                         released: it.lastAirDate,
//                         rating: it.score,
//                         poster: poster
//                     });
//                 }
//             })
//         });
//     }

//     static async getServers(id, videoType) {
//         let document;
//         if (videoType === Video.Type.Movie) {
//             document = await StreamingCommunityProvider.service.getIframe(id.split("-")[0]);
//         } else if (videoType === Video.Type.Episode) {
//             document = await StreamingCommunityProvider.service.getIframe(id.split("-")[0], id.split("?")[1].split("=")[1]);
//         }
//         const $ = cheerio.load(document);
//         let src = $("iframe").first().attr("src") || "";
//         return [new Video.Server({
//             id: id,
//             name: "Vixcloud",
//             src: src
//         })];
//     }

//     static async getVideo(server) {
//         return await new VixcloudExtractor().extract(server.src);
//     }
// }


  

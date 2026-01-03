// Map of TMDB Genre IDs to Names
// Source: https://developer.themoviedb.org/reference/genre-movie-list

export const GENRE_MAP = {
    // MOVIES
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Science Fiction",
    10770: "TV Movie",
    53: "Thriller",
    10752: "War",
    37: "Western",

    // TV SHOWS (Some overlap, some distinct)
    10759: "Action & Adventure",
    10762: "Kids",
    10763: "News",
    10764: "Reality",
    10765: "Sci-Fi & Fantasy",
    10766: "Soap",
    10767: "Talk",
    10768: "War & Politics"
};

/**
 * Get genre name by ID
 * @param {number} id
 * @returns {string} Genre name or "Unknown"
 */
export const getGenreName = (id) => {
    return GENRE_MAP[id] || "Unknown";
};

/**
 * Get primary genre name from an array of IDs
 * @param {number[]} ids
 * @returns {string} Primary genre name
 */
export const getPrimaryGenre = (ids) => {
    if (!ids || ids.length === 0) return "Uncategorized";
    return getGenreName(ids[0]);
};

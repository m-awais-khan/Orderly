import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Search, Loader } from "lucide-react";

const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = "https://api.themoviedb.org/3/search/multi";
const DEBOUNCE_DELAY = 1000;
const MAX_RESULTS = 10;

const TmdbSearch = ({ onItemSelected, disabled }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [flag, setFlag] = useState(false); // Used to trigger re-renders for focus effect

  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // ----------------------------------------------------
  // Core Search Logic
  // ----------------------------------------------------
  // ----------------------------------------------------
  // Core Search Logic
  // ----------------------------------------------------
  const performSearch = async (query) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);

    try {
      const requests = [];
      const directResults = [];

      // 1. Check if query is numeric (TMDB ID)
      if (/^\d+$/.test(trimmedQuery)) {
        // Try fetching as Movie
        requests.push(
          axios.get(`https://api.themoviedb.org/3/movie/${trimmedQuery}`, {
            params: { api_key: API_KEY },
          }).then(res => {
            directResults.push({ ...res.data, media_type: 'movie' });
          }).catch(() => { }) // Ignore 404
        );

        // Try fetching as TV Show
        requests.push(
          axios.get(`https://api.themoviedb.org/3/tv/${trimmedQuery}`, {
            params: { api_key: API_KEY },
          }).then(res => {
            directResults.push({ ...res.data, media_type: 'tv' });
          }).catch(() => { }) // Ignore 404
        );
      }

      // 2. Always perform normal text search (in case "2012" is a title, etc.)
      const searchRequest = axios.get(BASE_URL, {
        params: {
          api_key: API_KEY,
          query: trimmedQuery,
          include_adult: true,
        },
      });

      requests.push(searchRequest);

      // Wait for all (ID checks + Search)
      const results = await Promise.allSettled(requests);

      // Extract search results from the last request (which is always the searchRequest)
      // Note: Promise.allSettled returns objects with { status, value/reason }
      // We mapped the ID requests to push to directResults array, so we only care about the last one's return for "search results"
      const searchResponse = results[results.length - 1]; // The generic search

      let apiResults = [];
      if (searchResponse.status === "fulfilled") {
        apiResults = searchResponse.value.data.results.filter(
          (item) => item.media_type !== "person" && (item.title || item.name)
        );
      }

      // 3. Combine Direct Matches + Search Results
      // Remove duplicates if the direct match is also found in search results
      const combined = [...directResults];
      const existingIds = new Set(directResults.map(i => i.id));

      apiResults.forEach(item => {
        if (!existingIds.has(item.id)) {
          combined.push(item);
        }
      });

      setSearchResults(combined.slice(0, MAX_RESULTS));
      setFlag((prev) => !prev);
    } catch (error) {
      console.error("TMDB API Error:", error);
      setSearchResults([]);
      // Assuming directResults might have something even if search fails? 
      // But here we are in the catch block of the whole try. 
      // Since we used Promise.allSettled for individual requests inside logic? 
      // No, we used `requests.push` then `Promise.allSettled`. 
      // Actually `axios.get` for searchRequest might throw if not caught? 
      // `Promise.allSettled` waits for all. The `searchRequest` promise itself isn't wrapped in a catch here, 
      // but `Promise.allSettled` shouldn't throw.
      // So this catch block catches synchronous errors or setup errors.
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------
  // Debounce Effect (Auto-search on typing pause)
  // ----------------------------------------------------
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchTerm.trim()) {
      // Set a new timer to run search after delay
      debounceRef.current = setTimeout(() => {
        performSearch(searchTerm);
      }, DEBOUNCE_DELAY);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm]);



  const handleSelect = (item) => {
    onItemSelected(item);
    setSearchTerm("");
    setSearchResults([]);
  };

  // 🛑 NEW FUNCTION: Handles Enter Key Press
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Prevent accidental form submission

      // Clear the debounce timer immediately if it was running
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Perform the search immediately with the current term
      performSearch(searchTerm);
    }
  };

  const [expandedShowId, setExpandedShowId] = useState(null);
  const [seasonsData, setSeasonsData] = useState({}); // Cache for seasons: { showId: [season1, season2] }

  // ----------------------------------------------------
  // Season Fetching Logic
  // ----------------------------------------------------
  const handleFetchSeasons = async (show) => {
    // If already expanded, collapse it
    if (expandedShowId === show.id) {
      setExpandedShowId(null);
      return;
    }

    // If cached, just expand
    if (seasonsData[show.id]) {
      setExpandedShowId(show.id);
      return;
    }

    setIsLoading(true);
    try {
      const res = await axios.get(`https://api.themoviedb.org/3/tv/${show.id}`, {
        params: { api_key: API_KEY },
      });

      // Store seasons AND genres
      const seasons = res.data.seasons || [];
      const genres = res.data.genres || [];

      setSeasonsData(prev => ({
        ...prev,
        [show.id]: { seasons, genres }
      }));
      setExpandedShowId(show.id);
    } catch (err) {
      console.error("Failed to fetch seasons", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSeason = (show, season) => {
    // Retrieve cached genres for this show
    // The structure is now { showId: { seasons: [], genres: [] } }
    // But we need to handle legacy/transition if needed, or just assume new structure. 
    // Since we cleared state on reload, it's fine.
    const showGenreIds = seasonsData[show.id]?.genres?.map(g => g.id) || show.genre_ids || [];

    // Construct a "Season Item"
    const seasonItem = {
      id: `${show.id}_s${season.season_number}`, // Composite ID
      tmdb_id: show.id, // Store original show ID for fetches
      season_number: season.season_number,
      title: `${show.name}: ${season.name}`,
      name: `${show.name}: ${season.name}`,
      media_type: 'tv_season',
      poster_path: season.poster_path || show.poster_path, // Fallback to show poster if season has none
      air_date: season.air_date,
      overview: season.overview,
      genre_ids: showGenreIds // Attach genres!
    };

    onItemSelected(seasonItem);
    setSearchTerm("");
    setSearchResults([]);
    setExpandedShowId(null);
  };

  return (
    <div className="relative mb-4 group z-50">
      {/* Input Field */}
      <div className="flex items-center bg-white dark:bg-gray-700 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-600 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500 transition-all duration-300">
        <Search size={20} className="ml-4 text-gray-400 dark:text-gray-400 group-focus-within:text-blue-500 transition-colors" />
        <input
          type="text"
          ref={inputRef}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (expandedShowId) setExpandedShowId(null); // Reset expansion on type
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled ? "List is locked." : "Search movie or TV show or TMDB ID to add..."
          }
          className="flex-1 px-4 py-3.5 bg-transparent focus:outline-none text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm font-medium"
          disabled={disabled}
        />
        {isLoading && (
          <div className="pr-4">
            <Loader size={20} className="animate-spin text-blue-500" />
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {searchResults.length > 0 && (
        <div
          className="absolute z-50 w-full mt-2 bg-white/90 dark:bg-gray-800/95 backdrop-blur-xl border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl max-h-[400px] overflow-y-auto custom-scrollbar animate-slide-up"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="p-2 space-y-1">
            {searchResults.map((item) => (
              <div key={item.id} className="flex flex-col group/item">
                {/* Main Item Row */}
                <div className="flex items-center p-2 rounded-xl transition-colors hover:bg-blue-50 dark:hover:bg-gray-700/50">
                  {/* Clickable Area for Main Item */}
                  <div
                    className="flex-1 flex items-center cursor-pointer min-w-0"
                    onClick={() => handleSelect(item)}
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={
                          item.poster_path
                            ? `https://image.tmdb.org/t/p/w92${item.poster_path}`
                            : "https://via.placeholder.com/92x138?text=No+Image"
                        }
                        alt={item.title || item.name}
                        className="w-12 h-16 object-cover rounded-lg shadow-sm group-hover/item:shadow-md transition-all"
                      />
                      <div className="absolute inset-0 rounded-lg ring-1 ring-black/5 dark:ring-white/10"></div>
                    </div>

                    <div className="ml-4 flex-1 min-w-0">
                      <p className="font-bold text-gray-800 dark:text-gray-100 truncate text-sm">
                        {item.title || item.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${item.media_type === "movie"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                          }`}>
                          {item.media_type === "movie" ? "Movie" : "TV Show"}
                        </span>
                        {(item.release_date || item.first_air_date) && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            {(item.release_date || item.first_air_date).substring(0, 4)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-1">
                        {item.overview}
                      </p>
                    </div>
                  </div>

                  {/* Drill-down Button for TV Shows */}
                  {item.media_type === 'tv' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFetchSeasons(item);
                      }}
                      className={`p-2 ml-2 rounded-lg transition-all ${expandedShowId === item.id
                        ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                        : "text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"}`}
                      title="View Seasons"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="8" y1="6" x2="21" y2="6"></line>
                        <line x1="8" y1="12" x2="21" y2="12"></line>
                        <line x1="8" y1="18" x2="21" y2="18"></line>
                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                      </svg>
                    </button>
                  )}
                </div>

                {/* Seasons List (Nested) */}
                {expandedShowId === item.id && seasonsData[item.id] && (
                  <div className="ml-14 mt-2 space-y-1 border-l-2 border-purple-100 dark:border-purple-900/30 pl-3 animate-slide-down">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-2">Select a Season</div>
                    {seasonsData[item.id].seasons.map(season => (
                      <div
                        key={season.id}
                        onClick={() => handleSelectSeason(item, season)}
                        className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors"
                      >
                        <div className="w-8 h-12 flex-shrink-0 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                          {season.poster_path ? (
                            <img src={`https://image.tmdb.org/t/p/w92${season.poster_path}`} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">?</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{season.name}</div>
                          <div className="text-xs text-gray-500">{season.episode_count} Episodes • {season.air_date?.slice(0, 4)}</div>
                        </div>
                        <div className="text-purple-500">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TmdbSearch;

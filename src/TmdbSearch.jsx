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

                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TmdbSearch;

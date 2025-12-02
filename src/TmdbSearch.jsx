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
  const performSearch = async (query) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.get(BASE_URL, {
        params: {
          api_key: API_KEY,
          query: trimmedQuery,
          include_adult: true,
        },
      });

      const filteredResults = response.data.results.filter(
        (item) => item.media_type !== "person" && (item.title || item.name)
      );

      setSearchResults(filteredResults.slice(0, MAX_RESULTS)); // Limit to top 10 results

      setFlag((prev) => !prev); // Toggle flag to trigger focus effect
    } catch (error) {
      console.error("TMDB API Error:", error);
      setSearchResults([]);
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

  // ----------------------------------------------------
  // Auto-Focus Effect (Remains for persistent focus)
  // ----------------------------------------------------
  useEffect(() => {
    // Check if the input is not disabled AND we have a reference to the element
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [flag]);

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
            disabled ? "List is locked." : "Search movie or TV show to add..."
          }
          className="flex-1 px-4 py-3.5 bg-transparent focus:outline-none text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm font-medium"
          disabled={disabled || isLoading}
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
              <div
                key={item.id}
                className="flex items-center p-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700/50 rounded-xl transition-colors group/item"
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TmdbSearch;

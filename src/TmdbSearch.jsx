import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Search, Loader } from "lucide-react";

const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = "https://api.themoviedb.org/3/search/multi";
const DEBOUNCE_DELAY = 1000;

const TmdbSearch = ({ onItemSelected, disabled }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

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

      setSearchResults(filteredResults.slice(0, 5));
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
      // Get the currently active element in the entire document
      const activeElement = document.activeElement;

      // Only focus if the active element is NOT an input or textarea (i.e., we are not typing elsewhere).
      const isAnotherInputFocused =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA");

      // If the search bar itself is not the active element and no other input is active, steal focus.
      if (activeElement !== inputRef.current && !isAnotherInputFocused) {
        inputRef.current.focus();
      }
    }
  }); // Runs after every render

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
    <div className="relative mb-4">
      {/* Input Field */}
      <div className="flex items-center border rounded-lg bg-gray-100 dark:bg-gray-700">
        <Search size={20} className="ml-3 text-gray-500 dark:text-gray-400" />
        <input
          type="text"
          ref={inputRef}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
          }}
          // 🛑 NEW: Attach the KeyDown handler
          onKeyDown={handleKeyDown}
          placeholder={
            disabled ? "List is locked." : "Search movie or TV show to add..."
          }
          className="flex-1 px-4 py-3 bg-transparent focus:outline-none dark:text-white"
          disabled={disabled || isLoading}
        />
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="absolute top-0 right-0 p-3">
          <Loader size={20} className="animate-spin text-blue-500" />
        </div>
      )}

      {/* Search Results Dropdown */}
      {searchResults.length > 0 && (
        <div
          className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg dark:bg-gray-800 dark:border-gray-600 max-h-60 overflow-y-auto"
          // 🛑 FIX: Prevent the dropdown click from losing focus on the input
          onMouseDown={(e) => e.preventDefault()}
        >
          {searchResults.map((item) => (
            <div
              key={item.id}
              className="flex items-center p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => handleSelect(item)}
            >
              <img
                src={
                  item.poster_path
                    ? `https://image.tmdb.org/t/p/w92${item.poster_path}`
                    : "placeholder_url"
                }
                alt={item.title || item.name}
                className="w-8 h-12 object-cover rounded mr-3"
              />
              <div className="text-sm dark:text-gray-200">
                <p className="font-semibold">{item.title || item.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {item.media_type === "movie"
                    ? "Movie"
                    : item.media_type === "tv"
                    ? "TV Show"
                    : "Unknown"}
                  {(item.release_date || item.first_air_date) &&
                    ` (${(item.release_date || item.first_air_date).substring(
                      0,
                      4
                    )})`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TmdbSearch;

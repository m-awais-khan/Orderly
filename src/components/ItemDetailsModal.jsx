import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ConfirmationModal from "./ConfirmationModal";
import {
    X,
    Calendar,
    Clock,
    Star,
    ExternalLink,
    Save,
    Film,
    Tv,
    Users,
    Building2,
    BookOpen,
    Check,
    Maximize2,
    Info,
    ArrowUp,
    ListChecks,
    ArrowDown,
    Plus,
    Search,
    Trash2,
    Link,
    List
} from "lucide-react";

const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const detailsCache = {};

const ItemDetailsModal = ({ isOpen, onClose, item, onSave, onDropSeason, listName, droppedSeasonNumbers = [], lists = {}, readOnly = false }) => {
    if (!isOpen || !item) return null;

    const [activeTab, setActiveTab] = useState(readOnly ? "mylist" : "info");
    const [details, setDetails] = useState(null);
    const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
    const langDropdownRef = useRef(null);

    const [isLoading, setIsLoading] = useState(false);
    const [zoomedImage, setZoomedImage] = useState(null);
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => { },
        isDangerous: false
    });

    // Form State for "My List"
    const [formData, setFormData] = useState({
        status: item.status || "plan_to_watch",
        score: item.score || 0,
        episodes_watched: item.episodes_watched || 0,
        times_rewatched: item.times_rewatched || 0,
        start_date: item.start_date || "",
        finish_date: item.finish_date || "",
        note: item.note || "",
        watch_order: item.watch_order || [],
        watched_languages: item.watched_languages || [],
        custom_completed: item.custom_completed || false,
        watched_seasons: item.watched_seasons || [], // [1, 2, ...]
        watched_episodes: item.watched_episodes || [],  // [1, 2, ...] for Season items
        season_progress: item.season_progress || {},     // { "1": 5, "2": 10 }
        season_watched_episodes: item.season_watched_episodes || {}, // { "1": [1, 2], "2": [5] } - Granular for TV Shows
        dropped_seasons: item.dropped_seasons || []      // [1, 3]
    });

    const [viewingSeasonEpisodes, setViewingSeasonEpisodes] = useState(null); // Season number (or null)
    const [seasonEpisodesCache, setSeasonEpisodesCache] = useState({}); // { "season_1": [...] }

    // Derived state for locking logic
    const isLockedPlanToWatch = item.media_type !== 'movie' && (formData.status === 'plan_to_watch' || formData.status === 'not_interested' || formData.status === 'dropped');

    // Sync formData when item changes
    // Sync formData when item changes - MERGED into main effect
    // useEffect removed to prevent double-set and data loss

    // Close language dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (langDropdownRef.current && !langDropdownRef.current.contains(event.target)) {
                setIsLangDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Watch Order State
    const [newSegment, setNewSegment] = useState({
        type: 'episodes', // episodes, item, list
        // For episodes
        season: 1,
        start: 1,
        end: 1,
        // For item
        itemId: '',
        itemName: '',
        itemList: '',
        // For list
        targetListName: ''
    });
    const [segmentSearchQuery, setSegmentSearchQuery] = useState("");
    const [segmentSearchResults, setSegmentSearchResults] = useState([]);

    const searchItemsForSegment = (query) => {
        if (!query || !query.trim()) {
            setSegmentSearchResults([]);
            return;
        }
        const lowerQuery = query.toLowerCase().trim();
        const results = [];
        Object.entries(lists).forEach(([lName, items]) => {
            if (lName.startsWith("special:")) return; // Skip smart lists
            if (!Array.isArray(items)) return;

            items.forEach(i => {
                const itemTitle = i.text || i.title || i.name || "";
                if (itemTitle.toLowerCase().includes(lowerQuery)) {
                    // Normalize text property for display
                    results.push({ ...i, text: itemTitle, foundInList: lName });
                }
            });
        });
        setSegmentSearchResults(results.slice(0, 20)); // Increased limit
    };

    const handleAddSegment = () => {
        if (newSegment.type === 'episodes') {
            if ((newSegment.season === undefined || newSegment.season === null) || !newSegment.start || !newSegment.end) return;
            setFormData(prev => ({
                ...prev,
                watch_order: [...(prev.watch_order || []), {
                    id: Date.now(),
                    type: 'episodes',
                    season: newSegment.season,
                    start: newSegment.start,
                    end: newSegment.end
                }]
            }));
        } else if (newSegment.type === 'item') {
            if (!newSegment.itemId) return;
            setFormData(prev => ({
                ...prev,
                watch_order: [...(prev.watch_order || []), {
                    id: Date.now(),
                    type: 'item',
                    itemId: newSegment.itemId,
                    name: newSegment.itemName,
                    listName: newSegment.itemList
                }]
            }));
            setSegmentSearchQuery("");
            setNewSegment(prev => ({ ...prev, itemId: '', itemName: '', itemList: '' }));
        } else if (newSegment.type === 'list') {
            if (!newSegment.targetListName) return;
            setFormData(prev => ({
                ...prev,
                watch_order: [...(prev.watch_order || []), {
                    id: Date.now(),
                    type: 'list',
                    listName: newSegment.targetListName
                }]
            }));
        }
    };

    const handleMoveSegment = (index, direction) => {
        const newOrder = [...(formData.watch_order || [])];
        if (index + direction < 0 || index + direction >= newOrder.length) return;
        const temp = newOrder[index];
        newOrder[index] = newOrder[index + direction];
        newOrder[index + direction] = temp;
        setFormData({ ...formData, watch_order: newOrder });
    };

    const handleDeleteSegment = (index) => {
        const newOrder = [...(formData.watch_order || [])].filter((_, i) => i !== index);
        setFormData({ ...formData, watch_order: newOrder });
    };

    // Auto-Complete Logic
    useEffect(() => {
        if (!details) return;

        let total = 0;
        let droppedCount = 0;

        // Determine total based on type
        if (details.isSeason || item.media_type === 'tv_season') {
            total = details.episodes?.length || 0;
        } else if (item.media_type === 'tv') {
            // Use season sum for accuracy
            if (details.seasons) {
                total = details.seasons
                    .filter(s => s.season_number > 0)
                    .reduce((acc, s) => acc + s.episode_count, 0);
            }
            if (total === 0) total = details.number_of_episodes || 0;

            // Calculate dropped episodes count
            if (details.seasons && droppedSeasonNumbers?.length > 0) {
                droppedCount = details.seasons
                    .filter(s => droppedSeasonNumbers.includes(s.season_number))
                    .reduce((acc, s) => acc + s.episode_count, 0);
            }
        }

        const effectiveTotal = Math.max(0, total - droppedCount);

        // If watched equals effectiveTotal (and effectiveTotal > 0), set to completed
        if (effectiveTotal > 0) {
            // Respect custom completion flag
            if (!formData.custom_completed) {
                if (formData.episodes_watched >= effectiveTotal && formData.status !== 'completed') {
                    setFormData(prev => ({ ...prev, status: 'completed' }));
                } else if (formData.episodes_watched > 0 && formData.episodes_watched < effectiveTotal && formData.status === 'completed') {
                    // Automatically switch back to watching if un-completed (only if progress exists)
                    setFormData(prev => ({ ...prev, status: 'watching' }));
                } else if (formData.episodes_watched > 0 && formData.status === 'plan_to_watch') {
                    // Automatically switch to watching if progress started (and not dropped)
                    setFormData(prev => ({ ...prev, status: 'watching' }));
                }
            }
        }
    }, [formData.episodes_watched, details, item.media_type, formData.status, droppedSeasonNumbers, formData.custom_completed]);

    // Migration: Populate watched_seasons/episodes from legacy data
    useEffect(() => {
        if (!details) return;

        // 1. TV Show Season Migration
        if (item.media_type === 'tv' && details.seasons) {
            // Initialize season_progress if missing
            if (!formData.season_progress || Object.keys(formData.season_progress).length === 0) {
                const progress = {};
                if (formData.episodes_watched > 0) {
                    let cum = 0;
                    const sortedSeasons = [...details.seasons].sort((a, b) => a.season_number - b.season_number);
                    sortedSeasons.forEach(s => {
                        if (s.season_number === 0) return;
                        const epsInSeason = Math.max(0, Math.min(s.episode_count, formData.episodes_watched - cum));
                        if (epsInSeason > 0) {
                            progress[s.season_number] = epsInSeason;
                        }
                        cum += s.episode_count;
                    });
                }
                setFormData(prev => ({ ...prev, season_progress: progress }));
            }
        }

        // 2. TV Season Episode Migration
        if ((item.media_type === 'tv_season' || details.isSeason) && details.episodes) {
            if ((!formData.watched_episodes || formData.watched_episodes.length === 0) && formData.episodes_watched > 0) {
                const watched = [];
                // Assume start to N
                const sortedEps = [...details.episodes].sort((a, b) => a.episode_number - b.episode_number);
                for (let i = 0; i < formData.episodes_watched; i++) {
                    if (i < sortedEps.length) {
                        watched.push(sortedEps[i].episode_number);
                    }
                }
                if (watched.length > 0) {
                    setFormData(prev => ({ ...prev, watched_episodes: watched }));
                }
            }
        }
    }, [details]); // Run once when details load

    // Sync episodes_watched with season_progress (Source of Truth for TV)
    useEffect(() => {
        if (item.media_type === 'tv' && details?.seasons && formData.season_progress) {
            let total = 0;
            details.seasons.forEach(s => {
                if (s.season_number > 0) {
                    total += (formData.season_progress[s.season_number] || 0);
                }
            });

            if (total !== formData.episodes_watched) {
                setFormData(prev => ({ ...prev, episodes_watched: total }));
            }
        }
    }, [formData.season_progress, details, item.media_type, formData.episodes_watched]);



    // Fetch TMDB Details
    useEffect(() => {
        const fetchDetails = async () => {
            if (!item.id && !item.tmdb_id) return;

            setIsLoading(true);
            try {
                // Determine fetch configuration
                let url;
                let isSeason = false;
                let cacheKey;
                const tmdbId = item.tmdb_id || item.id;

                if (item.media_type === 'tv_season' || (item.media_type === 'tv' && item.season_number)) {
                    isSeason = true;
                    cacheKey = `tv_season_${tmdbId}_${item.season_number}`;
                    url = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${item.season_number}`;
                } else {
                    const type = item.media_type === "tv" ? "tv" : "movie";
                    cacheKey = `${type}_${tmdbId}`;
                    url = `https://api.themoviedb.org/3/${type}/${tmdbId}`;
                }

                // Check Cache
                if (detailsCache[cacheKey]) {
                    setDetails(detailsCache[cacheKey]);
                    setIsLoading(false);
                    return;
                }

                const response = await axios.get(url, {
                    params: {
                        api_key: API_KEY,
                        append_to_response: "credits,images,external_ids,content_ratings,release_dates"
                    }
                });

                // Extract Content Rating (US preference)
                let contentRating = "N/A";
                if (response.data.content_ratings) {
                    // TV Logic
                    const rating = response.data.content_ratings.results.find(r => r.iso_3166_1 === "US");
                    if (rating) contentRating = rating.rating;
                } else if (response.data.release_dates) {
                    // Movie Logic
                    const release = response.data.release_dates.results.find(r => r.iso_3166_1 === "US");
                    if (release && release.release_dates.length > 0) {
                        contentRating = release.release_dates[0].certification;
                    }
                }

                const data = {
                    ...response.data,
                    isSeason, // flag to help UI rendering
                    contentRating // Store extracted rating
                };

                // Save to Cache
                detailsCache[cacheKey] = data;
                setDetails(data);
            } catch (error) {
                console.error("Failed to fetch details:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (isOpen && item.id) {
            fetchDetails();
            // Reset form data when item changes
            setFormData({
                status: item.status || "plan_to_watch",
                score: item.score || 0,
                episodes_watched: item.episodes_watched || 0,
                times_rewatched: item.times_rewatched || 0,
                start_date: item.start_date || "",
                finish_date: item.finish_date || "",
                note: item.note || "",
                watch_order: item.watch_order || [],
                watched_languages: item.watched_languages || [],
                custom_completed: item.custom_completed || false,
                watched_seasons: item.watched_seasons || [],
                watched_episodes: item.watched_episodes || [],
                season_progress: item.season_progress || {},
                season_watched_episodes: item.season_watched_episodes || {},
                dropped_seasons: item.dropped_seasons || []
            });
            setActiveTab("info"); // Reset to info tab
        }
    }, [isOpen, item]);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const updatedItem = {
                ...item,
                ...formData,
                watched_languages: formData.watched_languages || [],
                // Persist runtime info if available from details
                runtime: details?.runtime || item.runtime,
                episode_run_time: details?.episode_run_time || item.episode_run_time
            };

            // Calculate precise total watch time for TV shows
            if (item.media_type === 'tv' && formData.season_watched_episodes) {
                let totalMin = 0;
                const isAnimation = (item.genre_ids?.includes(16)) || (details?.genres?.some(g => g.id === 16));

                // Determine fallback (Priority: Average -> Animation/Normal Default)
                let fallback = isAnimation ? 24 : 50;
                if (details?.episode_run_time?.length > 0) {
                    fallback = Math.round(details.episode_run_time.reduce((a, b) => a + b, 0) / details.episode_run_time.length);
                }

                const seasonsToProcess = Object.entries(formData.season_watched_episodes);

                // Pre-fetch missing cache data
                for (const [sNum, eps] of seasonsToProcess) {
                    if (!Array.isArray(eps) || eps.length === 0) continue;

                    const key = `season_${item.tmdb_id || item.id}_${sNum}`;
                    if (!seasonEpisodesCache[key]) {
                        try {
                            const tmdbId = item.tmdb_id || item.id;
                            const res = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${sNum}`, {
                                params: { api_key: API_KEY }
                            });
                            // Temporarily update our local reference (can't rely on state update being immediate for calculation)
                            seasonEpisodesCache[key] = res.data.episodes;
                            // Also update state for UI consistency if needed, though we are closing
                            setSeasonEpisodesCache(prev => ({ ...prev, [key]: res.data.episodes }));
                        } catch (err) {
                            console.error(`Failed to fetch season ${sNum} for calculation`, err);
                        }
                    }
                }

                // Calculate
                seasonsToProcess.forEach(([sNum, eps]) => {
                    if (!Array.isArray(eps)) return;
                    const key = `season_${item.tmdb_id || item.id}_${sNum}`;
                    const cached = seasonEpisodesCache[key];

                    eps.forEach(epNum => {
                        let runtime = fallback;
                        if (cached) {
                            const epData = cached.find(e => e.episode_number == epNum);
                            if (epData && epData.runtime) {
                                runtime = epData.runtime;
                            }
                        }
                        totalMin += runtime;
                    });
                });
                updatedItem.total_watched_minutes = totalMin;
            }

            onSave(updatedItem);
            onClose();
        } catch (error) {
            console.error("Save failed", error);
            // Optionally show error to user
        } finally {
            setIsLoading(false);
        }
    };

    const getDirector = () => {
        if (!details?.credits?.crew) return null;
        const directors = details.credits.crew.filter(c => c.job === "Director");
        return directors.map(d => d.name).join(", ");
    };

    const getStudios = () => {
        if (!details?.production_companies) return null;
        return details.production_companies.map(c => c.name).join(", ");
    };

    const calculateUpdate = (newProgress, newDroppedSeasons) => {
        let allFinishedOrDropped = true;
        let hasDropped = false;
        let grandTotal = 0;

        details.seasons.forEach(s => {
            // SKIP SPECIALS from main count and status logic
            if (s.season_number === 0) return;

            const eps = newProgress[s.season_number] || 0;
            grandTotal += eps;
            const isDroppedSeason = newDroppedSeasons.includes(s.season_number);
            const isFinished = eps >= s.episode_count;

            if (isDroppedSeason) hasDropped = true;
            if (!isFinished && !isDroppedSeason) {
                allFinishedOrDropped = false;
            }
        });

        let newStatus = formData.status;
        let newScore = formData.score;
        let newRewatch = formData.times_rewatched;

        // Logic: All Locked (Green or Red)
        if (allFinishedOrDropped) {
            if (hasDropped) {
                // If any dropped and all others are finished -> Dropped
                newStatus = 'dropped';
                newScore = 0;
                newRewatch = 0;
            } else {
                // All finished, none dropped -> Completed
                newStatus = 'completed';
            }
        } else {
            // Partial
            if (newStatus === 'completed' || newStatus === 'dropped' || newStatus === 'plan_to_watch' || newStatus === 'not_interested') {
                newStatus = 'watching';
            }

            // Auto-switch to "Plan to Watch" if 0 episodes (even if some are dropped)
            if (grandTotal === 0 && newStatus === 'watching') {
                newStatus = 'plan_to_watch';
                newScore = 0;
                newRewatch = 0;
                // Note: Dates will be cleared in the return object below
                // ALSO: Clear dropped seasons as requested ("make all drop to normal")
                newDroppedSeasons = [];
            }
        }

        return {
            ...formData,
            season_progress: newProgress,
            dropped_seasons: newDroppedSeasons,
            episodes_watched: grandTotal,
            status: newStatus,
            score: newScore,
            times_rewatched: newRewatch,
            // Clear dates if switched to Plan to Watch
            start_date: newStatus === 'plan_to_watch' ? "" : formData.start_date,
            finish_date: newStatus === 'plan_to_watch' ? "" : formData.finish_date
        };
    };

    // --- Granular Episode Logic ---

    const fetchSeasonEpisodes = async (seasonNumber) => {
        // 1. Open Modal Immediately (shows loading spinner if not cached)
        setViewingSeasonEpisodes(seasonNumber);

        const cacheKey = `season_${item.tmdb_id || item.id}_${seasonNumber}`;
        if (seasonEpisodesCache[cacheKey]) {
            return;
        }

        try {
            const tmdbId = item.tmdb_id || item.id;
            const response = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}`, {
                params: { api_key: API_KEY }
            });
            // Update cache
            setSeasonEpisodesCache(prev => ({ ...prev, [cacheKey]: response.data.episodes }));
        } catch (error) {
            console.error("Failed to fetch season episodes:", error);
            alert("Failed to load episodes. Please check your connection.");
            setViewingSeasonEpisodes(null); // Close on error
        }
    };

    const toggleSeasonEpisode = (seasonNumber, episodeNumber, totalEpsInSeason) => {
        // 1. Get current list for this season
        const currentList = formData.season_watched_episodes[seasonNumber] || [];
        let newList;

        // 2. Toggle
        if (currentList.includes(episodeNumber)) {
            newList = currentList.filter(e => e !== episodeNumber);
        } else {
            newList = [...currentList, episodeNumber];
        }

        // 3. Update Granular State
        const newGranular = { ...formData.season_watched_episodes, [seasonNumber]: newList };

        // 4. Update Count State
        const newCount = newList.length;
        const newProgress = { ...formData.season_progress, [seasonNumber]: newCount };

        // 5. Update Total and Status via calculateUpdate
        // calculateUpdate expects (newProgress, newDroppedSeasons)
        const updates = calculateUpdate(newProgress, formData.dropped_seasons || []);

        // Merge granular updates into the result
        setFormData({ ...updates, season_watched_episodes: newGranular });
    };

    const handleSelectAllSeason = (seasonNumber, allEpisodes) => {
        const currentList = formData.season_watched_episodes[seasonNumber] || [];
        const isAllSelected = allEpisodes.every(ep => currentList.includes(ep.episode_number));

        let newList;
        if (isAllSelected) {
            newList = []; // Deselect All
        } else {
            newList = allEpisodes.map(ep => ep.episode_number); // Select All
        }

        const newGranular = { ...formData.season_watched_episodes, [seasonNumber]: newList };
        const newProgress = { ...formData.season_progress, [seasonNumber]: newList.length };
        const updates = calculateUpdate(newProgress, formData.dropped_seasons || []);
        setFormData({ ...updates, season_watched_episodes: newGranular });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            <div className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden h-[90vh] flex flex-col md:flex-row animate-scale-up border border-gray-200 dark:border-gray-800">

                {/* Left Side - Poster & Quick Info */}
                <div className="w-full md:w-1/3 bg-gray-50 dark:bg-gray-800/50 p-6 flex flex-col items-center border-r border-gray-100 dark:border-gray-800 overflow-y-auto">
                    <div className="relative group w-full max-w-[240px] shadow-xl rounded-xl overflow-hidden mb-6">
                        <img
                            src={
                                details?.poster_path
                                    ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
                                    : item.poster_path
                                        ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                                        : item.image?.includes("w92")
                                            ? item.image.replace("w92", "w500")
                                            : (item.image || "https://via.placeholder.com/300x450?text=No+Image")
                            }
                            alt={item.title || item.name}
                            className="w-full h-auto object-cover"
                        />
                        <div className="absolute inset-0 ring-1 ring-black/10 rounded-xl pointer-events-none" />

                        {/* Expand Overlay */}
                        <div
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer backdrop-blur-[2px]"
                            onClick={() => setZoomedImage(
                                details?.poster_path
                                    ? `https://image.tmdb.org/t/p/original${details.poster_path}`
                                    : item.poster_path
                                        ? `https://image.tmdb.org/t/p/original${item.poster_path}`
                                        : item.image?.includes("w92")
                                            ? item.image.replace("w92", "original")
                                            : item.image
                            )}
                        >
                            <Maximize2 className="text-white mb-2" size={32} />
                            <span className="text-white font-medium text-sm border-b border-white/50 pb-0.5">Expand</span>
                        </div>
                    </div>

                    <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
                        {details?.title || details?.name || item.title || item.name}
                    </h2>

                    {details?.original_title && details.original_title !== details.title && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4 italic">
                            {details.original_title}
                        </p>
                    )}

                    <div className="w-full space-y-3 text-sm">
                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                            <span className="text-gray-500 dark:text-gray-400">Format</span>
                            <span className="font-medium text-gray-900 dark:text-gray-200 uppercase">
                                {item.media_type === 'tv_season' || details?.isSeason ? 'Season' : (item.media_type === 'movie' ? 'Movie' : 'TV Show')}
                            </span>
                        </div>
                        {details?.contentRating && details.contentRating !== "N/A" && (
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                <span className="text-gray-500 dark:text-gray-400">Rating</span>
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600">
                                    {details.contentRating}
                                </span>
                            </div>
                        )}
                        {details?.episode_run_time?.length > 0 && (
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                <span className="text-gray-500 dark:text-gray-400">Duration</span>
                                <span className="font-medium text-gray-900 dark:text-gray-200">{details.episode_run_time[0]} min</span>
                            </div>
                        )}
                        {details?.runtime > 0 && (
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                <span className="text-gray-500 dark:text-gray-400">Runtime</span>
                                <span className="font-medium text-gray-900 dark:text-gray-200">{details.runtime} min</span>
                            </div>
                        )}
                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                            <span className="text-gray-500 dark:text-gray-400">Status</span>
                            <span className="font-medium text-gray-900 dark:text-gray-200">{details?.status || "Unknown"}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                            <span className="text-gray-500 dark:text-gray-400">Score</span>
                            <span className="font-medium flex items-center gap-1 text-amber-500">
                                <Star size={14} fill="currentColor" />
                                {details?.vote_average ? details.vote_average.toFixed(1) : "N/A"}
                            </span>
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-center gap-4">
                        <a
                            href={
                                details?.isSeason
                                    ? `https://www.themoviedb.org/tv/${item.tmdb_id}/season/${item.season_number}`
                                    : `https://www.themoviedb.org/${item.media_type === 'tv' ? 'tv' : 'movie'}/${item.tmdb_id || item.id}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-transform hover:scale-105"
                            title="View on TMDB"
                        >
                            <img
                                src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg"
                                alt="View on TMDB"
                                className="h-8 w-auto border-blue-600/20"
                            />
                        </a>

                        {details?.external_ids?.imdb_id && (
                            <a
                                href={`https://www.imdb.com/title/${details.external_ids.imdb_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="transition-transform hover:scale-105"
                                title="View on IMDb"
                            >
                                <img
                                    src="https://upload.wikimedia.org/wikipedia/commons/6/69/IMDB_Logo_2016.svg"
                                    alt="View on IMDb"
                                    className="h-8 w-auto rounded-[4px] shadow-sm"
                                />
                            </a>
                        )}
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                        <Info size={12} />
                        <span>Data provided by TMDB</span>
                    </div>

                </div>

                {/* Right Side - Tabs & Content */}
                <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
                    {/* Header & Close */}
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900 sticky top-0 z-10">
                        <div className="flex gap-6">
                            <button
                                onClick={() => setActiveTab("info")}
                                className={`pb-2 text-sm font-semibold transition-colors relative ${activeTab === "info"
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                    }`}
                            >
                                Main Information
                                {activeTab === "info" && (
                                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab("mylist")}
                                className={`pb-2 text-sm font-semibold transition-colors relative ${activeTab === "mylist"
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                    }`}
                            >
                                My List & Settings
                                {activeTab === "mylist" && (
                                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                                )}
                            </button>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {activeTab === "info" ? (
                            <div className="space-y-6 animate-fade-in">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                                        <p>Loading details...</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Genres */}
                                        {details?.genres && (
                                            <div className="flex flex-wrap gap-2">
                                                {details.genres.map(genre => (
                                                    <span key={genre.id} className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                                                        {genre.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Synopsis */}
                                        <div>
                                            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Synopsis</h3>
                                            <p className="text-gray-800 dark:text-gray-200 leading-relaxed text-sm">
                                                {details?.overview || "No synopsis available."}
                                            </p>
                                        </div>

                                        {/* Additional Details Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                                            {getDirector() && (
                                                <div>
                                                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Director</h3>
                                                    <p className="text-sm text-gray-800 dark:text-gray-200">{getDirector()}</p>
                                                </div>
                                            )}
                                            {getStudios() && (
                                                <div>
                                                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Studios / Producers</h3>
                                                    <p className="text-sm text-gray-800 dark:text-gray-200">{getStudios()}</p>
                                                </div>

                                            )}
                                            {details?.first_air_date && (
                                                <div>
                                                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Premiered</h3>
                                                    <p className="text-sm text-gray-800 dark:text-gray-200">{details.first_air_date}</p>
                                                </div>
                                            )}
                                            {details?.release_date && (
                                                <div>
                                                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Released</h3>
                                                    <p className="text-sm text-gray-800 dark:text-gray-200">{details.release_date}</p>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6 animate-fade-in max-w-xl">


                                {/* My List Settings Form */}
                                {/* My List Settings Form */}
                                {(item.media_type === 'tv' || item.media_type === 'tv_season' || details?.isSeason) && (
                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 flex gap-3">
                                        <Info className="text-blue-500 shrink-0 mt-0.5" size={16} />
                                        <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                                            If you think that seasons information or episodes info is wrong then you have to request or change data in <a href={`https://www.themoviedb.org/${item.media_type}/${item.tmdb_id || item.id}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">TMDB</a> as the data directly comes from the TMDB.
                                        </p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-6">
                                    {/* Status */}
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Status</label>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => {
                                                const newStatus = e.target.value;

                                                setFormData(prev => {
                                                    let updates = { status: newStatus };

                                                    // Case 1: Switching TO "Completed" -> Maximize episodes (UNLESS custom_completed is checked)
                                                    if (newStatus === 'completed' && details && !formData.custom_completed) {
                                                        let total = 0;
                                                        if (details.episodes && (details.isSeason || item.media_type === 'tv_season')) {
                                                            // It's a Season
                                                            total = details.episodes.length;
                                                            // Populate watched_episodes with all episode numbers
                                                            updates.watched_episodes = details.episodes.map(ep => ep.episode_number);
                                                        } else if (details.number_of_episodes) {
                                                            // It's a TV Show
                                                            total = details.number_of_episodes;
                                                            // Populate watched_seasons with all season numbers
                                                            if (details.seasons) {
                                                                updates.watched_seasons = details.seasons
                                                                    .filter(s => s.season_number > 0) // Exclude Specials usually
                                                                    .map(s => s.season_number);

                                                                // Also populate season_progress for visualizer
                                                                updates.season_progress = {};
                                                                details.seasons.forEach(s => {
                                                                    if (s.season_number > 0) {
                                                                        updates.season_progress[s.season_number] = s.episode_count;
                                                                    }
                                                                });
                                                            }
                                                        }

                                                        if (total > 0) {
                                                            updates.episodes_watched = total;
                                                        }
                                                        // For movies, set times_rewatched to 1 when completed
                                                        if (item.media_type === 'movie' && prev.times_rewatched === 0) {
                                                            updates.times_rewatched = 1;
                                                        }
                                                    }
                                                    // Case 2: Switching FROM "Completed" -> Reset episodes to 0
                                                    else if (prev.status === 'completed' && newStatus !== 'completed') {
                                                        updates.episodes_watched = 0;
                                                    }

                                                    // Case 2b: Switching FROM "Dropped" TO "Watching" -> Clear dropped seasons (Red -> Normal)
                                                    if (prev.status === 'dropped' && newStatus === 'watching') {
                                                        updates.dropped_seasons = [];
                                                    }

                                                    // Case 2c: Switching TO "Dropped" -> Mark all non-completed seasons as Dropped (Red)
                                                    if (newStatus === 'dropped' && item.media_type !== 'movie' && details?.seasons) {
                                                        const newDropped = [...(prev.dropped_seasons || [])];
                                                        details.seasons.forEach(s => {
                                                            if (s.season_number > 0) {
                                                                const currentEps = formData.season_progress?.[s.season_number] || 0;
                                                                const isFull = currentEps === s.episode_count;
                                                                // If not full and not already dropped, add to dropped
                                                                if (!isFull && !newDropped.includes(s.season_number)) {
                                                                    newDropped.push(s.season_number);
                                                                }
                                                            }
                                                        });
                                                        updates.dropped_seasons = newDropped;
                                                        updates.score = 0; // Reset score on drop as per previous request
                                                        updates.times_rewatched = 0;
                                                    }

                                                    // Case 3: Switching to "plan_to_watch" or "dropped" or "not_interested" -> Reset times_rewatched to 0 for movies
                                                    if (item.media_type === 'movie' && (newStatus === 'plan_to_watch' || newStatus === 'dropped' || newStatus === 'not_interested')) {
                                                        updates.times_rewatched = 0;
                                                        updates.score = 0; // Reset score too
                                                        updates.start_date = ""; // Reset dates
                                                        updates.finish_date = "";
                                                    }

                                                    // Case 4: Force Reset Episodes when switching to Plan to Watch or Not Interested
                                                    if (newStatus === 'plan_to_watch' || newStatus === 'not_interested') {
                                                        updates.episodes_watched = 0;
                                                        updates.watched_seasons = []; // Legacy
                                                        updates.season_watched_episodes = {}; // Correct key for granular episodes
                                                        updates.season_progress = {}; // Reset season progress visualizer
                                                        updates.dropped_seasons = []; // Reset dropped seasons markup
                                                        updates.start_date = ""; // Reset dates
                                                        updates.finish_date = "";

                                                        // New strict reset requirements for TV shows
                                                        if (item.media_type !== 'movie') {
                                                            if (newStatus === 'plan_to_watch') {
                                                                updates.note = "";
                                                            }
                                                            updates.custom_completed = false;
                                                            updates.watched_languages = [];
                                                            updates.score = 0; // Ensure score is 0
                                                        }
                                                    }

                                                    // Case 4: For TV/Seasons - Reset score if switching to non-ratable status
                                                    if (item.media_type !== 'movie' && newStatus !== 'completed') {
                                                        updates.score = 0;
                                                        updates.times_rewatched = 0;
                                                    }

                                                    return { ...prev, ...updates };
                                                });
                                            }}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="plan_to_watch">Plan to Watch</option>
                                            {item.media_type !== 'movie' && <option value="watching" disabled>Watching</option>}
                                            <option value="completed" disabled={item.media_type !== 'movie'}>Completed</option>
                                            {item.media_type !== 'movie' && <option value="dropped" disabled>Dropped</option>}
                                            <option value="not_interested">Not Interested</option>
                                        </select>
                                    </div>



                                    {/* Score */}
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">My Score</label>
                                        <select
                                            value={formData.score}
                                            onChange={(e) => setFormData({ ...formData, score: Number(e.target.value) })}
                                            disabled={readOnly || (
                                                item.media_type === 'movie'
                                                    ? formData.status !== 'completed'
                                                    : (formData.status !== 'completed' && formData.status !== 'rewatching')
                                            ) || isLockedPlanToWatch}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            <option value={0}>Select Score...</option>
                                            <option value={10}>(10) Masterpiece</option>
                                            <option value={9}>(9) Great</option>
                                            <option value={8}>(8) Very Good</option>
                                            <option value={7}>(7) Good</option>
                                            <option value={6}>(6) Fine</option>
                                            <option value={5}>(5) Average</option>
                                            <option value={4}>(4) Bad</option>
                                            <option value={3}>(3) Very Bad</option>
                                            <option value={2}>(2) Horrible</option>
                                            <option value={1}>(1) Appalling</option>
                                        </select>
                                    </div>

                                    {/* Progress */}
                                    {/* Progress */}
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">
                                            {item.media_type === 'tv' || item.media_type === 'tv_season' || details?.isSeason ? 'Episodes Watched' : 'Times Watched'}
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min={item.media_type === 'movie' && formData.status === 'completed' ? 1 : 0}
                                                value={item.media_type === 'tv' || item.media_type === 'tv_season' || details?.isSeason
                                                    ? formData.episodes_watched
                                                    : (formData.status === 'plan_to_watch' || formData.status === 'dropped' ? 0 : formData.times_rewatched)}
                                                onChange={(e) => {
                                                    let val = parseInt(e.target.value) || 0;
                                                    if (item.media_type === 'tv' || item.media_type === 'tv_season' || details?.isSeason) {
                                                        let maxEpisodes = details?.number_of_episodes || details?.episodes?.length;
                                                        if (item.media_type === 'tv' && details?.seasons) {
                                                            const seasonSum = details.seasons
                                                                .filter(s => s.season_number > 0)
                                                                .reduce((acc, s) => acc + s.episode_count, 0);
                                                            if (seasonSum > 0) maxEpisodes = seasonSum;
                                                        }
                                                        if (maxEpisodes) {
                                                            val = Math.min(Math.max(0, val), maxEpisodes);
                                                        } else {
                                                            val = Math.max(0, val);
                                                        }

                                                        let newStatus = formData.status;
                                                        // Case 3: If status is 'completed' but we decrease episodes -> change to 'watching'
                                                        if (formData.status === 'completed' && maxEpisodes && val < maxEpisodes) {
                                                            newStatus = 'watching';
                                                        }

                                                        setFormData({ ...formData, episodes_watched: val, status: newStatus });
                                                    } else {
                                                        // For movies, min is 1 if completed, otherwise 0
                                                        const minVal = formData.status === 'completed' ? 1 : 0;
                                                        setFormData({ ...formData, times_rewatched: Math.max(minVal, val) });
                                                    }
                                                }}
                                                disabled={item.media_type === 'tv' || item.media_type === 'tv_season' || details?.isSeason || formData.status === 'plan_to_watch' || formData.status === 'not_interested' || formData.status === 'dropped'}
                                                title={item.media_type === 'tv' || item.media_type === 'tv_season' || details?.isSeason ? "Use the Season List below to track progress" : "Times Watched"}
                                                className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                            />
                                            {(item.media_type === 'tv' || item.media_type === 'tv_season' || details?.isSeason) && (
                                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                                    / {(() => {
                                                        if (item.media_type === 'tv' && details?.seasons) {
                                                            const seasonSum = details.seasons
                                                                .filter(s => s.season_number > 0)
                                                                .reduce((acc, s) => acc + s.episode_count, 0);
                                                            return seasonSum || details.number_of_episodes || "?";
                                                        }
                                                        return details?.number_of_episodes || details?.episodes?.length || "?";
                                                    })()}
                                                </span>
                                            )}
                                        </div>

                                        {/* Times Rewatched for TV Shows (Separate Field) */}
                                        {(item.media_type === 'tv' || item.media_type === 'tv_season' || details?.isSeason) && (
                                            <div className="mt-3">
                                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">
                                                    Times Rewatched
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.times_rewatched}
                                                    onChange={(e) => setFormData({ ...formData, times_rewatched: parseInt(e.target.value) || 0 })}
                                                    disabled={readOnly || isLockedPlanToWatch || formData.status === 'watching'}
                                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                                />
                                            </div>
                                        )}


                                        {/* Season Breakdown Visualizer (Interactive) */}
                                        {item.media_type === 'tv' && !details?.isSeason && details?.seasons && (
                                            <div className="mt-4 space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                                                {details.seasons
                                                    .map((season) => {
                                                        const current = formData.season_progress?.[season.season_number] || 0;
                                                        const isDropped = formData.dropped_seasons?.includes(season.season_number);
                                                        const isFull = current === season.episode_count;
                                                        const isEffectivelyFullyWatched = isFull || isDropped;
                                                        const isUnreleased = !season.episode_count || season.episode_count === 0;

                                                        return (
                                                            <div
                                                                key={season.id}
                                                                onClick={() => {
                                                                    if (readOnly || isDropped || isUnreleased) return;
                                                                    const newCount = isFull ? 0 : season.episode_count;
                                                                    const newProgress = { ...formData.season_progress, [season.season_number]: newCount };

                                                                    // Sync Granular: strict sequential
                                                                    const newEpisodes = newCount === 0 ? [] : Array.from({ length: newCount }, (_, i) => i + 1);
                                                                    const newGranular = { ...formData.season_watched_episodes, [season.season_number]: newEpisodes };

                                                                    const updates = calculateUpdate(newProgress, formData.dropped_seasons || []);
                                                                    setFormData({ ...updates, season_watched_episodes: newGranular });
                                                                }}
                                                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all relative
                                                                    ${(!readOnly && !isUnreleased) ? "cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm" : ""}
                                                                    ${isUnreleased
                                                                        ? "bg-gray-50 dark:bg-gray-900/30 border-gray-100 dark:border-gray-800 opacity-60 cursor-not-allowed"
                                                                        : isDropped
                                                                            ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30"
                                                                            : (isFull
                                                                                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                                                                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700")}`}
                                                            >
                                                                {/* Poster */}
                                                                <div className="w-10 h-14 flex-shrink-0 rounded-md overflow-hidden bg-gray-200 relative group/poster">
                                                                    {season.poster_path ? (
                                                                        <>
                                                                            <img src={`https://image.tmdb.org/t/p/w92${season.poster_path}`} alt={season.name} className={`w-full h-full object-cover ${isDropped ? "grayscale" : ""}`} />
                                                                            <div
                                                                                className="absolute inset-0 bg-black/40 opacity-0 group-hover/poster:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setZoomedImage(`https://image.tmdb.org/t/p/original${season.poster_path}`);
                                                                                }}
                                                                            >
                                                                                <Maximize2 className="text-white" size={16} />
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">?</div>
                                                                    )}
                                                                </div>

                                                                {/* Info & Controls */}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex justify-between items-center mb-2">
                                                                        <span className={`font-semibold text-sm truncate ${isDropped ? "text-red-700 dark:text-red-400" : "text-gray-800 dark:text-gray-200"}`}>
                                                                            {season.name}
                                                                        </span>
                                                                        {/* Drop Button */}
                                                                        {!readOnly && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    if (isFull) return;
                                                                                    const newDropped = [...(formData.dropped_seasons || [])];
                                                                                    if (isDropped) {
                                                                                        const idx = newDropped.indexOf(season.season_number);
                                                                                        if (idx > -1) newDropped.splice(idx, 1);
                                                                                    } else {
                                                                                        newDropped.push(season.season_number);
                                                                                    }
                                                                                    setFormData(calculateUpdate(formData.season_progress, newDropped));
                                                                                }}
                                                                                disabled={isUnreleased || isFull || formData.status === 'plan_to_watch' || formData.status === 'not_interested'}
                                                                                className={`p-1.5 rounded-full transition-colors ${isUnreleased || isFull || formData.status === 'plan_to_watch' || formData.status === 'not_interested'
                                                                                    ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                                                                                    : isDropped
                                                                                        ? "bg-red-500 text-white hover:bg-red-600"
                                                                                        : "text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                                    }`}
                                                                                title={isFull ? "Season Completed" : ((formData.status === 'plan_to_watch' || formData.status === 'not_interested') ? "Start watching to drop" : (isDropped ? "Restore Season" : "Drop Season"))}
                                                                            >
                                                                                {isDropped ? <ArrowUp size={14} /> : <X size={14} />}
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    {/* Progress Control - Hidden if unreleased */}
                                                                    {!isUnreleased && (
                                                                        <div className="flex items-center gap-3">
                                                                            {/* Subtract */}
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    if (readOnly || isDropped || current <= 0) return;
                                                                                    const newCount = current - 1;
                                                                                    const newProgress = { ...formData.season_progress, [season.season_number]: newCount };

                                                                                    // Sync Granular: strict sequential
                                                                                    // If we reduce count, we keep the first N episodes (assuming sequential)
                                                                                    const newEpisodes = Array.from({ length: newCount }, (_, i) => i + 1);
                                                                                    const newGranular = { ...formData.season_watched_episodes, [season.season_number]: newEpisodes };

                                                                                    const updates = calculateUpdate(newProgress, formData.dropped_seasons || []);
                                                                                    setFormData({ ...updates, season_watched_episodes: newGranular });
                                                                                }}
                                                                                disabled={readOnly || isDropped || current <= 0}
                                                                                className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 transition-colors"
                                                                            >
                                                                                -
                                                                            </button>

                                                                            {/* Bar */}
                                                                            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                                                                                <div
                                                                                    className={`h-full rounded-full transition-all duration-300 ${isDropped ? "bg-red-500" : (isFull ? "bg-green-500" : "bg-blue-500")}`}
                                                                                    style={{ width: `${(current / season.episode_count) * 100}%` }}
                                                                                />
                                                                            </div>

                                                                            {/* Add & Select */}
                                                                            <div className="flex flex-col gap-1">
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (readOnly || isDropped || current >= season.episode_count) return;

                                                                                        const newCount = current + 1;
                                                                                        const newProgress = { ...formData.season_progress, [season.season_number]: newCount };

                                                                                        // Sync Granular: strict sequential
                                                                                        const newEpisodes = Array.from({ length: newCount }, (_, i) => i + 1);
                                                                                        const newGranular = { ...formData.season_watched_episodes, [season.season_number]: newEpisodes };

                                                                                        const updates = calculateUpdate(newProgress, formData.dropped_seasons || []);
                                                                                        setFormData({ ...updates, season_watched_episodes: newGranular });
                                                                                    }}
                                                                                    disabled={readOnly || isDropped || current >= season.episode_count}
                                                                                    className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 transition-colors"
                                                                                    title="Add Episode"
                                                                                >
                                                                                    +
                                                                                </button>
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (readOnly || isDropped) return;
                                                                                        fetchSeasonEpisodes(season.season_number);
                                                                                    }}
                                                                                    disabled={readOnly || isDropped}
                                                                                    className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-30 transition-colors"
                                                                                    title="Select Specific Episodes"
                                                                                >
                                                                                    <ListChecks size={12} />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {!isUnreleased && (
                                                                        <div className="flex justify-between mt-1 px-1">
                                                                            <span className="text-[10px] text-gray-400">{current} / {season.episode_count}</span>
                                                                        </div>
                                                                    )}
                                                                    {isUnreleased && (
                                                                        <div className="flex justify-end mt-1 px-1">
                                                                            <span className="text-[10px] font-medium text-gray-400">Upcoming</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Episodes List (For Season Items OR Expanded View) */}
                                    {(item.media_type === 'tv_season' || details?.isSeason) && details?.episodes && (
                                        <div className="col-span-2 mt-4 mb-4">
                                            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">
                                                Episodes
                                                <span className="ml-2 font-normal normal-case text-gray-400">
                                                    ({formData.watched_episodes?.length || 0} / {details.episodes.length})
                                                </span>
                                            </label>
                                            <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar pr-2 border border-gray-200 dark:border-gray-700/50 rounded-lg p-2 bg-gray-50 dark:bg-gray-800/20">
                                                {details.episodes.map(ep => {
                                                    const isWatched = formData.watched_episodes?.includes(ep.episode_number);
                                                    return (
                                                        <div
                                                            key={ep.id}
                                                            className={`flex items-center gap-3 p-2 rounded-md transition-colors 
                                                                ${isWatched
                                                                    ? 'bg-blue-50 dark:bg-blue-900/20'
                                                                    : 'hover:bg-white dark:hover:bg-gray-800'}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isWatched || false}
                                                                disabled={readOnly}
                                                                onChange={() => {
                                                                    if (readOnly) return;
                                                                    let newWatched = [...(formData.watched_episodes || [])];
                                                                    if (isWatched) {
                                                                        newWatched = newWatched.filter(n => n !== ep.episode_number);
                                                                    } else {
                                                                        newWatched.push(ep.episode_number);
                                                                    }

                                                                    let updates = {
                                                                        watched_episodes: newWatched,
                                                                        episodes_watched: newWatched.length
                                                                    };

                                                                    // Auto-status
                                                                    if (newWatched.length === details.episodes.length && formData.status !== 'completed') {
                                                                        updates.status = 'completed';
                                                                    } else if (newWatched.length < details.episodes.length && formData.status === 'completed' && !formData.custom_completed) {
                                                                        updates.status = 'watching';
                                                                    }

                                                                    setFormData(prev => ({ ...prev, ...updates }));
                                                                }}
                                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between">
                                                                    <span className={`text-sm font-medium truncate ${isWatched ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>
                                                                        {ep.episode_number}. {ep.name}
                                                                    </span>
                                                                    <span className="text-xs text-gray-400">
                                                                        {ep.air_date ? new Date(ep.air_date).getFullYear() : ''}
                                                                    </span>
                                                                </div>
                                                                {ep.overview && (
                                                                    <p className="text-xs text-gray-400 truncate mt-0.5 max-w-[90%]">
                                                                        {ep.overview}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Recommended Watch Order (TV Only) */}
                                    {item.media_type === 'tv' && (
                                        <div className="col-span-2 mt-2 mb-4">
                                            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Recommended Watch Order</label>

                                            {/* Order List */}
                                            <div className="space-y-2 mb-3">
                                                {(formData.watch_order || []).map((segment, index) => (
                                                    <div key={segment.id || index} className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 rounded-lg group">
                                                        <div className="flex-1 text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                                            {segment.type === 'episodes' && (
                                                                <>
                                                                    <Tv size={14} className="text-blue-500" />
                                                                    <span>
                                                                        {details?.seasons?.find(s => s.season_number === parseInt(segment.season))?.name || `Season ${segment.season}`}
                                                                        : Eps {segment.start}-{segment.end}
                                                                    </span>
                                                                </>
                                                            )}
                                                            {segment.type === 'item' && (
                                                                <>
                                                                    <Link size={14} className="text-purple-500" />
                                                                    <span>{segment.name}</span>
                                                                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded ml-1">{segment.listName}</span>
                                                                </>
                                                            )}
                                                            {segment.type === 'list' && (
                                                                <>
                                                                    <List size={14} className="text-amber-500" />
                                                                    <span>List: {segment.listName}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {!readOnly && !isLockedPlanToWatch && (
                                                                <>
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); handleMoveSegment(index, -1); }}
                                                                        disabled={index === 0}
                                                                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 disabled:opacity-30"
                                                                    >
                                                                        <ArrowUp size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); handleMoveSegment(index, 1); }}
                                                                        disabled={index === (formData.watch_order || []).length - 1}
                                                                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 disabled:opacity-30"
                                                                    >
                                                                        <ArrowDown size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); handleDeleteSegment(index); }}
                                                                        className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-red-500"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                {(formData.watch_order || []).length === 0 && (
                                                    <div className="text-xs text-gray-400 text-center py-2 italic">
                                                        No custom order defined. Default order will be used.
                                                    </div>
                                                )}
                                            </div>

                                            {/* Add Segment Controls */}
                                            {!readOnly && !isLockedPlanToWatch && (
                                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700/50">
                                                    <div className="flex gap-2 mb-3">
                                                        {['episodes', 'item', 'list'].map(type => (
                                                            <button
                                                                key={type}
                                                                onClick={(e) => { e.preventDefault(); setNewSegment(prev => ({ ...prev, type })); }}
                                                                className={`flex-1 text-xs font-medium py-1.5 rounded-md capitalize transition-colors
                                                                ${newSegment.type === type
                                                                        ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                                                                        : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                                                            >
                                                                {type}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <div className="flex gap-2 items-end">
                                                        {newSegment.type === 'episodes' && (
                                                            <>
                                                                <div className="flex-1">
                                                                    <label className="block text-[10px] uppercase text-gray-400 mb-1">Season</label>
                                                                    <select
                                                                        value={newSegment.season}
                                                                        onChange={e => {
                                                                            const val = parseInt(e.target.value);
                                                                            setNewSegment(prev => ({ ...prev, season: val }));
                                                                        }}
                                                                        className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-2 focus:ring-blue-500/20"
                                                                    >
                                                                        {(details?.seasons || [])
                                                                            .sort((a, b) => a.season_number - b.season_number)
                                                                            .map(s => (
                                                                                <option key={s.id} value={s.season_number}>
                                                                                    {s.name && s.name.trim() !== "" ? s.name : `Season ${s.season_number}`}
                                                                                </option>
                                                                            ))
                                                                        }
                                                                    </select>
                                                                </div>
                                                                <div className="flex-1">
                                                                    <label className="block text-[10px] uppercase text-gray-400 mb-1">Start Ep</label>
                                                                    <input
                                                                        type="number" min="1"
                                                                        value={newSegment.start}
                                                                        onChange={e => setNewSegment(prev => ({ ...prev, start: e.target.value }))}
                                                                        onBlur={e => {
                                                                            let val = parseInt(e.target.value);
                                                                            if (isNaN(val)) val = 1;

                                                                            if (details?.seasons) {
                                                                                // Note: parseInt(newSegment.season) ensures we compare numbers if state is temporarily string
                                                                                const currentSeason = details.seasons.find(s => s.season_number === parseInt(newSegment.season));
                                                                                if (currentSeason) {
                                                                                    val = Math.min(Math.max(1, val), currentSeason.episode_count);
                                                                                }
                                                                            }
                                                                            setNewSegment(prev => ({ ...prev, start: val }));
                                                                        }}
                                                                        className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                                                                    />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <label className="block text-[10px] uppercase text-gray-400 mb-1">End Ep</label>
                                                                    <input
                                                                        type="number" min="1"
                                                                        value={newSegment.end}
                                                                        onChange={e => setNewSegment(prev => ({ ...prev, end: e.target.value }))}
                                                                        onBlur={e => {
                                                                            let val = parseInt(e.target.value) || 1;
                                                                            if (details?.seasons) {
                                                                                const currentSeason = details.seasons.find(s => s.season_number === parseInt(newSegment.season));
                                                                                if (currentSeason) {
                                                                                    val = Math.min(Math.max(1, val), currentSeason.episode_count);
                                                                                }
                                                                            }
                                                                            setNewSegment(prev => ({ ...prev, end: val }));
                                                                        }}
                                                                        className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                                                                    />
                                                                </div>
                                                            </>
                                                        )}

                                                        {newSegment.type === 'item' && (
                                                            <div className="flex-1 relative">
                                                                <label className="block text-[10px] uppercase text-gray-400 mb-1">Search Item</label>
                                                                <div className="relative">
                                                                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                                    <input
                                                                        type="text" placeholder="Search..."
                                                                        value={segmentSearchQuery}
                                                                        onChange={e => {
                                                                            setSegmentSearchQuery(e.target.value);
                                                                            searchItemsForSegment(e.target.value);
                                                                        }}
                                                                        className="w-full pl-8 pr-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                                                                    />
                                                                </div>
                                                                {segmentSearchQuery && segmentSearchResults.length > 0 && (
                                                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 shadow-lg rounded-md border border-gray-100 dark:border-gray-700 z-50 max-h-40 overflow-y-auto">
                                                                        {segmentSearchResults.map(res => (
                                                                            <div
                                                                                key={res.id}
                                                                                onClick={(e) => {
                                                                                    e.preventDefault();
                                                                                    setNewSegment(prev => ({ ...prev, itemId: res.id, itemName: res.text, itemList: res.foundInList }));
                                                                                    setSegmentSearchQuery(res.text);
                                                                                    setSegmentSearchResults([]);
                                                                                }}
                                                                                className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                                                                            >
                                                                                <div className="text-xs font-medium text-gray-800 dark:text-gray-200">{res.text}</div>
                                                                                <div className="text-[10px] text-gray-400">{res.foundInList} · {res.year || 'N/A'}</div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {newSegment.itemId && (
                                                                    <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                                                                        <Check size={10} /> Selected: {newSegment.itemName}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {newSegment.type === 'list' && (
                                                            <div className="flex-1">
                                                                <label className="block text-[10px] uppercase text-gray-400 mb-1">Select List</label>
                                                                <select
                                                                    value={newSegment.targetListName}
                                                                    onChange={e => setNewSegment(prev => ({ ...prev, targetListName: e.target.value }))}
                                                                    className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                                                                >
                                                                    <option value="">Select a list...</option>
                                                                    {Object.keys(lists).filter(l => !l.startsWith('special:')).map(l => (
                                                                        <option key={l} value={l}>{l}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}

                                                        <button
                                                            onClick={(e) => { e.preventDefault(); handleAddSegment(); }}
                                                            disabled={
                                                                (newSegment.type === 'item' && !newSegment.itemId) ||
                                                                (newSegment.type === 'list' && !newSegment.targetListName)
                                                            }
                                                            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed h-[34px] w-[34px] flex items-center justify-center shrink-0"
                                                        >
                                                            <Plus size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Dates */}
                                    {/* Dates */}
                                    {item.media_type === 'movie' ? (
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Date Watched</label>
                                            <input
                                                type="date"
                                                value={formData.finish_date || ""}
                                                onChange={(e) => setFormData({ ...formData, finish_date: e.target.value })}
                                                disabled={readOnly || formData.status !== 'completed' || isLockedPlanToWatch}
                                                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Date Started</label>
                                                <input
                                                    type="date"
                                                    value={formData.start_date || ""}
                                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                                    disabled={readOnly || formData.status === 'plan_to_watch' || isLockedPlanToWatch}
                                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                                />
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Date Finished</label>
                                                <input
                                                    type="date"
                                                    value={formData.finish_date || ""}
                                                    onChange={(e) => setFormData({ ...formData, finish_date: e.target.value })}
                                                    disabled={readOnly || isLockedPlanToWatch || formData.status === 'watching'}
                                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Watched In Languages */}
                                < div >
                                    <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Watched In</label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {formData.watched_languages && formData.watched_languages.length > 0 && formData.watched_languages.map((lang, idx) => {
                                            const flagMap = {
                                                'English': '🇺🇸', 'Japanese': '🇯🇵', 'Korean': '🇰🇷', 'Spanish': '🇪🇸',
                                                'French': '🇫🇷', 'German': '🇩🇪', 'Italian': '🇮🇹', 'Portuguese': '🇧🇷',
                                                'Chinese': '🇨🇳', 'Hindi': '🇮🇳', 'Urdu': '🇵🇰', 'Arabic': '🇸🇦',
                                                'Russian': '🇷🇺', 'Thai': '🇹🇭', 'Turkish': '🇹🇷', 'Vietnamese': '🇻🇳',
                                                'Indonesian': '🇮🇩', 'Malay': '🇲🇾', 'Filipino': '🇵🇭', 'Dutch': '🇳🇱',
                                                'Polish': '🇵🇱', 'Swedish': '🇸🇪', 'Norwegian': '🇳🇴', 'Danish': '🇩🇰',
                                                'Finnish': '🇫🇮', 'Greek': '🇬🇷', 'Hebrew': '🇮🇱', 'Czech': '🇨🇿',
                                                'Romanian': '🇷🇴', 'Hungarian': '🇭🇺'
                                            };
                                            return (
                                                <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-blue-300 text-xs rounded-full">
                                                    <span>{flagMap[lang] || '🌐'}</span>
                                                    <span>{lang}</span>
                                                    {!readOnly && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    watched_languages: prev.watched_languages.filter((_, i) => i !== idx)
                                                                }));
                                                            }}
                                                            className="ml-0.5 hover:text-red-400 transition-colors"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </span>
                                            );
                                        })}
                                    </div>
                                    {
                                        !readOnly && !isLockedPlanToWatch && (
                                            <div className="relative inline-block" ref={langDropdownRef}>
                                                <button
                                                    type="button"
                                                    disabled={readOnly || (item.media_type === 'movie' && (formData.status === 'plan_to_watch' || formData.status === 'not_interested'))}
                                                    onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                                                    className="w-52 flex items-center justify-between gap-2 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-300 cursor-pointer hover:bg-gray-700/50 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <span>+ Add language</span>
                                                    <svg className={`w-4 h-4 transition-transform ${isLangDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>

                                                {isLangDropdownOpen && (
                                                    <div className="absolute top-full left-0 mt-1 w-52 max-h-48 overflow-y-auto bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
                                                        <div className="p-1">
                                                            {[
                                                                { code: 'English', flag: '🇺🇸' },
                                                                { code: 'Japanese', flag: '🇯🇵' },
                                                                { code: 'Korean', flag: '🇰🇷' },
                                                                { code: 'Spanish', flag: '🇪🇸' },
                                                                { code: 'French', flag: '🇫🇷' },
                                                                { code: 'German', flag: '🇩🇪' },
                                                                { code: 'Chinese', flag: '🇨🇳' },
                                                                { code: 'Hindi', flag: '🇮🇳' },
                                                                { code: 'Urdu', flag: '🇵🇰' },
                                                                { code: 'Arabic', flag: '🇸🇦' },
                                                                { code: 'Russian', flag: '🇷🇺' },
                                                                { code: 'Portuguese', flag: '🇧🇷' },
                                                                { code: 'Italian', flag: '🇮🇹' },
                                                                { code: 'Thai', flag: '🇹🇭' },
                                                                { code: 'Turkish', flag: '🇹🇷' }
                                                            ].filter(lang => !formData.watched_languages?.includes(lang.code)).map(lang => (
                                                                <button
                                                                    key={lang.code}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            watched_languages: [...(prev.watched_languages || []), lang.code]
                                                                        }));
                                                                        setIsLangDropdownOpen(false);
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-200 hover:bg-gray-700 transition-colors flex items-center gap-2"
                                                                >
                                                                    <span>{lang.flag}</span>
                                                                    <span>{lang.code}</span>
                                                                </button>
                                                            ))}
                                                            {formData.watched_languages?.length >= 15 && (
                                                                <div className="px-3 py-2 text-xs text-gray-500 text-center">All languages selected</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    }
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Personal Notes</label>
                                    <textarea
                                        rows={4}
                                        value={formData.note}
                                        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                                        disabled={readOnly || formData.status === 'plan_to_watch' || (isLockedPlanToWatch && formData.status !== 'dropped' && formData.status !== 'not_interested')}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                                        placeholder={readOnly ? "No notes" : "Write your thoughts here..."}
                                    />
                                </div>

                                <div className="pt-4 flex justify-end">
                                    {/* Removed Button from here to pin it to footer */}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer - Pinned Save Button */}
                    {activeTab === "mylist" && !readOnly && (
                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 z-10 shrink-0">
                            <button
                                onClick={handleSave}
                                className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Save size={18} />
                                Save Changes
                            </button>
                        </div>
                    )}
                </div>

            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                isDangerous={confirmModal.isDangerous}
                confirmText={confirmModal.confirmText}
            />

            {/* Lightbox Overlay */}
            {
                zoomedImage && (
                    <div
                        className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fade-in overflow-hidden"
                        onClick={() => setZoomedImage(null)}
                    >
                        {/* Blurred Background Image */}
                        <div className="absolute inset-0 z-0">
                            <img
                                src={zoomedImage}
                                alt="Background"
                                className="w-full h-full object-cover blur-xl scale-110"
                            />
                            <div className="absolute inset-0 bg-white/70 dark:bg-black/70" /> {/* Adaptive Mat Overlay */}
                        </div>

                        <button
                            className="absolute top-4 right-4 p-2 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-gray-900 dark:text-white rounded-full transition-colors z-20"
                            onClick={() => setZoomedImage(null)}
                        >
                            <X size={32} />
                        </button>

                        <img
                            src={zoomedImage}
                            alt="Zoomed"
                            className="relative z-10 max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-scale-up"
                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image itself
                        />
                    </div>
                )
            }

            {/* Episode Selection Overlay */}
            {viewingSeasonEpisodes !== null && (
                <div
                    className="fixed inset-0 z-[75] flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setViewingSeasonEpisodes(null)}
                >
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                    <div
                        className="relative z-10 bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                            <div>
                                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">
                                    Season {viewingSeasonEpisodes}
                                </h3>
                                <p className="text-xs text-gray-500">Select episodes you have watched</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Select All Button */}
                                <button
                                    onClick={() => handleSelectAllSeason(
                                        viewingSeasonEpisodes,
                                        seasonEpisodesCache[`season_${item.tmdb_id || item.id}_${viewingSeasonEpisodes}`] || []
                                    )}
                                    className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg transition-colors"
                                >
                                    Toggle All
                                </button>
                                <button
                                    onClick={() => setViewingSeasonEpisodes(null)}
                                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            {!seasonEpisodesCache[`season_${item.tmdb_id || item.id}_${viewingSeasonEpisodes}`] ? (
                                <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-sm">Loading episodes...</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-1">
                                    {(seasonEpisodesCache[`season_${item.tmdb_id || item.id}_${viewingSeasonEpisodes}`] || []).map(ep => {
                                        const isWatched = (formData.season_watched_episodes[viewingSeasonEpisodes] || []).includes(ep.episode_number);
                                        return (
                                            <div
                                                key={ep.id}
                                                className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border
                                                    ${isWatched
                                                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50"
                                                        : "bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                                                onClick={() => toggleSeasonEpisode(
                                                    viewingSeasonEpisodes,
                                                    ep.episode_number,
                                                    seasonEpisodesCache[`season_${item.tmdb_id || item.id}_${viewingSeasonEpisodes}`].length
                                                )}
                                            >
                                                <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center transition-colors ${isWatched ? "bg-blue-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-transparent"}`}>
                                                    <Check size={14} strokeWidth={3} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <span className={`text-sm font-medium ${isWatched ? "text-blue-900 dark:text-blue-100" : "text-gray-700 dark:text-gray-300"}`}>
                                                            {ep.episode_number}. {ep.name}
                                                        </span>
                                                        <span className="text-xs text-gray-400 tabular-nums flex items-center gap-1">
                                                            <span>{ep.air_date?.split('-')[0]}</span>
                                                            {ep.runtime > 0 && <span>• {ep.runtime}m</span>}
                                                        </span>
                                                    </div>
                                                    {ep.overview && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{ep.overview}</p>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex justify-end">
                            <button
                                onClick={() => setViewingSeasonEpisodes(null)}
                                className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default ItemDetailsModal;

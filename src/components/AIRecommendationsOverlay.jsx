import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Loader2, AlertCircle, RefreshCw, Clock, ChevronLeft, ChevronRight, Calendar, Trophy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { analyzeWatchlist, getRecommendations, getDailyChallenge } from '../utils/geminiService';
import AddToListModal from './AddToListModal';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const RECOMMENDATIONS_COOLDOWN_HOURS = 24 * 7;
const RECOMMENDATIONS_COOLDOWN_MS = RECOMMENDATIONS_COOLDOWN_HOURS * 60 * 60 * 1000;
const CHALLENGE_COOLDOWN_HOURS = 24;
const CHALLENGE_COOLDOWN_MS = CHALLENGE_COOLDOWN_HOURS * 60 * 60 * 1000;

// Swiper imports
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Pagination, Navigation, Mousewheel, FreeMode } from 'swiper/modules';

// Swiper styles
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import 'swiper/css/free-mode';

// Sub-component for horizontal scrollable row using Swiper
const HorizontalScrollRow = ({ items, onItemClick }) => {
    return (
        <div className="w-full py-8">
            <Swiper
                effect={'coverflow'}
                grabCursor={true}
                centeredSlides={true}
                slidesPerView={'auto'}
                loop={true}
                freeMode={{
                    enabled: true,
                    sticky: true,
                    momentum: true,
                }}
                coverflowEffect={{
                    rotate: 20,
                    stretch: 0,
                    depth: 200,
                    modifier: 1,
                    slideShadows: true,
                }}
                pagination={{ clickable: true }}
                navigation={false}
                mousewheel={{
                    sensitivity: 2.5,
                    releaseOnEdges: true,
                }}
                modules={[EffectCoverflow, Pagination, Navigation, Mousewheel, FreeMode]}
                className="w-full !pb-12" // Added padding bottom for pagination
                threshold={10}
                breakpoints={{
                    320: {
                        slidesPerView: 'auto',
                    },
                    640: {
                        slidesPerView: 'auto',
                    },
                    768: {
                        slidesPerView: 'auto',
                    },
                    1024: {
                        slidesPerView: 'auto',
                    },
                }}
            >
                {items.map((item, itemIndex) => (
                    <SwiperSlide
                        key={item.tmdb_id || itemIndex}
                        className="!w-64" // Fixed width for coverflow effect to look good
                    >
                        <div
                            onClick={() => onItemClick(item)}
                            className="group relative cursor-pointer"
                        >
                            {/* Poster */}
                            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-700 shadow-xl transition-all duration-300">
                                {item.poster_path ? (
                                    <img
                                        src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                                        alt={item.title}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        No Image
                                    </div>
                                )}

                                {/* Overlay on hover */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 text-left">
                                    <h4 className="text-lg font-bold text-white line-clamp-2 leading-tight mb-1 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                        {item.title}
                                    </h4>
                                    <div className="flex items-center gap-2 text-sm text-gray-300 mb-3 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${item.type === 'movie'
                                            ? 'bg-blue-500/40 text-blue-100 border border-blue-400/50'
                                            : 'bg-purple-500/40 text-purple-100 border border-purple-400/50'
                                            }`}>
                                            {item.type === 'movie' ? 'Movie' : 'TV'}
                                        </span>
                                        <span>{item.year}</span>
                                        {item.vote_average && (
                                            <span className="flex items-center gap-1 text-yellow-400 font-bold">
                                                ★ {item.vote_average.toFixed(1)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-blue-400 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-100">
                                        <Sparkles size={16} />
                                        <span className="font-medium text-sm">Click to Add</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </SwiperSlide>
                ))}
            </Swiper>

            {/* Custom styles for Swiper pagination and navigation if needed */}
            <style>{`
                .swiper-pagination {
                    bottom: 0 !important;
                }
                .swiper-pagination-bullet {
                    background: #9ca3af !important;
                    width: 8px;
                    height: 8px;
                }
                .swiper-pagination-bullet-active {
                    background: #3b82f6 !important;
                    width: 24px;
                    border-radius: 4px;
                    transition: width 0.3s ease;
                }
            `}</style>
        </div>
    );
};

const AIRecommendationsOverlay = ({ isOpen, onClose, lists, onAddItem, userId, token, showToast }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [recommendations, setRecommendations] = useState(null);
    const [addToListModal, setAddToListModal] = useState({
        isOpen: false,
        item: null
    });
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const [lastFetchTime, setLastFetchTime] = useState(null);
    const [hasNoItems, setHasNoItems] = useState(false);

    // Daily Challenge State
    const [activeTab, setActiveTab] = useState('recommendations'); // 'recommendations' | 'challenge'
    const [dailyChallenge, setDailyChallenge] = useState(null);
    const [isChallengeHovered, setIsChallengeHovered] = useState(false);
    const [challengeLoading, setChallengeLoading] = useState(false);
    const [challengeError, setChallengeError] = useState(null);
    const [challengeCooldownRemaining, setChallengeCooldownRemaining] = useState(0);
    const [challengeLastFetchTime, setChallengeLastFetchTime] = useState(null);
    const [isCheckingChallengeTimestamp, setIsCheckingChallengeTimestamp] = useState(true);

    // localStorage key for caching recommendations
    const getStorageKey = () => `ai_recommendations_cache_${userId || 'default'}`;

    // Save recommendations to localStorage
    const saveToCache = (data) => {
        try {
            localStorage.setItem(getStorageKey(), JSON.stringify(data));
        } catch (err) {
            console.error('Failed to save recommendations to cache:', err);
        }
    };

    // Load recommendations from localStorage
    const loadFromCache = () => {
        try {
            const cached = localStorage.getItem(getStorageKey());
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (err) {
            console.error('Failed to load recommendations from cache:', err);
        }
        return null;
    };

    // Check if there are any items in the lists
    const checkForItems = () => {
        if (!lists) return false;
        const totalItems = Object.values(lists).flat().filter(item => item?.text).length;
        return totalItems > 0;
    };

    // Fetch cooldown status from server
    const fetchCooldownStatus = async () => {
        if (!token) return;
        try {
            const response = await axios.get('/api/ai-cooldown', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const lastFetch = response.data.lastFetch;
            if (lastFetch) {
                setLastFetchTime(new Date(lastFetch).getTime());
                const elapsed = Date.now() - new Date(lastFetch).getTime();
                const remaining = COOLDOWN_MS - elapsed;
                setCooldownRemaining(remaining > 0 ? remaining : 0);
            } else {
                setCooldownRemaining(0);
            }
        } catch (err) {
            console.error('Failed to fetch cooldown status:', err);
            setCooldownRemaining(0);
        }
    };

    // Update cooldown on server after successful fetch
    const updateCooldownOnServer = async () => {
        if (!token) {
            console.warn('AI Cooldown: No token available');
            return;
        }
        try {
            console.log('AI Cooldown: Updating cooldown on server...');
            const response = await axios.post('/api/ai-cooldown', {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('AI Cooldown: Server response:', response.data);
            setLastFetchTime(Date.now());
            setCooldownRemaining(RECOMMENDATIONS_COOLDOWN_MS);
        } catch (err) {
            console.error('Failed to update cooldown:', err);
        }
    };

    // Fetch cooldown status when opening and decide whether to auto-fetch
    useEffect(() => {
        if (!isOpen) return;

        const initializeRecommendations = async () => {
            // Check if there are any items to analyze
            const hasItems = checkForItems();
            if (!hasItems) {
                setHasNoItems(true);
                return;
            }
            setHasNoItems(false);

            // Try to load cached recommendations first
            const cachedRecommendations = loadFromCache();
            if (cachedRecommendations) {
                setRecommendations(cachedRecommendations);
            }

            // Check cooldown status from server
            let hasCooldown = false;
            if (token) {
                try {
                    const response = await axios.get('/api/ai-cooldown', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const lastFetch = response.data.lastFetch;
                    if (lastFetch) {
                        setLastFetchTime(new Date(lastFetch).getTime());
                        const elapsed = Date.now() - new Date(lastFetch).getTime();
                        const remaining = RECOMMENDATIONS_COOLDOWN_MS - elapsed;
                        if (remaining > 0) {
                            setCooldownRemaining(remaining);
                            hasCooldown = true;
                        } else {
                            setCooldownRemaining(0);
                        }
                    }
                } catch (err) {
                    console.error('Failed to fetch cooldown status:', err);
                }
            }

            // Only auto-fetch if no cooldown AND no cached recommendations
            if (!hasCooldown && !cachedRecommendations && !loading) {
                fetchRecommendations();
            }
        };

        initializeRecommendations();

        // Update countdown every minute
        const interval = setInterval(() => {
            if (lastFetchTime) {
                const elapsed = Date.now() - lastFetchTime;
                const remaining = RECOMMENDATIONS_COOLDOWN_MS - elapsed;
                setCooldownRemaining(remaining > 0 ? remaining : 0);
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [isOpen, token]);

    // Handle Daily Challenge Logic & Timer
    useEffect(() => {
        if (!isOpen) return;

        // Fetch Daily Challenge Timestamp Persistence
        const fetchChallengeTimestamp = async () => {
            if (!token) return;
            try {
                const response = await axios.get('/api/daily-challenge-timestamp', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const lastFetch = response.data.lastFetch;
                if (lastFetch) {
                    setChallengeLastFetchTime(new Date(lastFetch).getTime());
                    const elapsed = Date.now() - new Date(lastFetch).getTime();
                    const remaining = CHALLENGE_COOLDOWN_MS - elapsed;
                    setChallengeCooldownRemaining(remaining > 0 ? remaining : 0);
                }
            } catch (err) {
                console.error('Failed to fetch challenge timestamp:', err);
            } finally {
                setIsCheckingChallengeTimestamp(false);
            }
        };

        fetchChallengeTimestamp();

        // Interval for Challenge Timer
        const interval = setInterval(() => {
            setChallengeCooldownRemaining(prev => {
                const newRemaining = prev - 60000;
                return newRemaining > 0 ? newRemaining : 0;
            });
        }, 60000);

        return () => clearInterval(interval);
    }, [isOpen, token]);

    useEffect(() => {
        if (!isOpen || activeTab !== 'challenge') return;

        // Wait for server check
        if (isCheckingChallengeTimestamp) return;

        // If cooldown is active, don't generate new
        // If cooldown is active, we might still want to load cache if available (e.g. refresh page)
        // So we DON'T return early here anymore. We let loadDailyChallenge handle the logic.
        // if (challengeCooldownRemaining > 0 && !dailyChallenge) { ... }

        if (dailyChallenge) return; // Already have one loaded

        const loadDailyChallenge = async () => {
            setChallengeLoading(true);
            setChallengeError(null);

            const userIdKey = userId || 'default';
            const today = new Date().toISOString().split('T')[0];
            const challengeKey = `daily_challenge_${userIdKey}_${today}`;


            // 1. Try to load from cache
            let cachedItem = null;
            try {
                const cachedChallenge = localStorage.getItem(challengeKey);
                if (cachedChallenge) {
                    cachedItem = JSON.parse(cachedChallenge);
                }
            } catch (err) {
                console.error('Failed to load challenge from cache:', err);
            }

            // 2. Decide: Use Cache or Fetch New?
            // If cooldown is active (server says wait), we MUST use cache or show timer.
            if (challengeCooldownRemaining > 0) {
                if (cachedItem) {
                    setDailyChallenge(cachedItem);
                    setChallengeLoading(false);
                    return;
                }
                // If no cache but cooldown active -> User on new device? Show Timer.
                setChallengeLoading(false);
                return;
            }

            // 3. If cooldown expired (== 0), we fetch NEW, ignoring old cache (unless we just fetched it today? No, cooldown 0 implies we can re-roll).
            // However, to prevent infinite re-rolls on refresh if cooldown is 0 (like in testing), we should check if the cached item is "fresh" enough?
            // Actually, if cooldown is 0, we imply "Time to get a new one".
            // So we proceed to fetch new.

            // Fetch New Challenge
            try {
                const watchlistSummary = analyzeWatchlist(lists);
                const challengeItem = await getDailyChallenge(watchlistSummary);

                // Enfich with TMDB
                const [enrichedItem] = await searchTMDBForItems([challengeItem]);

                if (enrichedItem) {
                    const finalItem = { ...enrichedItem, ...challengeItem, date: today };
                    setDailyChallenge(finalItem);
                    localStorage.setItem(challengeKey, JSON.stringify(finalItem));

                    // Update Server Persistence
                    if (token) {
                        axios.post('/api/daily-challenge-timestamp',
                            { timestamp: new Date() },
                            { headers: { 'Authorization': `Bearer ${token}` } }
                        ).then(() => {
                            setChallengeLastFetchTime(Date.now());
                            setChallengeCooldownRemaining(CHALLENGE_COOLDOWN_MS);
                        }).catch(err => console.error('Failed to persist challenge time:', err));
                    }
                } else {
                    throw new Error('Failed to find challenge movie on TMDB');
                }
            } catch (err) {
                console.error('Daily Challenge Error:', err);
                setChallengeError('Failed to load today\'s challenge. Please try again.');
            } finally {
                setChallengeLoading(false);
            }
        };

        loadDailyChallenge();
    }, [isOpen, activeTab, userId, lists, dailyChallenge, challengeCooldownRemaining, token, isCheckingChallengeTimestamp]);


    const fetchRecommendations = async () => {
        setLoading(true);
        setError(null);

        try {
            // Step 1: Analyze watchlist
            const watchlistSummary = analyzeWatchlist(lists);

            // Step 2: Get AI recommendations
            const aiRecommendations = await getRecommendations(watchlistSummary);

            // Step 3: Search TMDB for each recommended title
            const enrichedCategories = await Promise.all(
                aiRecommendations.categories.map(async (category) => {
                    const enrichedItems = await searchTMDBForItems(category.items);
                    return {
                        ...category,
                        items: enrichedItems.filter(item => item !== null) // Remove failed searches
                    };
                })
            );

            setRecommendations({ categories: enrichedCategories });

            // Save to localStorage cache
            saveToCache({ categories: enrichedCategories });

            // Save timestamp on server for cooldown
            await updateCooldownOnServer();
        } catch (err) {
            console.error('Recommendations error:', err);
            setError(err.message || 'Failed to load recommendations');
        } finally {
            setLoading(false);
        }
    };


    const handleRefresh = () => {
        if (cooldownRemaining > 0 || loading) return;

        // Check if there are any items to analyze
        if (!checkForItems()) {
            setHasNoItems(true);
            setRecommendations(null);
            return;
        }

        setHasNoItems(false);
        setRecommendations(null);
        fetchRecommendations();
    };

    const searchTMDBForItems = async (items) => {
        const searchPromises = items.map(async (item) => {
            try {
                // Search TMDB for the title
                const searchType = item.type === 'movie' ? 'movie' : 'tv';
                const response = await axios.get(
                    `https://api.themoviedb.org/3/search/${searchType}`,
                    {
                        params: {
                            api_key: TMDB_API_KEY,
                            query: item.title,
                            year: item.year
                        }
                    }
                );

                if (response.data.results && response.data.results.length > 0) {
                    const tmdbItem = response.data.results[0];
                    return {
                        ...item,
                        tmdb_id: tmdbItem.id,
                        poster_path: tmdbItem.poster_path,
                        overview: tmdbItem.overview,
                        vote_average: tmdbItem.vote_average,
                        // Use correct title field based on type
                        title: searchType === 'movie' ? tmdbItem.title : tmdbItem.name
                    };
                }

                return null; // Not found on TMDB
            } catch (err) {
                console.error(`Failed to search TMDB for ${item.title}:`, err);
                return null;
            }
        });

        return Promise.all(searchPromises);
    };

    const handleAddToList = async (listName, item) => {
        const targetList = lists[listName];

        // 1. Enhanced Duplicate Check
        if (targetList) {
            const isDuplicate = targetList.some(existingItem => {
                // Check standard tmdb_id
                if (existingItem.tmdb_id && existingItem.tmdb_id === item.tmdb_id) return true;
                // Check if the main 'id' matches the TMDB ID (common in manual adds)
                if (existingItem.id && String(existingItem.id) === String(item.tmdb_id)) return true;
                // Fallback: Title + Year match
                if (existingItem.text === item.title && String(existingItem.year) === String(item.year)) return true;
                return false;
            });

            if (isDuplicate) {
                if (showToast) {
                    showToast(`"${item.title}" is already in the list "${listName}"!`, "error");
                } else {
                    alert(`"${item.title}" is already in the list "${listName}"!`);
                }
                return;
            }
        }

        // 2. Fetch Accurate Runtime Details
        let additionalDetails = {};
        try {
            const searchType = item.type === 'movie' ? 'movie' : 'tv';
            const detailsResponse = await axios.get(
                `https://api.themoviedb.org/3/${searchType}/${item.tmdb_id}`,
                {
                    params: { api_key: TMDB_API_KEY }
                }
            );

            if (detailsResponse.data) {
                if (searchType === 'movie') {
                    additionalDetails.runtime = detailsResponse.data.runtime;
                    if (detailsResponse.data.title) additionalDetails.text = detailsResponse.data.title;
                } else {
                    additionalDetails.episode_run_time = detailsResponse.data.episode_run_time;
                    additionalDetails.number_of_episodes = detailsResponse.data.number_of_episodes; // Useful only if tracking whole show
                    additionalDetails.number_of_seasons = detailsResponse.data.number_of_seasons;
                    if (detailsResponse.data.name) additionalDetails.text = detailsResponse.data.name;
                }
            }
        } catch (err) {
            console.error('Failed to fetch runtime details:', err);
            // Non-blocking, continue with basic info
        }

        // Prepare item for addition with completed status
        const newItem = {
            text: item.title,
            media_type: item.type,
            tmdb_id: item.tmdb_id,
            id: item.tmdb_id, // Explicitly set ID to TMDB ID to help future duplicate checks
            image: item.poster_path,
            year: item.year,
            status: 'plan_to_watch', // Changed from 'completed' to 'plan_to_watch' as this is usually for recommendations
            ...additionalDetails
        };

        onAddItem(listName, newItem);
        setAddToListModal({ isOpen: false, item: null });
    };

    // Format time remaining
    const formatCooldown = (ms) => {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    if (!isOpen) return null;

    const canRefresh = cooldownRemaining === 0 && !loading;

    return (
        <>
            <div className="fixed inset-0 z-[200] bg-gray-100 dark:bg-gray-900 overflow-y-auto animate-fade-in custom-scrollbar">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex justify-between items-center max-w-7xl mx-auto w-full gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <Sparkles className="text-blue-500" />
                            AI Recommendations
                        </h2>
                    </div>

                    {/* Centered Pill Tabs */}
                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('recommendations')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'recommendations'
                                ? 'bg-blue-500 text-white shadow-md'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                        >
                            <Sparkles size={16} />
                            <span className="hidden sm:inline">Recommendations</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('challenge')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'challenge'
                                ? 'bg-purple-500 text-white shadow-md'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                        >
                            <Trophy size={16} />
                            <span className="hidden sm:inline">Daily Challenge</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Refresh Button - Only visible on Recommendations tab */}
                        {activeTab === 'recommendations' && recommendations && (
                            <button
                                onClick={handleRefresh}
                                disabled={!canRefresh}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
                                    ${canRefresh
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                                    }`}
                                title={canRefresh ? 'Get new recommendations' : `Available in ${formatCooldown(cooldownRemaining)}`}
                            >
                                {!canRefresh && <Clock size={16} />}
                                {canRefresh && <RefreshCw size={16} />}
                                <span className="hidden lg:inline">{canRefresh ? 'Refresh' : formatCooldown(cooldownRemaining)}</span>
                            </button>
                        )}

                        {/* Daily Challenge Refresh Button */}
                        {activeTab === 'challenge' && dailyChallenge && (
                            <button
                                onClick={() => setDailyChallenge(null)}
                                disabled={challengeCooldownRemaining > 0 || challengeLoading}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
                                    ${challengeCooldownRemaining === 0 && !challengeLoading
                                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                                    }`}
                                title={challengeCooldownRemaining === 0 ? 'Get new challenge' : `Available in ${formatCooldown(challengeCooldownRemaining)}`}
                            >
                                {challengeCooldownRemaining > 0 ? <Clock size={16} /> : <RefreshCw size={16} />}
                                <span className="hidden lg:inline">
                                    {challengeCooldownRemaining === 0 ? 'Refresh' : formatCooldown(challengeCooldownRemaining)}
                                </span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                        >
                            <X size={24} className="text-gray-600 dark:text-gray-300" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="max-w-7xl mx-auto w-full p-6 pb-20">
                    {/* Recommendations Tab Content */}
                    {activeTab === 'recommendations' && (
                        <>
                            {loading && (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
                                    <p className="text-gray-600 dark:text-gray-400 text-lg">
                                        AI is analyzing your watchlist...
                                    </p>
                                    <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                                        This may take a few moments
                                    </p>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 flex items-start gap-4">
                                    <AlertCircle className="text-red-500 flex-shrink-0 mt-1" size={24} />
                                    <div>
                                        <h3 className="text-red-900 dark:text-red-200 font-bold mb-2">
                                            Failed to load recommendations
                                        </h3>
                                        <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
                                        <button
                                            onClick={fetchRecommendations}
                                            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* No items message */}
                            {hasNoItems && (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-6">
                                        <Sparkles size={40} className="text-blue-500" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                        No Items to Analyze
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
                                        Add some movies or TV shows to your lists first, then come back for personalized AI recommendations!
                                    </p>
                                    <button
                                        onClick={onClose}
                                        className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium"
                                    >
                                        Start Adding Items
                                    </button>
                                </div>
                            )}

                            {/* Cooldown message when no recommendations loaded */}
                            {!loading && !error && !recommendations && !hasNoItems && cooldownRemaining > 0 && (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <Clock size={64} className="text-blue-500 mb-6" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                        Recommendations on Cooldown
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
                                        You can get new AI recommendations in:
                                    </p>
                                    <div className="text-4xl font-bold text-blue-500 mb-6">
                                        {formatCooldown(cooldownRemaining)}
                                    </div>
                                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center max-w-md">
                                        The 24-hour cooldown helps manage API usage. Come back later for fresh personalized suggestions!
                                    </p>
                                </div>
                            )}
                            {recommendations && !loading && (
                                <div className="space-y-12">
                                    {recommendations.categories.map((category, catIndex) => (
                                        <div key={catIndex} className="space-y-4">
                                            <div className="flex items-baseline gap-3">
                                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                                    {category.name}
                                                </h3>
                                                <span className="text-sm text-gray-400 dark:text-gray-500">
                                                    {category.items.length} recommendations
                                                </span>
                                            </div>

                                            {/* Horizontal Scrollable List with Arrows */}
                                            <HorizontalScrollRow
                                                items={category.items}
                                                onItemClick={(item) => setAddToListModal({ isOpen: true, item })}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* Challenges Tab Content */}
                    {activeTab === 'challenge' && (
                        <div className="flex flex-col items-center justify-center py-10 animate-fade-in">
                            {challengeLoading ? (
                                <div className="flex flex-col items-center">
                                    <Loader2 size={48} className="text-purple-500 animate-spin mb-4" />
                                    <p className="text-gray-600 dark:text-gray-400">Curating your daily challenge...</p>
                                </div>
                            ) : challengeCooldownRemaining > 0 && !dailyChallenge ? (
                                // Timer State (Server says wait, but no local cache)
                                <div className="flex flex-col items-center gap-6 z-10 text-center p-8 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-sm max-w-md mx-auto">
                                    <div className="p-4 bg-white/10 rounded-full animate-pulse-slow">
                                        <Clock size={48} className="text-gray-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Challenge Accepted</h3>
                                        <p className="text-gray-500 dark:text-gray-400">You have already received your daily movie challenge. Come back later for a new one!</p>
                                    </div>
                                    <div className="text-4xl font-mono font-bold text-blue-500 tracking-wider">
                                        {formatCooldown(challengeCooldownRemaining)}
                                    </div>
                                </div>
                            ) : challengeError ? (
                                <div className="text-center text-red-500 p-6">
                                    <AlertCircle size={48} className="mx-auto mb-4" />
                                    <p>{challengeError}</p>
                                </div>
                            ) : dailyChallenge ? (
                                <div className="w-full max-w-5xl">
                                    <div className="text-center mb-10">
                                        <h3 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-500 mb-2">
                                            Today's Watch Challenge
                                        </h3>
                                        <p className="text-gray-500 dark:text-gray-400 text-lg">
                                            Accept the challenge and watch this masterpiece.
                                        </p>
                                    </div>

                                    <div
                                        className="relative flex flex-col md:flex-row items-center justify-center min-h-[500px]"
                                        onMouseEnter={() => setIsChallengeHovered(true)}
                                        onMouseLeave={() => setIsChallengeHovered(false)}
                                    >
                                        {/* Movie Card */}
                                        <motion.div
                                            className="relative z-20 rounded-3xl overflow-hidden shadow-2xl mx-auto md:mx-0 aspect-[2/3] w-full max-w-sm border-4 border-purple-500/20 transition-colors duration-500 cursor-pointer"
                                            animate={{
                                                x: isChallengeHovered ? -140 : 0,
                                                scale: isChallengeHovered ? 1.05 : 1,
                                                borderColor: isChallengeHovered ? 'rgba(168, 85, 247, 1)' : 'rgba(168, 85, 247, 0.2)'
                                            }}
                                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                            style={{ x: 0 }}
                                            whileHover={{}}
                                        >
                                            {/* Poster */}
                                            <img
                                                src={`https://image.tmdb.org/t/p/w780${dailyChallenge.poster_path}`}
                                                alt={dailyChallenge.title}
                                                className="w-full h-full object-cover"
                                            />

                                            {/* Overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent flex flex-col justify-end p-8 text-white">
                                                <div className="transform translate-y-4 transition-transform duration-300">
                                                    <h2 className="text-3xl font-extrabold mb-2 leading-tight">
                                                        {dailyChallenge.title}
                                                    </h2>
                                                    <div className="flex items-center gap-4 mb-4 text-gray-300">
                                                        <span className="text-lg">{dailyChallenge.year}</span>
                                                        <span className="flex items-center gap-1 text-yellow-400 font-bold bg-black/40 px-2 py-0.5 rounded-lg backdrop-blur-sm">
                                                            ★ {dailyChallenge.vote_average?.toFixed(1)}
                                                        </span>
                                                    </div>

                                                    {/* Mobile Only Reason */}
                                                    <p className="md:hidden text-gray-200 mb-6 italic border-l-4 border-purple-500 pl-4 py-1 bg-black/40 backdrop-blur-sm rounded-r-lg">
                                                        "{dailyChallenge.reason}"
                                                    </p>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setAddToListModal({ isOpen: true, item: dailyChallenge });
                                                        }}
                                                        className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-purple-500/50 transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <Trophy size={20} />
                                                        Accept Challenge
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>

                                        {/* Desktop Side Annotation - Animated */}
                                        <AnimatePresence>
                                            {isChallengeHovered && (
                                                <motion.div
                                                    initial={{ opacity: 0, x: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, x: 180, scale: 1 }}
                                                    exit={{ opacity: 0, x: 40, scale: 0.9 }}
                                                    transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
                                                    className="hidden md:flex absolute z-10 items-center justify-center left-1/2 -ml-[140px]"
                                                    style={{ width: '280px' }}
                                                >
                                                    {/* Connector Line */}
                                                    <div className="absolute right-full top-1/2 -translate-y-1/2 w-12 h-[2px] bg-purple-500 origin-right" />
                                                    <div className="absolute right-full top-1/2 -translate-y-1/2 -translate-x-12 w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]" />

                                                    {/* Text Bubble */}
                                                    <div className="bg-gray-900/90 backdrop-blur-xl border border-purple-500/50 p-6 rounded-xl shadow-2xl">
                                                        <div className="text-purple-400 font-bold mb-2 text-sm uppercase tracking-wider flex items-center gap-2">
                                                            <Sparkles size={14} />
                                                            Why you should watch
                                                        </div>
                                                        <p className="text-gray-100 italic leading-relaxed text-lg font-light">
                                                            "{dailyChallenge.reason}"
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Simple Date Display */}
                                    <div className="flex items-center justify-center gap-2 text-gray-400 mt-12 text-sm">
                                        <Calendar size={14} />
                                        <span>Challenge for {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                        {/* Show timer if active (and we are showing the movie) */}
                                        {challengeCooldownRemaining > 0 && (
                                            <div className="ml-4 px-3 py-1 rounded-full bg-black/40 border border-white/10 flex items-center gap-2 text-gray-400 text-sm">
                                                <Clock size={12} />
                                                <span>Next: {formatCooldown(challengeCooldownRemaining)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            </div>

            {/* Add to List Modal */}
            <AddToListModal
                isOpen={addToListModal.isOpen}
                onClose={() => setAddToListModal({ isOpen: false, item: null })}
                item={addToListModal.item}
                lists={lists}
                onConfirm={handleAddToList}
            />
        </>
    );
};

export default AIRecommendationsOverlay;


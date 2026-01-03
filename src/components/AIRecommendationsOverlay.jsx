import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Loader2, AlertCircle, RefreshCw, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { analyzeWatchlist, getRecommendations } from '../utils/geminiService';
import AddToListModal from './AddToListModal';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const COOLDOWN_HOURS = 24 * 4;
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

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

const AIRecommendationsOverlay = ({ isOpen, onClose, lists, onAddItem, userId, token }) => {
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
            setCooldownRemaining(COOLDOWN_MS);
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
                        const remaining = COOLDOWN_MS - elapsed;
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
                const remaining = COOLDOWN_MS - elapsed;
                setCooldownRemaining(remaining > 0 ? remaining : 0);
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [isOpen, token]);


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

    const handleAddToList = (listName, item) => {
        // Prepare item for addition with completed status
        const newItem = {
            text: item.title,
            media_type: item.type,
            tmdb_id: item.tmdb_id,
            image: item.poster_path,
            year: item.year,
            status: 'completed' // Default to completed as per requirements
        };

        onAddItem(listName, newItem);
        setAddToListModal({ isOpen: false, item: null });
    };

    // Format time remaining
    const formatTimeRemaining = (ms) => {
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
                <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex justify-between items-center max-w-7xl mx-auto w-full">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <Sparkles className="text-blue-500" />
                            AI Recommendations
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Personalized suggestions based on your watchlist
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Refresh Button */}
                        {recommendations && (
                            <button
                                onClick={handleRefresh}
                                disabled={!canRefresh}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
                                    ${canRefresh
                                        ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-md hover:shadow-lg'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                    }`}
                                title={canRefresh ? 'Get new recommendations' : `Available in ${formatTimeRemaining(cooldownRemaining)}`}
                            >
                                {!canRefresh && <Clock size={16} />}
                                {canRefresh && <RefreshCw size={16} />}
                                {canRefresh ? 'Refresh' : formatTimeRemaining(cooldownRemaining)}
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
                                {formatTimeRemaining(cooldownRemaining)}
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


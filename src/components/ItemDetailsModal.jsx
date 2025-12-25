import React, { useState, useEffect } from "react";
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
    Info
} from "lucide-react";

const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const detailsCache = {};

const ItemDetailsModal = ({ isOpen, onClose, item, onSave, onDropSeason, listName, droppedSeasonNumbers = [] }) => {
    if (!isOpen || !item) return null;

    const [activeTab, setActiveTab] = useState("info");
    const [details, setDetails] = useState(null);


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
        note: item.note || ""
    });

    // Auto-Complete Logic
    useEffect(() => {
        if (!details) return;

        let total = 0;
        // Determine total based on type
        if (details.isSeason || item.media_type === 'tv_season') {
            total = details.episodes?.length || 0;
        } else if (item.media_type === 'tv') {
            total = details.number_of_episodes || 0;
        }

        // If watched equals total (and total > 0), set to completed
        if (total > 0) {
            if (formData.episodes_watched >= total && formData.status !== 'completed') {
                setFormData(prev => ({ ...prev, status: 'completed' }));
            } else if (formData.episodes_watched < total && formData.status === 'completed') {
                // Automatically switch back to watching if un-completed
                setFormData(prev => ({ ...prev, status: 'watching' }));
            } else if (formData.episodes_watched > 0 && formData.status === 'plan_to_watch') {
                // Automatically switch to watching if progress started (and not dropped)
                setFormData(prev => ({ ...prev, status: 'watching' }));
            }
        }
    }, [formData.episodes_watched, details, item.media_type, formData.status]);



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
                        append_to_response: "credits,images,external_ids"
                    }
                });

                const data = {
                    ...response.data,
                    isSeason // flag to help UI rendering
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
                note: item.note || ""
            });
            setActiveTab("info"); // Reset to info tab
        }
    }, [isOpen, item]);

    const handleSave = () => {
        onSave({
            ...item,
            ...formData
        });
        onClose();
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

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            <div className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col md:flex-row animate-scale-up border border-gray-200 dark:border-gray-800">

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
                                    : `https://www.themoviedb.org/${item.media_type === 'tv' ? 'tv' : 'movie'}/${item.id}`
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
                <div className="flex-1 flex flex-col h-full min-h-[500px]">
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
                                <div className="grid grid-cols-2 gap-6">
                                    {/* Status */}
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Status</label>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="plan_to_watch">Plan to Watch</option>
                                            {item.media_type !== 'movie' && <option value="watching">Watching</option>}
                                            {item.media_type !== 'movie' && <option value="rewatching">Rewatching</option>}
                                            <option value="completed">Completed</option>
                                            <option value="dropped">Dropped</option>
                                        </select>
                                    </div>

                                    {/* Score */}
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">My Score</label>
                                        <select
                                            value={formData.score}
                                            onChange={(e) => setFormData({ ...formData, score: Number(e.target.value) })}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
                                                min="0"
                                                value={item.media_type === 'tv' || item.media_type === 'tv_season' || details?.isSeason ? formData.episodes_watched : formData.times_rewatched}
                                                onChange={(e) => {
                                                    let val = parseInt(e.target.value) || 0;
                                                    if (item.media_type === 'tv' || item.media_type === 'tv_season' || details?.isSeason) {
                                                        const maxEpisodes = details?.number_of_episodes || details?.episodes?.length;
                                                        if (maxEpisodes) {
                                                            val = Math.min(Math.max(0, val), maxEpisodes);
                                                        } else {
                                                            val = Math.max(0, val);
                                                        }
                                                        setFormData({ ...formData, episodes_watched: val });
                                                    } else {
                                                        setFormData({ ...formData, times_rewatched: Math.max(0, val) });
                                                    }
                                                }}
                                                className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                            {(item.media_type === 'tv' || item.media_type === 'tv_season' || details?.isSeason) && (
                                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                                    / {details?.number_of_episodes || details?.episodes?.length || "?"}
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
                                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                        )}


                                        {/* Season Breakdown Visualizer (Only for Full TV Shows) */}
                                        {item.media_type === 'tv' && !details?.isSeason && details?.seasons && (
                                            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                                                {details.seasons
                                                    .filter(s => s.season_number > 0)
                                                    .map((season) => {
                                                        // Calculate cumulative episodes up to this season
                                                        const previousSeasons = details.seasons.filter(s => s.season_number > 0 && s.season_number < season.season_number);
                                                        const epsBefore = previousSeasons.reduce((acc, s) => acc + s.episode_count, 0);
                                                        const seasonEnd = epsBefore + season.episode_count;

                                                        // Determine status
                                                        const isFullyWatched = formData.episodes_watched >= seasonEnd;
                                                        const isWatching = (formData.episodes_watched > epsBefore && formData.episodes_watched < seasonEnd);

                                                        const epsInSeason = isFullyWatched
                                                            ? season.episode_count
                                                            : (isWatching ? formData.episodes_watched - epsBefore : 0);

                                                        const isDropped = droppedSeasonNumbers.includes(season.season_number);

                                                        return (
                                                            <div
                                                                key={season.id}
                                                                className={`group/season relative flex items-center gap-3 p-2 rounded-lg border transition-all
                                                                    ${isDropped
                                                                        ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30"
                                                                        : (isFullyWatched
                                                                            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                                                                            : (isWatching ? "bg-white dark:bg-gray-800 border-blue-500 shadow-sm" : "bg-gray-50 dark:bg-gray-800/50 border-transparent hover:bg-gray-100 dark:hover:bg-gray-800"))}`}
                                                            >
                                                                {/* Click Area */}
                                                                <div
                                                                    className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer"
                                                                    onClick={() => {
                                                                        if (!isDropped) {
                                                                            if (isFullyWatched) {
                                                                                setFormData({ ...formData, episodes_watched: epsBefore });
                                                                            } else {
                                                                                setFormData({ ...formData, episodes_watched: seasonEnd });
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    {/* Season Poster */}
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

                                                                    {/* Info */}
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex justify-between items-center mb-1">
                                                                            <span className={`font-semibold text-sm ${isDropped ? "text-red-700 dark:text-red-400" : "text-gray-800 dark:text-gray-200"}`}>
                                                                                {season.name} {isDropped && "(Dropped)"}
                                                                            </span>
                                                                            <span className="text-xs font-medium text-gray-500">
                                                                                {epsInSeason} / {season.episode_count} eps
                                                                            </span>
                                                                        </div>

                                                                        {/* Progress Bar */}
                                                                        <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                                            <div
                                                                                className={`h-full rounded-full transition-all duration-500 ${isDropped ? "bg-red-500" : (isFullyWatched ? "bg-green-500" : "bg-blue-500")}`}
                                                                                style={{ width: `${(epsInSeason / season.episode_count) * 100}%` }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Drop Season Button or Dropped Badge */}
                                                                {!isFullyWatched && !isDropped && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (onDropSeason) {
                                                                                setConfirmModal({
                                                                                    isOpen: true,
                                                                                    title: `Drop "${season.name}"?`,
                                                                                    message: `This will add '${season.name}' as a separate item in your Dropped list.`,
                                                                                    isDangerous: true,
                                                                                    confirmText: "Drop Season",
                                                                                    onConfirm: () => {
                                                                                        onDropSeason(item, season, epsInSeason);
                                                                                        onClose();
                                                                                        setConfirmModal({ isOpen: false });
                                                                                    }
                                                                                });
                                                                            }
                                                                        }}
                                                                        className="absolute right-2 p-1.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover/season:opacity-100 transition-all z-20"
                                                                        title="Drop this Season"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                )}
                                                                {isDropped && (
                                                                    <div className="absolute right-2 p-1.5 bg-red-100 dark:bg-red-900/30 rounded-full text-red-500 cursor-default" title="Season Dropped">
                                                                        <X size={14} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Dates */}
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Date Started</label>
                                        <input
                                            type="date"
                                            value={formData.start_date || ""}
                                            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200"
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Date Finished</label>
                                        <input
                                            type="date"
                                            value={formData.finish_date || ""}
                                            onChange={(e) => setFormData({ ...formData, finish_date: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200"
                                        />
                                    </div>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Personal Notes</label>
                                    <textarea
                                        rows={4}
                                        value={formData.note}
                                        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                        placeholder="Write your thoughts here..."
                                    />
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <button
                                        onClick={handleSave}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <Save size={18} />
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
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
        </div >
    );
};

export default ItemDetailsModal;

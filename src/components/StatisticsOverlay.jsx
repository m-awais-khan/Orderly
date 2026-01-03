import React, { useMemo, useState } from 'react';
import { X, PieChart, BarChart, Clock, Hash, Film, Tv, Play, Check, AlertCircle, Layers, Star, Globe, TrendingUp, Calendar, Zap, Activity } from 'lucide-react';
import { ResponsiveRadar } from '@nivo/radar';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { getGenreName } from '../utils/genres';

// ------------------------------------------------------------------------
// THEMES & CONFIG
// ------------------------------------------------------------------------
const NIVO_THEME = {
    background: "transparent",
    text: {
        fontSize: 12,
        fill: "#71717a", // slate-500
        outlineWidth: 0,
        outlineColor: "transparent"
    },
    axis: {
        domain: {
            line: {
                stroke: "#e2e8f0", // slate-200
                strokeWidth: 1
            }
        },
        legend: {
            text: {
                fontSize: 12,
                fill: "#64748b", // slate-500
                outlineWidth: 0,
                outlineColor: "transparent"
            }
        },
        ticks: {
            line: {
                stroke: "#e2e8f0",
                strokeWidth: 1
            },
            text: {
                fontSize: 11,
                fill: "#94a3b8" // slate-400
            }
        }
    },
    grid: {
        line: {
            stroke: "#94a3b8", // slate-400 for better visibility
            strokeWidth: 1
        }
    },
    tooltip: {
        container: {
            background: "#ffffff",
            color: "#333333",
            fontSize: 12,
            borderRadius: "8px",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
            padding: "8px 12px"
        }
    }
};

const DARK_NIVO_THEME = {
    ...NIVO_THEME,
    text: { ...NIVO_THEME.text, fill: "#94a3b8" },
    axis: {
        domain: { line: { stroke: "#334155", strokeWidth: 1 } },
        ticks: { line: { stroke: "#334155" }, text: { fill: "#94a3b8" } }
    },
    grid: { line: { stroke: "#475569", strokeWidth: 1 } },
    tooltip: { container: { background: "#1e293b", color: "#f8fafc" } }
};

const StatisticsOverlay = ({ isOpen, onClose, lists }) => {
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'insights' | 'genres'
    const [languageViewMode, setLanguageViewMode] = useState('count'); // 'count' | 'time'

    // ------------------------------------------------------------------------
    // DATA ANALYSIS
    // ------------------------------------------------------------------------
    const stats = useMemo(() => {
        let totalItems = 0;
        let totalMovies = 0;
        let totalTV = 0;
        let totalEpisodesWatched = 0;
        let totalRewatches = 0;
        let totalMinutes = 0; // Initialize for cumulative calculation

        // Status Counts Overall
        let statusCounts = { completed: 0, watching: 0, dropped: 0, plan_to_watch: 0, not_interested: 0 };

        // Status by Media Type (Stacked Bar Data)
        // Structure: { movie: { completed: 0, ... }, tv: { ... } }
        let statusByMediaType = {
            movie: { completed: 0, watching: 0, dropped: 0, plan_to_watch: 0, not_interested: 0 },
            tv: { completed: 0, watching: 0, dropped: 0, plan_to_watch: 0, not_interested: 0 },
            other: { completed: 0, watching: 0, dropped: 0, plan_to_watch: 0, not_interested: 0 }
        };

        // Completed Media Counts (For Pie Chart)
        let completedMedia = { movie: 0, tv: 0 };

        // Score Distribution by Media Type (Stacked Bar Data)
        let scoreByMediaType = Array(11).fill(null).map(() => ({ movie: 0, tv: 0, other: 0 }));

        let scoreCounts = Array(11).fill(0); // Index 0 is "No Score", 1-10 are scores
        let totalScoreSum = 0;
        let scoredItemCount = 0;

        // Language Stats
        let languageCounts = {};
        let languageTimeCounts = {};

        // NEW: Advanced Stats: Genres & Decades
        let genreData = {}; // { id: { count, totalScore, scoreCount, name } }
        let decadeCounts = {}; // { "2020s": 5, "1990s": 2 ... }

        // Flatten all lists and filter out references
        const allContent = Object.values(lists)
            .flat()
            .filter(item => item.type !== 'reference');

        // Main items for full stats (Movies, Shows)
        const mainItems = allContent.filter(item => item.media_type !== 'tv_season' && !item.isSeason);

        // Season items ONLY for watch time/episode counts
        const seasonItems = allContent.filter(item => item.media_type === 'tv_season' || item.isSeason);

        const processItemTime = (item, type) => {
            let itemTotalMinutes = 0;
            let episodes = 0;
            let rewatches = 0;

            if (type === 'movie') {
                const movieRuntime = item.runtime || 150;
                if (item.status === 'completed') itemTotalMinutes += movieRuntime;
                if (item.times_rewatched) {
                    const actualRewatches = Math.max(0, item.times_rewatched - 1);
                    rewatches += actualRewatches;
                    if (actualRewatches > 0) itemTotalMinutes += (actualRewatches * movieRuntime);
                }
            } else {
                // TV or Season

                // PREFER PRE-CALCULATED ACCURATE TIME
                if (item.total_watched_minutes && type === 'tv') {
                    itemTotalMinutes = item.total_watched_minutes;

                    // Add Rewatch Time
                    if (item.times_rewatched > 0) {
                        itemTotalMinutes += (item.times_rewatched * item.total_watched_minutes);
                        rewatches = item.times_rewatched;
                    }

                    // Get Episode Count for display
                    if (item.season_watched_episodes && Object.keys(item.season_watched_episodes).length > 0) {
                        episodes = Object.values(item.season_watched_episodes).reduce((acc, epArray) => acc + (Array.isArray(epArray) ? epArray.length : 0), 0);
                    } else if (item.episodes_watched) {
                        episodes = item.episodes_watched;
                    }

                    return { itemTotalMinutes, episodes, rewatches };
                }

                let minutesPerEp = 50;
                if (item.episode_run_time && item.episode_run_time.length > 0) {
                    minutesPerEp = Math.round(item.episode_run_time.reduce((a, b) => a + b, 0) / item.episode_run_time.length);
                } else if (item.runtime) {
                    minutesPerEp = item.runtime;
                } else {
                    const isAnimation = item.genre_ids && item.genre_ids.includes(16);
                    minutesPerEp = isAnimation ? 24 : 50;
                }

                // Calculate episodes watched (Prioritize granular data to catch Specials)
                if (item.season_watched_episodes && Object.keys(item.season_watched_episodes).length > 0) {
                    episodes = Object.values(item.season_watched_episodes).reduce((acc, epArray) => acc + (Array.isArray(epArray) ? epArray.length : 0), 0);
                } else if (item.episodes_watched) {
                    episodes = item.episodes_watched;
                }

                if (episodes > 0) {
                    itemTotalMinutes += (episodes * minutesPerEp);
                }

                if (item.times_rewatched) {
                    rewatches += item.times_rewatched;
                    if (episodes > 0) {
                        itemTotalMinutes += (item.times_rewatched * episodes * minutesPerEp);
                    }
                }
            }
            return { itemTotalMinutes, episodes, rewatches };
        };

        // Process Main Items
        mainItems.forEach(item => {
            totalItems++;

            // Language Stats Aggregation (Count)
            if (item.watched_languages && Array.isArray(item.watched_languages)) {
                item.watched_languages.forEach(lang => {
                    languageCounts[lang] = (languageCounts[lang] || 0) + 1;
                });
            }

            // Normalize Media Type
            const type = (item.media_type === 'movie' || item.media_type === 'tv')
                ? item.media_type
                : 'other';

            // Media Type Counts
            if (type === 'movie') totalMovies++;
            else if (type === 'tv') totalTV++;

            // Status Normalization
            const status = (item.status && statusCounts[item.status] !== undefined) ? item.status : 'plan_to_watch';

            // Global Status Counts
            statusCounts[status]++;

            // Status by Media Type
            statusByMediaType[type][status]++;

            // Completed Counts for Pie Chart
            if (status === 'completed') {
                if (type === 'movie') completedMedia.movie++;
                else if (type === 'tv') completedMedia.tv++;
            }

            // Score Stats
            const rawScore = Number(item.score) || 0;
            const binScore = Math.round(rawScore);

            if (rawScore > 0) {
                totalScoreSum += rawScore;
                scoredItemCount++;

                if (binScore >= 1 && binScore <= 10) {
                    scoreCounts[binScore]++;
                    scoreByMediaType[binScore][type]++;
                } else if (binScore > 10) {
                    scoreCounts[10]++;
                    scoreByMediaType[10][type]++;
                }
            } else {
                scoreCounts[0]++;
            }

            // Watch Stats
            const { itemTotalMinutes, episodes, rewatches } = processItemTime(item, type);
            totalMinutes += itemTotalMinutes;
            totalEpisodesWatched += episodes;
            totalRewatches += rewatches;

            // Language Stats by Time
            if (itemTotalMinutes > 0 && item.watched_languages && Array.isArray(item.watched_languages)) {
                item.watched_languages.forEach(lang => {
                    languageTimeCounts[lang] = (languageTimeCounts[lang] || 0) + itemTotalMinutes;
                });
            }

            // --- NEW: Genre Calculation ---
            if (item.genre_ids && Array.isArray(item.genre_ids)) {
                item.genre_ids.forEach(gid => {
                    if (!genreData[gid]) genreData[gid] = { count: 0, totalScore: 0, scoreCount: 0, name: getGenreName(gid) };
                    genreData[gid].count++;
                    if (rawScore > 0) {
                        genreData[gid].totalScore += rawScore;
                        genreData[gid].scoreCount++;
                    }
                });
            }

            // --- NEW: Decade Calculation ---
            let dateStr = item.release_date || item.first_air_date || item.year;
            if (dateStr) {
                const year = parseInt(dateStr.toString().substring(0, 4));
                if (!isNaN(year)) {
                    const decade = Math.floor(year / 10) * 10;
                    const decadeLabel = `${decade}s`;
                    decadeCounts[decadeLabel] = (decadeCounts[decadeLabel] || 0) + 1;
                }
            }
        });

        // Process Season Items (ONLY for time/episodes)
        seasonItems.forEach(item => {
            const { itemTotalMinutes, episodes, rewatches } = processItemTime(item, 'tv'); // Treat seasons as TV logic
            totalMinutes += itemTotalMinutes;
            totalEpisodesWatched += episodes;
            totalRewatches += rewatches;
        });

        const days = Math.floor(totalMinutes / 1440);
        const hours = Math.floor((totalMinutes % 1440) / 60);
        const minutes = Math.floor(totalMinutes % 60);

        // --- NEW: Formating for Nivo ---
        // 1. Top Eras
        const eraData = Object.entries(decadeCounts)
            .map(([decade, count]) => ({ decade, count }))
            .sort((a, b) => a.decade.localeCompare(b.decade));

        // 2. Genres Radar (Top 8 by Count)
        const sortedGenres = Object.values(genreData)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Top 8

        const genreRadarData = sortedGenres.map(g => ({
            genre: g.name,
            count: g.count,
            fullMark: sortedGenres[0]?.count || 100
        }));

        // 3. Genre Satisfaction (Top Genres by Score)
        const genreScoreData = Object.values(genreData)
            .filter(g => g.scoreCount >= 2) // At least 2 scored items
            .map(g => ({
                genre: g.name,
                avgScore: Number((g.totalScore / g.scoreCount).toFixed(1)),
                count: g.count
            }))
            .sort((a, b) => b.avgScore - a.avgScore)
            .slice(0, 10);

        return {
            totalItems,
            totalMovies,
            totalTV,
            totalEpisodesWatched,
            totalRewatches,
            statusCounts,
            statusByMediaType,
            scoreCounts,
            scoreByMediaType,
            avgScore: scoredItemCount > 0 ? (totalScoreSum / scoredItemCount).toFixed(1) : "0.0",
            time: { days, hours, minutes },
            languageCounts,
            languageTimeCounts,
            completedMedia,
            // New Data for UI
            eraData,
            genreRadarData,
            genreScoreData
        };
    }, [lists]);

    if (!isOpen) return null;

    // Is Dark Mode? (Simple check via document class)
    const isDarkMode = document.documentElement.classList.contains('dark');
    const theme = isDarkMode ? DARK_NIVO_THEME : NIVO_THEME;

    const renderTabButton = (id, label, icon) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium text-sm ${activeTab === id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <div className="fixed inset-0 z-[200] bg-gray-100 dark:bg-gray-900 overflow-y-auto animate-fade-in custom-scrollbar">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto w-full gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Activity className="text-blue-500" />
                        Statistics & Insights
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Deep dive into your watching habits
                    </p>
                </div>

                <div className="flex gap-2">
                    {renderTabButton('overview', 'Overview', <PieChart size={16} />)}
                    {renderTabButton('insights', 'Insights', <TrendingUp size={16} />)}
                    {renderTabButton('genres', 'Profile', <Layers size={16} />)}
                </div>

                <button
                    onClick={onClose}
                    className="absolute right-6 top-4 md:static p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                >
                    <X size={24} className="text-gray-600 dark:text-gray-300" />
                </button>
            </div>

            <div className="max-w-7xl mx-auto w-full p-6 space-y-6 pb-20">
                {/* ---------------- OVERVIEW TAB ---------------- */}
                {activeTab === 'overview' && (
                    <div className="space-y-6 animate-slide-up">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard icon={<Hash className="text-purple-500" />} label="Total Items" value={stats.totalItems} sub={`${stats.totalMovies} Movies, ${stats.totalTV} Shows`} />
                            <StatCard icon={<Clock className="text-blue-500" />} label="Time Watched" value={`${stats.time.days}d ${stats.time.hours}h ${stats.time.minutes}m`} sub="Estimated runtime" />
                            <StatCard icon={<Play className="text-green-500" />} label="Episodes" value={stats.totalEpisodesWatched.toLocaleString()} sub={`${stats.totalRewatches} rewatches`} />
                            <StatCard icon={<Star className="text-amber-500" />} label="Avg Score" value={stats.avgScore} sub="Mean rating (1-10)" />
                        </div>

                        {/* Status Distribution (Pie + Bars) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 h-[400px] flex flex-col">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Status Distribution</h3>
                                <div className="flex-1 w-full relative">
                                    <ResponsivePie
                                        data={[
                                            { id: "Completed", label: "Completed", value: stats.statusCounts.completed, color: "#22c55e" },
                                            { id: "Watching", label: "Watching", value: stats.statusCounts.watching, color: "#3b82f6" },
                                            { id: "Plan to Watch", label: "Plan", value: stats.statusCounts.plan_to_watch, color: "#a855f7" },
                                            { id: "Dropped", label: "Dropped", value: stats.statusCounts.dropped, color: "#ef4444" },
                                            { id: "Not Interested", label: "Not Interested", value: stats.statusCounts.not_interested, color: "#64748b" },
                                        ].filter(d => d.value > 0)}
                                        margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
                                        innerRadius={0.6}
                                        padAngle={0.7}
                                        cornerRadius={3}
                                        activeOuterRadiusOffset={8}
                                        theme={theme}
                                        colors={{ datum: 'data.color' }}
                                        borderWidth={0}
                                        enableArcLinkLabels={true}
                                        arcLinkLabelsSkipAngle={10}
                                        arcLinkLabelsTextColor={isDarkMode ? "#cbd5e1" : "#334155"}
                                        arcLinkLabelsThickness={2}
                                        arcLinkLabelsColor={{ from: 'color' }}
                                        enableArcLabels={true}
                                        arcLabelsSkipAngle={10}
                                        arcLabelsTextColor="#ffffff"
                                        legends={[]} // Custom legends or default
                                    />
                                    {/* Center Text */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="text-center">
                                            <span className="text-3xl font-bold text-gray-800 dark:text-white">{stats.totalItems}</span>
                                            <div className="text-xs text-gray-400 uppercase tracking-widest">Total</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Score Distribution */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 h-[400px] flex flex-col">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">My Ratings</h3>
                                <div className="flex-1 w-full">
                                    <ResponsiveBar
                                        data={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => ({
                                            score: score.toString(),
                                            Movies: stats.scoreByMediaType[score]?.movie || 0,
                                            TV: stats.scoreByMediaType[score]?.tv || 0,
                                        }))}
                                        keys={['Movies', 'TV']}
                                        indexBy="score"
                                        margin={{ top: 20, right: 20, bottom: 50, left: 40 }}
                                        padding={0.3}
                                        valueScale={{ type: 'linear' }}
                                        indexScale={{ type: 'band', round: true }}
                                        colors={({ id }) => id === 'Movies' ? '#f97316' : '#22c55e'}
                                        theme={theme}
                                        borderRadius={4}
                                        axisTop={null}
                                        axisRight={null}
                                        axisBottom={{
                                            tickSize: 5,
                                            tickPadding: 5,
                                            tickRotation: 0,
                                            legend: 'Score (1-10)',
                                            legendPosition: 'middle',
                                            legendOffset: 40
                                        }}
                                        axisLeft={{
                                            tickSize: 5,
                                            tickPadding: 5,
                                            tickRotation: 0,
                                            legend: 'Count',
                                            legendPosition: 'middle',
                                            legendOffset: -35
                                        }}
                                        labelSkipWidth={12}
                                        labelSkipHeight={12}
                                        labelTextColor="#ffffff"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ---------------- INSIGHTS TAB ---------------- */}
                {activeTab === 'insights' && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Era Distribution */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 h-[450px] flex flex-col">
                                <div className="mb-4">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                        <Calendar className="text-blue-500" size={20} />
                                        Time Travel (By Decade)
                                    </h3>
                                    <p className="text-sm text-gray-500">Which era dominates your list?</p>
                                </div>
                                <div className="flex-1">
                                    {stats.eraData.length > 0 ? (
                                        <ResponsiveBar
                                            data={stats.eraData}
                                            keys={['count']}
                                            indexBy="decade"
                                            margin={{ top: 10, right: 10, bottom: 50, left: 40 }} // Adjusted margins
                                            padding={0.3}
                                            colors="#3b82f6"
                                            theme={theme}
                                            borderRadius={6}
                                            axisBottom={{
                                                tickSize: 5,
                                                tickPadding: 5,
                                                tickRotation: -45,
                                            }}
                                            axisLeft={{
                                                tickSize: 5,
                                                tickPadding: 5,
                                                tickRotation: 0,
                                            }}
                                            enableLabel={false}
                                            tooltip={({ value, indexValue }) => (
                                                <div className="bg-white dark:bg-gray-800 p-2 shadow-lg rounded border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200">
                                                    {indexValue}: {value} items
                                                </div>
                                            )}
                                        />
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-gray-400">
                                            Not enough release date data.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Genre Satisfaction (Highest Rated) */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 h-[450px] flex flex-col">
                                <div className="mb-4">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                        <Zap className="text-amber-500" size={20} />
                                        Highest Rated Genres
                                    </h3>
                                    <p className="text-sm text-gray-500">What you actually enjoy watching (Avg Score)</p>
                                </div>
                                <div className="flex-1">
                                    {stats.genreScoreData.length > 0 ? (
                                        <ResponsiveBar
                                            data={stats.genreScoreData}
                                            keys={['avgScore']}
                                            indexBy="genre"
                                            layout="horizontal"
                                            margin={{ top: 10, right: 30, bottom: 25, left: 140 }}
                                            padding={0.3}
                                            colors={d => d.value >= 8 ? '#22c55e' : d.value >= 6 ? '#f59e0b' : '#ef4444'}
                                            theme={theme}
                                            borderRadius={4}
                                            axisLeft={{
                                                tickSize: 0,
                                                tickPadding: 10,
                                                tickRotation: 0,
                                            }}
                                            enableGridX={true}
                                            enableGridY={false}
                                            labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
                                            tooltip={({ data }) => (
                                                <div className="bg-white dark:bg-gray-800 p-2 shadow-lg rounded border border-gray-200 dark:border-gray-700 text-xs">
                                                    <div className="font-bold text-gray-700 dark:text-gray-200">{data.genre}</div>
                                                    <div className="text-gray-500">Average: <span className="font-bold text-amber-500">{data.avgScore}</span> ({data.count} items)</div>
                                                </div>
                                            )}
                                        />
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-gray-400">
                                            Rate more items to see this!
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ---------------- GENRES TAB ---------------- */}
                {activeTab === 'genres' && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Genre Radar */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 h-[500px] flex flex-col">
                                <div className="mb-2 text-center">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Taste Profile</h3>
                                    <p className="text-sm text-gray-500">Your most watched genres</p>
                                </div>
                                <div className="flex-1 w-full">
                                    {stats.genreRadarData.length >= 3 ? (
                                        <ResponsiveRadar
                                            data={stats.genreRadarData}
                                            keys={['count']}
                                            indexBy="genre"
                                            maxValue="auto"
                                            margin={{ top: 70, right: 80, bottom: 50, left: 80 }}
                                            curve="linearClosed"
                                            borderWidth={2}
                                            borderColor={{ from: 'color' }}
                                            gridLevels={5}
                                            gridShape="circular"
                                            gridLabelOffset={36}
                                            enableDots={true}
                                            dotSize={10}
                                            dotColor={{ theme: 'background' }}
                                            dotBorderWidth={2}
                                            dotBorderColor={{ from: 'color' }}
                                            enableDotLabel={true}
                                            dotLabel="value"
                                            dotLabelYOffset={-12}
                                            colors={{ scheme: 'category10' }} // Changed to scheme string
                                            fillOpacity={0.35}
                                            blendMode="multiply"
                                            animate={true}
                                            theme={{
                                                ...theme,
                                                axis: { ...theme.axis, ticks: { ...theme.axis.ticks, text: { fontSize: 13, fill: isDarkMode ? '#e2e8f0' : '#475569' } } }
                                            }}
                                        />
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-gray-400 text-center p-4">
                                            Not enough varied genre data for a radar chart.<br />Add items with different genres!
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Language List */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 h-[500px] flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                        <Globe className="text-blue-500" size={20} />
                                        Languages
                                    </h3>
                                    <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                                        <button onClick={() => setLanguageViewMode('count')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${languageViewMode === 'count' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>Count</button>
                                        <button onClick={() => setLanguageViewMode('time')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${languageViewMode === 'time' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>Time</button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                                    {Object.keys(stats.languageCounts).length === 0 ? (
                                        <div className="text-center py-8 text-gray-400">No language data available.</div>
                                    ) : (
                                        Object.entries(languageViewMode === 'count' ? stats.languageCounts : stats.languageTimeCounts)
                                            .sort(([, a], [, b]) => b - a)
                                            .map(([lang, value]) => {
                                                const total = Object.values(languageViewMode === 'count' ? stats.languageCounts : stats.languageTimeCounts).reduce((a, b) => a + b, 0);
                                                const displayValue = languageViewMode === 'count' ? value : formatTime(value);
                                                const percent = total > 0 ? (value / total) * 100 : 0;
                                                return (
                                                    <div key={lang}>
                                                        <div className="flex justify-between text-sm mb-1">
                                                            <span className="font-medium text-gray-700 dark:text-gray-200">{lang}</span>
                                                            <span className="text-gray-500 dark:text-gray-400 text-xs">{displayValue} ({percent.toFixed(0)}%)</span>
                                                        </div>
                                                        <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                            <div style={{ width: `${percent}%` }} className="h-full bg-blue-500 rounded-full"></div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ------------------------------------------------------------------------
// SUB-COMPONENTS
// ------------------------------------------------------------------------

const StatCard = ({ icon, label, value, sub }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-4 hover:shadow-md transition-all duration-300">
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            {icon}
        </div>
        <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</div>
            {sub && <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</div>}
        </div>
    </div>
);

const formatTime = (totalMinutes) => {
    if (!totalMinutes) return '0m';
    const h = Math.floor(totalMinutes / 60);
    const m = Math.floor(totalMinutes % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

export default StatisticsOverlay;

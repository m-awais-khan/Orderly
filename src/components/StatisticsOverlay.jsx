import React, { useMemo, useState } from 'react';
import { X, PieChart, BarChart, Clock, Hash, Film, Tv, Play, Check, AlertCircle, Layers, Star, Globe } from 'lucide-react';

const StatisticsOverlay = ({ isOpen, onClose, lists }) => {
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
            completedMedia
        };
    }, [lists]);

    if (!isOpen) return null;

    // ------------------------------------------------------------------------
    // HELPER: Colors & configs
    // ------------------------------------------------------------------------
    const TYPE_COLORS = {
        movie: 'bg-orange-500',
        tv: 'bg-green-500',
        other: 'bg-gray-400'
    };

    // Status colors are: Completed=Green, Watching=Blue, Plan=Gray/Purple, Dropped=Red to match bars
    // Status colors are: Completed=Green, Watching=Blue, Plan=Gray/Purple, Dropped=Red to match bars
    const STATUS_COLORS = {
        completed: 'bg-green-500',
        watching: 'bg-blue-500',
        plan_to_watch: 'bg-purple-500',
        dropped: 'bg-red-500',
        not_interested: 'bg-slate-500'
    };

    // Exclude index 0 (Unrated) from max calculation so 1-10 bars scale properly
    const maxScoreCount = Math.max(...stats.scoreCounts.slice(1));

    // Helper to format minutes into readable time (e.g., "12h 30m")
    const formatTime = (totalMinutes) => {
        if (!totalMinutes) return '0m';
        const h = Math.floor(totalMinutes / 60);
        const m = Math.floor(totalMinutes % 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    return (
        <div className="fixed inset-0 z-[200] bg-gray-100 dark:bg-gray-900 overflow-y-auto animate-fade-in custom-scrollbar">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex justify-between items-center max-w-7xl mx-auto w-full">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <PieChart className="text-purple-500" />
                        Statistics & Insights
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Overview of your entire watchlist collection
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                >
                    <X size={24} className="text-gray-600 dark:text-gray-300" />
                </button>
            </div>

            {/* Content Grid */}
            <div className="max-w-7xl mx-auto w-full p-6 space-y-6 pb-20">

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        icon={<Hash className="text-purple-500" />}
                        label="Total Items"
                        value={stats.totalItems}
                        sub={`In ${Object.keys(lists).length} lists`}
                    />
                    <StatCard
                        icon={<Clock className="text-blue-500" />}
                        label="Time Watched (Approx)"
                        value={`${stats.time.days}d ${stats.time.hours}h ${stats.time.minutes}m`}
                        sub="Based on actual runtime or estimates"
                    />
                    <StatCard
                        icon={<Play className="text-green-500" />}
                        label="Episodes Watched"
                        value={stats.totalEpisodesWatched.toLocaleString()}
                        sub={`${stats.totalRewatches} rewatches`}
                    />
                    <StatCard
                        icon={<Film className="text-amber-500" />}
                        label="Content Split"
                        value={`${stats.totalMovies} Movies`}
                        sub={`${stats.totalTV} TV Shows`}
                    />
                </div>

                {/* Row 2: Media Distribution (Pie) & Status Distribution (Bars) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Media Type Distribution Pie Chart */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                            <PieChart className="text-gray-400" size={20} />
                            Completed Media Distribution
                        </h3>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                            <PieChartCSS
                                data={[
                                    { label: 'Movie', value: stats.completedMedia.movie, color: '#f97316' }, // orange-500
                                    { label: 'TV Show', value: stats.completedMedia.tv, color: '#22c55e' }, // green-500
                                ]}
                                size={180}
                            />
                            <div className="space-y-3">
                                <LegendItem color="bg-orange-500" label="Movie" value={stats.completedMedia.movie} total={stats.completedMedia.movie + stats.completedMedia.tv} />
                                <LegendItem color="bg-green-500" label="TV Show" value={stats.completedMedia.tv} total={stats.completedMedia.movie + stats.completedMedia.tv} />
                            </div>
                        </div>
                    </div>

                    {/* Status Distribution (Horizontal Bars) */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-full">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2 shrink-0">
                            Status Distribution
                        </h3>
                        {/* Center content vertically if few items */}
                        <div className="space-y-6 flex flex-col justify-center flex-1">
                            <ProgressBar label="Completed" count={stats.statusCounts.completed} total={stats.totalItems} color="bg-green-500" />
                            <ProgressBar label="Watching" count={stats.statusCounts.watching} total={stats.totalItems} color="bg-blue-500" />
                            <ProgressBar label="Plan to Watch" count={stats.statusCounts.plan_to_watch} total={stats.totalItems} color="bg-purple-500" />
                            <ProgressBar label="Dropped" count={stats.statusCounts.dropped} total={stats.totalItems} color="bg-red-500" />
                            <ProgressBar label="Not Interested" count={stats.statusCounts.not_interested} total={stats.totalItems} color="bg-slate-500" />
                        </div>
                    </div>
                </div>

                {/* Row 3: Status Breakdown by Media Type (Stacked Bar) */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                        <Layers className="text-gray-400" size={20} />
                        Status Distribution by Media Type
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
                        {['movie', 'tv'].map(type => {
                            const typeLabel = type === 'movie' ? 'Movie' : 'TV Show';
                            const data = stats.statusByMediaType[type];
                            const totalForType = data.completed + data.watching + data.dropped + data.plan_to_watch + data.not_interested;

                            return (
                                <div key={type} className="flex flex-col gap-2">
                                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex justify-between">
                                        <span>{typeLabel}</span>
                                        <span className="text-gray-500">{totalForType}</span>
                                    </div>
                                    <StackedBar
                                        segments={[
                                            { value: data.completed, color: 'bg-green-500', tooltip: `Completed: ${data.completed}` },
                                            { value: data.watching, color: 'bg-blue-500', tooltip: `Watching: ${data.watching}` },
                                            { value: data.plan_to_watch, color: 'bg-purple-500', tooltip: `Plan: ${data.plan_to_watch}` },
                                            { value: data.dropped, color: 'bg-red-500', tooltip: `Dropped: ${data.dropped}` },
                                            { value: data.not_interested, color: 'bg-slate-500', tooltip: `Not Interested: ${data.not_interested}` },
                                        ]}
                                        total={totalForType}
                                        height="h-48"
                                        vertical
                                    />
                                </div>
                            )
                        })}
                        {/* Legend for this chart */}
                        <div className="flex flex-col justify-center space-y-3 sm:pl-8 border-l border-gray-100 dark:border-gray-700">
                            <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Legend</div>
                            <LegendItem color="bg-green-500" label="Completed" />
                            <LegendItem color="bg-blue-500" label="Watching" />
                            <LegendItem color="bg-purple-500" label="Plan to Watch" />
                            <LegendItem color="bg-red-500" label="Dropped" />
                            <LegendItem color="bg-slate-500" label="Not Interested" />
                        </div>
                    </div>
                </div>

                {/* Row 4: Score Distribution Stacked */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 lg:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <BarChart className="text-gray-400" size={20} />
                            Score Distribution by Media Type
                        </h3>
                        <span className="text-sm font-medium px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300">
                            Avg Score: <span className="text-amber-500 font-bold">{stats.avgScore}</span>
                        </span>
                    </div>

                    <div className="flex flex-col gap-3">
                        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((score) => {
                            const count = stats.scoreCounts[score] || 0;
                            const percent = maxScoreCount > 0 ? (count / maxScoreCount) * 100 : 0;

                            return (
                                <div key={score} className="flex items-center gap-3 group">
                                    {/* Label: Star + Number */}
                                    <div className="flex items-center gap-1 w-12 shrink-0 justify-end">
                                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{score}</span>
                                        <Star size={12} className="text-amber-500 fill-amber-500" />
                                    </div>

                                    {/* Bar Container */}
                                    <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden relative">
                                        {/* Bar Fill */}
                                        <div
                                            style={{ width: `${percent}%` }}
                                            className={`h-full rounded-full transition-all duration-700 ${score >= 8 ? 'bg-amber-500' :
                                                score >= 6 ? 'bg-amber-400' :
                                                    score >= 4 ? 'bg-amber-300' : 'bg-gray-400'
                                                }`}
                                        ></div>
                                    </div>

                                    {/* Count Label */}
                                    <div className="w-8 shrink-0 text-xs text-right text-gray-400 font-mono">
                                        {count > 0 ? count : ''}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Row 5: Language Statistics */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 lg:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <Globe className="text-blue-500" size={20} />
                            Languages Watched
                        </h3>
                        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                            <button
                                onClick={() => setLanguageViewMode('count')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${languageViewMode === 'count' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                By Count
                            </button>
                            <button
                                onClick={() => setLanguageViewMode('time')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${languageViewMode === 'time' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                By Time
                            </button>
                        </div>
                    </div>

                    {Object.keys(stats.languageCounts).length === 0 ? (
                        <div className="text-center py-8 text-gray-400 dark:text-gray-500 italic">
                            No language data available. Add languages to your items in "My List" to see stats!
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            {Object.entries(languageViewMode === 'count' ? stats.languageCounts : stats.languageTimeCounts)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 10) // Top 10 languages
                                .map(([lang, value]) => {
                                    // Total for percentages
                                    const total = Object.values(languageViewMode === 'count' ? stats.languageCounts : stats.languageTimeCounts).reduce((a, b) => a + b, 0);

                                    // Formatted Value
                                    const displayValue = languageViewMode === 'count' ? value : formatTime(value);

                                    // Calculate percent manually because 'displayValue' might be string
                                    const percent = total > 0 ? (value / total) * 100 : 0;

                                    return (
                                        <ProgressBar
                                            key={lang}
                                            label={lang}
                                            count={displayValue}
                                            total={total}
                                            customPercent={percent}
                                            color="bg-blue-500"
                                        />
                                    );
                                })}
                        </div>
                    )}
                </div>

                {/* Insights / Fun Stats */}
                <div className="bg-purple-600 text-white rounded-3xl p-8 shadow-xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div>
                            <h3 className="text-2xl font-bold mb-2">Completionist?</h3>
                            <p className="text-purple-100 max-w-md">
                                You've completed <strong>{((stats.statusCounts.completed / stats.totalItems) * 100).toFixed(0)}%</strong> of your list.
                                {stats.statusCounts.plan_to_watch > stats.statusCounts.completed
                                    ? " Looks like you have a growing backlog!"
                                    : " You're on top of your game!"}
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <div className="text-center p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
                                <div className="text-3xl font-bold">{stats.totalItems - stats.statusCounts.completed}</div>
                                <div className="text-xs uppercase tracking-wider text-purple-200 mt-1">Remaining</div>
                            </div>
                            <div className="text-center p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
                                <div className="text-3xl font-bold">{stats.scoreCounts[10]}</div>
                                <div className="text-xs uppercase tracking-wider text-purple-200 mt-1">Masterpieces</div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

// ------------------------------------------------------------------------
// SUB-COMPONENTS
// ------------------------------------------------------------------------

const StatCard = ({ icon, label, value, sub }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-4 hover:shadow-md transition-shadow">
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

const LegendItem = ({ color, label, value, total }) => (
    <div className="flex items-center gap-2 text-sm">
        <div className={`w-3 h-3 rounded-full ${color}`}></div>
        <span className="text-gray-600 dark:text-gray-300 flex-1">{label}</span>
        {value !== undefined && (
            <span className="text-gray-400 text-xs">
                {value} ({(total > 0 ? (value / total) * 100 : 0).toFixed(0)}%)
            </span>
        )}
    </div>
);

const ProgressBar = ({ label, count, total, color, customPercent }) => {
    // If customPercent is provided, use it. Otherwise calculate from count/total (if count is number).
    const percent = customPercent !== undefined ? customPercent : (total > 0 ? ((count / total) * 100) : 0);

    return (
        <div>
            <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium text-gray-700 dark:text-gray-200">{label}</span>
                {/* Count can be string or number, so just display it */}
                <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">{count} ({percent.toFixed(0)}%)</span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div style={{ width: `${percent}%` }} className={`h-full ${color} rounded-full transition-all duration-1000`}></div>
            </div>
        </div>
    );
};

const StackedBar = ({ segments, total, height = 'h-full', vertical = false, isCustomRender = false, children }) => {
    if (isCustomRender) return children;

    // For vertical bars where height is 100% and segments stack UPWARDS
    if (vertical) {
        return (
            <div className={`w-full ${height} bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden shadow-inner flex flex-col-reverse relative group`}>
                {segments.map((seg, i) => {
                    const size = total > 0 ? (seg.value / total) * 100 : 0;
                    if (size === 0) return null;
                    return (
                        <div
                            key={i}
                            style={{ height: `${size}%` }}
                            className={`w-full ${seg.color} transition-all duration-500 relative`}
                            title={seg.tooltip}
                        ></div>
                    );
                })}
            </div>
        )
    }

    // Default Horizontal
    return (
        <div className={`w-full ${height} bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex`}>
            {segments.map((seg, i) => {
                const size = total > 0 ? (seg.value / total) * 100 : 0;
                return (
                    <div key={i} style={{ width: `${size}%` }} className={`h-full ${seg.color} transition-all duration-500`} title={seg.tooltip}></div>
                );
            })}
        </div>
    );
};

// Pure CSS Pie Chart using Conic Gradient
const PieChartCSS = ({ data, size = 160 }) => {
    // Data format: { value, color }
    const total = data.reduce((acc, curr) => acc + curr.value, 0);

    let currentAngle = 0;
    const gradientString = data.map(slice => {
        const percentage = total > 0 ? (slice.value / total) * 100 : 0;
        const start = currentAngle;
        const end = currentAngle + percentage;
        currentAngle = end;
        return `${slice.color} ${start}% ${end}%`;
    }).join(', ');

    return (
        <div
            className="rounded-full relative shadow-lg transition-transform hover:scale-105 duration-300 group"
            style={{
                width: size,
                height: size,
                background: total > 0 ? `conic-gradient(${gradientString})` : '#e5e7eb', // fallback gray if 0
            }}
        >
            {/* Center hole for Donut effect */}
            <div className="absolute inset-0 m-auto bg-white dark:bg-gray-800 rounded-full flex items-center justify-center flex-col" style={{ width: '60%', height: '60%' }}>
                <span className="text-3xl font-bold text-gray-800 dark:text-white group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors duration-300">{total}</span>
                <span className="text-[10px] uppercase tracking-wider text-gray-400">Total</span>
            </div>
        </div>
    );
};

export default StatisticsOverlay;

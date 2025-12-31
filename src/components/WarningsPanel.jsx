import React, { useMemo, useState } from 'react';
import { AlertTriangle, X, ChevronDown, ChevronRight, Star, Globe, ExternalLink, Clock, CheckCircle } from 'lucide-react';

const WarningsPanel = ({ lists, onClose, onNavigate, isUpdateDue, onResetUpdateCheck }) => {
    const [expandedType, setExpandedType] = useState(isUpdateDue ? 'update_check' : null);

    // Real-time calculation of warnings
    const warningData = useMemo(() => {
        let noRatingItems = [];
        let noLanguageItems = [];

        // Flatten lists to iterate all items
        Object.entries(lists).forEach(([listName, items]) => {
            items.forEach(item => {
                // Only care about "Completed" items per user request context
                // (Assuming "Completed" status is the target for these quality checks)
                if (item.status === 'completed') {
                    // Check 1: No Rating
                    // Score can be 0 or null/undefined
                    if (!item.score || item.score === 0) {
                        noRatingItems.push({ ...item, listName });
                    }

                    // Check 2: No Language Selected
                    // watched_languages array check
                    if (!item.watched_languages || item.watched_languages.length === 0) {
                        noLanguageItems.push({ ...item, listName });
                    }
                }
            });
        });

        return [
            {
                id: 'no_rating',
                title: 'Completed items with no rating',
                icon: Star,
                color: 'text-yellow-500',
                borderColor: 'border-yellow-200 dark:border-yellow-900/30',
                bgColor: 'bg-yellow-50 dark:bg-yellow-900/10',
                items: noRatingItems
            },
            {
                id: 'no_language',
                title: 'Completed items with no language selected',
                icon: Globe,
                color: 'text-blue-500',
                borderColor: 'border-blue-200 dark:border-blue-900/30',
                bgColor: 'bg-blue-50 dark:bg-blue-900/10',
                items: noLanguageItems
            }
        ].filter(w => w.items.length > 0);

        // Add Update Check Warning if Due
        if (isUpdateDue) {
            return [{
                id: 'update_check',
                title: 'Review Lists for Updates (30+ Days)',
                icon: Clock,
                color: 'text-red-500',
                borderColor: 'border-red-200 dark:border-red-900/30',
                bgColor: 'bg-red-50 dark:bg-red-900/10',
                items: [{ id: 'update_action', text: "It's been over 30 days. Please review your lists for new seasons.", listName: "System" }],
                isSystemAction: true
            }, ...baseWarnings];
        }

        return baseWarnings;

    }, [lists, isUpdateDue]);

    const totalWarnings = warningData.reduce((acc, curr) => acc + curr.items.length, 0);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-900 w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white/50 dark:bg-gray-900/50 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Data Warnings</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {totalWarnings} issues found in your library
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
                    {warningData.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500">
                                <AlertTriangle size={32} className="opacity-50" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">All data looks good!</h3>
                            <p className="text-gray-500 mt-1">No warnings found for completed items.</p>
                        </div>
                    ) : (
                        warningData.map(group => (
                            <div
                                key={group.id}
                                className={`rounded-xl border ${group.borderColor} overflow-hidden transition-all duration-300`}
                            >
                                <button
                                    onClick={() => setExpandedType(expandedType === group.id ? null : group.id)}
                                    className={`w-full flex items-center justify-between p-4 ${group.bgColor} hover:brightness-95 transition-all`}
                                >
                                    <div className="flex items-center gap-3">
                                        <group.icon size={20} className={group.color} />
                                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                                            {group.title}
                                        </span>
                                        <span className="px-2 py-0.5 bg-white dark:bg-gray-800 rounded-full text-xs font-bold text-gray-600 dark:text-gray-300 shadow-sm">
                                            {group.items.length}
                                        </span>
                                    </div>
                                    {expandedType === group.id ? <ChevronDown size={20} className="text-gray-500" /> : <ChevronRight size={20} className="text-gray-500" />}
                                </button>

                                {expandedType === group.id && (
                                    <div className="bg-white dark:bg-gray-900/50 p-2 space-y-1 max-h-60 overflow-y-auto custom-scrollbar border-t border-gray-100 dark:border-gray-700/50">
                                        {group.items.map((item, idx) => (
                                            <div
                                                key={`${item.id}-${idx}`}
                                                className="flex items-center justify-between p-2 pl-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg group/item transition-colors"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    {item.image && (
                                                        <img src={item.image} alt="" className="w-8 h-10 object-cover rounded shadow-sm bg-gray-200" />
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                                            {item.text || item.title || item.name}
                                                        </div>
                                                        <div className="text-xs text-gray-400 flex items-center gap-1">
                                                            in <span className="text-blue-500">{item.listName}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {group.isSystemAction ? (
                                                    <button
                                                        onClick={() => {
                                                            onResetUpdateCheck();
                                                            onClose();
                                                        }}
                                                        className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center gap-1"
                                                    >
                                                        <CheckCircle size={14} />
                                                        Mark Reviewed
                                                    </button>
                                                ) : (
                                                    onNavigate && (
                                                        <button
                                                            onClick={() => {
                                                                onNavigate(item.listName, item);
                                                                onClose();
                                                            }}
                                                            className="p-1.5 opacity-0 group-hover/item:opacity-100 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-all"
                                                            title="Go to item"
                                                        >
                                                            <ExternalLink size={16} />
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default WarningsPanel;

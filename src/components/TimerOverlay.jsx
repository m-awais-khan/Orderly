import React from 'react';
import { Clock, RotateCcw, X, CheckCircle } from 'lucide-react';

const TimerOverlay = ({ lastCheckDate, onReset, onClose }) => {
    const getLastCheckedString = () => {
        if (!lastCheckDate) return "Never";
        const date = new Date(lastCheckDate);
        return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    };

    const getDaysSince = () => {
        if (!lastCheckDate) return 0;
        const now = new Date();
        const checked = new Date(lastCheckDate);
        const diffTime = Math.abs(now - checked);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const days = getDaysSince();

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-900 w-full max-w-sm p-6 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 transform transition-all scale-100"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <Clock size={24} className="text-blue-500" />
                        Update Timer
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X size={24} />
                    </button>
                </div>

                <div className="text-center mb-8">
                    <div className="w-24 h-24 mx-auto bg-blue-50 dark:bg-blue-900/10 rounded-full flex items-center justify-center mb-4 relative">
                        <div className="absolute inset-0 border-4 border-blue-100 dark:border-blue-900/30 rounded-full animate-[spin_10s_linear_infinite]"></div>
                        <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{days}</span>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wider">Days since last check</p>
                    <p className="mt-2 text-xs text-gray-400">Last Checked: {getLastCheckedString()}</p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => {
                            onReset();
                            onClose();
                        }}
                        className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <CheckCircle size={18} />
                        I've Checked My Lists
                    </button>

                    {days > 30 && (
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-100 dark:border-yellow-900/30 text-xs text-yellow-700 dark:text-yellow-300 text-center">
                            ⚠️ It's been over 30 days! Please review your lists for new seasons or sequels.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TimerOverlay;

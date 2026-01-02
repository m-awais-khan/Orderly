import React from 'react';
import { X, Film, Tv, List, Link, BookOpen } from 'lucide-react';

const WatchOrderViewModal = ({ isOpen, onClose, title, watchOrder = [] }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 transform transition-all animate-scale-up border border-gray-100 dark:border-gray-800 flex flex-col max-h-[80vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <List className="text-blue-500" size={24} />
                        Watch Order
                        {title && <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2 truncate max-w-[200px]">for {title}</span>}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                    {watchOrder.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400 italic">
                            No custom watch order defined.
                        </div>
                    ) : (
                        watchOrder.map((segment, index) => (
                            <div
                                key={segment.id || index}
                                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50"
                            >
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-gray-700 text-xs font-bold text-gray-400 shadow-sm shrink-0">
                                    {index + 1}
                                </span>

                                <div className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                    {segment.type === 'episodes' && (
                                        <>
                                            <Tv size={14} className="text-purple-500 shrink-0" />
                                            <span>Season {segment.season}</span>
                                            <span className="text-gray-400">•</span>
                                            <span className="text-gray-500 dark:text-gray-400 font-normal">
                                                Ep {segment.start} - {segment.end}
                                            </span>
                                        </>
                                    )}
                                    {segment.type === 'item' && (
                                        <>
                                            <Link size={14} className="text-blue-500 shrink-0" />
                                            <span>{segment.name}</span>
                                            {segment.seasonNumber && <span className="text-xs text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800">S{segment.seasonNumber}</span>}
                                            {segment.listName && (
                                                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded ml-auto">
                                                    in {segment.listName}
                                                </span>
                                            )}
                                        </>
                                    )}
                                    {segment.type === 'list' && (
                                        <>
                                            <BookOpen size={14} className="text-amber-500 shrink-0" />
                                            <span>List: {segment.listName}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 shrink-0 text-center">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WatchOrderViewModal;

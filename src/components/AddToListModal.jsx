import React, { useState } from 'react';
import { X, List, Search } from 'lucide-react';

const AddToListModal = ({ isOpen, onClose, item, lists, onConfirm }) => {
    const [searchQuery, setSearchQuery] = useState('');

    if (!isOpen || !item) return null;

    // Filter out smart lists (those starting with 'special:')
    // And filter by search query
    const userLists = Object.keys(lists)
        .filter(listName => !listName.startsWith('special:'))
        .filter(listName => listName.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleSelectList = (listName) => {
        onConfirm(listName, item);
        onClose();
        setSearchQuery(''); // Reset search on close
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-gray-200 dark:border-gray-700 transform animate-scale-in flex flex-col max-h-[60vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex-shrink-0">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <List size={20} className="text-blue-500" />
                        Add to List
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <X size={20} className="text-gray-600 dark:text-gray-300" />
                    </button>
                </div>

                {/* Item Info */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <div className="flex items-start gap-3">
                        {item.poster_path && (
                            <img
                                src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                                alt={item.title}
                                className="w-16 h-24 object-cover rounded-lg shadow-sm"
                            />
                        )}
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">{item.title}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {item.year} • {item.type === 'movie' ? 'Movie' : 'TV Show'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Search Input */}
                <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700/50 flex-shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search lists..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            autoFocus
                        />
                    </div>
                </div>

                {/* List Selection */}
                <div className="px-6 py-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                    {userLists.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            {searchQuery ? (
                                <>
                                    <p className="text-gray-500 dark:text-gray-400 mb-1">No lists found matching "{searchQuery}"</p>
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="text-blue-500 hover:underline text-sm"
                                    >
                                        Clear search
                                    </button>
                                </>
                            ) : (
                                <p className="text-gray-500 dark:text-gray-400">
                                    No lists available. Create a list first!
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {userLists.map(listName => (
                                <button
                                    key={listName}
                                    onClick={() => handleSelectList(listName)}
                                    className="w-full text-left px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {listName}
                                        </span>
                                        <div className="text-xs text-gray-400 dark:text-gray-500">
                                            {lists[listName]?.length || 0} items
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddToListModal;

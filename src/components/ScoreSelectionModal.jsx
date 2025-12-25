import React from 'react';
import { Star, X, MinusCircle } from 'lucide-react';

const ScoreSelectionModal = ({ isOpen, onClose, onConfirm, currentScore = 0 }) => {
    if (!isOpen) return null;

    const scores = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all animate-scale-up border border-gray-100 dark:border-gray-700"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Star className="text-yellow-500 fill-current" size={24} />
                        Rate Title
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X size={20} />
                    </button>
                </div>

                <div className="grid grid-cols-5 gap-2 mb-4">
                    {scores.map((score) => (
                        <button
                            key={score}
                            onClick={() => onConfirm(score)}
                            className={`
                                flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 border
                                ${currentScore === score
                                    ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700 ring-1 ring-yellow-500'
                                    : 'bg-gray-50 dark:bg-gray-700/50 border-transparent hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:border-yellow-200 hover:scale-105'
                                }
                            `}
                        >
                            <span className={`text-lg font-bold ${currentScore === score ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                {score}
                            </span>
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => onConfirm(0)}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-red-500 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium border border-transparent hover:border-red-200"
                >
                    <MinusCircle size={18} />
                    Remove Rating
                </button>
            </div>
        </div>
    );
};

export default ScoreSelectionModal;

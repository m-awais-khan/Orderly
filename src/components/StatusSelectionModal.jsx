import React from 'react';
import { Check, X, Play, Clock, MinusCircle } from 'lucide-react';

const StatusSelectionModal = ({ isOpen, onClose, onConfirm, currentStatus = 'none', isEditMode = false }) => {
    if (!isOpen) return null;

    const statuses = [
        { id: 'none', label: 'None', icon: MinusCircle, color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700' },
        { id: 'watching', label: 'Watching', icon: Play, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
        { id: 'completed', label: 'Completed', icon: Check, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
        { id: 'dropped', label: 'Dropped', icon: X, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
        { id: 'plan_to_watch', label: 'Plan to Watch', icon: Clock, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all animate-scale-up border border-gray-100 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    {isEditMode ? "Update Status" : "Select Status"}
                </h3>

                <div className="space-y-2">
                    {statuses.map((status) => {
                        const Icon = status.icon;
                        const isSelected = currentStatus === status.id; // For edit mode, maybe pre-select?
                        // Actually for adding, default is likely none, but we just offer choices.

                        return (
                            <button
                                key={status.id}
                                onClick={() => onConfirm(status.id)}
                                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group
                  hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent
                  ${isSelected ? '' : ''} 
                `}
                            >
                                <div className={`p-2 rounded-lg mr-4 ${status.bg} ${status.color}`}>
                                    <Icon size={20} />
                                </div>
                                <span className="font-medium text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white">
                                    {status.label}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <button
                    onClick={onClose}
                    className="mt-6 w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default StatusSelectionModal;

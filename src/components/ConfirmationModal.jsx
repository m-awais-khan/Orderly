import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", isDangerous = false }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onCancel}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full border border-gray-100 dark:border-gray-700 p-6 animate-in zoom-in-95 fade-in duration-200">
                <div className="flex items-center gap-4 mb-4">
                    <div className={`p-3 rounded-full ${isDangerous ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                        <AlertTriangle className={isDangerous ? 'text-red-500' : 'text-blue-500'} size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
                    </div>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                    {message}
                </p>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 font-medium text-white rounded-lg shadow-sm transition-all ${isDangerous
                                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;

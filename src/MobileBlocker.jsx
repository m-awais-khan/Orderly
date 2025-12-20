import React from "react";
import { Lock } from "lucide-react";

const MobileBlocker = () => {
  return (
    <div className="fixed inset-0 z-[9999] bg-gray-900/80 backdrop-blur-md flex items-center justify-center p-6 text-center">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Desktop Only
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          This application is designed for desktop use. Please open it on your computer for the best experience.
        </p>
      </div>
    </div>
  );
};

export default MobileBlocker;

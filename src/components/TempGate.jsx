import { useState, useEffect } from 'react';

const TempGate = ({ children }) => {
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    // Hardcoded password - Change this if needed
    const GATE_PASSWORD = "admin";
    const SESSION_KEY = "temp_access_granted";

    useEffect(() => {
        const granted = sessionStorage.getItem(SESSION_KEY);
        if (granted === 'true') {
            setIsAuthorized(true);
        }
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (password === GATE_PASSWORD) {
            sessionStorage.setItem(SESSION_KEY, 'true');
            setIsAuthorized(true);
            setError(false);
        } else {
            setError(true);
            setPassword('');
        }
    };

    if (isAuthorized) {
        return <>{children}</>;
    }

    return (
        <div className="fixed inset-0 z-[9999] bg-black text-white flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl animate-fade-in-up">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent mb-2">
                        Restricted Access
                    </h1>
                    <p className="text-gray-400 text-sm">
                        This site is currently in private preview. <br /> Please enter the access password to continue.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (error) setError(false);
                            }}
                            placeholder="Enter Password"
                            className={`w-full px-4 py-3 bg-gray-950/50 border ${error ? 'border-red-500/50 focus:border-red-500' : 'border-gray-800 focus:border-blue-500'
                                } rounded-xl outline-none text-white placeholder-gray-600 transition-all duration-300 focus:ring-2 focus:ring-blue-500/20`}
                            autoFocus
                        />
                        {error && (
                            <p className="text-xs text-red-500 pl-1 animate-pulse">
                                Incorrect password. Please try again.
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/20"
                    >
                        Enter Website
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-xs text-gray-700">
                        Temporary access gate.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TempGate;

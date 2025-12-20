import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Sparkles, ArrowRight } from 'lucide-react';

const AuthPage = ({ onLogin }) => {
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const login = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setIsLoading(true);
            try {
                // Fetch user info using the access token
                const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                const userInfo = await userInfoRes.json();

                // Send to backend
                const res = await fetch('/api/auth/google-custom', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        googleId: userInfo.sub,
                        email: userInfo.email,
                        name: userInfo.name,
                        picture: userInfo.picture
                    }),
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Login failed');
                onLogin(data);

            } catch (err) {
                console.error(err);
                setError("Failed to sign in. Please try again.");
            } finally {
                setIsLoading(false);
            }
        },
        onError: () => setError("Sign In Failed"),
    });

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0f1115] text-white">

            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
            </div>

            {/* Glass Container */}
            <div className="relative z-10 w-full max-w-md p-1">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 rounded-3xl blur-sm" />
                <div className="relative bg-[#1a1d24]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">

                    {/* Header */}
                    <div className="text-center mb-12">
                        <div className="relative w-24 h-24 mx-auto mb-6 group cursor-pointer">
                            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-2xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative w-full h-full bg-[#20242c] rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden">
                                <img src="/logo.png" alt="Orderly" className="w-full h-full object-cover" />
                            </div>
                        </div>

                        <h1 className="text-4xl font-bold mb-3 tracking-tight">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-gradient-x">
                                Watchlist Pro
                            </span>
                        </h1>
                        <p className="text-gray-400 text-lg">
                            Your personal movie collection, <br /> reimagined.
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                            {error}
                        </div>
                    )}

                    {/* Custom Google Button */}
                    <button
                        onClick={() => login()}
                        disabled={isLoading}
                        className="group relative w-full py-4 px-6 bg-white text-gray-900 rounded-xl font-bold text-lg shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-4 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
                    >
                        {isLoading ? (
                            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                        ) : (
                            <>
                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="G" className="w-6 h-6" />
                                <span>Continue with Google</span>
                                <ArrowRight className="w-5 h-5 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300 text-gray-400 group-hover:text-gray-900" />
                            </>
                        )}
                    </button>

                    <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span>Join thousands of movie lovers</span>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default AuthPage;

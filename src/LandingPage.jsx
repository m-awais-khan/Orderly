import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Film, Star, Share2 } from 'lucide-react';

const LandingPage = ({ isLoggedIn }) => {
    const navigate = useNavigate();

    const handleGetStarted = () => {
        if (isLoggedIn) {
            navigate('/dashboard');
        } else {
            navigate('/login');
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
                delayChildren: 0.3,
            },
        },
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                duration: 0.8,
                ease: [0.6, -0.05, 0.01, 0.99],
            },
        },
    };

    const clipPathVariants = {
        hidden: { clipPath: 'inset(100% 0 0 0)' },
        visible: {
            clipPath: 'inset(0% 0 0 0)',
            transition: {
                duration: 1.2,
                ease: [0.6, -0.05, 0.01, 0.99],
                delay: 0.2
            },
        },
    };

    return (
        <div className="min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-hidden font-sans">
            {/* Navbar (Minimal) */}
            <nav className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50">
                <div className="text-2xl font-bold tracking-tighter flex items-center gap-2">
                    <Film className="w-6 h-6 text-indigo-500" />
                    <span>ORDERLY</span>
                </div>
                <button
                    onClick={handleGetStarted}
                    className="px-6 py-2 rounded-full border border-white/20 hover:bg-white hover:text-black transition-all duration-300 text-sm font-medium tracking-wide backdrop-blur-sm"
                >
                    {isLoggedIn ? 'Go to Dashboard' : 'Sign In'}
                </button>
            </nav>

            <main className="relative flex flex-col items-center justify-center min-h-screen px-4 text-center">
                {/* Abstract Background Elements */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                    <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
                </div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="relative z-10 max-w-5xl mx-auto flex flex-col items-center"
                >
                    <div className="overflow-hidden mb-2">
                        <motion.div variants={clipPathVariants} className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent font-medium tracking-widest text-sm uppercase mb-4">
                            The Ultimate Watchlist Manager
                        </motion.div>
                    </div>

                    <div className="overflow-hidden">
                        <motion.h1
                            variants={clipPathVariants}
                            className="text-7xl md:text-9xl font-bold tracking-tighter mb-6 leading-tight"
                        >
                            Curate Your <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-gray-500">Cinematic World.</span>
                        </motion.h1>
                    </div>

                    <motion.p
                        variants={itemVariants}
                        className="text-lg md:text-xl text-gray-400 max-w-2xl mb-12 leading-relaxed"
                    >
                        Organize movies, TV shows, and anime in one place. Share lists with friends, track your progress, and never forget what to watch next.
                    </motion.p>

                    <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 items-center">
                        <button
                            onClick={handleGetStarted}
                            className="group relative px-8 py-4 bg-white text-black rounded-full font-bold text-lg tracking-wide overflow-hidden transition-transform hover:scale-105 active:scale-95"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                            <span className="flex items-center gap-2">
                                Start Curating <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </span>
                        </button>
                    </motion.div>

                    {/* Features Grid */}
                    <motion.div
                        variants={containerVariants}
                        className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 w-full max-w-4xl text-left"
                    >
                        {[
                            { icon: Star, title: "Rate & Review", desc: "Keep track of your favorites with personal ratings." },
                            { icon: Share2, title: "Share Lists", desc: "Collaborate with friends on movie nights." },
                            { icon: Film, title: "Discover", desc: "Find new gems based on your viewing history." },
                        ].map((feature, i) => (
                            <motion.div
                                key={i}
                                variants={itemVariants}
                                className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-sm"
                            >
                                <feature.icon className="w-8 h-8 text-indigo-400 mb-4" />
                                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                                <p className="text-gray-400 text-sm">{feature.desc}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </motion.div>
            </main>

            {/* Footer */}
            <footer className="w-full py-8 text-center text-gray-600 text-sm relative z-10">
                © {new Date().getFullYear()} Orderly. All rights reserved.
            </footer>
        </div>
    );
};

export default LandingPage;

import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { GoogleOAuthProvider } from '@react-oauth/google';
import WatchListManager from "./WatchListManager";
import AuthPage from "./AuthPage";
import MobileBlocker from "./MobileBlocker";

const AppContent = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Check initial screen size
    const checkMobile = () => {
      // 1. Standard Mobile Check (Viewport width)
      const isSmallViewport = window.innerWidth < 768;

      // 2. Desktop Mode on Mobile Heuristic
      // Phones in desktop mode often fake innerWidth (e.g. 980px) but physical screen width remains small.
      // We check for Touch capability AND small physical screen width.
      // Note: We use 768px as a safe cutoff for "Phones". Tablets might exceed this, which is usually desired behavior (allow tablets).
      const hasTouch = (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia("(any-pointer: coarse)").matches);
      const isSmallScreen = window.screen.width < 768;

      // If it's a small viewport OR (it's a touch device with a small physical screen -> likely phone in desktop mode)
      setIsMobile(isSmallViewport || (hasTouch && isSmallScreen));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Initial token check
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
    }
    setLoading(false);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogin = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify({ id: data._id, name: data.name, email: data.email, picture: data.picture }));
    setToken(data.token);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
  };

  // Check if current route is a shared route
  const isSharedRoute = location.pathname.startsWith('/share/');

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">Loading...</div>;
  }

  // --- Mobile Restriction Logic ---
  if (isMobile) {
    if (!isSharedRoute) {
      // If mobile and NOT shared route -> Block
      return <MobileBlocker />;
    } else {
      // If mobile AND shared route -> Strict Desktop View
      // Enforce a min-width on the viewport via a wrapper
      // and ensure the scale makes it fit (handled by browser usually if we force width)
      return (
        <div style={{ minWidth: '1024px', overflowX: 'auto' }}>
          <WatchListManager />
        </div>
      );
    }
  }

  return (
    <Routes>
      <Route
        path="/share/:shareId"
        element={<WatchListManager />}
      />
      <Route
        path="/"
        element={
          !!token ? (
            <WatchListManager token={token} onLogout={handleLogout} />
          ) : (
            <AuthPage onLogin={handleLogin} />
          )
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
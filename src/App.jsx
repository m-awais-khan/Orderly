import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { GoogleOAuthProvider } from '@react-oauth/google';
import WatchListManager from "./WatchListManager";
import AuthPage from "./AuthPage";
import MobileBlocker from "./MobileBlocker";

const AppContent = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState('desktop');
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

      // 1. Blocked: Small Viewport
      if (isSmallViewport) {
        setIsMobile('mobile_blocked');
        return;
      }

      // 2. Restricted: Desktop Mode on Phone
      // Large viewport but small physical screen + touch
      if (hasTouch && isSmallScreen) {
        setIsMobile('mobile_restricted');
        return;
      }

      // 3. Desktop / Tablet
      setIsMobile('desktop');
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
  const getRenderContent = () => {
    // 1. Mobile Blocked (Phones in standard view)
    if (isMobile === 'mobile_blocked' && !isSharedRoute) {
      return <MobileBlocker />;
    }

    // 2. Mobile Restricted (Phones in desktop mode)
    // OR Mobile Shared View (Always strict view)
    if (isMobile === 'mobile_restricted' || (isMobile === 'mobile_blocked' && isSharedRoute)) {
      return (
        <div style={{ minWidth: '1024px', overflowX: 'auto' }}>
          <WatchListManager
            token={token} // Pass token if authenticated
            onLogout={handleLogout} // Pass logout if authenticated
            isRestrictedMobile={!isSharedRoute} // Only restrict if NOT a shared route (shared routes have their own read-only logic)
          // Actually, wait. Shared routes ARE read-only by definition for visitors.
          // But if I am a logged-in user viewing my own app in "Desktop Mode" on mobile, I want restrictions.
          // So isRestrictedMobile = true when isMobile === 'mobile_restricted'.
          />
        </div>
      );
    }

    // 3. Desktop / Tablet Standard View
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

  // Simplified Render
  const content = getRenderContent();
  if (content.type === MobileBlocker) return content;
  // If it's the specific wrapper for restricted/shared:
  if (content.props.style?.minWidth) return content;

  // Default routing
  return content;
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
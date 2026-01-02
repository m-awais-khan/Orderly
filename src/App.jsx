import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { GoogleOAuthProvider } from '@react-oauth/google';
import WatchListManager from "./WatchListManager";
import AuthPage from "./AuthPage";
import LandingPage from "./LandingPage";
import MobileBlocker from "./MobileBlocker";

const AppContent = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
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
    const storedUser = localStorage.getItem('user');
    if (storedToken) {
      setToken(storedToken);
    }
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogin = (data) => {
    const userData = { id: data._id, name: data.name, email: data.email, picture: data.picture };
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(data.token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
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
      // ... (existing mobile logic can stay or be adapted, but for now focusing on main routes)
      // If NOT shared route and NO token -> Show AuthPage (in desktop wrapper)
      // Logic below handles this via Routes now, but for specific "restricted" view we might need care.
      // For simplicity, let's keep the restricted view logic but point it to the new components.

      if (!isSharedRoute && !token) {
        // For restricted mobile, we might still want to show AuthPage directly or maybe LandingPage?
        // Let's forward to standard routing but wrapped if needed, or keep this "forced" view.
        // Given the complexity, let's keep the existing "forced wrapper" for Auth if not logged in.
        // BUT, the user wants Landing Page first now.
        // So, if not logged in, maybe show Landing Page instead of AuthPage here?
        // Let's default to standard routing which will handle the flow.
        // The "Existing Logic" returned specific JSX. We should try to use Routes if possible.
        // However, to minimize breakage of this specific "Mobile Restricted" feature, let's leave straightforward logic.
      }
    }

    // 3. Desktop / Tablet Standard View (and refactored Mobile Restricted)
    return (
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage isLoggedIn={!!token} />} />

        {/* Shared Routes */}
        <Route
          path="/share/:shareId"
          element={<WatchListManager />}
        />

        {/* Auth Route */}
        <Route
          path="/login"
          element={
            !!token ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AuthPage onLogin={handleLogin} />
            )
          }
        />

        {/* Protected Dashboard Route */}
        <Route
          path="/dashboard"
          element={
            !!token ? (
              <WatchListManager token={token} user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Catch-all redirect */}
        <Route extract path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  };

  // Simplified Render
  const content = getRenderContent();

  // Handle Mobile Blocked directly
  if (isMobile === 'mobile_blocked' && !isSharedRoute) {
    return <MobileBlocker />;
  }

  // Handle Mobile Restricted "Wrapper" logic RE-IMPLEMENTATION for the new Routing
  // The original code returned a specific <div> wrapper.
  // We can wrap the Routes in that div if isMobile is restricted.
  if (isMobile === 'mobile_restricted' || (isMobile === 'mobile_blocked' && isSharedRoute)) {
    return (
      <div style={{ minWidth: '1024px', minHeight: '100vh', overflowX: 'auto', backgroundColor: '#000' }}>
        <Routes>
          <Route path="/" element={<LandingPage isLoggedIn={!!token} />} />
          <Route path="/share/:shareId" element={<WatchListManager />} />
          <Route path="/login" element={!!token ? <Navigate to="/dashboard" /> : <AuthPage onLogin={handleLogin} />} />
          <Route path="/dashboard" element={!!token ? <WatchListManager token={token} user={user} onLogout={handleLogout} isRestrictedMobile={true} /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    );
  }

  // Desktop View
  return (
    <Routes>
      <Route path="/" element={<LandingPage isLoggedIn={!!token} />} />
      <Route path="/share/:shareId" element={<WatchListManager />} />
      <Route path="/login" element={!!token ? <Navigate to="/dashboard" /> : <AuthPage onLogin={handleLogin} />} />
      <Route path="/dashboard" element={!!token ? <WatchListManager token={token} user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
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
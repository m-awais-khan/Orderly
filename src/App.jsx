import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GoogleOAuthProvider } from '@react-oauth/google';
import WatchListManager from "./WatchListManager";
import AuthPage from "./AuthPage";

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if token is valid (optional: add token expiry check here)
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
    }
    setLoading(false);
  }, []);

  const handleLogin = (data) => {
    localStorage.setItem('token', data.token);
    // Store more google info if needed
    localStorage.setItem('user', JSON.stringify({ id: data._id, name: data.name, email: data.email, picture: data.picture }));
    setToken(data.token);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">Loading...</div>;
  }

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <BrowserRouter>
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
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
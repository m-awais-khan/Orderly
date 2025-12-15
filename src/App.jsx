import { useState, useEffect } from "react";
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
    localStorage.setItem('user', JSON.stringify({ id: data._id, username: data.username }));
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
    <div>
      {!token ? (
        <AuthPage onLogin={handleLogin} />
      ) : (
        <WatchListManager token={token} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;

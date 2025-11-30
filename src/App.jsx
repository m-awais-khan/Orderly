import { useState, useEffect } from "react";
import WatchListManager from "./WatchListManager";

function App() {
  // Optional: move darkMode state here if you want global control
  const [darkMode, setDarkMode] = useState(false);

  // Load saved dark mode from localStorage (or your window.storage)
  useEffect(() => {
    const saved = localStorage.getItem("watchlists-darkmode");
    if (saved) setDarkMode(JSON.parse(saved));
  }, []);

  return (
    <div className={darkMode ? "dark" : ""}>
      <WatchListManager />
    </div>
  );
}

export default App;

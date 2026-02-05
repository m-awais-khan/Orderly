import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import TmdbSearch from "./TmdbSearch";
import axios from "axios";
import {
  Trash2,
  Plus,
  GripVertical,
  Link,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Film,
  Moon,
  Sun,
  Edit2,
  X,
  Download,
  Upload,
  MessageSquare,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreVertical,
  Menu,
  LogOut,
  Share2,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Search,
  Star,
  AlertTriangle,
  Play,      // For Status
  Check,     // For Status
  Clock,     // For Status
  MinusCircle, // For Status
  EyeOff,  // For Status
  List,
  PieChart,
  Sparkles,
  FileText,
  Info,
  RotateCcw,
  CornerUpRight,
  User,
} from "lucide-react";

import Toast from "./components/Toast";
import ConfirmationModal from "./components/ConfirmationModal";

import ScoreSelectionModal from "./components/ScoreSelectionModal";
import ItemDetailsModal from "./components/ItemDetailsModal";
import WatchOrderViewModal from "./components/WatchOrderViewModal";
import StatisticsOverlay from "./components/StatisticsOverlay";
import AIRecommendationsOverlay from "./components/AIRecommendationsOverlay";
import WarningsPanel from "./components/WarningsPanel";
import TimerOverlay from "./components/TimerOverlay";

const WatchListManager = ({ token, user, onLogout, isRestrictedMobile = false }) => {
  // UI State
  const [toasts, setToasts] = useState([]);
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => { },
    isDangerous: false,
    confirmText: "Confirm"
  });



  const [scoreModal, setScoreModal] = useState({
    isOpen: false,
    itemData: null,
    currentScore: 0
  });

  const [selectedItemForModal, setSelectedItemForModal] = useState(null);
  const [showWarnings, setShowWarnings] = useState(false);
  const [watchOrderModal, setWatchOrderModal] = useState({ isOpen: false, title: "", watchOrder: [] });
  const [showStats, setShowStats] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('watchlist_viewMode');
    return saved || 'list';
  });
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [lists, setLists] = useState({});

  // Smart Lists Calculation
  const smartLists = useMemo(() => {
    const smart = {
      completed: [],
      watching: [],
      dropped: [],
      plan_to_watch: [],
      not_interested: []
    };


    Object.entries(lists).forEach(([listName, items]) => {
      items.forEach(item => {
        if (item.status && smart[item.status]) {
          smart[item.status].push({ ...item, originalList: listName });
        }
      });
    });

    return smart;
  }, [lists]);





  const [folders, setFolders] = useState({}); // New state for folders
  const [selectedList, setSelectedList] = useState(null);
  const [newListName, setNewListName] = useState("");
  const [draggedItem, setDraggedItem] = useState(null);
  const [expandedRefs, setExpandedRefs] = useState({});
  const [expandedFolders, setExpandedFolders] = useState({}); // State for expanded folders
  const [showAddList, setShowAddList] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false); // State for add folder input
  const [newFolderName, setNewFolderName] = useState(""); // State for new folder name
  const [listDescriptions, setListDescriptions] = useState({}); // State for list descriptions
  const [editingDescription, setEditingDescription] = useState(false); // State for editing description
  const [movingList, setMovingList] = useState(null); // State for list being moved
  const [movingFolder, setMovingFolder] = useState(null); // State for folder being moved
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleNotes, setVisibleNotes] = useState({}); // State to track visible notes
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      return saved === 'true';
    }
    return false;
  });
  const [isListLocked, setIsListLocked] = useState(true); // Default locked locally, logic will override if needed, but for restricted it stays locked
  const [editingListName, setEditingListName] = useState(null);
  const [itemToMove, setItemToMove] = useState(null); // { item, fromList }

  const [sharedLists, setSharedLists] = useState([]); // Array of { listName, shareId }
  const [showShareModal, setShowShareModal] = useState(false); // Toggle for share modal

  const [editingInMainContent, setEditingInMainContent] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar state


  const [currentPage, setCurrentPage] = useState(1);
  const [isLinkDropdownOpen, setIsLinkDropdownOpen] = useState(false);

  const linkDropdownRef = useRef(null);

  // Update Timer State
  const [lastUpdateCheck, setLastUpdateCheck] = useState(null);
  const [showTimerOverlay, setShowTimerOverlay] = useState(false);

  // Profile Menu State
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const [highlightedItemId, setHighlightedItemId] = useState(null); // ID of item to scroll to and highlight
  const highlightTimeoutRef = useRef(null);

  // List Owner
  const [listOwner, setListOwner] = useState(null); // Owner of the shared list

  // --- Derived State ---
  const isSmartList = selectedList?.startsWith('special:');
  const activeDisplayItems = useMemo(() => {
    if (!selectedList) return [];
    if (isSmartList) {
      return smartLists[selectedList.split(':')[1]] || [];
    }
    return lists[selectedList] || [];
  }, [selectedList, lists, smartLists]);


  // Update Check Logic
  const isUpdateDue = useMemo(() => {
    if (!lastUpdateCheck) return false;
    const diffTime = Math.abs(new Date() - new Date(lastUpdateCheck));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 30;
  }, [lastUpdateCheck]);

  // Calculate Warning Count (Replicates logic from WarningsPanel)
  const warningCount = useMemo(() => {
    let count = 0;
    Object.values(lists).forEach(items => {
      items.forEach(item => {
        if (item.status === 'completed') {
          // Check 1: No Rating
          if (!item.score || item.score === 0) {
            count++;
          }
          // Check 2: No Language Selected
          if (!item.watched_languages || item.watched_languages.length === 0) {
            count++;
          }
        }
      });
    });

    if (isUpdateDue) {
      count++;
    }

    return count;
  }, [lists, isUpdateDue]);



  // --- UI Helpers ---
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const openConfirmModal = ({ title, message, onConfirm, isDangerous = false, confirmText = "Confirm" }) => {
    setConfirmationModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmationModal(prev => ({ ...prev, isOpen: false }));
      },
      isDangerous,
      confirmText
    });
  };

  const closeConfirmModal = () => {
    setConfirmationModal(prev => ({ ...prev, isOpen: false }));
  };
  const ITEMS_PER_PAGE = 50;
  const dragActiveRef = useRef(false);

  // Auto-scroll refs
  const scrollContainerRef = useRef(null);
  const scrollIntervalRef = useRef(null);

  // Scroll to Top Logic
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  useEffect(() => {
    setCurrentPage(1);
    setEditingDescription(false); // Reset description editing when list changes
  }, [selectedList]);

  useEffect(() => {
    // Check URL for shareId
    const pathParts = window.location.pathname.split('/');
    const shareIndex = pathParts.indexOf('share');
    let shareId = null;
    if (shareIndex !== -1 && pathParts[shareIndex + 1]) {
      shareId = pathParts[shareIndex + 1];
    }

    if (shareId) {
      loadSharedData(shareId);
    } else if (token) {
      loadData();
      // loadDarkMode(); // Disabled to persist local preference always
    }
  }, [token]); // Re-run if token changes (though usually distinct modes)

  const loadSharedData = async (shareId) => {
    try {
      const res = await fetch(`/api/share/${shareId}`);
      if (!res.ok) throw new Error("Link invalid");
      const data = await res.json();

      // Construct a minimal state for the shared view
      setLists({
        [data.listName]: data.items,
        ...(data.relatedLists || {})
      });
      setSelectedList(data.listName);
      setFolders({});
      setSharedLists([]); // Visitor doesn't own shares
      setListOwner(data.ownerUsername); // Set the owner name

      // Load list description for the shared list
      if (data.listDescription) {
        setListDescriptions({ [data.listName]: data.listDescription });
      }

      // Force Lock Mode
      setIsListLocked(true);



      // Hide Sidebar (or minimal) logic handled by !token usually, but let's be explicit if needed
      // Actually, if we just restrict by !token in UI, that works. owner name is in data.ownerUsername


    } catch (err) {
      showToast("Shared link is invalid or has been revoked.", "error");
      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    }
  };

  // --- Navigation History (Shared View) ---
  const [navHistory, setNavHistory] = useState([]);

  const handleNavigate = (targetList, itemId = null) => {
    // Only track history if sidebar is likely hidden (e.g. Shared Mode or Mobile)
    // But logic is safe generally.
    setNavHistory((prev) => [...prev, selectedList]);
    setSelectedList(targetList);
    setIsSidebarOpen(false);

    if (itemId) {
      setHighlightedItemId(itemId);
    }
  };

  // Effect to scroll to highlighted item when it becomes available
  useEffect(() => {
    if (highlightedItemId && activeDisplayItems.length > 0) {
      const itemIndex = activeDisplayItems.findIndex(item => item.id === highlightedItemId);

      if (itemIndex !== -1) {
        // Calculate which page the item is on
        const targetPage = Math.floor(itemIndex / ITEMS_PER_PAGE) + 1;

        // If we need to switch pages, do it first
        if (currentPage !== targetPage) {
          setCurrentPage(targetPage);
          return; // Wait for next render
        }

        // Wait for render cycle to ensure DOM element exists
        setTimeout(() => {
          const element = document.getElementById(`item-${highlightedItemId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add temporary highlight class if needed (already handled by React state)
          }

          // Clear highlight after animation (ALWAYS, to prevent stuck state)
          if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
          highlightTimeoutRef.current = setTimeout(() => {
            setHighlightedItemId(null);
          }, 2000);
        }, 300); // Slight delay to ensure DOM update
      }
    }
  }, [highlightedItemId, selectedList, activeDisplayItems, currentPage]);

  const handleBack = () => {
    if (navHistory.length === 0) return;
    const prevList = navHistory[navHistory.length - 1];
    setNavHistory((prev) => prev.slice(0, -1));
    setSelectedList(prevList);
  };

  const loadData = async () => {
    try {
      if (!token) return;

      // 1. Try Loading from API
      let data = null;
      try {
        const response = await fetch('/api/data', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          data = await response.json();
        } else if (response.status >= 400) {
          // Any Error (4xx/5xx) -> Logout to be safe
          console.warn(`API returned ${response.status}. Logging out.`);
          onLogout();
          return;
        }
      } catch (e) {
        console.warn("API load failed", e);
        // Security Check: If we are online but API fails, it might be a suppressed Auth/CORS error for a deleted account.
        // To be safe, we logout instead of showing insecure local data.
        if (navigator.onLine) {
          console.warn("Online but API failed. Suspected invalid session. Logging out.");
          onLogout();
          return;
        }
      }

      // 2. Fallback: Local Storage (Only if API failed completely)
      if (!data) {
        // Construct user-specific key if user info is available
        const userKey = user?.email ? `watchlist_data_${user.email}` : "watchlists-data";

        // Try user-specific key first
        let localData = localStorage.getItem(userKey);

        /*
        // DISABLED: Legacy Migration caused issues where old data reappeared for new accounts.
        // If not found and we have a user, try legacy key (Migration)
        if (!localData && user?.email) {
          const legacyData = localStorage.getItem("watchlists-data");
          if (legacyData) {
            console.log("Migrating legacy data to user profile...");
            localData = legacyData;
            // We don't delete legacy data to be safe, but we will save to new key
          }
        }
        */

        if (localData) {
          const parsed = JSON.parse(localData);
          setLists(parsed.lists || {});
          setFolders(parsed.folders || {});
          setSelectedList(parsed.selectedList || null);
          setSharedLists(parsed.sharedLists || []);
          setListDescriptions(parsed.listDescriptions || {});

          setSharedLists(parsed.sharedLists || []);
          setListDescriptions(parsed.listDescriptions || {});
          setLastUpdateCheck(parsed.lastUpdateCheck || Date.now());

          // Re-save to ensure it's in the correct user-key and synced to API if possible
          saveData(parsed.lists, parsed.selectedList, parsed.folders, parsed.listDescriptions, parsed.lastUpdateCheck || Date.now());
          return;
        }
      }

      // 3. Use API Data
      if (data) {
        setLists(data.lists || {});
        setFolders(data.folders || {});
        setSelectedList(data.selectedList || Object.keys(data.lists || {})[0] || null);
        setSharedLists(data.sharedLists || []);
        setSharedLists(data.sharedLists || []);
        setListDescriptions(data.listDescriptions || {});
        setLastUpdateCheck(data.lastUpdateCheck || Date.now());
      }

      setListOwner(null);
    } catch (error) {
      console.error("Failed to load data:", error);
      showToast("Failed to load data. Please refresh.", "error");
    }
  };

  const loadDarkMode = async () => {
    try {
      const response = await fetch('/api/darkmode', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const mode = await response.json();
      setDarkMode(mode);
      if (mode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch (error) {
      console.error("Failed to load dark mode:", error);
    }
  };

  const deleteAccount = async () => {
    openConfirmModal({
      title: "Delete Account",
      message: "Are you sure you want to delete your account? This action cannot be undone and all your data will be lost.",
      isDangerous: true,
      confirmText: "Delete Account",
      onConfirm: async () => {
        try {
          const res = await fetch('/api/auth/delete', {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (res.ok) {
            // Explicitly clear local user data
            if (user?.email) {
              const userKey = `watchlist_data_${user.email}`;
              localStorage.removeItem(userKey);
            }
            onLogout();
          } else {
            const data = await res.json();
            showToast(data.error || "Failed to delete account", "error");
          }
        } catch (err) {
          console.error("Failed to delete account:", err);
          showToast("Error deleting account", "error");
        }
      }
    });
  };

  const resetAccount = () => {
    openConfirmModal({
      title: "Factory Reset Data",
      message: "Are you sure you want to wipe ALL your data? This will delete all lists, folders, and items. Your account will remain active but empty. This cannot be undone.",
      isDangerous: true,
      confirmText: "Wipe Everything",
      onConfirm: () => {
        // 1. Reset State
        const emptyLists = {};
        const emptyFolders = {};
        const emptyDescriptions = {};
        const emptySelected = null;

        setLists(emptyLists);
        setFolders(emptyFolders);
        setListDescriptions(emptyDescriptions);
        setSelectedList(emptySelected);
        setSharedLists([]);

        // 2. Clear Search
        setSearchQuery("");

        // 3. Save Empty Data to Server & LocalStorage
        saveData(emptyLists, emptySelected, emptyFolders, emptyDescriptions);

        showToast("All data has been wiped successfully.", "success");
      }
    });
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode);

    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    try {
      fetch('/api/darkmode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newMode),
      });
    } catch (error) {
      console.error("Failed to save dark mode preference:", error);
    }
  };

  const saveData = async (newLists, newSelected, newFolders, newDescriptions = null, newLastUpdateCheck = null) => {
    try {
      const payload = {
        lists: newLists,
        selectedList: newSelected,
        folders: newFolders,
        sharedLists: sharedLists, // Also persist shared lists reference
        listDescriptions: newDescriptions !== null ? newDescriptions : listDescriptions,
        lastUpdateCheck: (newLastUpdateCheck !== null) ? newLastUpdateCheck : (lastUpdateCheck || Date.now())
      };

      // 1. Save to User-Specific LocalStorage (Backup)
      const userKey = user?.email ? `watchlist_data_${user.email}` : "watchlists-data";
      localStorage.setItem(userKey, JSON.stringify(payload));

      // 2. Save to API
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok && response.status >= 400) {
        console.warn(`Save rejected by API (${response.status}). Logging out.`);
        // Revert local save to prevent zombie state
        if (user?.email) {
          localStorage.removeItem(userKey);
        }
        onLogout();
      }
    } catch (error) {
      console.error("Failed to save data:", error);
    }
  };

  // Update list description
  const updateListDescription = (listName, description) => {
    const newDescriptions = { ...listDescriptions, [listName]: description };
    setListDescriptions(newDescriptions);
    saveData(lists, selectedList, folders, newDescriptions);
  };

  // --- Global Search Logic ---
  const { filteredLists, filteredItems } = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return { filteredLists: [], filteredItems: [] };

    const query = searchQuery.toLowerCase();

    // Filter Lists
    const fLists = Object.keys(lists).filter(name => name.toLowerCase().includes(query));

    // Filter Items
    const fItems = [];
    Object.entries(lists).forEach(([listName, items]) => {
      items.forEach(item => {
        // Text Match or Reference Match
        if ((item.text && item.text.toLowerCase().includes(query)) ||
          (item.type === 'reference' && item.ref && item.ref.toLowerCase().includes(query))) {
          fItems.push({ ...item, listName });
        }
      });
    });

    return { filteredLists: fLists, filteredItems: fItems };
  }, [lists, searchQuery]);

  const createList = () => {
    // 1. Basic validation (Ensure list is unlocked and name is not empty)
    if (isListLocked) return;
    const trimmedName = newListName.trim();

    if (!trimmedName) {
      showToast("List name cannot be empty.", "warning");
      return;
    }

    // 2. Case-Insensitive Duplicate Check
    const lowerTrimmedName = trimmedName.toLowerCase();
    const isDuplicate = Object.keys(lists).some(
      (listName) => listName.toLowerCase() === lowerTrimmedName
    );

    if (isDuplicate) {
      showToast(`A list named "${trimmedName}" already exists.`, "error");
      return;
    }

    // 3. Create new list and update state
    const newLists = {
      ...lists,
      // Use the user's provided casing for the list key
      [trimmedName]: [],
    };

    setLists(newLists);
    setSelectedList(trimmedName); // Set the new list as selected

    // 🛑 IMPORTANT: Clear the input state and hide the input field
    setNewListName("");
    setShowAddList(false);

    // Save data
    saveData(newLists, trimmedName, folders);
  };

  const createFolder = () => {
    if (isListLocked) return;
    const trimmedName = newFolderName.trim();

    if (!trimmedName) {
      showToast("Folder name cannot be empty.", "warning");
      return;
    }

    const lowerTrimmedName = trimmedName.toLowerCase();
    const isDuplicate = Object.keys(folders).some(
      (folderName) => folderName.toLowerCase() === lowerTrimmedName
    );

    if (isDuplicate) {
      showToast(`A folder named "${trimmedName}" already exists.`, "error");
      return;
    }

    const newFolders = {
      ...folders,
      [trimmedName]: [],
    };

    setFolders(newFolders);
    setNewFolderName("");
    setShowAddFolder(false);
    saveData(lists, selectedList, newFolders);
  };

  const deleteFolder = (folderName) => {
    if (isListLocked) return;
    openConfirmModal({
      title: "Delete Folder",
      message: `Delete folder "${folderName}"? Lists inside will be moved to the root.`,
      isDangerous: true,
      confirmText: "Delete",
      onConfirm: () => {
        const newFolders = { ...folders };
        delete newFolders[folderName];
        setFolders(newFolders);
        saveData(lists, selectedList, newFolders);
        showToast(`Folder "${folderName}" deleted.`, "success");
      }
    });
  };

  const renameFolder = (oldName, newName) => {
    const trimmedNewName = newName.trim();
    if (!trimmedNewName || trimmedNewName === oldName) {
      setEditingListName(null); // Reusing this state for folder editing exit
      return;
    }

    const lowerTrimmedNewName = trimmedNewName.toLowerCase();
    const isDuplicate = Object.keys(folders).some(
      (existingName) =>
        existingName !== oldName &&
        existingName.toLowerCase() === lowerTrimmedNewName
    );

    if (isDuplicate) {
      showToast(`A folder named "${trimmedNewName}" already exists.`, "error");
      return;
    }

    const newFolders = {};
    Object.keys(folders).forEach((folderName) => {
      if (folderName === oldName) {
        newFolders[trimmedNewName] = folders[oldName];
      } else {
        newFolders[folderName] = folders[folderName];
      }
    });

    setFolders(newFolders);
    setEditingListName(null);
    saveData(lists, selectedList, newFolders);
  };

  const moveListToFolder = (listName, targetFolder) => {
    // targetFolder can be null (root)
    const newFolders = { ...folders };

    // Remove from current folder if exists
    Object.keys(newFolders).forEach((folder) => {
      newFolders[folder] = newFolders[folder].filter(
        (name) => name !== listName
      );
    });

    // Add to new folder if not root
    if (targetFolder) {
      if (!newFolders[targetFolder]) newFolders[targetFolder] = [];
      newFolders[targetFolder].push(listName);
    }

    setFolders(newFolders);
    setMovingList(null);
    saveData(lists, selectedList, newFolders);
  };

  // --- Nested Folder Logic ---

  const isDescendant = (parentFolder, targetFolder, currentFolders) => {
    if (parentFolder === targetFolder) return true;
    const children = currentFolders[parentFolder] || [];
    for (const child of children) {
      if (child.startsWith("folder:")) {
        const childName = child.replace("folder:", "");
        if (isDescendant(childName, targetFolder, currentFolders)) return true;
      }
    }
    return false;
  };

  const moveFolderToFolder = (folderName, targetFolder) => {
    // 1. Validation
    if (folderName === targetFolder) return; // Cannot move into self
    if (targetFolder && isDescendant(folderName, targetFolder, folders)) {
      showToast("Cannot move a folder into its own subfolder!", "error");
      return;
    }

    const newFolders = { ...folders };
    const folderString = `folder:${folderName}`;

    // 2. Remove from current parent (if any)
    Object.keys(newFolders).forEach((f) => {
      newFolders[f] = newFolders[f].filter((name) => name !== folderString);
    });

    // 3. Add to target
    if (targetFolder) {
      if (!newFolders[targetFolder]) newFolders[targetFolder] = [];
      newFolders[targetFolder].push(folderString);
    }

    setFolders(newFolders);
    setMovingFolder(null);
    saveData(lists, selectedList, newFolders);
  };

  const toggleFolderExpand = (folderName) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  };

  const RecursiveFolder = ({ folderName }) => {
    const isExpanded = expandedFolders[folderName];
    const contents = folders[folderName] || [];

    return (
      <div id={`folder-${folderName}`} className="group/folder mb-2">
        <div
          className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 border border-transparent
          ${editingListName === `folder:${folderName}` ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
          onClick={() => toggleFolderExpand(folderName)}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 group-hover/folder:text-yellow-500'}`}>
              {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
            </div>

            {editingListName === `folder:${folderName}` ? (
              <input
                type="text"
                defaultValue={folderName}
                className="flex-1 min-w-0 px-2 py-1 text-sm bg-white dark:bg-gray-700 rounded border border-blue-300 focus:outline-none"
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onKeyPress={(e) => e.key === "Enter" && renameFolder(folderName, e.target.value)}
                onBlur={(e) => renameFolder(folderName, e.target.value)}
              />
            ) : (
              <span className="font-medium text-gray-700 dark:text-gray-200 truncate text-sm">
                {folderName}
              </span>
            )}
          </div>

          {!isListLocked && (
            <div className="flex items-center opacity-0 group-hover/folder:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMovingFolder(folderName);
                }}
                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                title="Move Folder"
              >
                <MoreVertical size={12} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingListName(`folder:${folderName}`);
                }}
                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                <Edit2 size={12} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openConfirmModal({
                    title: "Delete Folder",
                    message: `Delete folder "${folderName}"? Lists inside will be moved to the root.`,
                    isDangerous: true,
                    confirmText: "Delete",
                    onConfirm: () => deleteFolder(folderName)
                  });
                }}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Folder Contents */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100 mt-1 pl-4' : 'max-h-0 opacity-0'}`}>
          <div className="pl-2 border-l-2 border-gray-100 dark:border-gray-800 space-y-1 py-1">
            {contents.map((item) => {
              if (item.startsWith("folder:")) {
                const subFolderName = item.replace("folder:", "");
                return <RecursiveFolder key={subFolderName} folderName={subFolderName} />;
              } else {
                const listName = item;
                return (
                  <div
                    key={listName}
                    onClick={() => {
                      if (editingListName !== listName) setSelectedList(listName);
                    }}
                    className={`group/list flex justify-between items-center px-3 py-2 rounded-lg cursor-pointer transition-all text-sm
                      ${selectedList === listName
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200"
                      }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="truncate flex-1">{listName}</span>
                      {sharedLists.find(s => s.listName === listName) && (
                        <Share2 size={12} className={selectedList === listName ? "text-blue-200" : "text-blue-500"} />
                      )}
                    </div>
                    {!isListLocked && (
                      <div className="flex items-center gap-1 opacity-0 group-hover/list:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMovingList(listName);
                          }}
                          className={`p-1 rounded transition-all ${selectedList === listName ? 'text-blue-200 hover:text-white hover:bg-blue-500' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                          title="Move List"
                        >
                          <MoreVertical size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openConfirmModal({
                              title: "Delete List",
                              message: `Are you sure you want to delete "${listName}"?`,
                              isDangerous: true,
                              confirmText: "Delete",
                              onConfirm: () => deleteList(listName)
                            });
                          }}
                          className={`p-1 rounded transition-all ${selectedList === listName ? 'text-red-200 hover:text-white hover:bg-red-500' : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                          title="Delete List"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              }
            })}
            {contents.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400 italic">Empty folder</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renameList = (oldName, newName) => {
    const trimmedNewName = newName.trim();

    // 1. Basic validation
    if (!trimmedNewName || trimmedNewName === oldName) {
      setEditingListName(null);
      return;
    }

    // 2. 🛑 CASE-INSENSITIVE DUPLICATE CHECK
    const lowerTrimmedNewName = trimmedNewName.toLowerCase();
    const existingListNames = Object.keys(lists);

    const isDuplicate = existingListNames.some(
      (existingName) =>
        // Ensure we compare against the new name only if the existing name is NOT the old name
        existingName !== oldName &&
        existingName.toLowerCase() === lowerTrimmedNewName
    );

    if (isDuplicate) {
      showToast(`A list named "${trimmedNewName}" already exists.`, "error");
      return;
    }

    // 3. Update the lists object (rename the key while preserving items) AND update references
    const newLists = {};
    Object.keys(lists).forEach((listName) => {
      // Get the items for the current list
      let currentListItems = lists[listName];

      // Update any references to the old list name within this list
      currentListItems = currentListItems.map((item) => {
        if (item.type === "reference" && item.ref === oldName) {
          return { ...item, ref: trimmedNewName };
        }
        return item;
      });

      if (listName === oldName) {
        // Use the new name (with user's casing) as the key
        newLists[trimmedNewName] = currentListItems;
      } else {
        newLists[listName] = currentListItems;
      }
    });

    // 4. Update state and persistence
    // Also update folders if the list was in one
    const newFolders = { ...folders };
    Object.keys(newFolders).forEach((folder) => {
      newFolders[folder] = newFolders[folder].map((name) =>
        name === oldName ? trimmedNewName : name
      );
    });

    setLists(newLists);
    setFolders(newFolders);
    setSelectedList(trimmedNewName); // Keep the newly named list selected
    setEditingListName(null); // Exit editing mode
    saveData(newLists, trimmedNewName, newFolders);
  };

  const deleteList = (listName) => {
    const newLists = { ...lists };
    delete newLists[listName];
    Object.keys(newLists).forEach((key) => {
      newLists[key] = newLists[key].filter((item) => {
        if (item.type === "reference" && item.ref === listName) {
          return false;
        }
        return true;
      });
    });
    const newSelected =
      selectedList === listName
        ? Object.keys(newLists)[0] || null
        : selectedList;

    // Remove from folders
    const newFolders = { ...folders };
    Object.keys(newFolders).forEach((folder) => {
      newFolders[folder] = newFolders[folder].filter(
        (name) => name !== listName
      );
    });

    setLists(newLists);
    setFolders(newFolders);
    setSelectedList(newSelected);
    saveData(newLists, newSelected, newFolders);
  };

  // --- Auto-Scroll Logic ---
  const stopAutoScroll = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  const handleContainerDragOver = (e) => {
    // Only engage if dragging an item (check dragActiveRef or draggedItem)
    if (!dragActiveRef.current) return;

    // e.clientY is relative to viewport
    if (!scrollContainerRef.current) return;

    const { top, bottom, height } = scrollContainerRef.current.getBoundingClientRect();
    const mouseY = e.clientY;

    // Define active zones (top 15% and bottom 15% or fixed px)
    const threshold = 120; // 120px from edges

    let direction = 0;
    let speed = 5; // Base speed

    if (mouseY < top + threshold) {
      direction = -1; // Scroll Up
      // Increase speed as we get closer to the edge
      const distance = Math.max(0, mouseY - top);
      speed = 5 + (1 - distance / threshold) * 15; // Max speed 20
    } else if (mouseY > bottom - threshold) {
      direction = 1; // Scroll Down
      const distance = Math.max(0, bottom - mouseY);
      speed = 5 + (1 - distance / threshold) * 15;
    }

    if (direction !== 0) {
      if (!scrollIntervalRef.current) {
        scrollIntervalRef.current = setInterval(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop += direction * speed;
          }
        }, 16); // ~60fps
      }
    } else {
      stopAutoScroll();
    }
  };

  // --- Status Handling ---
  const handleStatusConfirm = async (status) => {
    try {
      const targetListName = statusModal.listName || selectedList;

      if (statusModal.isEditMode) {
        // Logic for editing existing item status
        const itemId = statusModal.itemData;

        if (!lists[targetListName]) {
          console.error(`Status Update Failed: List "${targetListName}" not found.`);
          return;
        }

        const currentListItems = [...lists[targetListName]];
        let updatedItem = currentListItems.find(item => item.id === itemId);

        if (updatedItem) {
          // Create a copy to modify
          updatedItem = { ...updatedItem, status: status };

          // AUTO-COMPLETE LOGIC (Same as Add Item and Details Modal)
          if (status === 'completed' && (updatedItem.media_type === 'tv' || updatedItem.media_type === 'tv_season')) {
            try {
              // apiKey removed
              if (true) {
                let url;
                if (updatedItem.media_type === 'tv_season') {
                  if (updatedItem.tmdb_id && updatedItem.season_number !== undefined) {
                    url = `/api/tmdb/tv/${updatedItem.tmdb_id}/season/${updatedItem.season_number}`;
                  }
                } else {
                  url = `/api/tmdb/tv/${updatedItem.id}`;
                }

                if (url) {
                  const response = await axios.get(url);
                  const data = response.data;
                  let total = 0;
                  if (updatedItem.media_type === 'tv_season') {
                    total = data.episodes?.length || 0;
                  } else {
                    total = data.number_of_episodes || 0;
                  }

                  if (total > 0) {
                    updatedItem.episodes_watched = total;
                  }
                }
              }
            } catch (error) {
              console.error("Failed to fetch episodes on Status Update:", error);
            }
          }
          // RESET LOGIC: If moving FROM completed -> Reset episodes (per user rule)
          else if (status !== 'completed' && updatedItem.status === 'completed') {
            updatedItem.episodes_watched = 0;
          }

          // Update the list
          const updatedList = currentListItems.map(item =>
            item.id === itemId ? updatedItem : item
          );

          const newLists = { ...lists, [targetListName]: updatedList };
          setLists(newLists);
          saveData(newLists, targetListName, folders);

          // CRITICAL: Update activeItem if it's the one we just modified, so Details Modal sees it immediately
          if (activeItem && activeItem.id === itemId) {
            setActiveItem(updatedItem);
          }

          showToast("Status updated.", "success");
        } else {
          console.warn("Item not found in list for status update:", itemId);
        }
      }
    } catch (err) {
      console.error("Unexpected error in handleStatusConfirm:", err);
    } finally {
      // "Add new item" logic is now handled directly in addItem/handleAddNewTextItem
      // Ensure modal always closes
      setStatusModal({ isOpen: false, isEditMode: false, itemData: null });
    }
  };

  const addItem = async (itemData) => {
    if (isListLocked) return;
    if (!itemData || !itemData.id || !selectedList) return;

    // Check for duplicates
    const currentList = lists[selectedList] || [];
    const isDuplicate = currentList.some((item) => {
      // Normalize IDs to strings for comparison
      const itemId = String(item.id);
      const itemTmdbId = item.tmdb_id ? String(item.tmdb_id) : null;
      const newDataId = String(itemData.id);
      // If itemData.tmdb_id is missing (raw search result), use .id
      const newDataTmdbId = itemData.tmdb_id ? String(itemData.tmdb_id) : newDataId;

      return (
        itemId === newDataId ||
        itemId === newDataTmdbId ||
        (itemTmdbId && itemTmdbId === newDataId) ||
        (itemTmdbId && itemTmdbId === newDataTmdbId)
      );
    });

    if (isDuplicate) {
      showToast(`"${itemData.title || itemData.name}" is already in the list.`, "warning");
      return;
    }

    let newItem = {
      // Use TMDB ID as the item key for uniqueness
      id: itemData.id,
      // Use the title/name provided by TMDB for display
      text: itemData.title || itemData.name,
      type: "tmdb",
      // Store the media type (movie, tv, anime, tv_season)
      media_type: itemData.media_type,
      // Store extra metadata if available (for seasons)
      season_number: itemData.season_number,
      tmdb_id: itemData.tmdb_id || itemData.id,
      year:
        (itemData.release_date || itemData.first_air_date || itemData.air_date)?.slice(0, 4) || null,
      image: itemData.poster_path
        ? `https://image.tmdb.org/t/p/w92${itemData.poster_path}`
        : "placeholder_url",
      note: "",
      status: "completed", // ALWAYS DEFAULT TO COMPLETED per user request
      genre_ids: itemData.genre_ids, // Store genres for stats
      times_rewatched: itemData.media_type === 'movie' ? 1 : 0 // Movies start with 1 when completed
    };

    // AUTO-COMPLETE LOGIC: Fetch details to get total episodes
    if (newItem.media_type === 'tv' || newItem.media_type === 'tv_season') {
      try {
        // apiKey removed
        if (true) {
          let url;
          if (newItem.media_type === 'tv_season') {
            if (newItem.tmdb_id && newItem.season_number !== undefined) {
              url = `/api/tmdb/tv/${newItem.tmdb_id}/season/${newItem.season_number}`;
            }
          } else {
            url = `/api/tmdb/tv/${newItem.id}`;
          }

          if (url) {
            const response = await axios.get(url);
            const data = response.data;
            let total = 0;
            if (newItem.media_type === 'tv_season') {
              total = data.episodes?.length || 0;
            } else {
              total = data.number_of_episodes || 0;
            }

            if (total > 0) {
              newItem.episodes_watched = total;

              // Generate Granular Data for 'Completed' status
              // This ensures StatisticsOverlay works immediately without needing a toggle
              if (newItem.media_type === 'tv' && data.seasons) {
                // Canonical Name Update
                if (data.name) newItem.text = data.name;

                const sProgress = {};
                const sWatched = {};

                data.seasons.forEach(season => {
                  // Skip if upcoming (0 episodes) or unreleased air date (future check implied by 0 episodes usually)
                  if (season.episode_count > 0) {
                    // Full progress for this season
                    sProgress[season.season_number] = season.episode_count;
                    // Generate array [1, 2, ... N]
                    sWatched[season.season_number] = Array.from({ length: season.episode_count }, (_, k) => k + 1);
                  }
                });

                newItem.season_progress = sProgress;
                newItem.season_watched_episodes = sWatched;
              }

              // Handle Single Season Item Granular Data
              if (newItem.media_type === 'tv_season' && data.episodes) {
                const sNum = data.season_number;
                const epCount = data.episodes.length;
                newItem.season_progress = { [sNum]: epCount };
                newItem.season_watched_episodes = { [sNum]: Array.from({ length: epCount }, (_, k) => k + 1) };
              }
            }

            // Capture episode_run_time for TV shows
            if (data.episode_run_time) {
              newItem.episode_run_time = data.episode_run_time;
            }
          }
        }
      } catch (error) {
        console.error("Failed to auto-fetch episodes on Add:", error);
      }
    }

    // Fetch runtime for movies
    if (newItem.media_type === 'movie') {
      try {
        // apiKey removed
        if (true) {
          const url = `/api/tmdb/movie/${newItem.id}`;
          const response = await axios.get(url);
          if (response.data) {
            if (response.data.title) newItem.text = response.data.title; // Canonical Title Update
            if (response.data.runtime) newItem.runtime = response.data.runtime; // Store runtime in minutes
          }
        }
      } catch (error) {
        console.error("Failed to fetch movie runtime:", error);
      }
    }

    // Direct Add without Modal
    setLists(prevLists => {
      const updatedList = [...(prevLists[selectedList] || []), newItem];
      const newLists = { ...prevLists, [selectedList]: updatedList };
      saveData(newLists, selectedList, folders);
      return newLists;
    });

    showToast(`Added "${newItem.text}" to list.`, "success");
    setSearchQuery(""); // Clear search
  };



  // Sync Dark Mode state to DOM
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Force lock if on restricted mobile
  useEffect(() => {
    if (isRestrictedMobile) {
      setIsListLocked(true);
    }
  }, [isRestrictedMobile]);

  // Close Link List dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (linkDropdownRef.current && !linkDropdownRef.current.contains(event.target)) {
        setIsLinkDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      // Clear interval if any (though loop is in effect cleanup)
    };
  }, []);

  // --- Session Heartbeat ---
  // Periodically check if session is valid (e.g. if account deleted on another device)
  useEffect(() => {
    if (!token) return;

    const intervalId = setInterval(async () => {
      // Lightweight session check - only validate token, don't reload data
      try {
        const response = await fetch('/api/data', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // If we get 401/403/404, session is invalid -> logout
        if (response.status >= 400 && response.status < 500) {
          console.warn(`Session invalid (${response.status}). Logging out.`);
          onLogout();
        }
        // On success (200/304), do nothing - session is still valid
        // We deliberately don't update state to avoid resetting selectedList
      } catch (e) {
        // Network errors are handled silently (user might be offline temporarily)
        console.warn("Heartbeat check failed:", e);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(intervalId);
  }, [token]);

  // --- Effects ---
  /* 
  useEffect(() => {
    if (!token) return;
    // loadData(); // Redundant, handled above
  }, [token]); 
  */



  const handleUpdateItem = (updatedItem) => {
    const targetList = updatedItem.originalList || selectedList;
    if (!lists[targetList]) return;

    const newLists = { ...lists };
    let listItems = [...newLists[targetList]];
    const index = listItems.findIndex(i => i.id === updatedItem.id);

    if (index > -1) {
      listItems[index] = updatedItem;

      // CLEANUP: If the main show is dropped, remove any individual dropped seasons for this show
      if (updatedItem.status === 'dropped') {
        const showId = updatedItem.id;
        listItems = listItems.filter(item => {
          // Keep the item being updated (the show itself)
          if (item.id === updatedItem.id) return true;

          // Remove dropped seasons of this show
          if (item.media_type === 'tv_season' &&
            item.tmdb_id === showId &&
            item.status === 'dropped') {
            return false;
          }
          return true;
        });
      }

      newLists[targetList] = listItems;
      setLists(newLists);
      saveData(newLists, targetList, folders);
      showToast("Item updated successfully", "success");

      // Update modal if it's open with this item
      if (selectedItemForModal && selectedItemForModal.id === updatedItem.id) {
        setSelectedItemForModal(updatedItem);
      }
    }
  };

  const handleDropSeason = (originalItem, season, epsWatched) => {
    const targetList = originalItem.originalList || selectedList;
    if (!lists[targetList]) return;

    const newLists = { ...lists };
    let listItems = [...newLists[targetList]];

    // Check if this season already exists in the list (as a separate item)
    const existingIndex = listItems.findIndex(item =>
      item.media_type === 'tv_season' &&
      item.tmdb_id === originalItem.id &&
      item.season_number === season.season_number
    );

    if (existingIndex > -1) {
      // Update existing item instead of creating duplicate
      const existingItem = listItems[existingIndex];
      listItems[existingIndex] = {
        ...existingItem,
        status: 'dropped',
        episodes_watched: epsWatched,
        note: `Dropped at episode ${epsWatched} (Updated)`,
        // Refresh text and image in case they were missing or outdated
        text: `${originalItem.text}: ${season.name}`,
        image: season.poster_path ? `https://image.tmdb.org/t/p/w92${season.poster_path}` : existingItem.image
      };
      showToast(`Updated dropped status for "${season.name}".`, "success");
    } else {
      const droppedSeasonItem = {
        id: `${originalItem.id}_s${season.season_number}_dropped_${Date.now()}`,
        tmdb_id: originalItem.id, // Link to parent show
        media_type: 'tv_season',
        season_number: season.season_number,
        text: `${originalItem.text}: ${season.name}`,
        image: season.poster_path ? `https://image.tmdb.org/t/p/w92${season.poster_path}` : originalItem.image,
        status: 'dropped',
        episodes_watched: epsWatched,
        addedAt: new Date().toISOString(),
        year: season.air_date ? season.air_date.substring(0, 4) : null,
        note: `Dropped at episode ${epsWatched}`
      };
      listItems.push(droppedSeasonItem);
      showToast(`Dropped "${season.name}" added as separate item.`, "success");
    }

    // UPDATE MAIN SHOW EPISODE COUNT
    const mainItemIndex = listItems.findIndex(i => i.id === originalItem.id);
    if (mainItemIndex > -1) {
      const mainItem = listItems[mainItemIndex];
      // Only subtract the episodes that were actually counted towards the total
      const newWatched = Math.max(0, (mainItem.episodes_watched || 0) - epsWatched);

      listItems[mainItemIndex] = {
        ...mainItem,
        episodes_watched: newWatched,
        // If we subtracted episodes but it was completed, the modal logic will handle re-verifying status based on "effective total"
        // For now, we just update the count.
      };
    }

    newLists[targetList] = listItems;
    setLists(newLists);
    saveData(newLists, targetList, folders);
  };

  const handleUpdateScore = (itemId, listName, newScore) => {
    if (!listName) return;

    setLists(prev => {
      const newList = prev[listName].map(item => {
        if (item.id === itemId) {
          return { ...item, score: newScore };
        }
        return item;
      });
      return { ...prev, [listName]: newList };
    });
    setScoreModal({ isOpen: false, itemData: null, currentScore: 0 });
    showToast(`Rating updated`, "success");
  };

  const handleTextInputKeyPress = (e) => {
    if (e.key === "Enter") {
      addTextItem();
    } else if (e.key === "Escape") {
      setNewTextItem("");
    }
  };



  const addReference = (refListName) => {
    if (isListLocked || !refListName) return;
    if (!selectedList || refListName === selectedList) return;
    const currentListItems = lists[selectedList] || [];
    const isDuplicate = currentListItems.some(
      (item) => item.type === "reference" && item.ref === refListName
    );

    if (isDuplicate) {
      showToast(`The list "${refListName}" is already included as a reference in "${selectedList}".`, "warning");
      return;
    }
    const newLists = { ...lists };
    newLists[selectedList] = [
      ...newLists[selectedList],
      { id: Date.now(), ref: refListName, type: "reference" },
    ];
    setLists(newLists);
    saveData(newLists, selectedList, folders);
  };

  const deleteItem = (itemId, targetList = selectedList) => {
    if (isListLocked) return;
    if (!lists[targetList]) return;

    const newLists = { ...lists };
    newLists[targetList] = newLists[targetList].filter(
      (item) => item.id !== itemId
    );
    setLists(newLists);
    saveData(newLists, targetList, folders);
  };

  const moveItem = (index, direction) => {
    if (isListLocked) return;
    if (!lists[selectedList]) return; // Guard against Smart Lists

    const newLists = { ...lists };
    const items = [...newLists[selectedList]];

    // Calculate new position
    const newIndex = index + direction;

    // Check bounds
    if (newIndex < 0 || newIndex >= items.length) return;

    // Swap items
    const temp = items[index];
    items[index] = items[newIndex];
    items[newIndex] = temp;

    newLists[selectedList] = items;
    setLists(newLists);
    saveData(newLists, selectedList, folders);
  };

  const handleMoveItemConfirm = (targetList) => {
    if (!itemToMove || !targetList) return;
    const { item, fromList } = itemToMove;

    if (targetList === fromList) {
      setItemToMove(null);
      return;
    }

    const newLists = { ...lists };

    // Check for duplicates in target list
    const targetListItems = newLists[targetList] || [];
    const isDuplicate = targetListItems.some(existingItem => {
      // TMDB Items - Robust ID Checking
      // Manually added items use 'id' as TMDB ID. AI items use 'tmdb_id'.
      if ((item.tmdb_id || item.type === 'tmdb') && (existingItem.tmdb_id || existingItem.type === 'tmdb')) {
        const id1 = item.tmdb_id || item.id;
        const id2 = existingItem.tmdb_id || existingItem.id;

        // Compare loosely to handle string/number differences
        if (id1 == id2 && existingItem.media_type === item.media_type) {
          return true;
        }
      }

      // Reference Items
      if (item.type === 'reference') {
        return existingItem.type === 'reference' && existingItem.ref === item.ref;
      }
      // Text Items
      if (item.type === 'text' || (!item.tmdb_id && !item.type && item.text)) {
        return existingItem.text === item.text && !existingItem.tmdb_id;
      }

      return false;
    });

    if (isDuplicate) {
      showToast(`Item already exists in "${targetList}"`, "warning");
      // Keep modal open by NOT clearing itemToMove
      return;
    }

    // Remove from source list
    if (newLists[fromList]) {
      newLists[fromList] = newLists[fromList].filter(i => i.id !== item.id);
    }

    // Add to target list
    if (newLists[targetList]) {
      // Create a copy of the item and update originalList if it exists
      const newItem = { ...item };
      if (newItem.originalList) {
        newItem.originalList = targetList;
      }
      newLists[targetList] = [...newLists[targetList], newItem];
    }

    setLists(newLists);
    saveData(newLists, selectedList, folders);
    setItemToMove(null);
    showToast(`Moved "${item.text || item.title || item.name || item.ref}" to "${targetList}"`, "success");
  };

  const handleDragStart = (e, index) => {
    if (!dragActiveRef.current) {
      e.preventDefault();
      return;
    }
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (isListLocked) return;
    if (!lists[selectedList]) return; // Guard against Smart Lists
    if (draggedItem === null || draggedItem === index) return;
    const newLists = { ...lists };
    const items = [...newLists[selectedList]];
    const draggedContent = items[draggedItem];
    items.splice(draggedItem, 1);
    items.splice(index, 0, draggedContent);
    newLists[selectedList] = items;
    setLists(newLists);
    setDraggedItem(index);
  };
  const handleDragEnd = () => {
    if (isListLocked) return;
    setDraggedItem(null);
    if (lists[selectedList]) {
      saveData(lists, selectedList, folders);
    }
    dragActiveRef.current = false;
  };
  const toggleRefExpand = (itemId) => {
    setExpandedRefs((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const generateShareLink = async () => {
    if (!selectedList) return;
    try {
      const res = await fetch(`/api/share/${encodeURIComponent(selectedList)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        // Add to local state
        setSharedLists([...sharedLists, { listName: selectedList, shareId: data.shareId }]);
      } else {
        showToast("Failed to create share link: " + data.error, "error");
      }
    } catch (error) {
      console.error("Share gen error:", error);
      showToast("Error generating link.", "error");
    }
  };

  const revokeShareLink = async () => {
    if (!selectedList) return;
    openConfirmModal({
      title: "Revoke Link",
      message: "Are you sure? The existing link will stop working immediately.",
      isDangerous: true,
      confirmText: "Revoke",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/share/${encodeURIComponent(selectedList)}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            // Remove from local state
            setSharedLists(sharedLists.filter(s => s.listName !== selectedList));
            showToast("Share link revoked.", "success");
          } else {
            showToast("Failed to revoke link.", "error");
          }
        } catch (error) {
          console.error("Share revoke error:", error);
          showToast("Error revoking link.", "error");
        }
      }
    });
  };

  // WatchListManager.jsx

  const exportData = () => {
    // 1. Package all critical state data
    const exportObject = {
      appVersion: "1.0", // A version stamp for future compatibility checks
      timestamp: new Date().toISOString(),
      lists: lists,
      folders: folders, // Export folders
      selectedList: selectedList,
      isListLocked: isListLocked, // Include lock state
    };

    // 2. Convert to JSON string
    const dataStr = JSON.stringify(exportObject, null, 2); // '2' for pretty formatting

    // 3. Create a Blob and a download link
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileDefaultName = `watch_list_backup_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    // Create a temporary link element for downloading
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);

    // Simulate a click to trigger download
    document.body.appendChild(linkElement);
    linkElement.click();
    document.body.removeChild(linkElement);

    showToast("Your watch list data has been successfully exported!", "success");
  };

  // WatchListManager.jsx

  const importData = (dataText) => {
    try {
      // 1. Parse the JSON data
      const importedObject = JSON.parse(dataText);

      // 2. Basic Validation (check for required structure)
      if (
        !importedObject.lists ||
        !importedObject.selectedList ||
        importedObject.isListLocked === undefined
      ) {
        showToast("Import failed: The file does not appear to be a valid Watch List backup.", "error");
        return;
      }

      // 3. 🛑 CRITICAL WARNING AND CONFIRMATION
      openConfirmModal({
        title: "Import Data",
        message: "WARNING: Importing new data will permanently ERASE all current lists and settings. Do you want to continue?",
        isDangerous: true,
        confirmText: "Import & Overwrite",
        onConfirm: () => {
          // 4. Update State and Local Storage (Maintaining the same order and state)

          // Update main list state
          setLists(importedObject.lists);
          setFolders(importedObject.folders || {}); // Import folders

          // Update selected list state
          setSelectedList(importedObject.selectedList);

          // Update lock state
          setIsListLocked(importedObject.isListLocked);

          // 5. Update Local Storage to match the imported state
          saveData(
            importedObject.lists,
            importedObject.selectedList,
            importedObject.folders || {}
          );

          showToast("Data imported successfully!", "success");
        }
      });
    } catch (e) {
      console.error("Import Error:", e);
      showToast("Import failed: Could not read or parse the JSON file.", "error");
    }
  };

  const renderItem = (item, index, isGridView = false) => {
    // ------------------------------------------------------------------
    // 1. REFERENCE ITEM RENDERING (type: 'reference')
    // ------------------------------------------------------------------
    if (item.type === "reference") {
      const isExpanded = expandedRefs[item.id];
      const refList = lists[item.ref] || [];

      // Grid View for Reference Items
      if (isGridView) {
        return (
          <div key={item.id} id={`item-${item.id}`} className="h-full w-full flex items-center justify-center">
            <div
              className={`group relative bg-purple-50 dark:bg-purple-900/30 rounded-xl overflow-hidden border border-purple-200 dark:border-purple-700/50 hover:border-purple-500 transition-all duration-300 cursor-pointer p-4 flex flex-col justify-center items-center aspect-[2/3] w-[85%] shadow-lg 
              ${highlightedItemId === item.id ? 'ring-2 ring-blue-500 scale-[1.02] shadow-blue-500/20' : ''}`}
              onClick={() => handleNavigate(item.ref)}
            >
              <Link size={40} className="text-purple-500 dark:text-purple-400 mb-3" />
              <h4 className="text-sm font-medium text-purple-900 dark:text-purple-200 text-center truncate w-full" title={item.ref}>
                {item.ref}
              </h4>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">{refList.length} items</p>

              {/* Delete Button */}
              {!isListLocked && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openConfirmModal({
                      title: "Delete Reference",
                      message: `Delete reference to "${item.ref}"?`,
                      isDangerous: true,
                      confirmText: "Delete",
                      onConfirm: () => deleteItem(item.id)
                    });
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 size={12} className="text-white" />
                </button>
              )}
            </div>
          </div>
        );
      }

      return (
        <div key={item.id} id={`item-${item.id}`} className="mb-3">
          <div
            draggable={!isListLocked}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => toggleRefExpand(item.id)}
            className={`group flex items-center gap-3 p-4 border-l-4 border-purple-500 rounded-xl transition-all duration-200 
              bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm hover:shadow-md
              ${isListLocked ? "cursor-default opacity-90" : "cursor-pointer hover:scale-[1.01]"}
              ${highlightedItemId === item.id ? 'ring-2 ring-blue-500 scale-[1.02] shadow-blue-500/20' : ''}`}
          >
            <GripVertical
              size={20}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onMouseDown={() => {
                dragActiveRef.current = true;
              }}
              onMouseUp={() => {
                dragActiveRef.current = false;
              }}
              className={`text-gray-400 dark:text-gray-500 ${isListLocked
                ? "opacity-40 cursor-default"
                : "opacity-100 cursor-grab hover:text-blue-500 dark:hover:text-blue-400"
                }`}
            />
            <span className="text-purple-600 hover:text-purple-400 transition-colors">
              {isExpanded ? (
                <ChevronDown size={20} />
              ) : (
                <ChevronRight size={20} />
              )}
            </span>

            <Link
              size={18}
              className="text-purple-600 cursor-pointer hover:text-purple-800 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleNavigate(item.ref);
              }}
            />
            <span className="flex-1 font-semibold text-gray-800 dark:text-gray-100">
              {item.ref} <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">({refList.length} items)</span>
            </span>
            {/* Delete Button (Hidden if locked) */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1">

              {!isListLocked && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openConfirmModal({
                      title: "Delete Reference",
                      message: `Delete reference to "${item.ref}"?`,
                      isDangerous: true,
                      confirmText: "Delete",
                      onConfirm: () => deleteItem(item.id)
                    });
                  }}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Expanded Reference Content */}
          {isExpanded && (
            <div className="ml-8 mt-2 p-4 border-l-2 border-purple-300/50 rounded-r-xl bg-purple-50/50 dark:bg-purple-900/10 backdrop-blur-sm">
              {refList.length === 0 ? (
                <p className="italic text-gray-500 dark:text-gray-400 text-sm">
                  Empty list
                </p>
              ) : (
                refList.map((refItem) => (
                  <div
                    key={refItem.id}
                    className="mb-2 p-2 rounded-lg text-sm bg-white/60 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 shadow-sm border border-purple-100 dark:border-purple-800/30"
                  >
                    {refItem.type === "tmdb" || refItem.type === "text"
                      ? refItem.text
                      : `→ ${refItem.ref}`}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      );
    } else if (item.type === "text") {
      // ------------------------------------------------------------------
      // TEXT ITEM RENDERING
      // ------------------------------------------------------------------

      // Grid View for Text Items
      if (isGridView) {
        return (
          <div key={item.id} id={`item-${item.id}`} className="h-full w-full flex items-center justify-center">
            <div
              className={`group relative bg-white dark:bg-gray-800/50 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700/50 hover:border-amber-500/50 transition-all duration-300 p-4 flex flex-col justify-between aspect-[2/3] cursor-default w-[85%] shadow-lg 
              ${highlightedItemId === item.id ? 'ring-2 ring-blue-500 scale-[1.02] shadow-blue-500/20' : ''}`}
            // No onClick as text items are usually static/completed
            >
              {/* Status Badge */}
              <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-green-500 shadow-md border border-white/10" title="Completed" />
              {/* Text Content */}
              <div className="flex-1 overflow-hidden">
                <p className="text-sm text-gray-700 dark:text-gray-200 line-clamp-4 whitespace-pre-wrap">{item.text}</p>
              </div>

              {/* Note Icon */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.note) {
                    setVisibleNotes(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                  } else if (!isListLocked) {
                    setEditingNoteId(item.id);
                  }
                }}
                className={`absolute top-2 right-2 p-1.5 rounded-md backdrop-blur-sm transition-colors z-20 ${item.note
                  ? visibleNotes[item.id] ? 'bg-amber-600' : 'bg-amber-500/80 hover:bg-amber-500'
                  : !isListLocked ? 'bg-gray-100/50 hover:bg-amber-100 dark:bg-gray-700/50 dark:hover:bg-gray-600' : 'hidden'
                  }`}
                title={item.note ? (visibleNotes[item.id] ? "Hide note" : "Show note") : "Add note"}
              >
                <FileText size={12} className={item.note ? "text-white" : "text-gray-400 dark:text-gray-300 hover:text-amber-500"} />
              </button>

              {/* Note Display/Editor */}
              {((item.note && visibleNotes[item.id]) || editingNoteId === item.id) && (
                <div className="absolute inset-x-2 top-10 p-2 bg-amber-900/95 rounded-lg shadow-xl backdrop-blur-md z-30 max-h-[80%] flex flex-col gap-2 border border-amber-700/50">
                  {editingNoteId === item.id && !isListLocked ? (
                    <textarea
                      autoFocus
                      defaultValue={item.note || ''}
                      onBlur={(e) => {
                        const newNote = e.target.value;
                        if (newNote !== item.note) {
                          handleUpdateItem({ ...item, note: newNote });
                        }
                        setEditingNoteId(null);
                        if (newNote) {
                          setVisibleNotes(prev => ({ ...prev, [item.id]: true }));
                        }
                      }}
                      className="w-full text-xs p-2 bg-black/20 text-amber-100 rounded resize-none outline-none border border-amber-800 focus:border-amber-500"
                      rows={4}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                      }}
                    />
                  ) : (
                    <>
                      <div className="text-xs text-amber-100 overflow-y-auto whitespace-pre-wrap max-h-24">
                        {item.note}
                      </div>
                      {!isListLocked && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNoteId(item.id);
                          }}
                          className="self-end text-[10px] bg-amber-800/80 hover:bg-amber-700 px-2 py-1 rounded text-amber-100 transition-colors border border-amber-700"
                        >
                          Edit
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Bottom Actions */}
              <div className="mt-auto pt-2 border-t border-gray-100 dark:border-gray-700/50 flex justify-between items-center">
                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Text</span>
                {!isListLocked && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openConfirmModal({
                        title: "Delete Item",
                        message: `Delete this text item?`,
                        isDangerous: true,
                        confirmText: "Delete",
                        onConfirm: () => deleteItem(item.id)
                      });
                    }}
                    className="p-1 bg-red-500/80 hover:bg-red-500 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >
                    <Trash2 size={12} className="text-white" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      }

      const itemContent = (
        <>
          <GripVertical
            size={20}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onMouseDown={() => {
              dragActiveRef.current = true;
            }}
            onMouseUp={() => {
              dragActiveRef.current = false;
            }}
            className={`text-gray-400 dark:text-gray-500 cursor-grab active:cursor-grabbing hover:text-blue-500 dark:hover:text-blue-400
              ${isListLocked ? "opacity-0 w-0 pointer-events-none" : "opacity-100"}`}
          />

          <div className="flex-1 min-w-0">
            <span className="flex-1 text-gray-800 dark:text-gray-200 min-w-0">
              <div className="flex items-start">
                <div className="flex-1 min-w-0">
                  <div className="mt-1 font-medium text-lg">{item.text}</div>

                  {/* Display Note / Editor */}
                  {((item.note && visibleNotes[item.id]) || editingNoteId === item.id) && (
                    <div className="mt-2 w-full relative group/note">
                      {editingNoteId === item.id ? (
                        <textarea
                          autoFocus
                          defaultValue={item.note || ''}
                          onBlur={(e) => {
                            const newNote = e.target.value;
                            if (newNote !== item.note) {
                              handleUpdateItem({ ...item, note: newNote });
                            }
                            setEditingNoteId(null);
                            if (newNote) {
                              setVisibleNotes(prev => ({ ...prev, [item.id]: true }));
                            }
                          }}
                          className="w-full text-sm p-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg border border-blue-500 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                          rows={3}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            // Allow Enter for newlines
                          }}
                        />
                      ) : (
                        <div className="text-sm text-amber-600 dark:text-amber-400 italic break-all whitespace-pre-wrap bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-100 dark:border-amber-800/30 inline-block w-full relative group/display">
                          <span className="mr-8">{item.note}</span>
                          {!isListLocked && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingNoteId(item.id);
                              }}
                              className="absolute top-2 right-2 p-1 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 opacity-0 group-hover/display:opacity-100 transition-opacity"
                              title="Edit Note"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Text item badge */}
                  <div className="mt-3">
                    {item.originalList ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setSelectedList(item.originalList);
                        }}
                        className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        in <span className="text-blue-500">{item.originalList}</span>
                      </button>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                        Text Item
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </span>
          </div>

          {/* Action Buttons */}
          {/* Action Buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {/* Status Icon - Always Visible Now */}
            <div
              className={`p-2 rounded-full cursor-default transition-colors ${item.status && item.status !== 'none'
                ? (() => {
                  switch (item.status) {
                    case 'completed': return "text-green-500 bg-green-50/50 dark:bg-green-900/10";
                    case 'dropped': return "text-red-500 bg-red-50/50 dark:bg-red-900/10";
                    case 'watching': return "text-blue-500 bg-blue-50/50 dark:bg-blue-900/10";
                    case 'plan_to_watch': return "text-purple-500 bg-purple-50/50 dark:bg-purple-900/10";
                    default: return "text-gray-400";
                  }
                })()
                : "text-gray-400"
                }`}
              title={item.status}
            >
              {(() => {
                switch (item.status) {
                  case 'completed': return <Check size={18} />;
                  case 'dropped': return <X size={18} />;
                  case 'watching': return <Play size={18} />;
                  case 'plan_to_watch': return <Clock size={18} />;
                  default: return <MinusCircle size={18} />;
                }
              })()}
            </div>

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (item.note) {
                  setVisibleNotes(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                } else if (!isListLocked) {
                  setEditingNoteId(item.id);
                }
              }}
              className={`p-2 rounded-full transition-colors ${item.note
                ? "text-amber-500 bg-amber-50/50 dark:bg-amber-900/10 hover:bg-gray-100 dark:hover:bg-gray-600"
                : !isListLocked ? "text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-600" : "hidden"
                }`}
              title={item.note ? (visibleNotes[item.id] ? "Hide Note" : "Show Note") : "Add Note"}
            >
              <MessageSquare size={18} />
            </button>

            {!isListLocked && (
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  openConfirmModal({
                    title: "Delete Text Item",
                    message: `Delete item: "${item.text}"?`,
                    isDangerous: true,
                    confirmText: "Delete",
                    onConfirm: () => deleteItem(item.id, item.originalList || selectedList)
                  });
                }}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </>
      );

      return (
        <div
          key={item.id}
          id={`item-${item.id}`}
          draggable={!isListLocked && !item.originalList}
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          className={`group flex items-center gap-3 p-4 mb-3 border border-transparent rounded-xl transition-all duration-200 
            bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm 
            ${!isListLocked ? "hover:shadow-lg hover:scale-[1.01] hover:border-gray-200 dark:hover:border-gray-700" : ""}
            ${highlightedItemId === item.id ? 'ring-2 ring-blue-500 scale-[1.02] shadow-blue-500/20' : ''}`}
        >
          {itemContent}
        </div>
      );
    }

    // ------------------------------------------------------------------
    // 2. TMDB ITEM RENDERING
    // ------------------------------------------------------------------
    let mediaTypePath = item.media_type === "tv" ? "tv" : "movie";
    let tmdbLink = `https://www.themoviedb.org/${mediaTypePath}/${item.id}`;

    if (item.media_type === 'tv_season') {
      tmdbLink = `https://www.themoviedb.org/tv/${item.tmdb_id}/season/${item.season_number}`;
    }

    // Grid View Card Rendering
    if (isGridView) {
      const statusColors = {
        completed: 'bg-green-500',
        dropped: 'bg-red-500',
        watching: 'bg-blue-500',
        rewatching: 'bg-orange-500',
        plan_to_watch: 'bg-purple-500'
      };

      return (
        <div
          key={item.id}
          id={`item-${item.id}`}
          className={`group relative bg-white dark:bg-gray-800/50 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 ${!isListLocked ? 'hover:shadow-lg dark:hover:shadow-blue-500/10 cursor-pointer' : 'cursor-default'} ${highlightedItemId === item.id ? 'ring-2 ring-blue-500 scale-[1.02] shadow-blue-500/20' : ''}`}
          onClick={() => !isListLocked && setSelectedItemForModal(item)}
        >
          {/* Poster */}
          <div className="aspect-[2/3] relative overflow-hidden">
            {item.image ? (
              <img
                src={item.image.replace('/w92/', '/w300/')}
                alt={item.text || item.title || item.name}
                className={`w-full h-full object-cover transition-transform duration-300 ${!isListLocked ? 'group-hover:scale-105' : ''}`}
              />
            ) : (
              <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Film size={40} className="text-gray-300 dark:text-gray-600" />
              </div>
            )}

            {/* Status Badge */}
            {item.status && item.status !== 'none' && (
              <div
                className="absolute top-2 left-2 p-1.5 bg-black/40 backdrop-blur-md rounded-full shadow-lg z-10 transition-transform group-hover:scale-110 border border-white/10"
                title={item.status}
              >
                <div className={`w-2 h-2 rounded-full ${statusColors[item.status] || 'bg-gray-500'} shadow-inner`} />
              </div>
            )}

            {/* Note Icon */}
            {item.note && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setVisibleNotes(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                }}
                className={`absolute top-2 right-2 p-1.5 rounded-md backdrop-blur-sm transition-colors z-20 ${visibleNotes[item.id] ? 'bg-amber-600' : 'bg-amber-500/80 hover:bg-amber-500'}`}
                title={visibleNotes[item.id] ? "Hide note" : "Show note"}
              >
                <FileText size={12} className="text-white" />
              </button>
            )}

            {/* Note Display */}
            {item.note && visibleNotes[item.id] && (
              <div className="absolute inset-x-2 top-10 p-2 bg-amber-900/90 rounded-lg text-xs text-amber-100 backdrop-blur-sm z-30 max-h-20 overflow-y-auto whitespace-pre-wrap">
                {item.note}
              </div>
            )}

            {/* Score Badge */}
            {item.score > 0 && (
              <button
                onClick={(e) => {
                  if (isListLocked) return;
                  e.stopPropagation();
                  e.preventDefault();
                  setScoreModal({
                    isOpen: true,
                    itemData: item.id,
                    currentScore: item.score
                  });
                }}
                disabled={isListLocked}
                className={`absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 rounded-md backdrop-blur-sm text-xs font-bold text-yellow-400 transition-colors z-20 ${!isListLocked ? 'hover:bg-black/80 cursor-pointer' : 'cursor-default'}`}
                title={!isListLocked ? "Change Score" : `My Score: ${item.score}/10`}
              >
                <Star size={10} className="fill-yellow-400" />
                {item.score}
              </button>
            )}

            {/* Hover Overlay with Actions */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-0 left-0 right-0 p-2 flex justify-end gap-1">
                {/* Watch Order Button (for TV) */}
                {item.media_type === 'tv' && item.watch_order?.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setWatchOrderModal({ isOpen: true, title: item.text || item.name || item.title, watchOrder: item.watch_order });
                    }}
                    className="p-1.5 bg-blue-500/80 hover:bg-blue-500 rounded-md transition-colors"
                    title="View Watch Order"
                  >
                    <List size={14} className="text-white" />
                  </button>
                )}

                {/* Delete Button */}
                {!isListLocked && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openConfirmModal({
                        title: "Delete Item",
                        message: `Delete "${item.text || item.title || item.name}"?`,
                        isDangerous: true,
                        confirmText: "Delete",
                        onConfirm: () => deleteItem(item.id)
                      });
                    }}
                    className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded-md transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} className="text-white" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="p-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate" title={item.text || item.title || item.name}>
              {item.text || item.title || item.name}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {item.media_type === 'movie' ? 'Movie' : item.media_type === 'tv_season' ? 'Season' : 'TV'} • {item.year || 'N/A'}
            </p>
          </div>
        </div>
      );
    }

    // Split content into Clickable Area and Action Buttons
    const contentSection = (
      <>
        <GripVertical
          size={20}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={() => {
            dragActiveRef.current = true;
          }}
          onMouseUp={() => {
            dragActiveRef.current = false;
          }}
          className={`text-gray-400 dark:text-gray-500 cursor-grab active:cursor-grabbing hover:text-blue-500 dark:hover:text-blue-400
            ${(isListLocked || isSmartList) ? "hidden" : "opacity-100"}`}
        />



        <span className="flex-1 text-gray-800 dark:text-gray-200 min-w-0">
          <div className="flex items-start">
            <div className="relative group/img flex-shrink-0 mr-4">
              <img
                src={item.image}
                alt={item.title || item.name}
                className="w-12 h-18 lg:w-16 lg:h-24 object-cover rounded-lg shadow-md group-hover/img:shadow-lg transition-shadow"
              />
              <div className="absolute inset-0 rounded-lg ring-1 ring-black/5 dark:ring-white/10"></div>
            </div>

            <div className="flex-1 min-w-0 py-1">
              <div className="font-bold text-base lg:text-lg truncate text-gray-900 dark:text-white">{item.text}</div>

              {item.note && visibleNotes[item.id] && (
                <div className="mt-2 text-sm text-amber-600 dark:text-amber-400 italic break-all whitespace-pre-wrap bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-100 dark:border-amber-800/30 inline-block w-full relative group/note">
                  {item.note}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md 
                  ${item.media_type === 'tv' || item.media_type === 'tv_season'
                    ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                  {item.media_type === 'tv' ? 'TV Show' : item.media_type === 'tv_season' ? 'TV Season' : 'Movie'}
                </span>
                {item.year && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {item.year}
                  </span>
                )}
                {item.originalList && item.originalList !== selectedList && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setSelectedList(item.originalList);
                    }}
                    className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    in <span className="text-blue-500">{item.originalList}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </span>
      </>
    );

    const actionButtons = (
      <div
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      >
        {/* Status Icon - Always Visible Now */}
        <div
          className={`p-2 rounded-full cursor-default transition-colors ${item.status && item.status !== 'none'
            ? (() => {
              switch (item.status) {
                case 'completed': return "text-green-500 bg-green-50/50 dark:bg-green-900/10";
                case 'dropped': return "text-red-500 bg-red-50/50 dark:bg-red-900/10";
                case 'watching': return "text-blue-500 bg-blue-50/50 dark:bg-blue-900/10";
                case 'not_interested': return "text-gray-500 bg-gray-50/50 dark:bg-gray-900/10";
                case 'plan_to_watch': return "text-purple-500 bg-purple-50/50 dark:bg-purple-900/10";
                default: return "text-gray-400";
              }
            })()
            : "text-gray-400"
            }`}
          title={item.status}
        >
          {(() => {
            switch (item.status) {
              case 'completed': return <Check size={18} />;
              case 'dropped': return <X size={18} />;
              case 'watching': return <Play size={18} />;
              case 'not_interested': return <EyeOff size={18} />;
              case 'plan_to_watch': return <Clock size={18} />;
              default: return <MinusCircle size={18} />;
            }
          })()}
        </div>

        {/* Score Rating */}
        {item.score > 0 && (
          <button
            onClick={(e) => {
              if (isListLocked) return;
              e.stopPropagation();
              e.preventDefault();
              setScoreModal({
                isOpen: true,
                itemData: item.id,
                currentScore: item.score
              });
            }}
            disabled={isListLocked}
            className={`flex items-center gap-1 px-2 py-1 text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg shadow-sm transition-all ${!isListLocked ? 'hover:bg-yellow-100 dark:hover:bg-yellow-900/40 cursor-pointer' : 'cursor-default'}`}
            title={!isListLocked ? "Change Score" : `My Score: ${item.score}/10`}
          >
            <Star size={14} fill="currentColor" />
            <span className="text-xs font-bold">{item.score}</span>
          </button>
        )}

        {item.note && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Toggle Visibility
              setVisibleNotes(prev => ({ ...prev, [item.id]: !prev[item.id] }));
            }}
            className={`p-2 rounded-full transition-colors ${item.note
              ? "text-amber-500 bg-amber-50/50 dark:bg-amber-900/10 hover:bg-gray-100 dark:hover:bg-gray-600"
              : "text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-600"
              }`}
            title={visibleNotes[item.id] ? "Hide Note" : "Show Note"}
          >
            <MessageSquare size={18} />
          </button>
        )}

        {/* Watch Order Icon (Smart Button) */}
        {item.watch_order && item.watch_order.length > 0 && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setWatchOrderModal({
                isOpen: true,
                title: item.text || item.title || item.name,
                watchOrder: item.watch_order
              });
            }}
            className="p-2 rounded-full transition-colors text-blue-500 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-800"
            title="View Watch Order"
          >
            <List size={18} />
          </button>
        )}

        {!isListLocked && !isSmartList && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setItemToMove({ item, fromList: item.originalList || selectedList });
            }}
            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800 rounded-full transition-colors"
            title="Move Item"
          >
            <CornerUpRight size={18} />
          </button>
        )}

        {!isListLocked && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              openConfirmModal({
                title: "Delete Item",
                message: `Delete item: "${item.text}"?`,
                isDangerous: true,
                confirmText: "Delete",
                onConfirm: () => deleteItem(item.id, item.originalList || selectedList)
              });
            }}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>
    );

    if (isListLocked) {
      return (
        <div
          key={item.id}
          id={`item-${item.id}`} // Added ID for scrolling
          className={`group flex items-center gap-3 p-4 mb-3 border border-transparent rounded-xl transition-all duration-500 
            bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm opacity-90 cursor-default
            ${highlightedItemId === item.id ? 'ring-2 ring-blue-500 scale-[1.02] shadow-blue-500/20' : ''}`}
        >
          {contentSection}
          {actionButtons}
        </div>
      );
    } else {
      return (
        <div
          key={item.id}
          draggable={!item.originalList}
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          id={`item-${item.id}`} // Added ID for scrolling
          className={`group flex items-center gap-3 p-4 mb-3 border border-transparent rounded-xl transition-all duration-500 
            bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm hover:shadow-xl hover:scale-[1.02] hover:border-blue-200 dark:hover:border-blue-800/30 no-underline cursor-default
            ${highlightedItemId === item.id ? 'ring-2 ring-blue-500 scale-[1.02] shadow-blue-500/20' : ''}`}
        >
          {/* Clickable Content Area */}
          <div
            className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer"
            onClick={(e) => {
              if (!e.defaultPrevented) {
                setSelectedItemForModal(item);
              }
            }}
          >
            {contentSection}
          </div>

          {/* Separate Action Buttons */}
          <div className="flex-shrink-0">
            {actionButtons}
          </div>
        </div>
      );
    }
  };

  return (
    <div className={`min-h-screen p-6 flex justify-center items-start transition-colors duration-500
      ${darkMode ? "bg-gray-950" : "bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50"}`}>

      {/* Background decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/20 blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-400/20 blur-[100px] animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Top Left Timer Widget */}
      {/* Top Left Timer Widget */}
      {token && (
        <div className="fixed top-6 left-6 z-20">
          <button
            onClick={() => setShowTimerOverlay(true)}
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-2 rounded-xl border border-white/20 dark:border-gray-700/50 shadow-md text-xs font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2 hover:scale-105 transition-transform"
          >
            <Clock size={16} className={isUpdateDue ? "text-red-500 animate-pulse" : "text-blue-500"} />
            <span>Last: {lastUpdateCheck ? new Date(lastUpdateCheck).toLocaleDateString() : "Loading..."}</span>
          </button>
        </div>
      )}

      <div className="w-full max-w-7xl relative z-10">
        {/* Restricted Mobile Banner */}
        {isRestrictedMobile && (
          <div className="mb-6 bg-blue-600/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-lg flex items-center justify-center gap-3 animate-slide-down">
            <AlertTriangle size={20} className="text-yellow-300" />
            <span className="font-medium">Desktop View on Mobile: Editing is disabled. Please use a PC to edit.</span>
          </div>
        )}
        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-50 lg:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        {/* Header */}
        <header className="mb-10 flex flex-col md:flex-row items-center justify-between gap-6 animate-fade-in">
          <div className="flex items-center gap-4">
            {navHistory.length > 0 && (
              <button
                onClick={handleBack}
                className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:scale-105 transition-all text-gray-700 dark:text-gray-200 hover:text-blue-500"
                title="Go Back"
              >
                <ArrowLeft size={24} />
              </button>
            )}
            <div
              onClick={() => window.location.reload()}
              className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg shadow-blue-500/30 text-white flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
              title="Refresh App"
            >
              <img src="/logo.png" alt="Orderly Logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold font-heading bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                Orderly
              </h1>
              <p className="text-xs lg:text-base text-gray-500 dark:text-gray-400 font-medium">
                Curate your entertainment journey
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md w-full relative group mx-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Search lists and items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-800 dark:text-gray-100 placeholder-gray-400 text-sm"
            />
          </div>

          <div className="flex items-center gap-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md p-2 rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-sm">
            <div className="flex items-center gap-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md p-2 rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-sm relative">

              {/* Expanded Buttons */}
              {/* Theme Toggle - Always Visible */}
              <button
                onClick={toggleDarkMode}
                className="p-2.5 rounded-xl transition-all duration-300 hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:shadow-md hover:scale-105 active:scale-95 border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {darkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-blue-600" />}
              </button>

              {/* Authenticated User Menu */}
              {token && (
                <>
                  {/* Active Warnings - Always Visible Outside Menu */}
                  {(warningCount > 0) && (
                    <button
                      onClick={() => setShowWarnings(true)}
                      className="mr-3 relative p-2.5 rounded-xl transition-all duration-300 hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400 hover:shadow-md hover:scale-105 active:scale-95 bg-yellow-50/50 dark:bg-yellow-900/10"
                      title="Data Warnings"
                    >
                      <AlertTriangle size={20} />
                      <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
                        {warningCount > 9 ? '9+' : warningCount}
                      </span>
                    </button>
                  )}

                  {/* Collapsible Menu Items */}
                  <div className={`flex items-center gap-3 transition-all duration-500 ease-in-out overflow-hidden ${isProfileMenuOpen ? 'max-w-[800px] opacity-100 mr-2' : 'max-w-0 opacity-0'}`}>
                    {/* Timer Button */}
                    <button
                      onClick={() => setShowTimerOverlay(true)}
                      className={`p-2.5 rounded-xl transition-all duration-300 hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-md hover:scale-105 active:scale-95 ${isUpdateDue ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 animate-pulse' : ''}`}
                      title="Check Updates Timer"
                    >
                      <Clock size={20} />
                    </button>

                    <button
                      onClick={deleteAccount}
                      disabled={isListLocked}
                      className={`p-2.5 rounded-xl transition-all duration-300 text-gray-600 dark:text-gray-300 
                        ${isListLocked
                          ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-gray-800'
                          : 'hover:bg-white dark:hover:bg-gray-700 hover:text-red-600 dark:hover:text-red-500 hover:shadow-md hover:scale-105 active:scale-95 bg-red-50/50 dark:bg-red-900/10'
                        }`}
                      title={isListLocked ? "Unlock list to delete account" : "Delete Account"}
                    >
                      <Trash2 size={20} />
                    </button>

                    <button
                      onClick={resetAccount}
                      disabled={isListLocked}
                      className={`p-2.5 rounded-xl transition-all duration-300 text-gray-600 dark:text-gray-300 
                        ${isListLocked
                          ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-gray-800'
                          : 'hover:bg-white dark:hover:bg-gray-700 hover:text-orange-600 dark:hover:text-orange-500 hover:shadow-md hover:scale-105 active:scale-95 bg-orange-50/50 dark:bg-orange-900/10'
                        }`}
                      title={isListLocked ? "Unlock list to reset data" : "Factory Reset Data (Wipe All)"}
                    >
                      <RotateCcw size={20} />
                    </button>

                    {/* Warning Button inside menu (Only if NO active warnings) */}
                    {!(warningCount > 0) && (
                      <button
                        onClick={() => setShowWarnings(true)}
                        className="relative p-2.5 rounded-xl transition-all duration-300 hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400 hover:shadow-md hover:scale-105 active:scale-95 bg-yellow-50/50 dark:bg-yellow-900/10"
                        title="Data Warnings"
                      >
                        <AlertTriangle size={20} />
                      </button>
                    )}

                    <button
                      onClick={() => openConfirmModal({
                        title: "Sign Out",
                        message: "Are you sure you want to sign out?",
                        confirmText: "Sign Out",
                        onConfirm: onLogout,
                        isDangerous: false
                      })}
                      className="p-2.5 rounded-xl transition-all duration-300 hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 hover:shadow-md hover:scale-105 active:scale-95"
                      title="Sign Out"
                    >
                      <LogOut size={20} />
                    </button>

                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-700"></div>

                    <button
                      onClick={exportData}
                      className="p-2.5 rounded-xl transition-all duration-300 hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-md hover:scale-105 active:scale-95"
                      title="Export Data"
                    >
                      <Download size={20} />
                    </button>

                    <button
                      onClick={() => !isListLocked && document.getElementById("import-file").click()}
                      disabled={isListLocked}
                      className={`p-2.5 rounded-xl transition-all duration-300 text-gray-600 dark:text-gray-300 
                        ${isListLocked
                          ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-gray-800'
                          : 'hover:bg-white dark:hover:bg-gray-700 hover:text-teal-600 dark:hover:text-teal-400 hover:shadow-md hover:scale-105 active:scale-95'
                        }`}
                      title={isListLocked ? "Unlock list to import data" : "Import Data"}
                    >
                      <Upload size={20} />
                    </button>
                  </div>

                  {/* Profile Toggle Button */}
                  <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                    title="Profile & Settings"
                  >
                    {(user?.photoURL || user?.picture) ? (
                      <img src={user.photoURL || user.picture} alt="Profile" className="w-9 h-9 rounded-full object-cover shadow-sm" />
                    ) : (
                      <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white shadow-sm">
                        <User size={20} />
                      </div>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <input
          type="file"
          id="import-file"
          accept=".json"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (event) => {
                importData(event.target.result);
                e.target.value = null;
              };
              reader.readAsText(file);
            }
          }}
        />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 items-start">
          {/* Sidebar (Only show if authenticated/token exists) */}
          {token && (
            <div className={`
            fixed lg:relative inset-y-0 left-0 z-[60] lg:z-auto w-[85vw] max-w-[340px] lg:w-auto h-full lg:h-auto
            lg:col-span-5 xl:col-span-4 space-y-6 animate-slide-up
            transform transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            bg-transparent
            p-4 lg:p-0 overflow-y-auto lg:overflow-visible shadow-2xl lg:shadow-none
          `}>
              <div className="bg-white/70 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl p-4 lg:p-6 border border-white/20 dark:border-gray-700/50 shadow-xl">
                {/* Header with Title and Close Button */}
                <div className="flex justify-center items-center mb-4 relative">
                  <h2 className="text-2xl font-bold font-heading text-gray-800 dark:text-gray-100 text-center">
                    Collections
                  </h2>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="lg:hidden p-2 text-gray-500 hover:text-gray-700 absolute right-0"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Action Buttons Row - Centered */}
                <div className="flex items-center justify-center gap-3 mb-6">
                  <button
                    onClick={() => setShowStats(true)}
                    className="p-2.5 rounded-xl transition-all duration-300 bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 hover:shadow-sm"
                    title="Statistics"
                  >
                    <PieChart size={20} />
                  </button>

                  <button
                    onClick={() => !isListLocked && setShowRecommendations(true)}
                    disabled={isListLocked}
                    className={`p-2.5 rounded-xl transition-all duration-300 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 hover:shadow-sm ${isListLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                    title={isListLocked ? "Unlock to use AI Recommendations" : "AI Recommendations"}
                  >
                    <Sparkles size={20} />
                  </button>

                  <button
                    onClick={() => !isRestrictedMobile && setIsListLocked(!isListLocked)}
                    disabled={isRestrictedMobile}
                    className={`p-2.5 rounded-xl transition-all duration-300 ${isListLocked
                      ? "bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
                      : "bg-green-50 text-green-500 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400"
                      } ${isRestrictedMobile ? "opacity-50 cursor-not-allowed" : ""}`}
                    title={isRestrictedMobile ? "Editing disabled on Mobile Desktop View" : (isListLocked ? "Unlock Lists" : "Lock Lists")}
                  >
                    {isListLocked ? "🔒" : "🔓"}
                  </button>

                  <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                    <button
                      onClick={() => setShowAddList(!showAddList)}
                      disabled={isListLocked}
                      className={`p-2 rounded-lg transition-all ${isListLocked
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm text-blue-600 dark:text-blue-400"
                        }`}
                      title="New List"
                    >
                      <Plus size={18} />
                    </button>
                    <button
                      onClick={() => setShowAddFolder(!showAddFolder)}
                      disabled={isListLocked}
                      className={`p-2 rounded-lg transition-all ${isListLocked
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm text-yellow-600 dark:text-yellow-400"
                        }`}
                      title="New Folder"
                    >
                      <FolderPlus size={18} />
                    </button>
                  </div>
                </div>

                {/* Special Status Lists - Compact Row */}
                <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
                  {[
                    { key: 'completed', icon: Check, label: "Completed", color: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400', ring: 'ring-green-500' },
                    { key: 'watching', icon: Play, label: "Watching", color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400', ring: 'ring-blue-500' },
                    { key: 'dropped', icon: X, label: "Dropped", color: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400', ring: 'ring-red-500' },
                    { key: 'plan_to_watch', icon: Clock, label: "Plan to Watch", color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400', ring: 'ring-purple-500' },
                    { key: 'not_interested', icon: EyeOff, label: "Not Interested", color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', ring: 'ring-gray-500' }
                  ].map(({ key, icon: Icon, label, color, ring }) => {
                    const isSelected = selectedList === `special:${key}`;
                    const count = smartLists[key]?.length || 0;
                    if (count === 0 && !isSelected) return null; // Only hide if empty AND not selected (optional: keep visible?) - Let's keep visible if it was visible before. The previous logic was "if items.length === 0 return null". Let's assume user wants to see them to access them? Actually previous code HID them if empty: `if (items.length === 0) return null;`. I will respect that.

                    if (smartLists[key]?.length === 0 && !isSelected) return null;

                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedList(`special:${key}`)}
                        className={`relative p-2.5 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 group
                          ${isSelected
                            ? `${color} ring-2 ${ring} shadow-md`
                            : `${color.replace('bg-', 'hover:bg-').replace('100', '50')} opacity-70 hover:opacity-100`
                          }
                          ${!isSelected ? 'bg-gray-50 dark:bg-gray-800' : ''} 
                        `}
                        title={`${label} (${count})`}
                      >
                        <Icon size={20} />
                        {count > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-gray-900 text-[10px] font-bold shadow-sm border border-gray-100 dark:border-gray-700">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Add Inputs */}
                <div className="space-y-3 mb-4">
                  {showAddFolder && (
                    <div className="flex gap-2 animate-fade-in">
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && createFolder()}
                        placeholder="Folder name..."
                        className="flex-1 px-3 py-1.5 text-sm rounded-xl border-none bg-gray-100 dark:bg-gray-800 focus:ring-2 focus:ring-yellow-500/50 outline-none transition-all w-full min-w-0"
                        autoFocus
                      />
                      <button
                        onClick={createFolder}
                        className="px-3 py-1.5 rounded-xl bg-yellow-500 text-white text-xs font-medium hover:bg-yellow-600 transition-colors shadow-lg shadow-yellow-500/30 whitespace-nowrap"
                      >
                        Add
                      </button>
                    </div>
                  )}

                  {showAddList && (
                    <div className="flex gap-2 animate-fade-in">
                      <input
                        type="text"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && createList()}
                        placeholder="List name..."
                        className="flex-1 px-3 py-1.5 text-sm rounded-xl border-none bg-gray-100 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all w-full min-w-0"
                        autoFocus
                      />
                      <button
                        onClick={createList}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30 whitespace-nowrap"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
                  {/* 2. Render Root Lists */}
                  {Object.keys(lists)
                    .filter((listName) => !Object.values(folders).some((folderLists) => folderLists.includes(listName)))
                    .map((listName) => (
                      <div
                        key={listName}
                        onClick={() => {
                          if (editingListName !== listName) setSelectedList(listName);
                        }}
                        className={`group flex justify-between items-center px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 border border-transparent
                        ${selectedList === listName
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25 scale-[1.02]"
                            : "bg-white dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-white hover:shadow-md dark:hover:bg-gray-800 hover:scale-[1.01]"
                          }`}
                      >
                        {editingListName === listName ? (
                          <div className="flex items-center w-full gap-2">
                            <input
                              type="text"
                              defaultValue={listName}
                              className="flex-1 px-2 py-1 text-sm rounded text-black outline-none ring-2 ring-blue-400"
                              autoFocus
                              onKeyPress={(e) => e.key === "Enter" && renameList(listName, e.target.value)}
                              onBlur={(e) => renameList(listName, e.target.value)}
                            />
                            <button
                              onMouseDown={(e) => { e.preventDefault(); setEditingListName(null); }}
                              className="text-white/80 hover:text-white"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center flex-1 min-w-0 gap-3">
                              <span className="font-medium truncate">{listName}</span>
                              {sharedLists.find(s => s.listName === listName) && (
                                <Share2 size={12} className={selectedList === listName ? "text-blue-200" : "text-blue-500"} />
                              )}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedList === listName ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                                {lists[listName].length}
                              </span>
                            </div>

                            {!isListLocked && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setMovingList(listName); }}
                                  className={`p-1.5 rounded-lg transition-colors ${selectedList === listName ? 'hover:bg-blue-500 text-blue-100 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600 dark:hover:bg-gray-700'}`}
                                  title="Move List"
                                >
                                  <MoreVertical size={14} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openConfirmModal({
                                      title: "Delete List",
                                      message: `Are you sure you want to delete "${listName}"?`,
                                      isDangerous: true,
                                      confirmText: "Delete",
                                      onConfirm: () => deleteList(listName)
                                    });
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors ${selectedList === listName ? 'hover:bg-red-500 text-red-100 hover:text-white' : 'hover:bg-red-50 text-gray-400 hover:text-red-500 dark:hover:bg-red-900/20'}`}
                                  title="Delete List"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}

                  {/* 3. Render Folders (Now at the bottom) */}
                  {Object.keys(folders)
                    .filter(folderName => !Object.values(folders).some(items => items.includes(`folder:${folderName}`)))
                    .map((folderName) => (
                      <RecursiveFolder key={folderName} folderName={folderName} />
                    ))}

                  {Object.keys(lists).length === 0 && (
                    <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        No lists yet. <br /> Create one to get started!
                      </p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* Main Content */}
          <div className={`${token ? 'lg:col-span-7 xl:col-span-8' : 'col-span-12 lg:col-span-12'} h-full overflow-hidden flex flex-col`}>
            {/* Mobile Header */}
            <div className="lg:hidden flex justify-between items-center mb-4 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md p-4 rounded-2xl border border-white/20 dark:border-gray-700">
              {token && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 -ml-2 text-gray-700 dark:text-gray-200"
                >
                  <Menu size={24} />
                </button>
              )}
              <span className="font-bold text-lg">
                {selectedList || "Watchlist"}
              </span>
              <div className="w-8" /> {/* Spacer */}
            </div>

            {searchQuery.length > 1 ? (
              <div className="bg-white/70 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl p-4 lg:p-8 border border-white/20 dark:border-gray-700/50 shadow-xl h-full overflow-y-auto custom-scrollbar animate-fade-in">
                <div className="flex items-center gap-3 mb-6">
                  <Search className="text-blue-500" size={28} />
                  <h2 className="text-2xl font-bold font-heading text-gray-800 dark:text-gray-100">
                    Search Results
                  </h2>
                </div>

                {filteredLists.length === 0 && filteredItems.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                    No matches found for "{searchQuery}"
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Lists */}
                    {filteredLists.length > 0 && (
                      <div className="animate-slide-up" style={{ animationDelay: '0ms' }}>
                        <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                          <Folder size={18} className="text-yellow-500" /> Lists
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {filteredLists.map(listName => (
                            <div key={listName}
                              onClick={() => {
                                handleNavigate(listName);
                                setSearchQuery("");
                              }}
                              className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl shadow-sm hover:shadow-md cursor-pointer border border-gray-100 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all group">
                              <div className="font-semibold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{listName}</div>
                              <div className="text-xs text-gray-500 mt-1">{lists[listName].length} items</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Items */}
                    {filteredItems.length > 0 && (
                      <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
                        <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                          <Film size={18} className="text-purple-500" /> Items
                        </h3>
                        <div className="space-y-2">
                          {filteredItems.map((item, idx) => (
                            <div key={`${item.listName}-${idx}`}
                              onClick={() => {
                                handleNavigate(item.listName, item.id); // Pass item id
                                setSearchQuery("");
                              }}
                              className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-xl shadow-sm hover:shadow-md cursor-pointer border border-gray-100 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-all flex items-center justify-between group">
                              <div className="flex-1">
                                <div className="font-medium text-gray-800 dark:text-gray-100">
                                  {item.text || item.ref}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                  in <span className="font-semibold text-blue-500">{item.listName}</span>
                                </div>
                              </div>
                              <ArrowRight size={16} className="text-gray-300 group-hover:text-purple-500 transition-colors" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : selectedList ? (
              <div
                ref={scrollContainerRef}
                onDragOver={handleContainerDragOver}
                onDragLeave={stopAutoScroll}
                onDrop={stopAutoScroll}
                className="bg-white/70 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl p-4 lg:p-8 border border-white/20 dark:border-gray-700/50 shadow-xl h-full overflow-y-auto custom-scrollbar"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                  <div>
                    <h2 className="group text-xl lg:text-3xl font-bold font-heading text-gray-800 dark:text-gray-100 flex items-center gap-3">
                      {isSmartList ? (
                        (() => {
                          const key = selectedList.split(':')[1];
                          const config = {
                            completed: { color: 'text-green-500', icon: Check, label: "Completed Items" },
                            watching: { color: 'text-blue-500', icon: Play, label: "Watching Items" },
                            dropped: { color: 'text-red-500', icon: X, label: "Dropped Items" },
                            plan_to_watch: { color: 'text-purple-500', icon: Clock, label: "Plan to Watch" },
                            not_interested: { color: 'text-gray-500', icon: EyeOff, label: "Not Interested" }
                          }[key];
                          const Icon = config.icon;
                          return (
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl ${config.color.replace('text-', 'bg-').replace('500', '100')} dark:bg-opacity-20`}>
                                <Icon size={24} className={config.color} />
                              </div>
                              <span>{config.label}</span>
                            </div>
                          )
                        })()
                      ) : (
                        /* Normal List Header */
                        (() => {
                          const referencedBy = Object.entries(lists).filter(([name, items]) =>
                            items.some(item => item.type === 'reference' && item.ref === selectedList)
                          ).map(([name]) => name);

                          return (
                            <>
                              {editingInMainContent ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    defaultValue={selectedList}
                                    className="px-3 py-2 rounded-lg border-2 border-blue-500 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[200px]"
                                    autoFocus
                                    onKeyPress={(e) => {
                                      if (e.key === "Enter") {
                                        renameList(selectedList, e.target.value);
                                        setEditingInMainContent(false);
                                      }
                                    }}
                                    onBlur={(e) => {
                                      renameList(selectedList, e.target.value);
                                      setEditingInMainContent(false);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <button
                                    onClick={() => setEditingInMainContent(false)}
                                    className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                                    title="Cancel"
                                  >
                                    <X size={20} />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span>{selectedList}</span>
                                  {!isListLocked && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setEditingInMainContent(true);
                                      }}
                                      className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
                                      title="Rename List"
                                      type="button"
                                    >
                                      <Edit2 size={20} />
                                    </button>
                                  )}

                                  {/* Referenced By Badges */}
                                  {referencedBy.length > 0 && (
                                    <div className="flex items-center gap-2 ml-4">
                                      <span className="text-xs text-gray-500 font-normal">Referenced in:</span>
                                      {referencedBy.map(refListName => (
                                        <button
                                          key={refListName}
                                          onClick={() => setSelectedList(refListName)}
                                          className="text-xs font-bold px-2 py-1 rounded-md bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                                          title={`Go to ${refListName}`}
                                        >
                                          {refListName}
                                        </button>
                                      ))}
                                    </div>
                                  )}

                                  {/* Share Button (Only if user has token - i.e. owner) */}
                                  {token && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowShareModal(true);
                                      }}
                                      className={`p-2 rounded-lg transition-all duration-200 ${sharedLists.find(s => s.listName === selectedList)
                                        ? "text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
                                        : "text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                        }`}
                                      title="Share List"
                                      type="button"
                                    >
                                      <Share2 size={20} />
                                    </button>
                                  )}

                                  {/* Show in Folder Button */}
                                  {Object.keys(folders).find(f => folders[f].includes(`folder:${selectedList}`) || folders[f].includes(selectedList)) && (
                                    <button
                                      onClick={() => {
                                        // 1. Find the immediate parent folder definition
                                        // We look for containing EITHER the raw list name OR "folder:<listname>"
                                        let immediateParent = Object.keys(folders).find(f =>
                                          folders[f].includes(selectedList) || folders[f].includes(`folder:${selectedList}`)
                                        );

                                        if (!immediateParent) return;

                                        // 2. Recursive ancestor finding (to expand everything up to the root)
                                        const ancestorsToExpand = [];
                                        let currentChild = immediateParent;

                                        // Max depth safety (though circular refs shouldn't exist)
                                        let safetyCounter = 0;
                                        while (currentChild && safetyCounter < 20) {
                                          ancestorsToExpand.push(currentChild);

                                          // Find the parent of 'currentChild'
                                          const parentOfChild = Object.keys(folders).find(f =>
                                            folders[f].includes(`folder:${currentChild}`)
                                          );

                                          currentChild = parentOfChild; // Move up one level
                                          safetyCounter++;
                                        }

                                        // 3. Expand all ancestors
                                        setExpandedFolders(prev => {
                                          const nextState = { ...prev };
                                          ancestorsToExpand.forEach(folder => {
                                            nextState[folder] = true;
                                          });
                                          return nextState;
                                        });

                                        // 4. Scroll to the immediate parent folder
                                        setTimeout(() => {
                                          const folderEl = document.getElementById(`folder-${immediateParent}`);
                                          if (folderEl) {
                                            folderEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            // Optional highlight visual could go here
                                            // showToast(`Shown in folder "${immediateParent}"`, "success");
                                          } else {
                                            showToast(`Opened "${immediateParent}" (Folder hidden)`, "success");
                                          }
                                        }, 100); // Small delay for React state update & render
                                      }}
                                      className="ml-2 p-2 rounded-lg text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-all duration-200"
                                      title="Show in Folder"
                                    >
                                      <Folder size={20} />
                                    </button>
                                  )}
                                </>
                              )}
                            </>
                          );
                        })()
                      )}

                      <span className="text-sm font-normal px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                        {activeDisplayItems.length} items
                      </span>

                      {/* View Toggle Buttons */}
                      <div className="flex items-center gap-1 ml-auto bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
                        <button
                          onClick={() => {
                            setViewMode('list');
                            localStorage.setItem('watchlist_viewMode', 'list');
                          }}
                          className={`p-1.5 rounded-md transition-all ${viewMode === 'list'
                            ? 'bg-white dark:bg-gray-700 text-blue-500 shadow-sm'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                          title="List View"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setViewMode('grid');
                            localStorage.setItem('watchlist_viewMode', 'grid');
                          }}
                          className={`p-1.5 rounded-md transition-all ${viewMode === 'grid'
                            ? 'bg-white dark:bg-gray-700 text-blue-500 shadow-sm'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                          title="Grid View"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                          </svg>
                        </button>
                      </div>
                    </h2>

                    {/* List Description Area */}
                    {!isSmartList && (
                      <div className="mt-2">
                        {editingDescription ? (
                          <div className="flex flex-col gap-2 animate-fade-in">
                            <textarea
                              autoFocus
                              defaultValue={listDescriptions[selectedList] || ""}
                              placeholder="Add a description for this list..."
                              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                              rows={2}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  updateListDescription(selectedList, e.target.value);
                                  setEditingDescription(false);
                                }
                                if (e.key === 'Escape') {
                                  setEditingDescription(false);
                                }
                              }}
                              onBlur={(e) => {
                                updateListDescription(selectedList, e.target.value);
                                setEditingDescription(false);
                              }}
                            />
                            <p className="text-xs text-gray-400">Press Enter to save, Esc to cancel</p>
                          </div>
                        ) : listDescriptions[selectedList] ? (
                          <div className="group/desc flex items-start gap-2">
                            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                              {listDescriptions[selectedList]}
                            </p>
                            {!isListLocked && (
                              <button
                                onClick={() => setEditingDescription(true)}
                                className="opacity-0 group-hover/desc:opacity-100 p-1 text-gray-400 hover:text-blue-500 rounded transition-all"
                                title="Edit description"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                          </div>
                        ) : (
                          !isListLocked && (
                            <button
                              onClick={() => setEditingDescription(true)}
                              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-500 transition-colors"
                            >
                              <Plus size={14} />
                              Add description
                            </button>
                          )
                        )}
                      </div>
                    )}

                    {!isSmartList && listOwner && (
                      <div className="flex flex-col gap-1 mt-1">
                        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-2">
                          <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md font-medium">
                            <Share2 size={12} />
                            Shared by {listOwner}
                          </span>
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic flex items-center gap-1.5 ml-1">
                          <Info size={12} />
                          Ratings shown are given by <strong className="text-gray-500 dark:text-gray-400">{listOwner}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Add Item Area (Only for Normal Lists and when not locked) */}
                {!isSmartList && !isListLocked && (
                  <div className="mb-8 bg-white/50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                    <TmdbSearch
                      onItemSelected={addItem}
                      disabled={isListLocked}
                    />

                    <div className="flex flex-col md:flex-row gap-4 mt-4">
                      {/* Add Text Item */}


                      {/* Add Reference */}
                      <div className="flex items-center gap-3 bg-white dark:bg-gray-700 px-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          Link List:
                        </span>
                        <div className="relative" ref={linkDropdownRef}>
                          <button
                            onClick={() => !isListLocked && setIsLinkDropdownOpen(!isLinkDropdownOpen)}
                            disabled={isListLocked}
                            className={`flex items-center gap-2 py-2 pl-3 pr-2 rounded-lg text-sm font-medium transition-all min-w-[240px] justify-between
                              ${isListLocked
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
                                : "bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/20"
                              }`}
                          >
                            <span>Select...</span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${isLinkDropdownOpen ? "rotate-180" : ""}`} />
                          </button>

                          {/* Dropdown Menu */}
                          {isLinkDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 custom-scrollbar animate-fade-in-down">
                              <div className="p-1">
                                {Object.keys(lists)
                                  .filter((name) => name !== selectedList)
                                  .map((name) => (
                                    <button
                                      key={name}
                                      onClick={() => {
                                        addReference(name);
                                        setIsLinkDropdownOpen(false);
                                      }}
                                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors truncate"
                                    >
                                      {name}
                                    </button>
                                  ))}
                                {Object.keys(lists).filter((name) => name !== selectedList).length === 0 && (
                                  <div className="px-3 py-2 text-xs text-gray-400 text-center italic">
                                    No other lists available
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Grid View Reorder Hint */}
                {viewMode === 'grid' && !isListLocked && !isSmartList && activeDisplayItems.length > 1 && (
                  <div className="flex items-center justify-center gap-2 mb-6 text-gray-400 dark:text-gray-500 text-xs animate-fade-in">
                    <Info size={14} />
                    <span>Switch to <strong className="font-medium text-gray-600 dark:text-gray-300">List View</strong> to drag and reorder items</span>
                  </div>
                )}

                {/* Items Grid/List */}
                <div className={viewMode === 'grid' && activeDisplayItems.length > 0
                  ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                  : "space-y-1"
                }>
                  {activeDisplayItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                      <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                        <Film size={40} className="text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">It's quiet here...</h3>
                      <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto mt-1">
                        Start building your collection by searching for movies or adding notes above.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Top Pagination Controls */}
                      {activeDisplayItems.length > ITEMS_PER_PAGE && (
                        <div className={`flex justify-center items-center gap-4 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800 ${viewMode === 'grid' ? "col-span-full w-full" : ""}`}>
                          <button
                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (currentPage > 1) {
                                setCurrentPage(prev => Math.max(prev - 1, 1));
                              }
                            }}
                            disabled={currentPage === 1}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                               ${currentPage === 1
                                ? "text-gray-400 cursor-not-allowed"
                                : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400"
                              }`}
                          >
                            <ChevronLeft size={16} />
                            Prev
                          </button>

                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Page {currentPage} of {Math.ceil(activeDisplayItems.length / ITEMS_PER_PAGE)}
                          </span>

                          <button
                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, Math.ceil(activeDisplayItems.length / ITEMS_PER_PAGE)))}
                            onDragOver={(e) => {
                              e.preventDefault();
                              const maxPage = Math.ceil(activeDisplayItems.length / ITEMS_PER_PAGE);
                              if (currentPage < maxPage) {
                                setCurrentPage(prev => Math.min(prev + 1, maxPage));
                              }
                            }}
                            disabled={currentPage === Math.ceil(activeDisplayItems.length / ITEMS_PER_PAGE)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                               ${currentPage === Math.ceil(activeDisplayItems.length / ITEMS_PER_PAGE)
                                ? "text-gray-400 cursor-not-allowed"
                                : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400"
                              }`}
                          >
                            Next
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      )}

                      {activeDisplayItems
                        .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                        .map((item, index, array) => {
                          const showSeparator = isSmartList && (
                            index === 0 ||
                            (item.originalList && array[index - 1].originalList !== item.originalList)
                          );

                          return (
                            <Fragment key={item.id}>
                              {showSeparator && (
                                <div className={`flex items-center gap-4 my-6 opacity-80 ${viewMode === 'grid' ? "col-span-full w-full" : ""}`}>
                                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
                                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 bg-white/50 dark:bg-gray-800/50 px-3 py-1 rounded-full backdrop-blur-sm border border-gray-100 dark:border-gray-700/50 shadow-sm">
                                    {item.originalList}
                                  </span>
                                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
                                </div>
                              )}
                              {renderItem(item, index + (currentPage - 1) * ITEMS_PER_PAGE, viewMode === 'grid')}
                            </Fragment>
                          );
                        })}

                      {/* Pagination Controls */}
                      {activeDisplayItems.length > ITEMS_PER_PAGE && (
                        <div className={`flex justify-center items-center gap-4 mt-8 pt-4 border-t border-gray-100 dark:border-gray-800 ${viewMode === 'grid' ? "col-span-full w-full" : ""}`}>
                          <button
                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                            onDragOver={(e) => {
                              e.preventDefault();
                              // Simple debounce check could be added if needed, but for now direct switch might be okay
                              // or better, only switch if not already on target page
                              if (currentPage > 1) {
                                setCurrentPage(prev => Math.max(prev - 1, 1));
                              }
                            }}
                            disabled={currentPage === 1}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all
                              ${currentPage === 1
                                ? "text-gray-400 cursor-not-allowed"
                                : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400"
                              }`}
                          >
                            <ChevronLeft size={20} />
                            Previous
                          </button>

                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Page {currentPage} of {Math.ceil(activeDisplayItems.length / ITEMS_PER_PAGE)}
                          </span>

                          <button
                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, Math.ceil(activeDisplayItems.length / ITEMS_PER_PAGE)))}
                            onDragOver={(e) => {
                              e.preventDefault();
                              const maxPage = Math.ceil(activeDisplayItems.length / ITEMS_PER_PAGE);
                              if (currentPage < maxPage) {
                                setCurrentPage(prev => Math.min(prev + 1, maxPage));
                              }
                            }}
                            disabled={currentPage === Math.ceil(activeDisplayItems.length / ITEMS_PER_PAGE)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all
                              ${currentPage === Math.ceil(activeDisplayItems.length / ITEMS_PER_PAGE)
                                ? "text-gray-400 cursor-not-allowed"
                                : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400"
                              }`}
                          >
                            Next
                            <ChevronRight size={20} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-8 bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-gray-700/50 border-dashed">
                <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mb-6 animate-pulse-slow">
                  <Film size={64} className="text-blue-500/50 dark:text-blue-400/50" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                  Ready to Watch?
                </h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                  Select a list from the sidebar or create a new one to start organizing your movies and shows.
                </p>
              </div>
            )}
          </div>
        </div >
      </div >

      {/* Move List Modal */}
      {
        movingList && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-2xl w-96 border border-gray-100 dark:border-gray-700 transform transition-all scale-100">
              <h3 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Folder size={24} className="text-blue-500" />
                Move "{movingList}"
              </h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                <button
                  onClick={() => moveListToFolder(movingList, null)}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                >
                  (Root Level)
                </button>
                {Object.keys(folders).map((folderName) => (
                  <button
                    key={folderName}
                    onClick={() => moveListToFolder(movingList, folderName)}
                    className="w-full text-left px-4 py-3 rounded-xl hover:bg-yellow-50 dark:hover:bg-yellow-900/10 text-gray-700 dark:text-gray-200 flex items-center gap-3 transition-colors border border-transparent hover:border-yellow-200 dark:hover:border-yellow-900/30"
                  >
                    <Folder size={18} className="text-yellow-500" />
                    {folderName}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setMovingList(null)}
                className="mt-6 w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )
      }

      {/* Move Folder Modal */}
      {
        movingFolder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-2xl w-96 border border-gray-100 dark:border-gray-700 transform transition-all scale-100">
              <h3 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Folder size={24} className="text-blue-500" />
                Move "{movingFolder}"
              </h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                <button
                  onClick={() => moveFolderToFolder(movingFolder, null)}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                >
                  (Root Level)
                </button>
                {Object.keys(folders)
                  .filter(target => target !== movingFolder && !isDescendant(movingFolder, target, folders))
                  .map((targetName) => (
                    <button
                      key={targetName}
                      onClick={() => moveFolderToFolder(movingFolder, targetName)}
                      className="w-full text-left px-4 py-3 rounded-xl hover:bg-yellow-50 dark:hover:bg-yellow-900/10 text-gray-700 dark:text-gray-200 flex items-center gap-3 transition-colors border border-transparent hover:border-yellow-200 dark:hover:border-yellow-900/30"
                    >
                      <Folder size={18} className="text-yellow-500" />
                      {targetName}
                    </button>
                  ))}
              </div>
              <button
                onClick={() => setMovingFolder(null)}
                className="mt-6 w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )
      }

      {/* Move Item Modal */}
      {
        itemToMove && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in" onClick={() => setItemToMove(null)}>
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-2xl w-96 border border-gray-100 dark:border-gray-700 transform transition-all scale-100" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <CornerUpRight size={24} className="text-blue-500" />
                Move Item
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 truncate">
                Select a list to move <strong>"{itemToMove.item.text || itemToMove.item.title || itemToMove.item.name}"</strong> to:
              </p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {Object.keys(lists)
                  .filter(listName => listName !== itemToMove.fromList)
                  .map((listName) => (
                    <button
                      key={listName}
                      onClick={() => handleMoveItemConfirm(listName)}
                      className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/10 text-gray-700 dark:text-gray-200 flex items-center gap-3 transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-900/30"
                    >
                      <List size={18} className="text-blue-500" />
                      {listName}
                    </button>
                  ))}
                {Object.keys(lists).filter(listName => listName !== itemToMove.fromList).length === 0 && (
                  <div className="text-center text-gray-400 py-4 italic">No other lists available</div>
                )}
              </div>
              <button
                onClick={() => setItemToMove(null)}
                className="mt-6 w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )
      }

      {/* Share List Modal */}
      {
        showShareModal && selectedList && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in" onClick={() => setShowShareModal(false)}>
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-2xl w-[90vw] max-w-md border border-gray-100 dark:border-gray-700 transform transition-all scale-100" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Share2 size={24} className="text-blue-500" />
                  Share "{selectedList}"
                </h3>
                <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              {sharedLists.find(s => s.listName === selectedList) ? (
                <div className="space-y-4">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800/30">
                    <p className="text-sm text-green-700 dark:text-green-300 font-medium mb-1">
                      ✅ This list is currently shared.
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Anyone with the link can view it (Read-Only).
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Share Link</label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={`${window.location.origin}/share/${sharedLists.find(s => s.listName === selectedList).shareId}`}
                        className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg border-none text-gray-600 dark:text-gray-300 focus:ring-0"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/share/${sharedLists.find(s => s.listName === selectedList).shareId}`);
                          showToast("Link copied!", "success");
                        }}
                        className="px-3 py-2 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={revokeShareLink}
                    className="w-full py-3 mt-4 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-xl font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <LogOut size={18} />
                    Stop Sharing
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Share2 size={32} className="text-blue-500" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Create a public link for <strong>"{selectedList}"</strong> so others can view it.
                  </p>
                  <button
                    onClick={generateShareLink}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    Generate Link
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      }
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        title={confirmationModal.title}
        message={confirmationModal.message}
        onConfirm={confirmationModal.onConfirm}
        onCancel={closeConfirmModal}
        confirmText={confirmationModal.confirmText}
        isDangerous={confirmationModal.isDangerous}
      />

      <div className="fixed top-4 right-4 z-[350] flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4 sm:px-0">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-8 right-8 z-40 p-3 rounded-full shadow-lg transition-all duration-300 transform ${showScrollTop ? "translate-y-0 opacity-100 bg-blue-600 text-white hover:bg-blue-700 hover:scale-110" : "translate-y-10 opacity-0 pointer-events-none"
          }`}
        aria-label="Scroll to top"
      >
        <ArrowUp size={24} />
      </button>

      {/* Item Details Modal */}
      <ItemDetailsModal
        isOpen={!!selectedItemForModal}
        onClose={() => setSelectedItemForModal(null)}
        item={selectedItemForModal}
        onSave={handleUpdateItem}
        onDropSeason={handleDropSeason}
        listName={selectedItemForModal?.originalList || selectedList}
        lists={lists} // Pass all lists for Reference/Link search
        readOnly={isListLocked} // Pass readOnly status
        droppedSeasonNumbers={
          selectedItemForModal && lists[selectedItemForModal.originalList || selectedList]
            ? lists[selectedItemForModal.originalList || selectedList]
              .filter(i =>
                i.media_type === 'tv_season' &&
                i.tmdb_id === selectedItemForModal.id &&
                i.status === 'dropped'
              )
              .map(i => i.season_number)
            : []
        }
      />
      <ScoreSelectionModal
        isOpen={scoreModal.isOpen}
        onClose={() => setScoreModal({ isOpen: false, itemData: null, currentScore: 0 })}
        currentScore={scoreModal.currentScore}
        onConfirm={(newScore) => {
          // Find the item to get its list name
          // Optimization: We could pass listName in, but finding it is okay
          let listName = selectedList;
          // Logic to find correct list if smart list or not
          if (scoreModal.itemData) {
            // If smart list, we need to know the original list, which we can find or was mapped
            // Actually handleUpdateScore needs plain list name.
            // If we are in smart list, item.originalList is set.
            // We need to pass the correct list name.
            // Let's rely on finding it or passing it in setScoreModal?
            // Actually, let's just find it.
            const targetId = scoreModal.itemData;
            let targetList = null;

            for (const [name, items] of Object.entries(lists)) {
              // ... existing loop logic ...
              // Simply using handleUpdateItem wrapper which handles list finding or passing listName directly if we refactor handleUpdateScore
              // For now, simpler: just call handleUpdateItem with updated score on the item object.
              // We need the full item object. 
              // FIX: scoreModal needs to store the whole item or we find it here.
              // Let's assume we find it.
              if (items.some(i => i.id === targetId)) {
                targetList = name;
                const item = items.find(i => i.id === targetId);
                if (item) {
                  handleUpdateItem({ ...item, score: newScore });
                }
                break;
              }
            }
            setScoreModal({ isOpen: false, itemData: null, currentScore: 0 });
          }
        }}
      />
      <WatchOrderViewModal
        isOpen={watchOrderModal.isOpen}
        onClose={() => setWatchOrderModal({ isOpen: false, title: "", watchOrder: [] })}
        title={watchOrderModal.title}
        watchOrder={watchOrderModal.watchOrder}
      />

      <StatisticsOverlay
        isOpen={showStats}
        onClose={() => setShowStats(false)}
        lists={lists}
      />

      <AIRecommendationsOverlay
        isOpen={showRecommendations}
        onClose={() => setShowRecommendations(false)}
        lists={lists}
        userId={user?._id || user?.email}
        token={token}
        showToast={showToast}
        onAddItem={async (listName, itemData) => {
          // Direct add to specified list (bypassing addItem which uses selectedList)
          const currentList = lists[listName] || [];

          // Basic duplicate check (Backup)
          const isDuplicate = currentList.some(
            (item) => item.tmdb_id === itemData.tmdb_id && item.media_type === itemData.media_type
          );
          if (isDuplicate) {
            showToast(`"${itemData.text}" is already in "${listName}".`, "warning");
            return;
          }

          // Create new item with unique ID
          const newItem = {
            id: itemData.tmdb_id,
            text: itemData.text,
            type: "tmdb",
            media_type: itemData.media_type,
            tmdb_id: itemData.tmdb_id,
            year: itemData.year,
            image: itemData.image ? `https://image.tmdb.org/t/p/w92${itemData.image}` : null,
            note: "",
            status: itemData.status || "plan_to_watch",
            runtime: itemData.runtime,
            episode_run_time: itemData.episode_run_time,
            number_of_episodes: itemData.number_of_episodes,
            number_of_seasons: itemData.number_of_seasons
          };

          // AUTO-COMPLETE LOGIC: Fetch episode count for TV shows if not provided
          if (itemData.media_type === 'tv' && newItem.status === 'completed') {
            if (newItem.number_of_episodes) {
              newItem.episodes_watched = newItem.number_of_episodes;
            } else {
              try {
                const apiKey = import.meta.env.VITE_TMDB_API_KEY;
                if (apiKey && itemData.tmdb_id) {
                  const response = await axios.get(`https://api.themoviedb.org/3/tv/${itemData.tmdb_id}?api_key=${apiKey}`);
                  const total = response.data.number_of_episodes || 0;
                  if (total > 0) {
                    newItem.episodes_watched = total;
                    // Backfill details if missing
                    if (!newItem.number_of_episodes) newItem.number_of_episodes = total;
                    if (!newItem.number_of_seasons) newItem.number_of_seasons = response.data.number_of_seasons;
                  }
                }
              } catch (error) {
                console.error("Failed to fetch episode count:", error);
              }
            }
          }

          // Update lists
          const newLists = {
            ...lists,
            [listName]: [...currentList, newItem]
          };
          setLists(newLists);
          saveData(newLists, selectedList, folders);
          showToast(`Added "${itemData.text}" to "${listName}"`, "success");
        }}
      />
      {/* Timer Overlay */}
      {
        showTimerOverlay && (
          <TimerOverlay
            lastCheckDate={lastUpdateCheck}
            onReset={() => {
              const now = Date.now();
              setLastUpdateCheck(now);
              saveData(lists, selectedList, folders, listDescriptions, now);
            }}
            onClose={() => setShowTimerOverlay(false)}
          />
        )
      }

      {
        showWarnings && (
          <WarningsPanel
            lists={lists}
            onClose={() => setShowWarnings(false)}
            onNavigate={(listName, item) => {
              if (isListLocked) {
                showToast("Please unlock the list to view details.", "warning");
                return;
              }
              handleNavigate(listName);
              setSelectedItemForModal(item);
            }}
            isUpdateDue={isUpdateDue}
            onResetUpdateCheck={() => {
              const now = Date.now();
              setLastUpdateCheck(now);
              saveData(lists, selectedList, folders, listDescriptions, now);
            }}
          />
        )
      }

    </div >
  );
};

export default WatchListManager;




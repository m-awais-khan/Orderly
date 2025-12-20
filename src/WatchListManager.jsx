import { useState, useEffect, useRef, useMemo } from "react";
import TmdbSearch from "./TmdbSearch";
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
  Search,
  AlertTriangle,
  Play,      // For Status
  Check,     // For Status
  Clock,     // For Status
  MinusCircle // For Status
} from "lucide-react";
import Toast from "./components/Toast";
import ConfirmationModal from "./components/ConfirmationModal";
import StatusSelectionModal from "./components/StatusSelectionModal";

const WatchListManager = ({ token, onLogout, isRestrictedMobile = false }) => {
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

  // Status Modal State
  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    isEditMode: false,
    itemData: null, // Holds the temp item object when adding, or itemId when editing
  });

  const [lists, setLists] = useState({});

  // Smart Lists Calculation
  const smartLists = useMemo(() => {
    const smart = {
      completed: [],
      watching: [],
      dropped: [],
      plan_to_watch: []
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

  const [sharedLists, setSharedLists] = useState([]); // Array of { listName, shareId }
  const [showShareModal, setShowShareModal] = useState(false); // Toggle for share modal

  const [editingInMainContent, setEditingInMainContent] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar state
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [newTextItem, setNewTextItem] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

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

  useEffect(() => {
    setCurrentPage(1);
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

  const handleNavigate = (targetList) => {
    // Only track history if sidebar is likely hidden (e.g. Shared Mode or Mobile)
    // But logic is safe generally.
    setNavHistory((prev) => [...prev, selectedList]);
    setSelectedList(targetList);
  };

  const handleBack = () => {
    if (navHistory.length === 0) return;
    const prevList = navHistory[navHistory.length - 1];
    setNavHistory((prev) => prev.slice(0, -1));
    setSelectedList(prevList);
  };

  const loadData = async () => {
    try {
      if (!token) return; // verification
      const response = await fetch('/api/data', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      // Migration: If server data is empty, check localStorage
      if (!data || Object.keys(data).length === 0) {
        const localData = localStorage.getItem("watchlists-data");
        if (localData) {
          const parsed = JSON.parse(localData);
          setLists(parsed.lists || {});
          setFolders(parsed.folders || {});
          setSelectedList(parsed.selectedList || null);
          // Sync to server
          saveData(parsed.lists, parsed.selectedList, parsed.folders);
          return;
        }
      }

      setLists(data.lists || {});
      setFolders(data.folders || {});
      setSelectedList(data.selectedList || Object.keys(data.lists || {})[0] || null);
      setSharedLists(data.sharedLists || []); // Load shared lists
      setListOwner(null); // Reset owner since we are viewing own data

      // Update Lock State based on data or default to true?
      // Actually per requirement: Lock lists by default on load?
      // Or persist lock state?
      // Let's keep existing logic if any, or default to Locked for safety.
      // previous code didn't touch isListLocked here explicitly, but let's leave it as is.
      // But we MUST reset listOwner.
    } catch (error) {
      console.error("Failed to load data:", error);
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

  const saveData = async (newLists, newSelected, newFolders) => {
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lists: newLists,
          selectedList: newSelected,
          folders: newFolders,
        }),
      });
    } catch (error) {
      console.error("Failed to save data:", error);
    }
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
      <div className="group/folder mb-2">
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
  const handleStatusConfirm = (status) => {
    const targetListName = statusModal.listName || selectedList;

    if (statusModal.isEditMode) {
      // Logic for editing existing item status
      const itemId = statusModal.itemData;

      if (!lists[targetListName]) return;

      const currentListItems = [...lists[targetListName]];
      const updatedList = currentListItems.map(item =>
        item.id === itemId ? { ...item, status: status } : item
      );

      const newLists = { ...lists, [targetListName]: updatedList };
      setLists(newLists);
      saveData(newLists, targetListName, folders);
      showToast("Status updated.", "success");

    } else {
      // Logic for adding new item with status
      const newItem = { ...statusModal.itemData, status: status };
      const newLists = { ...lists };
      // Double check duplicate race condition? unlikely in user flow
      newLists[selectedList] = [...newLists[selectedList], newItem];
      setLists(newLists);
      saveData(newLists, selectedList, folders);
      showToast(`Added "${newItem.text || newItem.title}" to list.`, "success");

      // Cleanup
      setSearchQuery(""); // Clear search if TMDB
      setNewTextItem(""); // Clear text if Text
    }

    setStatusModal({ isOpen: false, isEditMode: false, itemData: null });
  };

  const addItem = (itemData) => {
    if (isListLocked) return;
    if (!itemData || !itemData.id || !selectedList) return;
    const currentList = lists[selectedList];
    const isDuplicate = currentList.some(
      (item) => item.id === itemData.id && item.type === "tmdb"
    );
    if (isDuplicate) {
      showToast(`"${itemData.title || itemData.name}" is already in the list.`, "warning");
      return; // Stop execution if it's a duplicate
    }
    const newItem = {
      // Use TMDB ID as the item key for uniqueness
      id: itemData.id,
      // Use the title/name provided by TMDB for display
      text: itemData.title || itemData.name,
      type: "tmdb",
      // Store the media type (movie, tv, anime)
      media_type: itemData.media_type,
      year:
        (itemData.release_date || itemData.first_air_date)?.slice(0, 4) || null,
      image: itemData.poster_path
        ? `https://image.tmdb.org/t/p/w92${itemData.poster_path}`
        : "placeholder_url",
      note: "",
      status: 'none' // Default if bypassed, but modal sets it
    };

    // Open Status Modal instead of saving directly
    setStatusModal({
      isOpen: true,
      isEditMode: false,
      itemData: newItem
    });
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

  // --- Effects ---
  /* 
  useEffect(() => {
    if (!token) return;
    // loadData(); // Redundant, handled above
  }, [token]); 
  */

  const addTextItem = () => {
    // 1. Check if list is unlocked and selected
    if (isListLocked) {
      showToast("List is locked. Unlock to add items.", "warning");
      return;
    }

    if (!selectedList) {
      showToast("Please select a list first.", "warning");
      return;
    }

    // 2. Trim and validate input
    const trimmedText = newTextItem.trim();
    if (!trimmedText) {
      showToast("Text cannot be empty.", "warning");
      return;
    }

    // 3. Check for duplicates (case-insensitive)
    const currentList = lists[selectedList] || [];
    const isDuplicate = currentList.some(
      (item) =>
        item.type === "text" &&
        item.text.toLowerCase() === trimmedText.toLowerCase()
    );

    if (isDuplicate) {
      showToast(`"${trimmedText}" is already in the list.`, "warning");
      return;
    }

    // 4. Create new text item
    const newItem = {
      id: Date.now(), // Unique ID based on timestamp
      text: trimmedText,
      type: "text",
      note: "", // Empty note by default
      status: 'none'
    };

    // Open Status Modal instead of saving directly
    setStatusModal({
      isOpen: true,
      isEditMode: false,
      itemData: newItem
    });
  };

  const handleTextInputKeyPress = (e) => {
    if (e.key === "Enter") {
      addTextItem();
    } else if (e.key === "Escape") {
      setNewTextItem("");
    }
  };

  const saveItemNote = (itemId, newNoteText, targetList = selectedList) => {
    if (!lists[targetList]) return; // Guard for invalid lists

    const newLists = { ...lists };
    const listItems = [...newLists[targetList]];

    // Find the item and update its note
    const itemIndex = listItems.findIndex((item) => item.id === itemId);
    if (itemIndex > -1) {
      listItems[itemIndex] = { ...listItems[itemIndex], note: newNoteText };
      newLists[targetList] = listItems;

      setLists(newLists);
      saveData(newLists, targetList, folders);
    }
    setEditingNoteId(null); // Close the input box
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

  const renderItem = (item, index) => {
    // ------------------------------------------------------------------
    // 1. REFERENCE ITEM RENDERING (type: 'reference')
    // ------------------------------------------------------------------
    if (item.type === "reference") {
      const isExpanded = expandedRefs[item.id];
      const refList = lists[item.ref] || [];

      return (
        <div key={item.id} className="mb-3">
          <div
            draggable={!isListLocked}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => toggleRefExpand(item.id)}
            className={`group flex items-center gap-3 p-4 border-l-4 border-purple-500 rounded-xl transition-all duration-200 
              bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm hover:shadow-md
              ${isListLocked ? "cursor-default opacity-90" : "cursor-pointer hover:scale-[1.01]"}`}
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
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
      const isEditingNote = editingNoteId === item.id;

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


          <div className={`flex-1 min-w-0 ${isEditingNote ? "w-full" : ""}`}>


            <span className="flex-1 text-gray-800 dark:text-gray-200 min-w-0">
              <div className="flex items-start">
                <div className="flex-1 min-w-0">
                  <div className="mt-1 font-medium text-lg">{item.text}</div>

                  {/* Display Note */}
                  {item.note && visibleNotes[item.id] && !isEditingNote && (
                    <div className="mt-2 text-sm text-amber-600 dark:text-amber-400 italic break-all whitespace-pre-wrap bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-100 dark:border-amber-800/30 inline-block w-full relative group/note">
                      📝 {item.note}
                      {!isListLocked && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNoteId(item.id);
                          }}
                          className="absolute top-1 right-1 p-1 text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 opacity-0 group-hover/note:opacity-100 transition-opacity"
                          title="Edit Note"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Edit Note Input */}
                  {isEditingNote && (
                    <div
                      className="mt-2 flex items-center gap-1 animate-fade-in"
                      onClick={(e) => e.preventDefault()}
                    >
                      <textarea
                        defaultValue={item.note || ""}
                        autoFocus
                        className="w-full text-sm px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:text-white border-blue-300 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm min-h-[80px]"
                        placeholder="Add a note..."
                        onBlur={(e) => {
                          saveItemNote(item.id, e.target.value, item.originalList || selectedList);
                        }}
                        onClick={(e) => e.preventDefault()}
                      />
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
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {/* Status Icon */}
            {!window.location.pathname.startsWith('/share/') && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isListLocked) return;
                  setStatusModal({
                    isOpen: true,
                    isEditMode: true,
                    itemData: item.id,
                    listName: item.originalList || selectedList
                  });
                }}
                disabled={isListLocked}
                className={`p-2 rounded-full transition-colors ${item.status && item.status !== 'none'
                  ? (() => {
                    switch (item.status) {
                      case 'completed': return "text-green-500 bg-green-50/50 dark:bg-green-900/10 hover:bg-gray-100 dark:hover:bg-gray-600";
                      case 'dropped': return "text-red-500 bg-red-50/50 dark:bg-red-900/10 hover:bg-gray-100 dark:hover:bg-gray-600";
                      case 'watching': return "text-blue-500 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-gray-100 dark:hover:bg-gray-600";
                      case 'plan_to_watch': return "text-purple-500 bg-purple-50/50 dark:bg-purple-900/10 hover:bg-gray-100 dark:hover:bg-gray-600";
                      default: return "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600";
                    }
                  })()
                  : "text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-600"
                  } ${isListLocked ? "cursor-not-allowed opacity-70" : ""}`}
                title={isListLocked ? item.status : "Change Status"}
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
              </button>
            )}

            {(!isListLocked || item.note) && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (item.note) {
                    // Toggle Visibility
                    setVisibleNotes(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                  } else if (!isListLocked) {
                    // Enter Edit Mode (Only if unlocked)
                    setEditingNoteId(item.id);
                    // Allow visibility immediately
                    setVisibleNotes(prev => ({ ...prev, [item.id]: true }));
                  }
                }}
                disabled={isListLocked && !item.note} // Disable if locked and no note
                className={`p-2 rounded-full transition-colors ${item.note
                  ? "text-amber-500 bg-amber-50/50 dark:bg-amber-900/10 hover:bg-gray-100 dark:hover:bg-gray-600"
                  : "text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-600"
                  } ${isListLocked && !item.note ? "opacity-50 cursor-not-allowed" : ""}`}
                title={item.note ? (visibleNotes[item.id] ? "Hide Note" : "Show Note") : "Add Note"}
              >
                <MessageSquare size={18} />
              </button>
            )}

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
          draggable={!isListLocked && !item.originalList}
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          className="group flex items-center gap-3 p-4 mb-3 border border-transparent rounded-xl transition-all duration-200 
            bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm hover:shadow-lg hover:scale-[1.01] hover:border-gray-200 dark:hover:border-gray-700"
        >
          {itemContent}
        </div>
      );
    }

    // ------------------------------------------------------------------
    // 2. TMDB ITEM RENDERING
    // ------------------------------------------------------------------
    const mediaTypePath = item.media_type === "tv" ? "tv" : "movie";
    const tmdbLink = `https://www.themoviedb.org/${mediaTypePath}/${item.id}`;
    const isEditingNote = editingNoteId === item.id;

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
            ${isListLocked ? "opacity-0 w-0 pointer-events-none" : "opacity-100"}`}
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

              {item.note && visibleNotes[item.id] && !isEditingNote && (
                <div className="mt-2 text-sm text-amber-600 dark:text-amber-400 italic break-all whitespace-pre-wrap bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-100 dark:border-amber-800/30 inline-block w-full relative group/note">
                  📝 {item.note}
                  {!isListLocked && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingNoteId(item.id);
                      }}
                      className="absolute top-1 right-1 p-1 text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 opacity-0 group-hover/note:opacity-100 transition-opacity"
                      title="Edit Note"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                </div>
              )}

              {isEditingNote && (
                <div
                  className="mt-2 flex items-center gap-1 animate-fade-in"
                  onClick={(e) => e.preventDefault()}
                >
                  <textarea
                    defaultValue={item.note || ""}
                    autoFocus
                    className="w-full text-sm px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:text-white border-blue-300 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm min-h-[80px]"
                    placeholder="Add a note..."
                    onBlur={(e) => {
                      saveItemNote(item.id, e.target.value, item.originalList || selectedList);
                    }}
                    onClick={(e) => e.preventDefault()}
                  />
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md 
                  ${item.media_type === 'tv'
                    ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                  {item.media_type === 'tv' ? 'TV Show' : 'Movie'}
                </span>
                {item.year && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {item.year}
                  </span>
                )}
                {item.originalList && (
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
        {/* Status Icon */}
        {!window.location.pathname.startsWith('/share/') && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isListLocked) return;
              setStatusModal({
                isOpen: true,
                isEditMode: true,
                itemData: item.id,
                listName: item.originalList || selectedList
              });
            }}
            disabled={isListLocked}
            className={`p-2 rounded-full transition-colors ${item.status && item.status !== 'none'
              ? (() => {
                switch (item.status) {
                  case 'completed': return "text-green-500 bg-green-50/50 dark:bg-green-900/10 hover:bg-gray-100 dark:hover:bg-gray-600";
                  case 'dropped': return "text-red-500 bg-red-50/50 dark:bg-red-900/10 hover:bg-gray-100 dark:hover:bg-gray-600";
                  case 'watching': return "text-blue-500 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-gray-100 dark:hover:bg-gray-600";
                  case 'plan_to_watch': return "text-purple-500 bg-purple-50/50 dark:bg-purple-900/10 hover:bg-gray-100 dark:hover:bg-gray-600";
                  default: return "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600";
                }
              })()
              : "text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-600"
              } ${isListLocked ? "cursor-not-allowed opacity-70" : ""}`}
            title={isListLocked ? item.status : "Change Status"}
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
          </button>
        )}

        {(!isListLocked || item.note) && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (item.note) {
                setVisibleNotes(prev => ({ ...prev, [item.id]: !prev[item.id] }));
              } else if (!isListLocked) {
                setEditingNoteId(item.id);
                setVisibleNotes(prev => ({ ...prev, [item.id]: true }));
              }
            }}
            disabled={isListLocked && !item.note} // Disable if locked and no note
            className={`p-2 rounded-full transition-colors ${item.note
              ? "text-amber-500 bg-amber-50/50 dark:bg-amber-900/10 hover:bg-gray-100 dark:hover:bg-gray-600"
              : "text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-600"
              } ${isListLocked && !item.note ? "opacity-50 cursor-not-allowed" : ""}`}
            title={item.note ? (visibleNotes[item.id] ? "Hide Note" : "Show Note") : "Add Note"}
          >
            <MessageSquare size={18} />
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
          className="group flex items-center gap-3 p-4 mb-3 border border-transparent rounded-xl transition-all duration-200 
            bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm opacity-90 cursor-default"
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
          className="group flex items-center gap-3 p-4 mb-3 border border-transparent rounded-xl transition-all duration-200 
            bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm hover:shadow-xl hover:scale-[1.02] hover:border-blue-200 dark:hover:border-blue-800/30 no-underline cursor-default"
        >
          {/* Clickable Content Area */}
          <div
            className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer"
            onClick={(e) => {
              if (!e.defaultPrevented) {
                window.open(tmdbLink, '_blank', 'noopener,noreferrer');
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
            <button
              onClick={toggleDarkMode}
              className="p-2.5 rounded-xl transition-all duration-300 hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:shadow-md hover:scale-105 active:scale-95"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-blue-600" />}
            </button>

            {token && (
              <>
                <button
                  onClick={deleteAccount}
                  className="p-2.5 rounded-xl transition-all duration-300 hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-500 hover:shadow-md hover:scale-105 active:scale-95 bg-red-50/50 dark:bg-red-900/10"
                  title="Delete Account"
                >
                  <Trash2 size={20} />
                </button>

                <button
                  onClick={onLogout}
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
                  onClick={() => document.getElementById("import-file").click()}
                  className="p-2.5 rounded-xl transition-all duration-300 hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 hover:shadow-md hover:scale-105 active:scale-95"
                  title="Import Data"
                >
                  <Upload size={20} />
                </button>
              </>
            )}
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
            bg-gray-50 dark:bg-gray-900 lg:bg-transparent
            p-4 lg:p-0 overflow-y-auto lg:overflow-visible shadow-2xl lg:shadow-none
          `}>
              <div className="bg-white/70 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl p-4 lg:p-6 border border-white/20 dark:border-gray-700/50 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold font-heading text-gray-800 dark:text-gray-100 flex items-center justify-between w-full">
                    <span>Collections</span>
                    <button
                      onClick={() => setIsSidebarOpen(false)}
                      className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
                    >
                      <X size={20} />
                    </button>
                  </h2>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => !isRestrictedMobile && setIsListLocked(!isListLocked)}
                      disabled={isRestrictedMobile}
                      className={`p-2 rounded-xl transition-all duration-300 ${isListLocked
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
                  {/* 1. Smart Status Lists */}
                  {Object.entries(smartLists).map(([key, items]) => {
                    if (items.length === 0) return null;
                    const config = {
                      completed: { color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', icon: Check, label: "Completed" },
                      watching: { color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: Play, label: "Watching" },
                      dropped: { color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', icon: X, label: "Dropped" },
                      plan_to_watch: { color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', icon: Clock, label: "Plan to Watch" }
                    }[key];

                    if (!config) return null;
                    const Icon = config.icon;
                    const isSelected = selectedList === `special:${key}`;

                    return (
                      <div
                        key={`smart-${key}`}
                        onClick={() => setSelectedList(`special:${key}`)}
                        className={`group flex justify-between items-center px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 border border-transparent mb-1
                        ${isSelected
                            ? `bg-white dark:bg-gray-800 shadow-md border-${config.color.split('-')[1]}-200 dark:border-${config.color.split('-')[1]}-800 ring-1 ring-${config.color.split('-')[1]}-500`
                            : "bg-white dark:bg-gray-800/50 hover:bg-white hover:shadow-md dark:hover:bg-gray-800"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg ${config.bg} ${config.color}`}>
                            <Icon size={16} />
                          </div>
                          <span className={`font-medium ${isSelected ? config.color : 'text-gray-700 dark:text-gray-300'}`}>
                            {config.label}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                          {items.length}
                        </span>
                      </div>
                    );
                  })}

                  {/* 2. Render Folders */}
                  {Object.keys(folders)
                    .filter(folderName => !Object.values(folders).some(items => items.includes(`folder:${folderName}`)))
                    .map((folderName) => (
                      <RecursiveFolder key={folderName} folderName={folderName} />
                    ))}

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
                                handleNavigate(item.listName);
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
                            plan_to_watch: { color: 'text-purple-500', icon: Clock, label: "Plan to Watch" }
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
                                </>
                              )}
                            </>
                          );
                        })()
                      )}

                      <span className="text-sm font-normal px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                        {activeDisplayItems.length} items
                      </span>
                    </h2>

                    {!isSmartList && (
                      <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 flex items-center gap-2">
                        {listOwner && (
                          <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md font-medium">
                            <Share2 size={12} />
                            Shared by {listOwner}
                          </span>
                        )}
                        {!listOwner && "Manage and track your items in this list"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Add Item Area (Only for Normal Lists) */}
                {!isSmartList && (
                  <div className="mb-8 bg-white/50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                    <TmdbSearch
                      onItemSelected={addItem}
                      disabled={isListLocked}
                    />

                    <div className="flex flex-col md:flex-row gap-4 mt-4">
                      {/* Add Text Item */}
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={newTextItem}
                          onChange={(e) => setNewTextItem(e.target.value)}
                          onKeyDown={handleTextInputKeyPress}
                          placeholder="Add a text note..."
                          className="flex-1 px-4 py-2.5 rounded-xl border-none bg-white dark:bg-gray-700 shadow-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-sm transition-all"
                          disabled={isListLocked}
                        />
                        <button
                          onClick={addTextItem}
                          disabled={isListLocked}
                          className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-lg ${!isListLocked
                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none dark:bg-gray-700 dark:text-gray-500"
                            }`}
                        >
                          Add Text
                        </button>
                      </div>

                      {/* Add Reference */}
                      <div className="flex items-center gap-3 bg-white dark:bg-gray-700 px-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          Link List:
                        </span>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              addReference(e.target.value);
                              e.target.value = "";
                            }
                          }}
                          className="py-2 bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none cursor-pointer [&>option]:bg-white [&>option]:text-gray-900 dark:[&>option]:bg-gray-800 dark:[&>option]:text-gray-100"
                          disabled={isListLocked}
                        >
                          <option value="">Select...</option>
                          {Object.keys(lists)
                            .filter((name) => name !== selectedList)
                            .map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Items Grid/List */}
                <div className="space-y-1">
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
                        <div className="flex justify-center items-center gap-4 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
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
                            <div key={item.id}>
                              {showSeparator && (
                                <div className="flex items-center gap-4 my-6 opacity-80">
                                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
                                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 bg-white/50 dark:bg-gray-800/50 px-3 py-1 rounded-full backdrop-blur-sm border border-gray-100 dark:border-gray-700/50 shadow-sm">
                                    {item.originalList}
                                  </span>
                                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
                                </div>
                              )}
                              {renderItem(item, index + (currentPage - 1) * ITEMS_PER_PAGE)}
                            </div>
                          );
                        })}

                      {/* Pagination Controls */}
                      {activeDisplayItems.length > ITEMS_PER_PAGE && (
                        <div className="flex justify-center items-center gap-4 mt-8 pt-4 border-t border-gray-100 dark:border-gray-800">
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
        </div>
      </div>

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

      <div className="fixed top-4 right-4 z-[110] flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4 sm:px-0">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
      <StatusSelectionModal
        isOpen={statusModal.isOpen}
        onClose={() => setStatusModal({ isOpen: false, isEditMode: false, itemData: null })}
        onConfirm={handleStatusConfirm}
        currentStatus={statusModal.isEditMode ? lists[selectedList]?.find(item => item.id === statusModal.itemData)?.status : 'none'}
        isEditMode={statusModal.isEditMode}
      />
    </div >
  );
};

export default WatchListManager;

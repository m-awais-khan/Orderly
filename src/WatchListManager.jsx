import { useState, useEffect, useRef } from "react";
import TmdbSearch from "./TmdbSearch";
import {
  Trash2,
  Plus,
  GripVertical,
  Link,
  ChevronDown,
  ChevronRight,
  Film,
  Moon,
  Sun,
  Edit2,
  X,
} from "lucide-react";

const WatchListManager = () => {
  const [lists, setLists] = useState({});
  const [selectedList, setSelectedList] = useState(null);
  const [newListName, setNewListName] = useState("");
  const [draggedItem, setDraggedItem] = useState(null);
  const [expandedRefs, setExpandedRefs] = useState({});
  const [showAddList, setShowAddList] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isListLocked, setIsListLocked] = useState(true);
  const [editingListName, setEditingListName] = useState(null);
  const dragActiveRef = useRef(false);

  useEffect(() => {
    loadData();
    loadDarkMode();
  }, []);

  const loadData = () => {
    try {
      const saveData = localStorage.getItem("watchlists-data");
      if (saveData) {
        const data = JSON.parse(saveData);
        setLists(data.lists || {});
        setSelectedList(data.selectedList || null);
      }
    } catch (error) {
      console.log("No saved data found");
    }
  };

  const loadDarkMode = () => {
    try {
      const savedData = localStorage.getItem("watchlists-darkmode");
      if (savedData) {
        setDarkMode(JSON.parse(savedData));
      }
    } catch (error) {
      console.log("No dark mode preference found");
    }
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);

    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    try {
      localStorage.setItem("watchlists-darkmode", JSON.stringify(newMode));
    } catch (error) {
      console.error("Failed to save dark mode preference:", error);
    }
  };

  const saveData = (newLists, newSelected) => {
    try {
      localStorage.setItem(
        "watchlists-data",
        JSON.stringify({ lists: newLists, selectedList: newSelected })
      );
    } catch (error) {
      console.error("Failed to save data:", error);
    }
  };

  const createList = () => {
    // 1. Basic validation (Ensure list is unlocked and name is not empty)
    if (isListLocked) return;
    const trimmedName = newListName.trim();

    if (!trimmedName) {
      alert("List name cannot be empty.");
      return;
    }

    // 2. Case-Insensitive Duplicate Check
    const lowerTrimmedName = trimmedName.toLowerCase();
    const isDuplicate = Object.keys(lists).some(
      (listName) => listName.toLowerCase() === lowerTrimmedName
    );

    if (isDuplicate) {
      alert(`A list named "${trimmedName}" already exists (case-insensitive).`);
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
    saveData(newLists, trimmedName);
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
      alert(
        `A list named "${trimmedNewName}" already exists (case-insensitive). Cannot rename.`
      );
      return;
    }

    // 3. Update the lists object (rename the key while preserving items)
    const newLists = {};
    Object.keys(lists).forEach((listName) => {
      if (listName === oldName) {
        // Use the new name (with user's casing) as the key
        newLists[trimmedNewName] = lists[oldName];
      } else {
        newLists[listName] = lists[listName];
      }
    });

    // 4. Update state and persistence
    setLists(newLists);
    setSelectedList(trimmedNewName); // Keep the newly named list selected
    setEditingListName(null); // Exit editing mode
    saveData(newLists, trimmedNewName);
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
    setLists(newLists);
    setSelectedList(newSelected);
    saveData(newLists, newSelected);
  };

  const addItem = (itemData) => {
    if (isListLocked) return;
    if (!itemData || !itemData.id || !selectedList) return;
    const currentList = lists[selectedList];
    const isDuplicate = currentList.some(
      (item) => item.id === itemData.id && item.type === "tmdb"
    );
    if (isDuplicate) {
      alert(`"${itemData.title || itemData.name}" is already in the list.`);
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
    };

    const newLists = { ...lists };
    newLists[selectedList] = [...newLists[selectedList], newItem];
    setLists(newLists);
    saveData(newLists, selectedList);
  };

  const addReference = (refListName) => {
    if (isListLocked || !refListName) return;
    if (!selectedList || refListName === selectedList) return;
    const currentListItems = lists[selectedList] || [];
    const isDuplicate = currentListItems.some(item => 
        item.type === 'reference' && item.ref === refListName
    );

    if (isDuplicate) {
        alert(`The list "${refListName}" is already included as a reference in "${selectedList}".`);
        return;
    }
    const newLists = { ...lists };
    newLists[selectedList] = [
      ...newLists[selectedList],
      { id: Date.now(), ref: refListName, type: "reference" },
    ];
    setLists(newLists);
    saveData(newLists, selectedList);
  };

  const deleteItem = (itemId) => {
    if (isListLocked) return;
    const newLists = { ...lists };
    newLists[selectedList] = newLists[selectedList].filter(
      (item) => item.id !== itemId
    );
    setLists(newLists);
    saveData(newLists, selectedList);
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
    saveData(lists, selectedList);
    dragActiveRef.current = false;
  };
  const toggleRefExpand = (itemId) => {
    setExpandedRefs((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const renderItem = (item, index) => {
    // ------------------------------------------------------------------
    // 1. REFERENCE ITEM RENDERING (type: 'reference')
    // ------------------------------------------------------------------
    if (item.type === "reference") {
      const isExpanded = expandedRefs[item.id];
      const refList = lists[item.ref] || [];

      return (
        <div key={item.id} className="mb-2">
          <div
            draggable={!isListLocked} // Keeps drag properties present
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-2 p-3 border-l-4 border-purple-500 rounded transition-colors bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/40 ${
              isListLocked ? "cursor-default opacity-80" : "cursor-default"
            }`}
          >
            <GripVertical
              size={20}
              onMouseDown={() => {
                dragActiveRef.current = true;
              }}
              onMouseUp={() => {
                dragActiveRef.current = false;
              }}
              className={`text-gray-400 dark:text-gray-500 ${
                isListLocked
                  ? "opacity-40 cursor-default"
                  : "opacity-100 cursor-move hover:text-blue-500 dark:hover:text-blue-400"
              }`}
            />
            <button
              onClick={() => toggleRefExpand(item.id)}
              className="text-purple-600 hover:text-purple-800"
            >
              {isExpanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
            <Link size={16} className="text-purple-600" />
            <span className="flex-1 font-medium text-purple-900 dark:text-purple-300">
              {item.ref} ({refList.length} items)
            </span>
            {/* Delete Button (Hidden if locked) */}
            {!isListLocked && (
              <button
                onClick={() => {
                  if (window.confirm(`Delete reference to "${item.ref}"?`)) {
                    deleteItem(item.id);
                  }
                }}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>

          {/* Expanded Reference Content */}
          {isExpanded && (
            <div className="ml-8 mt-2 p-3 border-l-2 border-purple-300 rounded bg-purple-25 dark:bg-purple-900/20">
              {refList.length === 0 ? (
                <p className="italic text-gray-500 dark:text-gray-400">
                  Empty list
                </p>
              ) : (
                refList.map((refItem) => (
                  <div
                    key={refItem.id}
                    className="mb-1 p-2 rounded text-sm bg-white text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                  >
                    {/* Since we removed legacy 'text' items, we assume nested items are TMDB or References */}
                    {refItem.type === "tmdb"
                      ? refItem.text
                      : `→ ${refItem.ref}`}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      );
    }

    // ------------------------------------------------------------------
    // 2. TMDB ITEM RENDERING (Default/Only Non-Reference Type)
    // ------------------------------------------------------------------
    const mediaTypePath = item.media_type === "tv" ? "tv" : "movie";
    const tmdbLink = `https://www.themoviedb.org/${mediaTypePath}/${item.id}`;

    const itemContent = (
      <>
        {/* Grip Icon (Only visible/active if unlocked) */}
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
          className={`text-gray-400 dark:text-gray-500 ${
            isListLocked
              ? "opacity-40 cursor-default"
              : "opacity-100 cursor-move hover:text-blue-500 dark:hover:text-blue-400" // 🛑 NEW: Cursor change on hover
          }`}
        />

        {/* Display Item Text & Type Label */}
        <span className="flex-1 text-gray-800 dark:text-gray-200">
          {item.text}

          {/* Display TMDB label and media type */}
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400">
            {item.media_type || "movie"}
          </span>
        </span>

        {/* Delete Button (Only visible if unlocked) */}
        {!isListLocked && (
          <button
            // Use onMouseDown to prevent the <a> click from triggering when deleting
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault(); // Stop the <a> tag from navigating
              if (
                window.confirm(
                  `Delete item: "${item.text.substring(0, 30)}${
                    item.text.length > 30 ? "..." : ""
                  }?"`
                )
              ) {
                deleteItem(item.id);
              }
            }}
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 size={20} />
          </button>
        )}
      </>
    );

    if (isListLocked) {
      return (
        <div
          key={item.id}
          className="flex items-center gap-2 p-3 border rounded transition-colors bg-white border-gray-200 cursor-default opacity-80 dark:bg-gray-700 dark:border-gray-600"
        >
          {itemContent}
        </div>
      );
    } else {
      return (
        <a
          key={item.id}
          href={tmdbLink}
          target="_blank"
          rel="noopener noreferrer"
          draggable={true} // Keeps drag properties present
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          className="flex items-center gap-2 p-3 border rounded transition-colors no-underline cursor-pointer hover:border-blue-500 bg-white border-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:hover:border-blue-500"
        >
          {itemContent}
        </a>
      );
    }
  };

  return (
    <div
      className={`${
        darkMode ? "dark" : ""
      } min-h-screen p-6 flex justify-center items-start bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800`}
    >
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Film size={40} className="text-blue-600 dark:text-blue-400" />
            <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">
              Watch List Manager
            </h1>
            <button
              onClick={toggleDarkMode}
              className="ml-4 p-2 rounded-lg transition-colors bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-yellow-400 dark:hover:bg-gray-600"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun size={24} /> : <Moon size={24} />}
            </button>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Organize your movies, shows, and watch history
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Lists Sidebar */}
          <div className="md:col-span-1">
            <div className="rounded-lg shadow-lg p-4 bg-white dark:bg-gray-800">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  My Lists
                </h2>

                <button
                  onClick={() => setIsListLocked(!isListLocked)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors font-medium ${
                    isListLocked
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-green-500 text-white hover:bg-green-600"
                  }`}
                  title={
                    isListLocked
                      ? "Unlock all list actions (add, delete, reorder)"
                      : "Lock all list actions to prevent accidental changes"
                  }
                >
                  {isListLocked ? "Lists Locked 🔒" : "Lists Unlocked 🔓"}
                </button>

                <button
                  onClick={() => setShowAddList(!showAddList)}
                  className={`p-2 rounded-full transition-colors ${
                    isListLocked
                      ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                  disabled={isListLocked}
                >
                  <Plus size={20} />
                </button>
              </div>

              {showAddList && (
                <div className="mb-4 flex gap-2">
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && createList()}
                    placeholder="New list name..."
                    className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:placeholder-gray-400"
                  />
                  <button
                    onClick={createList}
                    className={`px-4 py-2 rounded transition-colors ${
                      !isListLocked
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-gray-400 text-gray-200 cursor-not-allowed"
                    }`}
                  >
                    Add
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {Object.keys(lists).length === 0 ? (
                  <p className="text-center py-8 italic text-gray-500 dark:text-gray-400">
                    No lists yet. Create one!
                  </p>
                ) : (
                  Object.keys(lists).map((listName) => (
                    <div
                      key={listName}
                      onClick={() => {
                        // Only allow selection if we are NOT currently editing a list
                        if (editingListName !== listName) {
                          setSelectedList(listName);
                        }
                      }}
                      className={`flex justify-between items-center px-4 py-3 rounded-lg cursor-pointer transition-colors ${
                        selectedList === listName
                          ? "bg-blue-600 text-white dark:bg-blue-800"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {/* 🛑 CONDITIONAL RENDERING: Editing Mode vs. Read-Only Mode */}
                      {editingListName === listName ? (
                        // --- EDITING INPUT FIELD ---
                        <>
                          <input
                            type="text"
                            defaultValue={listName}
                            className="flex-1 mr-2 px-1 py-0.5 border rounded text-sm text-black dark:text-white dark:bg-gray-600 focus:outline-none"
                            autoFocus
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                // Save on Enter
                                renameList(listName, e.target.value);
                              }
                            }}
                            onBlur={(e) => {
                              // Save on blur (clicking away)
                              renameList(listName, e.target.value);
                            }}
                          />
                          {/* 🛑 NEW CANCEL BUTTON */}
                          <button
                            // Use onMouseDown to prevent the input's onBlur event from firing first
                            onMouseDown={(e) => {
                              e.preventDefault(); // Stop onBlur
                              setEditingListName(null); // Cancel and exit editing mode
                            }}
                            className="ml-2 text-sm text-gray-300 hover:text-red-400 dark:text-gray-400 dark:hover:text-red-500"
                            title="Cancel Renaming"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        // --- READ-ONLY DISPLAY & ACTIONS ---
                        <>
                          <div className="flex items-center flex-1">
                            <span className="font-medium mr-2">{listName}</span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                selectedList === listName
                                  ? "bg-blue-400 text-white"
                                  : "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300"
                              }`}
                            >
                              ({lists[listName].length})
                            </span>
                          </div>

                          {/* 🛑 EDIT BUTTON (Only visible if NOT locked) */}
                          {!isListLocked && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Stop click from selecting/renaming listName
                                setEditingListName(listName);
                              }}
                              className={`ml-2 text-sm ${
                                selectedList === listName
                                  ? "text-white hover:text-gray-200"
                                  : "text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                              }`}
                              title="Rename List"
                            >
                              <Edit2 size={20} />
                            </button>
                          )}

                          {/* Existing Delete Button (Only visible if not locked) */}
                          {!isListLocked && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete "${listName}"?`))
                                  deleteList(listName);
                              }}
                              className="text-red-500 hover:text-red-700 ml-2"
                            >
                              <Trash2 size={20} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="md:col-span-2">
            {selectedList ? (
              <div className="rounded-lg shadow-lg p-6 bg-white dark:bg-gray-800">
                <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">
                  {selectedList}
                  {selectedList && (
                    <span className="ml-3 text-lg font-normal text-gray-500 dark:text-gray-400">
                      ({(lists[selectedList] || []).length})
                    </span>
                  )}
                </h2>

                {/* Add Item */}
                <div className="mb-6">
                  <TmdbSearch
                    onItemSelected={addItem}
                    disabled={isListLocked}
                  />

                  {/* Add Reference */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Add reference:
                    </span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          addReference(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      className="px-3 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      disabled={isListLocked}
                    >
                      <option value="">Select a list...</option>
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

                {/* Items */}
                <div className="space-y-2">
                  {lists[selectedList].length === 0 ? (
                    <div className="text-center py-12">
                      <p className="italic text-gray-500 dark:text-gray-400">
                        No items yet. Add some!
                      </p>
                    </div>
                  ) : (
                    lists[selectedList].map((item, index) =>
                      renderItem(item, index)
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg shadow-lg p-12 text-center bg-white dark:bg-gray-800">
                <Film
                  size={64}
                  className="mx-auto mb-4 text-gray-300 dark:text-gray-600"
                />
                <p className="text-lg text-gray-500 dark:text-gray-400">
                  Select a list or create a new one to get started
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatchListManager;

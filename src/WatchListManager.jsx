import React, { useState, useEffect } from 'react';
import { Trash2, Edit2, Plus, GripVertical, Link, Save, X, ChevronDown, ChevronRight, Film, Moon, Sun } from 'lucide-react';

const WatchListManager = () => {
  const [lists, setLists] = useState({});
  const [selectedList, setSelectedList] = useState(null);
  const [newListName, setNewListName] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [newItemText, setNewItemText] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);
  const [expandedRefs, setExpandedRefs] = useState({});
  const [showAddList, setShowAddList] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    loadData();
    loadDarkMode();
  }, []);

  const loadData = async () => {
    try {
      const result = await window.storage.get('watchlists-data');
      if (result && result.value) {
        const data = JSON.parse(result.value);
        setLists(data.lists || {});
        setSelectedList(data.selectedList || null);
      }
    } catch {
      console.log('No saved data found');
    }
  };

  const loadDarkMode = async () => {
    try {
      const result = await window.storage.get('watchlists-darkmode');
      if (result && result.value) setDarkMode(JSON.parse(result.value));
    } catch {
      console.log('No dark mode preference found');
    }
  };

  const toggleDarkMode = async () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    try {
      await window.storage.set('watchlists-darkmode', JSON.stringify(newMode));
    } catch (error) {
      console.error('Failed to save dark mode preference:', error);
    }
  };

  const saveData = async (newLists, newSelected) => {
    try {
      await window.storage.set('watchlists-data', JSON.stringify({ lists: newLists, selectedList: newSelected }));
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  };

  const createList = () => {
    if (!newListName.trim()) return;
    const newLists = { ...lists, [newListName]: [] };
    setLists(newLists);
    setSelectedList(newListName);
    setNewListName('');
    setShowAddList(false);
    saveData(newLists, newListName);
  };

  const deleteList = (listName) => {
    const newLists = { ...lists };
    delete newLists[listName];
    const newSelected = selectedList === listName ? Object.keys(newLists)[0] || null : selectedList;
    setLists(newLists);
    setSelectedList(newSelected);
    saveData(newLists, newSelected);
  };

  const addItem = () => {
    if (!newItemText.trim() || !selectedList) return;
    const newLists = { ...lists };
    newLists[selectedList] = [...newLists[selectedList], { id: Date.now(), text: newItemText, type: 'text' }];
    setLists(newLists);
    setNewItemText('');
    saveData(newLists, selectedList);
  };

  const addReference = (refListName) => {
    if (!selectedList || refListName === selectedList) return;
    const newLists = { ...lists };
    newLists[selectedList] = [...newLists[selectedList], { id: Date.now(), ref: refListName, type: 'reference' }];
    setLists(newLists);
    saveData(newLists, selectedList);
  };

  const updateItem = (itemId, newText) => {
    const newLists = { ...lists };
    const itemIndex = newLists[selectedList].findIndex(item => item.id === itemId);
    if (itemIndex !== -1) {
      newLists[selectedList][itemIndex].text = newText;
      setLists(newLists);
      setEditingItem(null);
      saveData(newLists, selectedList);
    }
  };

  const deleteItem = (itemId) => {
    const newLists = { ...lists };
    newLists[selectedList] = newLists[selectedList].filter(item => item.id !== itemId);
    setLists(newLists);
    saveData(newLists, selectedList);
  };

  const handleDragStart = (e, index) => { setDraggedItem(index); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e, index) => {
    e.preventDefault();
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
  const handleDragEnd = () => { setDraggedItem(null); saveData(lists, selectedList); };
  const toggleRefExpand = (itemId) => { setExpandedRefs(prev => ({ ...prev, [itemId]: !prev[itemId] })); };

  const renderItem = (item, index) => {
    if (item.type === 'reference') {
      const isExpanded = expandedRefs[item.id];
      const refList = lists[item.ref] || [];

      return (
        <div key={item.id} className="mb-2">
          <div
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-2 p-3 border-l-4 border-purple-500 rounded cursor-move transition-colors bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/40`}
          >
            <GripVertical size={16} className="text-gray-400 dark:text-gray-500" />
            <button onClick={() => toggleRefExpand(item.id)} className="text-purple-600 hover:text-purple-800">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <Link size={16} className="text-purple-600" />
            <span className="flex-1 font-medium text-purple-900 dark:text-purple-300">
              Reference: {item.ref} ({refList.length} items)
            </span>
            <button onClick={() => deleteItem(item.id)} className="text-red-500 hover:text-red-700">
              <Trash2 size={16} />
            </button>
          </div>

          {isExpanded && (
            <div className="ml-8 mt-2 p-3 border-l-2 border-purple-300 rounded bg-purple-25 dark:bg-purple-900/20">
              {refList.length === 0 ? (
                <p className="italic text-gray-500 dark:text-gray-400">Empty list</p>
              ) : (
                refList.map((refItem) => (
                  <div key={refItem.id} className="mb-1 p-2 rounded text-sm bg-white text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                    {refItem.type === 'text' ? refItem.text : `→ ${refItem.ref}`}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={item.id}
        draggable
        onDragStart={(e) => handleDragStart(e, index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragEnd={handleDragEnd}
        className="flex items-center gap-2 p-3 border rounded cursor-move transition-colors bg-white border-gray-200 hover:border-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:hover:border-blue-500"
      >
        <GripVertical size={16} className="text-gray-400 dark:text-gray-500" />
        {editingItem === item.id ? (
          <>
            <input
              type="text"
              defaultValue={item.text}
              onKeyPress={(e) => { if (e.key === 'Enter') updateItem(item.id, e.target.value); }}
              className="flex-1 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 text-gray-900 dark:bg-gray-600 dark:text-white dark:border-blue-500"
              autoFocus
            />
            <button onClick={() => { const input = document.querySelector('input[type="text"]'); updateItem(item.id, input.value); }} className="text-green-600 hover:text-green-800">
              <Save size={16} />
            </button>
            <button onClick={() => setEditingItem(null)} className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-gray-800 dark:text-gray-200">{item.text}</span>
            <button onClick={() => setEditingItem(item.id)} className="text-blue-600 hover:text-blue-800">
              <Edit2 size={16} />
            </button>
            <button onClick={() => deleteItem(item.id)} className="text-red-500 hover:text-red-700">
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`${darkMode ? 'dark' : ''} min-h-screen p-6 flex justify-center items-start bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800`}>
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Film size={40} className="text-blue-600 dark:text-blue-400" />
            <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">Watch List Manager</h1>
            <button
              onClick={toggleDarkMode}
              className="ml-4 p-2 rounded-lg transition-colors bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-yellow-400 dark:hover:bg-gray-600"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun size={24} /> : <Moon size={24} />}
            </button>
          </div>
          <p className="text-gray-600 dark:text-gray-400">Organize your movies, shows, and watch history</p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Lists Sidebar */}
          <div className="md:col-span-1">
            <div className="rounded-lg shadow-lg p-4 bg-white dark:bg-gray-800">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">My Lists</h2>
                <button onClick={() => setShowAddList(!showAddList)} className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors">
                  <Plus size={20} />
                </button>
              </div>

              {showAddList && (
                <div className="mb-4 flex gap-2">
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && createList()}
                    placeholder="New list name..."
                    className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:placeholder-gray-400"
                  />
                  <button onClick={createList} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors">Add</button>
                </div>
              )}

              <div className="space-y-2">
                {Object.keys(lists).length === 0 ? (
                  <p className="text-center py-8 italic text-gray-500 dark:text-gray-400">No lists yet. Create one!</p>
                ) : (
                  Object.keys(lists).map((listName) => (
                    <div
                      key={listName}
                      onClick={() => setSelectedList(listName)}
                      className={`flex items-center justify-between p-3 rounded cursor-pointer transition-colors border-2 ${
                        selectedList === listName
                          ? 'bg-blue-100 border-blue-500 dark:bg-blue-900/40'
                          : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 dark:border-transparent'
                      }`}
                    >
                      <span className="font-medium flex-1 text-gray-800 dark:text-gray-200">{listName}</span>
                      <span className="text-xs mr-2 text-gray-500 dark:text-gray-400">({lists[listName].length})</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete "${listName}"?`)) deleteList(listName); }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
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
                <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">{selectedList}</h2>

                {/* Add Item */}
                <div className="mb-6">
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newItemText}
                      onChange={(e) => setNewItemText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addItem()}
                      placeholder="Add new item..."
                      className="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:placeholder-gray-400"
                    />
                    <button
                      onClick={addItem}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium dark:bg-blue-800 dark:hover:bg-blue-900"
                    >
                      Add Item
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Add reference:</span>
                    <select
                      onChange={(e) => { if (e.target.value) { addReference(e.target.value); e.target.value = ''; } }}
                      className="px-3 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    >
                      <option value="">Select a list...</option>
                      {Object.keys(lists).filter((name) => name !== selectedList).map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  {lists[selectedList].length === 0 ? (
                    <div className="text-center py-12">
                      <p className="italic text-gray-500 dark:text-gray-400">No items yet. Add some!</p>
                    </div>
                  ) : (
                    lists[selectedList].map((item, index) => renderItem(item, index))
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg shadow-lg p-12 text-center bg-white dark:bg-gray-800">
                <Film size={64} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-lg text-gray-500 dark:text-gray-400">Select a list or create a new one to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatchListManager;

console.log('Popup script loaded');

let currentRenameBase = null;
let currentRenameType = null;
let currentFiles = null;
let currentTab = 'tracker';
let watchedFolders = [];
let nativeHostStatus = 'checking';

// Check if browser API is available
if (typeof browser === 'undefined') {
  window.browser = chrome;
  console.log('Using chrome API');
} else {
  console.log('Using browser API');
}

function displayFiles(files) {
  currentFiles = files;
  const funscriptList = document.getElementById('funscript-list');
  const videoList = document.getElementById('video-list');
  
  // Clear existing content
  funscriptList.innerHTML = '';
  videoList.innerHTML = '';
  
  // Update counts
  document.getElementById('unmatched-count').textContent = 
    files.funscripts.length + files.videos.length;
  
  // Display funscript files
  if (files.funscripts.length === 0) {
    funscriptList.innerHTML = '<div class="empty-message">No unmatched funscript files</div>';
  } else {
    files.funscripts.forEach(file => {
      const fileItem = createFileItem(file, 'funscript');
      funscriptList.appendChild(fileItem);
    });
  }
  
  // Display video files
  if (files.videos.length === 0) {
    videoList.innerHTML = '<div class="empty-message">No unmatched video files</div>';
  } else {
    files.videos.forEach(file => {
      const fileItem = createFileItem(file, 'video');
      videoList.appendChild(fileItem);
    });
  }
  
  // Highlight potential matches
  highlightPotentialMatches(files);
}

function createFileItem(file, type) {
  const div = document.createElement('div');
  div.className = `file-item ${type}`;
  div.dataset.fileId = file.id;
  div.dataset.fileType = type;
  div.dataset.filename = file.filename;
  
  const nameDiv = document.createElement('div');
  nameDiv.className = 'file-name';
  nameDiv.textContent = file.filename;
  nameDiv.title = file.filename; // Show full name on hover
  
  // Create hover buttons wrapper (for CSS targeting)
  const hoverButtons = document.createElement('div');
  hoverButtons.className = 'hover-buttons';
  
  // X button (remove)
  const removeBtn = document.createElement('button');
  removeBtn.className = 'hover-btn remove';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove from list';
  removeBtn.onclick = (e) => {
    console.log('Remove button clicked', file.filename);
    e.stopPropagation();
    removeFile(file.id, type);
  };
  
  // Arrow button (rename)
  const renameBtn = document.createElement('button');
  renameBtn.className = type === 'funscript' ? 'hover-btn rename arrow-right' : 'hover-btn rename arrow-left';
  renameBtn.title = 'Start rename with this file';
  renameBtn.onclick = (e) => {
    console.log('Rename button clicked', file.filename);
    e.stopPropagation();
    startRenameMode(file, type);
  };
  
  // Add buttons to wrapper
  hoverButtons.appendChild(removeBtn);
  hoverButtons.appendChild(renameBtn);
  
  div.appendChild(nameDiv);
  div.appendChild(hoverButtons);
  
  return div;
}

function startRenameMode(file, type) {
  currentRenameBase = file;
  currentRenameType = type;
  
  // Hide normal view, show rename view
  document.getElementById('normal-view').classList.add('hidden');
  document.getElementById('rename-view').classList.remove('hidden');
  
  // Set the base name display
  const baseName = getBaseNameForRename(file.filename);
  document.getElementById('rename-base-name').textContent = `Base name: ${baseName}`;
  
  // Update the column title
  const columnTitle = type === 'funscript' ? 'Video Files' : 'Funscript Files';
  document.getElementById('rename-column-title').textContent = columnTitle;
  
  // Populate the rename list with the opposite type files
  const renameList = document.getElementById('rename-list');
  renameList.innerHTML = '';
  
  const targetFiles = type === 'funscript' ? currentFiles.videos : currentFiles.funscripts;
  const targetType = type === 'funscript' ? 'video' : 'funscript';
  
  if (targetFiles.length === 0) {
    renameList.innerHTML = `<div class="empty-message">No ${targetType} files to rename</div>`;
  } else {
    targetFiles.forEach(targetFile => {
      const fileItem = createRenameFileItem(targetFile, targetType, baseName);
      renameList.appendChild(fileItem);
    });
  }
}

function createRenameFileItem(file, type, baseName) {
  const div = document.createElement('div');
  div.className = `file-item ${type}`;
  div.dataset.fileId = file.id;
  div.dataset.fileType = type;
  div.dataset.filename = file.filename;
  
  const nameDiv = document.createElement('div');
  nameDiv.className = 'file-name';
  nameDiv.textContent = file.filename;
  nameDiv.title = `Click to rename to: ${baseName}${getFileExtension(file.filename)}`;
  
  div.onclick = () => {
    performRename(file, type, baseName);
  };
  
  div.appendChild(nameDiv);
  
  return div;
}

function performRename(file, type, baseName) {
  const extension = getFileExtension(file.filename);
  const newName = baseName + extension;
  
  // Send rename request
  browser.runtime.sendMessage({
    action: 'renameFile',
    fileId: file.id,
    type: type,
    newName: newName,
    originalName: file.filename
  }).then(response => {
    if (response.success) {
      // Remove the renamed file from the list
      const fileElement = document.querySelector(`[data-file-id="${file.id}"][data-file-type="${type}"]`);
      if (fileElement) {
        fileElement.style.opacity = '0.5';
        fileElement.style.textDecoration = 'line-through';
        fileElement.onclick = null;
      }
      
      // Back out to normal view and reload files
      setTimeout(() => {
        cancelRenameMode();
        loadFiles();
      }, 1000);
    } else {
      alert(`Failed to rename: ${response.error || 'Unknown error'}`);
    }
  });
}

function cancelRenameMode() {
  currentRenameBase = null;
  currentRenameType = null;
  
  // Show normal view, hide rename view
  document.getElementById('normal-view').classList.remove('hidden');
  document.getElementById('rename-view').classList.add('hidden');
}

function getBaseNameForRename(filename) {
  // Get base name without any extension
  let baseName = filename;
  
  // Remove .funscript and anything after it
  baseName = baseName.replace(/\.funscript.*$/i, '');
  
  // Remove video extensions
  const videoExtensions = ['.mp4', '.avi', '.mkv', '.webm', '.mov', '.wmv', '.flv', '.m4v', '.mpg', '.mpeg'];
  videoExtensions.forEach(ext => {
    if (baseName.toLowerCase().endsWith(ext)) {
      baseName = baseName.slice(0, -ext.length);
    }
  });
  
  return baseName;
}

function getFileExtension(filename) {
  // For funscript files, preserve .funscript and anything after
  if (filename.toLowerCase().includes('.funscript')) {
    const match = filename.match(/\.funscript.*$/i);
    return match ? match[0] : '';
  }
  
  // For video files, get the extension
  const videoExtensions = ['.mp4', '.avi', '.mkv', '.webm', '.mov', '.wmv', '.flv', '.m4v', '.mpg', '.mpeg'];
  for (const ext of videoExtensions) {
    if (filename.toLowerCase().endsWith(ext)) {
      return filename.slice(-ext.length);
    }
  }
  
  // Default: get everything after the last dot
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 ? filename.slice(lastDot) : '';
}

function getBaseName(filename) {
  // Remove .funscript and any additional extensions after it
  let baseName = filename.replace(/\.funscript.*$/i, '');
  
  // Also remove video extensions
  const videoExtensions = ['.mp4', '.avi', '.mkv', '.webm', '.mov', '.wmv', '.flv', '.m4v', '.mpg', '.mpeg'];
  videoExtensions.forEach(ext => {
    if (baseName.toLowerCase().endsWith(ext)) {
      baseName = baseName.slice(0, -ext.length);
    }
  });
  
  return baseName.toLowerCase();
}

function highlightPotentialMatches(files) {
  const funscriptItems = document.querySelectorAll('[data-file-type="funscript"]');
  const videoItems = document.querySelectorAll('[data-file-type="video"]');
  
  funscriptItems.forEach(fsItem => {
    const fsFile = files.funscripts.find(f => f.id === parseInt(fsItem.dataset.fileId));
    if (fsFile) {
      const fsBase = getBaseName(fsFile.filename);
      
      videoItems.forEach(vItem => {
        const vFile = files.videos.find(v => v.id === parseInt(vItem.dataset.fileId));
        if (vFile) {
          const vBase = getBaseName(vFile.filename);
          
          if (fsBase === vBase) {
            fsItem.classList.add('has-match');
            vItem.classList.add('has-match');
          }
        }
      });
    }
  });
}

function removeFile(fileId, type) {
  browser.runtime.sendMessage({
    action: 'removeFile',
    id: fileId,
    type: type
  }).then(response => {
    if (response.success) {
      loadFiles();
    }
  });
}

function loadFiles() {
  console.log('Loading files...');
  browser.runtime.sendMessage({ action: 'getFiles' }).then(files => {
    console.log('Files loaded:', files);
    displayFiles(files);
  }).catch(error => {
    console.error('Load files error:', error);
  });
}

// Event listeners
document.getElementById('refresh').addEventListener('click', () => {
  loadFiles();
});

document.getElementById('clear-matched').addEventListener('click', () => {
  console.log('Clear matched button clicked');
  browser.runtime.sendMessage({ action: 'clearMatched' }).then(files => {
    console.log('Clear matched response:', files);
    displayFiles(files);
  }).catch(error => {
    console.error('Clear matched error:', error);
  });
});

// Cancel rename mode button
document.getElementById('cancel-rename').addEventListener('click', () => {
  console.log('Cancel rename button clicked');
  cancelRenameMode();
});

// Pop-out button functionality
function initPopOutButton() {
  const popOutBtn = document.getElementById('pop-out-btn');
  
  // Check if we're already in a popup window
  browser.windows.getCurrent().then(currentWindow => {
    console.log('Current window type:', currentWindow.type);
    
    if (currentWindow.type === 'popup') {
      // Hide pop-out button if we're already in a popup
      popOutBtn.style.display = 'none';
    } else {
      // Add click handler for pop-out
      popOutBtn.addEventListener('click', () => {
        console.log('Pop-out button clicked');
        browser.windows.create({
          url: browser.runtime.getURL('popup.html'),
          type: 'popup',
          width: 900,
          height: 700
        }).then(() => {
          // Close the current popup window
          window.close();
        }).catch(error => {
          console.error('Failed to create popup window:', error);
        });
      });
    }
  }).catch(error => {
    console.error('Failed to get current window:', error);
    // If we can't detect window type, just add the handler
    popOutBtn.addEventListener('click', () => {
      browser.windows.create({
        url: browser.runtime.getURL('popup.html'),
        type: 'popup',
        width: 900,
        height: 700
      });
    });
  });
}

// Initialize pop-out button
initPopOutButton();

// Tab switching functionality
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.dataset.tab;
      console.log('Tab clicked:', targetTab);
      
      // Update active states
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');
      
      currentTab = targetTab;
      
      // Load appropriate content
      if (targetTab === 'config') {
        loadConfiguration();
      } else if (targetTab === 'tracker') {
        loadFiles();
      }
    });
  });
}

// Configuration functionality
function loadConfiguration() {
  loadWatchedFolders();
  checkNativeHostStatus();
  loadSettings();
}

function loadWatchedFolders() {
  browser.runtime.sendMessage({ action: 'getWatchedFolders' }).then(response => {
    if (response.success) {
      watchedFolders = response.folders || [];
      displayWatchedFolders();
    }
  }).catch(() => {
    watchedFolders = [];
    displayWatchedFolders();
  });
}

function displayWatchedFolders() {
  const container = document.getElementById('watched-folders-list');
  container.innerHTML = '';
  
  if (watchedFolders.length === 0) {
    container.innerHTML = '<div class="empty-message">No folders being watched</div>';
    return;
  }
  
  watchedFolders.forEach((folder, index) => {
    const folderItem = document.createElement('div');
    folderItem.className = 'watched-folder-item';
    
    const pathDiv = document.createElement('div');
    pathDiv.className = 'folder-path';
    pathDiv.textContent = folder.path;
    pathDiv.title = folder.path;
    
    const statusDiv = document.createElement('div');
    statusDiv.className = `folder-status ${folder.status || 'unknown'}`;
    statusDiv.textContent = folder.status === 'active' ? 'Watching' : 
                           folder.status === 'error' ? 'Error' : 'Unknown';
    
    const scanBtn = document.createElement('button');
    scanBtn.className = 'scan-folder-btn';
    scanBtn.textContent = '🔍';
    scanBtn.title = 'Scan this folder for files';
    scanBtn.onclick = () => scanWatchedFolder(folder.path);
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-folder-btn';
    removeBtn.textContent = '×';
    removeBtn.title = 'Stop watching this folder';
    removeBtn.onclick = () => removeWatchedFolder(index);
    
    folderItem.appendChild(pathDiv);
    folderItem.appendChild(statusDiv);
    folderItem.appendChild(scanBtn);
    folderItem.appendChild(removeBtn);
    
    container.appendChild(folderItem);
  });
}

function addWatchedFolder() {
  const input = document.getElementById('folder-path-input');
  const path = input.value.trim();
  
  if (!path) {
    return;
  }
  
  // Check if already watching this folder
  if (watchedFolders.some(f => f.path === path)) {
    alert('This folder is already being watched.');
    return;
  }
  
  // Send request to background script
  browser.runtime.sendMessage({ 
    action: 'addWatchedFolder', 
    path: path 
  }).then(response => {
    if (response.success) {
      watchedFolders.push({
        path: path,
        status: 'active'
      });
      displayWatchedFolders();
      input.value = '';
    } else {
      alert(`Failed to add folder: ${response.error}`);
    }
  });
}

function scanWatchedFolder(path) {
  console.log('Scanning folder:', path);
  browser.runtime.sendMessage({ 
    action: 'scanDirectory', 
    directory: path 
  }).then(response => {
    console.log('Scan response:', response);
    if (response.success) {
      alert(`Found ${response.files ? response.files.length : 0} files in ${path}`);
      // Reload the main file list to show new files
      loadFiles();
    } else {
      alert(`Failed to scan folder: ${response.error}`);
    }
  }).catch(error => {
    console.error('Scan error:', error);
    alert(`Error scanning folder: ${error.message}`);
  });
}

function removeWatchedFolder(index) {
  const folder = watchedFolders[index];
  
  browser.runtime.sendMessage({ 
    action: 'removeWatchedFolder', 
    path: folder.path 
  }).then(response => {
    if (response.success) {
      watchedFolders.splice(index, 1);
      displayWatchedFolders();
    } else {
      alert(`Failed to remove folder: ${response.error}`);
    }
  });
}

function browseForFolder() {
  // This would typically use a file picker, but web extensions have limitations
  // For now, we'll prompt the user to enter the path manually
  const path = prompt('Enter the full path to the folder you want to watch:');
  if (path) {
    document.getElementById('folder-path-input').value = path;
  }
}

function checkNativeHostStatus() {
  browser.runtime.sendMessage({ action: 'checkNativeHost' }).then(response => {
    updateNativeHostStatus(response.connected, response.message);
  }).catch(() => {
    updateNativeHostStatus(false, 'Connection failed');
  });
}

function updateNativeHostStatus(connected, message) {
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-text');
  
  statusDot.className = `status-dot ${connected ? 'connected' : 'disconnected'}`;
  statusText.textContent = connected ? 'Connected' : message || 'Disconnected';
  nativeHostStatus = connected ? 'connected' : 'disconnected';
}

function testNativeHost() {
  browser.runtime.sendMessage({ action: 'testNativeHost' }).then(response => {
    if (response.success) {
      updateNativeHostStatus(true, 'Test successful');
      alert('Native host connection test successful!');
    } else {
      updateNativeHostStatus(false, 'Test failed');
      alert(`Native host test failed: ${response.error}`);
    }
  });
}

function loadSettings() {
  browser.storage.local.get(['autoRemoveMatches', 'showNotifications']).then(result => {
    document.getElementById('auto-remove-matches').checked = 
      result.autoRemoveMatches !== false; // Default to true
    document.getElementById('show-notifications').checked = 
      result.showNotifications !== false; // Default to true
  });
}

function saveSettings() {
  const autoRemoveMatches = document.getElementById('auto-remove-matches').checked;
  const showNotifications = document.getElementById('show-notifications').checked;
  
  browser.storage.local.set({
    autoRemoveMatches: autoRemoveMatches,
    showNotifications: showNotifications
  });
  
  // Notify background script of setting changes
  browser.runtime.sendMessage({
    action: 'updateSettings',
    settings: {
      autoRemoveMatches: autoRemoveMatches,
      showNotifications: showNotifications
    }
  });
}

// Initialize configuration event listeners
function initConfiguration() {
  document.getElementById('add-folder-btn').addEventListener('click', addWatchedFolder);
  document.getElementById('browse-folder-btn').addEventListener('click', browseForFolder);
  document.getElementById('test-native-host').addEventListener('click', testNativeHost);
  
  // Allow Enter key in folder input
  document.getElementById('folder-path-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addWatchedFolder();
    }
  });
  
  // Settings change handlers
  document.getElementById('auto-remove-matches').addEventListener('change', saveSettings);
  document.getElementById('show-notifications').addEventListener('change', saveSettings);
}

// Load files on popup open
initTabs();
initConfiguration();
loadFiles();
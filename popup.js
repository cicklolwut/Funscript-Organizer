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
    // Calculate probabilities and sort by highest probability first
    const filesWithProbability = targetFiles.map(targetFile => ({
      file: targetFile,
      probability: calculateMatchProbability(currentRenameBase, targetFile)
    }));
    
    // Sort by probability (highest first)
    filesWithProbability.sort((a, b) => b.probability - a.probability);
    
    // Create file items in sorted order
    filesWithProbability.forEach(({ file: targetFile }) => {
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
  
  // Calculate match probability with the base file
  const probability = calculateMatchProbability(currentRenameBase, file);
  
  const nameDiv = document.createElement('div');
  nameDiv.className = 'file-name';
  nameDiv.textContent = file.filename;
  nameDiv.title = `Click to rename to: ${baseName}${getFileExtension(file.filename)}`;
  
  // Add probability badge
  const probabilityBadge = document.createElement('div');
  probabilityBadge.className = 'probability-badge';
  probabilityBadge.textContent = `${probability}%`;
  
  // Color code based on confidence level
  if (probability >= 80) {
    probabilityBadge.classList.add('high-confidence');
  } else if (probability >= 50) {
    probabilityBadge.classList.add('medium-confidence');
  } else {
    probabilityBadge.classList.add('low-confidence');
  }
  
  div.onclick = () => {
    performRename(file, type, baseName);
  };
  
  div.appendChild(nameDiv);
  div.appendChild(probabilityBadge);
  
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

// String similarity algorithms for matching probability
function levenshteinDistance(str1, str2) {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }
  
  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  
  if (maxLength === 0) return 100;
  
  return Math.round((1 - distance / maxLength) * 100);
}

function extractKeywords(filename) {
  // Remove common brackets and prefixes
  let clean = filename.toLowerCase()
    .replace(/^\[.*?\]\s*/, '') // Remove [prefix] at start
    .replace(/\s*\[.*?\]\s*/g, ' ') // Remove [text] anywhere
    .replace(/\s*\(.*?\)\s*/g, ' ') // Remove (text) anywhere
    .replace(/[-_]+/g, ' ') // Replace dashes/underscores with spaces
    .replace(/['`´]/g, '') // Remove apostrophes and similar chars
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
  
  // Split into words and filter meaningful ones
  const words = clean.split(' ').filter(word => 
    word.length > 2 && 
    !['720p', '1080p', '2160p', '4k', '60fps', 'mp4', 'mkv', 'avi', 'webm', 'funscript'].includes(word)
  );
  
  // Also create simplified versions (remove numbers, extra chars)
  const simplified = words.map(word => word.replace(/\d+/g, '').replace(/[^a-z]/g, '')).filter(w => w.length > 2);
  
  // Return both original and simplified versions
  return [...new Set([...words, ...simplified])]; // Remove duplicates
}

function calculateKeywordSimilarity(str1, str2) {
  const keywords1 = extractKeywords(str1);
  const keywords2 = extractKeywords(str2);
  
  if (keywords1.length === 0 || keywords2.length === 0) return 0;
  
  let matches = 0;
  let totalPossibleMatches = 0;
  
  keywords1.forEach(word1 => {
    let bestMatch = 0;
    keywords2.forEach(word2 => {
      let matchScore = 0;
      
      // Exact match
      if (word1 === word2) {
        matchScore = 1.0;
      }
      // Partial match (one contains the other, min 3 chars)
      else if (word1.length >= 3 && word2.length >= 3 && (word1.includes(word2) || word2.includes(word1))) {
        matchScore = 0.8;
      }
      // High similarity (80%+)
      else if (calculateSimilarity(word1, word2) >= 80) {
        matchScore = 0.7;
      }
      // Medium similarity (60%+) 
      else if (calculateSimilarity(word1, word2) >= 60) {
        matchScore = 0.5;
      }
      
      bestMatch = Math.max(bestMatch, matchScore);
    });
    
    matches += bestMatch;
    totalPossibleMatches += 1;
  });
  
  // Calculate match percentage
  if (totalPossibleMatches === 0) return 0;
  
  const matchPercentage = (matches / totalPossibleMatches) * 100;
  
  // Bonus for having many shared keywords
  const sharedRatio = Math.min(keywords1.length, keywords2.length) / Math.max(keywords1.length, keywords2.length);
  const bonus = sharedRatio * 10; // Up to 10% bonus
  
  return Math.min(100, Math.round(matchPercentage + bonus));
}

function calculateTabTitleSimilarity(file1, file2) {
  if (!file1.tabTitle || !file2.tabTitle) return 0;
  
  // Extract meaningful parts from tab titles
  const cleanTitle1 = file1.tabTitle.replace(/\s*-\s*.*$/, '').trim();
  const cleanTitle2 = file2.tabTitle.replace(/\s*-\s*.*$/, '').trim();
  
  return calculateSimilarity(cleanTitle1, cleanTitle2);
}

function calculateMatchProbability(file1, file2) {
  const filename1 = getBaseName(file1.filename);
  const filename2 = getBaseName(file2.filename);
  
  // Exact filename match gets 100%
  if (filename1 === filename2) {
    return 100;
  }
  
  // Calculate various similarity scores
  const exactSimilarity = calculateSimilarity(filename1, filename2);
  const keywordSimilarity = calculateKeywordSimilarity(file1.filename, file2.filename);
  const tabSimilarity = calculateTabTitleSimilarity(file1, file2);
  
  // Check for strong core character/content matches
  const keywords1 = extractKeywords(file1.filename);
  const keywords2 = extractKeywords(file2.filename);
  const coreMatches = keywords1.filter(k1 => 
    keywords2.some(k2 => k1 === k2 || (k1.length >= 4 && k2.length >= 4 && (k1.includes(k2) || k2.includes(k1))))
  ).length;
  
  // If we have 2+ strong core matches, boost the score significantly
  let coreMatchBonus = 0;
  if (coreMatches >= 3) {
    coreMatchBonus = 25; // Strong content match
  } else if (coreMatches >= 2) {
    coreMatchBonus = 15; // Good content match
  }
  
  // Weight the scores - keyword matching is primary
  let probability = Math.max(
    exactSimilarity * 0.4, // Exact string similarity
    keywordSimilarity * 0.85 // Keyword-based similarity (primary)
  );
  
  // Add core match bonus
  probability += coreMatchBonus;
  
  // Add tab similarity with moderate weight
  probability += tabSimilarity * 0.2;
  
  // Bonus for same tab origin
  if (file1.tabTitle && file2.tabTitle && file1.tabTitle === file2.tabTitle) {
    probability = Math.min(100, probability + 15);
  }
  
  // Bonus for timestamp proximity (within 10 minutes)
  if (file1.timestamp && file2.timestamp) {
    const timeDiff = Math.abs(file1.timestamp - file2.timestamp);
    if (timeDiff < 600000) { // 10 minutes
      probability = Math.min(100, probability + 10);
    }
  }
  
  return Math.round(Math.min(100, probability));
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
          url: browser.runtime.getURL('window.html'),
          type: 'popup',
          width: 1000,
          height: 800
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
        url: browser.runtime.getURL('window.html'),
        type: 'popup',
        width: 1000,
        height: 800
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
  browser.storage.local.get([
    'autoRemoveMatches', 
    'showNotifications', 
    'themeMode', 
    'fontSize', 
    'windowSize',
    'customTheme',
    'savedThemes'
  ]).then(result => {
    document.getElementById('auto-remove-matches').checked = 
      result.autoRemoveMatches !== false; // Default to true
    document.getElementById('show-notifications').checked = 
      result.showNotifications !== false; // Default to true
    
    // Apply appearance settings
    document.getElementById('theme-mode').value = result.themeMode || 'auto';
    document.getElementById('font-size').value = result.fontSize || 'medium';
    document.getElementById('window-size').value = result.windowSize || 'normal';
    
    // Apply settings - window size first to ensure proper layout
    // Skip animation on initial load since size was already set in HTML
    applyWindowSize(result.windowSize || 'normal', true);
    applyTheme(result.themeMode || 'auto');
    applyFontSize(result.fontSize || 'medium');
    
    // Load custom theme if it exists
    if (result.customTheme) {
      loadCustomTheme(result.customTheme);
    }
    
    // Load saved themes
    loadSavedThemes(result.savedThemes || {});
  });
}

function saveSettings() {
  const autoRemoveMatches = document.getElementById('auto-remove-matches').checked;
  const showNotifications = document.getElementById('show-notifications').checked;
  const themeMode = document.getElementById('theme-mode').value;
  const fontSize = document.getElementById('font-size').value;
  const windowSize = document.getElementById('window-size').value;
  
  browser.storage.local.set({
    autoRemoveMatches: autoRemoveMatches,
    showNotifications: showNotifications,
    themeMode: themeMode,
    fontSize: fontSize,
    windowSize: windowSize
  });
  
  // Apply settings immediately - window size first
  applyWindowSize(windowSize);
  applyTheme(themeMode);
  applyFontSize(fontSize);
  
  // Notify background script of setting changes
  browser.runtime.sendMessage({
    action: 'updateSettings',
    settings: {
      autoRemoveMatches: autoRemoveMatches,
      showNotifications: showNotifications
    }
  });
}

// Theme Functions
function applyTheme(mode) {
  document.body.classList.remove('theme-light', 'theme-dark');
  
  // Save to localStorage for immediate application on next load
  localStorage.setItem('themeMode', mode);
  
  if (mode === 'light') {
    document.body.classList.add('theme-light');
  } else if (mode === 'dark') {
    document.body.classList.add('theme-dark');
  }
  // 'auto' uses CSS media query
}

function applyFontSize(size) {
  document.body.classList.remove('font-small', 'font-medium', 'font-large');
  document.body.classList.add(`font-${size}`);
}

function applyWindowSize(size, skipAnimation = false) {
  // Skip window sizing in window mode
  if (document.body.classList.contains('window-mode')) {
    return;
  }
  
  document.body.classList.remove('size-compact', 'size-normal', 'size-large');
  document.body.classList.add(`size-${size}`);
  
  // Save to localStorage for immediate application on next load
  localStorage.setItem('windowSize', size);
  
  // Set the actual body dimensions for browser extension popup
  const sizes = {
    compact: { width: 580, height: 480 },
    normal: { width: 650, height: 580 },
    large: { width: 750, height: 600 }
  };
  
  if (sizes[size]) {
    // Enable transitions after initial load
    if (!skipAnimation && !document.body.classList.contains('enable-transitions')) {
      setTimeout(() => {
        document.body.classList.add('enable-transitions');
      }, 100);
    }
    
    // Use both style and min-height to force browser to recognize the change
    document.body.style.width = `${sizes[size].width}px`;
    document.body.style.height = `${sizes[size].height}px`;
    document.body.style.minHeight = `${sizes[size].height}px`;
    
    // Force browser to recalculate layout
    document.body.offsetHeight; // Trigger reflow
  }
}

function loadCustomTheme(theme) {
  const root = document.documentElement;
  Object.keys(theme).forEach(property => {
    root.style.setProperty(`--${property}`, theme[property]);
  });
}

function getCurrentTheme() {
  const theme = {};
  const colorInputs = document.querySelectorAll('#theming-controls input[type="color"]');
  colorInputs.forEach(input => {
    const property = input.id.replace(/-/g, '-');
    theme[property] = input.value;
  });
  return theme;
}

function loadSavedThemes(themes) {
  const select = document.getElementById('saved-themes');
  select.innerHTML = '<option value="">Select a theme...</option>';
  
  Object.keys(themes).forEach(themeName => {
    const option = document.createElement('option');
    option.value = themeName;
    option.textContent = themeName;
    select.appendChild(option);
  });
}

function saveCurrentTheme() {
  const themeName = prompt('Enter a name for this theme:');
  if (!themeName) return;
  
  const theme = getCurrentTheme();
  
  browser.storage.local.get('savedThemes').then(result => {
    const savedThemes = result.savedThemes || {};
    savedThemes[themeName] = theme;
    
    browser.storage.local.set({ savedThemes });
    loadSavedThemes(savedThemes);
    
    // Add to dropdown and select it
    document.getElementById('saved-themes').value = themeName;
  });
}

function loadSelectedTheme() {
  const select = document.getElementById('saved-themes');
  const themeName = select.value;
  if (!themeName) return;
  
  browser.storage.local.get('savedThemes').then(result => {
    const savedThemes = result.savedThemes || {};
    const theme = savedThemes[themeName];
    if (theme) {
      // Set color inputs
      Object.keys(theme).forEach(property => {
        const input = document.getElementById(property);
        if (input) {
          input.value = theme[property];
        }
      });
    }
  });
}

function deleteSelectedTheme() {
  const select = document.getElementById('saved-themes');
  const themeName = select.value;
  if (!themeName) return;
  
  if (!confirm(`Delete theme "${themeName}"?`)) return;
  
  browser.storage.local.get('savedThemes').then(result => {
    const savedThemes = result.savedThemes || {};
    delete savedThemes[themeName];
    
    browser.storage.local.set({ savedThemes });
    loadSavedThemes(savedThemes);
  });
}

function applyCurrentTheme() {
  const theme = getCurrentTheme();
  
  // Apply to current page
  loadCustomTheme(theme);
  
  // Save to storage
  browser.storage.local.set({ customTheme: theme });
}

function resetTheme() {
  const defaultTheme = {
    'bg-primary': '#f5f5f5',
    'bg-secondary': '#ffffff',
    'bg-tertiary': '#f9f9f9',
    'text-primary': '#333333',
    'text-secondary': '#666666',
    'text-tertiary': '#999999',
    'accent-green': '#4CAF50',
    'accent-blue': '#2196F3',
    'accent-red': '#f44336',
    'accent-yellow': '#ffc107',
    'accent-orange': '#FF9800',
    'border-primary': '#e0e0e0',
    'border-secondary': '#dddddd'
  };
  
  // Set color inputs
  Object.keys(defaultTheme).forEach(property => {
    const input = document.getElementById(property);
    if (input) {
      input.value = defaultTheme[property];
    }
  });
  
  // Remove custom theme
  browser.storage.local.remove('customTheme');
  
  // Reset CSS variables
  const root = document.documentElement;
  Object.keys(defaultTheme).forEach(property => {
    root.style.removeProperty(`--${property}`);
  });
}

function toggleThemingControls() {
  const controls = document.getElementById('theming-controls');
  const toggle = document.getElementById('toggle-theming');
  
  if (controls.classList.contains('hidden')) {
    controls.classList.remove('hidden');
    toggle.textContent = 'Advanced Theming ▲';
  } else {
    controls.classList.add('hidden');
    toggle.textContent = 'Advanced Theming ▼';
  }
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
  
  // Appearance settings
  document.getElementById('theme-mode').addEventListener('change', saveSettings);
  document.getElementById('font-size').addEventListener('change', saveSettings);
  document.getElementById('window-size').addEventListener('change', saveSettings);
  
  // Theming controls
  document.getElementById('toggle-theming').addEventListener('click', toggleThemingControls);
  document.getElementById('load-theme').addEventListener('click', loadSelectedTheme);
  document.getElementById('save-theme').addEventListener('click', saveCurrentTheme);
  document.getElementById('delete-theme').addEventListener('click', deleteSelectedTheme);
  document.getElementById('apply-theme').addEventListener('click', applyCurrentTheme);
  document.getElementById('reset-theme').addEventListener('click', resetTheme);
}

// Load files on popup open
initTabs();
initConfiguration();
loadSettings(); // Load and apply settings immediately on startup
loadFiles();
// Check native host status on startup
checkNativeHostStatus();
const videoExtensions = ['.mp4', '.avi', '.mkv', '.webm', '.mov', '.wmv', '.flv', '.m4v', '.mpg', '.mpeg'];

let downloadedFiles = {
  funscripts: [],
  videos: []
};

// Native messaging port
let nativePort = null;
let watchedDirectories = new Set();
let userSettings = {
  autoRemoveMatches: true,
  showNotifications: true
};

function getBaseName(filename) {
  // Remove .funscript and any additional extensions after it
  let baseName = filename.replace(/\.funscript.*$/i, '');
  
  // Also remove video extensions if present
  videoExtensions.forEach(ext => {
    if (baseName.toLowerCase().endsWith(ext)) {
      baseName = baseName.slice(0, -ext.length);
    }
  });
  
  return baseName.toLowerCase();
}

function isFunscriptFile(filename) {
  return filename.toLowerCase().includes('.funscript');
}

function isVideoFile(filename) {
  const lower = filename.toLowerCase();
  return videoExtensions.some(ext => lower.endsWith(ext));
}

function checkAndRemoveMatches() {
  const funscriptBases = downloadedFiles.funscripts.map(f => ({
    file: f,
    base: getBaseName(f.filename)
  }));
  
  const videoBases = downloadedFiles.videos.map(v => ({
    file: v,
    base: getBaseName(v.filename)
  }));
  
  // Find matches and remove them
  const matchedFunscripts = [];
  const matchedVideos = [];
  
  funscriptBases.forEach(fs => {
    const matchingVideo = videoBases.find(v => v.base === fs.base);
    if (matchingVideo) {
      matchedFunscripts.push(fs.file.id);
      matchedVideos.push(matchingVideo.file.id);
    }
  });
  
  // Remove matched files
  downloadedFiles.funscripts = downloadedFiles.funscripts.filter(
    f => !matchedFunscripts.includes(f.id)
  );
  downloadedFiles.videos = downloadedFiles.videos.filter(
    v => !matchedVideos.includes(v.id)
  );
  
  // Save to storage
  saveToStorage();
  
  // Update badge
  updateBadge();
}

function saveToStorage() {
  browser.storage.local.set({ downloadedFiles, watchedDirectories: Array.from(watchedDirectories) });
}

function loadFromStorage() {
  return browser.storage.local.get(['downloadedFiles', 'watchedDirectories', 'autoRemoveMatches', 'showNotifications']).then(result => {
    if (result.downloadedFiles) {
      downloadedFiles = result.downloadedFiles;
    }
    if (result.watchedDirectories) {
      watchedDirectories = new Set(result.watchedDirectories);
      // Reconnect to watched directories
      watchedDirectories.forEach(dir => {
        watchDirectory(dir);
      });
    }
    if (result.autoRemoveMatches !== undefined) {
      userSettings.autoRemoveMatches = result.autoRemoveMatches;
    }
    if (result.showNotifications !== undefined) {
      userSettings.showNotifications = result.showNotifications;
    }
  });
}

function updateBadge() {
  const totalUnmatched = downloadedFiles.funscripts.length + downloadedFiles.videos.length;
  
  if (totalUnmatched > 0) {
    browser.browserAction.setBadgeText({ text: totalUnmatched.toString() });
    browser.browserAction.setBadgeBackgroundColor({ color: '#FF6B6B' });
  } else {
    browser.browserAction.setBadgeText({ text: '' });
  }
}

// Function to connect to native host
function connectNativeHost() {
  try {
    nativePort = browser.runtime.connectNative('funscript_rename_host');
    
    nativePort.onMessage.addListener((message) => {
      // Handle both responses and unsolicited notifications
      if (message.source === 'native_host') {
        handleNativeNotification(message);
      } else if (message.response_to) {
        // This is a response to a request - handled by specific callbacks
        console.log('Response received:', message);
      }
    });
    
    nativePort.onDisconnect.addListener((p) => {
      console.log('Native host disconnected');
      if (browser.runtime.lastError) {
        console.error('Disconnected due to error:', browser.runtime.lastError.message);
      }
      nativePort = null;
      watchedDirectories.clear();
    });
    
    // Send initial ping to check capabilities
    nativePort.postMessage({ action: 'ping', id: 'initial_ping' });
    
    return true;
  } catch (error) {
    console.error('Failed to connect to native host:', error);
    return false;
  }
}

// Handle unsolicited notifications from native host
function handleNativeNotification(notification) {
  console.log('Native notification:', notification);
  
  switch (notification.type) {
    case 'new_file_detected':
      // A new file was detected in a watched directory
      const filename = notification.filename;
      
      if (isFunscriptFile(filename)) {
        // Add to funscripts list if not already there
        const exists = downloadedFiles.funscripts.some(f => 
          f.filename === filename && f.nativeDetected
        );
        
        if (!exists) {
          downloadedFiles.funscripts.push({
            id: Date.now() + Math.random(), // Generate unique ID
            filename: filename,
            path: notification.path,
            nativeDetected: true,
            timestamp: notification.timestamp
          });
          if (userSettings.autoRemoveMatches) {
            checkAndRemoveMatches();
          }
          
          // Show browser notification
          if (userSettings.showNotifications) {
            browser.notifications.create({
              type: 'basic',
              iconUrl: browser.extension.getURL('icon-48.png'),
              title: 'New Funscript Detected',
              message: `Found: ${filename}`
            });
          }
        }
      } else if (isVideoFile(filename)) {
        // Add to videos list if not already there
        const exists = downloadedFiles.videos.some(v => 
          v.filename === filename && v.nativeDetected
        );
        
        if (!exists) {
          downloadedFiles.videos.push({
            id: Date.now() + Math.random(), // Generate unique ID
            filename: filename,
            path: notification.path,
            nativeDetected: true,
            timestamp: notification.timestamp
          });
          if (userSettings.autoRemoveMatches) {
            checkAndRemoveMatches();
          }
          
          // Show browser notification
          if (userSettings.showNotifications) {
            browser.notifications.create({
              type: 'basic',
              iconUrl: browser.extension.getURL('icon-48.png'),
              title: 'New Video Detected',
              message: `Found: ${filename}`
            });
          }
        }
      }
      break;
      
    case 'file_deleted':
      // A file was deleted from a watched directory
      downloadedFiles.funscripts = downloadedFiles.funscripts.filter(
        f => f.path !== notification.path
      );
      downloadedFiles.videos = downloadedFiles.videos.filter(
        v => v.path !== notification.path
      );
      saveToStorage();
      updateBadge();
      break;
      
    case 'file_renamed':
      // A file was renamed
      console.log(`File renamed: ${notification.old_path} -> ${notification.new_path}`);
      break;
  }
}

// Watch a directory for changes
function watchDirectory(directoryPath) {
  if (!nativePort) {
    connectNativeHost();
  }
  
  if (nativePort && !watchedDirectories.has(directoryPath)) {
    nativePort.postMessage({
      action: 'watch',
      directory: directoryPath,
      id: `watch_${Date.now()}`
    });
    watchedDirectories.add(directoryPath);
    saveToStorage();
  }
}

function unwatchDirectory(directoryPath) {
  if (nativePort && watchedDirectories.has(directoryPath)) {
    nativePort.postMessage({
      action: 'unwatch',
      directory: directoryPath,
      id: `unwatch_${Date.now()}`
    });
    watchedDirectories.delete(directoryPath);
    saveToStorage();
  }
}

// Scan a directory for existing files
function scanDirectory(directoryPath) {
  if (!nativePort) {
    connectNativeHost();
  }
  
  if (nativePort) {
    return new Promise((resolve) => {
      const requestId = `scan_${Date.now()}`;
      
      const responseHandler = (message) => {
        if (message.response_to === requestId) {
          nativePort.onMessage.removeListener(responseHandler);
          
          if (message.success && message.files) {
            // Add found files to our lists
            message.files.forEach(file => {
              if (file.type === 'funscript') {
                const exists = downloadedFiles.funscripts.some(f => 
                  f.path === file.path
                );
                if (!exists) {
                  downloadedFiles.funscripts.push({
                    id: Date.now() + Math.random(),
                    filename: file.filename,
                    path: file.path,
                    nativeDetected: true,
                    timestamp: file.modified
                  });
                }
              } else if (file.type === 'video') {
                const exists = downloadedFiles.videos.some(v => 
                  v.path === file.path
                );
                if (!exists) {
                  downloadedFiles.videos.push({
                    id: Date.now() + Math.random(),
                    filename: file.filename,
                    path: file.path,
                    nativeDetected: true,
                    timestamp: file.modified
                  });
                }
              }
            });
            
            checkAndRemoveMatches();
          }
          
          resolve(message);
        }
      };
      
      nativePort.onMessage.addListener(responseHandler);
      
      nativePort.postMessage({
        action: 'scan',
        directory: directoryPath,
        id: requestId
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        nativePort.onMessage.removeListener(responseHandler);
        resolve({ success: false, error: 'Scan timeout' });
      }, 10000);
    });
  }
  
  return Promise.resolve({ success: false, error: 'Native host not connected' });
}

// Listen for download completion
browser.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state && downloadDelta.state.current === 'complete') {
    browser.downloads.search({ id: downloadDelta.id }).then(downloads => {
      if (downloads.length > 0) {
        const download = downloads[0];
        const filename = download.filename.split('/').pop() || download.filename.split('\\').pop();
        
        // Extract directory and watch it
        const fullPath = download.filename;
        const lastSeparator = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
        const directory = fullPath.substring(0, lastSeparator);
        
        // Watch the download directory
        watchDirectory(directory);
        
        if (isFunscriptFile(filename)) {
          downloadedFiles.funscripts.push({
            id: download.id,
            filename: filename,
            url: download.url,
            path: download.filename,
            timestamp: Date.now()
          });
          checkAndRemoveMatches();
        } else if (isVideoFile(filename)) {
          downloadedFiles.videos.push({
            id: download.id,
            filename: filename,
            url: download.url,
            path: download.filename,
            timestamp: Date.now()
          });
          checkAndRemoveMatches();
        }
      }
    });
  }
});

// Handle messages from popup
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getFiles') {
    sendResponse(downloadedFiles);
  } else if (request.action === 'removeFile') {
    if (request.type === 'funscript') {
      downloadedFiles.funscripts = downloadedFiles.funscripts.filter(
        f => f.id !== request.id
      );
    } else if (request.type === 'video') {
      downloadedFiles.videos = downloadedFiles.videos.filter(
        v => v.id !== request.id
      );
    }
    saveToStorage();
    updateBadge();
    sendResponse({ success: true });
  } else if (request.action === 'clearMatched') {
    // This is handled automatically, just return current state
    checkAndRemoveMatches();
    sendResponse(downloadedFiles);
  } else if (request.action === 'renameFile') {
    // Handle file rename
    handleRename(request.fileId, request.type, request.newName, request.originalName)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  } else if (request.action === 'scanDirectory') {
    // Scan a directory for files
    scanDirectory(request.directory)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  } else if (request.action === 'getWatchedFolders') {
    // Return list of watched folders with status
    const folders = Array.from(watchedDirectories).map(path => ({
      path: path,
      status: 'active' // Could be enhanced to check actual status
    }));
    sendResponse({ success: true, folders: folders });
  } else if (request.action === 'addWatchedFolder') {
    // Add a new folder to watch
    const path = request.path;
    if (path) {
      watchDirectory(path);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Invalid path' });
    }
  } else if (request.action === 'removeWatchedFolder') {
    // Remove a folder from watching
    const path = request.path;
    if (path) {
      unwatchDirectory(path);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Invalid path' });
    }
  } else if (request.action === 'checkNativeHost') {
    // Check native host connection status - simple check without trying to connect
    if (nativePort) {
      sendResponse({ connected: true, message: 'Connected' });
    } else {
      sendResponse({ connected: false, message: 'Not connected' });
    }
  } else if (request.action === 'testNativeHost') {
    // Test native host connection
    if (!nativePort) {
      connectNativeHost();
    }
    
    if (nativePort) {
      const testId = `test_${Date.now()}`;
      
      // Set up one-time listener for the response
      const responseHandler = (message) => {
        if (message.response_to === testId) {
          nativePort.onMessage.removeListener(responseHandler);
          sendResponse({ success: true, message: message.message });
        }
      };
      
      nativePort.onMessage.addListener(responseHandler);
      
      nativePort.postMessage({
        action: 'ping',
        id: testId
      });
      
      // Timeout after 3 seconds
      setTimeout(() => {
        nativePort.onMessage.removeListener(responseHandler);
        sendResponse({ success: false, error: 'Test timeout' });
      }, 3000);
      
      return true; // Keep channel open for async response
    } else {
      sendResponse({ success: false, error: 'Native host not connected' });
    }
  } else if (request.action === 'updateSettings') {
    // Update user settings
    if (request.settings) {
      Object.assign(userSettings, request.settings);
      browser.storage.local.set(request.settings);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No settings provided' });
    }
  }
  return true;
});

// Function to handle file renaming
async function handleRename(fileId, type, newName, originalName) {
  try {
    // Find the file in our lists
    let file = null;
    let fullPath = null;
    
    if (type === 'funscript') {
      file = downloadedFiles.funscripts.find(f => f.id === fileId);
    } else if (type === 'video') {
      file = downloadedFiles.videos.find(v => v.id === fileId);
    }
    
    if (!file) {
      return { success: false, error: 'File not found in tracker' };
    }
    
    // Use path if available (from native detection), otherwise try to get from download
    if (file.path) {
      fullPath = file.path;
    } else if (typeof file.id === 'number') {
      // This is a download ID, search for it
      const downloads = await browser.downloads.search({ id: file.id });
      if (downloads.length > 0) {
        fullPath = downloads[0].filename;
      }
    }
    
    if (!fullPath) {
      return { success: false, error: 'Could not determine file path' };
    }
    
    // Try to rename using native host first
    if (!nativePort) {
      connectNativeHost();
    }
    
    if (nativePort) {
      return new Promise((resolve) => {
        const requestId = `rename_${Date.now()}`;
        
        // Set up one-time listener for the response
        const responseHandler = (message) => {
          console.log('Received native host response:', message);
          // Handle response either with matching ID or if no ID system (backwards compatibility)
          if (message.response_to === requestId || !message.response_to) {
            console.log('Response matches request ID, processing...');
            nativePort.onMessage.removeListener(responseHandler);
            
            if (message.success) {
              // Update our internal record
              file.filename = newName;
              file.renamed = true;
              file.originalName = originalName;
              
              saveToStorage();
              checkAndRemoveMatches();
              
              resolve({ 
                success: true, 
                note: 'File successfully renamed on disk'
              });
            } else {
              resolve({ 
                success: false, 
                error: message.error || 'Native host rename failed'
              });
            }
          }
        };
        
        nativePort.onMessage.addListener(responseHandler);
        
        // Send rename request to native host
        console.log('Sending rename request:', {
          action: 'rename',
          oldPath: fullPath,
          newName: newName,
          id: requestId
        });
        
        nativePort.postMessage({
          action: 'rename',
          oldPath: fullPath,
          newName: newName,
          id: requestId
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          nativePort.onMessage.removeListener(responseHandler);
          resolve({ 
            success: false, 
            error: 'Native host timeout'
          });
        }, 5000);
      });
    } else {
      // Fallback to internal rename only
      file.filename = newName;
      file.renamed = true;
      file.originalName = originalName;
      
      saveToStorage();
      checkAndRemoveMatches();
      
      return { 
        success: true, 
        note: 'File renamed in tracker only. Install native host for disk renaming.'
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Load data on startup
loadFromStorage().then(() => {
  updateBadge();
  // Try to connect to native host on startup
  connectNativeHost();
});
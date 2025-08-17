const videoExtensions = ['.mp4', '.avi', '.mkv', '.webm', '.mov', '.wmv', '.flv', '.m4v', '.mpg', '.mpeg'];

let downloadedFiles = {
  funscripts: [],
  videos: []
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
  browser.storage.local.set({ downloadedFiles });
}

function loadFromStorage() {
  return browser.storage.local.get('downloadedFiles').then(result => {
    if (result.downloadedFiles) {
      downloadedFiles = result.downloadedFiles;
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

// Listen for download completion
browser.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state && downloadDelta.state.current === 'complete') {
    browser.downloads.search({ id: downloadDelta.id }).then(downloads => {
      if (downloads.length > 0) {
        const download = downloads[0];
        const filename = download.filename.split('/').pop() || download.filename.split('\\').pop();
        
        if (isFunscriptFile(filename)) {
          downloadedFiles.funscripts.push({
            id: download.id,
            filename: filename,
            url: download.url,
            timestamp: Date.now()
          });
          checkAndRemoveMatches();
        } else if (isVideoFile(filename)) {
          downloadedFiles.videos.push({
            id: download.id,
            filename: filename,
            url: download.url,
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
  } else if (request.action === 'testNativeHost') {
    // Test native host connection
    if (!nativePort) {
      const connected = connectNativeHost();
      if (connected) {
        sendResponse({ success: true, message: 'Connected to native host' });
      } else {
        sendResponse({ success: false, error: 'Failed to connect to native host' });
      }
    } else {
      sendResponse({ success: true, message: 'Native host already connected' });
    }
  } else if (request.action === 'addWatchedFolder') {
    // For now, just acknowledge - could implement folder watching later
    sendResponse({ success: true, message: 'Folder watching not yet implemented' });
  } else if (request.action === 'getWatchedFolders') {
    // Return empty array for now
    sendResponse({ success: true, folders: [] });
  }
  return true;
});

// Native messaging port
let nativePort = null;

// Function to connect to native host
function connectNativeHost() {
  try {
    nativePort = browser.runtime.connectNative('funscript_rename_host');
    
    nativePort.onMessage.addListener((response) => {
      // Handle responses from native host
      if (response.error) {
        console.error('Native host error:', response.error);
      }
    });
    
    nativePort.onDisconnect.addListener((p) => {
      console.log('Native host disconnected');
      if (browser.runtime.lastError) {
        console.error('Disconnected due to error:', browser.runtime.lastError.message);
      }
      nativePort = null;
    });
    
    return true;
  } catch (error) {
    console.error('Failed to connect to native host:', error);
    return false;
  }
}

// Function to handle file renaming
async function handleRename(fileId, type, newName, originalName) {
  try {
    // Search for the download item
    const downloads = await browser.downloads.search({ id: fileId });
    
    if (downloads.length === 0) {
      return { success: false, error: 'Download not found' };
    }
    
    const download = downloads[0];
    const fullPath = download.filename;
    
    // Try to rename using native host first
    if (!nativePort) {
      connectNativeHost();
    }
    
    if (nativePort) {
      return new Promise((resolve) => {
        // Set up one-time listener for the response
        const responseHandler = (response) => {
          nativePort.onMessage.removeListener(responseHandler);
          
          if (response.success) {
            // Update our internal record
            if (type === 'funscript') {
              const file = downloadedFiles.funscripts.find(f => f.id === fileId);
              if (file) {
                file.filename = newName;
                file.renamed = true;
                file.originalName = originalName;
              }
            } else if (type === 'video') {
              const file = downloadedFiles.videos.find(v => v.id === fileId);
              if (file) {
                file.filename = newName;
                file.renamed = true;
                file.originalName = originalName;
              }
            }
            
            saveToStorage();
            checkAndRemoveMatches();
            
            resolve({ 
              success: true, 
              note: 'File successfully renamed on disk'
            });
          } else {
            resolve({ 
              success: false, 
              error: response.error || 'Native host rename failed'
            });
          }
        };
        
        nativePort.onMessage.addListener(responseHandler);
        
        // Send rename request to native host
        nativePort.postMessage({
          action: 'rename',
          oldPath: fullPath,
          newName: newName
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
      if (type === 'funscript') {
        const file = downloadedFiles.funscripts.find(f => f.id === fileId);
        if (file) {
          file.filename = newName;
          file.renamed = true;
          file.originalName = originalName;
        }
      } else if (type === 'video') {
        const file = downloadedFiles.videos.find(v => v.id === fileId);
        if (file) {
          file.filename = newName;
          file.renamed = true;
          file.originalName = originalName;
        }
      }
      
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
});
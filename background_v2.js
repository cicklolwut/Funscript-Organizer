const videoExtensions = ['.mp4', '.avi', '.mkv', '.webm', '.mov', '.wmv', '.flv', '.m4v', '.mpg', '.mpeg'];

// Known funscript variant extensions
const funscriptVariants = [
  'roll', 'twist', 'sway', 'surge', 'pitch',
  'vib', 'vib0', 'vib1', 'vib2', 
  'vibe', 'vibe0', 'vibe1', 'vibe2',
  'stroke', 'lube', 'heat'
];

let downloadedFiles = {
  funscripts: [],
  videos: []
};

// Track downloads in progress
let downloadsInProgress = new Map(); // downloadId -> {filename, startTime, type}

// Native messaging port
let nativePort = null;
let watchedDirectories = new Set();
let userSettings = {
  autoRemoveMatches: true,
  showNotifications: true,
  moveMatchedFiles: false,
  organizeInSubfolders: false,
  matchedFilesFolder: null
};

function getBaseName(filename) {
  let baseName = filename;
  
  // Remove funscript extensions (both patterns)
  // Pattern 2 FIRST: .variant.funscript (e.g., .roll.funscript, .pitch.funscript)
  for (const variant of funscriptVariants) {
    const pattern = new RegExp(`\\.${variant}\\.funscript$`, 'i');
    baseName = baseName.replace(pattern, '');
  }
  
  // Pattern 1 SECOND: .funscript and anything after (e.g., .funscript.pitch)
  baseName = baseName.replace(/\.funscript.*$/i, '');
  
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

// Get all related funscript files (base + complex extensions)
function getRelatedFunscripts(baseName, allFiles) {
  const related = [];
  const basePattern = baseName.toLowerCase();
  
  allFiles.forEach(file => {
    const fileName = file.filename.toLowerCase();
    // Check if this file starts with the base name and contains .funscript
    if (fileName.startsWith(basePattern) && fileName.includes('.funscript')) {
      related.push(file);
    }
  });
  
  return related;
}

function isVideoFile(filename) {
  const lower = filename.toLowerCase();
  return videoExtensions.some(ext => lower.endsWith(ext));
}

function isTemporaryFile(filename) {
  const lower = filename.toLowerCase();
  // Check for common temporary file extensions/patterns
  const tempPatterns = [
    '.part',           // Download in progress
    '.tmp',            // Temporary files
    '.temp',           // Temporary files
    '.crdownload',     // Chrome download
    '.download',       // Generic download
    '.partial',        // Partial download
    '.~',              // Backup/temp files
    '.cache'           // Cache files
  ];
  
  return tempPatterns.some(pattern => lower.endsWith(pattern) || lower.includes(pattern));
}

async function checkAndRemoveMatches() {
  console.log('checkAndRemoveMatches called');
  console.log('Current funscripts:', downloadedFiles.funscripts.length);
  console.log('Current videos:', downloadedFiles.videos.length);
  
  const funscriptBases = {};
  
  // Group funscripts by base name
  downloadedFiles.funscripts.forEach(f => {
    const base = getBaseName(f.filename);
    if (!funscriptBases[base]) {
      funscriptBases[base] = [];
    }
    funscriptBases[base].push(f);
  });
  
  // Filter videos to only include those that are ready to be moved
  const currentTime = Date.now();
  const settledVideos = downloadedFiles.videos.filter(v => {
    // Priority 1: Files tracked through downloads API (most reliable)
    if (v.downloadCompleted && typeof v.id === 'number') {
      // These files were tracked from start to finish via downloads API
      console.log(`Video ${v.filename} confirmed complete via downloads API`);
      return true;
    }
    
    // Priority 2: Files where we detected .part file deletion
    if (v.downloadCompleted && !v.id) {
      const timeSinceComplete = currentTime - v.downloadCompleted;
      // Wait 2 seconds after .part deletion for file to stabilize
      if (timeSinceComplete >= 2000) {
        console.log(`Video ${v.filename} download confirmed complete via .part deletion ${timeSinceComplete}ms ago`);
        return true;
      } else {
        console.log(`Video ${v.filename} download just completed via .part, waiting for stabilization`);
        return false;
      }
    }
    
    // Priority 3: Files detected by native host (use longer delay)
    if (v.nativeDetected) {
      const age = currentTime - (v.timestamp || currentTime);
      const minAge = 15000; // 15 seconds for native-detected files
      if (age < minAge) {
        console.log(`Video ${v.filename} detected by native host, too new (${age}ms old), waiting at least ${minAge}ms`);
        return false;
      }
      return true;
    }
    
    // Fallback: Use time-based heuristic for other files
    const age = currentTime - (v.timestamp || currentTime);
    const minAge = 20000; // 20 seconds for unknown source files
    if (age < minAge) {
      console.log(`Video ${v.filename} from unknown source, too new (${age}ms old), waiting at least ${minAge}ms`);
      return false;
    }
    return true;
  });
  
  const videoBases = settledVideos.map(v => ({
    file: v,
    base: getBaseName(v.filename)
  }));
  
  console.log('Funscript bases:', Object.keys(funscriptBases));
  console.log('Video bases:', videoBases.map(v => v.base));
  console.log('Move settings:', {
    moveMatchedFiles: userSettings.moveMatchedFiles,
    matchedFilesFolder: userSettings.matchedFilesFolder
  });
  
  // Find matches and process them
  let matchedFunscriptIds = [];
  let matchedVideoIds = [];
  const filesToMove = [];
  
  for (const [base, funscripts] of Object.entries(funscriptBases)) {
    const matchingVideo = videoBases.find(v => v.base === base);
    if (matchingVideo) {
      console.log(`Found match for base: ${base}`);
      
      // Create a matched set that includes video and all related funscripts
      // This ensures they move together as a unit
      const matchedSet = {
        base: base,
        video: null,
        funscripts: []
      };
      
      // Add video to the set
      if (userSettings.moveMatchedFiles && userSettings.matchedFilesFolder && matchingVideo.file.path) {
        console.log('Processing video:', matchingVideo.file.filename, 'path:', matchingVideo.file.path);
        matchedSet.video = {
          type: 'video',
          path: matchingVideo.file.path,
          filename: matchingVideo.file.filename,
          id: matchingVideo.file.id
        };
        matchedVideoIds.push(matchingVideo.file.id);
      }
      
      // Add all related funscripts to the set
      funscripts.forEach(fs => {
        if (userSettings.moveMatchedFiles && userSettings.matchedFilesFolder && fs.path) {
          console.log('Processing funscript:', fs.filename, 'path:', fs.path);
          matchedSet.funscripts.push({
            type: 'funscript',
            path: fs.path,
            filename: fs.filename,
            id: fs.id
          });
          matchedFunscriptIds.push(fs.id);
        }
      });
      
      // Only add to move list if we have both video and at least one funscript
      // This prevents moving one without the other
      if (matchedSet.video && matchedSet.funscripts.length > 0) {
        console.log('Adding matched set to move list:', matchedSet);
        filesToMove.push(matchedSet.video);
        matchedSet.funscripts.forEach(fs => filesToMove.push(fs));
      } else {
        console.log('Skipping incomplete match set:', {
          hasVideo: !!matchedSet.video,
          funscriptCount: matchedSet.funscripts.length
        });
        // Clear the IDs since we're not moving anything
        if (!matchedSet.video) {
          // Remove video ID if we couldn't process it
          matchedVideoIds = matchedVideoIds.filter(id => id !== matchingVideo.file.id);
        }
        if (matchedSet.funscripts.length === 0) {
          // Remove funscript IDs if we couldn't process them
          funscripts.forEach(fs => {
            matchedFunscriptIds = matchedFunscriptIds.filter(id => id !== fs.id);
          });
        }
      }
    }
  }
  
  // Move files if enabled (before removing from tracking)
  if (filesToMove.length > 0 && userSettings.moveMatchedFiles && userSettings.matchedFilesFolder) {
    console.log('Attempting to move files:', filesToMove);
    try {
      const moveResult = await moveMatchedFiles(filesToMove);
      console.log('Move result:', moveResult);
      
      // Process move results - some files may have moved successfully while others failed
      if (moveResult.success) {
        console.log('Move successful, removing all from tracking');
        // Remove matched files from tracking
        downloadedFiles.funscripts = downloadedFiles.funscripts.filter(
          f => !matchedFunscriptIds.includes(f.id)
        );
        downloadedFiles.videos = downloadedFiles.videos.filter(
          v => !matchedVideoIds.includes(v.id)
        );
        
        // Notify popup to refresh (if it's open)
        try {
          browser.runtime.sendMessage({
            action: 'files_moved',
            movedFiles: moveResult.moved,
            destination: moveResult.destination
          }).catch(() => {
            // Popup might not be open, that's fine
          });
        } catch (e) {
          // Popup might not be open, that's fine
        }
      } else if (moveResult.moved && moveResult.moved.length > 0) {
        // Partial success - only remove successfully moved files
        console.log('Partial move success, removing only moved files from tracking');
        const movedPaths = moveResult.moved.map(m => m.original);
        
        downloadedFiles.funscripts = downloadedFiles.funscripts.filter(f => {
          if (matchedFunscriptIds.includes(f.id) && movedPaths.includes(f.path)) {
            return false; // Remove this file from tracking
          }
          return true; // Keep in tracking
        });
        
        downloadedFiles.videos = downloadedFiles.videos.filter(v => {
          if (matchedVideoIds.includes(v.id) && movedPaths.includes(v.path)) {
            return false; // Remove this file from tracking
          }
          return true; // Keep in tracking
        });
        
        // Log failed files but don't schedule retry - rely on download completion events
        if (moveResult.errors && moveResult.errors.length > 0) {
          console.log('Some files failed to move, will retry when downloads complete:', moveResult.errors);
        }
        
        // Notify popup to refresh even for partial moves
        try {
          browser.runtime.sendMessage({
            action: 'files_moved',
            movedFiles: moveResult.moved,
            destination: moveResult.destination,
            partial: true
          }).catch(() => {
            // Popup might not be open, that's fine
          });
        } catch (e) {
          // Popup might not be open, that's fine
        }
      } else {
        console.log('Move completely failed, keeping all files in tracking:', moveResult.error || moveResult.errors);
        console.log('Will retry when downloads complete');
      }
    } catch (error) {
      console.error('Error moving files:', error);
    }
  } else {
    // No move configured, just remove from tracking (original behavior)
    downloadedFiles.funscripts = downloadedFiles.funscripts.filter(
      f => !matchedFunscriptIds.includes(f.id)
    );
    downloadedFiles.videos = downloadedFiles.videos.filter(
      v => !matchedVideoIds.includes(v.id)
    );
  }
  
  // Save to storage
  saveToStorage();
  
  // Update badge
  updateBadge();
}

// Move matched files to designated folder
async function moveMatchedFiles(files) {
  console.log('moveMatchedFiles called with:', files);
  console.log('Matched folder setting:', userSettings.matchedFilesFolder);
  
  if (!nativePort) {
    connectNativeHost();
  }
  
  if (nativePort && userSettings.matchedFilesFolder) {
    return new Promise((resolve) => {
      const requestId = `move_${Date.now()}`;
      
      const responseHandler = (message) => {
        if (message.response_to === requestId) {
          nativePort.onMessage.removeListener(responseHandler);
          console.log('Move files response:', message);
          
          if (message.success) {
            if (userSettings.showNotifications) {
              browser.notifications.create({
                type: 'basic',
                iconUrl: browser.extension.getURL('icon-48.png'),
                title: 'Files Moved',
                message: `Moved ${message.moved ? message.moved.length : files.length} matched files to ${userSettings.matchedFilesFolder}`
              });
            }
          } else {
            console.error('Failed to move files:', message.error, message.errors);
          }
          
          resolve(message);
        }
      };
      
      nativePort.onMessage.addListener(responseHandler);
      
      nativePort.postMessage({
        action: 'move_files',
        files: files,
        destination: userSettings.matchedFilesFolder,
        organizeInSubfolders: userSettings.organizeInSubfolders,
        id: requestId
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        nativePort.onMessage.removeListener(responseHandler);
        resolve({ success: false, error: 'Move timeout' });
      }, 10000);
    });
  }
  
  return Promise.resolve({ success: false, error: 'Native host not connected or folder not set' });
}

function saveToStorage() {
  browser.storage.local.set({ downloadedFiles, watchedDirectories: Array.from(watchedDirectories) });
}

function loadFromStorage() {
  return browser.storage.local.get(['downloadedFiles', 'watchedDirectories', 'autoRemoveMatches', 'showNotifications', 'moveMatchedFiles', 'organizeInSubfolders', 'matchedFilesFolder']).then(result => {
    console.log('Loading settings from storage:', result);
    
    if (result.downloadedFiles) {
      downloadedFiles = result.downloadedFiles;
    }
    if (result.watchedDirectories) {
      watchedDirectories = new Set(result.watchedDirectories);
      // Don't try to reconnect here - will be done after native host connects
    }
    if (result.autoRemoveMatches !== undefined) {
      userSettings.autoRemoveMatches = result.autoRemoveMatches;
    }
    if (result.showNotifications !== undefined) {
      userSettings.showNotifications = result.showNotifications;
    }
    if (result.moveMatchedFiles !== undefined) {
      userSettings.moveMatchedFiles = result.moveMatchedFiles;
    }
    if (result.organizeInSubfolders !== undefined) {
      userSettings.organizeInSubfolders = result.organizeInSubfolders;
    }
    if (result.matchedFilesFolder !== undefined) {
      userSettings.matchedFilesFolder = result.matchedFilesFolder;
    }
    
    console.log('Final userSettings after loading:', userSettings);
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
      
      // Skip temporary files
      if (isTemporaryFile(filename)) {
        console.log('Skipping temporary file:', filename);
        return;
      }
      
      if (isFunscriptFile(filename)) {
        // Check if file exists and has content before adding to tracking
        if (!nativePort) {
          console.log('Native host not available for file size check');
          return;
        }
        
        // Request file size check from native host
        const sizeCheckId = `size_check_${Date.now()}`;
        const sizeCheckHandler = (message) => {
          if (message.response_to === sizeCheckId) {
            nativePort.onMessage.removeListener(sizeCheckHandler);
            
            if (message.success && message.size > 0) {
              // File has content, safe to add to tracking
              const exists = downloadedFiles.funscripts.some(f => 
                f.path === notification.path || (f.filename === filename && Math.abs((f.timestamp || 0) - (notification.timestamp || Date.now())) < 5000)
              );
              
              if (!exists) {
                downloadedFiles.funscripts.push({
                  id: Date.now() + Math.random(),
                  filename: filename,
                  path: notification.path,
                  nativeDetected: true,
                  timestamp: notification.timestamp || Date.now(),
                  fileSize: message.size
                });
                saveToStorage();
                if (userSettings.autoRemoveMatches) {
                  checkAndRemoveMatches();
                }
                
                // Show browser notification
                if (userSettings.showNotifications) {
                  browser.notifications.create({
                    type: 'basic',
                    iconUrl: browser.extension.getURL('icon-48.png'),
                    title: 'New Funscript Detected',
                    message: `Found: ${filename} (${Math.round(message.size/1024)}KB)`
                  });
                }
              }
            } else {
              console.log(`Skipping ${filename}: file is empty or doesn't exist (${message.size || 0} bytes)`);
            }
          }
        };
        
        nativePort.onMessage.addListener(sizeCheckHandler);
        nativePort.postMessage({
          action: 'get_file_size',
          path: notification.path,
          id: sizeCheckId
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          nativePort.onMessage.removeListener(sizeCheckHandler);
        }, 5000);
      } else if (isVideoFile(filename)) {
        // Check if file exists and has content before adding to tracking
        if (!nativePort) {
          console.log('Native host not available for file size check');
          return;
        }
        
        // Request file size check from native host
        const sizeCheckId = `size_check_${Date.now()}`;
        const sizeCheckHandler = (message) => {
          if (message.response_to === sizeCheckId) {
            nativePort.onMessage.removeListener(sizeCheckHandler);
            
            if (message.success && message.size > 0) {
              // File has content, safe to add to tracking
              const exists = downloadedFiles.videos.some(v => 
                v.path === notification.path || (v.filename === filename && Math.abs((v.timestamp || 0) - (notification.timestamp || Date.now())) < 5000)
              );
              
              if (!exists) {
                downloadedFiles.videos.push({
                  id: Date.now() + Math.random(),
                  filename: filename,
                  path: notification.path,
                  nativeDetected: true,
                  timestamp: notification.timestamp || Date.now(),
                  fileSize: message.size
                });
                saveToStorage();
                if (userSettings.autoRemoveMatches) {
                  checkAndRemoveMatches();
                }
                
                // Show browser notification
                if (userSettings.showNotifications) {
                  browser.notifications.create({
                    type: 'basic',
                    iconUrl: browser.extension.getURL('icon-48.png'),
                    title: 'New Video Detected',
                    message: `Found: ${filename} (${Math.round(message.size/1024/1024)}MB)`
                  });
                }
              }
            } else {
              console.log(`Skipping ${filename}: file is empty or doesn't exist (${message.size || 0} bytes)`);
            }
          }
        };
        
        nativePort.onMessage.addListener(sizeCheckHandler);
        nativePort.postMessage({
          action: 'get_file_size',
          path: notification.path,
          id: sizeCheckId
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          nativePort.onMessage.removeListener(sizeCheckHandler);
        }, 5000);
      }
      break;
      
    case 'file_deleted':
      // A file was deleted from a watched directory
      const deletedFilename = notification.filename;
      
      // Check if this is a .part file being deleted (indicates download completion)
      if (deletedFilename.endsWith('.part')) {
        // Extract the base filename (remove .part and any random suffix Firefox adds)
        // Firefox uses patterns like: filename.mp4.XYZ123.part
        const baseNameMatch = deletedFilename.match(/^(.+\.(mp4|avi|mkv|webm|mov|wmv|flv|m4v|mpg|mpeg))\.[\w]+\.part$/i);
        if (baseNameMatch) {
          const expectedFilename = baseNameMatch[1];
          console.log(`Download completing: ${deletedFilename} -> ${expectedFilename}`);
          
          // Mark any existing video with this name as "recently completed"
          // This helps us know it's safe to move
          downloadedFiles.videos.forEach(v => {
            if (v.filename.toLowerCase() === expectedFilename.toLowerCase()) {
              v.downloadCompleted = Date.now();
              console.log(`Marked ${v.filename} as download completed`);
            }
          });
          
          // Schedule a match check in a few seconds to allow file to stabilize
          setTimeout(() => {
            console.log('Checking matches after download completion');
            checkAndRemoveMatches();
          }, 3000);
        }
        return;
      }
      
      // Skip other temporary files
      if (isTemporaryFile(deletedFilename)) {
        console.log('Skipping temporary file deletion:', deletedFilename);
        return;
      }
      
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
            
            saveToStorage();
            
            // Check for matches (including existing ones that should be moved)
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

// Listen for download creation (when download starts)
browser.downloads.onCreated.addListener((downloadItem) => {
  const filename = downloadItem.filename.split('/').pop() || downloadItem.filename.split('\\').pop();
  
  // Skip temporary files
  if (isTemporaryFile(filename)) {
    console.log('Skipping temporary download start:', filename);
    return;
  }
  
  // Track downloads of interest
  if (isFunscriptFile(filename) || isVideoFile(filename)) {
    const type = isFunscriptFile(filename) ? 'funscript' : 'video';
    downloadsInProgress.set(downloadItem.id, {
      filename: filename,
      fullPath: downloadItem.filename,
      startTime: Date.now(),
      type: type,
      state: 'in_progress'
    });
    
    console.log(`Download started: ${filename} (${type}) - ID: ${downloadItem.id}`);
    
    // Extract directory and watch it
    const fullPath = downloadItem.filename;
    const lastSeparator = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
    const directory = fullPath.substring(0, lastSeparator);
    watchDirectory(directory);
    
    // Show notification for download start
    if (userSettings.showNotifications) {
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.extension.getURL('icon-48.png'),
        title: `${type === 'funscript' ? 'Funscript' : 'Video'} Download Started`,
        message: `Downloading: ${filename}`
      });
    }
  }
});

// Listen for download completion
browser.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state && downloadDelta.state.current === 'complete') {
    // Check if we were tracking this download
    const downloadInfo = downloadsInProgress.get(downloadDelta.id);
    
    browser.downloads.search({ id: downloadDelta.id }).then(async downloads => {
      if (downloads.length > 0) {
        const download = downloads[0];
        const filename = download.filename.split('/').pop() || download.filename.split('\\').pop();
        
        // Calculate download duration if we tracked the start
        let downloadDuration = 0;
        if (downloadInfo) {
          downloadDuration = Date.now() - downloadInfo.startTime;
          console.log(`Download completed: ${filename} (took ${Math.round(downloadDuration/1000)}s) - ID: ${downloadDelta.id}`);
        } else {
          console.log(`Download completed (not tracked): ${filename} - ID: ${downloadDelta.id}`);
        }
        
        // Get tab information for better matching
        let tabTitle = 'Unknown';
        let tabUrl = '';
        
        try {
          // Try to get tab info from the download
          const tabs = await browser.tabs.query({ active: true, currentWindow: true });
          if (tabs.length > 0) {
            tabTitle = tabs[0].title || 'Unknown';
            tabUrl = tabs[0].url || '';
          }
          
          // If we have a referrer, try to find the specific tab
          if (download.referrer) {
            try {
              const referrerTabs = await browser.tabs.query({ url: download.referrer });
              if (referrerTabs.length > 0) {
                tabTitle = referrerTabs[0].title || tabTitle;
                tabUrl = referrerTabs[0].url || tabUrl;
              }
            } catch (e) {
              console.log('Could not find referrer tab:', e);
            }
          }
        } catch (e) {
          console.log('Could not get tab info:', e);
        }
        
        // Extract directory and watch it
        const fullPath = download.filename;
        const lastSeparator = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
        const directory = fullPath.substring(0, lastSeparator);
        
        // Watch the download directory
        watchDirectory(directory);
        
        // Skip temporary files
        if (isTemporaryFile(filename)) {
          console.log('Skipping temporary download file:', filename);
          // Remove from tracking
          if (downloadInfo) {
            downloadsInProgress.delete(downloadDelta.id);
          }
          return;
        }
        
        if (isFunscriptFile(filename)) {
          // Check if file already exists (avoid duplicates)
          const exists = downloadedFiles.funscripts.some(f => 
            f.path === download.filename || (f.filename === filename && Math.abs(f.timestamp - Date.now()) < 5000)
          );
          
          if (!exists) {
            const fileData = {
              id: download.id,
              filename: filename,
              url: download.url,
              path: download.filename,
              tabTitle: tabTitle,
              tabUrl: tabUrl,
              timestamp: Date.now(),
              downloadCompleted: Date.now(), // Mark as officially downloaded
              downloadDuration: downloadDuration
            };
            
            downloadedFiles.funscripts.push(fileData);
            saveToStorage();
            
            // Show completion notification
            if (userSettings.showNotifications) {
              browser.notifications.create({
                type: 'basic',
                iconUrl: browser.extension.getURL('icon-48.png'),
                title: 'Funscript Download Complete',
                message: `Ready for matching: ${filename}`
              });
            }
            
            // Check for matches immediately - file is ready
            checkAndRemoveMatches();
          }
        } else if (isVideoFile(filename)) {
          // Check if file already exists (avoid duplicates)
          const exists = downloadedFiles.videos.some(v => 
            v.path === download.filename || (v.filename === filename && Math.abs(v.timestamp - Date.now()) < 5000)
          );
          
          if (!exists) {
            const fileData = {
              id: download.id,
              filename: filename,
              url: download.url,
              path: download.filename,
              tabTitle: tabTitle,
              tabUrl: tabUrl,
              timestamp: Date.now(),
              downloadCompleted: Date.now(), // Mark as officially downloaded
              downloadDuration: downloadDuration
            };
            
            downloadedFiles.videos.push(fileData);
            saveToStorage();
            
            // Show completion notification
            if (userSettings.showNotifications) {
              browser.notifications.create({
                type: 'basic',
                iconUrl: browser.extension.getURL('icon-48.png'),
                title: 'Video Download Complete',
                message: `Ready for matching: ${filename}`
              });
            }
            
            // Check for matches immediately - file is ready
            checkAndRemoveMatches();
          }
        }
        
        // Clean up tracking for completed download
        if (downloadInfo) {
          downloadsInProgress.delete(downloadDelta.id);
        }
      }
    });
  }
  
  // Handle download failures and interruptions
  if (downloadDelta.state && (downloadDelta.state.current === 'interrupted' || downloadDelta.state.current === 'cancelled')) {
    const downloadInfo = downloadsInProgress.get(downloadDelta.id);
    if (downloadInfo) {
      console.log(`Download ${downloadInfo.filename} was ${downloadDelta.state.current}`);
      downloadsInProgress.delete(downloadDelta.id);
    }
  }
});

// Handle messages from popup
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getFiles') {
    // Include download progress information
    const response = {
      ...downloadedFiles,
      downloadsInProgress: Array.from(downloadsInProgress.entries()).map(([id, info]) => ({
        id,
        ...info,
        elapsed: Date.now() - info.startTime
      }))
    };
    sendResponse(response);
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
  } else if (request.action === 'browseFolder') {
    // Browse for folder using native host
    if (!nativePort) {
      connectNativeHost();
    }
    
    if (nativePort) {
      const browseId = `browse_${Date.now()}`;
      
      // Set up one-time listener for the response
      const responseHandler = (message) => {
        if (message.response_to === browseId) {
          nativePort.onMessage.removeListener(responseHandler);
          if (message.success && message.path) {
            // Check if this is for matched folder based on request context
            if (request.isMatchedFolder) {
              // Save matched folder directly in background
              userSettings.matchedFilesFolder = message.path;
              browser.storage.local.set({ matchedFilesFolder: message.path });
              console.log('Saved matched folder to settings:', message.path);
            } else if (request.isWatchedFolder) {
              // Add to watched folders directly in background
              if (!watchedDirectories.has(message.path)) {
                watchDirectory(message.path);
                console.log('Added watched folder:', message.path);
              }
            }
            sendResponse({ success: true, path: message.path });
          } else {
            sendResponse({ success: false, error: message.error || 'Folder selection cancelled' });
          }
        }
      };
      
      nativePort.onMessage.addListener(responseHandler);
      
      nativePort.postMessage({
        action: 'selectFolder',
        id: browseId
      });
      
      // Timeout after 30 seconds (folder dialogs can take time)
      setTimeout(() => {
        nativePort.onMessage.removeListener(responseHandler);
        sendResponse({ success: false, error: 'Folder selection timeout' });
      }, 30000);
      
      return true; // Keep channel open for async response
    } else {
      sendResponse({ success: false, error: 'Native host not connected' });
    }
  } else if (request.action === 'updateSettings') {
    // Update user settings
    if (request.settings) {
      console.log('Updating settings:', request.settings);
      Object.assign(userSettings, request.settings);
      browser.storage.local.set(request.settings);
      console.log('New userSettings after update:', userSettings);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No settings provided' });
    }
  } else if (request.action === 'setMatchedFolder') {
    // Set the matched files folder
    console.log('Setting matched folder to:', request.folder);
    userSettings.matchedFilesFolder = request.folder;
    browser.storage.local.set({ matchedFilesFolder: request.folder });
    console.log('Updated userSettings after folder set:', userSettings);
    sendResponse({ success: true });
  } else if (request.action === 'getSettings') {
    // Return current settings
    sendResponse({ success: true, settings: userSettings });
  } else if (request.action === 'getExistingFolders') {
    // Get existing matched folders from the base folder
    if (!nativePort) {
      connectNativeHost();
    }
    
    if (nativePort) {
      const foldersId = `folders_${Date.now()}`;
      
      const responseHandler = (message) => {
        if (message.response_to === foldersId) {
          nativePort.onMessage.removeListener(responseHandler);
          sendResponse(message);
        }
      };
      
      nativePort.onMessage.addListener(responseHandler);
      
      nativePort.postMessage({
        action: 'list_folders',
        baseFolder: request.baseFolder,
        id: foldersId
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        nativePort.onMessage.removeListener(responseHandler);
        sendResponse({ success: false, error: 'Timeout getting folders' });
      }, 10000);
      
      return true; // Keep channel open for async response
    } else {
      sendResponse({ success: false, error: 'Native host not connected' });
    }
  } else if (request.action === 'moveFileToFolder') {
    // Move a single file to a specific folder (for variants)
    if (!nativePort) {
      connectNativeHost();
    }
    
    if (nativePort) {
      const moveId = `move_single_${Date.now()}`;
      
      const responseHandler = (message) => {
        if (message.response_to === moveId) {
          nativePort.onMessage.removeListener(responseHandler);
          sendResponse(message);
        }
      };
      
      nativePort.onMessage.addListener(responseHandler);
      
      nativePort.postMessage({
        action: 'move_single_file',
        file: request.file,
        destinationFolder: request.destinationFolder,
        id: moveId
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        nativePort.onMessage.removeListener(responseHandler);
        sendResponse({ success: false, error: 'Timeout moving file' });
      }, 10000);
      
      return true; // Keep channel open for async response
    } else {
      sendResponse({ success: false, error: 'Native host not connected' });
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
          // Only handle if this is the response to our specific request
          if (message.response_to === requestId) {
            console.log('Response matches request ID, processing...');
            nativePort.onMessage.removeListener(responseHandler);
            
            if (message.success) {
              // Update our internal record
              file.filename = newName;
              file.renamed = true;
              file.originalName = originalName;
              
              // Update the path to reflect the new name
              if (file.path) {
                const pathParts = file.path.split(/[/\\]/);
                pathParts[pathParts.length - 1] = newName;
                file.path = pathParts.join(file.path.includes('\\') ? '\\' : '/');
              }
              
              saveToStorage();
              
              // Now check for matches after rename (wait for it to complete)
              checkAndRemoveMatches().then(() => {
                console.log('Match check completed after rename');
              });
              
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
  if (connectNativeHost()) {
    // Re-establish watches for previously watched directories
    watchedDirectories.forEach(dir => {
      if (nativePort) {
        nativePort.postMessage({
          action: 'watch',
          directory: dir,
          id: `watch_${Date.now()}`
        });
      }
    });
  }
});
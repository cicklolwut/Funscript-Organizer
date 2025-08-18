console.log('Popup script loaded');

// Apply saved theme immediately
(function() {
  try {
    // Apply saved theme mode
    const savedTheme = localStorage.getItem('themeMode');
    if (savedTheme && savedTheme !== 'auto') {
      document.documentElement.classList.add(`theme-${savedTheme}`);
    }
  } catch (error) {
    console.log('Error applying initial theme:', error);
  }
})();

let currentRenameBase = null;
let currentRenameType = null;
let currentRenameGroup = null;
let editedBaseName = null;
let currentGroupBase = null;
let selectedGroupFiles = [];
let editedGroupBaseName = null;
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
  
  // Group funscripts by base name
  const funscriptGroups = {};
  files.funscripts.forEach(file => {
    const baseName = getBaseName(file.filename);
    if (!funscriptGroups[baseName]) {
      funscriptGroups[baseName] = [];
    }
    funscriptGroups[baseName].push(file);
  });
  
  // Display funscript files (grouped if multiple with same base)
  if (files.funscripts.length === 0) {
    funscriptList.innerHTML = '<div class="empty-message">No unmatched funscript files</div>';
  } else {
    Object.entries(funscriptGroups).forEach(([baseName, groupFiles]) => {
      if (groupFiles.length > 1) {
        // Create grouped display
        const groupContainer = createFunscriptGroup(baseName, groupFiles);
        funscriptList.appendChild(groupContainer);
      } else {
        // Single file, display normally
        const fileItem = createFileItem(groupFiles[0], 'funscript');
        funscriptList.appendChild(fileItem);
      }
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

function createFunscriptGroup(baseName, files) {
  const groupDiv = document.createElement('div');
  groupDiv.className = 'funscript-group';
  groupDiv.dataset.baseName = baseName;
  
  // Create header
  const header = document.createElement('div');
  header.className = 'funscript-group-header';
  
  const nameDiv = document.createElement('div');
  nameDiv.className = 'file-name';
  nameDiv.textContent = baseName + '.funscript (group)';
  nameDiv.title = `${files.length} related funscript files`;
  
  const countBadge = document.createElement('span');
  countBadge.className = 'funscript-group-count';
  countBadge.textContent = files.length;
  
  // Create hover buttons for the group
  const hoverButtons = document.createElement('div');
  hoverButtons.className = 'hover-buttons';
  
  // X button (remove all)
  const removeBtn = document.createElement('button');
  removeBtn.className = 'hover-btn remove';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove all from list';
  removeBtn.onclick = (e) => {
    e.stopPropagation();
    files.forEach(file => removeFile(file.id, 'funscript'));
  };
  
  // Arrow button (rename all)
  const renameBtn = document.createElement('button');
  renameBtn.className = 'hover-btn rename arrow-right';
  renameBtn.title = 'Start rename with this group';
  renameBtn.onclick = (e) => {
    e.stopPropagation();
    // Use the first file as representative for the group
    startRenameMode(files[0], 'funscript', files);
  };
  
  // + button (add more files to group)
  const addBtn = document.createElement('button');
  addBtn.className = 'hover-btn group';
  addBtn.textContent = '+';
  addBtn.title = 'Add more funscripts to this group';
  addBtn.onclick = (e) => {
    e.stopPropagation();
    // Use the first file as representative, pass existing group
    startAddToGroupMode(files[0], files);
  };
  
  hoverButtons.appendChild(removeBtn);
  hoverButtons.appendChild(addBtn);
  hoverButtons.appendChild(renameBtn);
  
  header.appendChild(nameDiv);
  header.appendChild(countBadge);
  header.appendChild(hoverButtons);
  
  // Create items container
  const itemsContainer = document.createElement('div');
  itemsContainer.className = 'funscript-group-items';
  itemsContainer.style.display = 'none'; // Initially collapsed
  
  // Add individual files
  files.forEach(file => {
    const fileDiv = document.createElement('div');
    fileDiv.className = 'file-item';
    fileDiv.textContent = file.filename;
    fileDiv.title = file.filename;
    itemsContainer.appendChild(fileDiv);
  });
  
  // Toggle expand/collapse on header click
  header.onclick = (e) => {
    if (e.target.closest('.hover-buttons')) return;
    itemsContainer.style.display = itemsContainer.style.display === 'none' ? 'block' : 'none';
  };
  
  groupDiv.appendChild(header);
  groupDiv.appendChild(itemsContainer);
  
  return groupDiv;
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
  
  // Add group button only for funscripts
  if (type === 'funscript') {
    const groupBtn = document.createElement('button');
    groupBtn.className = 'hover-btn group';
    groupBtn.textContent = '+';
    groupBtn.title = 'Group with other funscripts';
    groupBtn.onclick = (e) => {
      console.log('Group button clicked', file.filename);
      e.stopPropagation();
      startGroupMode(file);
    };
    hoverButtons.appendChild(groupBtn);
  }
  
  hoverButtons.appendChild(renameBtn);
  
  div.appendChild(nameDiv);
  div.appendChild(hoverButtons);
  
  return div;
}

function startRenameMode(file, type, groupFiles = null) {
  currentRenameBase = file;
  currentRenameType = type;
  currentRenameGroup = groupFiles; // Store the group if provided
  editedBaseName = null; // Reset edited base name for new rename session
  
  // Hide normal view, show rename view
  document.getElementById('normal-view').classList.add('hidden');
  document.getElementById('rename-view').classList.remove('hidden');
  
  // Hide header elements to save space
  const title = document.querySelector('h2');
  const stats = document.querySelector('.stats');
  if (title) title.style.display = 'none';
  if (stats) stats.style.display = 'none';
  
  // Set the base name display
  const baseName = getBaseNameForRename(file.filename);
  document.getElementById('rename-base-name').textContent = `Base name: ${baseName}`;
  
  // Update the column title and show/hide variant checkbox
  const columnTitle = type === 'funscript' ? 'Video Files' : 'Funscript Files';
  document.getElementById('rename-column-title').textContent = columnTitle;
  
  // Show "Is Variant" checkbox only for funscripts when subfolder organization is enabled
  const isVariantLabel = document.getElementById('is-variant-label');
  const isVariantCheckbox = document.getElementById('is-variant-checkbox');
  
  browser.storage.local.get(['organizeInSubfolders']).then(result => {
    const showVariantOption = type === 'funscript' && result.organizeInSubfolders === true;
    if (isVariantLabel) {
      isVariantLabel.style.display = showVariantOption ? 'flex' : 'none';
    }
    if (isVariantCheckbox) {
      isVariantCheckbox.checked = false; // Always start unchecked
    }
  });
  
  // Populate the rename list initially with normal matching
  populateRenameList(false);
}

function populateRenameList(isVariant) {
  const renameList = document.getElementById('rename-list');
  const columnTitle = document.getElementById('rename-column-title');
  renameList.innerHTML = '';
  
  if (isVariant && currentRenameType === 'funscript') {
    // Show existing matched folders instead of videos
    columnTitle.textContent = 'Existing Matches';
    
    // Get existing matched folders from the matched files folder
    browser.storage.local.get(['matchedFilesFolder']).then(result => {
      if (!result.matchedFilesFolder) {
        renameList.innerHTML = '<div class="empty-message">No matched files folder set</div>';
        return;
      }
      
      // Request list of existing folders from native host
      browser.runtime.sendMessage({
        action: 'getExistingFolders',
        baseFolder: result.matchedFilesFolder
      }).then(response => {
        if (response.success && response.folders && response.folders.length > 0) {
          // Calculate probabilities for each folder based on the funscript base name
          const baseName = getBaseNameForRename(currentRenameBase.filename);
          const foldersWithProbability = response.folders.map(folder => ({
            folder: folder,
            probability: calculateFolderMatchProbability(baseName, folder.name)
          }));
          
          // Sort by probability (highest first)
          foldersWithProbability.sort((a, b) => b.probability - a.probability);
          
          // Create folder items
          foldersWithProbability.forEach(({ folder }) => {
            const folderItem = createVariantFolderItem(folder, baseName);
            renameList.appendChild(folderItem);
          });
        } else {
          renameList.innerHTML = '<div class="empty-message">No existing matched folders found</div>';
        }
      }).catch(error => {
        console.error('Error getting existing folders:', error);
        renameList.innerHTML = '<div class="empty-message">Error loading folders</div>';
      });
    });
  } else {
    // Normal matching - show opposite type files
    const targetFiles = currentRenameType === 'funscript' ? currentFiles.videos : currentFiles.funscripts;
    const targetType = currentRenameType === 'funscript' ? 'video' : 'funscript';
    const columnTitleText = currentRenameType === 'funscript' ? 'Video Files' : 'Funscript Files';
    
    columnTitle.textContent = columnTitleText;
    
    if (targetFiles.length === 0) {
      renameList.innerHTML = `<div class="empty-message">No ${targetType} files to rename</div>`;
    } else {
      const baseName = getBaseNameForRename(currentRenameBase.filename);
      
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
}

function calculateFolderMatchProbability(funscriptBaseName, folderName) {
  // Simple string similarity for folder matching
  const cleaned1 = funscriptBaseName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleaned2 = folderName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (cleaned1 === cleaned2) return 100;
  if (cleaned1.includes(cleaned2) || cleaned2.includes(cleaned1)) return 80;
  
  // Check for partial matches
  const words1 = cleaned1.split(/\s+/);
  const words2 = cleaned2.split(/\s+/);
  let matchCount = 0;
  
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 && word1.length > 2) {
        matchCount++;
      }
    }
  }
  
  if (matchCount > 0) {
    return Math.min(70, matchCount * 20);
  }
  
  return 0;
}

function createVariantFolderItem(folder, baseName) {
  const div = document.createElement('div');
  div.className = 'file-item folder-item';
  div.dataset.folderPath = folder.path;
  div.dataset.folderName = folder.name;
  
  // Calculate match probability for display
  const probability = calculateFolderMatchProbability(baseName, folder.name);
  
  const content = document.createElement('div');
  content.className = 'file-content';
  
  const nameDiv = document.createElement('div');
  nameDiv.className = 'file-name';
  nameDiv.textContent = folder.name;
  
  const pathDiv = document.createElement('div');
  pathDiv.className = 'file-path';
  pathDiv.textContent = folder.path;
  
  const probDiv = document.createElement('div');
  probDiv.className = 'match-probability';
  probDiv.textContent = `${probability}%`;
  
  content.appendChild(nameDiv);
  content.appendChild(pathDiv);
  
  div.appendChild(content);
  div.appendChild(probDiv);
  
  // Add click handler for variant selection
  div.addEventListener('click', () => handleVariantSelection(folder));
  
  return div;
}

function handleVariantSelection(folder) {
  if (!currentRenameBase) {
    console.error('No current rename base file selected');
    return;
  }
  
  // Store filename before operation in case currentRenameBase gets cleared
  const originalFilename = currentRenameBase.filename;
  const originalId = currentRenameBase.id;
  
  // Move the funscript to the selected folder without renaming
  browser.runtime.sendMessage({
    action: 'moveFileToFolder',
    file: {
      path: currentRenameBase.path,
      filename: currentRenameBase.filename
    },
    destinationFolder: folder.path
  }).then(response => {
    if (response.success) {
      // Remove the funscript from the background script's tracking
      browser.runtime.sendMessage({
        action: 'removeFile',
        type: 'funscript',
        id: originalId
      }).then(() => {
        // Return to normal view (this will refresh the list)
        cancelRenameMode();
        
        // Show success message
        alert(`${originalFilename} added to ${folder.name}`);
      });
    } else {
      alert(`Failed to move variant: ${response.error}`);
    }
  }).catch(error => {
    console.error('Error moving variant:', error);
    alert('Error moving variant file');
  });
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

async function performRename(file, type, baseName) {
  // Use edited base name if available, otherwise use the original base name
  const finalBaseName = editedBaseName || baseName;
  
  // Check if we're renaming a group of files
  if (currentRenameGroup && currentRenameGroup.length > 0) {
    // When we have a group, we need to rename ALL files including the source
    // First, build the list of all files to rename (group + source if not already in group)
    const allFilesToRename = [...currentRenameGroup];
    
    // Check if the source file is already in the group
    const sourceInGroup = currentRenameGroup.some(f => f.id === currentRenameBase.id);
    if (!sourceInGroup) {
      allFilesToRename.push(currentRenameBase);
    }
    
    // Rename all files in the group
    const renamePromises = allFilesToRename.map(groupFile => {
      const extension = getFileExtension(groupFile.filename);
      const newName = finalBaseName + extension;
      
      return browser.runtime.sendMessage({
        action: 'renameFile',
        fileId: groupFile.id,
        type: currentRenameType,  // Use the correct type for each file
        newName: newName,
        originalName: groupFile.filename
      });
    });
    
    // Also rename the target file
    const targetExtension = getFileExtension(file.filename);
    const targetNewName = finalBaseName + targetExtension;
    renamePromises.push(
      browser.runtime.sendMessage({
        action: 'renameFile',
        fileId: file.id,
        type: type,
        newName: targetNewName,
        originalName: file.filename
      })
    );
    
    // Wait for all renames to complete
    const results = await Promise.all(renamePromises);
    const allSuccess = results.every(r => r.success);
    
    if (allSuccess) {
      // Back out to normal view and reload files
      setTimeout(() => {
        cancelRenameMode();
        loadFiles();
      }, 1000);
    } else {
      const errors = results.filter(r => !r.success).map(r => r.error || 'Unknown error');
      alert(`Some files failed to rename:\n${errors.join('\n')}`);
    }
  } else {
    // Single file rename (original behavior)
    const extension = getFileExtension(file.filename);
    const newName = finalBaseName + extension;
    
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
}

function cancelRenameMode() {
  currentRenameBase = null;
  currentRenameType = null;
  currentRenameGroup = null;
  editedBaseName = null;
  
  // Show normal view, hide rename view
  document.getElementById('normal-view').classList.remove('hidden');
  document.getElementById('rename-view').classList.add('hidden');
  
  // Show header elements again
  const title = document.querySelector('h2');
  const stats = document.querySelector('.stats');
  if (title) title.style.display = '';
  if (stats) stats.style.display = '';
  
  // Refresh the file list
  loadFiles();
}

function startGroupMode(sourceFile) {
  currentGroupBase = sourceFile;
  selectedGroupFiles = [sourceFile]; // Start with the source file selected
  editedGroupBaseName = null;
  
  // Hide normal view, show group view
  document.getElementById('normal-view').classList.add('hidden');
  document.getElementById('group-view').classList.remove('hidden');
  
  // Hide header elements to save space
  const title = document.querySelector('h2');
  const stats = document.querySelector('.stats');
  if (title) title.style.display = 'none';
  if (stats) stats.style.display = 'none';
  
  // Set the base name display
  const baseName = getBaseNameForRename(sourceFile.filename);
  document.getElementById('group-base-name').textContent = `Base name: ${baseName}`;
  
  // Populate the group list with all funscripts
  const groupList = document.getElementById('group-list');
  groupList.innerHTML = '';
  
  if (currentFiles.funscripts.length === 0) {
    groupList.innerHTML = '<div class="empty-message">No funscripts available</div>';
  } else {
    // Calculate probabilities and sort by highest probability first
    const filesWithProbability = currentFiles.funscripts.map(funscript => ({
      file: funscript,
      probability: calculateMatchProbability(sourceFile, funscript)
    }));
    
    // Sort by probability (highest first)
    filesWithProbability.sort((a, b) => b.probability - a.probability);
    
    // Create file items in sorted order
    filesWithProbability.forEach(({ file: funscript }) => {
      const fileItem = createGroupFileItem(funscript, funscript.id === sourceFile.id);
      groupList.appendChild(fileItem);
    });
  }
}

function startAddToGroupMode(sourceFile, existingGroup) {
  currentGroupBase = sourceFile;
  selectedGroupFiles = [...existingGroup]; // Start with existing group selected
  editedGroupBaseName = null;
  
  // Hide normal view, show group view
  document.getElementById('normal-view').classList.add('hidden');
  document.getElementById('group-view').classList.remove('hidden');
  
  // Hide header elements to save space
  const title = document.querySelector('h2');
  const stats = document.querySelector('.stats');
  if (title) title.style.display = 'none';
  if (stats) stats.style.display = 'none';
  
  // Set the base name display
  const baseName = getBaseNameForRename(sourceFile.filename);
  document.getElementById('group-base-name').textContent = `Base name: ${baseName}`;
  
  // Update the heading to indicate we're adding to existing group
  const heading = document.querySelector('.group-column h3');
  if (heading) {
    heading.textContent = `Add funscripts to existing group (${existingGroup.length} selected)`;
  }
  
  // Populate the group list with all funscripts
  const groupList = document.getElementById('group-list');
  groupList.innerHTML = '';
  
  if (currentFiles.funscripts.length === 0) {
    groupList.innerHTML = '<div class="empty-message">No funscripts available</div>';
  } else {
    // Calculate probabilities and sort by highest probability first
    const filesWithProbability = currentFiles.funscripts.map(funscript => ({
      file: funscript,
      probability: calculateMatchProbability(sourceFile, funscript)
    }));
    
    // Sort by probability (highest first)
    filesWithProbability.sort((a, b) => b.probability - a.probability);
    
    // Create file items in sorted order
    filesWithProbability.forEach(({ file: funscript }) => {
      // Check if this file is in the existing group
      const isInGroup = existingGroup.some(f => f.id === funscript.id);
      const fileItem = createGroupFileItem(funscript, isInGroup);
      groupList.appendChild(fileItem);
    });
  }
}

function createGroupFileItem(file, isInExistingGroup) {
  const div = document.createElement('div');
  const isSelected = selectedGroupFiles.some(f => f.id === file.id);
  div.className = `file-item funscript ${isSelected ? 'selected' : ''}`;
  div.dataset.fileId = file.id;
  div.dataset.filename = file.filename;
  div.dataset.inExistingGroup = isInExistingGroup ? 'true' : 'false';
  
  const nameDiv = document.createElement('div');
  nameDiv.className = 'file-name';
  nameDiv.textContent = file.filename;
  nameDiv.title = file.filename;
  
  // Add indicator for files already in the group
  if (isInExistingGroup) {
    const groupIndicator = document.createElement('span');
    groupIndicator.className = 'group-indicator';
    groupIndicator.textContent = ' (in group)';
    groupIndicator.style.color = 'var(--accent-green)';
    groupIndicator.style.fontSize = '11px';
    nameDiv.appendChild(groupIndicator);
  }
  
  // Calculate match probability with the base file
  const probability = calculateMatchProbability(currentGroupBase, file);
  
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
  
  // Toggle selection on click (but prevent deselection of existing group members)
  div.onclick = () => {
    if (isInExistingGroup && isSelected) {
      // Don't allow deselection of files already in the group
      console.log('Cannot deselect file already in group');
      return;
    }
    toggleGroupFileSelection(file, div);
  };
  
  div.appendChild(nameDiv);
  div.appendChild(probabilityBadge);
  
  return div;
}

function toggleGroupFileSelection(file, element) {
  const index = selectedGroupFiles.findIndex(f => f.id === file.id);
  
  if (index >= 0) {
    // Deselect
    selectedGroupFiles.splice(index, 1);
    element.classList.remove('selected');
  } else {
    // Select
    selectedGroupFiles.push(file);
    element.classList.add('selected');
  }
  
  console.log('Selected files:', selectedGroupFiles.map(f => f.filename));
}

function cancelGroupMode() {
  currentGroupBase = null;
  selectedGroupFiles = [];
  editedGroupBaseName = null;
  
  // Reset the heading text
  const heading = document.querySelector('.group-column h3');
  if (heading) {
    heading.textContent = 'Select funscripts to group together';
  }
  
  // Show normal view, hide group view
  document.getElementById('normal-view').classList.remove('hidden');
  document.getElementById('group-view').classList.add('hidden');
  
  // Show header elements again
  const title = document.querySelector('h2');
  const stats = document.querySelector('.stats');
  if (title) title.style.display = '';
  if (stats) stats.style.display = '';
}

async function confirmGrouping() {
  if (selectedGroupFiles.length < 2) {
    alert('Please select at least 2 files to group together');
    return;
  }
  
  const finalBaseName = editedGroupBaseName || getBaseNameForRename(currentGroupBase.filename);
  
  // Rename all selected files to have the same base name
  const renamePromises = selectedGroupFiles.map(file => {
    const extension = getFileExtension(file.filename);
    const newName = finalBaseName + extension;
    
    return browser.runtime.sendMessage({
      action: 'renameFile',
      fileId: file.id,
      type: 'funscript',
      newName: newName,
      originalName: file.filename
    });
  });
  
  // Wait for all renames to complete
  const results = await Promise.all(renamePromises);
  const allSuccess = results.every(r => r.success);
  
  if (allSuccess) {
    // Back out to normal view and reload files
    setTimeout(() => {
      cancelGroupMode();
      loadFiles();
    }, 1000);
  } else {
    const errors = results.filter(r => !r.success).map(r => r.error || 'Unknown error');
    alert(`Some files failed to rename:\n${errors.join('\n')}`);
  }
}

function editGroupBaseName() {
  if (!currentGroupBase) {
    console.error('No current group base file');
    return;
  }
  
  const currentBaseName = editedGroupBaseName || getBaseNameForRename(currentGroupBase.filename);
  const newBaseName = prompt('Enter new base name for the group:', currentBaseName);
  
  if (newBaseName !== null && newBaseName.trim() !== '' && newBaseName.trim() !== currentBaseName) {
    editedGroupBaseName = newBaseName.trim();
    
    // Update the display
    document.getElementById('group-base-name').textContent = `Base name: ${editedGroupBaseName}`;
    
    console.log('Group base name updated to:', editedGroupBaseName);
  }
}

function editBaseName() {
  if (!currentRenameBase) {
    console.error('No current rename base file');
    return;
  }
  
  const currentBaseName = editedBaseName || getBaseNameForRename(currentRenameBase.filename);
  const newBaseName = prompt('Enter new base name:', currentBaseName);
  
  if (newBaseName !== null && newBaseName.trim() !== '' && newBaseName.trim() !== currentBaseName) {
    editedBaseName = newBaseName.trim();
    
    // Update the display
    document.getElementById('rename-base-name').textContent = `Base name: ${editedBaseName}`;
    
    // Update all file items in the rename list with new base name
    updateRenameListWithNewBaseName(editedBaseName);
    
    console.log('Base name updated to:', editedBaseName);
  }
}

function updateRenameListWithNewBaseName(newBaseName) {
  const renameList = document.getElementById('rename-list');
  const fileItems = renameList.querySelectorAll('.file-item');
  
  fileItems.forEach(fileItem => {
    const nameDiv = fileItem.querySelector('.file-name');
    const filename = fileItem.dataset.filename;
    const extension = getFileExtension(filename);
    const newFilename = newBaseName + extension;
    
    // Update the tooltip to show the new name
    nameDiv.title = `Click to rename to: ${newFilename}`;
  });
}

function getBaseNameForRename(filename) {
  // Get base name without any extension
  let baseName = filename;
  
  // Remove funscript extensions (both patterns)
  // Pattern 2 FIRST: .variant.funscript (e.g., .pitch.funscript)
  for (const variant of funscriptVariants) {
    const pattern = new RegExp(`\\.${variant}\\.funscript$`, 'i');
    baseName = baseName.replace(pattern, '');
  }
  
  // Pattern 1 SECOND: .funscript and anything after (e.g., .funscript.pitch)
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

// Known funscript variant extensions
const funscriptVariants = [
  'roll', 'twist', 'sway', 'surge', 'pitch',
  'vib', 'vib0', 'vib1', 'vib2', 
  'vibe', 'vibe0', 'vibe1', 'vibe2',
  'stroke', 'lube', 'heat'
];

function getFileExtension(filename) {
  const lower = filename.toLowerCase();
  
  // For funscript files, we need to handle both patterns:
  // 1. .funscript.variant (e.g., file.funscript.roll)
  // 2. .variant.funscript (e.g., file.roll.funscript)
  if (lower.includes('.funscript')) {
    // Pattern 2 FIRST: Check for variant before .funscript
    for (const variant of funscriptVariants) {
      const pattern = new RegExp(`\\.${variant}\\.funscript$`, 'i');
      if (lower.match(pattern)) {
        const match = filename.match(new RegExp(`\\.${variant}\\.funscript$`, 'i'));
        return match ? match[0] : '';
      }
    }
    
    // Pattern 1 SECOND: .funscript and anything after
    const pattern1Match = filename.match(/\.funscript.*$/i);
    if (pattern1Match) {
      return pattern1Match[0];
    }
    
    // Default funscript pattern
    return '.funscript';
  }
  
  // For video files, get the extension
  const videoExtensions = ['.mp4', '.avi', '.mkv', '.webm', '.mov', '.wmv', '.flv', '.m4v', '.mpg', '.mpeg'];
  for (const ext of videoExtensions) {
    if (lower.endsWith(ext)) {
      return filename.slice(-ext.length);
    }
  }
  
  // Default: get everything after the last dot
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 ? filename.slice(lastDot) : '';
}

function getBaseName(filename) {
  let baseName = filename;
  
  // Remove funscript extensions (both patterns)
  // Pattern 2 FIRST: .variant.funscript (e.g., .pitch.funscript)
  for (const variant of funscriptVariants) {
    const pattern = new RegExp(`\\.${variant}\\.funscript$`, 'i');
    baseName = baseName.replace(pattern, '');
  }
  
  // Pattern 1 SECOND: .funscript and anything after (e.g., .funscript.pitch)
  baseName = baseName.replace(/\.funscript.*$/i, '');
  
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

// Edit base name button
const editBaseNameBtn = document.getElementById('edit-base-name');
if (editBaseNameBtn) {
  editBaseNameBtn.addEventListener('click', () => {
    console.log('Edit base name button clicked');
    editBaseName();
  });
}

// Group mode buttons
const cancelGroupBtn = document.getElementById('cancel-group');
if (cancelGroupBtn) {
  cancelGroupBtn.addEventListener('click', () => {
    console.log('Cancel group button clicked');
    cancelGroupMode();
  });
}

const confirmGroupBtn = document.getElementById('confirm-group');
if (confirmGroupBtn) {
  confirmGroupBtn.addEventListener('click', () => {
    console.log('Confirm group button clicked');
    confirmGrouping();
  });
}

const editGroupBaseNameBtn = document.getElementById('edit-group-base-name');
if (editGroupBaseNameBtn) {
  editGroupBaseNameBtn.addEventListener('click', () => {
    console.log('Edit group base name button clicked');
    editGroupBaseName();
  });
}

// Pop-out button functionality
function initPopOutButton() {
  const popOutBtn = document.getElementById('pop-out-btn');
  
  // If pop-out button doesn't exist (like in window mode), skip
  if (!popOutBtn) {
    return;
  }
  
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
    if (popOutBtn) {
      popOutBtn.addEventListener('click', () => {
        browser.windows.create({
          url: browser.runtime.getURL('window.html'),
          type: 'popup',
          width: 1000,
          height: 800
        });
      });
    }
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

async function browseForFolder() {
  // Try File System Access API first (Chrome/Chromium)
  if (window.showDirectoryPicker) {
    try {
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read',
        startIn: 'downloads'
      });
      
      // Try to get the full path - this varies by browser
      let folderPath;
      if (dirHandle.resolve) {
        const path = await dirHandle.resolve();
        folderPath = path.join('/');
      } else {
        folderPath = dirHandle.name;
      }
      
      document.getElementById('folder-path-input').value = folderPath;
      // Trigger the add folder functionality
      addWatchedFolder();
      return;
    } catch (err) {
      if (err.name === 'AbortError') {
        return; // User cancelled
      }
      console.log('showDirectoryPicker failed:', err);
    }
  }
  
  // Fallback to native host (Firefox with native messaging)
  try {
    const response = await browser.runtime.sendMessage({
      action: 'browseFolder',
      isWatchedFolder: true
    });
    
    console.log('Folder browse response:', response);
    
    if (response && response.success && response.path) {
      console.log('Setting input to:', response.path);
      // Reload the popup to reflect the added folder
      window.location.reload();
      return;
    } else {
      console.log('Response missing success/path:', response);
    }
  } catch (err) {
    console.log('Native host folder browse failed:', err);
  }
  
  // Final fallback to manual input
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
    'moveMatchedFiles',
    'organizeInSubfolders',
    'matchedFilesFolder', 
    'themeMode', 
    'fontSize', 
    'windowSize',
    'customTheme',
    'savedThemes'
  ]).then(result => {
    const autoRemoveEl = document.getElementById('auto-remove-matches');
    const showNotificationsEl = document.getElementById('show-notifications');
    const moveMatchedEl = document.getElementById('move-matched-files');
    const organizeSubfoldersEl = document.getElementById('organize-in-subfolders');
    const organizeSubfoldersLabel = document.getElementById('organize-subfolders-label');
    
    if (autoRemoveEl) {
      autoRemoveEl.checked = result.autoRemoveMatches !== false; // Default to true
    }
    if (showNotificationsEl) {
      showNotificationsEl.checked = result.showNotifications !== false; // Default to true
    }
    if (moveMatchedEl) {
      moveMatchedEl.checked = result.moveMatchedFiles === true; // Default to false
    }
    if (organizeSubfoldersEl) {
      organizeSubfoldersEl.checked = result.organizeInSubfolders === true; // Default to false
    }
    
    // Show/hide matched folder section and subfolder option based on toggle
    const matchedFolderSection = document.getElementById('matched-folder-section');
    if (matchedFolderSection && result.moveMatchedFiles) {
      matchedFolderSection.style.display = 'block';
    }
    if (organizeSubfoldersLabel && result.moveMatchedFiles) {
      organizeSubfoldersLabel.style.display = 'block';
    }
    
    // Display saved matched folder if exists
    if (result.matchedFilesFolder) {
      displayMatchedFolder(result.matchedFilesFolder);
    }
    
    // Apply appearance settings
    const themeModeEl = document.getElementById('theme-mode');
    const fontSizeEl = document.getElementById('font-size');
    const windowSizeEl = document.getElementById('window-size');
    
    if (themeModeEl) {
      themeModeEl.value = result.themeMode || 'auto';
    }
    if (fontSizeEl) {
      fontSizeEl.value = result.fontSize || 'medium';
    }
    if (windowSizeEl) {
      windowSizeEl.value = result.windowSize || 'normal';
    }
    
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

// Set matched folder
function setMatchedFolder() {
  const folderPath = document.getElementById('matched-folder-input').value.trim();
  
  if (!folderPath) {
    alert('Please enter a folder path');
    return;
  }
  
  browser.runtime.sendMessage({
    action: 'setMatchedFolder',
    folder: folderPath
  }).then(response => {
    if (response.success) {
      displayMatchedFolder(folderPath);
      // Clear the input
      document.getElementById('matched-folder-input').value = '';
    }
  });
}

// Browse for matched folder
async function browseForMatchedFolder() {
  // Try File System Access API first (Chrome/Chromium)
  if (window.showDirectoryPicker) {
    try {
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'downloads'
      });
      
      // Try to get the full path - this varies by browser
      let folderPath;
      if (dirHandle.resolve) {
        const path = await dirHandle.resolve();
        folderPath = path.join('/');
      } else {
        folderPath = dirHandle.name;
      }
      
      document.getElementById('matched-folder-input').value = folderPath;
      // Actually save the folder to settings
      setMatchedFolder(folderPath);
      return;
    } catch (err) {
      if (err.name === 'AbortError') {
        return; // User cancelled
      }
      console.log('showDirectoryPicker failed:', err);
    }
  }
  
  // Fallback to native host (Firefox with native messaging)
  try {
    const response = await browser.runtime.sendMessage({
      action: 'browseFolder',
      isMatchedFolder: true
    });
    
    console.log('Folder browse response:', response);
    
    if (response && response.success && response.path) {
      console.log('Setting input to:', response.path);
      // Reload the popup to reflect the saved settings
      window.location.reload();
      return;
    } else {
      console.log('Response missing success/path:', response);
    }
  } catch (err) {
    console.log('Native host folder browse failed:', err);
  }
  
  // Final fallback to manual input
  const path = prompt('Enter the full path to the matched files folder:');
  if (path) {
    document.getElementById('matched-folder-input').value = path;
  }
}

// Clear matched folder
function clearMatchedFolder() {
  browser.runtime.sendMessage({
    action: 'setMatchedFolder',
    folder: null
  }).then(response => {
    if (response.success) {
      displayMatchedFolder(null);
    }
  });
}

// Display matched folder in the same style as watched folders
function displayMatchedFolder(folderPath) {
  const container = document.getElementById('matched-folder-display');
  const inputContainer = document.querySelector('#matched-folder-section .folder-input-container');
  container.innerHTML = '';
  
  if (!folderPath) {
    container.style.display = 'none';
    // Show input container when no folder is set
    if (inputContainer) {
      inputContainer.style.display = 'flex';
    }
    return;
  }
  
  container.style.display = 'block';
  // Hide input container when folder is set
  if (inputContainer) {
    inputContainer.style.display = 'none';
  }
  
  const folderItem = document.createElement('div');
  folderItem.className = 'watched-folder-item';
  
  const pathDiv = document.createElement('div');
  pathDiv.className = 'folder-path';
  pathDiv.textContent = folderPath;
  pathDiv.title = folderPath;
  
  const statusDiv = document.createElement('div');
  statusDiv.className = 'folder-status active';
  statusDiv.textContent = 'Active';
  
  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-folder-btn';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove matched folder';
  removeBtn.onclick = () => {
    clearMatchedFolder();
  };
  
  folderItem.appendChild(pathDiv);
  folderItem.appendChild(statusDiv);
  folderItem.appendChild(removeBtn);
  
  container.appendChild(folderItem);
}

function saveSettings() {
  const autoRemoveEl = document.getElementById('auto-remove-matches');
  const showNotificationsEl = document.getElementById('show-notifications');
  const moveMatchedEl = document.getElementById('move-matched-files');
  const organizeSubfoldersEl = document.getElementById('organize-in-subfolders');
  const themeModeEl = document.getElementById('theme-mode');
  const fontSizeEl = document.getElementById('font-size');
  const windowSizeEl = document.getElementById('window-size');
  
  const autoRemoveMatches = autoRemoveEl ? autoRemoveEl.checked : true;
  const showNotifications = showNotificationsEl ? showNotificationsEl.checked : true;
  const moveMatchedFiles = moveMatchedEl ? moveMatchedEl.checked : false;
  const organizeInSubfolders = organizeSubfoldersEl ? organizeSubfoldersEl.checked : false;
  const themeMode = themeModeEl ? themeModeEl.value : 'auto';
  const fontSize = fontSizeEl ? fontSizeEl.value : 'medium';
  const windowSize = windowSizeEl ? windowSizeEl.value : 'normal';
  
  console.log('Saving settings:', {
    autoRemoveMatches,
    showNotifications, 
    moveMatchedFiles,
    organizeInSubfolders,
    themeMode,
    fontSize,
    windowSize
  });
  
  const settings = {
    autoRemoveMatches: autoRemoveMatches,
    showNotifications: showNotifications,
    moveMatchedFiles: moveMatchedFiles,
    organizeInSubfolders: organizeInSubfolders,
    themeMode: themeMode,
    fontSize: fontSize,
    windowSize: windowSize
  };
  
  browser.storage.local.set(settings);
  
  // Also notify the background script
  browser.runtime.sendMessage({
    action: 'updateSettings',
    settings: settings
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
  const addFolderBtn = document.getElementById('add-folder-btn');
  const browseFolderBtn = document.getElementById('browse-folder-btn');
  const testNativeBtn = document.getElementById('test-native-host');
  
  if (addFolderBtn) {
    addFolderBtn.addEventListener('click', addWatchedFolder);
  }
  if (browseFolderBtn) {
    browseFolderBtn.addEventListener('click', browseForFolder);
  }
  if (testNativeBtn) {
    testNativeBtn.addEventListener('click', testNativeHost);
  }
  
  // Allow Enter key in folder input
  const folderInput = document.getElementById('folder-path-input');
  if (folderInput) {
    folderInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addWatchedFolder();
      }
    });
  }
  
  // Settings change handlers
  const autoRemoveEl = document.getElementById('auto-remove-matches');
  const showNotificationsEl = document.getElementById('show-notifications');
  const moveMatchedEl = document.getElementById('move-matched-files');
  
  if (autoRemoveEl) {
    autoRemoveEl.addEventListener('change', saveSettings);
  }
  if (showNotificationsEl) {
    showNotificationsEl.addEventListener('change', saveSettings);
  }
  if (moveMatchedEl) {
    moveMatchedEl.addEventListener('change', (e) => {
      const matchedFolderSection = document.getElementById('matched-folder-section');
      const organizeSubfoldersLabel = document.getElementById('organize-subfolders-label');
      if (matchedFolderSection) {
        matchedFolderSection.style.display = e.target.checked ? 'block' : 'none';
      }
      if (organizeSubfoldersLabel) {
        organizeSubfoldersLabel.style.display = e.target.checked ? 'block' : 'none';
      }
      saveSettings();
    });
  }
  
  // Add event listener for organize in subfolders toggle
  const organizeSubfoldersEl = document.getElementById('organize-in-subfolders');
  if (organizeSubfoldersEl) {
    organizeSubfoldersEl.addEventListener('change', saveSettings);
  }
  
  // Add event listener for is variant checkbox
  const isVariantCheckbox = document.getElementById('is-variant-checkbox');
  if (isVariantCheckbox) {
    isVariantCheckbox.addEventListener('change', (e) => {
      populateRenameList(e.target.checked);
    });
  }
  
  // Matched folder handlers
  const setMatchedBtn = document.getElementById('set-matched-folder-btn');
  const browseMatchedBtn = document.getElementById('browse-matched-folder-btn');
  
  if (setMatchedBtn) {
    setMatchedBtn.addEventListener('click', setMatchedFolder);
  }
  if (browseMatchedBtn) {
    browseMatchedBtn.addEventListener('click', browseForMatchedFolder);
  }
  
  // Clear matched folder handler - use event delegation since button might not exist yet
  
  // Appearance settings
  const themeModeEl = document.getElementById('theme-mode');
  const fontSizeEl = document.getElementById('font-size');
  const windowSizeEl = document.getElementById('window-size');
  
  if (themeModeEl) {
    themeModeEl.addEventListener('change', saveSettings);
  }
  if (fontSizeEl) {
    fontSizeEl.addEventListener('change', saveSettings);
  }
  if (windowSizeEl) {
    windowSizeEl.addEventListener('change', saveSettings);
  }
  
  // Theming controls
  const toggleThemingEl = document.getElementById('toggle-theming');
  const loadThemeEl = document.getElementById('load-theme');
  const saveThemeEl = document.getElementById('save-theme');
  const deleteThemeEl = document.getElementById('delete-theme');
  const applyThemeEl = document.getElementById('apply-theme');
  const resetThemeEl = document.getElementById('reset-theme');
  
  if (toggleThemingEl) {
    toggleThemingEl.addEventListener('click', toggleThemingControls);
  }
  if (loadThemeEl) {
    loadThemeEl.addEventListener('click', loadSelectedTheme);
  }
  if (saveThemeEl) {
    saveThemeEl.addEventListener('click', saveCurrentTheme);
  }
  if (deleteThemeEl) {
    deleteThemeEl.addEventListener('click', deleteSelectedTheme);
  }
  if (applyThemeEl) {
    applyThemeEl.addEventListener('click', applyCurrentTheme);
  }
  if (resetThemeEl) {
    resetThemeEl.addEventListener('click', resetTheme);
  }
}

// Detect window mode and add appropriate class
if (document.body.classList.contains('window-mode')) {
  document.documentElement.classList.add('popped-out');
}

// Load files on popup open
initTabs();
initConfiguration();
loadSettings(); // Load and apply settings immediately on startup
loadFiles();
// Check native host status on startup
checkNativeHostStatus();
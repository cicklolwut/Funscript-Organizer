# Function Documentation - Funscript Rename Tool

## Overview

This browser extension helps users track and rename funscript and video files to ensure proper pairing. The tool consists of browser-side JavaScript components and native host Python components for file system operations.

## Architecture

- **Browser Extension**: JavaScript files for UI and download tracking
- **Native Host**: Python scripts for file system operations
- **Communication**: Native messaging protocol between extension and host

---

## Browser Extension Functions

### background.js

**File Purpose**: Main background script for download tracking and file matching

#### Core Functions

**`getBaseName(filename)`** - `background.js:8`
- Extracts base filename by removing .funscript and video extensions
- Used for matching funscript files with their corresponding videos
- Returns: Lowercase base name without extensions

**`isFunscriptFile(filename)`** - `background.js:22`
- Checks if a filename contains .funscript extension
- Returns: Boolean indicating if file is a funscript

**`isVideoFile(filename)`** - `background.js:26`
- Checks if filename ends with supported video extensions
- Supports: .mp4, .avi, .mkv, .webm, .mov, .wmv, .flv, .m4v, .mpg, .mpeg
- Returns: Boolean indicating if file is a video

**`checkAndRemoveMatches()`** - `background.js:31`
- Finds matching funscript/video pairs and removes them from tracking
- Core matching algorithm comparing base names
- Triggers storage save and badge update

**`saveToStorage()`** - `background.js:69`
- Persists downloadedFiles data to browser.storage.local
- Called after any changes to tracked files

**`loadFromStorage()`** - `background.js:73`
- Loads downloadedFiles from browser.storage.local on startup
- Returns: Promise that resolves when data is loaded

**`updateBadge()`** - `background.js:81`
- Updates extension badge with count of unmatched files
- Shows red badge when unmatched files exist, empty when all matched

**`connectNativeHost()`** - `background.js:175`
- Establishes connection to native messaging host
- Sets up message handlers and disconnect listeners
- Returns: Boolean indicating success

**`handleRename(fileId, type, newName, originalName)`** - `background.js:202`
- Handles file renaming operations via native host
- Falls back to internal tracking if native host unavailable
- Returns: Promise with success/error result

#### Event Listeners

**Download Completion Listener** - `background.js:93`
- Monitors browser.downloads.onChanged for completed downloads
- Automatically adds funscript/video files to tracking
- Triggers match checking

**Message Handler** - `background.js:123`
- Processes messages from popup UI
- Actions: getFiles, removeFile, clearMatched, renameFile, testNativeHost

### background_v2.js

**File Purpose**: Enhanced background script with directory watching and bidirectional communication

#### Enhanced Functions

**`connectNativeHost()`** - `background_v2.js:114`
- Enhanced version with improved message handling
- Supports bidirectional communication and notifications
- Handles unsolicited messages from native host

**`handleNativeNotification(notification)`** - `background_v2.js:148`
- Processes notifications from native host
- Handles: new_file_detected, file_deleted, file_renamed events
- Shows browser notifications when enabled

**`watchDirectory(directoryPath)`** - `background_v2.js:235`
- Starts watching a directory via native host
- Adds to watchedDirectories set and saves to storage

**`unwatchDirectory(directoryPath)`** - `background_v2.js:251`
- Stops watching a directory
- Removes from watchedDirectories and saves to storage

**`scanDirectory(directoryPath)`** - `background_v2.js:264`
- Scans directory for existing files via native host
- Returns: Promise with found files
- Timeout: 10 seconds

#### Settings Management

**Settings Object** - `background_v2.js:11`
- autoRemoveMatches: Boolean for automatic match removal
- showNotifications: Boolean for browser notifications

### popup.js

**File Purpose**: UI logic for extension popup interface

#### Display Functions

**`displayFiles(files)`** - `popup.js:18`
- Renders funscript and video files in popup UI
- Updates unmatched file counts
- Triggers potential match highlighting

**`createFileItem(file, type)`** - `popup.js:55`
- Creates DOM elements for individual file items
- Adds hover buttons for remove and rename actions
- Returns: DOM element for file

**`highlightPotentialMatches(files)`** - `popup.js:456`
- Adds visual highlighting to files with matching base names
- Compares funscript and video base names for potential matches

#### Smart Matching Functions

**`levenshteinDistance(str1, str2)`** - `popup.js:251`
- Calculates edit distance between two strings using dynamic programming
- Returns minimum number of single-character edits needed to transform one string into another
- Used as foundation for similarity calculations

**`calculateSimilarity(str1, str2)`** - `popup.js:294`
- Computes percentage similarity between two strings based on Levenshtein distance
- Returns 0-100% similarity score normalized by string length
- Case-insensitive comparison

**`extractKeywords(filename)`** - `popup.js:315`
- Extracts meaningful content words from filenames for intelligent matching
- Removes brackets `[Creator]`, parentheses `(720p)`, technical terms
- Normalizes apostrophes, dashes, underscores to spaces
- Creates both original and simplified word versions (removes numbers/symbols)
- Filters out technical metadata: `720p`, `1080p`, `4k`, `60fps`, video extensions

**`calculateKeywordSimilarity(str1, str2)`** - `popup.js:339`
- Advanced keyword-based similarity using extracted meaningful words
- Multiple matching tiers: exact (100%), partial (80%), high similarity (70%), medium (50%)
- Finds best match for each keyword rather than counting all matches
- Includes bonus for files with similar keyword density ratios
- Returns 0-100% match confidence

**`calculateTabTitleSimilarity(file1, file2)`** - `popup.js:389`
- Compares download source page titles for context matching
- Extracts meaningful title parts by removing site suffixes
- Helps identify files from same content page

**`calculateMatchProbability(file1, file2)`** - `popup.js:399`
- Master probability algorithm combining multiple similarity factors
- **Primary scoring**: Keyword similarity (85% weight) vs exact string similarity (40% weight)
- **Core match bonus**: +15-25% for 2-4 strong keyword matches (character names, creators)
- **Context bonuses**: Same tab source (+15%), timestamp proximity (+10%)
- **Advanced features**: Handles different filename conventions (series vs content focus)
- Returns final 0-100% match probability with intelligent content recognition

#### Rename Functionality

**`startRenameMode(file, type)`** - `popup.js:102`
- Initiates rename interface for selected file
- Switches UI to rename view
- Populates opposite file type for selection with probability-based sorting
- Automatically calculates and sorts potential matches by probability (highest first)

**`createRenameFileItem(file, type, baseName)`** - `popup.js:145`
- Creates clickable file items for rename target selection with probability indicators
- Shows preview of new filename on hover
- **Displays color-coded probability badges**: Green (80%+), Orange (50-79%), Red (<50%)
- Calculates match probability between base file and potential target

**`performRename(file, type, baseName)`** - `popup.js:156`
- Executes rename operation via background script
- Provides user feedback and refreshes file list

**`cancelRenameMode()`** - `popup.js:188`
- Exits rename mode and returns to normal view

#### Utility Functions

**`getBaseNameForRename(filename)`** - `popup.js:197`
- Extracts base name for rename operations
- Removes both funscript and video extensions

**`getFileExtension(filename)`** - `popup.js:215`
- Preserves original file extensions during rename
- Handles .funscript and video extensions differently

**`getBaseName(filename)`** - `popup.js:235`
- Standard base name extraction for matching logic

#### Configuration Functions

**`loadConfiguration()`** - `popup.js:392`
- Loads configuration tab data
- Calls: loadWatchedFolders, checkNativeHostStatus, loadSettings

**`loadWatchedFolders()`** - `popup.js:398`
- Retrieves list of watched directories from background
- Displays in configuration UI

**`displayWatchedFolders()`** - `popup.js:410`
- Renders watched folder list with status and controls
- Adds scan and remove buttons for each folder

**`addWatchedFolder()`** - `popup.js:454`
- Adds new directory to watch list
- Validates input and prevents duplicates

**`scanWatchedFolder(path)`** - `popup.js:486`
- Triggers directory scan for existing files
- Shows user feedback on scan results

**`removeWatchedFolder(index)`** - `popup.js:506`
- Removes directory from watch list
- Updates UI after successful removal

**`checkNativeHostStatus()`** - `popup.js:531`
- Tests connection to native messaging host
- Updates status indicator in UI

**`testNativeHost()`** - `popup.js:548`
- Performs connection test with user feedback
- Shows success/failure alerts

**`loadSettings()`** - `popup.js:560`
- Loads user preferences from storage including theme, font size, window size
- Sets checkbox states for autoRemoveMatches and showNotifications
- Applies appearance settings on load
- Loads custom themes and saved theme presets

**`saveSettings()`** - `popup.js:595`
- Saves user preference changes including appearance settings
- Applies settings immediately (theme, font, window size)
- Saves to both browser.storage.local and localStorage
- Notifies background script of setting updates

#### Theming Functions

**`applyTheme(mode)`** - `popup.js:626`
- Applies light/dark/auto theme mode
- Saves theme to localStorage for instant load
- Manages theme CSS classes on body element

**`applyFontSize(size)`** - `popup.js:640`
- Applies font size (small/medium/large)
- Updates body CSS class for font sizing

**`applyWindowSize(size, skipAnimation)`** - `popup.js:646`
- Sets extension popup window dimensions
- Skips execution in window mode (popped out)
- Saves to localStorage for persistence
- Handles transition animations

**`loadCustomTheme(theme)`** - `popup.js:683`
- Applies custom color theme to CSS variables
- Updates all color properties dynamically

**`getCurrentTheme()`** - `popup.js:689`
- Extracts current color values from UI inputs
- Returns theme object with all color properties

**`loadSavedThemes(themes)`** - `popup.js:698`
- Populates saved themes dropdown
- Displays user-saved theme presets

**`saveCurrentTheme()`** - `popup.js:709`
- Prompts for theme name
- Saves current colors as named theme preset
- Updates saved themes list

**`loadSelectedTheme()`** - `popup.js:727`
- Loads selected theme from dropdown
- Updates all color inputs with theme values

**`deleteSelectedTheme()`** - `popup.js:746`
- Removes selected theme from saved presets
- Updates storage and UI

**`applyCurrentTheme()`** - `popup.js:762`
- Applies current color selections
- Saves as custom theme in storage
- Updates CSS variables immediately

**`resetTheme()`** - `popup.js:772`
- Resets all colors to defaults
- Removes custom theme from storage
- Clears CSS variable overrides

**`toggleThemingControls()`** - `popup.js:796`
- Shows/hides advanced theming section
- Updates toggle button arrow direction

#### Event Handlers

**`initPopOutButton()`** - `popup.js:318`
- Configures pop-out window functionality
- Creates larger popup window when clicked

**`initTabs()`** - `popup.js:363`
- Sets up tab switching between tracker and configuration
- Loads appropriate content based on active tab

**`initConfiguration()`** - `popup.js:589`
- Initializes event listeners for configuration UI
- Handles folder input, buttons, and settings changes

---

## Window Mode Files

### window.html

**File Purpose**: Separate HTML file for popped-out window mode with full viewport utilization

**Key Differences from popup.html**:
- Uses `window-mode` class on body
- No size restrictions in inline script
- Loads `window.css` for window-specific styles
- Removes pop-out button (already in window mode)

### window.css

**File Purpose**: CSS overrides for window mode to enable full flexbox layout

**Key Features**:
- Sets body to 100vw × 100vh
- Removes all size restrictions
- Enables proper flex layout for all containers
- Hides window size selector (not needed in window mode)
- Optimized spacing for larger displays
- No transition animations

---

## Native Host Functions

### funscript_rename_host.py

**File Purpose**: Basic native messaging host for file operations

#### Core Functions

**`get_message()`** - `funscript_rename_host.py:24`
- Reads binary message from stdin using native messaging protocol
- Returns: Parsed JSON message object

**`encode_message(message_content)`** - `funscript_rename_host.py:33`
- Encodes message for native messaging protocol
- Returns: Dictionary with length and content fields

**`send_message(message_content)`** - `funscript_rename_host.py:39`
- Sends message to extension via stdout
- Handles binary encoding and flushing

**`rename_file(old_path, new_name)`** - `funscript_rename_host.py:46`
- Performs actual file rename operation on disk
- Validates file existence and target conflicts
- Returns: Success/error result dictionary

**`scan_directory(directory_path)`** - `funscript_rename_host.py:94`
- Scans directory for funscript and video files
- Returns: List of found files with metadata

**`handle_message(message)`** - `funscript_rename_host.py:159`
- Processes incoming messages from extension
- Supported actions: rename, ping, scan, watch, unwatch
- Returns: Response dictionary

**`main()`** - `funscript_rename_host.py:275`
- Main message loop for native host
- Continuous processing until extension disconnect

### funscript_rename_host_v2.py

**File Purpose**: Enhanced native host with bidirectional communication and file watching

#### Class: NativeMessagingHost

**`__init__()`** - `funscript_rename_host_v2.py:28`
- Initializes host with message queue and file watchers
- Sets up threading infrastructure

**`get_message()`** - `funscript_rename_host_v2.py:34`
- Enhanced message reading with better error handling
- Returns: JSON message or None on disconnect

**`send_message(message_content)`** - `funscript_rename_host_v2.py:43`
- Thread-safe message sending
- Handles JSON encoding and binary protocol

**`rename_file(old_path, new_name)`** - `funscript_rename_host_v2.py:51`
- Enhanced file rename with notification support
- Sends rename notifications to extension

**`watch_directory(directory_path)`** - `funscript_rename_host_v2.py:98`
- Starts file system monitoring for directory
- Creates watcher thread for continuous monitoring

**`directory_watcher(directory)`** - `funscript_rename_host_v2.py:131`
- Background thread monitoring directory changes
- Detects new files, deletions, and modifications
- Sends real-time notifications to extension

**`send_notification(notification)`** - `funscript_rename_host_v2.py:177`
- Queues notifications for asynchronous sending
- Used by file watchers for event notifications

**`scan_directory(directory_path)`** - `funscript_rename_host_v2.py:181`
- Enhanced directory scanning with better metadata
- Returns comprehensive file information

**`handle_message(message)`** - `funscript_rename_host_v2.py:226`
- Enhanced message handling with more actions
- Supports: rename, watch, unwatch, scan, ping

**`notification_sender()`** - `funscript_rename_host_v2.py:290`
- Background thread for sending queued notifications
- Runs continuously while host is active

**`run()`** - `funscript_rename_host_v2.py:304`
- Main execution loop with enhanced error handling
- Manages notification thread and graceful shutdown

---

## Installation Scripts

### install.sh

**File Purpose**: Native host installation script

**Main Operations**:
- Makes Python script executable (`chmod +x`)
- Updates manifest file with correct Python script path
- Creates native messaging hosts directory if needed
- Copies manifest to Firefox configuration directory
- Provides installation feedback and instructions

### uninstall.sh

**File Purpose**: Native host removal script  

**Main Operations**:
- Removes native host manifest from Firefox directory
- Optionally removes log file with user confirmation
- Provides uninstallation feedback

---

## Data Flow

1. **Download Detection**: Browser monitors download completion events
2. **File Classification**: Files categorized as funscript or video based on extensions
3. **Matching Logic**: Base names compared to identify pairs
4. **Storage Management**: Tracked files persisted in browser storage
5. **UI Updates**: Badge and popup reflect current unmatched file count
6. **Rename Operations**: Native host performs actual file system changes
7. **Directory Watching**: Continuous monitoring for new files in watched folders

## Security Considerations

- Native host only operates within user's file system permissions
- File operations limited to rename and scan operations
- No network access or sensitive data handling
- All operations logged for debugging purposes

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"id": "1", "content": "Explore codebase structure to understand project layout", "status": "completed"}, {"id": "2", "content": "Identify all source code files containing functions", "status": "completed"}, {"id": "3", "content": "Analyze functions in each file and document their purposes", "status": "completed"}, {"id": "4", "content": "Create comprehensive function documentation", "status": "completed"}]
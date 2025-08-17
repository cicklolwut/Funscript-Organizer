# Funscript Organizer

A powerful Firefox extension that tracks, matches, and organizes `.funscript` files with their corresponding video files, featuring automatic matching, file renaming, directory monitoring, and extensive customization options.

## Features

### Core Functionality
- **Automatic Download Tracking**: Monitors downloads of `.funscript` and video files with source page context
- **Intelligent Matching**: Advanced probability-based matching using keyword analysis and content recognition
- **Smart Rename Assistant**: Visual probability indicators and automatic sorting for better file pairing decisions
- **Complex Extension Support**: Handles files like `test.funscript.twist` correctly
- **Visual File Management**: Intuitive two-column interface showing unmatched files with match confidence
- **Badge Counter**: Shows count of unmatched files on the extension icon

### File Operations
- **Click-to-Rename**: Visual rename mode to match file names between funscripts and videos
- **Native File System Integration**: Actually renames files on disk (requires native host)
- **Directory Watching**: Monitor folders for new funscript/video files (v2)
- **Directory Scanning**: Scan existing folders to find files

### User Interface
- **Pop-out Window**: Expand to full application window for better workspace
- **Customizable Appearance**:
  - Three window sizes (Compact: 580×480, Normal: 650×580, Large: 750×600)
  - Font size options (Small, Medium, Large)
  - Theme modes (Auto/Light/Dark)
  - Advanced color theming with saveable custom themes
- **Tabbed Interface**: Separate tabs for Tracker and Settings
- **Real-time Updates**: Live file tracking with automatic UI refresh

## Installation

### Step 1: Install the Native Host (for file renaming on disk)

1. Navigate to the `native-host` directory:
   ```bash
   cd native-host
   ```

2. Run the installation script:
   ```bash
   ./install.sh
   ```

   This will:
   - Make the Python script executable
   - Install the native messaging host manifest to Firefox's directory
   - Set up the communication channel between the extension and your system

### Step 2: Install the Extension

1. First, create the extension icons:
   - Open `create-icons.html` in a browser
   - Right-click each canvas and save as:
     - `icon-16.png`
     - `icon-48.png`
     - `icon-128.png`

2. Install in Firefox:
   - Open Firefox and navigate to `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select the `manifest.json` file

## Usage

### Basic Operation
1. The extension automatically tracks downloads of:
   - `.funscript` files (including variants like `.funscript.twist`)
   - Video files (`.mp4`, `.avi`, `.mkv`, `.webm`, `.mov`, `.wmv`, `.flv`, `.m4v`, `.mpg`, `.mpeg`)

2. Files with matching base names are automatically removed from the list

3. Click the extension icon to view unmatched files in two columns

### File Management

#### Smart Rename with Match Probability
1. **Hover** over any file to see action buttons
2. Click the **arrow button** (→ or ←) to start rename mode with that file as the base
3. **View intelligent match suggestions**:
   - Files automatically sorted by match probability (best matches first)
   - **Color-coded confidence indicators**:
     - 🟢 **Green (80%+)**: High confidence matches
     - 🟠 **Orange (50-79%)**: Possible matches
     - 🔴 **Red (<50%)**: Low confidence matches
4. Click any file in the target list to rename it
5. Successfully renamed files will automatically match and be removed

#### Smart Matching Algorithm
The extension uses advanced algorithms to identify matching files:
- **Keyword extraction**: Removes technical metadata, brackets, creator tags
- **Content analysis**: Focuses on character names, series, and meaningful content words
- **Source context**: Considers download page titles for additional matching hints
- **Flexible matching**: Handles different filename conventions (e.g., `[Creator] Series - Character` vs `character-scene-creator-quality`)
- **Multi-factor scoring**: Combines filename similarity, keyword matches, timing, and source context

#### Remove Files
- Click the **× button** on any file to manually remove it from tracking

#### Clear Matched
- Click "Clear Matched" to force re-check and remove any matched pairs

### Window Modes

#### Extension Popup
- Default compact view within Firefox
- Adjustable size via Settings → Appearance → Extension Size

#### Pop-out Window
- Click the **🗗** button (top-right) to open in a full window
- Provides more space for file management
- Fully responsive layout that adapts to window size

### Directory Monitoring

1. Go to **Settings** tab
2. Under **Watched Folders**:
   - Enter a folder path (e.g., `/home/user/Downloads`)
   - Click "Add Folder" to start monitoring
   - Click 🔍 to scan for existing files
   - Click × to stop watching a folder

### Customization

#### Appearance Settings
- **Theme**: Auto (follows system), Light, or Dark mode
- **Font Size**: Small, Medium, or Large
- **Extension Size**: Compact, Normal, or Large (popup only)

#### Advanced Theming
1. Click "Advanced Theming ▼" to expand color options
2. Customize individual colors:
   - Background colors (Primary, Secondary, Tertiary)
   - Text colors (Primary, Secondary, Tertiary)
   - Accent colors (Green, Blue, Red, Yellow, Orange)
   - Border colors (Primary, Secondary)
3. **Save Theme**: Click "Save" to store your custom theme
4. **Load Theme**: Select from saved themes dropdown
5. **Apply Changes**: Click "Apply" to see changes immediately

### Settings

#### Auto-Matching
- **Automatically remove matched pairs**: Enabled by default
- **Show notifications**: Get alerts for new files detected

#### Native Host Status
- Shows connection status to the native messaging host
- Click "Test Connection" to verify functionality

## File Structure

```
Funscript-Organizer/
├── manifest.json                    # Extension manifest
├── background.js                    # Basic background script
├── background_v2.js                 # Enhanced background with directory watching
├── popup.html                       # Extension popup UI
├── popup.js                         # Popup interaction logic and theming
├── popup.css                        # Popup styling and responsive layout
├── window.html                      # Pop-out window UI
├── window.css                       # Pop-out window specific styles
├── create-icons.html                # Icon generator utility
├── icon-16.png                      # Toolbar icon (16×16)
├── icon-48.png                      # Extension icon (48×48)
├── icon-128.png                     # Store icon (128×128)
├── native-host/                     # Native messaging host for file operations
│   ├── funscript_rename_host.py    # Basic Python script for file renaming
│   ├── funscript_rename_host_v2.py # Enhanced with directory monitoring
│   ├── funscript_rename_host.json  # Native host manifest
│   ├── install.sh                   # Installation script
│   └── uninstall.sh                 # Uninstallation script
├── FUNCTION_DOCUMENTATION.md        # Detailed function documentation
└── README.md                        # This file
```

## Requirements

- Firefox 50.0 or higher
- Python 3 (for native file renaming)
- Linux/Unix system (scripts may need adjustment for Windows)

## Troubleshooting

### Native Host Not Working
1. Check the log file at `~/.funscript_rename_host.log`
2. Ensure Python 3 is installed: `python3 --version`
3. Restart Firefox after installing the native host
4. Verify the manifest is in: `~/.mozilla/native-messaging-hosts/`

### Extension Not Tracking Downloads
1. Check that the extension has the necessary permissions
2. Ensure you're downloading actual files (not viewing them in browser)
3. Check the browser console for error messages

## Security Note

The native host has file system access to rename files. It only operates on files that Firefox has downloaded and only performs rename operations within the same directory.

## Uninstallation

### Remove Native Host
```bash
cd native-host
./uninstall.sh
```

### Remove Extension
1. Go to `about:addons` in Firefox
2. Find "Funscript Download Tracker"
3. Click Remove

## License

This project is provided as-is for personal use.
# Funscript Organizer

A comprehensive Firefox browser extension for automatically tracking, organizing, and managing funscript files and their associated video content. Designed to streamline the workflow of interactive media enthusiasts by providing intelligent file matching, organization, and management capabilities.

## 🎯 Overview

Funscript Organizer automatically detects funscript downloads, matches them with corresponding video files, and provides powerful organization tools. The extension features an intelligent matching system with probability scoring, advanced theming, and a native file system integration for seamless file operations.

## ✨ Key Features

### 📂 **Automatic File Detection**
- **Download Monitoring**: Automatically detects `.funscript` and video file downloads
- **Directory Watching**: Real-time monitoring of specified folders for new files
- **Smart Detection**: Recognizes temporary files and avoids duplicate tracking
- **Multi-Format Support**: Handles all common video formats (MP4, AVI, MKV, WebM, MOV, etc.)

### 🎯 **Intelligent Matching System**
- **Probability-Based Matching**: Advanced algorithm scores potential matches (0-100%)
- **Variant Recognition**: Supports funscript variants (`.roll.funscript`, `.pitch.funscript`, `.vib.funscript`, etc.)
- **Flexible Matching**: Handles filename variations, missing extensions, and encoding differences
- **Match Confidence**: Visual indicators for high (80%+), medium (50-79%), and low (<50%) confidence matches

### 🗂️ **File Organization**
- **Subfolder Organization**: Optional organization into base name subfolders
- **Automatic Moving**: Move matched pairs to designated folders
- **Variant Management**: Add variant funscripts to existing matched folders
- **Batch Operations**: Group and process multiple files simultaneously
- **Custom Naming**: Edit base names during matching operations

### 🔄 **Advanced Workflow Features**
- **Grouping System**: Select and rename multiple funscripts together
- **"Is Variant" Mode**: Add variant funscripts to existing organized folders
- **Existing Folder Matching**: Browse and match to previously organized content
- **Probability Sorting**: Files automatically sorted by match confidence
- **Real-time Updates**: Live file list updates as operations complete

### 🎨 **User Interface**
- **Dual Interface Modes**: Compact popup and full window views
- **Responsive Design**: Adapts to different screen sizes and preferences
- **Advanced Theming**: Comprehensive color customization system
- **Saved Themes**: Create, save, and load custom theme configurations
- **Font & Size Options**: Customizable text size and extension dimensions
- **Dark/Light Modes**: Automatic system theme detection with manual override

### ⚙️ **Configuration & Settings**
- **Auto-Matching**: Toggle automatic removal of matched pairs
- **Notifications**: Browser notifications for new files and operations
- **Watched Folders**: Add multiple directories for monitoring
- **File Movement**: Configure automatic moving of matched files
- **Subfolder Organization**: Enable/disable base name folder structure
- **Visual Preferences**: Comprehensive appearance customization

### 💻 **Native File System Integration**
- **Cross-Platform Support**: Works on Linux with fallbacks for other systems
- **File Operations**: Direct file renaming, moving, and organization
- **Folder Selection**: Native system dialogs for folder browsing
- **Real-time Monitoring**: File system event detection and processing
- **Error Handling**: Robust error handling with detailed logging

## 📥 Installation

### Quick Start
1. **Download** both files from the [latest release](../../releases/latest):
   - `funscript-organizer.xpi` (browser extension)
   - Platform-specific native host package:
     - Windows: `funscript-native-host-windows.zip`
     - Linux/macOS: `funscript-native-host-unix.tar.gz`

2. **Install Extension**:
   - Open Firefox and drag & drop the `.xpi` file
   - Click "Add" when prompted

3. **Install Native Host**:
   - Extract the package and run the installer:
     - **Windows**: Double-click `install.bat`
     - **Linux/macOS**: Run `chmod +x install.sh && ./install.sh`

4. **Restart Firefox** and verify connection in Settings → Native Host Status

### Requirements
- **Python 3.6+** installed and in PATH
- **Firefox 58+** browser

### Alternative Installation Methods

#### Developer Installation
For development or testing with unsigned extensions:
1. Download files from [releases](../../releases)
2. Open Firefox Developer Edition
3. Go to `about:debugging` → This Firefox → Load Temporary Add-on
4. Install native host as described above

#### Manual Native Host Setup
If automatic installation fails, see the [troubleshooting section](#-troubleshooting) for manual steps.

## 🚀 Usage Guide

### Basic Workflow

1. **Initial Setup**
   - Install both the extension and native host
   - Open the extension popup or window
   - Configure settings in the Settings tab

2. **Adding Watched Folders**
   - Go to Settings → Watched Folders
   - Click "Browse" or enter folder paths manually
   - Add your Downloads folder and any other relevant directories

3. **File Detection**
   - Download funscript and video files
   - Files automatically appear in the extension interface
   - Real-time detection from watched folders

4. **Matching & Organization**
   - Review suggested matches with probability scores
   - Click on files to rename/match them
   - Use batch operations for multiple files
   - Enable automatic moving for hands-off organization

### Advanced Features

#### Variant Matching
1. Enable "Organize in subfolders by base name" in settings
2. When matching a funscript, check "Is Variant" 
3. Select from existing matched folders instead of videos
4. Variant is added to the folder without renaming

#### Grouping Operations
1. Click the group icon (⧉) next to any funscript
2. Select multiple related funscripts
3. Rename all with a common base name
4. All files maintain their variant extensions

#### Custom Theming
1. Go to Settings → Appearance → Advanced Theming
2. Customize individual color properties
3. Save custom themes for later use
4. Load and delete saved themes as needed

## 🏗️ Technical Architecture

### Extension Components

#### Frontend (`popup.js`)
- **File Management**: Loading, displaying, and organizing file lists
- **Matching Logic**: Probability calculation and file correlation algorithms
- **UI Management**: Theme application, view switching, event handling
- **Native Communication**: Messaging with background script and native host

#### Background Script (`background_v2.js`)
- **Download Detection**: Monitoring browser downloads via WebExtensions API
- **Auto-Matching**: Automatic file correlation and removal
- **Native Host Bridge**: Communication with file system operations
- **Data Persistence**: File tracking and settings storage

#### Native Host (`funscript_rename_host_v2.py`)
- **File System Operations**: Rename, move, and organize files
- **Directory Monitoring**: Real-time file system event detection
- **Cross-Platform Support**: Linux (primary), Windows, and macOS support
- **Message Processing**: Bidirectional communication with browser extension
- **Platform-Specific Features**: 
  - Linux: Full inotify support with zenity fallback
  - Windows: tkinter dialogs with file system monitoring
  - macOS: tkinter dialogs with polling-based detection

### Matching Algorithm

The intelligent matching system uses multiple factors:

1. **Exact Base Name Matching** (100%): Perfect filename correlation
2. **Fuzzy Matching** (80-95%): Similar names with minor variations
3. **Substring Matching** (60-80%): Partial name correlation
4. **Word-Based Matching** (40-70%): Individual word correlation
5. **Length Similarity** (10-30%): Filename length correlation

### File Organization Structure

```
Output Folder/
├── BaseFileName1/
│   ├── BaseFileName1.mp4
│   ├── BaseFileName1.funscript
│   ├── BaseFileName1.roll.funscript
│   └── BaseFileName1.vib.funscript
├── BaseFileName2/
│   ├── BaseFileName2.mkv
│   └── BaseFileName2.funscript
```

## ⚙️ Configuration

### Settings Reference

| Setting | Description | Default |
|---------|-------------|---------|
| **Auto-remove matches** | Automatically remove matched pairs from tracking | Enabled |
| **Show notifications** | Browser notifications for new files and operations | Enabled |
| **Move matched files** | Automatically move matched pairs to designated folder | Disabled |
| **Organize in subfolders** | Create base name subfolders for organization | Disabled |
| **Theme mode** | Light, dark, or auto (system) theme | Auto |
| **Font size** | Interface text size (small, medium, large) | Medium |
| **Extension size** | Popup dimensions (compact, normal, large) | Normal |

### Watched Folders

- Add multiple directories for automatic monitoring
- Supports both manual entry and native folder browsing
- Real-time status indicators (active, error, unknown)
- Individual folder scanning and removal options

### Matched Files Folder

- Designate target folder for automatic file moving
- Native folder browsing with system dialogs
- Visual confirmation of selected folder
- Integration with subfolder organization

## 🔧 Troubleshooting

### Native Host Connection Issues

#### Automatic Installation Failed
If the installer scripts don't work, install manually:

**Windows Manual Setup:**
1. Create directory: `mkdir "%APPDATA%\Mozilla\NativeMessagingHosts"`
2. Copy `funscript_rename_host.json` to that directory
3. Edit the JSON file to use absolute Windows paths:
   ```json
   {
     "path": "C:\\Users\\YourName\\path\\to\\python.exe",
     "args": ["C:\\Users\\YourName\\path\\to\\funscript_rename_host_v2.py"]
   }
   ```
4. Test: `python funscript_rename_host_v2.py`
5. Restart Firefox

**Linux/macOS Manual Setup:**
1. Copy JSON to `~/.mozilla/native-messaging-hosts/`
2. Edit paths to use absolute Unix paths
3. Make Python script executable: `chmod +x funscript_rename_host_v2.py`
4. Test: `python3 funscript_rename_host_v2.py`
5. Restart Firefox

#### Common Connection Problems
- **Python not found**: Ensure Python 3.6+ is installed and in PATH
- **Permission denied**: Run installer as administrator/sudo
- **Wrong paths**: Use absolute paths in the JSON manifest
- **Firefox cache**: Restart Firefox after installation

### Extension Issues

#### Files Not Detected
- Check extension permissions are granted
- Verify file types (.funscript, video files) are supported
- Ensure downloads complete fully

#### Files Not Moving/Renaming
- Verify native host connection in Settings
- Check folder permissions for source/destination
- Review browser console for error messages

#### Matching Problems
- Check filename similarity and extensions
- Review match probability scores
- Try manual matching for difficult cases
- Use grouping feature for related files

### Debug Information

Enable detailed logging by opening browser developer tools:
1. Right-click extension popup → Inspect
2. Go to Console tab
3. Reproduce the issue
4. Review console output for error messages

### Performance Optimization

- Limit number of watched folders for better performance
- Regularly clean up completed matches
- Use subfolder organization to reduce file list size
- Consider moving older organized content out of watched folders

## 🛠️ Development

### Project Structure

```
funscript-organizer/
├── manifest.json              # Extension manifest
├── background_v2.js          # Background script
├── popup.html               # Popup interface
├── popup.js                 # Frontend logic
├── popup.css               # Styling and themes
├── window.html             # Full window interface
├── window.css              # Window-specific styles
├── build.sh                # Build script
├── native-host/            # Native messaging host
│   ├── funscript_rename_host_v2.py
│   ├── funscript_rename_host.json
│   ├── install.sh
│   └── uninstall.sh
└── icons/                  # Extension icons
```

### Building from Source

```bash
# Clone the repository
git clone <repository-url>
cd funscript-organizer

# Build extension for distribution
./build.sh

# Build native host packages for distribution
./build_native_host.sh

# For development: install native host locally
cd native-host && ./install.sh
```

### Release Package Structure

Release packages are available on the [releases page](../../releases):
- `funscript-organizer.xpi` - Firefox extension
- `funscript-native-host-windows.zip` - Windows native host
- `funscript-native-host-unix.tar.gz` - Linux/macOS native host

### Development Setup

1. Load unpacked extension in Firefox Developer Edition
2. Install native host for testing file operations
3. Enable browser console logging for debugging
4. Use `about:debugging` for real-time extension debugging

### Contributing

- Follow existing code style and patterns
- Test both popup and window interfaces
- Verify native host functionality on your platform
- Update documentation for new features
- Ensure proper error handling and user feedback

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Support

For issues, feature requests, or questions:
- Check the troubleshooting section above
- Review browser console for error messages
- Create an issue with detailed reproduction steps
- Include system information (OS, Firefox version, extension version)

---

**Version**: 0.1.4  
**Compatibility**: Firefox 58+  
**Platform**: Cross-platform (Linux, Windows, macOS)
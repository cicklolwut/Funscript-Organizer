#!/bin/bash

# Build script for creating standalone native host packages

echo "Building native host packages..."

# Create packages directory if it doesn't exist
mkdir -p packages/native-host

# Create temporary build directories
BUILD_DIR=$(mktemp -d)
WINDOWS_DIR="$BUILD_DIR/funscript-organizer-native-host-windows"
UNIX_DIR="$BUILD_DIR/funscript-organizer-native-host-unix"

# === WINDOWS PACKAGE ===
echo "Preparing Windows package..."
mkdir -p "$WINDOWS_DIR"

# Copy core files for Windows
cp native-host/funscript_rename_host_v2.py "$WINDOWS_DIR/"
cp native-host/funscript_rename_host.json "$WINDOWS_DIR/"

# Copy Windows-specific installers
cp native-host/install_windows.bat "$WINDOWS_DIR/install.bat"
cp native-host/install_windows.ps1 "$WINDOWS_DIR/install.ps1"
cp native-host/uninstall_windows.bat "$WINDOWS_DIR/uninstall.bat"

# Create Windows-specific README
cat > "$WINDOWS_DIR/README.txt" << 'EOF'
Funscript Organizer Native Host - Windows
==========================================

INSTALLATION:
1. Make sure Python 3.6+ is installed from https://python.org
2. Double-click "install.bat" to install
   OR
   Right-click "install.ps1" → Run with PowerShell

VERIFY:
- Restart Firefox after installation
- Check Settings → Native Host Status in the extension

UNINSTALL:
- Run "uninstall.bat" to remove

REQUIREMENTS:
- Python 3.6 or higher (with PATH configured)
- Firefox browser
- Funscript Organizer extension

FILES:
- funscript_rename_host_v2.py - Main Python script
- funscript_rename_host.json - Configuration file
- install.bat - Easy installer (double-click)
- install.ps1 - PowerShell installer (more features)
- uninstall.bat - Uninstaller
EOF

# === LINUX/MACOS PACKAGE ===
echo "Preparing Linux/macOS package..."
mkdir -p "$UNIX_DIR"

# Copy core files for Unix
cp native-host/funscript_rename_host_v2.py "$UNIX_DIR/"
cp native-host/funscript_rename_host.json "$UNIX_DIR/"

# Copy Unix-specific installers
cp native-host/install.sh "$UNIX_DIR/install.sh"
cp native-host/uninstall.sh "$UNIX_DIR/uninstall.sh"

# Create Unix-specific README
cat > "$UNIX_DIR/README.md" << 'EOF'
# Funscript Organizer Native Host - Linux/macOS

## Installation

```bash
chmod +x install.sh
./install.sh
```

## Verify Installation
- Restart Firefox after installation
- Check Settings → Native Host Status in the extension

## Uninstallation

```bash
./uninstall.sh
```

## Requirements
- Python 3.6 or higher
- Firefox browser
- Funscript Organizer extension installed

## Files
- `funscript_rename_host_v2.py` - Main Python script
- `funscript_rename_host.json` - Configuration file
- `install.sh` - Installation script
- `uninstall.sh` - Uninstallation script

## Troubleshooting
If the native host doesn't connect:
1. Ensure Python 3 is installed: `python3 --version`
2. Check the Firefox console for errors
3. Verify the JSON file was created in the correct location
EOF

# Make Unix scripts executable
chmod +x "$UNIX_DIR/install.sh"
chmod +x "$UNIX_DIR/uninstall.sh"

# Create platform-specific archives

# Windows ZIP
echo "Creating Windows package..."
cd "$WINDOWS_DIR"
zip -r "../funscript-native-host-windows.zip" *
cd "$OLDPWD"
mv "$BUILD_DIR/funscript-native-host-windows.zip" "packages/native-host/"

# Linux/macOS tar.gz
echo "Creating Linux/macOS package..."
cd "$UNIX_DIR"
tar -czf "../funscript-native-host-unix.tar.gz" *
cd "$OLDPWD"
mv "$BUILD_DIR/funscript-native-host-unix.tar.gz" "packages/native-host/"

# Cleanup
rm -rf "$BUILD_DIR"

echo "✓ Native host packages created in packages/native-host/"
echo ""
echo "Created packages:"
echo "  - funscript-native-host-windows.zip (Windows only)"
echo "  - funscript-native-host-unix.tar.gz (Linux/macOS only)"
echo ""
echo "Each package contains only platform-specific files."


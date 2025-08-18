#!/bin/bash

# Installation script for Funscript Rename Host
# This script installs the native messaging host for Firefox

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_NAME="funscript_rename_host"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Installing Funscript Rename Native Host...${NC}"

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo -e "${YELLOW}Warning: This script is designed for Linux. You may need to adjust paths for your OS.${NC}"
fi

# Make the Python script executable
chmod +x "$SCRIPT_DIR/funscript_rename_host_v2.py"

# Update the manifest with the correct path
PYTHON_PATH="$SCRIPT_DIR/funscript_rename_host_v2.py"
sed -i "s|\"path\":.*|\"path\": \"$PYTHON_PATH\",|" "$SCRIPT_DIR/funscript_rename_host.json"

# Determine Firefox native messaging hosts directory
if [ -d "$HOME/.mozilla/native-messaging-hosts" ]; then
    TARGET_DIR="$HOME/.mozilla/native-messaging-hosts"
else
    # Create directory if it doesn't exist
    TARGET_DIR="$HOME/.mozilla/native-messaging-hosts"
    mkdir -p "$TARGET_DIR"
    echo -e "${YELLOW}Created native messaging hosts directory at: $TARGET_DIR${NC}"
fi

# Copy the manifest file
cp "$SCRIPT_DIR/funscript_rename_host.json" "$TARGET_DIR/"

echo -e "${GREEN}✓ Native host installed successfully!${NC}"
echo ""
echo "Installation complete. The native host has been installed to:"
echo "  $TARGET_DIR/funscript_rename_host.json"
echo ""
echo "The Python script is located at:"
echo "  $PYTHON_PATH"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "1. Make sure Python 3 is installed on your system"
echo "2. Restart Firefox after installation"
echo "3. Reinstall the extension if it was already installed"
echo "4. Check ~/.funscript_rename_host.log for debugging if issues occur"
echo ""
echo "To uninstall, run: ./uninstall.sh"
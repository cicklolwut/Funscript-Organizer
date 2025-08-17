#!/bin/bash

# Uninstallation script for Funscript Rename Host

set -e

HOST_NAME="funscript_rename_host"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Uninstalling Funscript Rename Native Host...${NC}"

# Remove from Firefox native messaging hosts directory
TARGET_FILE="$HOME/.mozilla/native-messaging-hosts/funscript_rename_host.json"

if [ -f "$TARGET_FILE" ]; then
    rm "$TARGET_FILE"
    echo -e "${GREEN}✓ Removed native host manifest${NC}"
else
    echo -e "${YELLOW}Native host manifest not found at: $TARGET_FILE${NC}"
fi

# Optionally remove log file
LOG_FILE="$HOME/.funscript_rename_host.log"
if [ -f "$LOG_FILE" ]; then
    read -p "Remove log file at $LOG_FILE? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm "$LOG_FILE"
        echo -e "${GREEN}✓ Removed log file${NC}"
    fi
fi

echo -e "${GREEN}Uninstallation complete!${NC}"
echo ""
echo "The native host has been removed from Firefox."
echo "The Python script remains in the current directory for reference."
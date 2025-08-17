#!/bin/bash

# Build script for Funscript Organizer Extension

echo "Building Funscript Organizer Extension..."

# Create build directory
mkdir -p build

# Copy essential extension files
cp manifest.json build/
cp background_v2.js build/
cp popup.html build/
cp popup.js build/
cp popup.css build/
cp window.html build/
cp window.css build/
cp icon-*.png build/

# Create XPI package
cd build
zip -r ../funscript-organizer.xpi *
cd ..

echo "✓ Extension packaged as funscript-organizer.xpi"
echo ""
echo "Installation options:"
echo ""
echo "Option 1 - Firefox Developer Edition (Recommended):"
echo "  1. Open Firefox Developer Edition"
echo "  2. Go to about:debugging"
echo "  3. Click 'This Firefox'"
echo "  4. Click 'Load Temporary Add-on'"
echo "  5. Select funscript-organizer.xpi"
echo ""
echo "Option 2 - Firefox Release (Self-signed):"
echo "  1. Install web-ext: npm install -g web-ext"
echo "  2. Run: web-ext sign --api-key=YOUR_KEY --api-secret=YOUR_SECRET"
echo "  3. Get API keys from: https://addons.mozilla.org/developers/addon/api/key/"
echo ""
echo "Option 3 - Firefox Nightly/Dev (Unsigned):"
echo "  1. Open about:config"
echo "  2. Set xpinstall.signatures.required = false"
echo "  3. Install the .xpi file directly"
echo ""
echo "✓ Build complete!"
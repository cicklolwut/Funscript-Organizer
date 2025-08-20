# Funscript Organizer v0.1.4 - Firefox Extension for Auto File Organization

Just released an update to my Firefox extension that helps organize funscripts and videos automatically. It can detect downloads, match files based on similarity, and move them to organized folders.

## What's New in 0.1.4
- **Subfolder organization**: Toggle to organize matched files by base name (test.funscript + test.mp4 go into a "test" folder)
- **Variant support**: "Is Variant" checkbox lets you add .roll.funscript, .pitch.funscript etc to existing matched folders without renaming
- **Better Windows support**: Simple double-click installers for the native host component
- **Cross-platform packages**: Separate downloads for Windows vs Linux/Mac to avoid confusion

## How It Works
The extension watches your downloads and specified folders for new funscripts and videos. When it finds potential matches, it shows you a probability score and lets you rename/organize them. You can batch process multiple files or handle variants individually.

## Installation
1. Download the `.xpi` file and platform-specific native host from the releases page
2. Install the extension by dragging the `.xpi` into Firefox
3. Run the installer script for your platform (Windows: double-click install.bat, Linux/Mac: run install.sh)
4. Restart Firefox

The native host handles the actual file operations since browser extensions can't move files directly.

## Looking for Testers
I develop on Linux so I need feedback from Mac and Windows users. If you try it out, let me know if the installation process works smoothly and if you run into any issues. The Windows installer should be pretty straightforward now but I can't test it myself.

Download from the releases page if you want to give it a shot. Any feedback appreciated!
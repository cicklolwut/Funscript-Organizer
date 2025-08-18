# Funscript Organizer - Pre-Release

Hey everyone! I built this Firefox extension to solve a problem I was having - downloading funscripts and videos separately and then having to manually figure out which ones go together. Got tired of that, so here we are.

## What it does

Basically tracks your downloads and tries to match up funscripts with their videos automatically. It's pretty decent at figuring out which files belong together, even when the naming is inconsistent.

The main thing is it shows you unmatched files in two columns and gives you probability scores for how likely files are to match. Green = probably right, orange = maybe, red = probably not. Click to rename and it handles the rest.

## Current status

This is a **pre-release** - it works but I'm still tweaking things. 

**Important: Linux only right now.** The native host (for actually renaming files) is just Python scripts that assume Unix paths. I'll port it to Windows/Mac when I have time, but for now it's Linux only.

The extension itself works on any OS, but you won't be able to actually rename files without the native host.

## Features that work

- Automatically tracks funscript and video downloads
- Smart matching algorithm that ignores brackets, creator tags, quality markers, etc.
- Visual interface with match confidence indicators
- One-click renaming with the native host
- Badge showing how many unmatched files you have
- Pop-out window if you want more space
- Dark/light themes and customization

## Installation

Download the `.xpi` from releases and install it in Firefox. If you want file renaming:

```bash
cd native-host
./install.sh
```

Requires Python 3. The install script sets up the native messaging host so the extension can actually rename your files.

## Known issues

- Complex extensions like `.funscript.twist` don't work great yet, just manually clear them
- Directory watching needs the native host
- Only works on Linux for now

## Feedback

This is my first Firefox extension so probably has rough edges. Let me know what breaks or what would make it more useful.

Will probably do a proper 1.0 release once I've fixed the obvious issues and ported to other platforms.
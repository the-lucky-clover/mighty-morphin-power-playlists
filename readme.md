# IINA Retain Playlist Plugin

Automatically saves and restores the IINA playlist across app restarts.  
Also includes **global bookmarks** with timestamp recall and a **sidebar view** for quick navigation.

## Installation

### Quick Install (GitHub)
1. Open IINA
2. Go to **IINA > Settings > Plugins**
3. Click the **+** button
4. Enter the repository URL and click install

### Manual Install (Development)
1. Clone or copy this repo
2. Symlink the plugin folder to IINA's plugins directory:
   ```sh
   ln -s /path/to/iina-retain-playlist ~/Library/Application\ Support/com.colliderli.iina/plugins/iina-retain-playlist.iinaplugin-dev
   ```
3. Restart IINA

## Usage

The plugin runs automatically once installed.  
Configure it in **IINA > Settings > Plugins > Retain Playlist > Preferences**.

## Features

### Persistent Playlist
- Saves playlist when files are loaded or window closes
- Restores playlist on next launch
- Toggle each behavior independently

### Global Bookmarks
- Save timestamped bookmarks for any video
- Bookmarks are indexed by file path and time
- Recall with one click from the sidebar
- Optionally auto-save position when a file loads

### Sidebar View
- Opens a **Playlist & Bookmarks** tab in the IINA sidebar
- Shows current playlist with playback status
- Lists all saved bookmarks with formatted timestamps
- Click any item to play or seek directly
- **Bookmark** button to save the current position

### Thumbnails (Experimental)
- Optional low-resolution thumbnail generation for sidebar items
- Reduces data usage while browsing
- Toggle in preferences (may affect performance)

## File Structure

- `Info.json` - Plugin manifest
- `main.js` - Player instance logic (playlist, bookmarks, sidebar)
- `global.js` - Global entry point
- `preferences.html` - Settings page
- `sidebar.html` - Sidebar webview UI
- `readme.md` - This file

## Notes

- Data is stored in the plugin's `@data/` directory
- Plugins are loaded from `~/Library/Application Support/com.colliderli.iina/plugins/`

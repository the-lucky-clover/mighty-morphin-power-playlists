const { event, playlist, file, preferences, console, mpv, core, sidebar } = iina;
const DATA_DIR = "@data";
const PLAYLIST_FILE = `${DATA_DIR}/saved-playlist.json`;
const BOOKMARK_FILE = `${DATA_DIR}/bookmarks.json`;
const SIDEBAR_FILE = "sidebar.html";

function getSettings() {
  return {
    autoRestorePlaylist: preferences.get("autoRestorePlaylist") !== false,
    savePlaylistOnFileLoaded: preferences.get("savePlaylistOnFileLoaded") !== false,
    savePlaylistOnWindowClose: preferences.get("savePlaylistOnWindowClose") !== false,
    enableBookmarks: preferences.get("enableBookmarks") !== false,
    autoSaveBookmark: preferences.get("autoSaveBookmark") !== false,
    showSidebarPlaylist: preferences.get("showSidebarPlaylist") !== false,
    showSidebarBookmarks: preferences.get("showSidebarBookmarks") !== false,
    generateThumbnails: preferences.get("generateThumbnails") === true,
    highlightDuplicates: preferences.get("highlightDuplicates") !== false,
    playlistSortField: preferences.get("playlistSortField") || "dateAdded",
    playlistSortDirection: preferences.get("playlistSortDirection") || "desc",
    resumeLastPlayback: preferences.get("resumeLastPlayback") !== false,
    clearSavedPlaylist: preferences.get("clearSavedPlaylist") === true,
    clearBookmarks: preferences.get("clearBookmarks") === true
  };
}

function savePlaylist() {
  const items = playlist.list();
  if (!items || items.length === 0) {
    return;
  }
  const seen = new Set();
  let dupCount = 0;
  const mapped = items.map((item) => {
    const title = item.title || item.filename.split("/").pop();
    const isDuplicate = seen.has(item.filename);
    if (isDuplicate) dupCount++;
    seen.add(item.filename);
    return {
      filename: item.filename,
      title,
      isDuplicate,
      dateAdded: Date.now(),
      playCount: 0
    };
  });
  const settings = getSettings();
  const lastTimePos = settings.resumeLastPlayback ? mpv.getNumber("time-pos") : undefined;
  const lastPlayedFile = settings.resumeLastPlayback ? core.status.url : undefined;
  const data = {
    timestamp: Date.now(),
    duplicateCount: dupCount,
    playlistSortField: settings.playlistSortField,
    playlistSortDirection: settings.playlistSortDirection,
    lastPlayedFile,
    lastTimePos,
    items: mapped
  };
  try {
    file.write(PLAYLIST_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log(`Failed to save playlist: ${e.message}`);
  }
}

function restorePlaylist() {
  const settings = getSettings();
  if (!settings.autoRestorePlaylist) {
    return;
  }
  if (settings.clearSavedPlaylist) {
    try {
      file.delete(PLAYLIST_FILE);
    } catch (e) {
      console.log(`Failed to clear playlist: ${e.message}`);
    }
    preferences.set("clearSavedPlaylist", false);
    preferences.sync();
    return;
  }
  try {
    const content = file.read(PLAYLIST_FILE);
    if (!content) {
      return;
    }
    const data = JSON.parse(content);
    if (!data.items || data.items.length === 0) {
      return;
    }
    const currentItems = playlist.list();
    if (currentItems.length > 0) {
      return;
    }
    if (data.playlistSortField) {
      preferences.set("playlistSortField", data.playlistSortField);
    }
    if (data.playlistSortDirection) {
      preferences.set("playlistSortDirection", data.playlistSortDirection);
    }
    if (settings.resumeLastPlayback && data.lastPlayedFile && typeof data.lastTimePos === "number") {
      let targetIndex = -1;
      data.items.forEach((item, index) => {
        playlist.add(item.filename, index);
        if (item.filename === data.lastPlayedFile) {
          targetIndex = index;
        }
      });
      preferences.sync();
      if (targetIndex >= 0) {
        playlist.play(targetIndex);
        setTimeout(() => {
          core.seekTo(data.lastTimePos);
        }, 600);
      }
    } else {
      data.items.forEach((item, index) => {
        playlist.add(item.filename, index);
      });
      preferences.sync();
    }
    console.log(`Restored ${data.items.length} playlist items`);
  } catch (e) {
    console.log(`Failed to restore playlist: ${e.message}`);
  }
}

function saveBookmark() {
  const settings = getSettings();
  if (!settings.enableBookmarks) {
    return;
  }
  try {
    const timePos = mpv.getNumber("time-pos");
    const filename = core.status.url;
    const title = core.status.title || filename.split("/").pop();
    let bookmarks = [];
    try {
      const content = file.read(BOOKMARK_FILE);
      if (content) {
        bookmarks = JSON.parse(content);
      }
    } catch (e) {
      bookmarks = [];
    }
    const existing = bookmarks.findIndex(b => b.filename === filename && Math.abs(b.time - timePos) < 5);
    if (existing >= 0) {
      bookmarks[existing].time = timePos;
      bookmarks[existing].title = title;
      bookmarks[existing].updatedAt = Date.now();
      console.log(`Updated existing bookmark: ${title} @ ${formatTime(timePos)}`);
    } else {
      bookmarks.push({
        filename,
        title,
        time: timePos,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      console.log(`Saved new bookmark: ${title} @ ${formatTime(timePos)}`);
    }
    bookmarks.sort((a, b) => b.updatedAt - a.updatedAt);
    file.write(BOOKMARK_FILE, JSON.stringify(bookmarks, null, 2));
  } catch (e) {
    console.log(`Failed to save bookmark: ${e.message}`);
  }
}

function restoreBookmarks() {
  const settings = getSettings();
  if (!settings.enableBookmarks) {
    return;
  }
  if (settings.clearBookmarks) {
    try {
      file.delete(BOOKMARK_FILE);
    } catch (e) {
      console.log(`Failed to clear bookmarks: ${e.message}`);
    }
    preferences.set("clearBookmarks", false);
    preferences.sync();
    return;
  }
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getPlaylistData() {
  const items = playlist.list();
  const savedPlaylist = readSavedPlaylistSync();
  const playCounts = {};
  if (savedPlaylist) {
    savedPlaylist.items.forEach((item) => {
      playCounts[item.filename] = item.playCount || 0;
    });
  }
  return items.map(item => {
    const entry = savedPlaylist?.items?.find(i => i.filename === item.filename);
    return {
      filename: item.filename,
      title: item.title || item.filename.split("/").pop(),
      isPlaying: item.isPlaying,
      isDuplicate: entry?.isDuplicate === true,
      dateAdded: entry?.dateAdded || Date.now(),
      playCount: playCounts[item.filename] || 0
    };
  });
}

function readSavedPlaylistSync() {
  try {
    const content = file.read(PLAYLIST_FILE);
    if (!content) return null;
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

function getCurrentItemData() {
  return {
    filename: core.status.url,
    title: core.status.title,
    timePos: mpv.getNumber("time-pos"),
    duration: mpv.getNumber("duration")
  };
}

function getBookmarkData() {
  try {
    const content = file.read(BOOKMARK_FILE);
    if (!content) {
      return [];
    }
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}

function sortPlaylist(items, field, direction) {
  const sorted = [...items];
  const key = (item) => {
    switch (field) {
      case "name":
        return (item.title || item.filename || "").toLowerCase();
      case "dateAdded":
        return item.dateAdded || 0;
      case "playCount":
        return item.playCount || 0;
      case "filepath":
        return (item.filename || "").toLowerCase();
      case "plays":
      default:
        return item.playCount || 0;
    }
  };
  sorted.sort((a, b) => {
    const va = key(a);
    const vb = key(b);
    if (va < vb) return direction === "asc" ? -1 : 1;
    if (va > vb) return direction === "asc" ? 1 : -1;
    return 0;
  });
  return sorted;
}

function incrementPlayCount(filename) {
  const saved = readSavedPlaylistSync();
  if (!saved || !saved.items) return;
  let updated = false;
  saved.items.forEach((item) => {
    if (item.filename === filename) {
      item.playCount = (item.playCount || 0) + 1;
      updated = true;
    }
  });
  if (updated) {
    file.write(PLAYLIST_FILE, JSON.stringify(saved, null, 2));
  }
}

function initSidebar() {
  const settings = getSettings();
  if (!settings.showSidebarPlaylist && !settings.showSidebarBookmarks) {
    return;
  }
  sidebar.loadFile(SIDEBAR_FILE);
  sidebar.onMessage("init", () => {
    const data = {
      type: "init",
      playlistEnabled: settings.showSidebarPlaylist,
      bookmarksEnabled: settings.showSidebarBookmarks,
      playlist: settings.showSidebarPlaylist ? getPlaylistData() : [],
      bookmarks: settings.showSidebarBookmarks ? getBookmarkData() : [],
      currentItem: getCurrentItemData(),
      duplicateCount: readSavedPlaylistSync()?.duplicateCount || 0,
      sortField: settings.playlistSortField,
      sortDirection: settings.playlistSortDirection
    };
    sidebar.postMessage("init", data);
  });
  sidebar.onMessage("sortPlaylist", (data) => {
    if (!data || !data.field) return;
    preferences.set("playlistSortField", data.field);
    const newDir = data.direction || (settings.playlistSortField === data.field && settings.playlistSortDirection === "asc" ? "desc" : "asc");
    preferences.set("playlistSortDirection", newDir);
    preferences.sync();
    const sorted = sortPlaylist(getPlaylistData(), data.field, newDir);
    sidebar.postMessage("playlistSorted", {
      playlist: sorted,
      sortField: data.field,
      sortDirection: newDir,
      duplicateCount: readSavedPlaylistSync()?.duplicateCount || 0
    });
  });
  sidebar.onMessage("playItem", (data) => {
    if (!data) return;
    const items = playlist.list();
    if (data.index !== undefined && data.index >= 0 && data.index < items.length) {
      playlist.play(data.index);
    } else if (data.filename) {
      const index = items.findIndex(item => item.filename === data.filename);
      if (index >= 0) {
        playlist.play(index);
      } else {
        playlist.add(data.filename);
      }
    }
  });
  sidebar.onMessage("seekToTime", (data) => {
    if (data && typeof data.time === "number") {
      core.seekTo(data.time);
    }
  });
  sidebar.onMessage("openBookmark", (data) => {
    if (data && data.filename) {
      core.open(data.filename);
      setTimeout(() => {
        if (typeof data.time === "number") {
          core.seekTo(data.time);
        }
      }, 500);
    }
  });
  sidebar.onMessage("deleteBookmark", (data) => {
    if (!data || !data.filename) {
      return;
    }
    try {
      let bookmarks = [];
      try {
        const content = file.read(BOOKMARK_FILE);
        if (content) {
          bookmarks = JSON.parse(content);
        }
      } catch (e) {
        bookmarks = [];
      }
      const filtered = bookmarks.filter(b => b.filename !== data.filename || (data.time !== undefined && Math.abs(b.time - data.time) > 2));
      file.write(BOOKMARK_FILE, JSON.stringify(filtered, null, 2));
      sidebar.postMessage("bookmarksUpdated", { bookmarks: filtered });
    } catch (e) {
      console.log(`Failed to delete bookmark: ${e.message}`);
    }
  });
  sidebar.onMessage("addBookmark", () => {
    saveBookmark();
    sidebar.postMessage("bookmarksUpdated", { bookmarks: getBookmarkData() });
  });
}

event.on("iina.window-loaded", () => {
  restorePlaylist();
  restoreBookmarks();
  initSidebar();
});

event.on("iina.window-will-close", () => {
  const settings = getSettings();
  if (settings.savePlaylistOnWindowClose) {
    savePlaylist();
  }
});

event.on("iina.file-loaded", () => {
  const settings = getSettings();
  if (settings.savePlaylistOnFileLoaded) {
    savePlaylist();
  }
  if (settings.autoSaveBookmark) {
    saveBookmark();
  }
});

event.on("iina.file-started", () => {
  if (sidebar) {
    sidebar.postMessage("currentChanged", getCurrentItemData());
  }
});

event.on("mpv.time-pos.changed", () => {
  if (sidebar) {
    sidebar.postMessage("timeUpdated", {
      timePos: mpv.getNumber("time-pos"),
      filename: core.status.url
    });
  }
});

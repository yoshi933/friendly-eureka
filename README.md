# Better Classroom UX

A **Manifest V3 Chrome Extension** that enhances Google Classroom with cross-stream search, post pinning, a dashboard overview, push notifications, and general UI improvements.

> ⚠️ **Compliance notice**: Please verify compliance with your school's terms of service and administrator policies before installing or using this extension.

---

## Features (Roadmap)

| Priority | Feature | Status |
|---|---|---|
| 1 | **Cross-stream search** – filter posts by keyword, author, attachment type, and course | 🚧 MVP |
| 2 | **Pin posts** – save post IDs and anchor them at the top of the stream | 📋 Planned |
| 3 | **Dashboard** – overlay with latest posts, deadline sort, and unread summary | 📋 Planned |
| 4 | **Push notifications** – `chrome.notifications` for new posts with click-to-navigate | 📋 Planned |
| 5 | **UI improvements** – card rearrangement, colour coding, spacing, sidebar panel | 📋 Planned |

---

## Architecture

```
manifest.json        Manifest V3 – permissions & entry points
background.js        Service worker – polling alarm, notifications
selectors.js         Centralised DOM selector definitions (content script)
storage.js           Storage module – chrome.storage.local + IndexedDB (content script)
content.js           Main content script – scraping, search UI injection
styles/
  content.css        Injected styles for the search bar and results panel
  options.css        Options page styles
options.html         Extension options page
options.js           Options page logic
icons/               Extension icons (16 × 16, 48 × 48, 128 × 128)
```

### Data storage

| Data | Storage |
|---|---|
| Settings (notifications, poll interval) | `chrome.storage.local` |
| Pinned post IDs | `chrome.storage.local` |
| Post / stream cache | IndexedDB (`BetterClassroomUX` database) |

### Permissions

| Permission | Reason |
|---|---|
| `storage` | Persist settings and pinned post IDs |
| `notifications` | Show push notifications for new posts |
| `https://classroom.google.com/*` | Read and manipulate the Classroom DOM |

---

## Development

### Load the extension in Chrome

1. Open `chrome://extensions/`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this repository folder.

### File overview

- **`selectors.js`** – All CSS selectors for Classroom DOM elements are defined here. Update this file when Google Classroom changes its markup.
- **`storage.js`** – IndexedDB and `chrome.storage.local` helpers. Import via `window.BetterClassroomUX.storage`.
- **`content.js`** – Scrapes visible stream posts into IndexedDB and injects the search bar UI.
- **`background.js`** – Service worker that handles notifications and the polling alarm.

---

## Development Roadmap

1. **MVP** – Cross-stream search + basic UI improvements ← *current phase*
2. **Pin + Dashboard** – Post pinning and home dashboard overlay
3. **Notifications + Settings** – Push notifications and full options page
4. **Testing, publishing, documentation**

---

## Privacy

All data is stored **locally on your device**. Nothing is transmitted to external servers.

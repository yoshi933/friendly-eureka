/**
 * storage.js
 *
 * Local data storage module for Better Classroom UX.
 *
 * - Settings and pinned post IDs  → chrome.storage.local (wrapped with
 *   a localStorage-like API for simplicity).
 * - Post / stream cache           → IndexedDB via a thin promise wrapper.
 *
 * Exposed on window.BetterClassroomUX.storage
 */

(function (global) {
  "use strict";

  /* ------------------------------------------------------------------ */
  /*  Constants                                                           */
  /* ------------------------------------------------------------------ */

  const DB_NAME = "BetterClassroomUX";
  const DB_VERSION = 1;
  const STORE_POSTS = "posts";

  /* ------------------------------------------------------------------ */
  /*  chrome.storage.local helpers (settings / pins)                     */
  /* ------------------------------------------------------------------ */

  /**
   * Retrieve a value from chrome.storage.local.
   * @param {string} key
   * @returns {Promise<any>}
   */
  function getLocalSetting(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] ?? null);
      });
    });
  }

  /**
   * Persist a value in chrome.storage.local.
   * @param {string} key
   * @param {any} value
   * @returns {Promise<void>}
   */
  function setLocalSetting(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Pinned posts helpers                                                */
  /* ------------------------------------------------------------------ */

  const PINS_KEY = "pinnedPostIds";

  async function getPinnedPostIds() {
    return (await getLocalSetting(PINS_KEY)) ?? [];
  }

  async function pinPost(postId) {
    const pins = await getPinnedPostIds();
    if (!pins.includes(postId)) {
      pins.unshift(postId);
      await setLocalSetting(PINS_KEY, pins);
    }
  }

  async function unpinPost(postId) {
    const pins = await getPinnedPostIds();
    const updated = pins.filter((id) => id !== postId);
    await setLocalSetting(PINS_KEY, updated);
  }

  /* ------------------------------------------------------------------ */
  /*  IndexedDB – post cache                                              */
  /* ------------------------------------------------------------------ */

  let _db = null;

  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_POSTS)) {
          const store = db.createObjectStore(STORE_POSTS, { keyPath: "id" });
          store.createIndex("courseId", "courseId", { unique: false });
          store.createIndex("author", "author", { unique: false });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };

      req.onsuccess = (event) => {
        _db = event.target.result;
        resolve(_db);
      };

      req.onerror = (event) => {
        console.error("[BetterClassroomUX] IndexedDB open error", event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Upsert a post object into the IndexedDB cache.
   * @param {{ id: string, courseId: string, author: string, body: string, timestamp: number, attachmentTypes: string[] }} post
   */
  async function cachePost(post) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_POSTS, "readwrite");
      tx.objectStore(STORE_POSTS).put(post);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Retrieve all cached posts (optionally filtered by courseId).
   * @param {string} [courseId]
   * @returns {Promise<object[]>}
   */
  async function getCachedPosts(courseId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_POSTS, "readonly");
      let req;
      if (courseId) {
        const index = tx.objectStore(STORE_POSTS).index("courseId");
        req = index.getAll(courseId);
      } else {
        req = tx.objectStore(STORE_POSTS).getAll();
      }
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Delete all cached posts (e.g., on settings reset).
   */
  async function clearPostCache() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_POSTS, "readwrite");
      tx.objectStore(STORE_POSTS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                          */
  /* ------------------------------------------------------------------ */

  global.BetterClassroomUX = global.BetterClassroomUX || {};
  global.BetterClassroomUX.storage = {
    getLocalSetting,
    setLocalSetting,
    getPinnedPostIds,
    pinPost,
    unpinPost,
    cachePost,
    getCachedPosts,
    clearPostCache,
  };
})(window);

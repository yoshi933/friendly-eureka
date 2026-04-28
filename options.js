/**
 * options.js
 *
 * Logic for the Better Classroom UX options / settings page.
 * Reads and writes settings via chrome.storage.local.
 */

"use strict";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const ns = window.BetterClassroomUX;
if (!ns?.storage) {
  console.error("[BetterClassroomUX] storage.js dependency not loaded. Options page may not function correctly.");
}

const { storage } = ns ?? { storage: null };

function $(id) {
  return document.getElementById(id);
}

/* ------------------------------------------------------------------ */
/*  Load settings into the form                                         */
/* ------------------------------------------------------------------ */

async function loadSettings() {
  const notificationsEnabled = await storage.getLocalSetting("notificationsEnabled");
  const pollIntervalMinutes = await storage.getLocalSetting("pollIntervalMinutes");

  $("notificationsEnabled").checked = notificationsEnabled !== false; // default: true
  $("pollInterval").value = pollIntervalMinutes ?? 5;

  // Load stats
  try {
    const posts = await storage.getCachedPosts();
    $("cachedPostCount").textContent = posts.length;
  } catch {
    $("cachedPostCount").textContent = "N/A";
  }

  try {
    const pins = await storage.getPinnedPostIds();
    $("pinnedPostCount").textContent = pins.length;
  } catch {
    $("pinnedPostCount").textContent = "N/A";
  }
}

/* ------------------------------------------------------------------ */
/*  Save settings                                                       */
/* ------------------------------------------------------------------ */

async function saveSettings() {
  const notificationsEnabled = $("notificationsEnabled").checked;
  const pollIntervalMinutes = parseInt($("pollInterval").value, 10) || 5;

  await storage.setLocalSetting("notificationsEnabled", notificationsEnabled);
  await storage.setLocalSetting("pollIntervalMinutes", pollIntervalMinutes);

  // Inform the background service worker so it can re-register the alarm
  chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" });

  showStatus("Settings saved ✓", false);
}

/* ------------------------------------------------------------------ */
/*  Cache / pin management                                              */
/* ------------------------------------------------------------------ */

async function clearCache() {
  if (!confirm("Clear all cached posts? This cannot be undone.")) return;
  await storage.clearPostCache();
  $("cachedPostCount").textContent = "0";
  showStatus("Post cache cleared.", false);
}

async function clearPins() {
  if (!confirm("Clear all pinned posts?")) return;
  await storage.setLocalSetting("pinnedPostIds", []);
  $("pinnedPostCount").textContent = "0";
  showStatus("Pins cleared.", false);
}

/* ------------------------------------------------------------------ */
/*  UI feedback                                                         */
/* ------------------------------------------------------------------ */

let statusTimer = null;

function showStatus(message, isError = false) {
  const el = $("saveStatus");
  el.textContent = message;
  el.className = "bcux-save-status" + (isError ? " bcux-save-status--error" : " bcux-save-status--ok");
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    el.textContent = "";
    el.className = "bcux-save-status";
  }, 3000);
}

/* ------------------------------------------------------------------ */
/*  Event listeners                                                     */
/* ------------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();

  $("saveBtn").addEventListener("click", saveSettings);
  $("clearCacheBtn").addEventListener("click", clearCache);
  $("clearPinsBtn").addEventListener("click", clearPins);
});

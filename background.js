/**
 * background.js
 *
 * Background service worker for Better Classroom UX (Manifest V3).
 *
 * Responsibilities (scaffolded for MVP, extended in future phases):
 *  - Listen for messages from content scripts.
 *  - Poll for new posts and send chrome.notifications (Phase 3).
 *  - Handle notification click events to navigate to the relevant post.
 */

"use strict";

/* ------------------------------------------------------------------ */
/*  Extension lifecycle                                                  */
/* ------------------------------------------------------------------ */

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    console.log("[BetterClassroomUX] Extension installed.");
    // Set default settings on first install
    chrome.storage.local.set({
      notificationsEnabled: true,
      pollIntervalMinutes: 5,
      pinnedPostIds: [],
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Message handling (from content scripts)                             */
/* ------------------------------------------------------------------ */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "NOTIFY_NEW_POST":
      handleNewPostNotification(message.payload);
      sendResponse({ ok: true });
      break;

    case "OPEN_POST":
      openPostTab(message.payload.url);
      sendResponse({ ok: true });
      break;

    default:
      // Unknown message type – ignore
      break;
  }
  // Return true to keep the channel open for async responses if needed
  return true;
});

/* ------------------------------------------------------------------ */
/*  Notification helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Show a Chrome notification for a new post.
 * @param {{ id: string, author: string, body: string, url?: string }} post
 */
async function handleNewPostNotification(post) {
  const { notificationsEnabled } = await chrome.storage.local.get(["notificationsEnabled"]);
  if (!notificationsEnabled) return;

  const notificationId = `bcux-post-${post.id}`;
  chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "icons/icon48.png",
    title: `New post from ${post.author}`,
    message: post.body ? post.body.slice(0, 100) : "New post in Google Classroom",
    priority: 1,
  });
}

/* ------------------------------------------------------------------ */
/*  Notification click → navigate to post                              */
/* ------------------------------------------------------------------ */

chrome.notifications.onClicked.addListener((notificationId) => {
  if (!notificationId.startsWith("bcux-post-")) return;

  // Dismiss the notification
  chrome.notifications.clear(notificationId);

  // Navigate to Google Classroom stream (post-specific deep-link not always available)
  chrome.tabs.create({ url: "https://classroom.google.com/" });
});

/* ------------------------------------------------------------------ */
/*  Polling alarm (Phase 3 – scaffolded here)                           */
/* ------------------------------------------------------------------ */

/**
 * Register a repeating alarm for polling new posts.
 * The alarm handler queries Classroom and dispatches NOTIFY_NEW_POST
 * messages to active Classroom tabs.
 */
async function registerPollingAlarm() {
  const { pollIntervalMinutes } = await chrome.storage.local.get(["pollIntervalMinutes"]);
  const interval = pollIntervalMinutes ?? 5;

  // Clear any existing alarm first to avoid duplicates
  await chrome.alarms.clear("bcux-poll");
  chrome.alarms.create("bcux-poll", { periodInMinutes: interval });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "bcux-poll") return;
  pollClassroom();
});

/**
 * Placeholder polling function.
 * In Phase 3 this will scrape / call the Classroom API and
 * send notifications for genuinely new posts.
 */
async function pollClassroom() {
  // TODO (Phase 3): Query the Classroom API or send a message to
  //   active Classroom content scripts to scrape fresh posts,
  //   compare against the IndexedDB cache, and notify on deltas.
  console.log("[BetterClassroomUX] pollClassroom() – placeholder");
}

// Register the polling alarm when the service worker starts
registerPollingAlarm();

/* ------------------------------------------------------------------ */
/*  Tab helper                                                           */
/* ------------------------------------------------------------------ */

function openPostTab(url) {
  if (!url) return;
  chrome.tabs.create({ url });
}

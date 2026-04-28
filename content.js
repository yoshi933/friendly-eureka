/**
 * content.js
 *
 * Main content script for Better Classroom UX.
 * Runs on https://classroom.google.com/* at document_idle.
 *
 * Responsibilities (MVP):
 *  1. Scrape visible stream posts into the local IndexedDB cache.
 *  2. Inject the cross-search UI bar into the page.
 *  3. Handle search queries against the cached posts.
 *
 * Depends on:
 *  - selectors.js  (window.BetterClassroomUX.SELECTORS)
 *  - storage.js    (window.BetterClassroomUX.storage)
 */

(function () {
  "use strict";

  const { SELECTORS, storage } = window.BetterClassroomUX;

  /* ------------------------------------------------------------------ */
  /*  Utility helpers                                                     */
  /* ------------------------------------------------------------------ */

  /** Safely query-select the first matching element. */
  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  /** Safely query-select all matching elements. */
  function qsAll(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  /** Generate a simple hash-like ID from a string (for post deduplication). */
  function hashId(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    }
    return String(Math.abs(hash));
  }

  /* ------------------------------------------------------------------ */
  /*  Post scraping                                                       */
  /* ------------------------------------------------------------------ */

  /**
   * Extract a structured post object from a stream card DOM element.
   * @param {Element} card
   * @returns {object|null}
   */
  function extractPost(card) {
    try {
      const authorEl = qs(SELECTORS.postAuthor, card);
      const bodyEl = qs(SELECTORS.postBody, card);
      const tsEl = qs(SELECTORS.postTimestamp, card);
      const attachmentsEl = qs(SELECTORS.postAttachments, card);

      const author = authorEl?.textContent?.trim() ?? "";
      const body = bodyEl?.textContent?.trim() ?? "";
      const timestamp = tsEl?.getAttribute("datetime") ?? tsEl?.textContent?.trim() ?? "";
      const attachmentTypes = attachmentsEl
        ? qsAll("[data-mime-type], [aria-label]", attachmentsEl)
            .map((el) => el.getAttribute("data-mime-type") || el.getAttribute("aria-label") || "")
            .filter(Boolean)
        : [];

      // Use the card's data attributes if available, otherwise generate a stable ID
      const id =
        card.getAttribute("data-stream-id") ||
        card.getAttribute("data-item-id") ||
        hashId(author + body + timestamp);

      // Try to extract the current course ID from the URL
      const courseIdMatch = location.pathname.match(/\/c\/([^/]+)/);
      const courseId = courseIdMatch ? courseIdMatch[1] : "unknown";

      return { id, courseId, author, body, timestamp, attachmentTypes };
    } catch (err) {
      console.warn("[BetterClassroomUX] Failed to extract post", err);
      return null;
    }
  }

  /**
   * Scrape all visible stream cards and upsert them into IndexedDB.
   */
  async function scrapeAndCachePosts() {
    const cards = qsAll(SELECTORS.streamCard);
    for (const card of cards) {
      const post = extractPost(card);
      if (post) {
        await storage.cachePost(post);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Simple keyword search (client-side, no external library)           */
  /*  Fuse.js or a similar fuzzy-search library can be integrated later. */
  /* ------------------------------------------------------------------ */

  /**
   * Filter a list of post objects using the given query options.
   * @param {object[]} posts
   * @param {{ keyword?: string, author?: string, courseId?: string, attachmentType?: string }} query
   * @returns {object[]}
   */
  function filterPosts(posts, query) {
    const kw = query.keyword?.toLowerCase() ?? "";
    const author = query.author?.toLowerCase() ?? "";
    const courseId = query.courseId ?? "";
    const attachmentType = query.attachmentType?.toLowerCase() ?? "";

    return posts.filter((post) => {
      if (kw && !post.body.toLowerCase().includes(kw) && !post.author.toLowerCase().includes(kw)) {
        return false;
      }
      if (author && !post.author.toLowerCase().includes(author)) {
        return false;
      }
      if (courseId && post.courseId !== courseId) {
        return false;
      }
      if (
        attachmentType &&
        !post.attachmentTypes.some((t) => t.toLowerCase().includes(attachmentType))
      ) {
        return false;
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Search UI rendering                                                  */
  /* ------------------------------------------------------------------ */

  const SEARCH_BAR_ID = "bcux-search-bar";

  /**
   * Build and inject the cross-search bar into the page.
   * No-ops if the bar already exists.
   */
  function injectSearchUI() {
    if (document.getElementById(SEARCH_BAR_ID)) return;

    const container = document.createElement("div");
    container.id = SEARCH_BAR_ID;
    container.setAttribute("role", "search");
    container.setAttribute("aria-label", "Better Classroom UX search");
    container.innerHTML = `
      <div class="bcux-search-inner">
        <span class="bcux-search-icon" aria-hidden="true">&#128269;</span>
        <input
          id="bcux-search-input"
          class="bcux-search-input"
          type="search"
          placeholder="Search posts by keyword, author…"
          aria-label="Search classroom posts"
          autocomplete="off"
        />
        <select id="bcux-filter-course" class="bcux-filter-select" aria-label="Filter by course">
          <option value="">All courses</option>
        </select>
        <button id="bcux-search-btn" class="bcux-search-btn" type="button">Search</button>
      </div>
      <div id="bcux-search-results" class="bcux-search-results" aria-live="polite" aria-label="Search results"></div>
    `;

    // Insert before the main content area, or prepend to body as fallback
    const mainContent = qs(SELECTORS.mainContent);
    if (mainContent) {
      mainContent.insertAdjacentElement("beforebegin", container);
    } else {
      document.body.insertAdjacentElement("afterbegin", container);
    }

    // Attach event listeners
    const searchBtn = document.getElementById("bcux-search-btn");
    const searchInput = document.getElementById("bcux-search-input");

    searchBtn.addEventListener("click", handleSearch);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSearch();
    });
  }

  /**
   * Populate the course filter <select> with unique course IDs from the cache.
   */
  async function populateCourseFilter() {
    const select = document.getElementById("bcux-filter-course");
    if (!select) return;

    const posts = await storage.getCachedPosts();
    const courseIds = [...new Set(posts.map((p) => p.courseId).filter((id) => id && id !== "unknown"))];

    // Remove previously added options (keep the "All courses" default)
    Array.from(select.options).slice(1).forEach((opt) => opt.remove());

    courseIds.forEach((id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = `Course ${id}`;
      select.appendChild(opt);
    });
  }

  /**
   * Run search and render results in the results panel.
   */
  async function handleSearch() {
    const keyword = document.getElementById("bcux-search-input")?.value?.trim() ?? "";
    const courseId = document.getElementById("bcux-filter-course")?.value ?? "";
    const resultsPanel = document.getElementById("bcux-search-results");
    if (!resultsPanel) return;

    if (!keyword && !courseId) {
      resultsPanel.innerHTML = "<p class='bcux-no-results'>Please enter a keyword or select a course to search.</p>";
      resultsPanel.classList.add("bcux-results-visible");
      return;
    }

    resultsPanel.innerHTML = "<p class='bcux-loading'>Searching…</p>";
    resultsPanel.classList.add("bcux-results-visible");

    try {
      const posts = await storage.getCachedPosts(courseId || undefined);
      const results = filterPosts(posts, { keyword, courseId });

      if (results.length === 0) {
        resultsPanel.innerHTML = "<p class='bcux-no-results'>No posts found.</p>";
        return;
      }

      const fragment = document.createDocumentFragment();
      results.forEach((post) => {
        const item = document.createElement("div");
        item.className = "bcux-result-item";
        item.setAttribute("data-post-id", post.id);
        item.innerHTML = `
          <div class="bcux-result-author">${escapeHtml(post.author)}</div>
          <div class="bcux-result-body">${escapeHtml(truncate(post.body, 200))}</div>
          <div class="bcux-result-meta">
            <span class="bcux-result-course">Course: ${escapeHtml(post.courseId)}</span>
            <span class="bcux-result-ts">${escapeHtml(post.timestamp)}</span>
          </div>
        `;
        fragment.appendChild(item);
      });

      resultsPanel.innerHTML = `<p class='bcux-results-count'>${results.length} result(s) found</p>`;
      resultsPanel.appendChild(fragment);
    } catch (err) {
      console.error("[BetterClassroomUX] Search error", err);
      resultsPanel.innerHTML = "<p class='bcux-error'>An error occurred while searching. Please try again.</p>";
    }
  }

  /* ------------------------------------------------------------------ */
  /*  String utilities                                                     */
  /* ------------------------------------------------------------------ */

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function truncate(str, maxLen) {
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen) + "…";
  }

  /* ------------------------------------------------------------------ */
  /*  MutationObserver – re-scrape when new posts are loaded             */
  /* ------------------------------------------------------------------ */

  let scrapeTimer = null;

  function scheduleScrape() {
    clearTimeout(scrapeTimer);
    scrapeTimer = setTimeout(async () => {
      await scrapeAndCachePosts();
      await populateCourseFilter();
    }, 800);
  }

  function observeStreamChanges() {
    const feed = qs(SELECTORS.streamFeed);
    const target = feed ?? document.body;

    const observer = new MutationObserver((mutations) => {
      const relevant = mutations.some(
        (m) =>
          m.addedNodes.length > 0 ||
          (m.type === "attributes" && m.attributeName === "data-stream-id")
      );
      if (relevant) scheduleScrape();
    });

    observer.observe(target, { childList: true, subtree: true, attributes: true });
  }

  /* ------------------------------------------------------------------ */
  /*  Initialisation                                                      */
  /* ------------------------------------------------------------------ */

  async function init() {
    injectSearchUI();
    await scrapeAndCachePosts();
    await populateCourseFilter();
    observeStreamChanges();
  }

  // Kick off once the DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

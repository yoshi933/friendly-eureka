/**
 * selectors.js
 *
 * Abstracted DOM selector definitions for Google Classroom.
 * Centralizing selectors here makes it easy to update when
 * Classroom's DOM structure changes (see "Risks and Countermeasures"
 * in the design document).
 *
 * All selectors are exposed as a plain object so that both
 * content.js and future modules can import them via:
 *   const { SELECTORS } = window.BetterClassroomUX;
 */

(function (global) {
  "use strict";

  const SELECTORS = {
    // Top-level stream feed container
    streamFeed: '[jsname="hs9bnb"], .QRiHXd, [data-stream-id]',

    // Individual stream / announcement cards
    streamCard: '.UVNjIc, [data-stream-entry], [jsmodel]',

    // Post author name inside a card
    postAuthor: '.YVvGBb, .o1hxjc, [data-author]',

    // Post body text inside a card
    postBody: '.gyXDqf, .PoSi2, [jsname="r4nke"]',

    // Attachment area inside a card
    postAttachments: '.nPDzT, [jsname="attachments"]',

    // Timestamp element inside a card
    postTimestamp: '.Z6Cobf, [jsname="timestamp"]',

    // Class header / title (visible on stream pages)
    classTitle: '.njBmSb, .nBzcnc, [data-courseid]',

    // Navigation / home page course cards
    courseCard: '.YVvGBb, .onkcGd, [data-courseid]',

    // The main content area where we inject our UI
    mainContent: '.pb-4Nc, .K4VTG, #main-content, [role="main"]',
  };

  // Attach to a shared namespace so all content-script files can use it
  global.BetterClassroomUX = global.BetterClassroomUX || {};
  global.BetterClassroomUX.SELECTORS = SELECTORS;
})(window);

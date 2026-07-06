/**
 * student-content.js
 * Loads real Resources and Announcements data from the backend
 * into the student-facing pages: dashboard.html and announcements.html.
 *
 * Load order (bottom of <body>, AFTER auth-guard.js and api.js):
 *   <script src="js/auth-guard.js"></script>
 *   <script src="js/api.js"></script>
 *   <script src="js/dashboard.js"></script>       ← existing page script
 *   <script src="js/student-content.js"></script> ← this file (load LAST)
 */

(function () {
  "use strict";

  /* ── ICON MAP for resource types ──────────────────────────────────────────── */
  var RESOURCE_ICON = {
    past_questions: "file-text",
    lecture_notes:  "file-text",
    handout:        "files",
    ebook:          "book-open",
  };

  var RESOURCE_BADGE = {
    past_questions: "badge--neutral",
    lecture_notes:  "badge--neutral",
    handout:        "badge--neutral",
    ebook:          "badge--neutral",
  };

  var ANNOUNCE_ICON = {
    general:    "megaphone",
    faculty:    "calendar-days",
    department: "book-open",
    urgent:     "alert-triangle",
  };

  var ANNOUNCE_BADGE = {
    general:    "badge--primary",
    faculty:    "badge--warning",
    department: "badge--accent",
    urgent:     "badge--danger",
  };

  var ANNOUNCE_ICON_STYLE = {
    general:    "background:var(--color-blue-soft);color:var(--color-blue)",
    faculty:    "background:var(--color-warning-soft);color:var(--color-warning)",
    department: "background:var(--color-primary-soft);color:var(--color-primary)",
    urgent:     "background:var(--color-danger-soft);color:var(--color-danger)",
  };

  /* ── HELPERS ─────────────────────────────────────────────────────────────── */

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function truncate(str, n) {
    str = str || "";
    return str.length > n ? str.slice(0, n).trim() + "…" : str;
  }

  function toast(message, type) {
    // Reuse the page's own toast system if present
    if (typeof window.showToast === "function") {
      window.showToast(message, type);
      return;
    }
    console.log("[toast:" + (type || "info") + "]", message);
  }

  /* ───────────────────────────────────────────────────────────────────────────
     RESOURCE HUB  (dashboard.html)
  ─────────────────────────────────────────────────────────────────────────── */

  function resourceCardHtml(r) {
    var icon  = RESOURCE_ICON[r.resource_type]  || "file-text";
    var badge = RESOURCE_BADGE[r.resource_type] || "badge--neutral";
    var label = r.resource_type_display || r.resource_type;

    return [
      '<article class="resource-card" data-resource-id="' + r.id + '">',
      '  <span class="resource-card__icon"><i data-lucide="' + icon + '"></i></span>',
      '  <div class="resource-card__body">',
      '    <span class="badge ' + badge + '">' + escapeHtml(label) + '</span>',
      '    <h3>' + escapeHtml(r.title) + '</h3>',
      '    <div class="resource-card__meta">',
      '      <span><i data-lucide="download" class="icon-xs"></i>' + (r.download_count || 0) + '</span>',
      '      <span class="course-tag">' + escapeHtml(r.course_code) + '</span>',
      '    </div>',
      '    <a href="#" class="read-more" onclick="StudentContent.downloadResource(' + r.id + '); return false;">',
      '      Download <i data-lucide="download" class="icon-xs"></i>',
      '    </a>',
      '  </div>',
      '</article>',
    ].join("\n");
  }

  async function loadResourceHub() {
    var grid = document.getElementById("resourceGrid");
    if (!grid) return; // not on this page

    grid.innerHTML =
      '<p style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--color-text-faint)">Loading resources…</p>';

    var res = await SP_API.resources.list({ page_size: 8 });

    if (!res.ok) {
      grid.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--color-danger)">' +
        escapeHtml(res.error) + "</p>";
      return;
    }

    var items = (res.data.resources || []).slice(0, 4);

    if (items.length === 0) {
      grid.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--color-text-faint)">' +
        "No resources available yet.</p>";
      return;
    }

    grid.innerHTML = items.map(resourceCardHtml).join("\n");
    if (window.lucide) window.lucide.createIcons();
  }

  /* Download handler exposed globally so onclick can call it */
  async function downloadResource(id) {
    var res = await SP_API.resources.download(id);
    if (!res.ok) { toast(res.error, "error"); return; }

    var a = document.createElement("a");
    a.href     = res.data.file_url;
    a.download = res.data.filename || "resource";
    a.target   = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast("Downloading: " + res.data.title, "success");

    // Bump the visible download count without a full re-fetch
    var card = document.querySelector('[data-resource-id="' + id + '"]');
    if (card) {
      var countEl = card.querySelector(".resource-card__meta span");
      if (countEl) {
        var current = parseInt(countEl.textContent.replace(/\D/g, ""), 10) || 0;
        countEl.innerHTML = '<i data-lucide="download" class="icon-xs"></i>' + (current + 1);
        if (window.lucide) window.lucide.createIcons();
      }
    }
  }

  /* ───────────────────────────────────────────────────────────────────────────
     ANNOUNCEMENTS — FULL PAGE  (announcements.html)
  ─────────────────────────────────────────────────────────────────────────── */

  var announceState = { all: [] };

  function announceCardHtml(a) {
    var icon      = ANNOUNCE_ICON[a.category]      || "megaphone";
    var badge     = ANNOUNCE_BADGE[a.category]     || "badge--neutral";
    var iconStyle = ANNOUNCE_ICON_STYLE[a.category]|| "";
    var isUrgent  = a.category === "urgent";
    var catLabel  = a.category_display || a.category;

    return [
      '<article class="announce-card' + (isUrgent ? " announce-card--urgent" : "") + '" data-cat="' + a.category + '">',
      '  <div class="announce-card__icon" style="' + iconStyle + '"><i data-lucide="' + icon + '" class="icon-md"></i></div>',
      '  <div class="announce-card__body">',
      '    <div style="margin-bottom:var(--s3)"><span class="badge ' + badge + '">' + escapeHtml(catLabel) + '</span></div>',
      '    <h3 class="announce-card__title">' + escapeHtml(a.title) + '</h3>',
      '    <p class="announce-card__desc">' + escapeHtml(truncate(a.body, 280)) + '</p>',
      '    <p class="announce-card__date"><i data-lucide="calendar" class="icon-xs"></i>' + formatDate(a.created_at) + '</p>',
      '  </div>',
      '  <div class="announce-card__actions">',
      '    <a href="#" class="btn btn--outline btn--sm" onclick="StudentContent.showFullAnnouncement(' + a.id + '); return false;">Read More</a>',
      '  </div>',
      '</article>',
    ].join("\n");
  }

  function renderAnnouncements(list) {
    var container = document.getElementById("announceList");
    if (!container) return;

    if (!list || list.length === 0) {
      container.innerHTML =
        '<p style="text-align:center;padding:2rem;color:var(--color-text-faint)">No announcements found.</p>';
      return;
    }

    container.innerHTML = list.map(announceCardHtml).join("\n");
    if (window.lucide) window.lucide.createIcons();
  }

  async function loadAnnouncementsPage() {
    var container = document.getElementById("announceList");
    if (!container) return; // not on this page

    container.innerHTML =
      '<p style="text-align:center;padding:2rem;color:var(--color-text-faint)">Loading announcements…</p>';

    var res = await SP_API.announcements.list();

    if (!res.ok) {
      container.innerHTML =
        '<p style="text-align:center;padding:2rem;color:var(--color-danger)">' + escapeHtml(res.error) + "</p>";
      return;
    }

    announceState.all = res.data.announcements || [];
    renderAnnouncements(announceState.all);

    // Wire the category filter dropdown (real filtering, not the old inline onchange)
    var filterSelect = document.getElementById("announceCategoryFilter");
    if (filterSelect) {
      filterSelect.addEventListener("change", function () {
        var val = filterSelect.value;
        if (!val) { renderAnnouncements(announceState.all); return; }
        renderAnnouncements(announceState.all.filter(function (a) { return a.category === val; }));
      });
    }
  }

  /* Show full announcement text in a simple modal-less alert-style panel */
  function showFullAnnouncement(id) {
    var a = announceState.all.find(function (x) { return x.id === id; });
    if (!a) return;

    // Simple accessible dialog built on the fly (keeps this file dependency-free)
    var overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:999;" +
      "display:flex;align-items:center;justify-content:center;padding:1.5rem;";
    overlay.innerHTML =
      '<div style="background:var(--color-surface);border-radius:16px;max-width:560px;width:100%;' +
      'max-height:80vh;overflow-y:auto;padding:2rem;position:relative;">' +
      '<button id="closeFullAnn" style="position:absolute;top:1rem;right:1rem;background:none;border:none;' +
      'font-size:1.4rem;cursor:pointer;color:var(--color-text-faint)">&times;</button>' +
      '<h2 style="margin-bottom:.5rem;font-size:1.3rem;">' + escapeHtml(a.title) + '</h2>' +
      '<p style="font-size:.8rem;color:var(--color-text-faint);margin-bottom:1.25rem">' +
      formatDate(a.created_at) + " · " + escapeHtml(a.category_display || a.category) + '</p>' +
      '<p style="line-height:1.7;white-space:pre-wrap">' + escapeHtml(a.body) + '</p>' +
      '</div>';

    document.body.appendChild(overlay);

    function close() { overlay.remove(); }
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.getElementById("closeFullAnn").addEventListener("click", close);
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
    });
  }

  /* ───────────────────────────────────────────────────────────────────────────
     MINI ANNOUNCEMENTS PREVIEW  (dashboard.html "Latest Announcements" panel)
  ─────────────────────────────────────────────────────────────────────────── */

  async function loadDashboardAnnouncementPreview() {
    var grid = document.getElementById("dashboardAnnounceGrid");
    if (!grid) return;

    var res = await SP_API.announcements.list({ page_size: 4 });
    if (!res.ok) return; // fail silently on dashboard preview, no need to alarm

    var items = (res.data.announcements || []).slice(0, 4);
    if (items.length === 0) return;

    grid.innerHTML = items.map(function (a) {
      var badge = ANNOUNCE_BADGE[a.category] || "badge--neutral";
      var label = a.category_display || a.category;
      return [
        '<article class="announce-card">',
        '  <span class="badge ' + badge + '">' + escapeHtml(label) + '</span>',
        '  <h3>' + escapeHtml(a.title) + '</h3>',
        '  <p class="card-date"><i data-lucide="calendar" class="icon-xs"></i>' + formatDate(a.created_at) + '</p>',
        '  <a href="announcements.html" class="read-more">Read More <i data-lucide="arrow-right" class="icon-xs"></i></a>',
        '</article>',
      ].join("\n");
    }).join("\n");

    if (window.lucide) window.lucide.createIcons();
  }

  /* ── PUBLIC API (for inline onclick handlers) ─────────────────────────────── */
  window.StudentContent = {
    downloadResource:     downloadResource,
    showFullAnnouncement: showFullAnnouncement,
  };

  /* ── INIT ────────────────────────────────────────────────────────────────── */
  function init() {
    if (!window.SP_API) {
      console.error("[student-content] SP_API not found — is api.js loaded?");
      return;
    }
    loadResourceHub();                     // no-op if not on dashboard.html
    loadDashboardAnnouncementPreview();     // no-op if not on dashboard.html
    loadAnnouncementsPage();                // no-op if not on announcements.html
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();

/**
 * student-resources-page.js
 * Connects the standalone resources.html page to the backend.
 *
 * IMPORTANT: this page's filter dropdowns use short display codes
 * (csc, mth, past-q, notes...) that don't match the backend's real
 * field values (Computer Science, past_questions...). This file
 * maps between the two so filtering actually works correctly.
 *
 * Load order (bottom of <body>, after auth-guard.js + api.js):
 *   <script src="js/auth-guard.js"></script>
 *   <script src="js/api.js"></script>
 *   <script src="js/main.js"></script>
 *   <script src="js/student-resources-page.js"></script>   ← this file
 */

(function () {
  "use strict";

  var grid = document.getElementById("resourceGridFull");
  if (!grid) return; // not on this page

  /* ── VOCABULARY MAPS ──────────────────────────────────────────────────────
     Frontend dropdown value → what to match against the backend response.
  ─────────────────────────────────────────────────────────────────────────── */
  var DEPT_LABEL = {
    csc: "Computer Science",
    mth: "Mathematics",
    phy: "Physics",
    gst: "General Studies",
    eco: "Economics",
  };

  var TYPE_MAP = {
    "past-q":  "past_questions",
    "notes":   "lecture_notes",
    "handout": "handout",
    "ebook":   "ebook",
  };

  var THUMB_CLASS = {
    past_questions: "resource-card__thumb--pdf",
    lecture_notes:  "resource-card__thumb--doc",
    handout:        "resource-card__thumb--ppt",
    ebook:          "resource-card__thumb--ebook",
  };

  var THUMB_EMOJI = {
    past_questions: "📄",
    lecture_notes:  "📝",
    handout:        "📋",
    ebook:          "📚",
  };

  var TYPE_BADGE_COLOR = {
    pdf:  "badge--red",
    docx: "badge--blue",
    pptx: "badge--amber",
    ppt:  "badge--amber",
    doc:  "badge--blue",
    pdf_: "badge--red",
  };

  /* ── HELPERS ──────────────────────────────────────────────────────────────── */

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatShortDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  function fileExtension(url) {
    if (!url) return "FILE";
    var clean = url.split("?")[0];
    var parts = clean.split(".");
    return parts.length > 1 ? parts.pop().toUpperCase() : "FILE";
  }

  function toast(message, type) {
    if (typeof window.showToast === "function") window.showToast(message, type);
    else console.log("[toast:" + (type || "info") + "]", message);
  }

  var state = { all: [] };

  /* ── RENDER ───────────────────────────────────────────────────────────────── */

  function cardHtml(r) {
    var thumbClass = THUMB_CLASS[r.resource_type] || "resource-card__thumb--pdf";
    var thumbEmoji = THUMB_EMOJI[r.resource_type] || "📄";
    var ext        = fileExtension(r.file_url);
    var badgeColor = TYPE_BADGE_COLOR[ext.toLowerCase()] || "badge--neutral";

    return [
      '<article class="resource-card" data-resource-id="' + r.id + '">',
      '  <div class="resource-card__thumb ' + thumbClass + '">' + thumbEmoji + '</div>',
      '  <div class="resource-card__body">',
      '    <p class="resource-card__course"><i data-lucide="tag" class="icon-xs"></i>' + escapeHtml(r.course_code) + '</p>',
      '    <h3 class="resource-card__title">' + escapeHtml(r.title) + '</h3>',
      '    <div class="resource-card__meta">',
      '      <span class="resource-card__meta-item"><i data-lucide="download" class="icon-xs"></i>' + (r.download_count || 0) + '</span>',
      '      <span class="badge ' + badgeColor + '">' + ext + '</span>',
      '      <span class="resource-card__meta-item"><i data-lucide="calendar" class="icon-xs"></i>' + formatShortDate(r.created_at) + '</span>',
      '    </div>',
      '    <a href="#" class="btn btn--primary btn--block btn--sm" onclick="StudentResourcesPage.download(' + r.id + '); return false;">',
      '      <i data-lucide="download" class="icon-xs"></i>Download',
      '    </a>',
      '  </div>',
      '</article>',
    ].join("\n");
  }

  function render(list) {
    if (!list || list.length === 0) {
      grid.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--color-text-faint)">' +
        "No resources match your filters.</p>";
      return;
    }
    grid.innerHTML = list.map(cardHtml).join("\n");
    if (window.lucide) window.lucide.createIcons();
  }

  /* ── STATS ROW ────────────────────────────────────────────────────────────── */

  function updateStats(list) {
    var totalEl = document.querySelector(".stat-box:nth-child(1) .stat-box__num");
    var dlEl    = document.querySelector(".stat-box:nth-child(2) .stat-box__num");

    if (totalEl) totalEl.textContent = list.length;

    if (dlEl) {
      var totalDownloads = list.reduce(function (sum, r) { return sum + (r.download_count || 0); }, 0);
      dlEl.textContent = totalDownloads >= 1000
        ? (totalDownloads / 1000).toFixed(1) + "k"
        : totalDownloads;
    }
    // "Saved by You" has no backend model yet — left as static placeholder.
  }

  /* ── LOAD FROM API ────────────────────────────────────────────────────────── */

  async function loadAll() {
    grid.innerHTML =
      '<p style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--color-text-faint)">Loading resources…</p>';

    var res = await SP_API.resources.list();

    if (!res.ok) {
      grid.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--color-danger)">' +
        escapeHtml(res.error) + "</p>";
      toast(res.error, "error");
      return;
    }

    state.all = res.data.resources || [];
    applyFilters();
    updateStats(state.all);
  }

  /* ── FILTERING (all client-side, using the vocabulary maps above) ─────────── */

  function applyFilters() {
    var searchInput = document.getElementById("resourceSearch");
    var levelSelect  = document.getElementById("filterLevel");
    var deptSelect   = document.getElementById("filterDept");
    var typeSelect   = document.getElementById("filterType");

    var search = (searchInput ? searchInput.value : "").toLowerCase().trim();
    var level  = levelSelect ? levelSelect.value : "";
    var deptCode = deptSelect ? deptSelect.value : "";
    var typeCode = typeSelect ? typeSelect.value : "";

    var deptLabel = deptCode ? DEPT_LABEL[deptCode] : null;
    var backendType = typeCode ? TYPE_MAP[typeCode] : null;

    var filtered = state.all.filter(function (r) {
      var matchesSearch = !search ||
        r.title.toLowerCase().includes(search) ||
        r.course_code.toLowerCase().includes(search);

      var matchesLevel = !level || r.level === level;

      var matchesDept = !deptLabel ||
        (r.department || "").toLowerCase().includes(deptLabel.toLowerCase());

      var matchesType = !backendType || r.resource_type === backendType;

      return matchesSearch && matchesLevel && matchesDept && matchesType;
    });

    render(filtered);
  }

  /* ── DOWNLOAD ─────────────────────────────────────────────────────────────── */

  async function download(id) {
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

    // Bump the count in the local state + on the card, no full reload
    var item = state.all.find(function (r) { return r.id === id; });
    if (item) item.download_count = (item.download_count || 0) + 1;

    var card = document.querySelector('[data-resource-id="' + id + '"]');
    if (card) {
      var countEl = card.querySelector(".resource-card__meta-item");
      if (countEl) {
        countEl.innerHTML = '<i data-lucide="download" class="icon-xs"></i>' + (item ? item.download_count : "");
        if (window.lucide) window.lucide.createIcons();
      }
    }
  }

  window.StudentResourcesPage = { download: download };

  /* ── WIRE FILTER EVENTS ───────────────────────────────────────────────────── */

  function wireFilters() {
    var searchInput = document.getElementById("resourceSearch");
    var levelSelect  = document.getElementById("filterLevel");
    var deptSelect   = document.getElementById("filterDept");
    var typeSelect   = document.getElementById("filterType");

    if (searchInput) {
      var t;
      searchInput.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(applyFilters, 250);
      });
    }
    [levelSelect, deptSelect, typeSelect].forEach(function (sel) {
      if (sel) sel.addEventListener("change", applyFilters);
    });
  }

  /* ── INIT ─────────────────────────────────────────────────────────────────── */

  function init() {
    if (!window.SP_API) {
      console.error("[student-resources-page] SP_API not found — is api.js loaded?");
      return;
    }
    wireFilters();
    loadAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
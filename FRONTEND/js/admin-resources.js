/**
 * admin-resources.js
 * Connects the Resource Management and Announcement Management sections
 * of admin-dashboard.html to the Django REST Framework backend.
 *
 * Load order in admin-dashboard.html (bottom of <body>):
 *   <script src="js/auth-guard.js"></script>
 *   <script src="js/api.js"></script>
 *   <script src="js/admin.js"></script>          ← existing admin script
 *   <script src="js/admin-resources.js"></script> ← this file (load LAST)
 */

(function () {
  "use strict";

  /* ── BADGE COLOUR MAP ─────────────────────────────────────────────────────
     Maps resource_type and announcement category strings to CSS classes.
  ─────────────────────────────────────────────────────────────────────────── */
  var RESOURCE_TYPE_BADGE = {
    past_questions: "badge--red",
    lecture_notes:  "badge--blue",
    handout:        "badge--amber",
    ebook:          "badge--green",
  };

  var RESOURCE_TYPE_LABEL = {
    past_questions: "Past Q.",
    lecture_notes:  "Notes",
    handout:        "Handout",
    ebook:          "E-book",
  };

  var ANNOUNCE_BADGE = {
    general:    "badge--blue",
    faculty:    "badge--amber",
    department: "badge--cyan",
    urgent:     "badge--red",
  };

  /* ── FORMAT HELPERS ──────────────────────────────────────────────────────── */

  function formatDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ── TOAST (reuses admin.js global if available, else falls back) ────────── */
  function toast(message, type) {
    if (typeof window.showToast === "function") {
      window.showToast(message, type || "success");
    } else {
      alert(message);
    }
  }

  /* ───────────────────────────────────────────────────────────────────────────
     RESOURCES
  ─────────────────────────────────────────────────────────────────────────── */

  var resourceState = {
    all:      [],
    filtered: [],
  };

  /* Render resource rows into the admin table */
  function renderResourceRows(list) {
    var tbody = document.getElementById("adminResourceTbody");
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-f)">' +
        "No resources found.</td></tr>";
      return;
    }

    tbody.innerHTML = list.map(function (r) {
      var badgeClass = RESOURCE_TYPE_BADGE[r.resource_type] || "badge--neutral";
      var badgeLabel = RESOURCE_TYPE_LABEL[r.resource_type] || r.resource_type_display || r.resource_type;
      var dept       = (r.department || "").slice(0, 3).toUpperCase() || "—";
      var date       = formatDate(r.created_at);
      var uploader   = escapeHtml(r.uploaded_by_name || "Admin");
      var title      = escapeHtml(r.title);

      return [
        "<tr data-resource-id=\"" + r.id + "\">",
        "  <td><strong>" + title + "</strong></td>",
        "  <td><span class=\"badge " + badgeClass + "\">" + badgeLabel + "</span></td>",
        "  <td><span class=\"td-mono\">" + escapeHtml(dept) + "</span></td>",
        "  <td>" + uploader + "</td>",
        "  <td class=\"td-mono\">" + date + "</td>",
        "  <td class=\"td-mono\">" + (r.download_count || 0) + "</td>",
        "  <td>",
        "    <div class=\"td-actions\">",
        "      <button class=\"btn-icon btn-icon--view\" title=\"Download\" onclick=\"adminDownloadResource(" + r.id + ")\">",
        "        <i data-lucide=\"download\" class=\"icon-xs\"></i>",
        "      </button>",
        "      <button class=\"btn-icon btn-icon--del\" title=\"Delete\" onclick=\"adminDeleteResource(" + r.id + ", this)\">",
        "        <i data-lucide=\"trash-2\" class=\"icon-xs\"></i>",
        "      </button>",
        "    </div>",
        "  </td>",
        "</tr>",
      ].join("\n");
    }).join("\n");

    // Re-render Lucide icons in the new rows
    if (window.lucide) window.lucide.createIcons();

    // Update pagination info
    var info = document.getElementById("resourcePaginationInfo");
    if (info) info.textContent = "Showing " + list.length + " of " + resourceState.all.length + " resources";
  }

  /* Fetch from API and populate the table */
  async function loadResources(filters) {
    var tbody = document.getElementById("adminResourceTbody");
    if (!tbody) return;

    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-f)">' +
      "Loading resources…</td></tr>";

    var res = await SP_API.resources.list(filters || {});

    if (!res.ok) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--color-danger)">' +
        escapeHtml(res.error) + "</td></tr>";
      toast(res.error, "error");
      return;
    }

    resourceState.all      = res.data.resources || [];
    resourceState.filtered = resourceState.all;
    renderResourceRows(resourceState.all);

    // Update dashboard KPI counter if it exists
    var kpiEl = document.getElementById("kpiResources");
    if (kpiEl) kpiEl.textContent = res.data.count || resourceState.all.length;
  }

  /* Client-side search filter */
  function filterResources(query) {
    query = (query || "").toLowerCase().trim();
    if (!query) {
      renderResourceRows(resourceState.all);
      return;
    }
    var filtered = resourceState.all.filter(function (r) {
      return (
        r.title.toLowerCase().includes(query) ||
        r.course_code.toLowerCase().includes(query) ||
        (r.department || "").toLowerCase().includes(query)
      );
    });
    renderResourceRows(filtered);
  }

  /* Download a resource */
  window.adminDownloadResource = async function (id) {
    var res = await SP_API.resources.download(id);
    if (!res.ok) { toast(res.error, "error"); return; }
    // Trigger browser download
    var a = document.createElement("a");
    a.href     = res.data.file_url;
    a.download = res.data.filename || "resource";
    a.target   = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast("Downloading: " + res.data.title, "success");
    // Update count in table row
    var row = document.querySelector("[data-resource-id=\"" + id + "\"]");
    if (row) {
      var dlCell = row.querySelectorAll("td")[5];
      if (dlCell) dlCell.textContent = parseInt(dlCell.textContent || "0") + 1;
    }
  };

  /* Delete a resource */
  window.adminDeleteResource = async function (id, btn) {
    if (!confirm("Delete this resource? This cannot be undone.")) return;
    btn.disabled = true;

    var res = await SP_API.resources.delete(id);
    if (!res.ok) {
      toast(res.error, "error");
      btn.disabled = false;
      return;
    }
    var row = btn.closest("tr");
    if (row) {
      row.style.transition = "opacity .3s";
      row.style.opacity    = "0";
      setTimeout(function() { row.remove(); }, 300);
    }
    resourceState.all = resourceState.all.filter(function(r) { return r.id !== id; });
    toast("Resource deleted.", "success");
    var info = document.getElementById("resourcePaginationInfo");
    if (info) info.textContent = "Showing " + resourceState.all.length + " resources";
  };

  /* Upload modal submit */
  window.adminUploadResource = async function () {
    var form = document.getElementById("uploadResourceForm");
    if (!form) { toast("Upload form not found.", "error"); return; }

    var formData = new FormData(form);

    // Basic validation
    if (!formData.get("title") || !formData.get("course_code") || !formData.get("file").size) {
      toast("Please fill in all required fields and choose a file.", "error");
      return;
    }

    var btn = document.getElementById("uploadResourceBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Uploading…"; }

    var res = await SP_API.resources.upload(formData);

    if (btn) { btn.disabled = false; btn.textContent = "Upload"; }

    if (!res.ok) {
      toast(res.error || "Upload failed.", "error");
      return;
    }

    if (typeof window.closeModal === "function") window.closeModal("uploadResourceModal");
    toast("Resource uploaded successfully.", "success");
    form.reset();

    // Prepend new row
    resourceState.all.unshift(res.data.resource);
    renderResourceRows(resourceState.all);
  };

  /* ───────────────────────────────────────────────────────────────────────────
     ANNOUNCEMENTS
  ─────────────────────────────────────────────────────────────────────────── */

  var announceState = {
    all:      [],
    filtered: [],
  };

  /* Render announcement rows */
  function renderAnnounceRows(list) {
    var tbody = document.getElementById("adminAnnounceTbody");
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-f)">' +
        "No announcements found.</td></tr>";
      return;
    }

    tbody.innerHTML = list.map(function (a) {
      var catBadge = ANNOUNCE_BADGE[a.category] || "badge--neutral";
      var catLabel = escapeHtml(a.category_display || a.category);
      var pubBadge = a.is_published ? "badge--green" : "badge--neutral";
      var pubLabel = a.is_published ? "Published" : "Draft";
      var audience = escapeHtml(a.audience_display || a.audience);
      var date     = formatDate(a.created_at);
      var title    = escapeHtml(a.title);

      return [
        "<tr data-announce-id=\"" + a.id + "\">",
        "  <td><strong>" + title + "</strong></td>",
        "  <td><span class=\"badge " + catBadge + "\">" + catLabel + "</span></td>",
        "  <td>" + audience + "</td>",
        "  <td class=\"td-mono\">" + date + "</td>",
        "  <td><span class=\"badge " + pubBadge + "\">" + pubLabel + "</span></td>",
        "  <td>",
        "    <div class=\"td-actions\">",
        "      <button class=\"btn-icon btn-icon--pub\" title=\"" + (a.is_published ? "Unpublish" : "Publish") + "\"",
        "              onclick=\"adminTogglePublish(" + a.id + ", " + !a.is_published + ", this)\">",
        "        <i data-lucide=\"" + (a.is_published ? "eye-off" : "send") + "\" class=\"icon-xs\"></i>",
        "      </button>",
        "      <button class=\"btn-icon btn-icon--del\" title=\"Delete\"",
        "              onclick=\"adminDeleteAnnounce(" + a.id + ", this)\">",
        "        <i data-lucide=\"trash-2\" class=\"icon-xs\"></i>",
        "      </button>",
        "    </div>",
        "  </td>",
        "</tr>",
      ].join("\n");
    }).join("\n");

    if (window.lucide) window.lucide.createIcons();

    var info = document.getElementById("announcePaginationInfo");
    if (info) info.textContent = "Showing " + list.length + " of " + announceState.all.length + " announcements";
  }

  /* Fetch all announcements (including drafts for admin) */
  async function loadAnnouncements(filters) {
    var tbody = document.getElementById("adminAnnounceTbody");
    if (!tbody) return;

    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-f)">' +
      "Loading announcements…</td></tr>";

    // Pass draft=true so admin sees unpublished items too
    var params = Object.assign({ draft: "true" }, filters || {});
    var res = await SP_API.announcements.list(params);

    if (!res.ok) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-danger)">' +
        escapeHtml(res.error) + "</td></tr>";
      toast(res.error, "error");
      return;
    }

    announceState.all      = res.data.announcements || [];
    announceState.filtered = announceState.all;
    renderAnnounceRows(announceState.all);

    // Update dashboard KPI
    var kpiEl = document.getElementById("kpiAnnouncements");
    if (kpiEl) kpiEl.textContent = res.data.count || announceState.all.length;
  }

  /* Client-side search */
  function filterAnnouncements(query) {
    query = (query || "").toLowerCase().trim();
    if (!query) { renderAnnounceRows(announceState.all); return; }
    var filtered = announceState.all.filter(function (a) {
      return (
        a.title.toLowerCase().includes(query) ||
        (a.body  || "").toLowerCase().includes(query) ||
        (a.category || "").toLowerCase().includes(query)
      );
    });
    renderAnnounceRows(filtered);
  }

  /* Publish / unpublish toggle */
  window.adminTogglePublish = async function (id, publish, btn) {
    btn.disabled = true;
    var res = await SP_API.announcements.publish(id, publish);
    btn.disabled = false;

    if (!res.ok) { toast(res.error, "error"); return; }

    toast(publish ? "Announcement published." : "Announcement unpublished.", "success");

    // Update state and re-render
    var idx = announceState.all.findIndex(function (a) { return a.id === id; });
    if (idx !== -1) announceState.all[idx].is_published = publish;
    renderAnnounceRows(announceState.all);
  };

  /* Delete announcement */
  window.adminDeleteAnnounce = async function (id, btn) {
    if (!confirm("Delete this announcement? This cannot be undone.")) return;
    btn.disabled = true;

    var res = await SP_API.announcements.delete(id);
    if (!res.ok) { toast(res.error, "error"); btn.disabled = false; return; }

    var row = btn.closest("tr");
    if (row) { row.style.transition = "opacity .3s"; row.style.opacity = "0"; setTimeout(function() { row.remove(); }, 300); }
    announceState.all = announceState.all.filter(function (a) { return a.id !== id; });
    toast("Announcement deleted.", "success");
  };

  /* Create announcement modal submit */
  window.adminCreateAnnouncement = async function () {
    var title    = (document.getElementById("newAnnTitle")    || {}).value;
    var body     = (document.getElementById("newAnnBody")     || {}).value;
    var category = (document.getElementById("newAnnCategory") || {}).value;
    var audience = (document.getElementById("newAnnAudience") || {}).value;
    var publish  = (document.getElementById("newAnnPublish")  || {}).checked;

    if (!title || !body || !category) {
      toast("Title, body, and category are required.", "error");
      return;
    }

    var btn = document.getElementById("createAnnBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Creating…"; }

    var res = await SP_API.announcements.create({
      title: title, body: body, category: category,
      audience: audience || "all", is_published: !!publish,
    });

    if (btn) { btn.disabled = false; btn.textContent = "Publish"; }

    if (!res.ok) { toast(res.error || "Failed to create announcement.", "error"); return; }

    if (typeof window.closeModal === "function") window.closeModal("createAnnounceModal");
    toast("Announcement created.", "success");

    // Prepend to table
    announceState.all.unshift(res.data.announcement);
    renderAnnounceRows(announceState.all);
  };

  /* ───────────────────────────────────────────────────────────────────────────
     WIRE SEARCH INPUTS
  ─────────────────────────────────────────────────────────────────────────── */

  function wireSearch() {
    var resourceSearch = document.getElementById("adminResourceSearch");
    if (resourceSearch) {
      var t;
      resourceSearch.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(function () { filterResources(resourceSearch.value); }, 250);
      });
    }

    var announceSearch = document.getElementById("adminAnnounceSearch");
    if (announceSearch) {
      var t2;
      announceSearch.addEventListener("input", function () {
        clearTimeout(t2);
        t2 = setTimeout(function () { filterAnnouncements(announceSearch.value); }, 250);
      });
    }
  }

  /* ───────────────────────────────────────────────────────────────────────────
     LOAD ON PAGE-SWITCH
     admin.js calls showPage(id) which adds is-active to the section.
     We hook into clicks on the nav links and load data lazily.
  ─────────────────────────────────────────────────────────────────────────── */

  var resourcesLoaded     = false;
  var announcementsLoaded = false;

  function onNavClick(e) {
    var link = e.target.closest(".nav-link[data-page]");
    if (!link) return;

    var page = link.getAttribute("data-page");

    if (page === "resources" && !resourcesLoaded) {
      resourcesLoaded = true;
      // Small delay so admin.js can show the section first
      setTimeout(loadResources, 80);
    }

    if (page === "announcements" && !announcementsLoaded) {
      announcementsLoaded = true;
      setTimeout(loadAnnouncements, 80);
    }

    // Also refresh dashboard KPIs when landing on main dashboard
    if (page === "dashboard") {
      refreshDashboard();
    }
  }

  /* ───────────────────────────────────────────────────────────────────────────
     DASHBOARD — latest resources table + KPI refresh
  ─────────────────────────────────────────────────────────────────────────── */

  async function refreshDashboard() {
    // Load latest 5 resources into the dashboard preview table
    var dashTbody = document.querySelector("#page-dashboard .data-table tbody");
    if (dashTbody) {
      var res = await SP_API.resources.list({ page_size: 5 });
      if (res.ok && res.data.resources && res.data.resources.length) {
        var rows = res.data.resources.slice(0, 5);
        dashTbody.innerHTML = rows.map(function (r) {
          var dept = (r.department || "").slice(0, 3).toUpperCase();
          return [
            "<tr>",
            "  <td><strong>" + escapeHtml(r.title) + "</strong></td>",
            "  <td><span class=\"td-mono\">" + escapeHtml(dept) + "</span></td>",
            "  <td>" + escapeHtml(r.uploaded_by_name || "Admin") + "</td>",
            "  <td class=\"td-mono\">" + formatDate(r.created_at) + "</td>",
            "  <td class=\"td-mono\">" + (r.download_count || 0) + "</td>",
            "  <td><div class=\"td-actions\">",
            "    <button class=\"btn-icon btn-icon--view\" onclick=\"adminDownloadResource(" + r.id + ")\"><i data-lucide=\"download\" class=\"icon-xs\"></i></button>",
            "    <button class=\"btn-icon btn-icon--del\" onclick=\"adminDeleteResource(" + r.id + ", this)\"><i data-lucide=\"trash-2\" class=\"icon-xs\"></i></button>",
            "  </div></td>",
            "</tr>",
          ].join("");
        }).join("");
        if (window.lucide) window.lucide.createIcons();
      }

      // Update KPI
      var kpiEl = document.getElementById("kpiResources");
      if (kpiEl && res.ok) kpiEl.textContent = res.data.count || 0;
    }

    // Announcement KPI
    var annRes = await SP_API.announcements.list({ draft: "true" });
    var kpiAnn = document.getElementById("kpiAnnouncements");
    if (kpiAnn && annRes.ok) kpiAnn.textContent = annRes.data.count || 0;
  }

  /* ───────────────────────────────────────────────────────────────────────────
     INIT
  ─────────────────────────────────────────────────────────────────────────── */

  function init() {
    if (!window.SP_API) {
      console.error("[admin-resources] SP_API not found — is api.js loaded?");
      return;
    }

    wireSearch();

    // Listen for nav clicks
    var nav = document.querySelector(".sidebar-nav");
    if (nav) nav.addEventListener("click", onNavClick);

    // Load data for whichever page is active on first load
    var activePage = document.querySelector(".admin-page.is-active");
    if (activePage) {
      var pageId = activePage.id.replace("page-", "");
      if (pageId === "resources")     { resourcesLoaded = true;     loadResources(); }
      if (pageId === "announcements") { announcementsLoaded = true; loadAnnouncements(); }
      if (pageId === "dashboard")     { refreshDashboard(); }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();

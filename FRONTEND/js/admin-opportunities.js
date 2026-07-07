/**
 * admin-opportunities.js
 * Connects the Opportunity Management section of admin-dashboard.html
 * to the Django backend.
 *
 * Load order (bottom of <body>, after auth-guard.js, api.js, api-opportunities.js, admin.js):
 *   <script src="js/auth-guard.js"></script>
 *   <script src="js/api.js"></script>
 *   <script src="js/api-opportunities.js"></script>
 *   <script src="js/admin.js"></script>
 *   <script src="js/admin-resources.js"></script>
 *   <script src="js/admin-opportunities.js"></script>   ← this file (load LAST)
 */

(function () {
  "use strict";

  /* ── STYLE MAPS ────────────────────────────────────────────────────────────── */
  var TYPE_ICON = {
    scholarship: "award",
    internship:  "code-2",
    competition: "zap",
    ambassador:  "globe",
  };

  var TYPE_ICON_STYLE = {
    scholarship: "background:var(--cyan-soft);color:var(--cyan)",
    internship:  "background:var(--blue-soft);color:var(--blue)",
    competition: "background:var(--green-soft);color:var(--green)",
    ambassador:  "background:var(--amber-soft);color:var(--amber)",
  };

  var TYPE_BADGE = {
    scholarship: "badge--cyan",
    internship:  "badge--blue",
    competition: "badge--green",
    ambassador:  "badge--amber",
  };

  var URGENCY_BADGE = {
    expired: "badge--neutral",
    urgent:  "badge--red",
    soon:    "badge--amber",
    normal:  "badge--green",
  };

  var URGENCY_LABEL = {
    expired: "Expired",
    urgent:  "Closing Soon",
    soon:    "Closing Soon",
    normal:  "Open",
  };

  /* ── HELPERS ──────────────────────────────────────────────────────────────── */
  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00"); // date-only field, avoid TZ shift
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function toast(message, type) {
    if (typeof window.showToast === "function") window.showToast(message, type || "success");
    else alert(message);
  }

  var oppState = { all: [] };

  /* ── RENDER ───────────────────────────────────────────────────────────────── */

  function oppCardHtml(o) {
    var icon      = TYPE_ICON[o.opportunity_type]       || "briefcase";
    var iconStyle = TYPE_ICON_STYLE[o.opportunity_type] || "";
    var typeBadge = TYPE_BADGE[o.opportunity_type]      || "badge--neutral";
    var typeLabel = o.opportunity_type_display || o.opportunity_type;
    var urgBadge  = URGENCY_BADGE[o.urgency]            || "badge--neutral";
    var urgLabel  = URGENCY_LABEL[o.urgency]            || "Open";

    var deadlineText = o.applicant_count > 0
      ? '<i data-lucide="users" class="icon-xs"></i>' + o.applicant_count + " applicants"
      : '<i data-lucide="clock" class="icon-xs"></i>' + formatDate(o.deadline);

    return [
      '<div class="opp-mgmt-card" data-opp-type="' + o.opportunity_type + '" data-opp-id="' + o.id + '">',
      '  <div class="opp-mgmt-card__top">',
      '    <div class="opp-icon" style="' + iconStyle + '"><i data-lucide="' + icon + '" class="icon-md"></i></div>',
      '    <span class="badge ' + urgBadge + '">' + urgLabel + '</span>',
      '  </div>',
      '  <span class="badge ' + typeBadge + '" style="align-self:flex-start;margin-bottom:var(--s3)">' + escapeHtml(typeLabel) + '</span>',
      '  <h3 class="opp-mgmt-card__title">' + escapeHtml(o.title) + '</h3>',
      '  <p class="opp-mgmt-card__desc">' + escapeHtml(o.description) + '</p>',
      '  <div class="opp-mgmt-card__foot">',
      '    <span class="opp-deadline">' + deadlineText + '</span>',
      '    <div style="display:flex;gap:var(--s2)">',
      '      <button class="btn-icon btn-icon--view" title="View applicants" onclick="adminViewApplicants(' + o.id + ')"><i data-lucide="users" class="icon-xs"></i></button>',
      '      <button class="btn-icon btn-icon--del" title="Delete" onclick="adminDeleteOpportunity(' + o.id + ', this)"><i data-lucide="trash-2" class="icon-xs"></i></button>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join("\n");
  }

  function renderOpportunities(list) {
    var grid = document.getElementById("oppGrid");
    if (!grid) return;

    if (!list || list.length === 0) {
      grid.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-f)">No opportunities found.</p>';
      return;
    }

    grid.innerHTML = list.map(oppCardHtml).join("\n");
    if (window.lucide) window.lucide.createIcons();
  }

  /* Update the tab pill counts (All / Scholarships / Internships / ...) */
  function updateTabCounts() {
    var counts = { all: oppState.all.length, scholarship: 0, internship: 0, competition: 0, ambassador: 0 };
    oppState.all.forEach(function (o) {
      if (counts[o.opportunity_type] !== undefined) counts[o.opportunity_type]++;
    });

    var tabs = document.querySelectorAll("#oppTabs .tab-pill");
    var labels = { all: "All", scholarship: "Scholarships", internship: "Internships",
                   competition: "Competitions", ambassador: "Ambassador" };

    tabs.forEach(function (tab) {
      var filter = tab.getAttribute("data-opp-filter");
      if (labels[filter] !== undefined) {
        tab.textContent = labels[filter] + " (" + counts[filter] + ")";
      }
    });
  }

  /* ── LOAD FROM API ────────────────────────────────────────────────────────── */
  async function loadOpportunities() {
    var grid = document.getElementById("oppGrid");
    if (!grid) return;

    grid.innerHTML =
      '<p style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-f)">Loading opportunities…</p>';

    var res = await SP_API.opportunities.list();

    if (!res.ok) {
      grid.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--color-danger)">' +
        escapeHtml(res.error) + "</p>";
      toast(res.error, "error");
      return;
    }

    oppState.all = res.data.opportunities || [];
    renderOpportunities(oppState.all);
    updateTabCounts();
  }

  /* ── CREATE ───────────────────────────────────────────────────────────────── */
  window.adminCreateOpportunity = async function () {
    var title    = (document.getElementById("newOppTitle")    || {}).value;
    var type     = (document.getElementById("newOppType")     || {}).value;
    var deadline = (document.getElementById("newOppDeadline") || {}).value;
    var org      = (document.getElementById("newOppOrg")      || {}).value;
    var desc     = (document.getElementById("newOppDesc")     || {}).value;

    if (!title || !type || !deadline || !desc) {
      toast("Title, type, deadline, and description are required.", "error");
      return;
    }

    var btn = document.getElementById("createOppBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Publishing…"; }

    var res = await SP_API.opportunities.create({
      title: title,
      opportunity_type: type,
      deadline: deadline,
      organization: org || "",
      description: desc,
      is_active: true,
    });

    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="briefcase" class="icon-xs"></i>Publish'; }

    if (!res.ok) { toast(res.error || "Failed to create opportunity.", "error"); return; }

    if (typeof window.closeModal === "function") window.closeModal("createOppModal");
    toast("Opportunity created successfully.", "success");

    // Clear the form for next time
    ["newOppTitle", "newOppDeadline", "newOppOrg", "newOppDesc"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = "";
    });

    oppState.all.unshift(res.data.opportunity);
    renderOpportunities(oppState.all);
    updateTabCounts();
  };

  /* ── DELETE ───────────────────────────────────────────────────────────────── */
  window.adminDeleteOpportunity = async function (id, btn) {
    if (!confirm("Delete this opportunity? This cannot be undone.")) return;
    btn.disabled = true;

    var res = await SP_API.opportunities.delete(id);
    if (!res.ok) { toast(res.error, "error"); btn.disabled = false; return; }

    var card = btn.closest(".opp-mgmt-card");
    if (card) {
      card.style.transition = "opacity .3s";
      card.style.opacity    = "0";
      setTimeout(function () { card.remove(); }, 300);
    }

    oppState.all = oppState.all.filter(function (o) { return o.id !== id; });
    updateTabCounts();
    toast("Opportunity deleted.", "success");
  };

  /* ── VIEW APPLICANTS ──────────────────────────────────────────────────────── */
  window.adminViewApplicants = async function (id) {
    var res = await SP_API.opportunities.applicants(id);
    if (!res.ok) { toast(res.error, "error"); return; }

    var list = res.data.applicants || [];
    var body = list.length === 0
      ? "<p style='padding:1rem 0;color:var(--text-f)'>No applicants yet.</p>"
      : list.map(function (a) {
          return (
            "<div style='display:flex;justify-content:space-between;padding:.6rem 0;border-top:1px solid var(--border)'>" +
            "<div><p style='font-weight:600;font-size:.85rem'>" + escapeHtml(a.student_name) + "</p>" +
            "<p style='font-size:.75rem;color:var(--text-f)'>" + escapeHtml(a.student_email) + "</p></div>" +
            "<span style='font-family:var(--mono);font-size:.7rem;color:var(--text-f)'>" +
            new Date(a.applied_at).toLocaleDateString() + "</span></div>"
          );
        }).join("");

    // Simple overlay dialog, no dependency on the existing modal system's fixed HTML
    var overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:999;" +
      "display:flex;align-items:center;justify-content:center;padding:1.5rem;";
    overlay.innerHTML =
      "<div style='background:var(--surface);border-radius:16px;max-width:420px;width:100%;" +
      "max-height:70vh;overflow-y:auto;padding:1.75rem;position:relative;'>" +
      "<button id='closeApplicants' style='position:absolute;top:1rem;right:1rem;background:none;" +
      "border:none;font-size:1.3rem;cursor:pointer;color:var(--text-f)'>&times;</button>" +
      "<h3 style='margin-bottom:1rem;font-size:1.05rem'>" + escapeHtml(res.data.opportunity_title) + " — Applicants (" + res.data.count + ")</h3>" +
      body + "</div>";

    document.body.appendChild(overlay);
    function close() { overlay.remove(); }
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.getElementById("closeApplicants").addEventListener("click", close);
  };

  /* ── SEARCH (within the tab-filtered set — admin.js already handles tab clicks
     via data-opp-filter on .opp-mgmt-card, so this just re-uses that DOM state) ── */
  // Note: admin.js's existing oppTabs listener filters by data-opp-type on the
  // DOM directly, which still works fine since our cards carry that attribute.

  /* ── INIT ─────────────────────────────────────────────────────────────────── */
  var loaded = false;

  function onNavClick(e) {
    var link = e.target.closest('.nav-link[data-page="opportunities"]');
    if (link && !loaded) {
      loaded = true;
      setTimeout(loadOpportunities, 80);
    }
  }

  function init() {
    if (!window.SP_API || !window.SP_API.opportunities) {
      console.error("[admin-opportunities] SP_API.opportunities not found — is api-opportunities.js loaded?");
      return;
    }

    var nav = document.querySelector(".sidebar-nav");
    if (nav) nav.addEventListener("click", onNavClick);

    var activePage = document.querySelector(".admin-page.is-active");
    if (activePage && activePage.id === "page-opportunities") {
      loaded = true;
      loadOpportunities();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();

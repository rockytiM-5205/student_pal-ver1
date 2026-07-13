/**
 * student-opportunities-page.js
 * Connects the standalone opportunities.html page to the backend.
 *
 * Load order (bottom of <body>, after auth-guard.js, api.js, api-opportunities.js):
 *   <script src="js/auth-guard.js"></script>
 *   <script src="js/api.js"></script>
 *   <script src="js/api-opportunities.js"></script>
 *   <script src="js/main.js"></script>
 *   <script src="js/student-opportunities-page.js"></script>   ← this file
 */

(function () {
  "use strict";

  var grid = document.getElementById("oppGridFull");
  if (!grid) return; // not on this page

  var TYPE_ICON = {
    scholarship: "award",
    internship:  "code-2",
    competition: "zap",
    ambassador:  "globe",
  };

  var TYPE_ICON_STYLE = {
    scholarship: "background:var(--color-primary-soft);color:var(--color-primary)",
    internship:  "background:var(--color-blue-soft);color:var(--color-blue)",
    competition: "background:var(--color-success-soft);color:var(--color-success)",
    ambassador:  "background:var(--color-warning-soft);color:var(--color-warning)",
  };

  var TYPE_BADGE = {
    scholarship: "badge--cyan",
    internship:  "badge--blue",
    competition: "badge--green",
    ambassador:  "badge--amber",
  };

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function toast(message, type) {
    if (typeof window.showToast === "function") window.showToast(message, type);
    else console.log("[toast:" + (type || "info") + "]", message);
  }

  function deadlineText(o) {
    if (o.urgency === "expired") return "Deadline passed";
    if (o.days_until_deadline === 0) return "Closes today";
    if (o.days_until_deadline === 1) return "Closes tomorrow";
    return "Closes in " + o.days_until_deadline + " days";
  }

  function deadlineClass(urgency) {
    if (urgency === "urgent" || urgency === "expired") return "opp-card__deadline opp-card__deadline--urgent";
    if (urgency === "soon") return "opp-card__deadline opp-card__deadline--soon";
    return "opp-card__deadline";
  }

  var state = { all: [] };

  /* ── RENDER ───────────────────────────────────────────────────────────────── */

  function statusBadge(o) {
    if (o.has_applied) return '<span class="badge badge--neutral">Applied</span>';
    if (o.urgency === "expired") return '<span class="badge badge--neutral">Closed</span>';
    if (o.urgency === "urgent" || o.urgency === "soon") return '<span class="badge badge--red">Closing Soon</span>';
    return '<span class="badge badge--green">Open</span>';
  }

  function actionHtml(o) {
    if (o.has_applied) {
      return [
        '<span class="opp-card__deadline" style="color:var(--color-success)">',
        '  <i data-lucide="check-circle" class="icon-xs"></i>Application submitted',
        '</span>',
        '<button class="btn btn--outline btn--sm" disabled>Applied</button>',
      ].join("");
    }
    if (o.urgency === "expired") {
      return [
        '<span class="' + deadlineClass(o.urgency) + '"><i data-lucide="clock" class="icon-xs"></i>' + deadlineText(o) + '</span>',
        '<button class="btn btn--outline btn--sm" disabled>Closed</button>',
      ].join("");
    }
    return [
      '<span class="' + deadlineClass(o.urgency) + '"><i data-lucide="clock" class="icon-xs"></i>' + deadlineText(o) + '</span>',
      '<a href="#" class="btn btn--primary btn--sm" onclick="StudentOpportunitiesPage.apply(' + o.id + '); return false;">Apply Now</a>',
    ].join("");
  }

  function cardHtml(o) {
    var icon      = TYPE_ICON[o.opportunity_type]       || "briefcase";
    var iconStyle = TYPE_ICON_STYLE[o.opportunity_type] || "";
    var badge     = TYPE_BADGE[o.opportunity_type]      || "badge--neutral";
    var label     = o.opportunity_type_display || o.opportunity_type;

    return [
      '<article class="opp-card" data-type="' + o.opportunity_type + '" data-opp-id="' + o.id + '">',
      '  <div class="opp-card__top">',
      '    <div class="opp-card__icon" style="' + iconStyle + '"><i data-lucide="' + icon + '" class="icon-md"></i></div>',
      '    ' + statusBadge(o),
      '  </div>',
      '  <span class="badge ' + badge + '" style="align-self:flex-start;margin-bottom:var(--s3)">' + escapeHtml(label) + '</span>',
      '  <h3 class="opp-card__title">' + escapeHtml(o.title) + '</h3>',
      '  <p class="opp-card__desc">' + escapeHtml(o.description) + '</p>',
      '  <div class="opp-card__foot">',
      '    ' + actionHtml(o),
      '  </div>',
      '</article>',
    ].join("\n");
  }

  function render(list) {
    if (!list || list.length === 0) {
      grid.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--color-text-faint)">' +
        "No opportunities match your filters.</p>";
      return;
    }
    grid.innerHTML = list.map(cardHtml).join("\n");
    if (window.lucide) window.lucide.createIcons();
  }

  /* ── STATS ROW ────────────────────────────────────────────────────────────── */

  function updateStats(list) {
    var openEl    = document.querySelector(".stat-box:nth-child(1) .stat-box__num");
    var appliedEl = document.querySelector(".stat-box:nth-child(2) .stat-box__num");
    var closingEl = document.querySelector(".stat-box:nth-child(3) .stat-box__num");

    var openCount    = list.filter(function (o) { return o.urgency !== "expired"; }).length;
    var appliedCount = list.filter(function (o) { return o.has_applied; }).length;
    var closingCount = list.filter(function (o) {
      return o.urgency !== "expired" && o.days_until_deadline <= 7;
    }).length;

    if (openEl)    openEl.textContent = openCount;
    if (appliedEl) appliedEl.textContent = appliedCount;
    if (closingEl) closingEl.textContent = closingCount;
    // "Saved" has no backend model yet — left as static placeholder.
  }

  /* ── LOAD FROM API ────────────────────────────────────────────────────────── */

  async function loadAll() {
    grid.innerHTML =
      '<p style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--color-text-faint)">Loading opportunities…</p>';

    var res = await SP_API.opportunities.list();

    if (!res.ok) {
      grid.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--color-danger)">' +
        escapeHtml(res.error) + "</p>";
      toast(res.error, "error");
      return;
    }

    state.all = res.data.opportunities || [];
    applyFilters();
    updateStats(state.all);
  }

  /* ── FILTERING ────────────────────────────────────────────────────────────── */

  function applyFilters() {
    var typeSelect   = document.getElementById("oppFilter");
    var statusSelect = document.getElementById("oppStatusFilter");

    var type   = typeSelect   ? typeSelect.value   : "";
    var status = statusSelect ? statusSelect.value : "";

    var filtered = state.all.filter(function (o) {
      var matchesType = !type || o.opportunity_type === type;

      var matchesStatus = true;
      if (status === "open") {
        matchesStatus = !o.has_applied && o.urgency !== "expired" && o.urgency !== "urgent" && o.urgency !== "soon";
      } else if (status === "closing-soon") {
        matchesStatus = (o.urgency === "urgent" || o.urgency === "soon") && !o.has_applied;
      } else if (status === "applied") {
        matchesStatus = o.has_applied === true;
      }

      return matchesType && matchesStatus;
    });

    render(filtered);
  }

  /* ── APPLY ────────────────────────────────────────────────────────────────── */

  async function apply(id) {
    var card = document.querySelector('[data-opp-id="' + id + '"]');
    var btn  = card ? card.querySelector(".btn--primary") : null;

    if (btn) { btn.textContent = "Applying…"; btn.style.pointerEvents = "none"; }

    var res = await SP_API.opportunities.apply(id);

    if (!res.ok) {
      toast(res.error, "error");
      if (btn) { btn.textContent = "Apply Now"; btn.style.pointerEvents = ""; }
      return;
    }

    toast(res.data.message || "Application submitted successfully!", "success");

    // Update local state and re-render so filters/stats stay accurate
    var item = state.all.find(function (o) { return o.id === id; });
    if (item) item.has_applied = true;

    applyFilters();
    updateStats(state.all);
  }

  window.StudentOpportunitiesPage = { apply: apply };

  /* ── WIRE FILTER EVENTS ───────────────────────────────────────────────────── */

  function wireFilters() {
    var typeSelect   = document.getElementById("oppFilter");
    var statusSelect = document.getElementById("oppStatusFilter");

    [typeSelect, statusSelect].forEach(function (sel) {
      if (sel) sel.addEventListener("change", applyFilters);
    });
  }

  /* ── INIT ─────────────────────────────────────────────────────────────────── */

  function init() {
    if (!window.SP_API || !window.SP_API.opportunities) {
      console.error("[student-opportunities-page] SP_API.opportunities not found — is api-opportunities.js loaded?");
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
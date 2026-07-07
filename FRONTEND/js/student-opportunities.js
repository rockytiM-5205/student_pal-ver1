/**
 * student-opportunities.js
 * Loads real Opportunities data into the "Opportunities Feed" panel
 * on dashboard.html, with a working Apply button.
 *
 * Load order (bottom of <body>, after auth-guard.js, api.js, api-opportunities.js):
 *   <script src="js/auth-guard.js"></script>
 *   <script src="js/api.js"></script>
 *   <script src="js/api-opportunities.js"></script>
 *   <script src="js/dashboard.js"></script>
 *   <script src="js/student-content.js"></script>
 *   <script src="js/student-opportunities.js"></script>   ← this file (load LAST)
 */

(function () {
  "use strict";

  var TYPE_BADGE = {
    scholarship: "badge--primary",
    internship:  "badge--accent",
    competition: "badge--success",
    ambassador:  "badge--danger",
  };

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatDeadlineText(o) {
    if (o.urgency === "expired") return "Deadline passed";
    if (o.days_until_deadline === 0) return "Closes today";
    if (o.days_until_deadline === 1) return "Closes tomorrow";
    return "Closes in " + o.days_until_deadline + " days";
  }

  function deadlineClass(urgency) {
    if (urgency === "urgent" || urgency === "expired") return "deadline deadline--urgent";
    if (urgency === "soon") return "deadline deadline--soon";
    return "deadline";
  }

  function toast(message, type) {
    if (typeof window.showToast === "function") window.showToast(message, type);
    else console.log("[toast:" + (type || "info") + "]", message);
  }

  var oppState = { all: [] };

  /* ── RENDER ───────────────────────────────────────────────────────────────── */

  function oppCardHtml(o) {
    var badge = TYPE_BADGE[o.opportunity_type] || "badge--neutral";
    var label = o.opportunity_type_display || o.opportunity_type;

    var actionHtml = o.has_applied
      ? '<button class="btn btn--outline btn--sm" disabled>Applied ✓</button>'
      : o.urgency === "expired"
        ? '<button class="btn btn--outline btn--sm" disabled>Closed</button>'
        : '<a href="#" class="btn btn--primary btn--sm" onclick="StudentOpportunities.apply(' + o.id + '); return false;">Apply</a>';

    return [
      '<article class="opp-card" data-opp-id="' + o.id + '">',
      '  <span class="badge ' + badge + '">' + escapeHtml(label) + '</span>',
      '  <h3>' + escapeHtml(o.title) + '</h3>',
      '  <p>' + escapeHtml(o.description) + '</p>',
      '  <div class="opp-card__foot">',
      '    <span class="' + deadlineClass(o.urgency) + '"><i data-lucide="clock" class="icon-xs"></i>' + formatDeadlineText(o) + '</span>',
      '    ' + actionHtml,
      '  </div>',
      '</article>',
    ].join("\n");
  }

  function renderOpportunities(list) {
    var grid = document.getElementById("oppGridStudent");
    if (!grid) return;

    if (!list || list.length === 0) {
      grid.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--color-text-faint)">No opportunities available right now.</p>';
      return;
    }

    grid.innerHTML = list.map(oppCardHtml).join("\n");
    if (window.lucide) window.lucide.createIcons();
  }

  /* ── LOAD ─────────────────────────────────────────────────────────────────── */

  async function loadOpportunities() {
    var grid = document.getElementById("oppGridStudent");
    if (!grid) return; // not on this page

    grid.innerHTML =
      '<p style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--color-text-faint)">Loading opportunities…</p>';

    var res = await SP_API.opportunities.list({ active: "true" });

    if (!res.ok) {
      grid.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--color-danger)">' +
        escapeHtml(res.error) + "</p>";
      return;
    }

    oppState.all = (res.data.opportunities || []).slice(0, 4); // dashboard preview: top 4
    renderOpportunities(oppState.all);
  }

  /* ── APPLY ────────────────────────────────────────────────────────────────── */

  async function apply(id) {
    var card = document.querySelector('[data-opp-id="' + id + '"]');
    var btn  = card ? card.querySelector(".btn--primary") : null;

    if (btn) { btn.textContent = "Applying…"; btn.style.pointerEvents = "none"; }

    var res = await SP_API.opportunities.apply(id);

    if (!res.ok) {
      toast(res.error, "error");
      if (btn) { btn.textContent = "Apply"; btn.style.pointerEvents = ""; }
      return;
    }

    toast(res.data.message || "Application submitted successfully!", "success");

    // Update the card in place — no full reload needed
    if (btn) {
      var replacement = document.createElement("button");
      replacement.className = "btn btn--outline btn--sm";
      replacement.disabled  = true;
      replacement.textContent = "Applied ✓";
      btn.replaceWith(replacement);
    }

    // Update local state so a re-render (e.g. filter change) stays consistent
    var idx = oppState.all.findIndex(function (o) { return o.id === id; });
    if (idx !== -1) oppState.all[idx].has_applied = true;
  }

  /* ── PUBLIC API for inline onclick ───────────────────────────────────────── */
  window.StudentOpportunities = { apply: apply };

  /* ── INIT ─────────────────────────────────────────────────────────────────── */
  function init() {
    if (!window.SP_API || !window.SP_API.opportunities) {
      console.error("[student-opportunities] SP_API.opportunities not found — is api-opportunities.js loaded?");
      return;
    }
    loadOpportunities();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();

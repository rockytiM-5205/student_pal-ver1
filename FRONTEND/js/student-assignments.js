/**
 * student-assignments.js
 * Connects assignments.html to the backend: real status (pending/
 * submitted/overdue computed server-side), and a working file-upload
 * Submit button.
 *
 * Load order (bottom of <body>, after auth-guard.js, api.js, main.js):
 *   <script src="js/auth-guard.js"></script>
 *   <script src="js/api.js"></script>
 *   <script src="main.js"></script>
 *   <script src="js/student-assignments.js"></script>   ← this file (load LAST)
 */

(function () {
  "use strict";

  var list = document.getElementById("assignmentList");
  if (!list) return; // not on this page

  var BASE = "http://127.0.0.1:8000/api/assignments";

  /* ── LOW-LEVEL REQUEST ────────────────────────────────────────────────────── */

  async function request(method, path, body, isFormData) {
    var url = BASE + path;
    var opts = { method: method };
    if (body && !isFormData) {
      opts.headers = { "Content-Type": "application/json" };
      opts.body = JSON.stringify(body);
    } else if (isFormData) {
      opts.body = body;
    }

    var authFetch = window.StudentPal && window.StudentPal.authFetch
      ? window.StudentPal.authFetch.bind(window.StudentPal)
      : function (u, o) { return fetch(u, o); };

    var res;
    try {
      res = await authFetch(url, opts);
    } catch (networkErr) {
      console.error("[student-assignments] Network error:", networkErr);
      return { ok: false, status: 0, data: null,
               error: "Cannot connect to the server. Is Django running?" };
    }

    var text = await res.text();
    var data = null;
    try { data = JSON.parse(text); }
    catch (_) {
      return { ok: false, status: res.status, data: null,
               error: "Server returned an unexpected response (status " + res.status + ")." };
    }

    return {
      ok: res.ok, status: res.status, data: data,
      error: res.ok ? null : (data.message || data.detail ||
        ("Request failed (status " + res.status + ")")),
    };
  }

  var API = {
    list:   function () { return request("GET", "/"); },
    submit: function (id, formData) { return request("POST", "/" + id + "/submit/", formData, true); },
  };

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatDue(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function toast(message, type) {
    if (typeof window.showToast === "function") window.showToast(message, type);
    else console.log("[toast:" + (type || "info") + "]", message);
  }

  var STATUS_BADGE = { pending: "badge--amber", submitted: "badge--green", overdue: "badge--red" };
  var STATUS_LABEL = { pending: "Pending", submitted: "Submitted", overdue: "Overdue" };
  var STATUS_ICON  = { pending: "code-2", submitted: "check-circle", overdue: "alert-circle" };

  var state = { all: [] };

  /* ── RENDER ───────────────────────────────────────────────────────────────── */

  function cardHtml(a) {
    var badge = STATUS_BADGE[a.status] || "badge--neutral";
    var label = STATUS_LABEL[a.status] || a.status;
    var icon  = STATUS_ICON[a.status]  || "clipboard-list";
    var iconStyle = a.status === "overdue"
      ? "background:var(--color-danger-soft);color:var(--color-danger)"
      : a.status === "submitted"
        ? "background:var(--color-success-soft);color:var(--color-success)"
        : "";

    var actionHtml = a.status === "submitted"
      ? '<button class="btn btn--outline btn--sm" disabled>Submitted</button>'
      : '<label class="btn btn--primary btn--sm" style="cursor:pointer;margin:0">' +
        (a.status === "overdue" ? "Submit Late" : "Submit") +
        '<input type="file" style="display:none" onchange="StudentAssignments.submit(' + a.id + ', this)" /></label>';

    return [
      '<article class="assignment-card' + (a.status === "overdue" ? " assignment-card--overdue" : "") + '" data-assign-id="' + a.id + '">',
      '  <div class="assignment-card__icon" style="' + iconStyle + '"><i data-lucide="' + icon + '" class="icon-md"></i></div>',
      '  <div>',
      '    <p class="assignment-card__course">' + escapeHtml(a.course_code) + '</p>',
      '    <h3 class="assignment-card__title">' + escapeHtml(a.title) + '</h3>',
      '    <div class="assignment-card__meta">',
      a.lecturer ? '      <span class="assignment-card__meta-item"><i data-lucide="user" class="icon-xs"></i>' + escapeHtml(a.lecturer) + '</span>' : '',
      '      <span class="assignment-card__meta-item"><i data-lucide="calendar" class="icon-xs"></i>Due: ' + formatDue(a.due_date) + '</span>',
      '    </div>',
      '  </div>',
      '  <div class="assignment-card__actions">',
      '    <span class="badge ' + badge + '">' + label + '</span>',
      '    ' + actionHtml,
      '  </div>',
      '</article>',
    ].join("\n");
  }

  function render(list_) {
    if (!list_ || list_.length === 0) {
      list.innerHTML =
        '<p style="text-align:center;padding:2rem;color:var(--color-text-faint)">No assignments right now.</p>';
      return;
    }
    list.innerHTML = list_.map(cardHtml).join("\n");
    if (window.lucide) window.lucide.createIcons();
  }

  /* ── STATS ROW ────────────────────────────────────────────────────────────── */

  function updateStats(items) {
    var nums = document.querySelectorAll(".stats-row .stat-mini__num, .stats-row .stat-box__num");
    var pending   = items.filter(function (a) { return a.status === "pending"; }).length;
    var submitted = items.filter(function (a) { return a.status === "submitted"; }).length;
    var overdue   = items.filter(function (a) { return a.status === "overdue"; }).length;
    var total     = items.length;
    var rate      = total ? Math.round((submitted / total) * 100) : 0;

    if (nums[0]) nums[0].textContent = pending;
    if (nums[1]) nums[1].textContent = submitted;
    if (nums[2]) nums[2].textContent = overdue;
    if (nums[3]) nums[3].textContent = rate + "%";
  }

  /* ── LOAD ─────────────────────────────────────────────────────────────────── */

  async function loadAssignments() {
    list.innerHTML =
      '<p style="text-align:center;padding:2rem;color:var(--color-text-faint)">Loading assignments…</p>';

    var res = await API.list();

    if (!res.ok) {
      list.innerHTML =
        '<p style="text-align:center;padding:2rem;color:var(--color-danger)">' + escapeHtml(res.error) + '</p>';
      toast(res.error, "error");
      return;
    }

    state.all = res.data.assignments || [];
    applyFilters();
    updateStats(state.all);
  }

  /* ── FILTERS ──────────────────────────────────────────────────────────────── */

  function applyFilters() {
    var statusSelect = document.getElementById("assignFilter");
    var courseSelect = document.getElementById("assignCourseFilterStudent");

    var status = statusSelect ? statusSelect.value : "";
    var course = courseSelect ? courseSelect.value : "";

    var filtered = state.all.filter(function (a) {
      var matchesStatus = !status || a.status === status;
      var matchesCourse = !course || a.course_code.toUpperCase().startsWith(course);
      return matchesStatus && matchesCourse;
    });

    render(filtered);
  }

  /* ── SUBMIT ───────────────────────────────────────────────────────────────── */

  async function submit(id, inputEl) {
    var file = inputEl.files[0];
    if (!file) return;

    var card = document.querySelector('[data-assign-id="' + id + '"]');
    var label = card ? card.querySelector(".btn--primary") : null;
    if (label && label.firstChild) label.firstChild.textContent = "Uploading…";

    var formData = new FormData();
    formData.append("file", file);

    var res = await API.submit(id, formData);

    if (!res.ok) {
      toast(res.error, "error");
      if (label && label.firstChild) label.firstChild.textContent = "Submit";
      return;
    }

    toast(res.data.message || "Assignment submitted!", "success");

    var item = state.all.find(function (a) { return a.id === id; });
    if (item) {
      item.status = "submitted";
      item.my_submission = res.data.submission;
    }
    applyFilters();
    updateStats(state.all);
  }

  window.StudentAssignments = { submit: submit };

  /* ── INIT ─────────────────────────────────────────────────────────────────── */

  function init() {
    if (!window.StudentPal) {
      console.error("[student-assignments] StudentPal (auth-guard.js) not found.");
      return;
    }
    loadAssignments();

    var statusSelect = document.getElementById("assignFilter");
    var courseSelect = document.getElementById("assignCourseFilterStudent");
    if (statusSelect) statusSelect.addEventListener("change", applyFilters);
    if (courseSelect) courseSelect.addEventListener("change", applyFilters);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
/**
 * admin-assignments.js
 * Connects admin-dashboard.html's Assignment Management table to
 * the real backend: create, list, filter, delete, and a submission
 * count per assignment.
 *
 * Load order (bottom of <body>, after auth-guard.js, api.js, admin.js):
 *   <script src="js/auth-guard.js"></script>
 *   <script src="js/api.js"></script>
 *   <script src="js/admin.js"></script>
 *   <script src="js/admin-assignments.js"></script>   ← this file (load LAST)
 */

(function () {
  "use strict";

  var tbody = document.getElementById("adminAssignmentTbody");
  if (!tbody) return; // not on this page

  var BASE = "http://127.0.0.1:8000/api/assignments";

  /* ── LOW-LEVEL REQUEST ────────────────────────────────────────────────────── */

  async function request(method, path, body) {
    var url = BASE + path;
    var opts = { method: method };
    if (body) {
      opts.headers = { "Content-Type": "application/json" };
      opts.body = JSON.stringify(body);
    }

    var authFetch = window.StudentPal && window.StudentPal.authFetch
      ? window.StudentPal.authFetch.bind(window.StudentPal)
      : function (u, o) { return fetch(u, o); };

    var res;
    try {
      res = await authFetch(url, opts);
    } catch (networkErr) {
      console.error("[admin-assignments] Network error:", networkErr);
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

  function get(path, params) {
    var qs = "";
    if (params) {
      var pairs = [];
      Object.keys(params).forEach(function (k) {
        if (params[k]) pairs.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
      });
      if (pairs.length) qs = "?" + pairs.join("&");
    }
    return request("GET", path + qs);
  }

  var API = {
    list:   function (filters) { return get("/", filters); },
    create: function (body)    { return request("POST", "/", body); },
    remove: function (id)      { return request("DELETE", "/" + id + "/"); },
  };

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function toast(message, type) {
    if (typeof window.showToast === "function") window.showToast(message, type || "success");
    else alert(message);
  }

  var state = { all: [] };

  /* ── RENDER ───────────────────────────────────────────────────────────────── */

  function rowHtml(a) {
    var badge = a.is_overdue ? "badge--red" : "badge--amber";
    var label = a.is_overdue ? "Overdue" : "Open";

    return [
      '<tr data-assign-id="' + a.id + '" data-course="' + escapeHtml(a.course_code) + '">',
      '  <td><span class="td-mono">' + escapeHtml(a.course_code) + '</span></td>',
      '  <td><strong>' + escapeHtml(a.title) + '</strong></td>',
      '  <td>' + escapeHtml(a.lecturer || "—") + '</td>',
      '  <td class="td-mono">' + formatDate(a.due_date) + '</td>',
      '  <td class="td-mono">' + a.submission_count + '</td>',
      '  <td><span class="badge ' + badge + '">' + label + '</span></td>',
      '  <td><div class="td-actions">',
      '    <button class="btn-icon btn-icon--del" title="Delete" onclick="AdminAssignments.remove(' + a.id + ', this)"><i data-lucide="trash-2" class="icon-xs"></i></button>',
      '  </div></td>',
      '</tr>',
    ].join("\n");
  }

  function render(list) {
    if (!list || list.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-f)">No assignments found.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(rowHtml).join("\n");
    if (window.lucide) window.lucide.createIcons();
  }

  function updateStatsAndFilters(list) {
    var pending   = list.filter(function (a) { return !a.is_overdue; }).length;
    var overdue   = list.filter(function (a) { return a.is_overdue; }).length;
    var submitted = list.reduce(function (sum, a) { return sum + a.submission_count; }, 0);

    var nums = document.querySelectorAll("#assignStatsRow .stat-mini__num");
    if (nums[0]) nums[0].textContent = list.length;
    if (nums[1]) nums[1].textContent = pending;
    if (nums[2]) nums[2].textContent = submitted;
    if (nums[3]) nums[3].textContent = overdue;

    var info = document.getElementById("assignPaginationInfo");
    if (info) info.textContent = "Showing " + list.length + " assignments";

    var courseSelect = document.getElementById("assignCourseFilter");
    if (courseSelect && courseSelect.options.length <= 1) {
      var courses = Array.from(new Set(list.map(function (a) { return a.course_code; })));
      courses.forEach(function (c) {
        var opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        courseSelect.appendChild(opt);
      });
    }
  }

  /* ── LOAD ─────────────────────────────────────────────────────────────────── */

  async function loadAssignments() {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-f)">Loading assignments…</td></tr>';

    var res = await API.list();

    if (!res.ok) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--color-danger)">' + escapeHtml(res.error) + '</td></tr>';
      toast(res.error, "error");
      return;
    }

    state.all = res.data.assignments || [];
    applyFilters();
    updateStatsAndFilters(state.all);
  }

  function applyFilters() {
    var search = document.getElementById("assignSearch");
    var course = document.getElementById("assignCourseFilter");
    var status = document.getElementById("assignStatusFilter");

    var q = search ? search.value.toLowerCase().trim() : "";
    var c = course ? course.value : "";
    var s = status ? status.value : "";

    var filtered = state.all.filter(function (a) {
      var matchesSearch = !q || a.title.toLowerCase().includes(q) || a.course_code.toLowerCase().includes(q);
      var matchesCourse = !c || a.course_code === c;
      var matchesStatus = !s ||
        (s === "overdue" && a.is_overdue) ||
        (s === "pending" && !a.is_overdue) ||
        (s === "submitted" && a.submission_count > 0);
      return matchesSearch && matchesCourse && matchesStatus;
    });

    render(filtered);
  }

  function wireFilters() {
    var search = document.getElementById("assignSearch");
    var course = document.getElementById("assignCourseFilter");
    var status = document.getElementById("assignStatusFilter");

    if (search) {
      var t;
      search.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(applyFilters, 250);
      });
    }
    [course, status].forEach(function (sel) {
      if (sel) sel.addEventListener("change", applyFilters);
    });
  }

  /* ── DELETE ───────────────────────────────────────────────────────────────── */

  async function remove(id, btn) {
    if (!confirm("Delete this assignment? All submissions will be lost. This cannot be undone.")) return;
    btn.disabled = true;

    var res = await API.remove(id);
    if (!res.ok) { toast(res.error, "error"); btn.disabled = false; return; }

    var row = btn.closest("tr");
    if (row) { row.style.transition = "opacity .3s"; row.style.opacity = "0"; setTimeout(function () { row.remove(); }, 300); }

    state.all = state.all.filter(function (a) { return a.id !== id; });
    updateStatsAndFilters(state.all);
    toast("Assignment deleted.", "success");
  }

  /* ── CREATE ───────────────────────────────────────────────────────────────── */

  async function create() {
    var course   = (document.getElementById("newAssignCourse")   || {}).value;
    var lecturer = (document.getElementById("newAssignLecturer") || {}).value;
    var title    = (document.getElementById("newAssignTitle")    || {}).value;
    var dueDate  = (document.getElementById("newAssignDueDate")  || {}).value;
    var dueTime  = (document.getElementById("newAssignDueTime")  || {}).value || "23:59";
    var dept     = (document.getElementById("newAssignDept")     || {}).value;
    var level    = (document.getElementById("newAssignLevel")    || {}).value;
    var desc     = (document.getElementById("newAssignDesc")     || {}).value;

    if (!course || !title || !dueDate) {
      toast("Course code, title, and due date are required.", "error");
      return;
    }

    var btn = document.getElementById("createAssignBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Creating…"; }

    var res = await API.create({
      course_code: course,
      title: title,
      lecturer: lecturer,
      due_date: dueDate + "T" + dueTime + ":00",
      department: dept,
      level: level,
      description: desc,
    });

    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="clipboard-list" class="icon-xs"></i>Create'; }

    if (!res.ok) {
      var errors = res.data && res.data.errors;
      if (errors) {
        var firstError = Object.values(errors)[0];
        toast(Array.isArray(firstError) ? firstError[0] : String(firstError), "error");
      } else {
        toast(res.error || "Failed to create assignment.", "error");
      }
      return;
    }

    if (typeof window.closeModal === "function") window.closeModal("createAssignModal");
    toast("Assignment created.", "success");

    ["newAssignCourse", "newAssignLecturer", "newAssignTitle", "newAssignDueDate", "newAssignDesc"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = "";
    });

    state.all.unshift(res.data.assignment);
    applyFilters();
    updateStatsAndFilters(state.all);
  }

  window.AdminAssignments = { remove: remove, create: create };

  /* ── LOAD ON NAV CLICK ────────────────────────────────────────────────────── */

  var loaded = false;

  function onNavClick(e) {
    var link = e.target.closest('.nav-link[data-page="assignments"]');
    if (link && !loaded) {
      loaded = true;
      setTimeout(loadAssignments, 80);
    }
  }

  function init() {
    if (!window.StudentPal) {
      console.error("[admin-assignments] StudentPal (auth-guard.js) not found.");
      return;
    }

    wireFilters();

    var nav = document.querySelector(".sidebar-nav");
    if (nav) nav.addEventListener("click", onNavClick);

    var activePage = document.querySelector(".admin-page.is-active");
    if (activePage && activePage.id === "page-assignments") {
      loaded = true;
      loadAssignments();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
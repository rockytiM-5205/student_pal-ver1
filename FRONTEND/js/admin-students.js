/**
 * admin-students.js
 * Connects admin-dashboard.html's Student Management page to the
 * real backend. Both self-registered students (via /api/register/)
 * and admin-created students (via /api/admin/students/) live in the
 * exact same User table — this page lists everyone regardless of
 * which path created their account.
 *
 * Load order (bottom of <body>, after auth-guard.js, api.js, admin.js):
 *   <script src="js/auth-guard.js"></script>
 *   <script src="js/api.js"></script>
 *   <script src="js/admin.js"></script>
 *   <script src="js/admin-students.js"></script>   ← this file (load LAST)
 */

(function () {
  "use strict";

  var tbody = document.getElementById("studentTbody");
  if (!tbody) return; // not on this page

  var BASE = "http://127.0.0.1:8000/api/admin";

  /* ── LOW-LEVEL REQUEST ────────────────────────────────────────────────────── */

  async function request(method, path, body) {
    var url = BASE + path;
    var opts = { method: method };
    if (body) {
      opts.headers = { "Content-Type": "application/json" };
      opts.body    = JSON.stringify(body);
    }

    var authFetch = window.StudentPal && window.StudentPal.authFetch
      ? window.StudentPal.authFetch.bind(window.StudentPal)
      : function (u, o) { return fetch(u, o); };

    var res;
    try {
      res = await authFetch(url, opts);
    } catch (networkErr) {
      console.error("[admin-students] Network error:", networkErr);
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
        if (params[k] !== undefined && params[k] !== "") {
          pairs.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
        }
      });
      if (pairs.length) qs = "?" + pairs.join("&");
    }
    return request("GET", path + qs);
  }

  var API = {
    list:      function (filters) { return get("/students/", filters); },
    create:    function (body)    { return request("POST", "/students/", body); },
    setActive: function (id, isActive) { return request("PATCH", "/students/" + id + "/", { is_active: isActive }); },
    remove:    function (id) { return request("DELETE", "/students/" + id + "/"); },
  };

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatJoinDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  }

  function toast(message, type) {
    if (typeof window.showToast === "function") window.showToast(message, type || "success");
    else alert(message);
  }

  var state = { all: [] };

  /* ── RENDER ───────────────────────────────────────────────────────────────── */

  function rowHtml(s) {
    var isActive    = s.is_active;
    var statusBadge = isActive
      ? '<span class="badge badge--green">Active</span>'
      : '<span class="badge badge--amber">Suspended</span>';

    var suspendIcon  = isActive ? "pause-circle" : "play-circle";
    var suspendTitle = isActive ? "Suspend" : "Unsuspend";
    var suspendStyle = isActive ? "" : 'style="background:var(--green-soft);color:var(--green)"';

    return [
      '<tr data-dept="' + escapeHtml(s.department) + '" data-level="' + escapeHtml(s.level) + '" data-status="' + (isActive ? "active" : "suspended") + '" data-student-id="' + s.id + '">',
      '  <td><input type="checkbox" style="width:15px;height:15px;cursor:pointer"></td>',
      '  <td><strong>' + escapeHtml(s.full_name || (s.first_name + " " + s.last_name)) + '</strong></td>',
      '  <td class="td-mono">' + escapeHtml(s.matric_number || "—") + '</td>',
      '  <td>' + escapeHtml(s.department || "—") + '</td>',
      '  <td><span class="badge badge--neutral">' + escapeHtml(s.level || "—") + 'L</span></td>',
      '  <td>' + statusBadge + '</td>',
      '  <td class="td-mono">' + formatJoinDate(s.date_joined) + '</td>',
      '  <td><div class="td-actions">',
      '    <button class="btn-icon btn-icon--view" title="View"><i data-lucide="eye" class="icon-xs"></i></button>',
      '    <button class="btn-icon btn-icon--sus" title="' + suspendTitle + '" ' + suspendStyle + ' onclick="AdminStudents.toggleSuspend(' + s.id + ', ' + !isActive + ', this)"><i data-lucide="' + suspendIcon + '" class="icon-xs"></i></button>',
      '    <button class="btn-icon btn-icon--del" title="Delete" onclick="AdminStudents.remove(' + s.id + ', this)"><i data-lucide="trash-2" class="icon-xs"></i></button>',
      '  </div></td>',
      '</tr>',
    ].join("\n");
  }

  function render(list) {
    if (!list || list.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-f)">No students found.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(rowHtml).join("\n");
    if (window.lucide) window.lucide.createIcons();
  }

  function updatePaginationInfo(shown, total) {
    var infoEls = document.querySelectorAll("#page-students .pagination-info");
    if (infoEls[0]) infoEls[0].textContent = "Showing " + shown + " of " + total + " students";
  }

  function updateStatMinis(list, totalCount) {
    var nums = document.querySelectorAll("#page-students .stat-mini__num");
    var activeCount    = list.filter(function (s) { return s.is_active; }).length;
    var suspendedCount = list.filter(function (s) { return !s.is_active; }).length;

    if (nums[0]) nums[0].textContent = totalCount;
    if (nums[1]) nums[1].textContent = activeCount;
    if (nums[2]) nums[2].textContent = suspendedCount;
    // "New This Month" has no dedicated backend field yet — left as static.
  }

  /* ── LOAD ─────────────────────────────────────────────────────────────────── */

  async function loadStudents(filters) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-f)">Loading students…</td></tr>';

    var res = await API.list(filters);

    if (!res.ok) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--color-danger)">' + escapeHtml(res.error) + '</td></tr>';
      toast(res.error, "error");
      return;
    }

    state.all = res.data.students || [];
    render(state.all);
    updatePaginationInfo(state.all.length, res.data.count);
    updateStatMinis(state.all, res.data.count);
  }

  /* ── FILTERS ──────────────────────────────────────────────────────────────── */

  function currentFilters() {
    var search = document.getElementById("studentSearch");
    var dept   = document.getElementById("studentDeptFilter");
    var level  = document.getElementById("studentLevelFilter");
    var status = document.getElementById("studentStatusFilter");

    return {
      search: search ? search.value : "",
      department: dept ? dept.value : "",
      level: level ? level.value : "",
      status: status ? status.value : "",
    };
  }

  function wireFilters() {
    var search = document.getElementById("studentSearch");
    var dept   = document.getElementById("studentDeptFilter");
    var level  = document.getElementById("studentLevelFilter");
    var status = document.getElementById("studentStatusFilter");

    if (search) {
      var t;
      search.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(function () { loadStudents(currentFilters()); }, 300);
      });
    }
    [dept, level, status].forEach(function (sel) {
      if (sel) sel.addEventListener("change", function () { loadStudents(currentFilters()); });
    });
  }

  /* ── SUSPEND / UNSUSPEND ──────────────────────────────────────────────────── */

  async function toggleSuspend(id, makeActive, btn) {
    btn.disabled = true;
    var res = await API.setActive(id, makeActive);
    btn.disabled = false;

    if (!res.ok) { toast(res.error, "error"); return; }

    toast(res.data.message, "success");
    loadStudents(currentFilters());
  }

  /* ── DELETE ───────────────────────────────────────────────────────────────── */

  async function remove(id, btn) {
    if (!confirm("Permanently delete this student's account? This cannot be undone.")) return;
    btn.disabled = true;

    var res = await API.remove(id);
    if (!res.ok) { toast(res.error, "error"); btn.disabled = false; return; }

    toast(res.data.message, "success");
    var row = btn.closest("tr");
    if (row) {
      row.style.transition = "opacity .3s";
      row.style.opacity = "0";
      setTimeout(function () { row.remove(); }, 300);
    }
    state.all = state.all.filter(function (s) { return s.id !== id; });
    updateStatMinis(state.all, state.all.length);
  }

  /* ── ADD STUDENT (modal) ──────────────────────────────────────────────────── */

  async function create() {
    var first  = (document.getElementById("addStuFirst")    || {}).value;
    var last   = (document.getElementById("addStuLast")     || {}).value;
    var user   = (document.getElementById("addStuUsername") || {}).value;
    var email  = (document.getElementById("addStuEmail")    || {}).value;
    var matric = (document.getElementById("addStuMatric")   || {}).value;
    var dept   = (document.getElementById("addStuDept")     || {}).value;
    var level  = (document.getElementById("addStuLevel")    || {}).value;
    var pw     = (document.getElementById("addStuPassword") || {}).value;

    if (!first || !last || !user || !email) {
      toast("First name, last name, username, and email are required.", "error");
      return;
    }

    var btn = document.getElementById("addStudentBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Creating…"; }

    var res = await API.create({
      first_name: first,
      last_name: last,
      username: user,
      email: email,
      matric_number: matric || null,
      department: dept,
      level: level,
      password: pw || "",
    });

    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="user-plus" class="icon-xs"></i>Add Student'; }

    if (!res.ok) {
      var errors = res.data && res.data.errors;
      if (errors) {
        var firstError = Object.values(errors)[0];
        toast(Array.isArray(firstError) ? firstError[0] : String(firstError), "error");
      } else {
        toast(res.error || "Failed to create student.", "error");
      }
      return;
    }

    // Show the generated password ONCE if the admin didn't set one —
    // it is never retrievable again after this.
    var msgEl = document.getElementById("addStuMsg");
    if (res.data.generated_password && msgEl) {
      msgEl.style.display = "block";
      msgEl.innerHTML =
        "<strong>Temporary password:</strong> " + escapeHtml(res.data.generated_password) +
        "<br>Copy this now — it will not be shown again.";
      // Don't auto-close the modal this time so the admin can copy the password.
      toast(res.data.message, "success");
      loadStudents(currentFilters());
      return;
    }

    if (typeof window.closeModal === "function") window.closeModal("addStudentModal");
    toast(res.data.message || "Student added.", "success");

    // Clear the form for next time
    ["addStuFirst", "addStuLast", "addStuUsername", "addStuEmail", "addStuMatric", "addStuPassword"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = "";
    });
    if (msgEl) msgEl.style.display = "none";

    loadStudents(currentFilters());
  }

  /* ── PUBLIC API for inline onclick ───────────────────────────────────────── */
  window.AdminStudents = {
    toggleSuspend: toggleSuspend,
    remove: remove,
    create: create,
  };

  /* ── LOAD ON NAV CLICK (lazy, same pattern as other admin panels) ─────────── */

  var loaded = false;

  function onNavClick(e) {
    var link = e.target.closest('.nav-link[data-page="students"]');
    if (link && !loaded) {
      loaded = true;
      setTimeout(function () { loadStudents(currentFilters()); }, 80);
    }
  }

  function init() {
    if (!window.StudentPal) {
      console.error("[admin-students] StudentPal (auth-guard.js) not found.");
      return;
    }

    wireFilters();

    var nav = document.querySelector(".sidebar-nav");
    if (nav) nav.addEventListener("click", onNavClick);

    var activePage = document.querySelector(".admin-page.is-active");
    if (activePage && activePage.id === "page-students") {
      loaded = true;
      loadStudents(currentFilters());
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
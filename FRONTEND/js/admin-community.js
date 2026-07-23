/**
 * admin-community.js
 * Connects admin-dashboard.html's Community Management section to
 * the real /api/community/reports/ backend. Approve = dismiss report,
 * keep post. Remove = delete the post entirely.
 *
 * Load order (bottom of <body>, after auth-guard.js, api.js, admin.js):
 *   <script src="js/auth-guard.js"></script>
 *   <script src="js/api.js"></script>
 *   <script src="js/admin.js"></script>
 *   <script src="js/admin-community.js"></script>   ← this file (load LAST)
 */

(function () {
  "use strict";

  var reportGrid = document.getElementById("reportGrid");
  if (!reportGrid) return; // not on this page

  var BASE = "http://127.0.0.1:8000/api/community";

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
      console.error("[admin-community] Network error:", networkErr);
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
    listReports:   function (statusFilter) {
      var qs = statusFilter && statusFilter !== "all" ? "?status=pending" : "";
      // We always fetch pending reports for this panel — resolved ones
      // aren't shown here since they no longer need moderation.
      return request("GET", "/reports/?status=pending");
    },
    listAllPosts:  function () { return request("GET", "/posts/?include_hidden=true"); },
    createPost:    function (content) { return request("POST", "/posts/", { content: content }); },
    deletePost:    function (id) { return request("DELETE", "/posts/" + id + "/"); },
    resolveReport: function (id, action) {
      return request("PATCH", "/reports/" + id + "/", { action: action });
    },
  };

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function timeAgo(iso) {
    var seconds = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (seconds < 60) return "Just now";
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + " minute" + (minutes === 1 ? "" : "s") + " ago";
    var hours = Math.floor(minutes / 60);
    if (hours < 24)   return hours + " hour" + (hours === 1 ? "" : "s") + " ago";
    var days = Math.floor(hours / 24);
    return days + " day" + (days === 1 ? "" : "s") + " ago";
  }

  function toast(message, type) {
    if (typeof window.showToast === "function") window.showToast(message, type || "success");
    else alert(message);
  }

  var REASON_BADGE = {
    spam:          "badge--amber",
    abuse:         "badge--red",
    inappropriate: "badge--purple",
    other:         "badge--neutral",
  };

  var state = { reports: [], posts: [] };

  /* ── ADMIN POST FEED ──────────────────────────────────────────────────────── */

  function postCardHtml(p) {
    return [
      '<article class="post-card" data-post-id="' + p.id + '" style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-md);padding:var(--s5)">',
      '  <div class="post-card__head" style="display:flex;align-items:center;gap:var(--s3);margin-bottom:var(--s3)">',
      '    <div class="admin-avatar admin-avatar--sm">' + escapeHtml(initials(p.author_name)) + '</div>',
      '    <div>',
      '      <p style="font-size:.86rem;font-weight:600">' + escapeHtml(p.author_name) + '</p>',
      '      <p style="font-size:.72rem;color:var(--text-f)">' + escapeHtml(p.author_department || "Student") + '</p>',
      '    </div>',
      '    <span style="margin-left:auto;font-family:var(--mono);font-size:.68rem;color:var(--text-f)">' + timeAgo(p.created_at) + '</span>',
      '  </div>',
      '  <p style="font-size:.88rem;color:var(--text);margin-bottom:var(--s3)">' + escapeHtml(p.content) + '</p>',
      '  <div style="display:flex;align-items:center;gap:var(--s4);font-size:.76rem;color:var(--text-f)">',
      '    <span><i data-lucide="heart" class="icon-xs"></i> ' + p.like_count + '</span>',
      '    <span><i data-lucide="message-circle" class="icon-xs"></i> ' + p.comment_count + '</span>',
      '    <button class="btn btn--outline btn--xs" style="margin-left:auto" onclick="AdminCommunity.deletePost(' + p.id + ', this)"><i data-lucide="trash-2" class="icon-xs"></i>Delete</button>',
      '  </div>',
      '</article>',
    ].join("\n");
  }

  function renderPostFeed(posts) {
    var feedEl  = document.getElementById("adminPostFeed");
    var countEl = document.getElementById("adminPostCount");
    if (!feedEl) return;

    if (countEl) countEl.textContent = posts.length + " post" + (posts.length === 1 ? "" : "s");

    if (!posts || posts.length === 0) {
      feedEl.innerHTML =
        '<p style="text-align:center;padding:2rem;color:var(--text-f)">No posts yet.</p>';
      return;
    }

    feedEl.innerHTML = posts.map(postCardHtml).join("\n");
    if (window.lucide) window.lucide.createIcons();
  }

  async function loadPostFeed() {
    var res = await API.listAllPosts();
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    state.posts = res.data.posts || [];
    renderPostFeed(state.posts);
    updateStats(state.reports, res.data.count);
  }

  function wireAdminCompose() {
    var area = document.getElementById("adminComposeArea");
    var btn  = document.getElementById("adminComposeBtn");
    if (!area || !btn) return;

    btn.addEventListener("click", async function () {
      var content = area.value.trim();
      if (!content) { toast("Write something before posting.", "error"); return; }

      btn.disabled = true;
      btn.textContent = "Posting…";

      var res = await API.createPost(content);

      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="send" class="icon-xs"></i> Post';
      if (window.lucide) window.lucide.createIcons();

      if (!res.ok) { toast(res.error, "error"); return; }

      area.value = "";
      state.posts.unshift(res.data.post);
      renderPostFeed(state.posts);
      toast("Posted to the community feed.", "success");
    });
  }

  async function deletePost(id, btn) {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    btn.disabled = true;

    var res = await API.deletePost(id);
    if (!res.ok) { toast(res.error, "error"); btn.disabled = false; return; }

    var card = btn.closest(".post-card");
    if (card) {
      card.style.transition = "opacity .3s";
      card.style.opacity = "0";
      setTimeout(function () { card.remove(); }, 300);
    }

    state.posts = state.posts.filter(function (p) { return p.id !== id; });
    var countEl = document.getElementById("adminPostCount");
    if (countEl) countEl.textContent = state.posts.length + " post" + (state.posts.length === 1 ? "" : "s");
    toast("Post deleted.", "success");
  }

  /* ── RENDER ───────────────────────────────────────────────────────────────── */

  function initials(name) {
    var parts = (name || "S P").trim().split(" ");
    var first = parts[0] ? parts[0][0] : "S";
    var last  = parts[1] ? parts[1][0] : "P";
    return (first + last).toUpperCase();
  }

  function reportCardHtml(r) {
    var badge = REASON_BADGE[r.reason] || "badge--neutral";
    var isUrgent = r.reason === "abuse";

    return [
      '<div class="report-card' + (isUrgent ? " report-card--urgent" : "") + '" data-com-type="' + r.reason + '" data-report-id="' + r.id + '">',
      '  <div class="report-card__head">',
      '    <div class="report-card__author">',
      '      <div class="admin-avatar admin-avatar--sm">' + escapeHtml(initials(r.post_author_name)) + '</div>',
      '      <div><p class="report-card__author-name">' + escapeHtml(r.post_author_name) + '</p>',
      '      <p class="report-card__author-dept">Reported by ' + escapeHtml(r.reported_by_name) + '</p></div>',
      '    </div>',
      '    <span class="badge ' + badge + '">' + escapeHtml(r.reason_display) + '</span>',
      '  </div>',
      '  <p class="report-card__body">"' + escapeHtml(r.post_content) + '"</p>',
      r.note ? '  <p style="font-size:.78rem;color:var(--text-f);font-style:italic;margin-bottom:var(--s3)">Note: ' + escapeHtml(r.note) + '</p>' : '',
      '  <div class="report-card__foot">',
      '    <div class="report-meta">',
      '      <i data-lucide="flag" class="icon-xs"></i>Reported by ' + r.report_count_on_post + ' user' + (r.report_count_on_post === 1 ? "" : "s"),
      '      <i data-lucide="clock" class="icon-xs" style="margin-left:8px"></i>' + timeAgo(r.created_at),
      '    </div>',
      '    <div style="display:flex;gap:var(--s2)">',
      '      <button class="btn btn--outline btn--xs" onclick="AdminCommunity.resolve(' + r.id + ', \'approve\', this)"><i data-lucide="check" class="icon-xs"></i>Approve</button>',
      '      <button class="btn btn--danger btn--xs" onclick="AdminCommunity.resolve(' + r.id + ', \'remove\', this)"><i data-lucide="trash-2" class="icon-xs"></i>Remove Post</button>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join("\n");
  }

  function render(reports) {
    if (!reports || reports.length === 0) {
      reportGrid.innerHTML =
        '<p style="text-align:center;padding:2rem;color:var(--text-f)">No pending reports. The community is clean 🎉</p>';
      return;
    }
    reportGrid.innerHTML = reports.map(reportCardHtml).join("\n");
    if (window.lucide) window.lucide.createIcons();
  }

  function updateTabCounts() {
    var counts = { all: state.reports.length, spam: 0, abuse: 0, inappropriate: 0 };
    state.reports.forEach(function (r) {
      if (counts[r.reason] !== undefined) counts[r.reason]++;
    });

    var labels = { all: "All Reports", spam: "Spam", abuse: "Abuse", inappropriate: "Inappropriate" };
    document.querySelectorAll(".tab-pills [data-com-filter]").forEach(function (tab) {
      var filter = tab.getAttribute("data-com-filter");
      if (labels[filter] !== undefined) {
        tab.textContent = labels[filter] + " (" + counts[filter] + ")";
      }
    });
  }

  function updateStats(reports, totalPosts) {
    var statEls = document.querySelectorAll("#page-community .stat-mini .stat-mini__num");
    // Order matches the HTML: Total Posts, Reported, Spam, Active Now
    if (statEls[0] && totalPosts !== undefined) statEls[0].textContent = totalPosts;
    if (statEls[1]) statEls[1].textContent = reports.length;
    if (statEls[2]) statEls[2].textContent = reports.filter(function (r) { return r.reason === "spam"; }).length;
    // "Active Now" has no real-time presence tracking backend — left as-is.
  }

  /* ── LOAD ─────────────────────────────────────────────────────────────────── */

  async function loadReports() {
    reportGrid.innerHTML =
      '<p style="text-align:center;padding:2rem;color:var(--text-f)">Loading reports…</p>';

    var res = await API.listReports("pending");

    if (!res.ok) {
      reportGrid.innerHTML =
        '<p style="text-align:center;padding:2rem;color:var(--color-danger)">' + escapeHtml(res.error) + '</p>';
      toast(res.error, "error");
      return;
    }

    state.reports = res.data.reports || [];
    render(state.reports);
    updateTabCounts();

    // Fetch total post count for the "Total Posts" stat card
    var postsRes = await API.listAllPosts();
    updateStats(state.reports, postsRes.ok ? postsRes.data.count : undefined);
  }

  /* ── RESOLVE (approve / remove) ───────────────────────────────────────────── */

  async function resolve(id, action, btn) {
    if (action === "remove" && !confirm("This will permanently delete the post. Continue?")) return;

    var card = btn.closest(".report-card");
    var buttons = card.querySelectorAll("button");
    buttons.forEach(function (b) { b.disabled = true; });

    var res = await API.resolveReport(id, action);

    if (!res.ok) {
      toast(res.error, "error");
      buttons.forEach(function (b) { b.disabled = false; });
      return;
    }

    toast(res.data.message || "Report resolved.", "success");

    card.style.transition = "opacity .3s";
    card.style.opacity = "0";
    setTimeout(function () { card.remove(); }, 300);

    state.reports = state.reports.filter(function (r) { return r.id !== id; });
    updateTabCounts();

    if (state.reports.length === 0) {
      setTimeout(function () { render(state.reports); }, 320);
    }
  }

  window.AdminCommunity = { resolve: resolve, deletePost: deletePost };

  /* ── TAB FILTERING (client-side, over already-loaded reports) ────────────── */

  function wireTabs() {
    var tabsContainer = document.querySelector("#page-community .tab-pills");
    if (!tabsContainer) return;

    tabsContainer.addEventListener("click", function (e) {
      var pill = e.target.closest("[data-com-filter]");
      if (!pill) return;

      tabsContainer.querySelectorAll(".tab-pill").forEach(function (p) { p.classList.remove("is-active"); });
      pill.classList.add("is-active");

      var filter = pill.getAttribute("data-com-filter");
      var filtered = filter === "all"
        ? state.reports
        : state.reports.filter(function (r) { return r.reason === filter; });

      render(filtered);
    });
  }

  /* ── LOAD ON NAV CLICK (lazy, same pattern as other admin panels) ────────── */

  var loaded = false;

  function onNavClick(e) {
    var link = e.target.closest('.nav-link[data-page="community"]');
    if (link && !loaded) {
      loaded = true;
      setTimeout(function () {
        loadReports();
        loadPostFeed();
      }, 80);
    }
  }

  function init() {
    if (!window.StudentPal) {
      console.error("[admin-community] StudentPal (auth-guard.js) not found.");
      return;
    }

    wireTabs();
    wireAdminCompose();

    var nav = document.querySelector(".sidebar-nav");
    if (nav) nav.addEventListener("click", onNavClick);

    var activePage = document.querySelector(".admin-page.is-active");
    if (activePage && activePage.id === "page-community") {
      loaded = true;
      loadReports();
      loadPostFeed();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
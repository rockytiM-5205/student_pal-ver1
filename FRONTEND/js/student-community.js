/**
 * student-community.js
 * Connects community.html to the real backend: posts, likes (with
 * visible "liked by" names), comments (with visible count), and
 * reporting. Replaces main.js's local-only mock compose/like logic.
 *
 * Load order (bottom of <body>, after auth-guard.js, api.js, main.js):
 *   <script src="js/auth-guard.js"></script>
 *   <script src="js/api.js"></script>
 *   <script src="main.js"></script>
 *   <script src="js/student-community.js"></script>   ← this file (load LAST)
 */

(function () {
  "use strict";

  var feed = document.getElementById("postFeed");
  if (!feed) return; // not on this page

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
      console.error("[community] Network error:", networkErr);
      return { ok: false, status: 0, data: null,
               error: "Cannot connect to the server. Is Django running?" };
    }

    var text = await res.text();
    var data = null;
    try { data = JSON.parse(text); }
    catch (_) {
      console.error("[community] Non-JSON response (" + res.status + "):", text.slice(0, 300));
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
    listPosts:    function ()        { return request("GET",  "/posts/"); },
    createPost:   function (content) { return request("POST", "/posts/", { content: content }); },
    deletePost:   function (id)      { return request("DELETE", "/posts/" + id + "/"); },
    toggleLike:   function (id)      { return request("POST", "/posts/" + id + "/like/"); },
    listComments: function (id)      { return request("GET",  "/posts/" + id + "/comments/"); },
    addComment:   function (id, c)   { return request("POST", "/posts/" + id + "/comments/", { content: c }); },
    reportPost:   function (id, reason, note) {
      return request("POST", "/posts/" + id + "/report/", { reason: reason, note: note || "" });
    },
  };

  /* ── HELPERS ──────────────────────────────────────────────────────────────── */

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
    if (days < 7)     return days + " day" + (days === 1 ? "" : "s") + " ago";
    return new Date(iso).toLocaleDateString();
  }

  function toast(message, type) {
    if (typeof window.showToast === "function") window.showToast(message, type);
    else console.log("[toast:" + (type || "info") + "]", message);
  }

  function avatarGradient(seed) {
    var gradients = [
      "linear-gradient(135deg,#06b6d4,#2563eb)",
      "linear-gradient(135deg,#7c3aed,#06b6d4)",
      "linear-gradient(135deg,#d97706,#dc2626)",
      "linear-gradient(135deg,#16a34a,#06b6d4)",
      "linear-gradient(135deg,#2563eb,#7c3aed)",
    ];
    var idx = 0;
    for (var i = 0; i < seed.length; i++) idx += seed.charCodeAt(i);
    return gradients[idx % gradients.length];
  }

  /**
   * Builds the "Liked by X, Y and 4 others" line.
   * Returns "" if nobody has liked the post yet.
   */
  function likedByLine(preview) {
    if (!preview || !preview.names || preview.names.length === 0) return "";

    var names = preview.names.map(escapeHtml);
    var extra = preview.extra || 0;

    var text;
    if (names.length === 1 && extra === 0) {
      text = "Liked by " + names[0];
    } else if (names.length === 2 && extra === 0) {
      text = "Liked by " + names[0] + " and " + names[1];
    } else if (extra === 0) {
      text = "Liked by " + names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
    } else {
      text = "Liked by " + names.join(", ") + " and " + extra + " other" + (extra === 1 ? "" : "s");
    }

    return '<p class="liked-by-line" style="font-size:.76rem;color:var(--color-text-faint);margin-top:4px">' +
           '<i data-lucide="heart" class="icon-xs" style="color:var(--color-danger);vertical-align:-2px"></i> ' +
           text + '</p>';
  }

  var state = { posts: [] };

  /* ── RENDER ───────────────────────────────────────────────────────────────── */

  function postCardHtml(p) {
    var likeClass = p.has_liked ? "post-action is-liked" : "post-action";
    var gradient  = avatarGradient(p.author_name);
    var deptLine  = p.author_department + (p.author_level ? " · " + p.author_level + "L" : "");

    var ownerBtn = p.is_owner
      ? '<button class="post-action" onclick="StudentCommunity.deletePost(' + p.id + ')" title="Delete your post"><i data-lucide="trash-2" class="icon-xs"></i></button>'
      : '<button class="post-action" onclick="StudentCommunity.openReportPrompt(' + p.id + ')" title="Report this post"><i data-lucide="flag" class="icon-xs"></i></button>';

    return [
      '<article class="post-card" data-post-id="' + p.id + '">',
      '  <div class="post-card__head">',
      '    <span class="post-card__avatar" style="background:' + gradient + '">' + escapeHtml(p.author_initials) + '</span>',
      '    <div>',
      '      <p><strong>' + escapeHtml(p.author_name) + '</strong></p>',
      '      <p class="post-card__dept">' + escapeHtml(deptLine) + '</p>',
      '    </div>',
      '    <span class="post-card__time">' + timeAgo(p.created_at) + '</span>',
      '  </div>',
      '  <p class="post-card__body">' + escapeHtml(p.content) + '</p>',
      '  ' + likedByLine(p.liked_by_preview),
      '  <div class="post-card__foot">',
      '    <button class="' + likeClass + '" onclick="StudentCommunity.toggleLike(' + p.id + ')">',
      '      <i data-lucide="heart" class="icon-xs"></i>',
      '      <span class="like-count">' + p.like_count + '</span> Likes',
      '    </button>',
      '    <button class="post-action" onclick="StudentCommunity.toggleComments(' + p.id + ')">',
      '      <i data-lucide="message-circle" class="icon-xs"></i>',
      '      <span class="comment-count">' + p.comment_count + '</span> Comments',
      '    </button>',
      '    <button class="post-action" onclick="StudentCommunity.toggleComments(' + p.id + ')">',
      '      <i data-lucide="share-2" class="icon-xs"></i> Share',
      '    </button>',
      '    ' + ownerBtn,
      '  </div>',
      '  <div class="post-comments" id="comments-' + p.id + '" style="display:none;margin-top:var(--s3);padding-top:var(--s3);border-top:1px solid var(--color-border)"></div>',
      '</article>',
    ].join("\n");
  }

  function render(posts) {
    if (!posts || posts.length === 0) {
      feed.innerHTML =
        '<p style="text-align:center;padding:2rem;color:var(--color-text-faint)">No posts yet. Be the first to share something!</p>';
      return;
    }
    feed.innerHTML = posts.map(postCardHtml).join("\n");
    if (window.lucide) window.lucide.createIcons();
  }

  /* ── LOAD ─────────────────────────────────────────────────────────────────── */

  async function loadPosts() {
    feed.innerHTML =
      '<p style="text-align:center;padding:2rem;color:var(--color-text-faint)">Loading posts…</p>';

    var res = await API.listPosts();

    if (!res.ok) {
      feed.innerHTML =
        '<p style="text-align:center;padding:2rem;color:var(--color-danger)">' + escapeHtml(res.error) + '</p>';
      toast(res.error, "error");
      return;
    }

    state.posts = res.data.posts || [];
    render(state.posts);
  }

  /* ── COMPOSE (replaces main.js's local-only version) ─────────────────────── */

  function wireCompose() {
    var composeArea = document.getElementById("composeArea");
    var composeBtn  = document.getElementById("composeBtn");
    if (!composeArea || !composeBtn) return;

    // Clone-and-replace to strip main.js's existing local-only click handler
    var freshBtn = composeBtn.cloneNode(true);
    composeBtn.parentNode.replaceChild(freshBtn, composeBtn);

    freshBtn.addEventListener("click", async function () {
      var content = composeArea.value.trim();
      if (!content) { toast("Write something before posting.", "error"); return; }

      freshBtn.disabled = true;
      freshBtn.textContent = "Posting…";

      var res = await API.createPost(content);

      freshBtn.disabled = false;
      freshBtn.innerHTML = '<i data-lucide="send" class="icon-xs"></i> Post';
      if (window.lucide) window.lucide.createIcons();

      if (!res.ok) { toast(res.error, "error"); return; }

      composeArea.value = "";
      state.posts.unshift(res.data.post);
      render(state.posts);
      toast("Posted!", "success");
    });
  }

  /* ── LIKE ─────────────────────────────────────────────────────────────────── */

  async function toggleLike(id) {
    var res = await API.toggleLike(id);
    if (!res.ok) { toast(res.error, "error"); return; }

    // Re-fetch just this post's data so liked_by_preview stays accurate
    // (a lightweight full-list reload keeps everything in sync easily).
    var item = state.posts.find(function (p) { return p.id === id; });
    if (item) {
      item.has_liked  = res.data.liked;
      item.like_count = res.data.like_count;
    }

    // Refresh the whole feed to recompute the "Liked by ..." preview names —
    // simplest way to keep that list correct without a second endpoint call.
    var full = await API.listPosts();
    if (full.ok) {
      state.posts = full.data.posts || [];
    }
    render(state.posts);
  }

  /* ── COMMENTS (inline expand/collapse thread) ────────────────────────────── */

  async function toggleComments(id) {
    var container = document.getElementById("comments-" + id);
    if (!container) return;

    var isOpen = container.style.display !== "none";
    if (isOpen) {
      container.style.display = "none";
      return;
    }

    container.style.display = "block";
    container.innerHTML = '<p style="font-size:.82rem;color:var(--color-text-faint)">Loading comments…</p>';

    var res = await API.listComments(id);
    if (!res.ok) {
      container.innerHTML = '<p style="font-size:.82rem;color:var(--color-danger)">' + escapeHtml(res.error) + '</p>';
      return;
    }

    var comments = res.data.comments || [];
    var commentsHtml = comments.map(function (c) {
      return [
        '<div style="display:flex;gap:8px;margin-bottom:10px;font-size:.84rem">',
        '  <span style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:var(--gradient-brand);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700">' + escapeHtml(c.author_initials) + '</span>',
        '  <div><strong>' + escapeHtml(c.author_name) + '</strong> <span style="color:var(--color-text-faint);font-size:.72rem">· ' + timeAgo(c.created_at) + '</span>',
        '  <p style="color:var(--color-text-muted)">' + escapeHtml(c.content) + '</p></div>',
        '</div>',
      ].join("");
    }).join("");

    var countLabel = comments.length === 0
      ? '<p style="font-size:.82rem;color:var(--color-text-faint)">No comments yet — be the first to reply.</p>'
      : '<p style="font-size:.72rem;color:var(--color-text-faint);margin-bottom:8px;font-weight:600">' +
        comments.length + " comment" + (comments.length === 1 ? "" : "s") + '</p>';

    var inputHtml = [
      '<div style="display:flex;gap:8px;margin-top:8px">',
      '  <input type="text" placeholder="Write a comment…" style="flex:1;padding:6px 10px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-surface-2);font-size:.82rem" id="commentInput-' + id + '" />',
      '  <button class="btn btn--primary btn--sm" onclick="StudentCommunity.submitComment(' + id + ')">Send</button>',
      '</div>',
    ].join("");

    container.innerHTML = countLabel + commentsHtml + inputHtml;
  }

  async function submitComment(id) {
    var input = document.getElementById("commentInput-" + id);
    if (!input) return;
    var content = input.value.trim();
    if (!content) return;

    var res = await API.addComment(id, content);
    if (!res.ok) { toast(res.error, "error"); return; }

    var item = state.posts.find(function (p) { return p.id === id; });
    if (item) item.comment_count = res.data.comment_count;

    var card = document.querySelector('[data-post-id="' + id + '"]');
    if (card) {
      var countEl = card.querySelector(".comment-count");
      if (countEl) countEl.textContent = res.data.comment_count;
    }

    input.value = "";
    var container = document.getElementById("comments-" + id);
    container.style.display = "none";
    toggleComments(id);
  }

  /* ── DELETE (own post) ────────────────────────────────────────────────────── */

  async function deletePost(id) {
    if (!confirm("Delete this post?")) return;

    var res = await API.deletePost(id);
    if (!res.ok) { toast(res.error, "error"); return; }

    state.posts = state.posts.filter(function (p) { return p.id !== id; });
    render(state.posts);
    toast("Post deleted.", "success");
  }

  /* ── REPORT (someone else's post) ────────────────────────────────────────── */

  async function openReportPrompt(id) {
    var reason = prompt("Why are you reporting this post?\n\nType exactly: spam, abuse, inappropriate, or other");
    if (!reason) return;

    reason = reason.trim().toLowerCase();
    if (!["spam", "abuse", "inappropriate", "other"].includes(reason)) {
      toast("Please type exactly: spam, abuse, inappropriate, or other.", "error");
      return;
    }

    var res = await API.reportPost(id, reason);
    if (!res.ok) { toast(res.error, "error"); return; }

    toast(res.data.message || "Post reported.", "success");
  }

  /* ── PUBLIC API for inline onclick ───────────────────────────────────────── */
  window.StudentCommunity = {
    toggleLike:        toggleLike,
    toggleComments:    toggleComments,
    submitComment:      submitComment,
    deletePost:        deletePost,
    openReportPrompt:  openReportPrompt,
  };

  /* ── INIT ─────────────────────────────────────────────────────────────────── */

  function init() {
    if (!window.StudentPal) {
      console.error("[student-community] StudentPal (auth-guard.js) not found.");
      return;
    }
    wireCompose();
    loadPosts();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
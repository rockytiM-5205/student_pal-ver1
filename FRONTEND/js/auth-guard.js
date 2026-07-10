/**
 * auth-guard.js
 * Load this on EVERY protected page (dashboard, settings, admin, etc.)
 * BEFORE main.js / admin.js.
 *
 * <script src="js/auth-guard.js"></script>
 *
 * What it does:
 *   1. Checks localStorage for a valid JWT access token.
 *   2. No token → instant redirect to login.html.
 *   3. Token expired → silently refreshes via /api/token/refresh/.
 *   4. Refresh fails → clears session, redirect to login.
 *   5. Valid token → populates greeting + sidebar profile from stored user.
 *   6. Wires ALL logout buttons on the page to call StudentPal.logout()
 *      which POSTs to /api/logout/ to blacklist the token server-side,
 *      then clears localStorage and redirects to login.html.
 *
 * Logout button — add ONE of these attributes to any element:
 *   data-logout        (recommended — explicit)
 *   id="logoutBtn"     (backward compat)
 */

(function () {
  "use strict";

  /* ─────────────────────────────────────────────────────────────
     CONFIG
     API_BASE must NOT end with /api/ — the paths below include it.
  ───────────────────────────────────────────────────────────── */
  var API_BASE   = "http://127.0.0.1:8000"; // ← change to PythonAnywhere URL in prod
  var LOGIN_PAGE = "login.html";

  var STORAGE = {
    ACCESS:  "sp_access",
    REFRESH: "sp_refresh",
    USER:    "sp_user",
    NAME:    "studentpal-user-name",
  };

  // Full endpoint URLs — built once here, never concatenated again
  var ENDPOINTS = {
    logout:  API_BASE + "/api/logout/",
    refresh: API_BASE + "/api/token/refresh/",
  };

  /* ─────────────────────────────────────────────────────────────
     REDIRECT
  ───────────────────────────────────────────────────────────── */
  function redirectToLogin(reason) {
    console.warn("[StudentPal Guard]", reason || "Unauthenticated.");
    window.location.replace(LOGIN_PAGE);
  }

  /* ─────────────────────────────────────────────────────────────
     JWT HELPERS
     We decode locally just to check exp — the server re-validates
     the signature on every protected API call.
  ───────────────────────────────────────────────────────────── */
  function decodePayload(token) {
    try {
      var b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(b64));
    } catch (_) {
      return null;
    }
  }

  function isExpired(token) {
    var p = decodePayload(token);
    if (!p || !p.exp) return true;
    return Date.now() >= p.exp * 1000;
  }

  /* ─────────────────────────────────────────────────────────────
     SESSION STORAGE
  ───────────────────────────────────────────────────────────── */
  function clearSession() {
    Object.values(STORAGE).forEach(function (key) {
      localStorage.removeItem(key);
    });
  }

  function getUser() {
    try {
      var raw = localStorage.getItem(STORAGE.USER);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     TOKEN REFRESH
  ───────────────────────────────────────────────────────────── */
  async function refreshToken() {
    var refresh = localStorage.getItem(STORAGE.REFRESH);
    if (!refresh) return null;

    try {
      var res = await fetch(ENDPOINTS.refresh, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ refresh: refresh }),
      });
      if (!res.ok) return null;

      var data = await res.json();
      if (data.access) {
        localStorage.setItem(STORAGE.ACCESS, data.access);
        if (data.refresh) localStorage.setItem(STORAGE.REFRESH, data.refresh);
        return data.access;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     PAGE GUARD  — runs immediately before DOMContentLoaded
  ───────────────────────────────────────────────────────────── */
  async function guardPage() {
    var access = localStorage.getItem(STORAGE.ACCESS);

    if (!access) {
      redirectToLogin("No access token.");
      return;
    }

    if (isExpired(access)) {
      console.info("[StudentPal Guard] Token expired — refreshing…");
      access = await refreshToken();
      if (!access) {
        clearSession();
        redirectToLogin("Refresh failed.");
        return;
      }
    }

    populateUI();
  }

  /* ─────────────────────────────────────────────────────────────
     POPULATE UI  — fills greeting, sidebar profile from stored user
  ───────────────────────────────────────────────────────────── */
  function populateUI() {
    var user = getUser();
    if (!user) return;

    // Greeting
    var el = document.getElementById("greeting");
    if (el) {
      var h   = new Date().getHours();
      var tod = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
      el.innerHTML = tod + ", " + (user.first_name || user.username || "Student") +
                     ' <span aria-hidden="true">👋</span>';
    }

    // Sidebar profile name
    var nameEl = document.querySelector(".sidebar__profile-name, .sidebar-profile-name");
    if (nameEl) nameEl.textContent = user.username || user.first_name || "Student";

    // Sidebar profile meta (dept + level)
    var metaEl = document.querySelector(".sidebar__profile-meta, .sidebar-profile-role");
    if (metaEl) {
      metaEl.textContent = (user.department || "Student") +
                           (user.level ? " · " + user.level + "L" : "");
    }

    // Avatar initials (topbar + sidebar)
    var initials = ((user.first_name || "S")[0] + (user.last_name || "P")[0]).toUpperCase();
    document.querySelectorAll(".topbar-avatar, .sidebar__profile-avatar").forEach(function (el) {
      if (el.textContent.trim() === "" || el.textContent.trim() === "SP") {
        el.textContent = initials;
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────
     LOGOUT  — the main function
     1. Show a visual loading state on the button clicked
     2. POST refresh token to /api/logout/ (blacklists it server-side)
     3. Clear localStorage regardless of server response
     4. Redirect to login.html
  ───────────────────────────────────────────────────────────── */
  async function logout(triggerEl) {
    // Visual feedback on the button that was clicked
    if (triggerEl) {
      triggerEl.style.opacity = "0.6";
      triggerEl.style.pointerEvents = "none";
      triggerEl.textContent = "Logging out…";
    }

    var access  = localStorage.getItem(STORAGE.ACCESS);
    var refresh = localStorage.getItem(STORAGE.REFRESH);

    // Tell the server to blacklist the refresh token
    if (access && refresh) {
      try {
        await fetch(ENDPOINTS.logout, {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": "Bearer " + access,
          },
          body: JSON.stringify({ refresh: refresh }),
        });
      } catch (err) {
        // Network error is OK — we still clear locally
        console.warn("[StudentPal Guard] Logout API call failed:", err.message);
      }
    }

    clearSession();
    window.location.href = LOGIN_PAGE;
  }

  /* ─────────────────────────────────────────────────────────────
     WIRE LOGOUT BUTTONS
     Intercepts clicks on ANY element that has:
       • data-logout attribute           (recommended)
       • id="logoutBtn"                  (backward compat)
       • class containing "logout-btn"   (convenience)
       • href="login.html"               (plain links)

     The handler calls logout() which POSTs to /api/logout/ first,
     so href="login.html" links NEVER navigate directly — they always
     go through the API blacklist call first.
  ───────────────────────────────────────────────────────────── */
  function wireLogoutButtons() {
    var selector = [
      "[data-logout]",
      "#logoutBtn",
      ".logout-btn",
      'a[href="login.html"]',
    ].join(", ");

    document.querySelectorAll(selector).forEach(function (el) {
      // Avoid double-wiring if auth-guard.js is somehow loaded twice
      if (el.dataset.logoutWired) return;
      el.dataset.logoutWired = "1";

      el.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        logout(el);
      });
    });
  }

  /* ─────────────────────────────────────────────────────────────
     PUBLIC API  — window.StudentPal
     Available on every protected page after this script loads.
  ───────────────────────────────────────────────────────────── */
  window.StudentPal = {

    getToken: function () {
      return localStorage.getItem(STORAGE.ACCESS);
    },

    getUser: getUser,

    logout: function () { logout(null); },

    /**
     * fetch() wrapper that auto-attaches Authorization header.
     * Silently refreshes the token on 401 and retries once.
     *
     * Usage:
     *   var res  = await StudentPal.authFetch("/api/profile/");
     *   var data = await res.json();
     */
    authFetch: async function (url, options) {
      options = options || {};
      var access = localStorage.getItem(STORAGE.ACCESS);

      function doFetch(token) {
        var fullUrl = url.startsWith("http") ? url : API_BASE + url;

        // FIX: FormData uploads (file uploads) must NOT have Content-Type
        // set manually — the browser needs to generate its own
        // "multipart/form-data; boundary=..." header. Forcing
        // "application/json" here was breaking every file upload with
        // a 415 Unsupported Media Type error.
        var isFormData = options.body instanceof FormData;

        var headers = Object.assign({}, options.headers || {}, {
          "Authorization": "Bearer " + token,
        });
        if (!isFormData) {
          headers["Content-Type"] = "application/json";
        }

        return fetch(fullUrl, Object.assign({}, options, { headers: headers }));
      }

      var res = await doFetch(access);

      if (res.status === 401) {
        var newToken = await refreshToken();
        if (newToken) {
          res = await doFetch(newToken);
        } else {
          clearSession();
          redirectToLogin("Session expired.");
        }
      }

      return res;
    },
  };

  /* ─────────────────────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────────────────────── */
  // Guard runs immediately (before page paint) — no flash for unauth users
  guardPage();

  // Wire logout buttons after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireLogoutButtons);
  } else {
    wireLogoutButtons();
  }

})();
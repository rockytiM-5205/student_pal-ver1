/**
 * auth-guard.js
 * Drop this <script> tag into every protected dashboard page.
 *
 * What it does:
 *   1. Checks localStorage for a valid access token.
 *   2. If none found → redirects to login.html immediately.
 *   3. If a token exists → verifies it's not expired (locally, no network).
 *      If it IS expired → tries to get a new one via /api/token/refresh/.
 *      If refresh also fails → clears session and sends to login.
 *   4. Exposes window.StudentPal with helper utilities for every page:
 *        StudentPal.getUser()      → parsed user object from localStorage
 *        StudentPal.getToken()     → current access token string
 *        StudentPal.logout()       → blacklist token + clear storage + redirect
 *        StudentPal.authFetch(...) → fetch() wrapper that auto-attaches Bearer header
 *
 * Usage — paste at the bottom of every protected HTML page, BEFORE main.js:
 *   <script src="js/auth-guard.js"></script>
 */

(function () {
  "use strict";

  /* ── CONFIG ────────────────────────────────────────────────────────────── */
  const API_BASE    = "http://127.0.0.1:8000"; // change for production
  const LOGIN_PAGE  = "login.html";

  const STORAGE = {
    ACCESS:  "sp_access",
    REFRESH: "sp_refresh",
    USER:    "sp_user",
    NAME:    "studentpal-user-name",
  };

  /* ── REDIRECT HELPER ───────────────────────────────────────────────────── */
  function redirectToLogin(reason) {
    console.warn("[StudentPal Guard]", reason || "Unauthenticated — redirecting to login.");
    window.location.replace(LOGIN_PAGE);
  }

  /* ── TOKEN UTILITIES ───────────────────────────────────────────────────── */

  /**
   * Decode a JWT payload WITHOUT verifying the signature.
   * We only use this for the `exp` field to check expiry locally.
   * The server still verifies the signature on every API call.
   */
  function decodeJwtPayload(token) {
    try {
      const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const json    = atob(base64);
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  /** Return true if the token's `exp` claim is in the past. */
  function isTokenExpired(token) {
    const payload = decodeJwtPayload(token);
    if (!payload || !payload.exp) return true;
    // exp is in seconds; Date.now() is milliseconds
    return Date.now() >= payload.exp * 1000;
  }

  /* ── TOKEN REFRESH ─────────────────────────────────────────────────────── */

  async function refreshAccessToken() {
    const refresh = localStorage.getItem(STORAGE.REFRESH);
    if (!refresh) return null;

    try {
      const response = await fetch(`${API_BASE}/api/token/refresh/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ refresh }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (data.access) {
        localStorage.setItem(STORAGE.ACCESS, data.access);
        // simplejwt returns a new refresh token when ROTATE_REFRESH_TOKENS=True
        if (data.refresh) localStorage.setItem(STORAGE.REFRESH, data.refresh);
        return data.access;
      }
      return null;
    } catch {
      return null;
    }
  }

  /* ── SESSION GUARD ─────────────────────────────────────────────────────── */

  async function guardPage() {
    let access = localStorage.getItem(STORAGE.ACCESS);

    // 1 — No token at all
    if (!access) {
      redirectToLogin("No access token found.");
      return;
    }

    // 2 — Token exists but is expired → try to refresh silently
    if (isTokenExpired(access)) {
      console.info("[StudentPal Guard] Access token expired — attempting refresh…");
      access = await refreshAccessToken();

      if (!access) {
        clearSession();
        redirectToLogin("Refresh token expired or invalid.");
        return;
      }
      console.info("[StudentPal Guard] Token refreshed successfully.");
    }

    // 3 — We have a valid token — populate greeting if the element exists
    populateGreeting();
  }

  /* ── GREETING POPULATION ───────────────────────────────────────────────── */

  function populateGreeting() {
    const raw = localStorage.getItem(STORAGE.USER);
    if (!raw) return;

    try {
      const user = JSON.parse(raw);

      // Topbar greeting (dashboard.html / admin-dashboard.html pattern)
      const greetingEl = document.getElementById("greeting");
      if (greetingEl) {
        const hour = new Date().getHours();
        const timeOfDay =
          hour < 12 ? "Good Morning"
          : hour < 17 ? "Good Afternoon"
          : "Good Evening";
        const name = user.first_name || user.username || "Student";
        greetingEl.innerHTML = `${timeOfDay}, ${name} <span aria-hidden="true">👋</span>`;
      }

      // Sidebar profile name / role
      const profileName = document.querySelector(".sidebar__profile-name");
      const profileMeta = document.querySelector(".sidebar__profile-meta");
      if (profileName) profileName.textContent = user.username || user.first_name || "Student";
      if (profileMeta) profileMeta.textContent = `${user.department || "Student"} · ${user.level || ""}L`;
    } catch {
      // Corrupt user data — ignore
    }
  }

  /* ── SESSION HELPERS ───────────────────────────────────────────────────── */

  function clearSession() {
    localStorage.removeItem(STORAGE.ACCESS);
    localStorage.removeItem(STORAGE.REFRESH);
    localStorage.removeItem(STORAGE.USER);
    localStorage.removeItem(STORAGE.NAME);
  }

  /* ── PUBLIC API ────────────────────────────────────────────────────────── */

  window.StudentPal = {

    /** Return the current access token string, or null. */
    getToken() {
      return localStorage.getItem(STORAGE.ACCESS);
    },

    /** Return the parsed user object from localStorage, or null. */
    getUser() {
      try {
        const raw = localStorage.getItem(STORAGE.USER);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },

    /**
     * Log the user out:
     *   1. Tell the server to blacklist the refresh token.
     *   2. Clear all session data from localStorage.
     *   3. Redirect to login.html.
     */
    async logout() {
      const access  = localStorage.getItem(STORAGE.ACCESS);
      const refresh = localStorage.getItem(STORAGE.REFRESH);

      try {
        if (access && refresh) {
          await fetch(`${API_BASE}/api/logout/`, {
            method:  "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${access}`,
            },
            body: JSON.stringify({ refresh }),
          });
        }
      } catch {
        // Network error — clear locally and move on
      }

      clearSession();
      window.location.href = LOGIN_PAGE;
    },

    /**
     * A drop-in replacement for fetch() that automatically:
     *   - Attaches the Authorization: Bearer header
     *   - Refreshes the access token if the server returns 401
     *   - Clears the session and redirects on a second 401
     *
     * Usage:
     *   const res = await StudentPal.authFetch("/api/profile/");
     *   const data = await res.json();
     */
    async authFetch(url, options = {}) {
      let access = localStorage.getItem(STORAGE.ACCESS);

      const makeRequest = (token) =>
        fetch(url.startsWith("http") ? url : `${API_BASE}${url}`, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
            Authorization: `Bearer ${token}`,
          },
        });

      let response = await makeRequest(access);

      // 401 → try one silent token refresh, then retry
      if (response.status === 401) {
        const newAccess = await refreshAccessToken();
        if (newAccess) {
          response = await makeRequest(newAccess);
        } else {
          clearSession();
          redirectToLogin("Session expired — please sign in again.");
          return response;
        }
      }

      return response;
    },
  };

  /* ── WIRE UP LOGOUT BUTTONS ────────────────────────────────────────────── */
  // Any element with data-logout="true" or id="logoutBtn" triggers logout.
  document.addEventListener("DOMContentLoaded", function () {
    const logoutBtns = document.querySelectorAll('[data-logout], #logoutBtn, [href="login.html"]');
    logoutBtns.forEach((btn) => {
      // Only intercept logout-intent links (href="login.html")
      if (btn.tagName === "A" && btn.getAttribute("href") !== "login.html") return;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        window.StudentPal.logout();
      });
    });
  });

  /* ── RUN THE GUARD ─────────────────────────────────────────────────────── */
  // Runs immediately (before DOMContentLoaded) so there is zero
  // visible flash of the protected page for unauthenticated users.
  guardPage();

})();
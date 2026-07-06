/**
 * api.js  —  StudentPal API Layer
 * ================================
 * Centralises ALL fetch() calls to the Django backend so every page
 * uses the same base URL, auth header, and error handling.
 *
 * Load order on every protected page:
 *   1. lucide CDN
 *   2. auth-guard.js      ← sets up window.StudentPal + session guard
 *   3. api.js             ← this file (exposes window.SP_API)
 *   4. page-specific JS   ← admin.js / main.js etc.
 *
 * Usage anywhere:
 *   const resources    = await SP_API.resources.list({ department: "CSC", level: "200" });
 *   const announcement = await SP_API.announcements.get(id);
 */

(function () {
  "use strict";

  /* ── CONFIG ──────────────────────────────────────────────────────────────── */
  var BASE = "http://127.0.0.1:8000/api"; // ← change for production

  /* ── LOW-LEVEL REQUEST ───────────────────────────────────────────────────── */

  /**
   * Internal fetch wrapper.
   * Uses StudentPal.authFetch() from auth-guard.js so the Authorization
   * header is always attached and tokens are silently refreshed on 401.
   */
  async function request(method, path, body, isFormData) {
    var url = BASE + path;

    var opts = { method: method };

    if (body && !isFormData) {
      opts.headers = { "Content-Type": "application/json" };
      opts.body    = JSON.stringify(body);
    } else if (isFormData) {
      // Let the browser set Content-Type with the correct boundary
      opts.body = body;
    }

    var authFetch = window.StudentPal && window.StudentPal.authFetch
      ? window.StudentPal.authFetch.bind(window.StudentPal)
      : function(u, o) { return fetch(u, o); }; // fallback for public pages

    var res;
    try {
      res = await authFetch(url, opts);
    } catch (networkErr) {
      console.error("[SP_API] Network error:", networkErr);
      return { ok: false, status: 0, data: null,
               error: "Cannot connect to the server. Is Django running on port 8000?" };
    }

    // Safe parse — avoids "Unexpected token <" if Django returns HTML
    var text = await res.text();
    var data = null;
    try { data = JSON.parse(text); }
    catch (_) {
      console.error("[SP_API] Non-JSON response (" + res.status + "):", text.slice(0, 300));
      return { ok: false, status: res.status, data: null,
               error: "Server returned an unexpected response (status " + res.status + ")." };
    }

    return { ok: res.ok, status: res.status, data: data,
             error: res.ok ? null : (data.message || data.detail ||
               ("Request failed (status " + res.status + "). Check the Django terminal for details.")) };
  }

  function get(path, params) {
    var qs = "";
    if (params) {
      var pairs = [];
      Object.keys(params).forEach(function(k) {
        if (params[k] !== undefined && params[k] !== "" && params[k] !== null) {
          pairs.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
        }
      });
      if (pairs.length) qs = "?" + pairs.join("&");
    }
    return request("GET", path + qs);
  }

  function post(path, body, isFormData) { return request("POST",   path, body, isFormData); }
  function patch(path, body)             { return request("PATCH",  path, body); }
  function del(path)                     { return request("DELETE", path); }

  /* ── RESOURCES ───────────────────────────────────────────────────────────── */

  var resources = {

    /**
     * List resources with optional filters.
     * filters: { department, level, resource_type, course_code, search }
     */
    list: function(filters) {
      return get("/resources/", filters);
    },

    /** Get a single resource by id. */
    get: function(id) {
      return get("/resources/" + id + "/");
    },

    /**
     * Upload a resource (admin only).
     * data must be a FormData object with file attached.
     */
    upload: function(formData) {
      return post("/resources/", formData, true);
    },

    /** Update resource metadata (admin only). */
    update: function(id, body) {
      return patch("/resources/" + id + "/", body);
    },

    /** Delete a resource (admin only). */
    delete: function(id) {
      return del("/resources/" + id + "/");
    },

    /**
     * Increment download count and get the file URL.
     * Returns { file_url, filename, title }
     */
    download: function(id) {
      return get("/resources/" + id + "/download/");
    },
  };

  /* ── ANNOUNCEMENTS ───────────────────────────────────────────────────────── */

  var announcements = {

    /**
     * List published announcements with optional filters.
     * filters: { category, audience, department, faculty, search }
     * Admins can also pass { draft: "true" } to see unpublished.
     */
    list: function(filters) {
      return get("/announcements/", filters);
    },

    /** Get a single announcement by id. */
    get: function(id) {
      return get("/announcements/" + id + "/");
    },

    /** Create an announcement (admin only). */
    create: function(body) {
      return post("/announcements/", body);
    },

    /** Update an announcement (admin only). */
    update: function(id, body) {
      return patch("/announcements/" + id + "/", body);
    },

    /** Delete an announcement (admin only). */
    delete: function(id) {
      return del("/announcements/" + id + "/");
    },

    /** Publish or unpublish an announcement (admin only). */
    publish: function(id, isPublished) {
      return patch("/announcements/" + id + "/publish/", { is_published: isPublished });
    },
  };

  /* ── PUBLIC API ──────────────────────────────────────────────────────────── */

  window.SP_API = {
    resources:     resources,
    announcements: announcements,
  };

})();
/**
 * api-opportunities.js
 * Extends window.SP_API with an `opportunities` namespace.
 * Load this AFTER api.js and BEFORE admin-opportunities.js / student-opportunities.js.
 *
 * <script src="js/api.js"></script>
 * <script src="js/api-opportunities.js"></script>
 * <script src="js/admin-opportunities.js"></script>      (admin page only)
 * <script src="js/student-opportunities.js"></script>    (student page only)
 */

(function () {
  "use strict";

  if (!window.SP_API) {
    console.error("[api-opportunities] SP_API not found — load api.js first.");
    return;
  }

  // Reuse the exact same low-level request machinery api.js already built.
  // We recreate get/post/patch/del here in the same shape since api.js
  // keeps them private inside its own closure.
  var BASE = "http://127.0.0.1:8000/api";

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
      console.error("[SP_API.opportunities] Network error:", networkErr);
      return { ok: false, status: 0, data: null,
               error: "Cannot connect to the server. Is Django running on port 8000?" };
    }

    var text = await res.text();
    var data = null;
    try { data = JSON.parse(text); }
    catch (_) {
      console.error("[SP_API.opportunities] Non-JSON response (" + res.status + "):", text.slice(0, 300));
      return { ok: false, status: res.status, data: null,
               error: "Server returned an unexpected response (status " + res.status + ")." };
    }

    return {
      ok: res.ok, status: res.status, data: data,
      error: res.ok ? null : (data.message || data.detail ||
        ("Request failed (status " + res.status + "). Check the Django terminal.")),
    };
  }

  function get(path, params) {
    var qs = "";
    if (params) {
      var pairs = [];
      Object.keys(params).forEach(function (k) {
        if (params[k] !== undefined && params[k] !== "" && params[k] !== null) {
          pairs.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
        }
      });
      if (pairs.length) qs = "?" + pairs.join("&");
    }
    return request("GET", path + qs);
  }

  window.SP_API.opportunities = {

    /**
     * List opportunities with optional filters:
     *   { opportunity_type, search, active: "true" }
     */
    list: function (filters) {
      return get("/opportunities/", filters);
    },

    /** Get a single opportunity by id. */
    get: function (id) {
      return get("/opportunities/" + id + "/");
    },

    /** Create an opportunity (admin only). */
    create: function (body) {
      return request("POST", "/opportunities/", body);
    },

    /** Update an opportunity (admin only). */
    update: function (id, body) {
      return request("PATCH", "/opportunities/" + id + "/", body);
    },

    /** Delete an opportunity (admin only). */
    delete: function (id) {
      return request("DELETE", "/opportunities/" + id + "/");
    },

    /** Student applies to an opportunity. */
    apply: function (id) {
      return request("POST", "/opportunities/" + id + "/apply/");
    },

    /** List applicants for an opportunity (admin only). */
    applicants: function (id) {
      return get("/opportunities/" + id + "/applicants/");
    },
  };

})();

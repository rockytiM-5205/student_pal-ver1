/**
 * admin-login.js  — fully self-contained
 * Same /api/login/ endpoint as the student login, but with one
 * critical extra check: if the authenticated account's role is not
 * "admin" (and it isn't is_staff either), the login is REJECTED
 * client-side before any token or session is saved — a student
 * account can never end up inside the admin dashboard from here.
 */

(function () {
  "use strict";

  /* ─────────────────────────────────────────────────────────────
     CONFIG
  ───────────────────────────────────────────────────────────── */
  var API_BASE = "http://127.0.0.1:8000"; // ← change for production

  var ENDPOINTS = {
    login: API_BASE + "/api/login/",
  };

  var ADMIN_REDIRECT = "admin-dashboard.html";
  var THEME_KEY      = "studentpal-theme";

  /* ─────────────────────────────────────────────────────────────
     1. THEME TOGGLE
  ───────────────────────────────────────────────────────────── */
  var root     = document.documentElement;
  var themeBtn = document.getElementById("themeToggle");
  var systemMQ = window.matchMedia("(prefers-color-scheme: dark)");

  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    if (themeBtn) {
      themeBtn.setAttribute("aria-label",   t === "dark" ? "Switch to light theme" : "Switch to dark theme");
      themeBtn.setAttribute("aria-pressed", String(t === "dark"));
    }
  }

  function saveTheme(t) {
    applyTheme(t);
    try { localStorage.setItem(THEME_KEY, t); } catch (_) {}
  }

  applyTheme(root.getAttribute("data-theme") || "light");

  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      saveTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });
  }

  var followOS = function (e) {
    try { if (!localStorage.getItem(THEME_KEY)) applyTheme(e.matches ? "dark" : "light"); }
    catch (_) {}
  };
  systemMQ.addEventListener
    ? systemMQ.addEventListener("change", followOS)
    : systemMQ.addListener && systemMQ.addListener(followOS);

  /* ─────────────────────────────────────────────────────────────
     2. LUCIDE ICONS
  ───────────────────────────────────────────────────────────── */
  function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }
  renderIcons();

  /* ─────────────────────────────────────────────────────────────
     3. PAGE FADE-IN
  ───────────────────────────────────────────────────────────── */
  requestAnimationFrame(function () {
    document.body.classList.remove("page-enter");
  });

  /* ─────────────────────────────────────────────────────────────
     4. PASSWORD VISIBILITY TOGGLE
  ───────────────────────────────────────────────────────────── */
  document.querySelectorAll(".field__toggle[data-toggle-for]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var inputId = btn.getAttribute("data-toggle-for");
      var input   = document.getElementById(inputId);
      if (!input) return;

      var isPassword = input.type === "password";
      input.type     = isPassword ? "text" : "password";

      btn.innerHTML = isPassword
        ? '<i data-lucide="eye-off" class="icon-sm"></i>'
        : '<i data-lucide="eye"     class="icon-sm"></i>';
      btn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
      renderIcons();
    });
  });

  /* ─────────────────────────────────────────────────────────────
     5. AUTO-REDIRECT — only if an EXISTING ADMIN session is valid.
     A logged-in student who lands here is NOT redirected anywhere —
     they just see the admin login form, as expected.
  ───────────────────────────────────────────────────────────── */
  (function checkExistingSession() {
    try {
      var access  = localStorage.getItem("sp_access");
      var rawUser = localStorage.getItem("sp_user");
      if (access && rawUser) {
        var user = JSON.parse(rawUser);
        if (user.role === "admin") {
          window.location.replace(ADMIN_REDIRECT);
        }
        // If it's a student session, do nothing — let them see this form.
      }
    } catch (_) {
      ["sp_access", "sp_refresh", "sp_user"].forEach(function (k) {
        localStorage.removeItem(k);
      });
    }
  })();

  /* ─────────────────────────────────────────────────────────────
     6. DOM REFS
  ───────────────────────────────────────────────────────────── */
  var form          = document.getElementById("adminLoginForm");
  var emailInput    = document.getElementById("adminEmail");
  var passwordInput = document.getElementById("adminPassword");
  var submitBtn     = document.getElementById("adminLoginSubmit");
  var toastRegion   = document.getElementById("toastRegion");
  var emailError    = document.getElementById("adminEmailError");
  var passwordError = document.getElementById("adminPasswordError");

  if (!form) return;

  /* ─────────────────────────────────────────────────────────────
     7. HELPERS
  ───────────────────────────────────────────────────────────── */
  function showToast(message, type) {
    type = type || "error";
    if (!toastRegion) return;

    var icons = { success: "check", error: "x", info: "info" };
    var toast = document.createElement("div");
    toast.className = "toast toast--" + type;
    toast.innerHTML =
      '<span class="toast__icon"><i data-lucide="' + (icons[type] || "x") + '" class="icon-xs"></i></span>' +
      '<p class="toast__text">' + message + "</p>";

    toastRegion.appendChild(toast);
    renderIcons();

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { toast.classList.add("is-visible"); });
    });

    setTimeout(function () {
      toast.classList.remove("is-visible");
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 320);
    }, 5000);
  }

  function setFieldError(input, errorEl, message) {
    if (input)   input.classList.toggle("has-error", Boolean(message));
    if (errorEl) {
      errorEl.textContent = message || "";
      errorEl.classList.toggle("is-visible", Boolean(message));
    }
  }

  function clearErrors() {
    setFieldError(emailInput,    emailError,    "");
    setFieldError(passwordInput, passwordError, "");
  }

  function setLoading(on) {
    submitBtn.classList.toggle("is-loading", on);
    submitBtn.disabled = on;
  }

  function isValidEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  }

  /* ─────────────────────────────────────────────────────────────
     8. CLIENT-SIDE VALIDATION
  ───────────────────────────────────────────────────────────── */
  function validateForm() {
    var valid    = true;
    var email    = emailInput.value.trim();
    var password = passwordInput.value;

    if (!email) {
      setFieldError(emailInput, emailError, "Email address is required.");
      valid = false;
    } else if (!isValidEmail(email)) {
      setFieldError(emailInput, emailError, "Please enter a valid email address.");
      valid = false;
    }

    if (!password) {
      setFieldError(passwordInput, passwordError, "Password is required.");
      valid = false;
    }

    return valid;
  }

  /* ─────────────────────────────────────────────────────────────
     9. SESSION STORAGE
  ───────────────────────────────────────────────────────────── */
  function saveSession(tokens, user) {
    localStorage.setItem("sp_access",  tokens.access);
    localStorage.setItem("sp_refresh", tokens.refresh);
    localStorage.setItem("sp_user",    JSON.stringify(user));
    localStorage.setItem("studentpal-user-name", user.first_name || user.username || "Admin");
  }

  /* ─────────────────────────────────────────────────────────────
     10. API CALL — safe JSON parsing (handles HTML error pages)
  ───────────────────────────────────────────────────────────── */
  async function callLoginAPI(email, password) {
    var response;
    try {
      response = await fetch(ENDPOINTS.login, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email, password: password }),
      });
    } catch (networkErr) {
      showToast("Cannot connect to the server. Check that Django is running.", "error");
      console.error("[Admin Login] Network error:", networkErr);
      return null;
    }

    var rawText = await response.text();
    var data;
    try {
      data = JSON.parse(rawText);
    } catch (_) {
      console.error("[Admin Login] Non-JSON response (" + response.status + "):", rawText.slice(0, 400));
      showToast("Unexpected server response (status " + response.status + "). Check the Django terminal.", "error");
      return null;
    }

    if (!response.ok) {
      var serverErrors = data.errors || {};
      var nonField     = serverErrors.non_field_errors;

      if (nonField) {
        showToast(Array.isArray(nonField) ? nonField[0] : nonField, "error");
      } else if (data.detail) {
        showToast(data.detail, "error");
      } else {
        showToast(data.message || "Login failed. Please try again.", "error");
      }
      return null;
    }

    return data; // { message, user, tokens }
  }

  /* ─────────────────────────────────────────────────────────────
     11. FORM SUBMIT
     The critical admin gate lives here: even with valid credentials,
     a non-admin account is rejected before any session is saved.
  ───────────────────────────────────────────────────────────── */
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearErrors();

    if (!validateForm()) {
      showToast("Please fix the errors and try again.", "error");
      return;
    }

    setLoading(true);

    var result = await callLoginAPI(
      emailInput.value.trim(),
      passwordInput.value
    );

    if (!result) {
      setLoading(false);
      return;
    }

    var user = result.user;

    // ── THE ADMIN GATE ────────────────────────────────────────
    // Credentials were valid, but this account is not an admin.
    // Refuse to save any session data and stop here.
    var isAdmin = user && (user.role === "admin" || user.is_staff);

    if (!isAdmin) {
      showToast(
        "This account does not have admin privileges. Use the student sign-in page instead.",
        "error"
      );
      setLoading(false);
      return;
    }

    // ── Genuinely an admin — proceed normally ─────────────────
    saveSession(result.tokens, user);
    showToast(result.message || ("Welcome back, " + (user.first_name || "Admin") + "!"), "success");

    setTimeout(function () {
      window.location.href = ADMIN_REDIRECT;
    }, 800);
  });

})();
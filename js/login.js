/**
 * login.js  — fully self-contained
 * Fixed: better error messages that tell the developer exactly
 *        what went wrong (CORS, server down, wrong URL, bad credentials).
 */

(function () {
  "use strict";

  /* ─────────────────────────────────────────────────────────────
     CONFIG
     Change API_BASE to match where your Django server is running.
     • Local dev       → "http://127.0.0.1:8000"
     • PythonAnywhere  → "https://studentpal.pythonanywhere.com"
  ───────────────────────────────────────────────────────────── */
  const API_BASE = "http://127.0.0.1:8000";

  const ENDPOINTS = {
    login:  `${API_BASE}/api/login/`,
    health: `${API_BASE}/api/login/`,   // same endpoint, OPTIONS ping
  };

  const REDIRECTS = {
    student: "dashboard.html",
    admin:   "admin-dashboard.html",
  };

  const THEME_KEY = "studentpal-theme";

  /* ─────────────────────────────────────────────────────────────
     1. THEME TOGGLE
  ───────────────────────────────────────────────────────────── */
  const root     = document.documentElement;
  const themeBtn = document.getElementById("themeToggle");
  const systemMQ = window.matchMedia("(prefers-color-scheme: dark)");

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

  const followOS = function (e) {
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
      var inputId     = btn.getAttribute("data-toggle-for");
      var input       = document.getElementById(inputId);
      if (!input) return;

      var isPassword  = input.type === "password";
      input.type      = isPassword ? "text" : "password";

      btn.innerHTML   = isPassword
        ? '<i data-lucide="eye-off" class="icon-sm"></i>'
        : '<i data-lucide="eye"     class="icon-sm"></i>';
      btn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
      renderIcons();
    });
  });

  /* ─────────────────────────────────────────────────────────────
     5. AUTO-REDIRECT — skip login page if session exists
  ───────────────────────────────────────────────────────────── */
  (function checkExistingSession() {
    try {
      var access  = localStorage.getItem("sp_access");
      var rawUser = localStorage.getItem("sp_user");
      if (access && rawUser) {
        var user = JSON.parse(rawUser);
        window.location.replace(REDIRECTS[user.role] || REDIRECTS.student);
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
  var loginForm     = document.getElementById("loginForm");
  var emailInput    = document.getElementById("loginEmail");
  var passwordInput = document.getElementById("loginPassword");
  var submitBtn     = document.getElementById("loginSubmit");
  var toastRegion   = document.getElementById("toastRegion");
  var emailError    = document.getElementById("loginEmailError");
  var passwordError = document.getElementById("loginPasswordError");

  if (!loginForm) return;

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
    localStorage.setItem("studentpal-user-name", user.first_name || user.username || "Student");
  }

  /* ─────────────────────────────────────────────────────────────
     10. NETWORK ERROR DIAGNOSIS
     fetch() only throws (lands in catch) for network-level failures:
       - CORS blocked           → "Failed to fetch" / "NetworkError"
       - Server not running     → "Failed to fetch" / "net::ERR_CONNECTION_REFUSED"
       - Wrong URL / typo       → same as above if host is unreachable
     Server errors (400, 401, 500) do NOT throw — they return normally.
  ───────────────────────────────────────────────────────────── */
  function diagnoseNetworkError(err) {
    var msg = err ? (err.message || err.toString()) : "";
    console.error("[StudentPal] Fetch failed:", msg, err);

    // CORS is the #1 cause — browser blocks the request before it leaves
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("Load failed") ||         // Safari
      msg.includes("ERR_CONNECTION_REFUSED")
    ) {
      return (
        "Cannot connect to the server. " +
        "Check that: (1) Django is running on port 8000, " +
        "(2) CORS_ALLOW_ALL_ORIGINS = True is set in settings.py, " +
        "(3) you are opening this page via a local server (not file://). " +
        "See console for the full error."
      );
    }

    return "A network error occurred (" + msg + "). Check the browser console for details.";
  }

  /* ─────────────────────────────────────────────────────────────
     11. API CALL
  ───────────────────────────────────────────────────────────── */
  async function callLoginAPI(email, password) {
    var response = await fetch(ENDPOINTS.login, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email: email, password: password }),
    });

    // Safe parse — response.json() throws "Unexpected token <"
    // if the server returns HTML (e.g. Django 404/500 debug page).
    var rawText = await response.text();
    var data;
    try {
      data = JSON.parse(rawText);
    } catch (_) {
      console.error("[StudentPal] Non-JSON response (" + response.status + "):", rawText.slice(0, 400));
      if (response.status === 404) {
        showToast("API not found (404). Add path(\"api/\", include(\"accounts.urls\")) to your root urls.py.", "error");
      } else if (response.status === 500) {
        showToast("Django server error (500). Check your terminal for the Python traceback.", "error");
      } else {
        showToast("Unexpected server response (" + response.status + "). Check the browser console.", "error");
      }
      return null;
    }

    if (!response.ok) {
      var serverErrors = data.errors || {};
      var nonField     = serverErrors.non_field_errors;
      if (nonField) {
        showToast(Array.isArray(nonField) ? nonField[0] : nonField, "error");
      } else {
        if (serverErrors.email)    setFieldError(emailInput,    emailError,    serverErrors.email[0]);
        if (serverErrors.password) setFieldError(passwordInput, passwordError, serverErrors.password[0]);
        if (!serverErrors.email && !serverErrors.password) {
          showToast(data.message || "Login failed. Please try again.", "error");
        }
      }
      return null;
    }

    return data; // { message, user, tokens }
  }

  /* ─────────────────────────────────────────────────────────────
     12. FORM SUBMIT — single handler
  ───────────────────────────────────────────────────────────── */
  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearErrors();

    if (!validateForm()) {
      showToast("Please fix the errors and try again.", "error");
      return;
    }

    setLoading(true);

    try {
      var result = await callLoginAPI(
        emailInput.value.trim(),
        passwordInput.value
      );

      if (!result) {
        setLoading(false);
        return;
      }

      var user   = result.user;
      var tokens = result.tokens;

      saveSession(tokens, user);
      showToast(result.message || ("Welcome back, " + (user.first_name || "Student") + "!"), "success");

      setTimeout(function () {
        window.location.href = REDIRECTS[user.role] || REDIRECTS.student;
      }, 900);

    } catch (err) {
      showToast(diagnoseNetworkError(err), "error");
      setLoading(false);
    }
  });

})();
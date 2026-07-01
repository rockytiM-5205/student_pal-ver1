/* ===================================================================
   STUDENTPAL — AUTH SCRIPT (shared by login.html + register.html)
   1. Utilities
   2. Theme system
   3. Lucide icon rendering
   4. Page transitions
   5. Toast notifications
   6. Password visibility toggles
   7. Field error helpers
   8. Login form
   9. Register form (password strength + confirm match + submit)
   =================================================================== */

(function () {
  "use strict";

  /* -----------------------------------------------------------
     1. UTILITIES
  ----------------------------------------------------------- */
  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  /* -----------------------------------------------------------
     2. THEME SYSTEM
     Same contract as the rest of the product: <head> sets
     data-theme synchronously to avoid a flash; this syncs the
     toggle and keeps following the OS theme until the person
     makes an explicit choice.
  ----------------------------------------------------------- */
  var THEME_KEY = "studentpal-theme";
  var root = document.documentElement;
  var themeToggle = document.getElementById("themeToggle");
  var systemSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function hasStoredPreference() {
    try {
      return localStorage.getItem(THEME_KEY) !== null;
    } catch (e) {
      return false;
    }
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    if (themeToggle) {
      var isDark = theme === "dark";
      themeToggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
      themeToggle.setAttribute("aria-pressed", String(isDark));
    }
  }

  function setExplicitTheme(theme) {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      /* localStorage unavailable — theme still applies this session */
    }
  }

  applyTheme(root.getAttribute("data-theme") || "light");

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
      setExplicitTheme(current === "dark" ? "light" : "dark");
    });
  }

  function handleSystemSchemeChange(e) {
    if (!hasStoredPreference()) {
      applyTheme(e.matches ? "dark" : "light");
    }
  }

  if (typeof systemSchemeQuery.addEventListener === "function") {
    systemSchemeQuery.addEventListener("change", handleSystemSchemeChange);
  } else if (typeof systemSchemeQuery.addListener === "function") {
    systemSchemeQuery.addListener(handleSystemSchemeChange); // Safari < 14
  }

  /* -----------------------------------------------------------
     3. LUCIDE ICON RENDERING
  ----------------------------------------------------------- */
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }

  /* -----------------------------------------------------------
     4. PAGE TRANSITIONS
     Fade in on load; fade out before navigating to another page
     in the auth flow (login ↔ register, or on to the dashboard).
  ----------------------------------------------------------- */
  requestAnimationFrame(function () {
    document.body.classList.remove("page-enter");
  });

  function navigateWithTransition(url) {
    if (prefersReducedMotion) {
      window.location.href = url;
      return;
    }
    document.body.classList.add("is-leaving");
    window.setTimeout(function () {
      window.location.href = url;
    }, 250);
  }

  document.querySelectorAll("a[data-page-link]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      navigateWithTransition(link.getAttribute("href"));
    });
  });

  /* -----------------------------------------------------------
     5. TOAST NOTIFICATIONS
  ----------------------------------------------------------- */
  var toastRegion = document.getElementById("toastRegion");

  function showToast(message, type) {
    if (!toastRegion) return;

    var toast = document.createElement("div");
    toast.className = "toast toast--" + (type || "success");

    var icon = document.createElement("span");
    icon.className = "toast__icon";
    icon.innerHTML =
      type === "error"
        ? '<i data-lucide="x" class="icon-xs"></i>'
        : '<i data-lucide="check" class="icon-xs"></i>';

    var text = document.createElement("p");
    text.className = "toast__text";
    text.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(text);
    toastRegion.appendChild(toast);

    if (window.lucide) window.lucide.createIcons();

    requestAnimationFrame(function () {
      toast.classList.add("is-visible");
    });

    window.setTimeout(function () {
      toast.classList.remove("is-visible");
      window.setTimeout(function () {
        toast.remove();
      }, 300);
    }, 3800);
  }

  /* -----------------------------------------------------------
     6. PASSWORD VISIBILITY TOGGLES
  ----------------------------------------------------------- */
  document.querySelectorAll(".field__toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var targetId = btn.getAttribute("data-toggle-for");
      var input = document.getElementById(targetId);
      if (!input) return;

      var isPassword = input.getAttribute("type") === "password";
      input.setAttribute("type", isPassword ? "text" : "password");

      var icon = isPassword ? "eye-off" : "eye";
      btn.innerHTML = '<i data-lucide="' + icon + '" class="icon-sm"></i>';
      btn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");

      if (window.lucide) window.lucide.createIcons();
    });
  });

  /* -----------------------------------------------------------
     7. FIELD ERROR HELPERS
  ----------------------------------------------------------- */
  function setFieldError(input, errorEl, message) {
    if (errorEl) {
      errorEl.textContent = message || "";
      errorEl.classList.toggle("is-visible", Boolean(message));
    }
    if (input) {
      input.classList.toggle("has-error", Boolean(message));
      input.setAttribute("aria-invalid", message ? "true" : "false");
    }
  }

  function shakeField(input) {
    if (prefersReducedMotion) return;
    var control = input ? input.closest(".field__control") : null;
    if (!control) return;
    control.classList.remove("shake");
    // Force reflow so the animation can re-trigger on repeated errors.
    void control.offsetWidth;
    control.classList.add("shake");
  }

  /* -----------------------------------------------------------
     8. LOGIN FORM
  ----------------------------------------------------------- */
  var loginForm = document.getElementById("loginForm");

  if (loginForm) {
    var loginEmail = document.getElementById("loginEmail");
    var loginEmailError = document.getElementById("loginEmailError");
    var loginPassword = document.getElementById("loginPassword");
    var loginPasswordError = document.getElementById("loginPasswordError");
    var loginSubmit = document.getElementById("loginSubmit");

    function deriveDisplayName(email) {
      var local = email.split("@")[0] || "Student";
      var clean = local.replace(/[._\d]+/g, " ").trim();
      if (!clean) clean = "Student";
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();

      var emailValue = loginEmail.value.trim();
      var passwordValue = loginPassword.value;
      var valid = true;

      if (!emailValue) {
        setFieldError(loginEmail, loginEmailError, "Email address is required.");
        shakeField(loginEmail);
        valid = false;
      } else if (!EMAIL_PATTERN.test(emailValue)) {
        setFieldError(loginEmail, loginEmailError, "Enter a valid email address.");
        shakeField(loginEmail);
        valid = false;
      } else {
        setFieldError(loginEmail, loginEmailError, "");
      }

      if (!passwordValue) {
        setFieldError(loginPassword, loginPasswordError, "Password is required.");
        shakeField(loginPassword);
        valid = false;
      } else {
        setFieldError(loginPassword, loginPasswordError, "");
      }

      if (!valid) {
        showToast("Please fix the errors below and try again.", "error");
        return;
      }

      loginSubmit.classList.add("is-loading");
      loginSubmit.disabled = true;
      loginSubmit.setAttribute("aria-busy", "true");

      window.setTimeout(function () {
        try {
          localStorage.setItem("studentpal-user-name", deriveDisplayName(emailValue));
        } catch (err) {
          /* ignore persistence failures */
        }

        showToast("Welcome back! Redirecting to your dashboard…", "success");

        window.setTimeout(function () {
          navigateWithTransition("dashboard.html");
        }, 900);
      }, 1100);
    });
  }

  /* -----------------------------------------------------------
     9. REGISTER FORM
  ----------------------------------------------------------- */
  var registerForm = document.getElementById("registerForm");

  if (registerForm) {
    var firstName = document.getElementById("firstName");
    var firstNameError = document.getElementById("firstNameError");
    var lastName = document.getElementById("lastName");
    var lastNameError = document.getElementById("lastNameError");
    var username = document.getElementById("username");
    var usernameError = document.getElementById("usernameError");
    var registerEmail = document.getElementById("registerEmail");
    var registerEmailError = document.getElementById("registerEmailError");
    var phone = document.getElementById("phone");
    var phoneError = document.getElementById("phoneError");
    var registerPassword = document.getElementById("registerPassword");
    var confirmPassword = document.getElementById("confirmPassword");
    var confirmPasswordHint = document.getElementById("confirmPasswordHint");
    var agreeTerms = document.getElementById("agreeTerms");
    var agreeTermsError = document.getElementById("agreeTermsError");
    var registerSubmit = document.getElementById("registerSubmit");
    var pwRequirementItems = document.querySelectorAll("#pwRequirements li");

    var PW_RULES = {
      length: function (v) {
        return v.length >= 8;
      },
      uppercase: function (v) {
        return /[A-Z]/.test(v);
      },
      lowercase: function (v) {
        return /[a-z]/.test(v);
      },
      number: function (v) {
        return /[0-9]/.test(v);
      },
    };

    function passwordMeetsAllRules(value) {
      return Object.keys(PW_RULES).every(function (rule) {
        return PW_RULES[rule](value);
      });
    }

    // Live password requirement checklist
    registerPassword.addEventListener("input", function () {
      var value = registerPassword.value;
      pwRequirementItems.forEach(function (li) {
        var rule = li.getAttribute("data-rule");
        var met = PW_RULES[rule] ? PW_RULES[rule](value) : false;
        li.classList.toggle("is-met", met);
      });
      // Re-check confirm field live too, in case it was already filled.
      if (confirmPassword.value) {
        checkPasswordsMatch();
      }
    });

    // Live confirm-password match indicator
    function checkPasswordsMatch() {
      if (!confirmPassword.value) {
        confirmPasswordHint.textContent = "";
        confirmPasswordHint.classList.remove("is-visible", "is-success", "is-error");
        return false;
      }
      var matches = confirmPassword.value === registerPassword.value;
      confirmPasswordHint.textContent = matches ? "Passwords match." : "Passwords do not match.";
      confirmPasswordHint.classList.add("is-visible");
      confirmPasswordHint.classList.toggle("is-success", matches);
      confirmPasswordHint.classList.toggle("is-error", !matches);
      confirmPassword.classList.toggle("has-error", !matches);
      return matches;
    }

    confirmPassword.addEventListener("input", checkPasswordsMatch);

    registerForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var valid = true;

      // Required text fields
      [
        [firstName, firstNameError, "First name is required."],
        [lastName, lastNameError, "Last name is required."],
        [username, usernameError, "Username is required."],
        [phone, phoneError, "Phone number is required."],
      ].forEach(function (group) {
        var input = group[0],
          errorEl = group[1],
          message = group[2];
        if (!input.value.trim()) {
          setFieldError(input, errorEl, message);
          shakeField(input);
          valid = false;
        } else {
          setFieldError(input, errorEl, "");
        }
      });

      // Email
      var emailValue = registerEmail.value.trim();
      if (!emailValue) {
        setFieldError(registerEmail, registerEmailError, "Email address is required.");
        shakeField(registerEmail);
        valid = false;
      } else if (!EMAIL_PATTERN.test(emailValue)) {
        setFieldError(registerEmail, registerEmailError, "Enter a valid email address.");
        shakeField(registerEmail);
        valid = false;
      } else {
        setFieldError(registerEmail, registerEmailError, "");
      }

      // Password rules
      if (!passwordMeetsAllRules(registerPassword.value)) {
        registerPassword.classList.add("has-error");
        shakeField(registerPassword);
        valid = false;
      } else {
        registerPassword.classList.remove("has-error");
      }

      // Confirm password
      if (!checkPasswordsMatch()) {
        shakeField(confirmPassword);
        valid = false;
      }

      // Terms agreement
      if (!agreeTerms.checked) {
        agreeTermsError.textContent = "You must agree to the Terms and Conditions to continue.";
        agreeTermsError.classList.add("is-visible");
        valid = false;
      } else {
        agreeTermsError.textContent = "";
        agreeTermsError.classList.remove("is-visible");
      }

      if (!valid) {
        showToast("Please fix the errors below and try again.", "error");
        return;
      }

      registerSubmit.classList.add("is-loading");
      registerSubmit.disabled = true;
      registerSubmit.setAttribute("aria-busy", "true");

      window.setTimeout(function () {
        try {
          localStorage.setItem("studentpal-user-name", firstName.value.trim());
        } catch (err) {
          /* ignore persistence failures */
        }

        showToast("Account created! Redirecting you to sign in…", "success");

        window.setTimeout(function () {
          navigateWithTransition("login.html");
        }, 900);
      }, 1200);
    });
  }
})();

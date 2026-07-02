/**
 * register.js
 * Connects the StudentPal registration form to the DRF backend.
 *
 * Flow:
 *   1. Student fills all fields and clicks "Create Account"
 *   2. Client-side validation runs first (fast, no network)
 *   3. We POST to /api/register/
 *   4. On success:
 *      - Show a success toast
 *      - Redirect to login.html after a short delay
 *   5. On failure:
 *      - Show field-level error messages under the relevant inputs
 *      - Show a general toast for non-field errors
 */

(function () {
  "use strict";

  /* ── CONFIG ────────────────────────────────────────────────────────────── */
  const API_BASE = "http://127.0.0.1:8000"; // swap for production URL

  const ENDPOINTS = {
    register: `${API_BASE}/api/register/`,
  };

  /* ── DOM REFS ──────────────────────────────────────────────────────────── */
  const registerForm   = document.getElementById("registerForm");
  const submitBtn      = document.getElementById("registerSubmit");
  const toastRegion    = document.getElementById("toastRegion");

  // Form inputs
  const fields = {
    firstName:        document.getElementById("firstName"),
    lastName:         document.getElementById("lastName"),
    username:         document.getElementById("username"),
    email:            document.getElementById("registerEmail"),
    phone:            document.getElementById("phone"),
    university:       document.getElementById("university"),
    faculty:          document.getElementById("faculty"),
    department:       document.getElementById("department"),
    level:            document.getElementById("level"),
    matricNumber:     document.getElementById("matricNumber"),   // may not exist in old HTML
    password:         document.getElementById("registerPassword"),
    confirmPassword:  document.getElementById("confirmPassword"),
    agreeTerms:       document.getElementById("agreeTerms"),
  };

  // Error paragraph elements
  const errors = {
    firstName:       document.getElementById("firstNameError"),
    lastName:        document.getElementById("lastNameError"),
    username:        document.getElementById("usernameError"),
    email:           document.getElementById("registerEmailError"),
    phone:           document.getElementById("phoneError"),
    matricNumber:    document.getElementById("matricNumberError"),
    agreeTerms:      document.getElementById("agreeTermsError"),
  };

  // Password requirements list items (data-rule attribute)
  const pwRequirements = document.querySelectorAll("#pwRequirements li");

  if (!registerForm) return; // guard: only run on the register page

  /* ── UTILITIES ─────────────────────────────────────────────────────────── */

  function showToast(message, type = "error") {
    if (!toastRegion) return;
    const icons = { success: "check", error: "x", info: "info" };

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__icon">
        <i data-lucide="${icons[type] || "x"}" class="icon-xs"></i>
      </span>
      <p class="toast__text">${message}</p>
    `;
    toastRegion.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add("is-visible"));
    });
    setTimeout(() => {
      toast.classList.remove("is-visible");
      setTimeout(() => toast.remove(), 320);
    }, 4500);
  }

  /** Show an error under a specific field. */
  function setFieldError(inputEl, errorEl, message) {
    if (inputEl) inputEl.classList.toggle("has-error", Boolean(message));
    if (errorEl) {
      errorEl.textContent = message || "";
      errorEl.classList.toggle("is-visible", Boolean(message));
    }
  }

  /** Clear all inline field errors. */
  function clearAllErrors() {
    Object.keys(fields).forEach((key) => {
      setFieldError(fields[key], errors[key], "");
    });
  }

  function setLoading(loading) {
    submitBtn.classList.toggle("is-loading", loading);
    submitBtn.disabled = loading;
  }

  function isValidEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  }

  /* ── LIVE PASSWORD STRENGTH CHECKER ────────────────────────────────────── */

  const PW_RULES = {
    length:    (v) => v.length >= 8,
    uppercase: (v) => /[A-Z]/.test(v),
    lowercase: (v) => /[a-z]/.test(v),
    number:    (v) => /[0-9]/.test(v),
  };

  function passwordMeetsAll(value) {
    return Object.values(PW_RULES).every((fn) => fn(value));
  }

  if (fields.password) {
    fields.password.addEventListener("input", function () {
      const val = this.value;
      pwRequirements.forEach((li) => {
        const rule = li.getAttribute("data-rule");
        if (PW_RULES[rule]) li.classList.toggle("is-met", PW_RULES[rule](val));
      });
    });
  }

  /* ── LIVE CONFIRM-PASSWORD CHECKER ─────────────────────────────────────── */

  const confirmHint = document.getElementById("confirmPasswordHint");

  if (fields.confirmPassword) {
    fields.confirmPassword.addEventListener("input", function () {
      if (!this.value) {
        if (confirmHint) {
          confirmHint.textContent = "";
          confirmHint.className = "field__hint";
        }
        return;
      }
      const match = this.value === fields.password?.value;
      if (confirmHint) {
        confirmHint.textContent = match ? "Passwords match." : "Passwords do not match.";
        confirmHint.className   = `field__hint is-visible ${match ? "is-success" : "is-error"}`;
      }
    });
  }

  /* ── CLIENT-SIDE VALIDATION ────────────────────────────────────────────── */

  function validateForm() {
    let valid = true;

    // First name
    if (!fields.firstName?.value.trim()) {
      setFieldError(fields.firstName, errors.firstName, "First name is required.");
      valid = false;
    }

    // Last name
    if (!fields.lastName?.value.trim()) {
      setFieldError(fields.lastName, errors.lastName, "Last name is required.");
      valid = false;
    }

    // Username
    const username = fields.username?.value.trim();
    if (!username) {
      setFieldError(fields.username, errors.username, "Username is required.");
      valid = false;
    } else if (username.length < 3) {
      setFieldError(fields.username, errors.username, "Username must be at least 3 characters.");
      valid = false;
    }

    // Email
    const email = fields.email?.value.trim();
    if (!email) {
      setFieldError(fields.email, errors.email, "Email address is required.");
      valid = false;
    } else if (!isValidEmail(email)) {
      setFieldError(fields.email, errors.email, "Please enter a valid email address.");
      valid = false;
    }

    // Matric number (optional but validated if provided)
    const matric = fields.matricNumber?.value.trim();
    if (matric) {
      if (!/^\d{9}$/.test(matric)) {
        setFieldError(fields.matricNumber, errors.matricNumber, "Matric number must be exactly 9 digits.");
        valid = false;
      }
    }

    // Password
    const pw = fields.password?.value;
    if (!pw) {
      setFieldError(fields.password, null, "Password is required.");
      valid = false;
    } else if (!passwordMeetsAll(pw)) {
      setFieldError(fields.password, null, "Password does not meet all requirements.");
      valid = false;
    }

    // Confirm password
    const cpw = fields.confirmPassword?.value;
    if (!cpw) {
      valid = false;
    } else if (cpw !== pw) {
      valid = false;
      showToast("Passwords do not match. Please check and try again.", "error");
    }

    // Terms agreement
    if (!fields.agreeTerms?.checked) {
      setFieldError(null, errors.agreeTerms, "You must agree to the Terms and Conditions.");
      valid = false;
    }

    return valid;
  }

  /* ── BUILD PAYLOAD ─────────────────────────────────────────────────────── */

  /**
   * Collect all form values into the JSON body expected by /api/register/.
   * Fields that don't exist in the current HTML are safely skipped.
   */
  function buildPayload() {
    return {
      first_name:    fields.firstName?.value.trim()       || "",
      last_name:     fields.lastName?.value.trim()        || "",
      username:      fields.username?.value.trim()        || "",
      email:         fields.email?.value.trim().toLowerCase() || "",
      matric_number: fields.matricNumber?.value.trim()    || null,
      department:    fields.department?.value             || "",
      level:         fields.level?.value                  || "",
      phone_number:  fields.phone?.value.trim()           || "",
      faculty:       fields.faculty?.value                || "",
      university:    fields.university?.value             || "",
      password:      fields.password?.value               || "",
      confirm_password: fields.confirmPassword?.value     || "",
    };
  }

  /* ── API CALL ──────────────────────────────────────────────────────────── */

  async function submitRegistration(payload) {
    const response = await fetch(ENDPOINTS.register, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      // Map server errors back to inline field messages
      const serverErrors = data.errors || {};

      const fieldMap = {
        first_name:    { input: fields.firstName,    error: errors.firstName },
        last_name:     { input: fields.lastName,     error: errors.lastName },
        username:      { input: fields.username,     error: errors.username },
        email:         { input: fields.email,        error: errors.email },
        matric_number: { input: fields.matricNumber, error: errors.matricNumber },
        phone_number:  { input: fields.phone,        error: errors.phone },
      };

      let hasFieldError = false;

      Object.entries(serverErrors).forEach(([serverField, messages]) => {
        const target = fieldMap[serverField];
        if (target) {
          const msg = Array.isArray(messages) ? messages[0] : messages;
          setFieldError(target.input, target.error, msg);
          hasFieldError = true;
        }
      });

      if (!hasFieldError) {
        showToast(data.message || "Registration failed. Please try again.", "error");
      } else {
        showToast("Please fix the highlighted errors and try again.", "error");
      }

      return null;
    }

    return data; // { message, user, tokens }
  }

  /* ── FORM SUBMIT HANDLER ───────────────────────────────────────────────── */

  registerForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearAllErrors();

    if (!validateForm()) {
      showToast("Please fix the errors and try again.", "error");
      return;
    }

    setLoading(true);

    try {
      const payload = buildPayload();
      const result  = await submitRegistration(payload);

      if (!result) {
        // Error already shown inside submitRegistration
        setLoading(false);
        return;
      }

      // ── Success ──────────────────────────────────────────────
      showToast(
        result.message || "Account created! Redirecting you to sign in…",
        "success"
      );

      // Redirect to login after a brief pause so the user reads the toast
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);

    } catch (networkError) {
      console.error("[StudentPal] Registration network error:", networkError);
      showToast(
        "Could not reach the server. Please check your connection and try again.",
        "error"
      );
      setLoading(false);
    }
  });

})();
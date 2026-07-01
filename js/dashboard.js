/* ===================================================================
   STUDENTPAL — DASHBOARD SCRIPT
   1. Utilities
   2. Theme system (same logic as the marketing site)
   3. Lucide icon rendering
   4. Sidebar drawer (mobile)
   5. Dropdowns (notifications, profile) — shared toggle logic
   6. Dynamic greeting + date
   7. Task checklist (localStorage-persisted)
   8. Academic progress ring
   =================================================================== */

(function () {
  "use strict";

  /* -----------------------------------------------------------
     1. UTILITIES
  ----------------------------------------------------------- */
  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* -----------------------------------------------------------
     2. THEME SYSTEM
     Identical contract to the marketing site: the <head> already
     set data-theme synchronously to avoid a flash. This syncs the
     toggle button and keeps following the OS theme until the
     person makes an explicit choice, which then persists.
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
      themeToggle.setAttribute(
        "aria-label",
        isDark ? "Switch to light theme" : "Switch to dark theme"
      );
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
     4. SIDEBAR DRAWER (mobile / tablet)
  ----------------------------------------------------------- */
  var sidebar = document.getElementById("sidebar");
  var sidebarOverlay = document.getElementById("sidebarOverlay");
  var sidebarToggle = document.getElementById("sidebarToggle");
  var sidebarClose = document.getElementById("sidebarClose");

  function openSidebar() {
    sidebar.classList.add("is-open");
    sidebarOverlay.classList.add("is-open");
    sidebarToggle.setAttribute("aria-expanded", "true");
  }

  function closeSidebar() {
    sidebar.classList.remove("is-open");
    sidebarOverlay.classList.remove("is-open");
    sidebarToggle.setAttribute("aria-expanded", "false");
  }

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener("click", openSidebar);
    sidebarClose.addEventListener("click", closeSidebar);
    sidebarOverlay.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && sidebar.classList.contains("is-open")) {
        closeSidebar();
        sidebarToggle.focus();
      }
    });

    // Close drawer automatically if the viewport grows past the
    // breakpoint where the sidebar becomes permanently visible.
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 1200) {
        closeSidebar();
      }
    });
  }

  /* -----------------------------------------------------------
     5. DROPDOWNS (notifications + profile menu)
     Shared open/close logic: clicking the trigger toggles its
     panel and closes any other open dropdown; clicking outside
     or pressing Escape closes whatever is open.
  ----------------------------------------------------------- */
  var dropdowns = [
    { trigger: document.getElementById("notifButton"), panel: document.getElementById("notifPanel") },
    { trigger: document.getElementById("profileButton"), panel: document.getElementById("profilePanel") },
  ].filter(function (d) {
    return d.trigger && d.panel;
  });

  function closeAllDropdowns(except) {
    dropdowns.forEach(function (d) {
      if (d.panel !== except) {
        d.panel.classList.remove("is-open");
        d.trigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  dropdowns.forEach(function (d) {
    d.trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      var isOpen = d.panel.classList.contains("is-open");
      closeAllDropdowns();
      if (!isOpen) {
        d.panel.classList.add("is-open");
        d.trigger.setAttribute("aria-expanded", "true");
      } else {
        d.trigger.setAttribute("aria-expanded", "false");
      }
    });
  });

  document.addEventListener("click", function () {
    closeAllDropdowns();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeAllDropdowns();
    }
  });

  /* -----------------------------------------------------------
     6. DYNAMIC GREETING + DATE
     Reads the visitor's local clock so "Good Morning / Afternoon /
     Evening" always matches when they're actually looking at it.
  ----------------------------------------------------------- */
  var greetingEl = document.getElementById("greeting");
  var dateEl = document.getElementById("todayDate");
  var STUDENT_FIRST_NAME = "Alien";

  function timeOfDayGreeting(hour) {
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }

  if (greetingEl) {
    var now = new Date();
    var greetingText = timeOfDayGreeting(now.getHours());
    greetingEl.innerHTML =
      greetingText + ", " + STUDENT_FIRST_NAME + ' <span aria-hidden="true">👋</span>';
  }

  if (dateEl) {
    var today = new Date();
    dateEl.textContent = today.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  /* -----------------------------------------------------------
     7. TASK CHECKLIST
     Toggleable, persisted to localStorage so a refresh doesn't
     lose progress on "Today's Tasks".
  ----------------------------------------------------------- */
  var TASKS_KEY = "studentpal-tasks";
  var taskList = document.getElementById("taskList");
  var taskCount = document.getElementById("taskCount");

  function loadCompletedTasks() {
    try {
      var raw = localStorage.getItem(TASKS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveCompletedTasks(state) {
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(state));
    } catch (e) {
      /* ignore persistence failures (e.g. private browsing) */
    }
  }

  function updateTaskCount() {
    if (!taskList || !taskCount) return;
    var total = taskList.querySelectorAll(".task-checkbox").length;
    var done = taskList.querySelectorAll('.task-checkbox[aria-pressed="true"]').length;
    taskCount.textContent = done + "/" + total;
  }

  if (taskList) {
    var completed = loadCompletedTasks();

    taskList.querySelectorAll(".task-item").forEach(function (item) {
      var key = item.getAttribute("data-task");
      var checkbox = item.querySelector(".task-checkbox");
      if (!checkbox) return;

      if (completed[key]) {
        checkbox.setAttribute("aria-pressed", "true");
      }

      checkbox.addEventListener("click", function () {
        var isDone = checkbox.getAttribute("aria-pressed") === "true";
        checkbox.setAttribute("aria-pressed", String(!isDone));
        completed[key] = !isDone;
        saveCompletedTasks(completed);
        updateTaskCount();
      });
    });

    updateTaskCount();
  }

  /* -----------------------------------------------------------
     8. ACADEMIC PROGRESS RING
     Animates the SVG ring's stroke-dashoffset and counts the
     center number up to match — a single source of truth
     (TARGET_PERCENT) drives both.
  ----------------------------------------------------------- */
  var TARGET_PERCENT = 75;
  var progressBar = document.getElementById("progressBar");
  var progressNum = document.getElementById("progressNum");

  if (progressBar && progressNum) {
    var radius = 52;
    var circumference = 2 * Math.PI * radius;
    var offset = circumference - (TARGET_PERCENT / 100) * circumference;

    if (prefersReducedMotion) {
      progressBar.style.strokeDashoffset = offset;
      progressNum.textContent = TARGET_PERCENT + "%";
    } else {
      // Animate the ring via CSS transition (set on load, after a
      // frame so the browser registers the starting value first).
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          progressBar.style.strokeDashoffset = offset;
        });
      });

      // Count the number up in step with the ring's 1.2s transition.
      var duration = 1200;
      var startTime = null;

      function stepCount(timestamp) {
        if (startTime === null) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        var eased = progress * (2 - progress); // ease-out-quad
        var current = Math.round(eased * TARGET_PERCENT);
        progressNum.textContent = current + "%";
        if (progress < 1) {
          requestAnimationFrame(stepCount);
        } else {
          progressNum.textContent = TARGET_PERCENT + "%";
        }
      }

      requestAnimationFrame(stepCount);
    }
  }
})();

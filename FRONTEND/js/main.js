/* ===================================================================
   STUDENTPAL — MAIN.JS
   Shared across all 7 dashboard pages.
   1. Utilities
   2. Theme system
   3. Lucide icons
   4. Sidebar (mobile drawer)
   5. Clock + greeting (topbar)
   6. Dropdowns (notifications + avatar)
   7. Page detection + initializers
      - Resources
      - Announcements
      - Opportunities
      - Community
      - Assignments
      - Calendar
      - Settings
   =================================================================== */

(function () {
  "use strict";

  /* -----------------------------------------------------------
     1. UTILITIES
  ----------------------------------------------------------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

  /* -----------------------------------------------------------
     2. THEME SYSTEM
  ----------------------------------------------------------- */
  var THEME_KEY = "studentpal-theme";
  var root      = document.documentElement;
  var themeBtn  = document.getElementById("themeToggle");
  var sysMQ     = window.matchMedia("(prefers-color-scheme:dark)");

  function hasExplicitTheme() {
    try { return localStorage.getItem(THEME_KEY) !== null; } catch(e) { return false; }
  }

  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    if (themeBtn) {
      themeBtn.setAttribute("aria-label", t === "dark" ? "Switch to light theme" : "Switch to dark theme");
      themeBtn.setAttribute("aria-pressed", String(t === "dark"));
    }
  }

  function setTheme(t) {
    applyTheme(t);
    try { localStorage.setItem(THEME_KEY, t); } catch(e) {}
  }

  applyTheme(root.getAttribute("data-theme") || "light");

  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });
  }

  sysMQ.addEventListener
    ? sysMQ.addEventListener("change", function(e) { if (!hasExplicitTheme()) applyTheme(e.matches ? "dark" : "light"); })
    : sysMQ.addListener && sysMQ.addListener(function(e) { if (!hasExplicitTheme()) applyTheme(e.matches ? "dark" : "light"); });

  /* -----------------------------------------------------------
     3. LUCIDE ICONS
  ----------------------------------------------------------- */
  function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }
  renderIcons();

  /* -----------------------------------------------------------
     4. SIDEBAR (mobile drawer)
  ----------------------------------------------------------- */
  var sidebar        = document.getElementById("sidebar");
  var sidebarOverlay = document.getElementById("sidebarOverlay");
  var sidebarToggle  = document.getElementById("sidebarToggle");
  var sidebarClose   = document.getElementById("sidebarClose");

  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add("is-open");
    if (sidebarOverlay) sidebarOverlay.classList.add("is-open");
    if (sidebarToggle) sidebarToggle.setAttribute("aria-expanded", "true");
  }

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove("is-open");
    if (sidebarOverlay) sidebarOverlay.classList.remove("is-open");
    if (sidebarToggle) sidebarToggle.setAttribute("aria-expanded", "false");
  }

  if (sidebarToggle)  sidebarToggle.addEventListener("click", openSidebar);
  if (sidebarClose)   sidebarClose.addEventListener("click", closeSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") closeSidebar();
  });

  window.addEventListener("resize", function() {
    if (window.innerWidth >= 1200) closeSidebar();
  });

  /* -----------------------------------------------------------
     5. CLOCK + GREETING
  ----------------------------------------------------------- */
  var greetingEl  = document.getElementById("greeting");
  var datetimeEl  = document.getElementById("topbarDatetime");
  var USER_NAME   = (function() {
    try { return localStorage.getItem("studentpal-user-name") || "Alien"; } catch(e) { return "Alien"; }
  })();

  var DAYS   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  var MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

  function timeGreeting(h) {
    return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  }

  function pad2(n) { return n < 10 ? "0" + n : String(n); }

  function updateClock() {
    var now  = new Date();
    var h    = now.getHours();
    var m    = now.getMinutes();
    var s    = now.getSeconds();
    var ampm = h >= 12 ? "PM" : "AM";
    var h12  = h % 12 || 12;

    if (greetingEl) {
      greetingEl.innerHTML = timeGreeting(h) + ", " + USER_NAME + ' <span aria-hidden="true">👋</span>';
    }

    if (datetimeEl) {
      var day = DAYS[now.getDay()];
      var date = MONTHS[now.getMonth()] + " " + now.getDate() + ", " + now.getFullYear();
      datetimeEl.textContent = day + ", " + date + "  ·  " + pad2(h12) + ":" + pad2(m) + ":" + pad2(s) + " " + ampm;
    }
  }

  updateClock();
  setInterval(updateClock, 1000);

  /* -----------------------------------------------------------
     6. DROPDOWNS
  ----------------------------------------------------------- */
  var dropdownPairs = [
    { trigger: document.getElementById("notifBtn"),   panel: document.getElementById("notifPanel")   },
    { trigger: document.getElementById("avatarBtn"),  panel: document.getElementById("avatarPanel")  }
  ].filter(function(d) { return d.trigger && d.panel; });

  function closeAllDropdowns(except) {
    dropdownPairs.forEach(function(d) {
      if (d.panel !== except) {
        d.panel.classList.remove("is-open");
        d.trigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  dropdownPairs.forEach(function(d) {
    d.trigger.addEventListener("click", function(e) {
      e.stopPropagation();
      var opening = !d.panel.classList.contains("is-open");
      closeAllDropdowns();
      if (opening) {
        d.panel.classList.add("is-open");
        d.trigger.setAttribute("aria-expanded", "true");
      }
    });
  });

  document.addEventListener("click", closeAllDropdowns.bind(null, null));
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") closeAllDropdowns();
  });

  /* -----------------------------------------------------------
     7. PAGE DETECTION + INITIALIZERS
  ----------------------------------------------------------- */

  // --- RESOURCES ---
  if (document.getElementById("resourcesPage")) {
    var resourceSearch = document.getElementById("resourceSearch");
    var resourceCards  = $$(".resource-card[data-level][data-dept][data-type]");

    function filterResources() {
      var q     = resourceSearch ? resourceSearch.value.toLowerCase() : "";
      var level = ($("#filterLevel") || {}).value || "";
      var dept  = ($("#filterDept")  || {}).value || "";
      var type  = ($("#filterType")  || {}).value || "";

      resourceCards.forEach(function(card) {
        var title = (card.getAttribute("data-title") || "").toLowerCase();
        var code  = (card.getAttribute("data-course") || "").toLowerCase();
        var ok = (!q || title.includes(q) || code.includes(q)) &&
                 (!level || card.getAttribute("data-level") === level) &&
                 (!dept  || card.getAttribute("data-dept")  === dept) &&
                 (!type  || card.getAttribute("data-type")  === type);
        card.style.display = ok ? "" : "none";
      });
    }

    ["resourceSearch","filterLevel","filterDept","filterType"].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener(el.tagName === "SELECT" ? "change" : "input", filterResources);
    });
  }

  // --- OPPORTUNITIES ---
  if (document.getElementById("opportunitiesPage")) {
    var oppFilter = document.getElementById("oppFilter");
    if (oppFilter) {
      oppFilter.addEventListener("change", function() {
        var val = oppFilter.value;
        $$(".opp-card").forEach(function(card) {
          card.style.display = (!val || card.getAttribute("data-type") === val) ? "" : "none";
        });
      });
    }
  }

  // --- COMMUNITY ---
  if (document.getElementById("communityPage")) {
    // Like buttons
    document.addEventListener("click", function(e) {
      var btn = e.target.closest(".post-action[data-like]");
      if (!btn) return;
      var liked   = btn.classList.toggle("is-liked");
      var counter = btn.querySelector(".like-count");
      var base    = parseInt(btn.getAttribute("data-like"), 10) || 0;
      if (counter) counter.textContent = liked ? base + 1 : base;
    });

    // Compose post
    var composeBtn  = document.getElementById("composeBtn");
    var composeArea = document.getElementById("composeArea");
    var postFeed    = document.getElementById("postFeed");

    if (composeBtn && composeArea && postFeed) {
      composeBtn.addEventListener("click", function() {
        var text = composeArea.value.trim();
        if (!text) return;

        var article = document.createElement("article");
        article.className = "post-card";
        article.innerHTML = [
          '<div class="post-card__head">',
          '  <span class="post-card__avatar">AR</span>',
          '  <div>',
          '    <p class="post-card__name">Alienrocky</p>',
          '    <p class="post-card__dept">Computer Science · 200L</p>',
          '  </div>',
          '  <span class="post-card__time">Just now</span>',
          '</div>',
          '<p class="post-card__body">' + text.replace(/</g,"&lt;").replace(/>/g,"&gt;") + '</p>',
          '<div class="post-card__foot">',
          '  <button class="post-action" data-like="0">',
          '    <i data-lucide="heart" class="icon-xs"></i>',
          '    <span class="like-count">0</span> Likes',
          '  </button>',
          '  <button class="post-action">',
          '    <i data-lucide="message-circle" class="icon-xs"></i> Comment',
          '  </button>',
          '  <button class="post-action">',
          '    <i data-lucide="share-2" class="icon-xs"></i> Share',
          '  </button>',
          '</div>'
        ].join("");

        postFeed.insertBefore(article, postFeed.firstChild);
        composeArea.value = "";
        renderIcons();
      });
    }
  }

  // --- ASSIGNMENTS ---
  if (document.getElementById("assignmentsPage")) {
    document.addEventListener("click", function(e) {
      var btn = e.target.closest(".submit-btn[data-assign]");
      if (!btn) return;
      var id   = btn.getAttribute("data-assign");
      var card = document.querySelector('[data-assign-id="' + id + '"]');
      if (!card) return;

      btn.textContent   = "Submitted";
      btn.disabled      = true;
      btn.classList.remove("btn--primary");
      btn.classList.add("btn--outline");

      var badge = card.querySelector(".badge");
      if (badge) {
        badge.className    = "badge badge--green";
        badge.textContent  = "Submitted";
      }
      card.classList.remove("assignment-card--overdue");
    });

    var assignFilter = document.getElementById("assignFilter");
    if (assignFilter) {
      assignFilter.addEventListener("change", function() {
        var val = assignFilter.value;
        $$(".assignment-card").forEach(function(card) {
          var status = (card.getAttribute("data-status") || "").toLowerCase();
          card.style.display = (!val || status === val) ? "" : "none";
        });
      });
    }
  }

  // --- CALENDAR ---
  if (document.getElementById("calendarPage")) {
    var CAL_EVENTS = {
      "2026-07-03": [{ label:"CSC 201 CA Test",         color:"cyan"   }],
      "2026-07-05": [{ label:"MTH Assignment Due",       color:"amber"  }],
      "2026-07-08": [{ label:"Community Service Day",    color:"green"  }],
      "2026-07-10": [{ label:"Faculty Meeting",          color:"blue"   }],
      "2026-07-14": [{ label:"Exams Begin",              color:"red"    }],
      "2026-07-15": [{ label:"PHY 101 Exam",             color:"red"    }],
      "2026-07-16": [{ label:"CSC 201 Exam",             color:"red"    }],
      "2026-07-18": [{ label:"MTH 201 Exam",             color:"red"    }],
      "2026-07-20": [{ label:"Faculty Annual Dinner",    color:"purple" }],
      "2026-07-22": [{ label:"Results Release",          color:"blue"   }],
      "2026-07-28": [{ label:"Semester Break Begins",    color:"green"  }],
      "2026-07-30": [{ label:"Registration Deadline",    color:"red"    }],
      "2026-06-22": [{ label:"Today",                    color:"cyan"   }],
      "2026-06-30": [{ label:"Reg. Deadline",            color:"red"    }]
    };

    var calBody     = document.getElementById("calBody");
    var calMonthEl  = document.getElementById("calMonthLabel");
    var calPrev     = document.getElementById("calPrev");
    var calNext     = document.getElementById("calNext");
    var viewYear    = 2026;
    var viewMonth   = 6; // 0-based, so 6 = July

    var today = new Date();
    var todayStr = today.getFullYear() + "-" + pad2(today.getMonth() + 1) + "-" + pad2(today.getDate());

    function buildCalendar() {
      if (!calBody || !calMonthEl) return;

      var monthNames = ["January","February","March","April","May","June",
                        "July","August","September","October","November","December"];
      calMonthEl.textContent = monthNames[viewMonth] + " " + viewYear;

      var firstDay = new Date(viewYear, viewMonth, 1).getDay();
      var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      var daysInPrev  = new Date(viewYear, viewMonth, 0).getDate();

      calBody.innerHTML = "";
      var cellCount = 0;
      var row;

      function addCell(day, cls, monthOffset) {
        if (cellCount % 7 === 0) {
          row = document.createElement("tr");
          calBody.appendChild(row);
        }
        var actualMonth = viewMonth + (monthOffset || 0);
        var actualYear  = viewYear;
        if (actualMonth < 0)  { actualMonth = 11; actualYear--; }
        if (actualMonth > 11) { actualMonth =  0; actualYear++; }
        var dateStr = actualYear + "-" + pad2(actualMonth + 1) + "-" + pad2(day);

        var td = document.createElement("td");
        td.className = "cal-cell" + (cls ? " " + cls : "") +
                       (dateStr === todayStr ? " cal-cell--today" : "");
        td.setAttribute("data-date", dateStr);

        var dayDiv = document.createElement("div");
        dayDiv.className = "cal-cell__day";
        dayDiv.textContent = day;
        td.appendChild(dayDiv);

        if (CAL_EVENTS[dateStr]) {
          CAL_EVENTS[dateStr].forEach(function(ev) {
            var span = document.createElement("span");
            span.className = "cal-event cal-event--" + ev.color;
            span.textContent = ev.label;
            td.appendChild(span);
          });
        }

        row.appendChild(td);
        cellCount++;
      }

      for (var p = firstDay - 1; p >= 0; p--) {
        addCell(daysInPrev - p, "cal-cell--other", -1);
      }
      for (var d = 1; d <= daysInMonth; d++) {
        addCell(d, "");
      }
      while (cellCount % 7 !== 0) {
        addCell(cellCount % 7 === 0 ? 1 : (cellCount - firstDay - daysInMonth + 1) || 1, "cal-cell--other", 1);
      }
    }

    if (calPrev) calPrev.addEventListener("click", function() {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      buildCalendar();
    });

    if (calNext) calNext.addEventListener("click", function() {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      buildCalendar();
    });

    buildCalendar();
  }

  // --- SETTINGS ---
  if (document.getElementById("settingsPage")) {
    // Theme preference toggle mirrors the theme system
    var themeRadios = $$("input[name='theme']");
    themeRadios.forEach(function(radio) {
      radio.checked = radio.value === (root.getAttribute("data-theme") || "light");
      radio.addEventListener("change", function() {
        if (radio.checked) setTheme(radio.value);
      });
    });

    // Password change form
    var pwForm = document.getElementById("pwChangeForm");
    if (pwForm) {
      pwForm.addEventListener("submit", function(e) {
        e.preventDefault();
        var np  = document.getElementById("newPw");
        var cp  = document.getElementById("confirmPw");
        var msg = document.getElementById("pwMsg");
        if (!np || !cp || !msg) return;
        if (np.value.length < 8) {
          msg.textContent = "Password must be at least 8 characters.";
          msg.style.color = "var(--color-danger)";
        } else if (np.value !== cp.value) {
          msg.textContent = "Passwords do not match.";
          msg.style.color = "var(--color-danger)";
        } else {
          msg.textContent = "Password updated successfully.";
          msg.style.color = "var(--color-success)";
          np.value = ""; cp.value = "";
        }
        msg.style.display = "block";
      });
    }

    // Profile save
    var profileForm = document.getElementById("profileForm");
    if (profileForm) {
      profileForm.addEventListener("submit", function(e) {
        e.preventDefault();
        var msg = document.getElementById("profileMsg");
        if (msg) {
          msg.textContent = "Profile updated successfully.";
          msg.style.color = "var(--color-success)";
          msg.style.display = "block";
          setTimeout(function() { msg.style.display = "none"; }, 3000);
        }
      });
    }

    // Logout row
    var logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function() {
        window.location.href = "login.html";
      });
    }
  }

})();
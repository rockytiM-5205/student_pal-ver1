/* ===================================================================
   STUDENTPAL ADMIN — admin.js
   1.  Utilities
   2.  Theme system
   3.  Lucide icons
   4.  Sidebar drawer (mobile)
   5.  Dropdowns
   6.  Clock + greeting
   7.  Page navigation
   8.  KPI counter animations
   9.  Analytics charts (Chart.js)
   10. Student table — search + filter
   11. Opportunity tab filter
   12. Community report tab filter
   13. Admin calendar
   14. Modal handling
   15. Delete confirmation
   16. Toast notifications
   17. AI Manager task simulation
   18. Settings theme cards
   19. Live activity feed ticker
   =================================================================== */

(function () {
  "use strict";

  /* -----------------------------------------------------------
     1. UTILITIES
  ----------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

  function pad2(n) { return n < 10 ? "0" + n : String(n); }

  /* -----------------------------------------------------------
     2. THEME SYSTEM
  ----------------------------------------------------------- */
  var THEME_KEY = "studentpal-theme";
  var root = document.documentElement;

  function hasStoredTheme() {
    try { return localStorage.getItem(THEME_KEY) !== null; } catch(e) { return false; }
  }

  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    var btn = $("themeToggle");
    if (btn) {
      btn.setAttribute("aria-label", t === "dark" ? "Switch to light theme" : "Switch to dark theme");
      btn.setAttribute("aria-pressed", String(t === "dark"));
    }
    syncThemeCards(t);
  }

  // Exposed globally for settings page theme cards
  window.setTheme = function(t) {
    applyTheme(t);
    try { localStorage.setItem(THEME_KEY, t); } catch(e) {}
  };

  applyTheme(root.getAttribute("data-theme") || "light");

  var themeBtn = $("themeToggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var cur = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
      window.setTheme(cur === "dark" ? "light" : "dark");
    });
  }

  var sysMQ = window.matchMedia("(prefers-color-scheme:dark)");
  var sysMQHandler = function(e) {
    if (!hasStoredTheme()) applyTheme(e.matches ? "dark" : "light");
  };
  if (sysMQ.addEventListener) sysMQ.addEventListener("change", sysMQHandler);
  else if (sysMQ.addListener) sysMQ.addListener(sysMQHandler);

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
     4. SIDEBAR DRAWER (mobile)
  ----------------------------------------------------------- */
  var sidebar        = $("sidebar");
  var sidebarOverlay = $("sidebarOverlay");
  var sidebarToggle  = $("sidebarToggle");
  var sidebarClose   = $("sidebarClose");

  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add("is-open");
    sidebarOverlay && sidebarOverlay.classList.add("is-open");
    sidebarToggle && sidebarToggle.setAttribute("aria-expanded", "true");
  }

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove("is-open");
    sidebarOverlay && sidebarOverlay.classList.remove("is-open");
    sidebarToggle && sidebarToggle.setAttribute("aria-expanded", "false");
  }

  sidebarToggle  && sidebarToggle.addEventListener("click", openSidebar);
  sidebarClose   && sidebarClose.addEventListener("click", closeSidebar);
  sidebarOverlay && sidebarOverlay.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") { closeSidebar(); closeAllDropdowns(); }
  });

  window.addEventListener("resize", function() {
    if (window.innerWidth >= 1200) closeSidebar();
  });

  /* -----------------------------------------------------------
     5. DROPDOWNS (notifications + avatar)
  ----------------------------------------------------------- */
  var dropdownPairs = [
    { trigger: $("notifBtn"),  panel: $("notifPanel")  },
    { trigger: $("avatarBtn"), panel: $("avatarPanel") }
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

  document.addEventListener("click", function() { closeAllDropdowns(); });

  /* -----------------------------------------------------------
     6. CLOCK + GREETING
  ----------------------------------------------------------- */
  var greetingEl   = $("greeting");
  var datetimeEl   = $("topbarDatetime");
  var MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
  var DAYS   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  function timeGreeting(h) {
    return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  }

  function tick() {
    var now  = new Date();
    var h    = now.getHours();
    var m    = now.getMinutes();
    var s    = now.getSeconds();
    var ampm = h >= 12 ? "PM" : "AM";
    var h12  = h % 12 || 12;

    if (greetingEl) {
      greetingEl.innerHTML = timeGreeting(h) + ', Admin <span aria-hidden="true">👋</span>';
    }
    if (datetimeEl) {
      datetimeEl.textContent =
        DAYS[now.getDay()] + ", " +
        MONTHS[now.getMonth()] + " " + now.getDate() + ", " + now.getFullYear() +
        "  ·  " + pad2(h12) + ":" + pad2(m) + ":" + pad2(s) + " " + ampm;
    }
  }

  tick();
  setInterval(tick, 1000);

  /* -----------------------------------------------------------
     7. PAGE NAVIGATION
     Clicking a nav-link shows its corresponding admin-page section.
     Handles both the sidebar links and any [data-goto] buttons.
  ----------------------------------------------------------- */
  var navLinks  = $$(".nav-link[data-page]");
  var pages     = $$(".admin-page");
  var chartsInit = false;

  function showPage(pageId) {
    pages.forEach(function(p) { p.classList.remove("is-active"); });
    navLinks.forEach(function(l) { l.classList.remove("is-active"); });

    var page = document.getElementById("page-" + pageId);
    if (page) page.classList.add("is-active");

    var link = document.querySelector('.nav-link[data-page="' + pageId + '"]');
    if (link) link.classList.add("is-active");

    // Lazy-init charts when analytics page is first shown
    if (pageId === "analytics" && !chartsInit) {
      chartsInit = true;
      initCharts();
    }

    // Build calendar when page is first opened
    if (pageId === "calendar") buildCalendar();

    closeSidebar();
  }

  navLinks.forEach(function(link) {
    link.addEventListener("click", function(e) {
      e.preventDefault();
      showPage(link.getAttribute("data-page"));
    });
  });

  // [data-goto] buttons (e.g. "View All" links on dashboard)
  document.addEventListener("click", function(e) {
    var btn = e.target.closest("[data-goto]");
    if (btn) showPage(btn.getAttribute("data-goto"));

    // settings page theme-card links in avatar dropdown
    var pl = e.target.closest("[data-page-link]");
    if (pl) showPage(pl.getAttribute("data-page-link"));
  });

  /* -----------------------------------------------------------
     8. KPI COUNTER ANIMATIONS
     Counts [data-counter] elements from 0 to data-target,
     observed via IntersectionObserver (fires once on page load
     since dashboard is the default active page).
  ----------------------------------------------------------- */
  function easeOutQuad(t) { return t * (2 - t); }

  function animateCounter(el) {
    var target   = parseInt(el.getAttribute("data-target"), 10) || 0;
    var suffix   = el.getAttribute("data-suffix") || "";
    var duration = 1400;
    var startTime = null;

    if (prefersReducedMotion) { el.textContent = target.toLocaleString() + suffix; return; }

    function step(ts) {
      if (!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      var val      = Math.round(easeOutQuad(progress) * target);
      el.textContent = val >= 1000 ? (val / 1000).toFixed(val >= 10000 ? 1 : 2).replace(/\.?0+$/, "") + "k" : val;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target >= 1000 ? (target / 1000).toFixed(target >= 10000 ? 1 : 2).replace(/\.?0+$/, "") + "k" : target;
    }
    requestAnimationFrame(step);
  }

  // Run counters as soon as the script loads (dashboard is visible)
  $$("[data-counter]").forEach(function(el) {
    // Small delay so the page paint finishes first
    setTimeout(function() { animateCounter(el); }, 200);
  });

  /* -----------------------------------------------------------
     9. ANALYTICS CHARTS (Chart.js 4)
  ----------------------------------------------------------- */
  function getColor(name) {
    var style = getComputedStyle(document.documentElement);
    var map = {
      cyan:   "#06b6d4", blue:   "#2563eb",
      green:  "#16a34a", purple: "#7c3aed",
      amber:  "#d97706", red:    "#dc2626",
      text_f: "#94a3b8", border: "#e2e8f0"
    };
    if (root.getAttribute("data-theme") === "dark") {
      map.cyan   = "#22d3ee"; map.blue   = "#3b82f6";
      map.green  = "#4ade80"; map.purple = "#a78bfa";
      map.border = "rgba(148,163,184,0.12)";
    }
    return map[name] || "#94a3b8";
  }

  var chartInstances = {};

  function destroyChart(id) {
    if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
  }

  function baseOptions(color) {
    var isDark = root.getAttribute("data-theme") === "dark";
    return {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? "#161c28" : "#fff",
          borderColor: isDark ? "rgba(148,163,184,0.12)" : "#e2e8f0",
          borderWidth: 1,
          titleColor: isDark ? "#f1f5f9" : "#0f172a",
          bodyColor: isDark ? "#94a3b8" : "#475569",
          padding: 12,
          cornerRadius: 10
        }
      },
      scales: {
        x: {
          grid: { color: isDark ? "rgba(148,163,184,0.06)" : "rgba(0,0,0,0.04)" },
          ticks: { color: isDark ? "#64748b" : "#94a3b8", font: { family: "'JetBrains Mono'", size: 10 } }
        },
        y: {
          grid: { color: isDark ? "rgba(148,163,184,0.06)" : "rgba(0,0,0,0.04)" },
          ticks: { color: isDark ? "#64748b" : "#94a3b8", font: { family: "'JetBrains Mono'", size: 10 } }
        }
      }
    };
  }

  function makeLabels(n) {
    var labels = [], now = new Date();
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(now); d.setDate(d.getDate() - i);
      labels.push(MONTHS[d.getMonth()].slice(0, 3) + " " + d.getDate());
    }
    return labels;
  }

  function randData(n, min, max) {
    var arr = [];
    for (var i = 0; i < n; i++) arr.push(Math.floor(Math.random() * (max - min + 1)) + min);
    return arr;
  }

  function initCharts() {
    if (!window.Chart) return;

    var isDark = root.getAttribute("data-theme") === "dark";
    var labels30 = makeLabels(30);

    // DAU — Line chart with fill
    destroyChart("chartDAU");
    var ctxDAU = $("chartDAU");
    if (ctxDAU) {
      chartInstances.chartDAU = new Chart(ctxDAU, {
        type: "line",
        data: {
          labels: labels30,
          datasets: [{
            data: randData(30, 1800, 3200),
            borderColor: getColor("cyan"),
            backgroundColor: isDark ? "rgba(6,182,212,0.1)" : "rgba(6,182,212,0.08)",
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: getColor("cyan"),
            fill: true,
            tension: 0.4
          }]
        },
        options: baseOptions("cyan")
      });
    }

    // Downloads — Bar chart
    destroyChart("chartDownloads");
    var ctxDL = $("chartDownloads");
    if (ctxDL) {
      chartInstances.chartDownloads = new Chart(ctxDL, {
        type: "bar",
        data: {
          labels: labels30,
          datasets: [{
            data: randData(30, 800, 2400),
            backgroundColor: isDark ? "rgba(59,130,246,0.6)" : "rgba(37,99,235,0.55)",
            borderRadius: 5,
            borderSkipped: false
          }]
        },
        options: baseOptions("blue")
      });
    }

    // Applications — Doughnut chart
    destroyChart("chartApps");
    var ctxApps = $("chartApps");
    if (ctxApps) {
      var dOpts = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              color: isDark ? "#94a3b8" : "#475569",
              font: { family: "Inter", size: 11 },
              padding: 16, boxWidth: 12, borderRadius: 4
            }
          },
          tooltip: baseOptions("green").plugins.tooltip
        }
      };
      chartInstances.chartApps = new Chart(ctxApps, {
        type: "doughnut",
        data: {
          labels: ["Scholarships", "Internships", "Competitions", "Ambassador"],
          datasets: [{
            data: [480, 340, 260, 150],
            backgroundColor: [
              getColor("cyan"), getColor("blue"), getColor("green"), getColor("purple")
            ],
            borderWidth: 0,
            hoverOffset: 6
          }]
        },
        options: dOpts
      });
    }

    // Registrations — Line chart
    destroyChart("chartReg");
    var ctxReg = $("chartReg");
    if (ctxReg) {
      chartInstances.chartReg = new Chart(ctxReg, {
        type: "line",
        data: {
          labels: makeLabels(12).map(function(l) { return l.split(" ")[0]; }),
          datasets: [{
            data: randData(12, 18, 52),
            borderColor: getColor("purple"),
            backgroundColor: isDark ? "rgba(124,58,237,0.1)" : "rgba(124,58,237,0.08)",
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: getColor("purple"),
            pointBorderColor: isDark ? "#0d1420" : "#fff",
            pointBorderWidth: 2,
            fill: true,
            tension: 0.35
          }]
        },
        options: baseOptions("purple")
      });
    }
  }

  // Re-draw charts on theme change so colours update
  var origSetTheme = window.setTheme;
  window.setTheme = function(t) {
    origSetTheme(t);
    if (chartsInit) {
      Object.keys(chartInstances).forEach(function(k) { chartInstances[k].destroy(); delete chartInstances[k]; });
      chartsInit = false;
      // Re-init only if analytics page is currently visible
      if ($("page-analytics") && $("page-analytics").classList.contains("is-active")) {
        chartsInit = true;
        setTimeout(initCharts, 60);
      }
    }
  };

  /* -----------------------------------------------------------
     10. STUDENT TABLE — search + filter
  ----------------------------------------------------------- */
  var studentSearch      = $("studentSearch");
  var studentDeptFilter  = $("studentDeptFilter");
  var studentLevelFilter = $("studentLevelFilter");
  var statusFilter       = $("studentStatusFilter");
  var studentTbody       = $("studentTbody");

  function filterStudents() {
    if (!studentTbody) return;
    var q      = studentSearch      ? studentSearch.value.toLowerCase()      : "";
    var dept   = studentDeptFilter  ? studentDeptFilter.value.toLowerCase()  : "";
    var level  = studentLevelFilter ? studentLevelFilter.value               : "";
    var status = statusFilter       ? statusFilter.value.toLowerCase()       : "";

    $$("tr", studentTbody).forEach(function(row) {
      var text   = row.textContent.toLowerCase();
      var rdept  = (row.getAttribute("data-dept")  || "").toLowerCase();
      var rlevel = (row.getAttribute("data-level") || "");
      var rstatus= (row.getAttribute("data-status")|| "").toLowerCase();

      var match = (!q      || text.includes(q))    &&
                  (!dept   || rdept.includes(dept)) &&
                  (!level  || rlevel === level)     &&
                  (!status || rstatus === status);

      row.style.display = match ? "" : "none";
    });
  }

  [studentSearch, studentDeptFilter, studentLevelFilter, statusFilter].forEach(function(el) {
    if (el) el.addEventListener(el.tagName === "SELECT" ? "change" : "input", filterStudents);
  });

  // Select all checkbox
  var selectAll = $("selectAll");
  if (selectAll && studentTbody) {
    selectAll.addEventListener("change", function() {
      $$('input[type="checkbox"]', studentTbody).forEach(function(cb) {
        cb.checked = selectAll.checked;
      });
    });
  }

  /* -----------------------------------------------------------
     11. OPPORTUNITY TAB FILTER
  ----------------------------------------------------------- */
  var oppTabs = $("oppTabs");
  if (oppTabs) {
    oppTabs.addEventListener("click", function(e) {
      var pill = e.target.closest(".tab-pill[data-opp-filter]");
      if (!pill) return;
      $$(".tab-pill", oppTabs).forEach(function(p) { p.classList.remove("is-active"); });
      pill.classList.add("is-active");
      var filter = pill.getAttribute("data-opp-filter");
      $$(".opp-mgmt-card").forEach(function(card) {
        card.style.display = (filter === "all" || card.getAttribute("data-opp-type") === filter) ? "" : "none";
      });
    });
  }

  /* -----------------------------------------------------------
     12. COMMUNITY REPORT TAB FILTER
  ----------------------------------------------------------- */
  var commTabs = $("communityTabs");
  if (commTabs) {
    commTabs.addEventListener("click", function(e) {
      var pill = e.target.closest(".tab-pill[data-com-filter]");
      if (!pill) return;
      $$(".tab-pill", commTabs).forEach(function(p) { p.classList.remove("is-active"); });
      pill.classList.add("is-active");
      var filter = pill.getAttribute("data-com-filter");
      $$(".report-card").forEach(function(card) {
        card.style.display = (filter === "all" || card.getAttribute("data-com-type") === filter) ? "" : "none";
      });
    });
  }

  /* -----------------------------------------------------------
     13. ADMIN CALENDAR
  ----------------------------------------------------------- */
  var CAL_EVENTS = {
    "2026-06-30": [{ label: "Reg. Deadline", color: "#dc2626" }],
    "2026-07-03": [{ label: "CSC 201 CA Test", color: "#06b6d4" }],
    "2026-07-05": [{ label: "MTH Assignment", color: "#d97706" }],
    "2026-07-08": [{ label: "Community Service", color: "#16a34a" }],
    "2026-07-10": [{ label: "Faculty Meeting", color: "#2563eb" }],
    "2026-07-14": [{ label: "Exams Begin", color: "#dc2626" }],
    "2026-07-15": [{ label: "PHY 101 Exam", color: "#dc2626" }],
    "2026-07-16": [{ label: "CSC 201 Exam", color: "#dc2626" }],
    "2026-07-18": [{ label: "MTH 201 Exam", color: "#dc2626" }],
    "2026-07-20": [{ label: "Faculty Dinner", color: "#7c3aed" }],
    "2026-07-22": [{ label: "Results Release", color: "#2563eb" }],
    "2026-07-28": [{ label: "Semester Break", color: "#16a34a" }],
    "2026-07-30": [{ label: "Late Reg. Deadline", color: "#dc2626" }]
  };

  var calView  = { year: 2026, month: 6 }; // 0-based, 6 = July
  var today    = new Date();
  var todayStr = today.getFullYear() + "-" + pad2(today.getMonth() + 1) + "-" + pad2(today.getDate());

  function buildCalendar() {
    var calBody  = $("adminCalBody");
    var calLabel = $("calLabel");
    if (!calBody || !calLabel) return;

    var monthNames = ["January","February","March","April","May","June",
                      "July","August","September","October","November","December"];
    calLabel.textContent = monthNames[calView.month] + " " + calView.year;

    var firstDay    = new Date(calView.year, calView.month, 1).getDay();
    var daysInMonth = new Date(calView.year, calView.month + 1, 0).getDate();
    var daysInPrev  = new Date(calView.year, calView.month, 0).getDate();

    calBody.innerHTML = "";
    var cellCount = 0, row;

    function makeCell(day, cls, mOffset) {
      if (cellCount % 7 === 0) { row = document.createElement("tr"); calBody.appendChild(row); }
      var aMonth = calView.month + (mOffset || 0);
      var aYear  = calView.year;
      if (aMonth < 0)  { aMonth = 11; aYear--; }
      if (aMonth > 11) { aMonth = 0;  aYear++; }
      var dateStr = aYear + "-" + pad2(aMonth + 1) + "-" + pad2(day);
      var isToday = dateStr === todayStr;

      var td = document.createElement("td");
      td.style.cssText = "border:1px solid var(--border);vertical-align:top;padding:6px;height:88px;cursor:pointer;transition:background .2s;font-size:.8rem;" + (mOffset ? "opacity:.35;" : "") + (isToday ? "background:var(--cyan-soft);" : "");
      td.onmouseenter = function() { if (!isToday) this.style.background = "var(--surface-2)"; };
      td.onmouseleave = function() { this.style.background = isToday ? "var(--cyan-soft)" : ""; };

      var dayDiv = document.createElement("div");
      dayDiv.style.cssText = "font-family:var(--mono);font-size:.7rem;font-weight:600;margin-bottom:4px;" + (isToday ? "background:var(--cyan);color:#fff;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.62rem;" : "color:var(--text-m);");
      dayDiv.textContent = day;
      td.appendChild(dayDiv);

      if (CAL_EVENTS[dateStr] && !mOffset) {
        CAL_EVENTS[dateStr].forEach(function(ev) {
          var span = document.createElement("span");
          span.style.cssText = "display:block;border-radius:3px;padding:2px 5px;font-size:.58rem;font-weight:600;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:" + ev.color + "22;color:" + ev.color;
          span.textContent = ev.label;
          td.appendChild(span);
        });
      }

      row.appendChild(td);
      cellCount++;
    }

    for (var p = firstDay - 1; p >= 0; p--)  makeCell(daysInPrev - p, "", -1);
    for (var d = 1; d <= daysInMonth; d++)    makeCell(d, "");
    while (cellCount % 7 !== 0) makeCell(cellCount - firstDay - daysInMonth + 1, "", 1);

    renderIcons();
  }

  var calPrev = $("calPrev"), calNext = $("calNext");
  if (calPrev) calPrev.addEventListener("click", function() {
    calView.month--;
    if (calView.month < 0)  { calView.month = 11; calView.year--; }
    buildCalendar();
  });
  if (calNext) calNext.addEventListener("click", function() {
    calView.month++;
    if (calView.month > 11) { calView.month = 0; calView.year++; }
    buildCalendar();
  });

  /* -----------------------------------------------------------
     14. MODAL HANDLING
  ----------------------------------------------------------- */
  window.openModal = function(id) {
    var modal = $(id);
    if (modal) {
      modal.classList.add("is-open");
      // Focus first input inside the modal for accessibility
      var firstInput = modal.querySelector("input, select, textarea");
      if (firstInput) setTimeout(function() { firstInput.focus(); }, 60);
    }
  };

  window.closeModal = function(id) {
    var modal = $(id);
    if (modal) modal.classList.remove("is-open");
  };

  // Close on overlay click
  $$(".modal-overlay").forEach(function(overlay) {
    overlay.addEventListener("click", function(e) {
      if (e.target === overlay) overlay.classList.remove("is-open");
    });
  });

  /* -----------------------------------------------------------
     15. DELETE CONFIRMATION
     confirmDelete(triggerEl, itemType) shows the modal and
     wires the confirm button to remove the parent table row
     or card once confirmed.
  ----------------------------------------------------------- */
  var pendingDeleteTarget = null;

  window.confirmDelete = function(el, type) {
    pendingDeleteTarget = el.closest("tr, .opp-mgmt-card, .report-card");
    var titleEl = $("deleteModalTitle");
    if (titleEl) {
      var labels = { resource:"Resource", student:"Student Account", announcement:"Announcement", opportunity:"Opportunity", assignment:"Assignment", post:"Community Post" };
      titleEl.textContent = "Delete " + (labels[type] || "Item");
    }
    openModal("deleteModal");

    var confirmBtn = $("deleteConfirmBtn");
    if (confirmBtn) {
      confirmBtn.onclick = function() {
        closeModal("deleteModal");
        if (pendingDeleteTarget) {
          pendingDeleteTarget.style.transition = "opacity .3s ease, transform .3s ease";
          pendingDeleteTarget.style.opacity    = "0";
          pendingDeleteTarget.style.transform  = "scale(.96)";
          setTimeout(function() {
            if (pendingDeleteTarget && pendingDeleteTarget.parentNode) {
              pendingDeleteTarget.parentNode.removeChild(pendingDeleteTarget);
            }
            pendingDeleteTarget = null;
          }, 300);
        }
        showToast("Item deleted successfully.", "success");
      };
    }
  };

  /* -----------------------------------------------------------
     16. TOAST NOTIFICATIONS
  ----------------------------------------------------------- */
  var toastRegion = $("toastRegion");

  window.showToast = function(message, type) {
    if (!toastRegion) return;
    type = type || "success";

    var icons = { success: "check", error: "x", info: "info" };
    var toast = document.createElement("div");
    toast.className = "toast toast--" + type;
    toast.innerHTML =
      '<span class="toast__icon"><i data-lucide="' + (icons[type] || "check") + '" class="icon-xs"></i></span>' +
      '<p class="toast__text">' + message + '</p>';

    toastRegion.appendChild(toast);
    renderIcons();

    requestAnimationFrame(function() {
      requestAnimationFrame(function() { toast.classList.add("is-visible"); });
    });

    setTimeout(function() {
      toast.classList.remove("is-visible");
      setTimeout(function() { toast.parentNode && toast.parentNode.removeChild(toast); }, 320);
    }, 4000);
  };

  /* -----------------------------------------------------------
     17. AI MANAGER TASK SIMULATION
  ----------------------------------------------------------- */
  var aiLog = $("aiLog");

  function appendLog(msg) {
    if (!aiLog) return;
    var now = new Date();
    var ts  = now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate()) +
              " " + pad2(now.getHours()) + ":" + pad2(now.getMinutes()) + ":" + pad2(now.getSeconds());
    var p = document.createElement("p");
    p.textContent = "[" + ts + "] " + msg;
    aiLog.insertBefore(p, aiLog.firstChild);
  }

  window.runAiTask = function(task) {
    var btn = task === "reindex" ? $("reindexBtn") : task === "embed" ? $("embedBtn") : null;
    if (btn) { btn.disabled = true; btn.style.opacity = "0.7"; }

    var messages = {
      reindex: [
        "Re-index triggered by SP-ADMIN-001.",
        "Scanning resource store… found 1,480 documents.",
        "Building search index… (chunk 1/4)",
        "Building search index… (chunk 2/4)",
        "Building search index… (chunk 3/4)",
        "Building search index… (chunk 4/4)",
        "Re-index complete. Search index updated successfully."
      ],
      embed: [
        "Embedding generation triggered by SP-ADMIN-001.",
        "Loading 1,480 documents into pipeline…",
        "Generating vector embeddings… 0%",
        "Generating vector embeddings… 45%",
        "Generating vector embeddings… 82%",
        "Generating vector embeddings… 100%",
        "Embedding generation complete. 1,480 vectors stored."
      ],
      test: [
        "Search pipeline test initiated.",
        "Query: 'CSC 201 Data Structures' → 8 results in 36ms.",
        "Query: 'MTH 201 Linear Algebra' → 5 results in 28ms.",
        "Query: 'Scholarship opportunities 2026' → 12 results in 41ms.",
        "Search pipeline test passed. All queries within threshold."
      ],
      clear: [
        "Cache clear initiated by SP-ADMIN-001.",
        "Removing stale index cache…",
        "Cache cleared. 14.2MB freed."
      ]
    };

    var steps = messages[task] || ["Task running…", "Task complete."];
    var i = 0;

    showToast("AI task started: " + task.replace(/([A-Z])/g, " $1").trim(), "info");

    function nextStep() {
      if (i < steps.length) {
        appendLog(steps[i]);
        i++;
        setTimeout(nextStep, 600);
      } else {
        if (btn) { btn.disabled = false; btn.style.opacity = ""; }
        showToast("AI task completed successfully.", "success");
      }
    }

    setTimeout(nextStep, 300);
  };

  /* -----------------------------------------------------------
     18. SETTINGS THEME CARDS (sync highlight with active theme)
  ----------------------------------------------------------- */
  function syncThemeCards(t) {
    var light = $("themeLightCard");
    var dark  = $("themeDarkCard");
    if (light) light.style.borderColor = t === "light" ? "var(--cyan)" : "";
    if (dark)  dark.style.borderColor  = t === "dark"  ? "var(--cyan)" : "";
    if (light) light.style.background  = t === "light" ? "var(--cyan-soft)" : "";
    if (dark)  dark.style.background   = t === "dark"  ? "var(--cyan-soft)" : "";
  }

  // Initial sync once DOM settles
  setTimeout(function() { syncThemeCards(root.getAttribute("data-theme") || "light"); }, 50);

  /* -----------------------------------------------------------
     19. LIVE ACTIVITY FEED TICKER
     Every 25 seconds a new realistic event is prepended to
     the activity list, simulating real-time admin awareness.
  ----------------------------------------------------------- */
  var ACTIVITY_POOL = [
    { icon: "user-plus",   bg: "var(--green-soft)",  color: "var(--green)",  text: "<strong>Amina Bello</strong> registered as a new student" },
    { icon: "upload",      bg: "var(--cyan-soft)",   color: "var(--cyan)",   text: "<strong>PHY 101 Handout</strong> uploaded by Dr. Rasheed" },
    { icon: "flag",        bg: "var(--red-soft)",    color: "var(--red)",    text: "<strong>Community post</strong> flagged for spam review" },
    { icon: "briefcase",   bg: "var(--amber-soft)",  color: "var(--amber)",  text: "<strong>GitHub Campus Expert Program</strong> posted" },
    { icon: "megaphone",   bg: "var(--blue-soft)",   color: "var(--blue)",   text: "<strong>Faculty announcement</strong> published successfully" },
    { icon: "user-plus",   bg: "var(--green-soft)",  color: "var(--green)",  text: "<strong>Chidi Nwosu</strong> registered as a new student" },
    { icon: "download",    bg: "var(--purple-soft)", color: "var(--purple)", text: "<strong>CLRS E-book</strong> downloaded 503 times today" },
    { icon: "check-circle",bg: "var(--green-soft)",  color: "var(--green)",  text: "<strong>Reported post</strong> reviewed and dismissed" }
  ];

  var activityList = $("activityList");
  var poolIndex    = 0;

  function injectActivity() {
    if (!activityList) return;
    var ev = ACTIVITY_POOL[poolIndex % ACTIVITY_POOL.length];
    poolIndex++;

    var item = document.createElement("div");
    item.className = "activity-item";
    item.style.opacity = "0";
    item.style.transform = "translateY(-8px)";
    item.innerHTML =
      '<span class="activity-icon" style="background:' + ev.bg + ';color:' + ev.color + '">' +
      '<i data-lucide="' + ev.icon + '" class="icon-xs"></i></span>' +
      '<div class="activity-body"><p>' + ev.text + '</p><p class="activity-time">Just now</p></div>';

    activityList.insertBefore(item, activityList.firstChild);
    renderIcons();

    // Fade in
    requestAnimationFrame(function() {
      item.style.transition = "opacity .4s ease, transform .4s ease";
      item.style.opacity = "1";
      item.style.transform = "translateY(0)";
    });

    // Remove oldest item if list gets too long
    var items = $$(".activity-item", activityList);
    if (items.length > 8) {
      var last = items[items.length - 1];
      last.style.transition = "opacity .3s ease";
      last.style.opacity = "0";
      setTimeout(function() { last.parentNode && last.parentNode.removeChild(last); }, 320);
    }
  }

  if (!prefersReducedMotion) {
    setInterval(injectActivity, 25000);
  }

})();
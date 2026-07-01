/* ===================================================================
   STUDENTPAL — SCRIPT
   Vanilla JS only. Organized by feature:
   1. Utilities
   2. Theme system (toggle, localStorage, system-preference sync)
   3. Lucide icon rendering
   4. Mobile navigation
   5. Sticky navbar scroll state
   6. Scroll-reveal animations (IntersectionObserver)
   7. Animated stat counters
   8. Feature card cursor-glow hover
   9. Back-to-top button
   10. Footer year
   =================================================================== */

(function () {
  "use strict";

  /* -----------------------------------------------------------
     1. UTILITIES
  ----------------------------------------------------------- */
  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var THEME_KEY = "studentpal-theme";
  var root = document.documentElement;

  /* -----------------------------------------------------------
     2. THEME SYSTEM
     The <head> already set data-theme synchronously (see the
     blocking script in index.html) to avoid a flash of the wrong
     theme. This module just wires up the toggle button and keeps
     things in sync afterwards.

     Behavior:
     - If the person has never chosen a theme, we follow the OS
       setting live (a system theme change updates the site
       immediately, no reload needed).
     - The moment they click the toggle, their choice becomes
       explicit and is saved to localStorage — from then on we
       stop following the OS and respect their pick on every visit.
  ----------------------------------------------------------- */
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
      /* localStorage unavailable (e.g. private browsing) — theme
         still applies for this session, it just won't persist. */
    }
  }

  // Sync the toggle's labels with whatever the blocking head script
  // already applied, without re-triggering a theme change.
  applyTheme(root.getAttribute("data-theme") || "light");

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
      setExplicitTheme(current === "dark" ? "light" : "dark");
    });
  }

  // Live-follow the OS theme only until the person makes an explicit choice.
  function handleSystemSchemeChange(e) {
    if (!hasStoredPreference()) {
      applyTheme(e.matches ? "dark" : "light");
    }
  }

  if (typeof systemSchemeQuery.addEventListener === "function") {
    systemSchemeQuery.addEventListener("change", handleSystemSchemeChange);
  } else if (typeof systemSchemeQuery.addListener === "function") {
    // Safari < 14 fallback
    systemSchemeQuery.addListener(handleSystemSchemeChange);
  }

  /* -----------------------------------------------------------
     3. LUCIDE ICON RENDERING
     Replaces every [data-lucide] placeholder with its SVG. Must
     run after the Lucide CDN script (loaded just before this file)
     has executed, which it has, since this script is at the very
     bottom of <body>.
  ----------------------------------------------------------- */
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }

  /* -----------------------------------------------------------
     4. MOBILE NAVIGATION
     Toggles the slide-in drawer and keeps aria-expanded in sync.
  ----------------------------------------------------------- */
  var navToggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");

  function closeMobileNav() {
    navLinks.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  }

  function toggleMobileNav() {
    var isOpen = navLinks.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", toggleMobileNav);

    // Close the drawer whenever a nav link is tapped (mobile UX nicety)
    navLinks.querySelectorAll(".nav-links__item").forEach(function (link) {
      link.addEventListener("click", closeMobileNav);
    });

    // Close on Escape for keyboard users
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navLinks.classList.contains("is-open")) {
        closeMobileNav();
        navToggle.focus();
      }
    });
  }

  /* -----------------------------------------------------------
     5. STICKY NAVBAR SCROLL STATE
     Adds a border/shadow once the page has scrolled past the top,
     so the nav reads clearly over any section underneath it.
  ----------------------------------------------------------- */
  var navbar = document.getElementById("navbar");

  function updateNavbarState() {
    if (window.scrollY > 8) {
      navbar.classList.add("is-scrolled");
    } else {
      navbar.classList.remove("is-scrolled");
    }
  }

  if (navbar) {
    updateNavbarState();
    window.addEventListener("scroll", updateNavbarState, { passive: true });
  }

  /* -----------------------------------------------------------
     6. SCROLL-REVEAL ANIMATIONS
     Elements marked [data-reveal] fade + rise into place the
     first time they enter the viewport. data-reveal-delay sets
     a stagger (consumed via the --reveal-delay CSS variable).
  ----------------------------------------------------------- */
  var revealEls = document.querySelectorAll("[data-reveal]");

  revealEls.forEach(function (el) {
    var delay = el.getAttribute("data-reveal-delay");
    if (delay) {
      el.style.setProperty("--reveal-delay", delay);
    }
  });

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    // No motion preference (or no support): just show everything.
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    revealEls.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  /* -----------------------------------------------------------
     7. ANIMATED STAT COUNTERS
     Counts each [data-counter] up from 0 to its data-target the
     first time the stats section scrolls into view, using an
     eased requestAnimationFrame loop (no dependencies).
  ----------------------------------------------------------- */
  var counterEls = document.querySelectorAll("[data-counter]");

  function easeOutQuad(t) {
    return t * (2 - t);
  }

  function animateCounter(el) {
    var target = parseInt(el.getAttribute("data-target"), 10) || 0;
    var suffix = el.getAttribute("data-suffix") || "";

    if (prefersReducedMotion) {
      el.textContent = target + suffix;
      return;
    }

    var duration = 1400; // ms
    var startTime = null;

    function step(timestamp) {
      if (startTime === null) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = easeOutQuad(progress);
      var current = Math.round(eased * target);
      el.textContent = current + suffix;

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = target + suffix; // lock exact final value
      }
    }

    window.requestAnimationFrame(step);
  }

  if (counterEls.length) {
    if (!("IntersectionObserver" in window)) {
      counterEls.forEach(animateCounter);
    } else {
      var counterObserver = new IntersectionObserver(
        function (entries, observer) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              animateCounter(entry.target);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 }
      );

      counterEls.forEach(function (el) {
        counterObserver.observe(el);
      });
    }
  }

  /* -----------------------------------------------------------
     8. FEATURE CARD CURSOR-GLOW HOVER
     Tracks the pointer position over each feature card and
     feeds it into CSS custom properties (--mx / --my) so the
     soft radial glow in .feature-card::before follows the cursor.
  ----------------------------------------------------------- */
  if (!prefersReducedMotion) {
    document.querySelectorAll(".feature-card").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var rect = card.getBoundingClientRect();
        var x = ((e.clientX - rect.left) / rect.width) * 100;
        var y = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty("--mx", x + "%");
        card.style.setProperty("--my", y + "%");
      });
    });
  }

  /* -----------------------------------------------------------
     9. BACK-TO-TOP BUTTON
     Appears after scrolling past most of a viewport height;
     clicking it returns smoothly to the top of the page.
  ----------------------------------------------------------- */
  var backToTop = document.getElementById("backToTop");

  function updateBackToTop() {
    if (window.scrollY > window.innerHeight * 0.8) {
      backToTop.classList.add("is-visible");
    } else {
      backToTop.classList.remove("is-visible");
    }
  }

  if (backToTop) {
    updateBackToTop();
    window.addEventListener("scroll", updateBackToTop, { passive: true });

    backToTop.addEventListener("click", function () {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    });
  }

  /* -----------------------------------------------------------
     10. FOOTER YEAR
     Keeps the copyright year accurate without manual edits.
  ----------------------------------------------------------- */
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
})();
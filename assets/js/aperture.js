/* ============================================================
   LION CREATIVES — APERTURE
   Review prototype behaviour. Progressive enhancement only:
   every page is fully readable and operable with JS disabled.
   ============================================================ */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- 1. LOADER — bound to real readiness, never a fake timer ---------- */
  function loader() {
    var el = document.querySelector('.loader');
    if (!el) return;
    if (reduced) { el.setAttribute('data-done', 'true'); document.body.classList.add('ready'); return; }

    var bar = el.querySelector('.prog i');
    var settled = false;

    function finish() {
      if (settled) return;
      settled = true;
      if (bar) bar.style.width = '100%';
      // brief hold so the assembled mark registers, then cut through
      setTimeout(function () {
        el.setAttribute('data-done', 'true');
        document.body.classList.add('ready');
      }, 260);
    }

    requestAnimationFrame(function () { el.classList.add('lit'); });

    // Track genuine asset readiness rather than inventing progress.
    var assets = Array.prototype.slice.call(document.images);
    var total = assets.length + 1; // +1 for document load
    var done = 0;
    function tick() {
      done++;
      if (bar) bar.style.width = Math.min(96, (done / total) * 100) + '%';
    }
    assets.forEach(function (img) {
      if (img.complete) { tick(); return; }
      img.addEventListener('load', tick, { once: true });
      img.addEventListener('error', tick, { once: true });
    });

    if (document.readyState === 'complete') { tick(); finish(); }
    else window.addEventListener('load', function () { tick(); finish(); }, { once: true });

    // Overrun guard: never hold the visitor hostage to a slow asset.
    setTimeout(finish, 2600);
  }

  /* ---------- 2. NAV — wordmark retracts to the mark ---------- */
  function nav() {
    var bar = document.querySelector('.nav');
    if (!bar) return;
    var last = -1;
    function onScroll() {
      var y = window.scrollY > 40;
      if (y !== last) { bar.classList.toggle('scrolled', y); last = y; }
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- 3. MOBILE MENU — a full-field aperture ---------- */
  function menu() {
    var m = document.querySelector('.menu');
    var open = document.querySelector('.nav-toggle');
    var close = document.querySelector('.menu-close');
    if (!m || !open) return;
    var lastFocus = null;

    function setOpen(state) {
      m.setAttribute('data-open', String(state));
      open.setAttribute('aria-expanded', String(state));
      document.body.style.overflow = state ? 'hidden' : '';
      if (state) { lastFocus = document.activeElement; var f = m.querySelector('a,button'); if (f) f.focus(); }
      else if (lastFocus) lastFocus.focus();
    }
    open.addEventListener('click', function () { setOpen(m.getAttribute('data-open') !== 'true'); });
    if (close) close.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && m.getAttribute('data-open') === 'true') setOpen(false);
    });
    // focus trap
    m.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || m.getAttribute('data-open') !== 'true') return;
      var f = m.querySelectorAll('a[href],button:not([disabled])');
      if (!f.length) return;
      var first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---------- 4. SCROLL REVEALS — clip, never fade ---------- */
  function reveals() {
    var items = document.querySelectorAll('.rv, .ap-plane, .reveal-type');
    if (!items.length) return;
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (n) { n.classList.add('revealed'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('revealed'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px 8% 0px', threshold: 0.05 });

    // Anything already on screen at load must reveal immediately. Without this,
    // the negative rootMargin can leave above-the-fold content permanently clipped
    // because it never crosses the threshold and the visitor never scrolls it into range.
    var vh = window.innerHeight || document.documentElement.clientHeight;
    items.forEach(function (n) {
      var r = n.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) { n.classList.add('revealed'); }
      else { io.observe(n); }
    });
  }

  /* ---------- 5. CURSOR APERTURE — desktop only, never load-bearing ---------- */
  function cursor() {
    if (reduced || !finePointer) return;
    var c = document.createElement('div');
    c.className = 'cursor';
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    var x = 0, y = 0, cx = 0, cy = 0, raf = null;
    function loop() {
      cx += (x - cx) * 0.22; cy += (y - cy) * 0.22;
      c.style.transform = 'translate(' + cx + 'px,' + cy + 'px) translate(-50%,-50%) rotate(45deg)';
      raf = requestAnimationFrame(loop);
    }
    document.addEventListener('pointermove', function (e) {
      x = e.clientX; y = e.clientY;
      if (!raf) loop();
    }, { passive: true });
    document.querySelectorAll('[data-cursor]').forEach(function (n) {
      n.addEventListener('pointerenter', function () { c.setAttribute('data-state', n.getAttribute('data-cursor')); });
      n.addEventListener('pointerleave', function () { c.removeAttribute('data-state'); });
    });
  }

  /* ---------- 6. SERVICE PILLARS — disclosure, not cards ---------- */
  function pillars() {
    document.querySelectorAll('.pillar-head').forEach(function (head) {
      var pill = head.closest('.pillar');
      head.setAttribute('role', 'button');
      head.setAttribute('tabindex', '0');
      var body = pill.querySelector('.pillar-body');
      var id = body && body.id;
      head.setAttribute('aria-expanded', pill.getAttribute('data-open') === 'true' ? 'true' : 'false');
      if (id) head.setAttribute('aria-controls', id);
      function toggle() {
        var open = pill.getAttribute('data-open') === 'true';
        pill.setAttribute('data-open', String(!open));
        head.setAttribute('aria-expanded', String(!open));
      }
      head.addEventListener('click', toggle);
      head.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  }

  /* ---------- 7. HERO C — DUALITY. Canvas is decorative and optional. ---------- */
  function heroDuality() {
    var cv = document.getElementById('duality');
    if (!cv || reduced) return;
    var ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return; // graceful: the CSS layers alone still read

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, t = 0, raf = null, mx = 0.5, my = 0.5;

    function size() {
      var r = cv.getBoundingClientRect();
      w = r.width; h = r.height;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    window.addEventListener('resize', size);

    // engineered layer: a lattice on the mark's angle family, reacting to pointer
    function draw() {
      t += 0.0045;
      ctx.clearRect(0, 0, w, h);
      var step = Math.max(38, w / 22);
      ctx.lineWidth = 1;
      for (var i = -1; i < w / step + 2; i++) {
        for (var j = -1; j < h / step + 2; j++) {
          var px = i * step, py = j * step;
          var dx = (px / w) - mx, dy = (py / h) - my;
          var d = Math.sqrt(dx * dx + dy * dy);
          var pulse = Math.sin(t * 2.1 - d * 5.4);
          var a = Math.max(0, 0.30 - d * 0.34) * (0.55 + pulse * 0.45);
          if (a <= 0.004) continue;
          var len = step * (0.30 + pulse * 0.16);
          ctx.strokeStyle = 'rgba(218,31,38,' + a.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + len * 0.94, py - len * 0.34); // ≈ the mark's shallow angle
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    }
    function start() { if (!raf) raf = requestAnimationFrame(draw); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    cv.closest('.hero').addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width;
      my = (e.clientY - r.top) / r.height;
    }, { passive: true });

    // never burn frames off-screen or on a hidden tab
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        en[0].isIntersecting ? start() : stop();
      }, { threshold: 0.05 }).observe(cv);
    } else start();
    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : start();
    });
  }

  /* ---------- 8. LOGO PLANES — separate on scroll (Hero C mediator) ---------- */
  function markPlanes() {
    var wrap = document.querySelector('[data-mark-planes]');
    if (!wrap || reduced) return;
    var polys = wrap.querySelectorAll('polygon');
    var offs = [[-9, -13], [-13, 4], [-2, 14], [11, 10], [9, -5]];
    var ticking = false;
    function apply() {
      var r = wrap.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, -r.top / (window.innerHeight * 0.9)));
      polys.forEach(function (poly, i) {
        var o = offs[i % offs.length];
        poly.style.transform = 'translate(' + (o[0] * p) + '%,' + (o[1] * p) + '%)';
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }, { passive: true });
    apply();
  }

  /* ---------- 9. ENQUIRY — three steps, submittable from step 2 ---------- */
  function enquiry() {
    var form = document.getElementById('enquiry');
    if (!form) return;
    var steps = Array.prototype.slice.call(form.querySelectorAll('.fstep'));
    var pips = Array.prototype.slice.call(document.querySelectorAll('.step-pip'));
    var idx = 0;

    function show(i) {
      idx = Math.max(0, Math.min(steps.length - 1, i));
      steps.forEach(function (s, n) { s.setAttribute('data-active', String(n === idx)); });
      pips.forEach(function (p, n) {
        if (n <= idx) p.setAttribute('aria-current', 'step'); else p.removeAttribute('aria-current');
      });
      var h = steps[idx].querySelector('h3,label');
      if (h) h.scrollIntoView({ block: 'nearest' });
    }

    function validate(step) {
      var ok = true;
      step.querySelectorAll('[required]').forEach(function (f) {
        var g = f.closest('.fgroup');
        var e = g && g.querySelector('.err');
        var bad = !f.value.trim() || (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.value));
        if (bad) {
          ok = false;
          if (g) g.setAttribute('data-invalid', 'true');
          if (e) e.textContent = f.type === 'email'
            ? 'Enter a valid email address, such as name@example.com'
            : 'This field is required';
        } else {
          if (g) g.removeAttribute('data-invalid');
          if (e) e.textContent = '';
        }
      });
      return ok;
    }

    form.addEventListener('click', function (e) {
      var next = e.target.closest('[data-next]');
      var prev = e.target.closest('[data-prev]');
      if (next) { e.preventDefault(); if (validate(steps[idx])) show(idx + 1); }
      if (prev) { e.preventDefault(); show(idx - 1); }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      // must validate every step, not only the visible one
      var allOk = steps.every(function (s) { return validate(s); });
      if (!allOk) { var bad = steps.find(function (s) { return s.querySelector('[data-invalid="true"]'); }); if (bad) show(steps.indexOf(bad)); return; }
      form.style.display = 'none';
      var ok = document.querySelector('.success');
      if (ok) { ok.setAttribute('data-shown', 'true'); ok.focus(); }
    });

    // clear the error as soon as the visitor fixes it
    form.addEventListener('input', function (e) {
      var g = e.target.closest('.fgroup');
      if (g && g.getAttribute('data-invalid') === 'true' && e.target.value.trim()) {
        g.removeAttribute('data-invalid');
        var er = g.querySelector('.err'); if (er) er.textContent = '';
      }
    });

    show(0);
  }

  /* ---------- boot ---------- */
  function init() {
    loader(); nav(); menu(); reveals(); cursor();
    pillars(); heroDuality(); markPlanes(); enquiry();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

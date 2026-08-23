/* ═══════════════════════════════════════════════════════════════════════════
   APERTURE X — V7 scene engine
   Vanilla, no dependencies. The editorial edition is the document's default
   state; everything here is enhancement. If this file never runs, the page is
   already composed.

   Engine model: each .scene[data-len] gets a runway of len×100svh with a
   sticky stage. A rAF loop computes raw progress 0..1 per scene, lerps it for
   weight, and calls the scene's update(p). Beats are sub-ranges of p.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var mobile = window.matchMedia('(max-width: 760px)').matches;

  /* mode: cinematic only when JS runs AND motion is allowed. A mid-session
     OS change downgrades live (§43: reduced motion is a designed alternative). */
  function applyMode() {
    var cinematic = !reduced.matches;
    document.documentElement.setAttribute('data-mode', cinematic ? 'cinematic' : 'editorial');
    return cinematic;
  }
  var cinematic = applyMode();
  reduced.addEventListener('change', function () {
    cinematic = applyMode();
    if (!cinematic) window.scrollTo(0, window.scrollY); // reflow settles
  });

  /* ---------- helpers ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function easeIO(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  /* interpolate two same-length polygon point lists: "x y, x y, ..." */
  function lerpPoly(A, B, t) {
    var out = [];
    for (var i = 0; i < A.length; i++) out.push(mix(A[i][0], B[i][0], t) + '% ' + mix(A[i][1], B[i][1], t) + '%');
    return 'polygon(' + out.join(',') + ')';
  }

  /* ---------- LOADER: V1 integrity treatment - in-place assembly, progress,
     clean curtain exit. The mark is always the exact canonical geometry. ---------- */
  function loader() {
    var el = document.querySelector('.loader');
    if (!el) return;
    if (!cinematic) { el.style.display = 'none'; return; }
    var bar = el.querySelector('.prog i');
    requestAnimationFrame(function () { el.classList.add('lit'); });
    var done = false;
    function finish() {
      if (done) return; done = true;
      if (bar) bar.style.width = '100%';
      setTimeout(function () {
        el.setAttribute('data-done', 'true');
        el.setAttribute('aria-hidden', 'true');
        el.removeAttribute('role'); el.removeAttribute('aria-live');
        setTimeout(function () { el.style.display = 'none'; }, 900);
      }, 420);                       // hold the assembled mark long enough to read
    }
    var v = document.querySelector('#hero video');
    if (bar) bar.style.width = '30%';
    if (v && v.readyState >= 2) { if (bar) bar.style.width = '86%'; finish(); }
    else if (v) {
      v.addEventListener('loadeddata', function () { if (bar) bar.style.width = '86%'; finish(); }, { once: true });
      setTimeout(finish, 2600);
    }
    else setTimeout(finish, 1000);
  }

  /* ---------- NAV / MENU ---------- */
  function nav() {
    var n = document.querySelector('.nav');
    var last = false;
    window.addEventListener('scroll', function () {
      var s = window.scrollY > 40;
      if (s !== last) { n.classList.toggle('scrolled', s); last = s; }
    }, { passive: true });

    var m = document.getElementById('menu');
    var open = document.querySelector('.menu-btn');
    var close = document.querySelector('.menu-close');
    if (!m || !open) return;
    var lastFocus = null;
    function setOpen(state) {
      m.setAttribute('data-open', String(state));
      open.setAttribute('aria-expanded', String(state));
      document.body.style.overflow = state ? 'hidden' : '';
      if (state) {
        m.removeAttribute('inert'); m.removeAttribute('aria-hidden');
        lastFocus = document.activeElement;
        var f = m.querySelector('a,button'); if (f) f.focus();
      } else {
        m.setAttribute('inert', ''); m.setAttribute('aria-hidden', 'true');
        if (lastFocus) lastFocus.focus();
      }
    }
    m.setAttribute('inert', ''); m.setAttribute('aria-hidden', 'true');
    open.addEventListener('click', function () { setOpen(m.getAttribute('data-open') !== 'true'); });
    if (close) close.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && m.getAttribute('data-open') === 'true') setOpen(false);
    });
    m.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = m.querySelectorAll('a,button');
      var first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { lastEl.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { first.focus(); e.preventDefault(); }
    });
  }

  /* ---------- VIDEO: IO-gated, tab-aware, resumable ---------- */
  function video() {
    var vids = document.querySelectorAll('video[data-auto]');
    if (!vids.length || !cinematic) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        var v = en.target;
        if (document.documentElement.getAttribute('data-motion') === 'paused') return;
        if (en.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function(){}); }
        else v.pause();
      });
    }, { threshold: 0.25 });
    vids.forEach(function (v) { v.muted = true; io.observe(v); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { vids.forEach(function (v) { v.pause(); }); return; }
      if (document.documentElement.getAttribute('data-motion') === 'paused') return;
      vids.forEach(function (v) {
        var r = v.getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0) { var p = v.play(); if (p && p.catch) p.catch(function(){}); }
      });
    });
  }

  /* ---------- MOTION TOGGLE (WCAG 2.2.2) ---------- */
  function motionToggle() {
    if (!cinematic) return;
    var btn = document.createElement('button');
    btn.className = 'motion-toggle'; btn.type = 'button';
    var paused = false;
    function label() { btn.textContent = paused ? 'Play motion' : 'Pause motion'; btn.setAttribute('aria-pressed', String(paused)); }
    btn.addEventListener('click', function () {
      paused = !paused;
      document.documentElement.setAttribute('data-motion', paused ? 'paused' : 'running');
      document.querySelectorAll('video[data-auto]').forEach(function (v) {
        if (paused) v.pause(); else { var p = v.play(); if (p && p.catch) p.catch(function(){}); }
      });
      label();
    });
    label(); document.body.appendChild(btn);
  }

  /* ═══════════ SCENE ENGINE ═══════════ */
  var scenes = [];
  function addScene(id, update) {
    var el = document.getElementById(id);
    if (!el || !el.hasAttribute('data-len')) return;
    el.style.setProperty('--len', el.getAttribute('data-len'));
    scenes.push({ el: el, stage: el.querySelector('.stage'), update: update, p: 0, disp: 0 });
  }

  function beat(scene, name, on) {
    var el = scene.el.querySelector('[data-beat="' + name + '"]');
    if (el) el.classList.toggle('on', on);
  }

  /* ---------- S1 HERO ----------
     Beat 1: the aperture dilates and the film takes the full viewport - the
     type column steps aside (never overlapped on faces).
     Beat 2: the film recedes upward as S2's commissioned work arrives - the
     narrative purpose: the film you were watching is one of the commissions. */
  var AP_START = [[12,8],[58,2],[96,24],[98,78],[54,96],[6,74]];
  var AP_FULL  = [[-6,-6],[55,-8],[108,-4],[108,106],[52,108],[-6,104]];
  var heroP = 0;
  function heroUpdate(p, sc) {
    heroP = p;
    var media = sc.el.querySelector('.hero-media');
    var copy = sc.el.querySelector('.hero-copy');
    var grid = sc.el.querySelector('.hero-grid');
    var t1 = easeIO(seg(p, .06, .5));
    media.style.clipPath = lerpPoly(AP_START, AP_FULL, t1);
    /* the media grows out of its grid cell to claim the viewport */
    var vw = innerWidth, rect = grid.getBoundingClientRect();
    media.style.transform = 'scale(' + mix(1, mobile ? 1.04 : 1.16, t1) + ')';
    media.style.zIndex = t1 > .4 ? 4 : 1;
    copy.style.opacity = String(1 - easeIO(seg(p, .18, .46)));
    copy.style.transform = 'translateX(' + (-easeIO(seg(p, .18, .5)) * 8) + 'vw)';
    /* beat 2: recede upward, handing the frame to the commissions */
    var t2 = easeIO(seg(p, .62, 1));
    media.style.opacity = String(1 - t2 * .9);
    media.style.transform += ' translateY(' + (-t2 * 22) + 'svh)';
  }
  function heroPointer() {
    if (!finePointer || !cinematic) return;
    var stage = document.querySelector('#hero .stage');
    var media = document.querySelector('#hero .hero-media');
    var raf = null, tx = 0, ty = 0;
    stage.addEventListener('pointermove', function (e) {
      tx = (e.clientX / innerWidth - .5) * 14;
      ty = (e.clientY / innerHeight - .5) * 10;
      if (!raf) raf = requestAnimationFrame(function () {
        raf = null;
        media.style.objectPosition = (52 + tx / 4) + '% ' + (34 + ty / 4) + '%';
        // the aperture itself breathes toward the pointer - the first-10s
        // interaction a visitor discovers by moving, not by reading
        if (heroP < .05) {
          var d = Math.hypot(tx, ty) / 12;
          var out = [];
          for (var i = 0; i < AP_START.length; i++) {
            var cx = 54, cy = 51;
            var px = AP_START[i][0] + (AP_START[i][0] - cx) * d * .1 + tx * .3;
            var py = AP_START[i][1] + (AP_START[i][1] - cy) * d * .1 + ty * .3;
            out.push(px + '% ' + py + '%');
          }
          media.style.clipPath = 'polygon(' + out.join(',') + ')';
        }
      });
    });
  }

  /* ---------- S2 COMMERCIAL: counter-scroll ---------- */
  function commercialUpdate(p, sc) {
    // sequential entrance, then a focus hand-off: Ria leads, LIA takes over.
    var a = sc.el.querySelector('.vcol-a'), b = sc.el.querySelector('.vcol-b');
    var inA = easeOut(seg(p, .02, .3)), inB = easeOut(seg(p, .16, .46));
    var focusB = easeIO(seg(p, .55, .8));
    a.style.transform = 'translateY(' + mix(22, 0, inA) + 'svh) scale(' + mix(1, .94, focusB) + ')';
    a.style.opacity = String(inA * mix(1, .55, focusB));
    b.style.transform = 'translateY(' + mix(30, 0, inB) + 'svh) scale(' + mix(.94, 1, focusB) + ')';
    b.style.opacity = String(inB);
    beat(sc, 'com-head', p > .02);
  }

  /* ---------- S3 TECHNOLOGY: pixel zoom + morph ---------- */
  function techUpdate(p, sc) {
    var z = sc.el.querySelector('.zoomer');
    // camera PUSH-IN: the interface approaches from distance. Scale never
    // exceeds 1, so the screenshot is never rendered above native resolution
    // (founder cat C - the pixelated zoom is impossible by construction).
    var t1 = easeIO(seg(p, 0, .42));
    var scale = mix(.3, 1, t1);
    z.style.transform = 'scale(' + scale + ')';
    z.style.opacity = String(mix(.65, 1, t1));
    var morph = seg(p, .6, .8);                      // responsive morph beat
    z.classList.toggle('morphed', morph > .5);
    beat(sc, 'tech-head', p > .04);
    beat(sc, 'tech-note', p > .46);
  }

  /* ---------- S4 PHOTOGRAPHY: depth drift + inversion ---------- */
  function photoUpdate(p, sc) {
    var layers = sc.el.querySelectorAll('.depth');
    var rates = [16, 9, 5];
    layers.forEach(function (L, i) {
      L.style.transform = 'translateY(' + mix(rates[i], -rates[i], p) + 'svh) translateZ(' + (i - 1) * 160 + 'px)';
    });
    // latched inversion with hysteresis: enters at .58, exits below .44 —
    // scroll wiggle at the boundary cannot strobe the field (a11y hazard)
    if (p > .58 && !sc.lit) { sc.lit = true; sc.el.classList.add('lit'); }
    else if (p < .44 && sc.lit) { sc.lit = false; sc.el.classList.remove('lit'); }
    var hs = sc.el.querySelector('.hero-shot');
    var t = easeIO(seg(p, .68, .95));
    hs.style.opacity = String(t);
    hs.querySelector('img').style.transform = 'scale(' + mix(1.15, 1, t) + ')';
    beat(sc, 'ph-head', p > .06);
  }

  /* ---------- S5 CINEMA: letterbox + strip ---------- */
  function cinemaUpdate(p, sc) {
    // bars close while entering, hold through the strip, release on exit
    var closeT = easeIO(seg(p, 0, .3));
    var releaseT = easeIO(seg(p, .9, 1));
    var barH = mix(0, 13, closeT) * (1 - releaseT);
    sc.el.style.setProperty('--barh', barH + 'svh');
    var strip = sc.el.querySelector('.strip');
    var peak = strip.querySelector('.peak');
    // travel ends with the PEAK frame centred and held - the emotional beat
    var max = peak.offsetLeft - (strip.parentElement.clientWidth - peak.offsetWidth) / 2;
    strip.style.transform = 'translateX(' + (-easeIO(seg(p, .28, .82)) * Math.max(0, max)) + 'px)';
    beat(sc, 'cin-head', p > .12);
  }

  /* ---------- S6 STUDIO: layered rise ---------- */
  function studioUpdate(p, sc) {
    sc.el.querySelectorAll('.tm').forEach(function (m, i) {
      var t = easeOut(seg(p, .03 + i * .06, .4 + i * .06));
      m.style.transform = 'translateY(' + mix(42, 0, t) + 'px)';
      m.style.opacity = String(mix(.45, 1, t));
    });
    beat(sc, 'st-head', p > .015);
  }

  /* ---------- S8 FINALE: planes converge ---------- */
  /* LOGO INTEGRITY (cat G): the mark begins RECOGNISABLE, breathes apart by a
     small deliberate amount at mid-scroll, and returns to the exact canonical
     assembly - which then HOLDS for the rest of the scene. No rotation, no
     scatter, no broken states. */
  var FIN_BREATH = [[-14, -11], [12, -7], [-10, 9], [13, 8], [0, -15]];
  function finaleUpdate(p, sc) {
    var polys = sc.el.querySelectorAll('.fin-mark polygon');
    var breath = Math.sin(clamp(seg(p, .05, .7), 0, 1) * Math.PI);   // 0 -> 1 -> 0
    polys.forEach(function (poly, i) {
      var s = FIN_BREATH[i];
      poly.style.transform = 'translate(' + (s[0] * breath) + 'px,' + (s[1] * breath) + 'px)';
    });
    beat(sc, 'fin-type', p > .3);
    beat(sc, 'fin-cta', p > .5);
  }

  /* ---------- engine loop ---------- */
  function engine() {
    if (!cinematic) return;
    addScene('hero', heroUpdate);
    addScene('commercial', commercialUpdate);
    addScene('tech', techUpdate);
    addScene('photo', photoUpdate);
    addScene('cinema', cinemaUpdate);
    addScene('studio', studioUpdate);
    addScene('finale', finaleUpdate);

    var vh = innerHeight;
    addEventListener('resize', function () { vh = innerHeight; });

    function frame() {
      if (document.documentElement.getAttribute('data-mode') !== 'cinematic') return;
      var paused = document.documentElement.getAttribute('data-motion') === 'paused';
      var y = window.scrollY;
      scenes.forEach(function (sc) {
        var rect = sc.el.getBoundingClientRect();
        var top = y + rect.top;
        var runway = sc.el.offsetHeight - vh;
        if (runway <= 0) return;
        var raw = clamp((y - top) / runway, 0, 1);
        sc.p = raw;
        /* lerped display progress = weight; snaps when far to avoid lag */
        var d = raw - sc.disp;
        sc.disp += Math.abs(d) > .2 ? d : d * .16;
        if (Math.abs(raw - sc.disp) < .0005) sc.disp = raw;
        if (!paused || Math.abs(d) > 0) sc.update(sc.disp, sc);
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- boot ---------- */
  function init() {
    loader(); nav(); video(); motionToggle();
    engine(); heroPointer();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

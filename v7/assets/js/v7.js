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

  /* ---------- LOADER: fly-in, then iris out ---------- */
  function loader() {
    var el = document.querySelector('.loader');
    if (!el) return;
    if (!cinematic) { el.style.display = 'none'; return; }
    requestAnimationFrame(function () { el.classList.add('fly'); });
    var done = false;
    function finish() {
      if (done) return; done = true;
      setTimeout(function () {
        el.classList.add('iris');
        el.setAttribute('aria-hidden', 'true');
        el.removeAttribute('role'); el.removeAttribute('aria-live');
        setTimeout(function () { el.style.display = 'none'; }, 1400);
      }, 950);                       // let the assembly register, then cut
    }
    var v = document.querySelector('#hero video');
    if (v && v.readyState >= 2) finish();
    else if (v) { v.addEventListener('loadeddata', finish, { once: true }); setTimeout(finish, 2800); }
    else setTimeout(finish, 1200);
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

  /* ---------- S1 HERO ---------- */
  var AP_START = [[24,30],[52,24],[78,40],[84,64],[60,78],[30,62]];
  var AP_FULL  = [[-8,-8],[50,-12],[112,-6],[112,108],[50,112],[-8,108]];
  var heroP = 0;
  function heroUpdate(p, sc) {
    heroP = p;
    var media = sc.el.querySelector('.hero-media');
    var front = sc.el.querySelector('.hero-front');
    var back = sc.el.querySelector('.hero-back');
    /* beat 1 (0-.38): aperture dilates to full bleed */
    var t1 = easeIO(seg(p, 0, .38));
    media.style.clipPath = lerpPoly(AP_START, AP_FULL, t1);
    /* pointer parallax handled separately; scroll adds slow push-in */
    media.style.transform = 'scale(' + mix(1.06, 1, t1) + ')';
    /* beat 2 (.42-.75): type compresses, film pulls back into a framed panel */
    var t2 = easeIO(seg(p, .42, .78));
    front.style.transform = 'translateY(' + (-t2 * 46) + 'svh) scale(' + mix(1, .38, t2) + ')';
    front.style.opacity = String(1 - seg(p, .6, .82));
    back.style.opacity = String(1 - t2 * 1.4);
    if (t2 > 0) {
      // dock as a TRUE 2.22:1 panel (no aspect lie at the cut) - inset keeps
      // the film ratio: vertical inset grows faster than horizontal
      var ix = mix(0, 24, easeIO(t2));
      var iy = mix(0, 33, easeIO(t2));
      media.style.clipPath = 'inset(' + iy + '% ' + ix + '% ' + iy + '% ' + ix + '% round 2px)';
      media.style.transform = 'scale(1) translateY(' + (-t2 * 6) + 'svh)';
    }
    beat(sc, 'gallery-note', p > .8);
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
    var a = sc.el.querySelector('.vcol-a'), b = sc.el.querySelector('.vcol-b');
    var drift = mobile ? 12 : 22;
    a.style.transform = 'translateY(' + mix(drift, -drift, easeIO(p)) + 'svh)';
    b.style.transform = 'translateY(' + mix(-drift, drift, easeIO(p)) + 'svh)';
    beat(sc, 'com-head', p > .04);
    // cut prep: the red plane pushes toward camera, becoming S3's pixel
    var th = sc.el.querySelector('.thread');
    if (th) {
      var t = easeIO(seg(p, .82, 1));
      th.style.transform = 'scale(' + mix(1, 7, t) + ')';
      th.style.opacity = String(1 - seg(p, .96, 1));
      th.style.transformOrigin = 'center';
    }
  }

  /* ---------- S3 TECHNOLOGY: pixel zoom + morph ---------- */
  function techUpdate(p, sc) {
    var z = sc.el.querySelector('.zoomer');
    // exponential mapping: a zoom reads even only when scale changes
    // geometrically per scroll unit (motion-director note)
    var t1 = seg(p, 0, .5);
    var scale = Math.pow(26, 1 - t1);
    z.style.transform = 'scale(' + scale + ')';
    var morph = seg(p, .58, .86);                    // responsive morph
    z.classList.toggle('morphed', morph > .5);
    beat(sc, 'tech-head', p > .42);
    beat(sc, 'tech-note', p > .5);
    var tick = sc.el.querySelector('.route-ticker div');
    if (tick) tick.style.transform = 'translateX(' + (-p * 40) + '%)';
  }

  /* ---------- S4 PHOTOGRAPHY: depth drift + inversion ---------- */
  function photoUpdate(p, sc) {
    var layers = sc.el.querySelectorAll('.depth');
    var rates = [40, 22, 10];
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
    var head = sc.el.querySelector('.scene-head');
    head.style.opacity = String(1 - easeIO(seg(p, .3, .5)));
    beat(sc, 'cin-head', p > .06 && p < .5);
  }

  /* ---------- S6 STUDIO: layered rise ---------- */
  function studioUpdate(p, sc) {
    sc.el.querySelectorAll('.tm').forEach(function (m, i) {
      var t = easeOut(seg(p, .03 + i * .06, .4 + i * .06));
      m.style.transform = 'translateY(' + mix(42, 0, t) + 'px)';
      m.style.opacity = String(mix(.28, 1, t));
    });
    beat(sc, 'st-head', p > .015);
  }

  /* ---------- S8 FINALE: planes converge ---------- */
  var FIN_SCATTER = [
    [-120, -90, -18], [110, -60, 12], [-90, 80, 16], [120, 70, -14], [0, -130, 7]
  ];
  function finaleUpdate(p, sc) {
    var polys = sc.el.querySelectorAll('.fin-mark polygon');
    var t = easeIO(seg(p, .05, .8));
    polys.forEach(function (poly, i) {
      var s = FIN_SCATTER[i];
      poly.style.transform = 'translate(' + mix(s[0], 0, t) + 'px,' + mix(s[1], 0, t) + 'px) rotate(' + mix(s[2], 0, t) + 'deg)';
    });
    beat(sc, 'fin-type', p > .55);
    beat(sc, 'fin-cta', p > .7);
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

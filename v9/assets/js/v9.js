/* ═══════════════════════════════════════════════════════════════════════════
   APERTURE X — V9 scene engine
   Vanilla, no dependencies. The editorial edition is the document's default
   state; everything here is enhancement.

   V9 CORRECTIONS (founder gate V8.1)
   · --nav-h measured at runtime → a real header safe zone on every stage
   · no scene fades to nothing: every scene HOLDS to p=1, so handoffs are seamless
   · scenes animate on APPROACH (before they pin), so the cut is never empty
   · the Dunamis surface is scroll-DRIVEN, never nested-scrolled: one scroll
     authority, so the visitor cannot be trapped
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function isMobile() { return window.matchMedia('(max-width: 900px)').matches; }

  function applyMode() {
    var cinematic = !reduced.matches;
    document.documentElement.setAttribute('data-mode', cinematic ? 'cinematic' : 'editorial');
    return cinematic;
  }
  var cinematic = applyMode();
  reduced.addEventListener('change', function () {
    cinematic = applyMode();
    if (!cinematic) window.scrollTo(0, window.scrollY);
  });

  /* ---------- helpers ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function easeIO(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutQ(t) { return 1 - Math.pow(1 - t, 5); }
  function lerpPoly(A, B, t) {
    var out = [];
    for (var i = 0; i < A.length; i++)
      out.push(mix(A[i][0], B[i][0], t) + '% ' + mix(A[i][1], B[i][1], t) + '%');
    return 'polygon(' + out.join(',') + ')';
  }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ---------- HEADER SAFE ZONE (founder §15) ----------
     Measure the real nav and publish it as --nav-h. Every sticky stage pads to
     --safe-top, so no display headline can sit under the header at any width. */
  function safeZone() {
    var nav = $('.nav');
    if (!nav) return;
    function write() {
      document.documentElement.style.setProperty('--nav-h', Math.round(nav.offsetHeight) + 'px');
    }
    write();
    if (window.ResizeObserver) new ResizeObserver(write).observe(nav);
    addEventListener('resize', write, { passive: true });
  }

  /* ---------- LOADER (V1 integrity treatment — unchanged) ---------- */
  function loader() {
    var el = $('.loader');
    if (!el) return;
    if (!cinematic) { el.style.display = 'none'; return; }
    var bar = $('.prog i', el);
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
      }, 420);
    }
    var v = $('#hero video');
    if (bar) bar.style.width = '30%';
    if (v && v.readyState >= 2) { if (bar) bar.style.width = '86%'; finish(); }
    else if (v) {
      v.addEventListener('loadeddata', function () { if (bar) bar.style.width = '86%'; finish(); }, { once: true });
      setTimeout(finish, 2600);
    } else setTimeout(finish, 1000);
  }

  /* ---------- NAV / MENU ---------- */
  function nav() {
    var n = $('.nav'), last = false;
    addEventListener('scroll', function () {
      var s = scrollY > 40;
      if (s !== last) { n.classList.toggle('scrolled', s); last = s; }
    }, { passive: true });

    var m = document.getElementById('menu');
    var open = $('.menu-btn'), close = $('.menu-close');
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
      var f = m.querySelectorAll('a,button'), first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { lastEl.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { first.focus(); e.preventDefault(); }
    });
  }

  /* ---------- VIDEO ---------- */
  function video() {
    var vids = $$('video[data-auto]');
    if (!vids.length || !cinematic) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        var v = en.target;
        if (document.documentElement.getAttribute('data-motion') === 'paused') return;
        if (en.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.25 });
    vids.forEach(function (v) { v.muted = true; io.observe(v); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { vids.forEach(function (v) { v.pause(); }); return; }
      if (document.documentElement.getAttribute('data-motion') === 'paused') return;
      vids.forEach(function (v) {
        var r = v.getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
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
      $$('video[data-auto]').forEach(function (v) {
        if (paused) v.pause(); else { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      });
      label();
    });
    label(); document.body.appendChild(btn);
  }

  /* ═══════════ SCENE ENGINE ═══════════ */
  var scenes = [];
  function addScene(id, update, mobileLen) {
    var el = document.getElementById(id);
    if (!el || !el.hasAttribute('data-len')) return;
    if (mobileLen && isMobile()) el.setAttribute('data-len', mobileLen);
    el.style.setProperty('--len', el.getAttribute('data-len'));
    scenes.push({ el: el, stage: $('.stage', el), update: update, p: 0, disp: 0, app: 0, appDisp: 0 });
  }
  function beat(scene, name, on) {
    var el = scene.el.querySelector('[data-beat="' + name + '"]');
    if (el) el.classList.toggle('on', on);
  }

  /* ---------- S1 HERO ----------
     The film plate is the constant. The WORDS change around it, so no scroll
     state ever leaves half the viewport empty (founder §4).
     The plate reduces at .56 for one reason only: to release the space the
     credit needs. The film stops being a poster and becomes documented work
     (founder §5). It never fades out — it HOLDS to p=1 (founder §6). */
  var AP_START = [[10, 6], [58, 1], [97, 22], [99, 79], [52, 97], [4, 73]];
  var AP_FULL = [[0, 0], [50, 0], [100, 0], [100, 100], [50, 100], [0, 100]];
  var heroP = 0;
  function heroUpdate(p, sc) {
    heroP = p;
    var film = $('.hero-film', sc.el);
    var say = $('.hero-say', sc.el);
    var idl = $('.hero-id', sc.el);

    film.style.clipPath = lerpPoly(AP_START, AP_FULL, easeIO(seg(p, .06, .26)));

    /* the statement lifts away */
    var out = easeIO(seg(p, .20, .32));
    say.style.transform = 'translateY(' + (-out * 118) + '%)';
    say.style.opacity = String(1 - out);
    say.style.pointerEvents = out > .5 ? 'none' : 'auto';

    /* the identification takes the well — the left is never blank */
    var inn = easeOut(seg(p, .30, .44));
    idl.style.transform = 'translateY(' + mix(34, 0, inn) + 'px)';
    idl.style.opacity = String(inn);
    idl.style.pointerEvents = inn > .5 ? 'auto' : 'none';
    beat(sc, 'hero-cap', p > .40);
    beat(sc, 'hero-spec', p > .48);

    /* the plate reduces to release the credit — the narrative reason */
    var give = easeIO(seg(p, .56, .76));
    film.style.setProperty('--film-h', (isMobile() ? mix(40, 34, give) : mix(72, 58, give)) + 'svh');
    beat(sc, 'hero-credit', p > .66);
    beat(sc, 'hero-link', p > .82);
  }
  function heroPointer() {
    if (!finePointer || !cinematic) return;
    var stage = $('#hero .stage'), film = $('#hero .hero-film');
    if (!stage || !film) return;
    var raf = null, tx = 0, ty = 0;
    stage.addEventListener('pointermove', function (e) {
      tx = (e.clientX / innerWidth - .5) * 14;
      ty = (e.clientY / innerHeight - .5) * 10;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        var v = $('video,img', film);
        if (v) v.style.objectPosition = (52 + tx / 4) + '% ' + (34 + ty / 4) + '%';
        if (heroP < .05) {
          var d = Math.hypot(tx, ty) / 12, out = [];
          for (var i = 0; i < AP_START.length; i++) {
            var px = AP_START[i][0] + (AP_START[i][0] - 54) * d * .1 + tx * .3;
            var py = AP_START[i][1] + (AP_START[i][1] - 51) * d * .1 + ty * .3;
            out.push(px + '% ' + py + '%');
          }
          film.style.clipPath = 'polygon(' + out.join(',') + ')';
        }
      });
    });
  }

  /* ---------- S2 COMMERCIAL — the reel wall ----------
     Both films are 9:16 and stay the hero of the scene. Type sits BESIDE them
     on slates that never cross a frame. A perspective rig carries focus from
     one film to the other. The `app` (approach) value animates the reels in
     BEFORE the scene pins, so the cut out of the hero is never empty. */
  function commercialUpdate(p, sc, app) {
    var rig = $('.reel-rig', sc.el);
    var A = $('.reel-a', sc.el), B = $('.reel-b', sc.el);
    /* approach: the wall rises from depth while the hero is still on screen */
    var arrive = easeOutQ(clamp(app * 1.25, 0, 1));
    var settle = easeOutQ(seg(p, 0, .16));
    var enter = Math.max(arrive, settle);

    var focusA = easeIO(seg(p, .30, .50));        // Ria forward
    var hand = easeIO(seg(p, .52, .74));          // handoff to Love in Action
    var resolve = easeIO(seg(p, .88, .98));       // return to parity

    var yaw = mix(6, 2, easeIO(seg(p, .14, .30)));
    yaw = mix(yaw, -2, hand);
    var throwX = mix(0, -1, hand) * (isMobile() ? 0 : 96);
    rig.style.transform = 'translateX(' + throwX + 'px) rotateY(' + yaw + 'deg)';

    var aZ = mix(-180, 0, enter);
    aZ = mix(aZ, 140, focusA);
    aZ = mix(aZ, -220, hand);
    aZ = mix(aZ, -60, resolve);
    var aRot = mix(-5, 0, enter); aRot = mix(aRot, -16, hand); aRot = mix(aRot, -8, resolve);
    var aOp = mix(0, 1, enter) * mix(1, .62, hand);
    A.style.transform = 'translateZ(' + aZ + 'px) rotateY(' + aRot + 'deg) scale(' + mix(.94, 1, enter) + ')';
    A.style.opacity = String(clamp(aOp * mix(1, 1.4, resolve), 0, 1));

    var bEnter = easeOutQ(clamp(app * 1.05, 0, 1));
    bEnter = Math.max(bEnter, easeOutQ(seg(p, .06, .24)));
    var bZ = mix(-220, 0, bEnter);
    bZ = mix(bZ, -150, focusA);
    bZ = mix(bZ, 140, hand);
    bZ = mix(bZ, -40, resolve);
    var bRot = mix(6, 0, bEnter); bRot = mix(bRot, 14, focusA); bRot = mix(bRot, 0, hand);
    B.style.transform = 'translateZ(' + bZ + 'px) rotateY(' + bRot + 'deg) scale(' + mix(.94, 1, bEnter) + ')';
    B.style.opacity = String(clamp(mix(0, 1, bEnter) * mix(.62, 1, Math.max(hand, resolve * .6)), 0, 1));

    beat(sc, 'com-head', app > .35 || p > .01);
    beat(sc, 'slate-a', p > .12);
    beat(sc, 'slate-b', p > .20);
  }

  /* ---------- S3 TECHNOLOGY — the drawing becomes the site ----------
     No blue field, no growing rectangle, no device mockup. The drafting frame
     is drawn at FINAL SIZE, the capture renders into it, and the page is then
     read at four desktop stops, reflowed to 390px the way a browser really
     reflows (the desktop layout is CROPPED as the viewport narrows, never
     rescaled), and read again at three phone stops.

     A live iframe is impossible: dunamishosting.com sends
     X-Frame-Options: SAMEORIGIN and Chrome refuses to frame it cross-origin.
     These are high-DPR captures of the real site, labelled as captures, and
     driven by the PAGE's scroll — there is no nested scroller to trap anyone. */
  var DESK = { w: 1440, h: 3360 };   // CSS px the desktop strip represents
  var MOB = { w: 390, h: 2893 };
  var D_STOPS = [0, .30, .58, 1];    // home · products · pricing · steps
  var M_STOPS = [0, .35, .72];
  function stopAt(stops, t) {        // hop-and-hold between stops
    var n = stops.length - 1, x = clamp(t, 0, 1) * n;
    var i = Math.min(Math.floor(x), n - 1), f = x - i;
    return mix(stops[i], stops[i + 1], easeIO(clamp((f - .35) / .65, 0, 1)));
  }
  function techUpdate(p, sc, app) {
    var st = sc.stage, surf = $('.dun-surface', sc.el), view = $('.dun-view', sc.el);
    /* PRE: 0→1 while the section rises into view, BEFORE it pins. Every first
       beat is max(p-driven, pre-driven), so the scene is already composed the
       moment it is on screen. Without this the handoff frame is blank. */
    var pre = easeOutQ(clamp((app - .18) / .62, 0, 1));
    var D = $('.dun-shot-d', sc.el), M = $('.dun-shot-m', sc.el);
    var thumb = $('.dun-scroll-rail i', sc.el);

    st.style.setProperty('--grid-o', String(Math.max(pre, seg(p, .01, .06))));
    sc.el.style.setProperty('--rule', String(Math.max(pre, easeIO(seg(p, .10, .20)))));

    /* the frame arrives at final size — it is never scaled up from a thumbnail */
    var draw = Math.max(pre, easeIO(seg(p, .02, .10)));
    surf.style.opacity = String(draw);
    surf.style.clipPath = 'inset(0 ' + (100 - draw * 100) + '% 0 0)';

    /* GEOMETRY — measured from the live box, never parsed from a CSS variable.
       getPropertyValue('--gut') returns the unresolved clamp() token, so
       parseFloat gives NaN and every dimension downstream silently dies. */
    var colW = surf.parentElement.clientWidth || innerWidth;
    var wide = Math.max(320, Math.min(colW, 1000));
    var narrow = Math.min(344, colW);   /* narrower = a real phone proportion */
    var narrowT = easeIO(seg(p, .58, .68));
    var W = mix(wide, narrow, narrowT);
    surf.style.width = W + 'px';

    /* the desktop view keeps a browser ratio; the phone view keeps a PHONE ratio,
       so the reflow ends on something that reads as a handset, not a squat box */
    var viewH = mix(Math.min(innerHeight * .58, W * (900 / DESK.w)),
                    Math.min(innerHeight * .70, narrow * 1.95), narrowT);
    view.style.height = Math.round(viewH) + 'px';

    /* the desktop keeps its own width and is CROPPED by the narrowing frame —
       exactly what a browser does mid-resize. A screenshot cannot reflow, so we
       never stretch one and never show an unfinished scaled state. */
    D.style.width = wide + 'px';
    M.style.width = narrow + 'px';
    M.style.left = Math.round((W - narrow) / 2) + 'px';

    var paintOut = easeIO(seg(p, .655, .70));
    var paintIn = easeIO(seg(p, .69, .73));

    /* the capture renders into the frame behind a red sweep */
    var render = Math.max(pre, easeIO(seg(p, .16, .24)));
    D.style.clipPath = 'inset(0 0 ' + (100 - render * 100) + '% 0)';
    D.style.opacity = String((1 - paintOut));
    M.style.opacity = String(paintIn);

    var dTravel = Math.max(0, wide * (DESK.h / DESK.w) - viewH);
    var mTravel = Math.max(0, narrow * (MOB.h / MOB.w) - viewH);
    var dRead = stopAt(D_STOPS, seg(p, .24, .58));
    var mRead = stopAt(M_STOPS, seg(p, .73, .94));
    D.style.transform = 'translateY(' + (-dRead * dTravel) + 'px)';
    M.style.transform = 'translateY(' + (-mRead * mTravel) + 'px)';

    if (thumb) {
      var frac = narrowT > .5 ? mRead : dRead;
      var span = narrowT > .5 ? (viewH / (narrow * (MOB.h / MOB.w))) : (viewH / (wide * (DESK.h / DESK.w)));
      thumb.style.setProperty('--thumb-h', (span * 100) + '%');
      thumb.style.setProperty('--thumb-y', (frac * (1 - span) * 100) + '%');
    }

    /* live readouts — something is always changing, so the scene cannot read dead */
    var wRead = $('.rd-w', sc.el), rRead = $('.rd-r', sc.el);
    if (wRead) wRead.textContent = Math.round(mix(1440, 390, narrowT)) + ' PX';
    if (rRead) {
      var routes = ['/ home', '/ web-hosting', '/ pricing', '/ client-area'];
      var mroutes = ['/ home', '/ web-hosting', '/ pricing'];
      rRead.textContent = narrowT > .5
        ? mroutes[Math.min(mroutes.length - 1, Math.round(mRead * (mroutes.length - 1)))]
        : routes[Math.min(routes.length - 1, Math.round(dRead * (routes.length - 1)))];
    }
    var ticks = $$('.route-ribbon i', sc.el);
    if (ticks.length) {
      var lit = Math.round(seg(p, .24, .94) * ticks.length);
      ticks.forEach(function (t, i) { t.classList.toggle('on', i < lit); });
    }

    beat(sc, 'tech-head', app > .30 || p > .05);
    beat(sc, 'tech-note', app > .55 || p > .30);
    beat(sc, 'tech-close', p > .90);
  }

  /* ---------- S4 PHOTOGRAPHY — the horizontal sheet ----------
     The founder likes the horizontal movement; the gallery is rebuilt around
     it. Display type lives on its own panel IN the track, so it physically
     leaves the viewport before any photograph arrives — type can never land on
     a face (founder §22). Scale, orientation and vertical offset vary by
     design; nothing is a uniform thumbnail. */
  function photoUpdate(p, sc, app) {
    var track = $('.pt-track', sc.el);
    var total = track.scrollWidth - innerWidth;
    if (total < 0) total = 0;
    /* piecewise pacing: run, slow to read, run, hold the group frame */
    var t = p < .30 ? mix(0, .30, easeIO(p / .30) )
          : p < .46 ? mix(.30, .40, (p - .30) / .16)
          : p < .74 ? mix(.40, .80, easeIO((p - .46) / .28))
          : mix(.80, 1, easeIO((p - .74) / .26));
    track.style.transform = 'translateX(' + (-t * total) + 'px)';
    sc.el.style.setProperty('--ptp', String(p));
    beat(sc, 'ph-open', app > .3 || p > .01);
  }

  /* ---------- S5 CINEMA — letterbox carries the title ---------- */
  function cinemaUpdate(p, sc, app) {
    var closeT = easeIO(seg(p, 0, .26));
    var releaseT = easeIO(seg(p, .92, 1));
    sc.el.style.setProperty('--barh', (mix(0, 13, closeT) * (1 - releaseT)) + 'svh');
    var strip = $('.strip', sc.el), peak = $('.peak', strip);
    var max = peak.offsetLeft - (strip.parentElement.clientWidth - peak.offsetWidth) / 2;
    strip.style.transform = 'translateX(' + (-easeIO(seg(p, .24, .84)) * Math.max(0, max)) + 'px)';
    beat(sc, 'cin-head', app > .5 || p > .10);
  }

  /* ---------- S6 STUDIO — the field ----------
     Not cards. Five plates arriving out of depth, recomposing mid-scene, and
     resolving into one group frame. Portraits are never filtered. */
  var FIELD_A = [[52, 26, 16], [77, 24, 13], [30, 74, 14], [54, 76, 12], [80, 72, 12]];
  var FIELD_B = [[47, 25, 17], [72, 23, 14], [25, 74, 15], [49, 77, 13], [75, 73, 13]];
  function studioUpdate(p, sc, app) {
    var pls = $$('.pl', sc.el);
    var recomp = easeIO(seg(p, .30, .52));
    var group = easeIO(seg(p, .72, .90));
    pls.forEach(function (el, i) {
      var a = FIELD_A[i] || FIELD_A[0], b = FIELD_B[i] || FIELD_B[0];
      var s = .10 + i * .11;
      var arrive = easeOutQ(Math.max(seg(p, s, s + .26), clamp(app - .4, 0, 1) * (i === 0 ? 1 : 0)));
      var x = mix(a[0], b[0], recomp), y = mix(a[1], b[1], recomp), w = mix(a[2], b[2], recomp);
      if (!isMobile()) {
        el.style.left = x + '%'; el.style.top = y + '%';
        el.style.setProperty('--w', w + '%');
      }
      var z = mix(-460, 0, arrive);
      var base = isMobile() ? '' : 'translate(-50%,-50%) ';
      el.style.transform = base + 'translateZ(' + (isMobile() ? z * .3 : z) + 'px) translateY('
        + mix(isMobile() ? 3 : 6, 0, arrive) + 'svh)';
      el.style.opacity = String(arrive);
      el.style.filter = 'blur(' + mix(10, 0, arrive) + 'px)';   /* focus, never colour */
      /* one person in focus at a time, until the group frame equalises them */
      var focusIdx = Math.floor(clamp(seg(p, .14, .72), 0, .999) * pls.length);
      var isFocus = i === focusIdx;
      var dim = mix(isFocus ? 1 : .52, 1, group);
      el.style.opacity = String(arrive * dim);
      el.style.zIndex = String(isFocus ? 6 : 3);
    });
    beat(sc, 'st-head', app > .3 || p > .01);
    beat(sc, 'st-note', p > .80);
  }

  /* ---------- S7 CONVERSION — the open frame ----------
     The rejected red band is gone. A cream aperture opens into the page, the
     invitation sets line by line, the traces of the five projects just seen
     line up beneath it, and the plate button lands last. */
  var ENG_START = [[64, 46], [72, 44], [78, 50], [76, 57], [68, 58], [62, 52]];
  var ENG_FULL = [[0, 0], [50, 0], [100, 0], [100, 100], [50, 100], [0, 100]];
  function engageUpdate(p, sc, app) {
    var pre = easeOutQ(clamp((app - .18) / .62, 0, 1));
    var f = $('.eng-field', sc.el);
    f.style.opacity = String(Math.max(pre, seg(p, 0, .05)));
    f.style.clipPath = lerpPoly(ENG_START, ENG_FULL, Math.max(pre, easeIO(seg(p, .02, .24))));
    $$('.eng-copy .ln i', sc.el).forEach(function (el, i) {
      var s = .16 + i * .05, t = Math.max(pre, easeOut(seg(p, s, s + .16)));
      el.style.transform = 'translateY(' + mix(112, 0, t) + '%)';
    });
    beat(sc, 'eng-eyebrow', app > .35 || p > .12);
    beat(sc, 'eng-sub', app > .6 || p > .34);
    beat(sc, 'eng-panel', app > .7 || p > .40);
    beat(sc, 'eng-trace', p > .52);
    /* NO closing exit: the plane simply carries the scene out. Closing it back
       down left an empty viewport between this scene and the finale. */
  }

  /* ---------- S8 FINALE — the plate ----------
     The planes the visitor has been following all page fly home along their own
     rays, LOCK to the exact canonical geometry, and hold. The mark is
     recognisable from the first frame and perfect from .34 onward — the visitor
     never studies broken pieces (founder §32/33). */
  var FIN_RAY = [[-1.7, -1.3], [1.4, -0.9], [-1.2, 1.1], [1.5, 1.0], [0, -1.8]];
  function finaleUpdate(p, sc, app) {
    var polys = $$('.fin-mark polygon', sc.el);
    var glow = $('.fin-glow', sc.el);
    var mark = $('.fin-mark', sc.el);
    var locked = p >= .34;
    polys.forEach(function (poly, i) {
      if (locked) { poly.style.transform = 'none'; poly.style.opacity = '1'; return; }
      var s = i * .045, t = easeOut(Math.max(seg(p, s, s + .26), easeOutQ(clamp((app - .22) / .6, 0, 1))));
      var r = FIN_RAY[i] || [0, 0];
      poly.style.transform = 'translate(' + (r[0] * 190 * (1 - t)) + 'px,' + (r[1] * 190 * (1 - t)) + 'px)'
        + ' scale(' + mix(.72, 1, t) + ')';
      poly.style.opacity = String(mix(0, 1, Math.min(1, t * 1.6)));
    });
    if (mark) mark.classList.toggle('locked', locked);
    if (glow) glow.style.opacity = String(Math.max(easeIO(seg(p, .04, .34)), clamp(app - .4, 0, 1)) * .42);
    $$('.fin-words i', sc.el).forEach(function (el, i) {
      var s = .38 + i * .12, t = easeOut(Math.max(seg(p, s, s + .16), clamp(app - .72, 0, 1) * 2.2));
      el.style.transform = 'translateY(' + mix(110, 0, t) + '%)';
    });
    sc.el.style.setProperty('--finrule', String(easeIO(seg(p, .46, .58))));
    sc.el.style.setProperty('--findiv', String(easeIO(seg(p, .54, .66))));
    beat(sc, 'fin-act', p > .58);
    beat(sc, 'fin-imprint', p > .62);
  }

  /* ---------- engine loop ---------- */
  function engine() {
    if (!cinematic) return;
    addScene('hero', heroUpdate, '2.0');
    addScene('commercial', commercialUpdate, '2.4');
    addScene('tech', techUpdate, '3.2');
    addScene('photo', photoUpdate, '3.0');
    addScene('cinema', cinemaUpdate, '1.8');
    addScene('studio', studioUpdate, '2.2');
    addScene('engage', engageUpdate, '1.8');
    addScene('finale', finaleUpdate, '1.7');

    var vh = innerHeight;
    addEventListener('resize', function () { vh = innerHeight; }, { passive: true });

    function frame() {
      if (document.documentElement.getAttribute('data-mode') !== 'cinematic') return;
      var paused = document.documentElement.getAttribute('data-motion') === 'paused';
      var y = scrollY;
      scenes.forEach(function (sc) {
        var rect = sc.el.getBoundingClientRect();
        var runway = sc.el.offsetHeight - vh;
        /* APPROACH: 0→1 as the scene's top rises through the viewport, before
           it pins. This is what removes the empty cut between scenes. */
        var app = clamp(1 - rect.top / vh, 0, 1);
        sc.appDisp += (app - sc.appDisp) * .16;
        if (runway <= 0) { sc.update(clamp(-rect.top / Math.max(1, sc.el.offsetHeight), 0, 1), sc, sc.appDisp); return; }
        var raw = clamp((y - (y + rect.top)) / runway, 0, 1);
        raw = clamp((-rect.top) / runway, 0, 1);
        sc.p = raw;
        var d = raw - sc.disp;
        sc.disp += Math.abs(d) > .2 ? d : d * .16;
        if (Math.abs(raw - sc.disp) < .0005) sc.disp = raw;
        if (!paused || Math.abs(d) > 0) sc.update(sc.disp, sc, sc.appDisp);
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function init() {
    safeZone(); loader(); nav(); video(); motionToggle();
    engine(); heroPointer();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

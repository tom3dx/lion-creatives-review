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

  /* ---------- S1 HERO — aperture → cinema → project ----------
     STATE 1  p .00-.14  the opening composition, film inside the faceted aperture
     STATE 2  p .22-.40  the aperture opens to FULL WIDTH; the film plays at its
                         native 2.22:1 with letterbox. HELD p .40-.58 — the founder
                         asked not to rush this, so nothing else moves through it.
     STATE 3  p .64-.82  the film settles LEFT, the project story sets on the RIGHT
              p .82-1    hold
     One interpolated polygon drives all three, so it is a single composited
     clip-path with no layout work in the scroll loop. */
  var HERO_S1 = [[52,20],[74,15],[98,24],[98,78],[74,86],[52,80]];   // faceted, right column
  var HERO_S2 = [[0,0],[50,0],[100,0],[100,100],[50,100],[0,100]];   // full bleed
  var HERO_S3 = [[0,0],[26,0],[52,0],[52,100],[26,100],[0,100]];     // left panel
  var heroP = 0;
  function heroUpdate(p, sc) {
    heroP = p;
    var film = $('.hero-film', sc.el);
    var say = $('.hero-say', sc.el);
    var id = $('.hero-id', sc.el);
    var media = $('video,.rm-poster', film);
    var mobile = isMobile();

    /* geometry: S1 → S2 → S3 */
    var toFull = easeIO(seg(p, .14, .40));
    var toLeft = easeIO(seg(p, .60, .82));
    var poly = toLeft > 0 ? lerpPoly(HERO_S2, mobile ? HERO_S2 : HERO_S3, toLeft)
                          : lerpPoly(HERO_S1, HERO_S2, toFull);
    film.style.clipPath = poly;

    /* the film scales up into the cinema state and eases back for the panel.
       width:100% + height:auto keeps its native 2.22:1 — letterboxed, never cropped
       and never upscaled (1600w source shown at 1440 = 0.9x). */
    if (media) {
      var s1 = mix(1.22, 1, toFull);            // slightly in at rest, true size full-width
      var s3 = mix(1, mobile ? 1 : 1.9, toLeft); // fills the narrower panel
      media.style.transform = 'translate(-50%,-50%) scale(' + (s1 * s3) + ')';
    }

    /* the opening statement leaves before the cinema state, so nothing is over
       the picture while it plays */
    var out = easeIO(seg(p, .12, .26));
    say.style.opacity = String(1 - out);
    say.style.transform = 'translateY(' + (-out * 12) + 'svh)';
    say.style.pointerEvents = out > .5 ? 'none' : 'auto';

    /* The project story must not start until the film's right edge has cleared
       the copy column. The film settles to 52% and the copy starts at 58%, so the
       copy waits until the transit is ~90% done — otherwise the text is briefly
       set over a face at the midpoint. */
    var inn = easeOut(seg(p, .80, .92));
    id.style.opacity = String(inn);
    id.style.transform = 'translateY(' + mix(26, 0, inn) + 'px)';
    id.style.pointerEvents = inn > .5 ? 'auto' : 'none';
  }
  function heroPointer() {
    if (!finePointer || !cinematic) return;
    var stage = $('#hero .stage'), film = $('#hero .hero-film');
    if (!stage || !film) return;
    var raf = null;
    stage.addEventListener('pointermove', function (e) {
      if (heroP > .10 || raf) return;
      var tx = (e.clientX / innerWidth - .5) * 12, ty = (e.clientY / innerHeight - .5) * 8;
      raf = requestAnimationFrame(function () {
        raf = null;
        var out = [];
        for (var i = 0; i < HERO_S1.length; i++)
          out.push((HERO_S1[i][0] + tx * .22) + '% ' + (HERO_S1[i][1] + ty * .22) + '%');
        film.style.clipPath = 'polygon(' + out.join(',') + ')';
      });
    });
  }

  /* ---------- S2 COMMERCIAL — the reel wall ----------
     Rebuilt to the mechanics measured from the founder's reference site
     (full numbers in 04-Design/REFERENCE-VISTA-REELS-MOTION-STUDY.md).

     Measured at 1440x900 over a 1620px runway:
       translateX  left -560 -> 0 over the first 15.2%, then 0 -> +140 over the
                   rest (a knee, not one curve); right mirrored
       rotateZ     left -4deg -> 0deg, LINEAR across the whole runway
       scale       a continuous shrink, with the focused reel slightly larger
       brightness  1.0 vs 0.68, handing off from left to right at the midpoint
       easing      none - a straight linear scrub
     There is NO perspective and NO rotateY in the reference; adding them would
     be a different effect, so this stays 2D. The engine's existing progress
     lerp supplies the inertia. */
  var REEL_THROW = 38.9;    // vw, measured 560/1440
  var REEL_DRIFT = 9.7;     // vw, measured 140/1440
  var REEL_KNEE  = 0.152;   // measured knee in the translate curve
  var REEL_TILT  = 4;       // degrees, measured
  function reelX(p) {       // returns vw for the LEFT reel; right is mirrored
    return p < REEL_KNEE
      ? mix(-REEL_THROW, 0, p / REEL_KNEE)
      : mix(0, REEL_DRIFT, (p - REEL_KNEE) / (1 - REEL_KNEE));
  }
  function commercialUpdate(p, sc, app) {
    var A = $('.reel-a', sc.el), B = $('.reel-b', sc.el);
    if (!A || !B) return;
    var m = isMobile();

    /* THE ONE DELIBERATE DEPARTURE FROM THE REFERENCE.
       In the reference the throw happens inside the first 15% of the pinned
       runway, which means its scene is nearly empty at p=0 (reels off-screen,
       centre copy not yet mounted) — exactly the dead frame the founder
       rejected in our build. So the same throw is split across the boundary:
       the approach carries it 62% of the way, and it completes visibly in the
       first 15% of the pin. One continuous driver, no discontinuity, and the
       scene is composed the moment it pins. */
    var e = clamp(app, 0, 1) * .62 + .38 * clamp(p / REEL_KNEE, 0, 1);
    var q = p;
    var x = p < REEL_KNEE
      ? mix(-REEL_THROW, 0, e)
      : mix(0, REEL_DRIFT, (p - REEL_KNEE) / (1 - REEL_KNEE));
    /* tilt is linear across the whole runway, as measured; the approach only
       carries it from a slightly steeper lean into the measured -4 deg start */
    var tilt = mix(mix(-REEL_TILT - 1, -REEL_TILT, clamp(app, 0, 1)), 0, p) * (m ? .75 : 1);
    /* global settle plus a focus differential: the lit reel sits fractionally
       larger, which is what makes one read as nearer without any z movement */
    var shrink = mix(1.13, 1, q);
    var hand = easeIO(seg(q, .44, .54));         // the focus handoff beat
    var focusA = 1 - hand, focusB = hand;
    var sA = shrink * mix(.985, 1.015, focusA);
    var sB = shrink * mix(.985, 1.015, focusB);

    var unit = m ? 'vw' : 'vw';
    A.style.transform = 'translateX(' + (m ? x * .55 : x) + unit + ') rotate(' + tilt + 'deg) scale(' + sA + ')';
    B.style.transform = 'translateX(' + (m ? -x * .55 : -x) + unit + ') rotate(' + (-tilt) + 'deg) scale(' + sB + ')';
    A.style.filter = 'brightness(' + mix(.68, 1, focusA) + ')';
    B.style.filter = 'brightness(' + mix(.68, 1, focusB) + ')';
    A.style.zIndex = String(focusA >= focusB ? 3 : 2);
    B.style.zIndex = String(focusB > focusA ? 3 : 2);

    /* the centre column names the two films and follows the same handoff */
    var nA = $('.rc-a', sc.el), nB = $('.rc-b', sc.el);
    var fA = $('.rc-fa', sc.el), fB = $('.rc-fb', sc.el);
    if (nA) { nA.style.opacity = String(mix(.42, 1, focusA)); nA.classList.toggle('lit', focusA > .5); }
    if (nB) { nB.style.opacity = String(mix(.42, 1, focusB)); nB.classList.toggle('lit', focusB >= .5); }
    if (fA) fA.style.opacity = String(focusA);
    if (fB) fB.style.opacity = String(focusB);

    /* the one Lion-specific addition: the red Plane Thread rises as the axis the
       pair settles around, arriving with the handoff. Nothing else is layered on. */
    var th = $('.rc-thread', sc.el);
    var handOut = easeIO(seg(p, .93, 1));        // the bridge into the technology scene
    if (th) {
      var t = easeOut(seg(q, .30, .58));
      /* the thread comes FORWARD and dissolves into the cut rather than growing
         into a literal arrow over the copy */
      th.style.opacity = String(mix(t, 0, easeIO(seg(p, .94, 1))) * (handOut > 0 ? 1 : 1));
      th.style.transform = 'translateY(' + (mix(14, 0, t) - handOut * 34) + 'px) rotate('
        + mix(-14, 0, t) + 'deg) scale(' + mix(1, 2.1, handOut) + ')';
    }
    if (handOut > 0) {
      /* the pair recedes and dims as the plane comes forward — the reels are
         handing the frame to the digital surface, not simply ending */
      A.style.transform += ' scale(' + mix(1, .93, handOut) + ')';
      B.style.transform += ' scale(' + mix(1, .93, handOut) + ')';
      A.style.filter = 'brightness(' + mix(mix(.68, 1, focusA), .34, handOut) + ')';
      B.style.filter = 'brightness(' + mix(mix(.68, 1, focusB), .34, handOut) + ')';
      var cen = $('.reel-centre', sc.el);
      if (cen) { cen.style.opacity = String(1 - handOut * .85); }
    }
    beat(sc, 'com-head', app > .3 || p > .01);
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
  var DESK = { w: 1440, h: 4190 };   // CSS px the desktop strip represents (from the hero)
  var MOB = { w: 390, h: 4000 };
  var D_STOPS = [0, .26, .52, .80, 1];    // home · products · pricing · steps
  var M_STOPS = [0, .30, .60, .88];
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
    surf.style.clipPath = 'inset(0 ' + (50 - draw * 50) + '% 0 ' + (50 - draw * 50) + '%)';

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

    /* THE PAYOFF — the group frame opens out of the track to fill the viewport.
       It grows through .70-.88 and then HOLDS, so the full-screen moment is
       earned by the build-up rather than cut to. */
    var pay = $('.ph-payoff', sc.el);
    if (pay) {
      var g = easeIO(seg(p, .70, .88));
      pay.style.opacity = String(g);
      var inset = mix(26, 0, g);
      pay.style.clipPath = 'inset(' + inset + '% ' + inset + '% ' + inset + '% ' + inset + '%)';
      var im = $('img', pay);
      if (im) im.style.transform = 'scale(' + mix(1.12, 1, g) + ')';
      track.style.opacity = String(1 - easeIO(seg(p, .70, .79)));  // clear before the payoff lands
    }
    beat(sc, 'ph-open', app > .3 || p > .01);
  }

  /* ---------- S5 CINEMA — letterbox carries the title ---------- */
  function cinemaUpdate(p, sc, app) {
    var closeT = easeIO(seg(p, 0, .26));
    var releaseT = easeIO(seg(p, .92, 1));
    var barSvh = mix(0, 13, closeT) * (1 - releaseT);
    sc.el.style.setProperty('--barh', barSvh + 'svh');
    /* The title is light ink because it sits ON the black letterbox bar. When the
       bar collapses at the scene edges that same light ink lands on the cream
       field and vanishes — the exact invisible-title failure the founder caught
       once already. So the title's visibility is driven by the bar that carries
       it, never by a beat alone. */
    var title = $('.cin-title', sc.el);
    if (title) {
      var barPx = barSvh / 100 * innerHeight;
      var tH = title.offsetHeight || 46;
      title.style.opacity = String(clamp((barPx - tH * 0.62) / (tH * 0.5), 0, 1));
    }
    var strip = $('.strip', sc.el), peak = $('.peak', strip);
    var max = peak.offsetLeft - (strip.parentElement.clientWidth - peak.offsetWidth) / 2;
    strip.style.transform = 'translateX(' + (-easeIO(seg(p, .24, .84)) * Math.max(0, max)) + 'px)';
    beat(sc, 'cin-head', app > .5 || p > .10);
  }

  /* ---------- S6 STUDIO — "The Light-Up" ----------
     A warm key light travels down the five credit rows, DWELLING on each name
     rather than sweeping past it, then all five come up together. Focus is
     carried by light and weight only: no portrait is ever desaturated, blurred
     away or hidden, which is what made people look "missing" before. */
  var ST_N = 5;
  function studioUpdate(p, sc, app) {
    var pre = easeOutQ(clamp((app - .10) / .50, 0, 1));
    var key = $('.st-key', sc.el);
    var rows = $$('.st-row', sc.el);
    var plates = $$('.st-plate', sc.el);
    var narrow = innerWidth <= 1099;

    /* ACT 1 — the travelling light. A dwell warp holds the light on each name. */
    var a1 = seg(p, .10, .72);
    var warped = (function (t) {
      var x = t * ST_N, i = Math.floor(x), f = x - i;
      var held = f < .45 ? 0 : (f - .45) / .55;          // hold, then move on
      return Math.min(ST_N - .001, i + easeIO(held));
    })(a1);
    var assembly = easeIO(seg(p, .72, .88));
    var handoff = easeIO(seg(p, .90, 1));

    rows.forEach(function (row, i) {
      var arrive = easeOut(Math.max(pre, seg(p, .02 + i * .03, .18 + i * .03)));
      var d = Math.abs(warped - i);
      var travelLit = clamp(1 - d * 1.35, 0, 1);
      var lit = Math.max(travelLit, assembly);
      row.style.opacity = String(arrive * mix(.62, 1, lit));   // never below .62 — nobody vanishes
      row.style.transform = 'translateY(' + mix(16, 0, arrive) + 'px)';
      row.classList.toggle('lit', lit > .55);
    });

    if (key) {
      var kx = narrow ? mix(-24, 24, a1) : mix(-14, 10, a1);
      var ky = narrow ? 0 : mix(-26, 26, a1);
      key.style.opacity = String(mix(0, 1, Math.max(pre, seg(p, 0, .06))) * mix(1, .8, handoff));
      key.style.transform = 'translate3d(' + (kx + handoff * 16) + 'vw,' + ky + 'svh,0) scale('
        + mix(.86, 1, Math.max(pre, seg(p, 0, .10))) + ')';
    }

    /* the prints cross-fade to whoever the light is on; when nobody with a
       print is lit, the last print holds rather than leaving an empty column */
    if (!narrow) {
      var nearest = null, best = 1e9;
      plates.forEach(function (pl) {
        var idx = +pl.getAttribute('data-for');
        var d2 = Math.abs(warped - idx);
        if (d2 < best) { best = d2; nearest = pl; }
      });
      var litIdx = Math.min(ST_N - 1, Math.max(0, Math.round(warped)));  // never overruns the list
      plates.forEach(function (pl) {
        var on = +pl.getAttribute('data-for') === litIdx;
        var t = easeOut(Math.max(pre * .6, seg(p, .06, .20)));
        pl.style.opacity = String((on ? 1 : 0) * t * mix(1, .9, handoff));
        pl.style.transform = 'translateY(' + mix(18, 0, t) + 'px) scale(' + mix(.97, 1, t) + ')';
      });
    }

    var ghost = $('.st-ghost', sc.el);
    if (ghost) {
      var g = easeOut(Math.max(pre, seg(p, .02, .16)));
      ghost.style.opacity = String(g * mix(.5, .22, assembly));
      ghost.style.transform = 'translate(-50%,-50%) translateY(' + mix(-8, 8, a1) + 'svh) rotate('
        + mix(-6, 4, a1) + 'deg) scale(' + mix(.86, 1.04, g) + ')';
    }
    beat(sc, 'st-head', app > .25 || p > .01);
    beat(sc, 'st-line', p > .74);
  }

  /* ---------- S7 CONVERSION — "The Deck" ----------
     The plane arrives on approach, keeps a slow live drift the whole scene, and
     a raking gleam crosses it. Nothing here is static, which is the fix for
     "the white field feels dead". */
  function engageUpdate(p, sc, app) {
    var pre = easeOutQ(clamp((app - .12) / .60, 0, 1));
    var deck = $('.eng-deck', sc.el), gleam = $('.eng-gleam', sc.el);
    var frags = $$('.eng-frag', sc.el);
    var arrive = Math.max(pre, easeIO(seg(p, 0, .12)));

    /* the table stands in the room: it tilts up out of perspective and keeps a
       slow live drift, never resolving to a flat axis-aligned rectangle */
    var tilt = mix(9, 1.4, arrive) - p * 0.9;
    var lift = mix(7, 0, arrive) + mix(0, -1.6, p);
    var tf = 'translate(-50%,-50%) translateY(' + lift + 'svh) rotateX(' + tilt + 'deg) scale('
      + mix(.94, 1, arrive) + ')';
    if (deck) { deck.style.opacity = String(arrive); deck.style.transform = tf; }
    if (gleam) {
      gleam.style.opacity = String(clamp((Math.max(pre, p) - .10) / .45, 0, 1) * .5);
      gleam.style.transform = 'rotate(-20deg) translate3d(' + mix(-20, 150, Math.max(pre * .2, p)) + '%,0,0)';
    }

    /* the five projects drift in around the table and converge toward the CTA */
    var SEATS = [[-38, -26, -420], [-44, 24, -300], [40, -30, -380], [46, 20, -260], [2, 36, -520]];
    frags.forEach(function (fr, i) {
      var seat = SEATS[i] || SEATS[0];
      var t = easeOut(Math.max(pre - i * .06, seg(p, .06 + i * .05, .34 + i * .05)));
      var conv = easeIO(seg(p, .55, .95));            // converge toward the action
      var x = mix(seat[0], seat[0] * .42, conv);
      var y = mix(seat[1], seat[1] * .34 + 16, conv);
      var z = mix(seat[2], -140, conv);
      fr.style.opacity = String(t * mix(1, .55, conv));
      fr.style.left = (50 + x) + '%';
      fr.style.top = (50 + y) + '%';
      fr.style.transform = 'translate(-50%,-50%) translateZ(' + z + 'px) rotate('
        + mix(i % 2 ? 3 : -3, 0, t) + 'deg) scale(' + mix(.88, 1, t) + ')';
    });

    $$('.eng-head .ln i', sc.el).forEach(function (el, i) {
      var t = easeOut(Math.max(pre - i * .10, seg(p, .04 + i * .07, .24 + i * .07)));
      el.style.transform = 'translateY(' + mix(112, 0, clamp(t, 0, 1)) + '%)';
    });
    sc.el.style.setProperty('--axis', String(Math.max(pre * .16, easeIO(seg(p, .12, .52)))));

    beat(sc, 'eng-eyebrow', app > .34 || p > .02);
    beat(sc, 'eng-yours', p > .06);
    beat(sc, 'eng-sub', app > .70 || p > .04);
    beat(sc, 'eng-panel', app > .74 || p > .06);
    beat(sc, 'eng-answer', p > .22);
  }

  /* ---------- S8 FINALE — "The Aperture Closes" ----------
     Each blade flies home along ITS OWN centroid ray, computed from the
     canonical polygon geometry rather than hand-picked vectors, carrying the
     label of a scene the visitor has passed. The ground carries the cream of
     the conversion deck and changes to void as the mark seats. At p .42 every
     transform is written as the literal string 'none' so the resolved mark is
     exactly canonical — never a rounding error away from it. */
  var FIN_RAYS = null;
  function finRays(sc) {
    if (FIN_RAYS) return FIN_RAYS;
    FIN_RAYS = $$('.fin-mark polygon', sc.el).map(function (poly) {
      var pts = (poly.getAttribute('points') || '').trim().split(/\s+/).map(Number);
      var cx = 0, cy = 0, n = 0;
      for (var i = 0; i + 1 < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1]; n++; }
      cx = cx / n - 275; cy = cy / n - 275;            // 550x550 viewBox centre
      var d = Math.hypot(cx, cy) || 1;
      return [cx / d, cy / d];
    });
    return FIN_RAYS;
  }
  function finaleUpdate(p, sc, app) {
    var polys = $$('.fin-mark polygon', sc.el);
    var rays = finRays(sc);
    var core = $('.fin-core', sc.el);

    /* the close: begins on approach so the scene is never an empty frame */
    /* the approach carries only enough to avoid an empty frame; the rest of the
       flight happens ON SCREEN, or the arrival is never actually seen */
    var enter = clamp(app, 0, 1) * .22 + .78 * clamp(p / .42, 0, 1);
    var locked = p >= .42;

    polys.forEach(function (poly, i) {
      if (locked) { poly.style.transform = 'none'; poly.style.opacity = '1'; return; }
      var s0 = i * .055;
      var k = 1 - easeOut(clamp((enter - s0) / (1 - s0 - .06), 0, 1));
      var r = rays[i] || [0, 0];
      poly.style.transform = 'translate(' + (r[0] * 420 * k) + 'px,' + (r[1] * 420 * k) + 'px) scale('
        + mix(1, .78, k) + ')';
      poly.style.opacity = String(clamp(1 - k * 1.15, 0, 1));
    });

    if (core) {
      core.style.opacity = String(easeIO(seg(enter, .10, .70)) * (1 - easeIO(seg(p, .42, .52))) * .9);
      core.style.transform = 'scale(' + mix(1.85, .52, enter) + ')';
    }

    /* THE LIGHT CHANGE — the cream carried from the conversion deck burns off
       as the mark seats, and the mark's ink flips with it so it is never
       light-on-light or dark-on-dark for a single frame. */
    var gnd = 1 - easeIO(seg(p, .30, .44));
    sc.el.style.setProperty('--gnd', String(gnd));
    /* the stage fades UP as the cream burns off, so the mark lands somewhere */
    sc.el.style.setProperty('--stage-o', String(easeIO(seg(p, .34, .56))));
    sc.el.style.setProperty('--markink', gnd > .5 ? '#131315' : '#f7f6f3');

    $$('.fin-words i', sc.el).forEach(function (el, i) {
      var s0 = .50 + i * .06;
      el.style.transform = 'translateY(' + mix(110, 0, easeOut(seg(p, s0, s0 + .14))) + '%)';
    });
    sc.el.style.setProperty('--seam', String(easeIO(seg(p, .58, .92))));
    sc.el.style.setProperty('--gate', String(easeIO(seg(p, .78, .90)) * .0));  // fill only on hover

    beat(sc, 'fin-act', p > .74);
    beat(sc, 'fin-imprint', p > .84);
  }

  /* ---------- engine loop ---------- */
  function engine() {
    if (!cinematic) return;
    addScene('hero', heroUpdate, '3.4');
    addScene('commercial', commercialUpdate, '2.4');
    addScene('tech', techUpdate, '3.2');
    addScene('photo', photoUpdate, '3.0');
    addScene('cinema', cinemaUpdate, '1.8');
    addScene('studio', studioUpdate, '2.4');
    addScene('engage', engageUpdate, '1.8');
    addScene('finale', finaleUpdate, '2.6');

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

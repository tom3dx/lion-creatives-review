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
        /* Fall back to the TRIGGER, not to whatever was focused at open time.
           WebKit does not focus a <button> on click, so that capture is <body>
           and a keyboard user loses their place entirely when the menu closes. */
        var prev = document.activeElement;
        lastFocus = (prev && prev !== document.body && prev !== document.documentElement)
          ? prev : open;
        var f = m.querySelector('a,button'); if (f) f.focus();
      } else {
        m.setAttribute('inert', ''); m.setAttribute('aria-hidden', 'true');
        (lastFocus || open).focus();
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
    function tryPlay(v) {
      if (document.documentElement.getAttribute('data-motion') === 'paused') return;
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) tryPlay(v);
        else v.pause();
      });
    }, { threshold: 0.25 });
    /* The HERO film gets its own observer: it must survive the aperture ->
       cinema -> split choreography untouched (§4), so it pauses only when the
       whole sequence is a full viewport away, and its playback session is never
       reset — one element, one timeline, no poster swap. */
    var heroIO = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) tryPlay(en.target); else en.target.pause();
      });
    }, { rootMargin: '100% 0px 100% 0px', threshold: 0 });
    vids.forEach(function (v) {
      v.muted = true;
      if (v.hasAttribute('data-hero')) heroIO.observe(v); else io.observe(v);
    });
    /* Autoplay resilience (§5): some Chrome configurations defer fetch or
       reject the first play() even when muted. Kick again on readiness, retry
       briefly, and take the first user gesture as a last resort — silently. */
    var hv = $('video[data-hero]');
    if (hv) {
      tryPlay(hv);
      hv.addEventListener('loadeddata', function () { tryPlay(hv); }, { once: true });
      hv.addEventListener('canplaythrough', function () { tryPlay(hv); }, { once: true });
      var tries = 0;
      var iv = setInterval(function () {
        if (!hv.paused || ++tries > 10) { clearInterval(iv); return; }
        tryPlay(hv);
      }, 700);
      ['pointerdown', 'keydown', 'touchstart'].forEach(function (t) {
        addEventListener(t, function () { if (hv.paused) tryPlay(hv); }, { once: true, passive: true });
      });
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { vids.forEach(function (v) { v.pause(); }); return; }
      if (document.documentElement.getAttribute('data-motion') === 'paused') return;
      vids.forEach(function (v) {
        var r = v.getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      });
    });
  }

  /* ---------- DUNAMIS TYPEWRITER ----------
     The live site's measured cadence: 70ms per typed character, 1600ms hold on
     a completed word, 35ms per deleted character, 400ms before the next word.
     Words confirmed from the live page. Runs only while a mirror band is on
     screen and motion is running; the editorial edition shows the completed
     word statically. */
  function dunTypewriter() {
    if (!cinematic) return;
    var spans = $$('.dl-typed');
    if (!spans.length) return;
    var WORDS = ['domain.', 'name.', 'brand.', 'future.'];
    var wi = 0, ci = 0, del = false;
    function setAll(t) { for (var i = 0; i < spans.length; i++) spans[i].textContent = t; }
    function tick() {
      if (!document.querySelector('.dun-live.run') || document.hidden) {
        setTimeout(tick, 500); return;
      }
      var word = WORDS[wi];
      if (!del) {
        ci++; setAll(word.slice(0, ci));
        if (ci >= word.length) { del = true; setTimeout(tick, 1600); }
        else setTimeout(tick, 70);
      } else {
        ci--; setAll(word.slice(0, ci));
        if (ci <= 0) { del = false; wi = (wi + 1) % WORDS.length; setTimeout(tick, 400); }
        else setTimeout(tick, 35);
      }
    }
    setAll(''); ci = 0; tick();
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
  /* querySelector (singular) was the bug: a beat name used on more than one
     element only ever revealed the FIRST of them, and every sibling stayed at
     the [data-beat] default of opacity 0. Silent, and invisible in review
     precisely because the missing content leaves no trace. */
  function beat(scene, name, on) {
    var els = scene.el.querySelectorAll('[data-beat="' + name + '"]');
    for (var i = 0; i < els.length; i++) els[i].classList.toggle('on', on);
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
  /* phones: the aperture holds the UPPER half and the words hold the lower —
     the V10 layout ran the whole text block across the bride's face (§47) */
  var HERO_S1M = [[46,12],[72,8],[98,16],[98,50],[72,56],[46,52]];
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
    var S1 = mobile ? HERO_S1M : HERO_S1;
    var poly = toLeft > 0 ? lerpPoly(HERO_S2, mobile ? HERO_S2 : HERO_S3, toLeft)
                          : lerpPoly(S1, HERO_S2, toFull);
    film.style.clipPath = poly;

    /* the film scales up into the cinema state and eases back for the panel.
       width:100% + height:auto keeps its native 2.22:1 — letterboxed, never cropped
       and never upscaled (1600w source shown at 1440 = 0.9x).
       STATE 3: the media also translates LEFT with the closing clip, so the
       subject physically moves into the left panel — the black that used to eat
       the frame from the right was the founder's §9 rejection. */
    if (media) {
      var s1 = mix(1.22, 1, toFull);            // slightly in at rest, true size full-width
      var s3 = mix(1, mobile ? 1.35 : 1.9, toLeft); // fills the panel (crops a little on phones)
      var dx = mobile ? 0 : mix(0, -24, toLeft); // vw — recenters the couple at 26vw
      media.style.transform = 'translate(-50%,-50%) translateX(' + dx + 'vw) scale(' + (s1 * s3) + ')';
    }

    /* the opening statement leaves before the cinema state, so nothing is over
       the picture while it plays */
    var out = easeIO(seg(p, .12, .26));
    say.style.opacity = String(1 - out);
    say.style.transform = 'translateY(' + (-out * 12) + 'svh)';
    say.style.pointerEvents = out > .5 ? 'none' : 'auto';

    /* The project SURFACE rides the clip: its left edge and the film's right
       edge are the same number, so there is never black between them and never
       a covered frame. The copy inside staggers once the surface has landed. */
    var clipRight = mix(100, 52, toLeft);        // the film's trailing edge, in vw
    var inner = $('.hero-id-inner', id);
    if (mobile) {
      var innM = easeOut(seg(p, .64, .80));
      id.style.transform = 'none';
      id.style.opacity = String(innM);
      if (inner) { inner.style.opacity = String(innM); inner.style.transform = 'translateY(' + mix(26, 0, innM) + 'px)'; }
      id.style.pointerEvents = innM > .5 ? 'auto' : 'none';
    } else {
      id.style.opacity = '1';
      id.style.transform = 'translateX(' + (clipRight - 52) + 'vw)';
      var inn = easeOut(seg(p, .72, .86));
      if (inner) { inner.style.opacity = String(inn); inner.style.transform = 'translateY(' + mix(26, 0, inn) + 'px)'; }
      id.style.pointerEvents = toLeft > .9 ? 'auto' : 'none';
    }
  }
  /* The V10 build shifted the aperture polygon with the cursor here. The founder
     rejected the wobble (V11 §1): the aperture must be spatially stable — the
     film itself provides the motion. The listener is gone, not damped. */

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
    /* sequenced, not crossfaded: at the midpoint both used to sit at ~50%
       opacity on top of each other — unreadable type soup frozen (§45) */
    if (fA) fA.style.opacity = String(clamp((focusA - .5) * 2.2, 0, 1));
    if (fB) fB.style.opacity = String(clamp((focusB - .5) * 2.2, 0, 1));

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

    /* the live hero mirrors ride their captures exactly: same width, same
       translate, same paint state — so the hero pixels are simply replaced by
       the same hero, alive. Animations only run while the band is the one on
       screen (§49). */
    var LD = $('.dun-live-d', sc.el), LM = $('.dun-live-m', sc.el);
    var motionOn = document.documentElement.getAttribute('data-motion') !== 'paused';
    if (LD) {
      LD.style.width = wide + 'px';
      LD.style.setProperty('--s', (wide / 1440).toFixed(4));
      LD.style.transform = D.style.transform;
      LD.style.opacity = String((1 - paintOut) * render);
      LD.classList.toggle('run', motionOn && app > .02 && paintOut < .5);
    }
    if (LM) {
      LM.style.width = narrow + 'px';
      LM.style.left = Math.round((W - narrow) / 2) + 'px';
      LM.style.setProperty('--sm', (narrow / 390).toFixed(4));
      LM.style.transform = M.style.transform;
      LM.style.opacity = String(paintIn);
      LM.classList.toggle('run', motionOn && paintIn > .5);
    }

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

    /* THE PAYOFF (V11 §21) — a camera push INTO the group frame. The plate is
       FLIP-matched to the in-track figure's live rect each frame, then expands
       continuously to the full viewport while the camera leans in and the rest
       of the track recedes. Uniform scale + vertical clip only — the aspect is
       never stretched. */
    var pay = $('.ph-payoff', sc.el);
    var gfig = $('.pt-fig.hero-wide', sc.el);
    if (pay && gfig) {
      var g = easeIO(seg(p, .66, .90));
      if (g <= 0) {
        pay.style.opacity = '0';
        track.style.transform = 'translateX(' + (-t * total) + 'px)';
      } else {
        var vw = innerWidth, vh = innerHeight;
        /* the IMG rect, not the figure — the figure includes its caption */
        var r = ($('img', gfig) || gfig).getBoundingClientRect();
        var s = mix(r.width / vw, 1, g);
        var cx = mix(r.left + r.width / 2, vw / 2, g);
        var cy = mix(r.top + r.height / 2, vh / 2, g);
        var scaledH = vh * s;
        var insetY = Math.max(0, (scaledH - mix(r.height, vh, g)) / 2 / scaledH * 100);
        pay.style.opacity = '1';
        pay.style.transform = 'translate(' + (cx - vw / 2).toFixed(1) + 'px,'
          + (cy - vh / 2).toFixed(1) + 'px) scale(' + s.toFixed(4) + ')';
        pay.style.clipPath = 'inset(' + insetY.toFixed(2) + '% 0 ' + insetY.toFixed(2) + '% 0)';
        var im = $('img', pay);
        if (im) im.style.transform = 'scale(' + mix(1.07, 1, g) + ')';
        /* the camera leans toward the group frame; everything else recedes */
        track.style.transformOrigin = (gfig.offsetLeft + gfig.offsetWidth / 2) + 'px 50%';
        track.style.transform = 'translateX(' + (-t * total) + 'px) scale(' + mix(1, .96, g) + ')';
        track.style.opacity = String(mix(1, .22, easeIO(clamp((g - .45) / .55, 0, 1))));
      }
      if (g <= 0) track.style.opacity = '1';
    }
    beat(sc, 'ph-open', app > .3 || p > .01);
  }

  /* ---------- S5 CINEMA — "The Edit" ----------
     Scroll advances a six-cut edit of one couple's real day. Bars close first
     and size themselves so the 20:9 frame sits exactly between them; each cut
     arrives through a diagonal blade wipe whose easing is baked into the
     scroll mapping (hard-scrubbed, Apple-style); every cut keeps a slow live
     settle so no frame ever sits dead. All type lives ON the bars. */
  function cinemaUpdate(p, sc, app) {
    var h = innerHeight, w = innerWidth;
    var closeT = easeIO(Math.max(seg(p, 0, .12), clamp((app - .55) / .45, 0, 1) * .85));
    var target = Math.max(h * .07, (h - w * .45) / 2);
    var barPx = target * closeT;
    sc.el.style.setProperty('--barh', barPx.toFixed(1) + 'px');
    sc.el.style.setProperty('--cinui', String(clamp((barPx - 34) / 26, 0, 1)));

    var cuts = $$('.cut', sc.el);
    var N = cuts.length;
    if (!N) return;
    /* cut-space position: 0..N across the active band of the runway */
    var x = clamp((p - .10) / (.96 - .10), 0, 1) * N;
    sc.el.style.setProperty('--cinp', String(clamp(x / N, 0, 1)));
    var SLANT = 12;
    cuts.forEach(function (c, i) {
      var wi = i === 0 ? 1 : easeIO(clamp((x - i) / .30, 0, 1));
      var dir = i % 2 ? -1 : 1;
      if (wi >= 1) c.style.clipPath = 'none';
      else if (wi <= 0) c.style.clipPath = dir > 0
        ? 'polygon(0 0,0 0,0 100%,0 100%)'
        : 'polygon(100% 0,100% 0,100% 100%,100% 100%)';
      else {
        var e = mix(-16, 116, wi);
        c.style.clipPath = dir > 0
          ? 'polygon(0 0,' + (e + SLANT) + '% 0,' + (e - SLANT) + '% 100%,0 100%)'
          : 'polygon(' + (100 - e - SLANT) + '% 0,100% 0,100% 100%,' + (100 - e + SLANT) + '% 100%)';
      }
      /* paint only the active neighbourhood; the live settle keeps it breathing */
      var active = x > i - .25 && x < i + 1.55;
      c.style.visibility = (active || (i === 0 && x < 1.55)) ? 'visible' : 'hidden';
      c.style.zIndex = String(2 + i);
      var m = c.firstElementChild;
      if (m) {
        var local = clamp(x - i, 0, 1.4);
        m.style.transform = 'translate(-50%,-50%) scale(' + mix(1.05, 1, easeOut(clamp(local, 0, 1))) + ')';
        if (m.tagName === 'VIDEO') {
          var motionOK = document.documentElement.getAttribute('data-motion') !== 'paused';
          if (active && motionOK && m.paused) { var pr = m.play(); if (pr && pr.catch) pr.catch(function () {}); }
          else if (!active) m.pause();
        }
      }
    });

    var slates = $$('.slate', sc.el);
    slates.forEach(function (s2, i) {
      /* centred on the settled dwell (the wipe completes at i+.30), so the
         slate never names a frame that is not yet on screen */
      var o = clamp(1 - (Math.abs(x - (i + .66)) - .30) / .12, 0, 1);
      if (i === 0 && x < .66) o = 1;
      if (i === slates.length - 1 && x > i + .66) o = 1;
      s2.style.opacity = String(o);
    });
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
    var a1 = seg(p, .10, .78);
    var warped = (function (t) {
      var x = t * ST_N, i = Math.floor(x), f = x - i;
      var held = f < .45 ? 0 : (f - .45) / .55;          // hold, then move on
      return Math.min(ST_N - .001, i + easeIO(held));
    })(a1);
    var assembly = easeIO(seg(p, .78, .90));
    var handoff = easeIO(seg(p, .92, 1));

    rows.forEach(function (row, i) {
      var arrive = easeOut(Math.max(pre, seg(p, .02 + i * .03, .18 + i * .03)));
      var d = Math.abs(warped - i);
      var travelLit = clamp(1 - d * 1.15, 0, 1);
      var lit = Math.max(travelLit, assembly);
      row.style.opacity = String(arrive * mix(.62, 1, lit));   // never below .62 — nobody vanishes
      row.style.transform = 'translateY(' + mix(16, 0, arrive) + 'px)';
      row.classList.toggle('lit', lit > .5);
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
        pl.style.transform = 'translateY(' + mix(18, 0, t) + 'px) scale('
          + (mix(.97, 1, t) * (on ? 1.03 : 1)) + ')';
      });
    }

    /* the environment answers the light: a giant index numeral far behind the
       list crossfades with the lit member, and the warm floor pool slides to
       sit under whoever is named. */
    var echoes = $$('.st-echo i', sc.el);
    echoes.forEach(function (el, i) {
      var d3 = Math.abs(warped - i);
      var o = clamp(1 - d3 * 1.15, 0, 1) * mix(1, .45, assembly);
      el.style.opacity = String(o);
      el.style.transform = 'translateY(' + mix(34, -34, clamp((warped - i + 1) / 2, 0, 1)) + 'px)';
    });
    var pool = $('.st-pool', sc.el);
    if (pool) {
      pool.style.opacity = String(Math.max(pre, easeIO(seg(p, 0, .10))) * .95);
      pool.style.left = (narrow ? 50 : mix(30, 58, a1)) + '%';
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

  /* ---------- S7 CONVERSION — "The Convergence" ----------
     The five projects fly out of depth, align along the thread's axis and are
     absorbed into the red line; the ask then sets around that line. The frag
     targets are read from the thread's LIVE rect, so the convergence lands
     exactly on the typography at any viewport. */
  function engageUpdate(p, sc, app) {
    var pre = easeOutQ(clamp((app - .12) / .60, 0, 1));
    var frags = $$('.cv-frag', sc.el);
    var thread = $('.cv-thread', sc.el);
    var room = Math.max(pre, easeIO(seg(p, 0, .10)));
    sc.el.style.setProperty('--room', String(room));

    var vw = innerWidth, vh = innerHeight;
    var tr = thread ? thread.getBoundingClientRect() : null;
    var tcx = tr ? tr.left + tr.width / 2 - vw / 2 : 0;
    var tcy = tr ? tr.top + tr.height / 2 - vh / 2 : 0;
    if (tr) sc.el.style.setProperty('--hzy', ((tr.top + tr.height / 2) / vh * 100).toFixed(2) + '%');

    var absorb = easeIO(seg(p, .34, .46));
    sc.el.style.setProperty('--cvt', String(absorb));

    var SEATS = [[-34, -30], [36, -26], [-38, 22], [40, 18], [0, 34]];   /* vw · svh from centre */
    var slotGap = Math.min(vw * .085, 130);
    frags.forEach(function (fr, i) {
      var seat = SEATS[i] || SEATS[0];
      var t = easeIO(Math.max(pre * .5, seg(p, .03 + i * .04, .30 + i * .04)));
      var arrive = easeOut(Math.max(pre, seg(p, .02 + i * .04, .12 + i * .04)));
      var x = mix(seat[0] * vw / 100, tcx + (i - 2) * slotGap, t);
      var y = mix(seat[1] * vh / 100, tcy, t);
      fr.style.opacity = String(arrive * (1 - absorb));
      fr.style.transform = 'translate(-50%,-50%) translate(' + x.toFixed(1) + 'px,' + y.toFixed(1)
        + 'px) rotate(' + mix(i % 2 ? 4 : -4, 0, t) + 'deg) scale(' + mix(1.22, .34, t)
        + ') scaleY(' + mix(1, .08, absorb) + ')';
    });

    $$('.cv-head .ln i', sc.el).forEach(function (el, i) {
      var t = easeOut(seg(p, .38 + i * .08, .54 + i * .08));
      el.style.transform = 'translateY(' + mix(112, 0, clamp(t, 0, 1)) + '%)';
    });

    beat(sc, 'cv-eyebrow', p > .34);
    beat(sc, 'cv-yours', p > .56);
    beat(sc, 'cv-sub', p > .54);
    beat(sc, 'cv-panel', p > .62);
    beat(sc, 'cv-meta', p > .72);
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
    FIN_RAYS = $$('.fin-mark > svg polygon', sc.el).map(function (poly) {
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
    var polys = $$('.fin-mark > svg polygon', sc.el);
    var rays = finRays(sc);
    var core = $('.fin-core', sc.el);
    var stage = $('.fin-stage', sc.el);
    var reflect = $('.fin-reflect', sc.el);

    /* §42 sequencing: the ENVIRONMENT first — the dark stage is standing before
       any plane arrives, so the flight happens somewhere, not on a void. */
    sc.el.style.setProperty('--stage-o',
      String(easeIO(Math.max(clamp(app * 1.1, 0, 1) * .9, seg(p, 0, .12)))));
    if (stage) stage.style.transform = 'translateY(' + mix(2.5, -1.5, easeIO(p)).toFixed(2)
      + 'svh) scale(' + mix(1.05, 1, easeIO(clamp(p * 1.6, 0, 1))).toFixed(3) + ')';

    var enter = clamp(app, 0, 1) * .32 + .68 * clamp(p / .44, 0, 1);
    var locked = p >= .44;

    polys.forEach(function (poly, i) {
      if (locked) { poly.style.transform = 'none'; poly.style.opacity = '1'; return; }
      var s0 = i * .055;
      var k = 1 - easeOut(clamp((enter - s0) / (1 - s0 - .06), 0, 1));
      var r = rays[i] || [0, 0];
      poly.style.transform = 'translate(' + (r[0] * 420 * k) + 'px,' + (r[1] * 420 * k) + 'px) scale('
        + mix(1, .78, k) + ')';
      poly.style.opacity = String(Math.pow(clamp(1 - k, 0, 1), .65));
    });

    /* each plane carries the name of the thread it stood for (§41); the tags
       ride the same rays and retire before the lock */
    $$('.fin-tag', sc.el).forEach(function (tag, i) {
      var s0 = i * .055;
      var k = 1 - easeOut(clamp((enter - s0) / (1 - s0 - .06), 0, 1));
      var r = rays[i] || [0, 0];
      var o = locked ? 0 : clamp(k * 1.35, 0, 1) * clamp((1 - k) * 6, 0, 1);
      tag.style.opacity = String(o * .9);
      tag.style.transform = 'translate(-50%,-50%) translate(' + (r[0] * 460 * k) + 'px,'
        + (r[1] * 460 * k + 16) + 'px)';
    });

    if (core) {
      core.style.opacity = String(easeIO(seg(enter, .25, .75)) * (1 - easeIO(seg(p, .44, .54))) * .4);
      core.style.transform = 'scale(' + mix(1.6, .6, enter) + ')';
    }
    if (reflect) reflect.style.opacity = String(.08 * easeIO(seg(p, .40, .54)));

    $$('.fin-words i', sc.el).forEach(function (el, i) {
      var s0 = .54 + i * .06;
      el.style.transform = 'translateY(' + mix(110, 0, easeOut(seg(p, s0, s0 + .14))) + '%)';
    });
    sc.el.style.setProperty('--seam', String(easeIO(seg(p, .62, .92))));

    beat(sc, 'fin-act', p > .76);
    beat(sc, 'fin-imprint', p > .86);
  }

  /* ---------- engine loop ---------- */
  function engine() {
    if (!cinematic) return;
    addScene('hero', heroUpdate, '3.4');
    addScene('commercial', commercialUpdate, '2.4');
    addScene('tech', techUpdate, '3.2');
    addScene('photo', photoUpdate, '3.0');
    addScene('cinema', cinemaUpdate, '3.0');
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
    safeZone(); loader(); nav(); video(); motionToggle(); dunTypewriter();
    engine();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

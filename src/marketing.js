/* ==========================================================================
   YOTEWO — marketing.js
   Slater › JS tab. Paste without <script> tags.

   Design and development: Rattlesnake Group (rsnake.co.uk).
   Sections 1-15 follow the Rattlesnake Group marketing.js base; 16 and 17
   are reusable UI components. House rules:
   - One init function per component, all called from the single entry point
     at the bottom. Nothing runs on import.
   - Every init is a no-op when its markup is absent, so this file is safe to
     load site-wide.
   - Components are found by data-attribute, not by class, so renaming a
     class in Designer cannot break a script.

   Dependencies, loaded before this file
     GSAP 3 + ScrollTrigger   odometer (4), tabs (16), logo wall (17)
     Swiper 11                slider (6)
   Everything else is plain DOM.

   Contents
     1.  Utilities
     2.  Accordion         [data-acc]
     4.  Odometer          [data-odometer-group]
     6.  Swiper            [data-swiper-group]
     10. Reveal            [data-reveal]   retired, replaced by 24
     12. Clamp             [data-clamp]
     13. Underline         [data-underline="through"]
     14. Sticky CTA        [data-sticky]
     15. Accordion media   [data-acc-media]
     16. Tabs with visual  [data-tabs="wrapper"]
     17. Logo wall cycle   [data-logo-wall-cycle-init]
     18. Entry point
     19. Background FX     [data-aurora] [data-code-bg]
     20. Logo marquee      [data-logo-marquee]
     21. Header            .header [data-burger] [data-dropdown]
     23. Button text roll  a.button a.button-text [data-btn-roll]
     24. Reveal groups     .section .container [data-reveal-group]
     25. Glow background   [data-glow-bg]
     26. Full rows         [data-full-rows]
     27. Logo wall swap    [data-logo-wall]
     28. Segmented control [data-seg] .div-seg
     29. Process steps     [data-process]   scroll-driven, sticky media
     30. Table of contents [data-toc]
     31. Video popup       [data-yt-popup]
     32. Video player      [data-yt-player]
     33. Hire orbit        [data-orbit-layer]
     34. Marquee fill      [data-logo-marquee]
     35. Cal.com + login   "Book a call" popup, "Log in" to the app
     51. Cover image sizes img[srcset] object-fit: cover (sharp heroes)
     52. Role drum         .grid-vet-examples .vet-example_media (/vetting)
     53. Live widgets      img[src*="ill-"], *-stage-*-t: HTML/CSS mockups over the glow (lw-*)
   21-35 moved here from page and component embeds (October 2026). Their
   CSS stays in Webflow: classes, or the Global Styles / component embeds
   for state rules classes cannot express.
   Numbering follows the Rattlesnake file so the two can be diffed.
   ========================================================================== */


/* ==========================================================================
   1. UTILITIES
   ========================================================================== */

/* Runs fn now if the document is already parsed, otherwise on DOMContentLoaded.
   Slater can inject this file after the event has fired; a bare listener would
   then never run. */
function onReady(fn) {
  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", fn)
    : fn();
}

const HAS_GSAP = typeof window.gsap !== "undefined";

/* Guarded: if the GSAP bundle fails to load, only the GSAP-driven components
   go quiet. Registering unguarded at the top of the file would throw and take
   the Swipers and the accordion down with it. */
if (HAS_GSAP) {
  if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
}

/* One read for the whole file. The accordion, the odometer and both charts
   all need it, and matchMedia is not free. */
const PREFERS_STILL = !!(window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches);

/* Solves a damped harmonic oscillator and prints it as a CSS linear()
   easing. The browser then animates it natively — no rAF loop, no library. */
function rsSpring(stiffness, damping, mass, samples) {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const wd = zeta < 1 ? w0 * Math.sqrt(1 - zeta * zeta) : 0;

  function at(t) {
    if (zeta < 1) {
      return 1 - Math.exp(-zeta * w0 * t) *
        (Math.cos(wd * t) + (zeta * w0 / wd) * Math.sin(wd * t));
    }
    return 1 - (1 + w0 * t) * Math.exp(-w0 * t);   /* critically damped */
  }

  let dur = 0.05;
  while (dur < 3 && Math.abs(1 - at(dur)) > 0.001) dur += 0.01;

  const pts = [];
  for (let i = 0; i <= samples; i++) pts.push(+at(i / samples * dur).toFixed(4));
  /* Pin the last sample to exactly 1. A curve that stops at 0.9998 leaves a
     residual the browser settles in a single frame, which reads as a snap. */
  pts[pts.length - 1] = 1;
  return { easing: "linear(" + pts.join(",") + ")", duration: Math.round(dur * 1000) };
}


/* Two frames, not one. A style set in the same frame as the element is
   appended is folded into the initial computed style and never transitions;
   the first frame commits the start value, the second starts the run. */
function nextFrames(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

/* Motion gate (17 Nov 2026, page speed). Continuous canvas and WebGL loops
   (hero aurora, glow panels, code glyphs, hire orbit, face arc) start on the
   visitor's first interaction: pointer move, scroll, wheel, touch or key.
   Until then each effect shows its first frame, so the first seconds of a
   load go to content. softGL(): software WebGL (SwiftShader, llvmpipe, no
   GPU) keeps the first frame only, it is too slow to animate. */
var MOTION = { on: false, q: [] };
function whenMotion(fn) { if (MOTION.on) fn(); else MOTION.q.push(fn); }
(function () {
  var ev = ["pointermove", "pointerdown", "scroll", "wheel", "touchstart", "keydown"];
  function go() {
    if (MOTION.on) return;
    MOTION.on = true;
    ev.forEach(function (e) { window.removeEventListener(e, go, true); });
    MOTION.q.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
  }
  ev.forEach(function (e) { window.addEventListener(e, go, { passive: true, capture: true }); });
})();
function softGL(gl) {
  try {
    var x = gl.getExtension("WEBGL_debug_renderer_info");
    var r = x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(String(r));
  } catch (e) { return false; }
}

/* Has the page stopped arriving?

   False for the first moments after init, true from then on. Entrance
   animations read it to decide between playing and simply being there, because
   an entrance is a way of saying "this has just arrived" and nothing has
   arrived while the page itself is still landing.

   The flag exists because a viewport test at init time is not enough on its
   own. Scripts run at DOMContentLoaded, and the browser restores a remembered
   scroll position at its own moment, which in Chrome is usually after that. So
   a block measured off-screen during init can be dead centre a few frames
   later, and an observer created in between fires at once. That is the whole
   mechanism behind a mid-page refresh replaying half a page of animations.

   Flipped by whichever comes first: the page finishing load, a real scroll
   gesture from the reader, or a one-second ceiling so a stalled image cannot
   leave the page permanently unwilling to animate. */
let PAGE_SETTLED = false;
(function () {
  const settle = () => { PAGE_SETTLED = true; };
  const soon = () => nextFrames(settle);

  if (document.readyState === "complete") soon();
  else window.addEventListener("load", soon, { once: true });

  /* Deliberately the input events, not "scroll": scroll restoration fires a
     scroll event, and treating that as the reader having scrolled would defeat
     the point. Wheel, touch and keys are the reader. */
  ["wheel", "touchmove", "keydown", "pointerdown"].forEach((t) => {
    window.addEventListener(t, settle, { once: true, passive: true });
  });

  setTimeout(settle, 1000);
})();


/* ==========================================================================
   2. ACCORDION  [data-acc]
   --------------------------------------------------------------------------
   Markup contract
     [data-acc]           wrapper. Space-separated flags: multi first merge debug
     [data-acc-item]      one row
     [data-acc-head]      the click target
     [data-acc-body]      the collapsing panel

   Tuning attributes on the wrapper
     data-acc-gap     px of separation around an open item      (default 10)
     data-acc-radius  outer corner radius of the group          (default 16)
     data-acc-inner   corner radius between merged items        (default 4)
     data-acc-spring  "stiffness,damping" for the motion curve  (default 340,37)
     data-acc-ease    explicit easing, overrides the spring
     data-acc-dur     explicit duration in ms, overrides the spring

   No GSAP. Motion is handed to the browser as a CSS transition, so it runs on
   the compositor rather than a per-frame JS loop.
   ========================================================================== */
function initAccordion() {
  const REDUCED = PREFERS_STILL;
  const HAS_LINEAR = !!(window.CSS && CSS.supports &&
    CSS.supports("transition-timing-function", "linear(0,1)"));

  function init(wrap) {
    if (wrap.__accReady) return;
    wrap.__accReady = true;

    const flags = (wrap.getAttribute("data-acc") || "").split(/\s+/);
    const MULTI = flags.indexOf("multi") > -1;   /* allow several open at once */
    const FIRST = flags.indexOf("first") > -1;   /* open item 1 on load        */
    const MERGE = flags.indexOf("merge") > -1;   /* closed items form one card */

    const num = (name, dflt) => {
      const v = parseFloat(wrap.getAttribute(name));
      return isNaN(v) ? dflt : v;
    };
    const GAP = num("data-acc-gap", 10);
    const RADIUS = num("data-acc-radius", 16);
    const INNER = num("data-acc-inner", 4);

    /* Hovering one row fades the others. The CSS gates this behind a real
       pointer; here we only publish how far it fades. */
    wrap.style.setProperty("--acc-dim", num("data-acc-dim", 0.4));

    /* Default damping is critical: spring-like movement with no overshoot.
       Pass data-acc-spring="190,17" to get the bounce back. */
    const sp = (wrap.getAttribute("data-acc-spring") || "340,37").split(",");
    const S = rsSpring(parseFloat(sp[0]) || 340, parseFloat(sp[1]) || 37, 1, 48);

    let EASE = (!REDUCED && HAS_LINEAR) ? S.easing : "cubic-bezier(.32,.72,0,1)";
    let DUR = (!REDUCED && HAS_LINEAR) ? S.duration : 500;

    const customEase = wrap.getAttribute("data-acc-ease");
    const customDur = parseFloat(wrap.getAttribute("data-acc-dur"));
    if (customEase) EASE = customEase;
    if (!isNaN(customDur)) DUR = customDur;

    /* Published for the CSS tab: the chevron and the content fade read these. */
    wrap.style.setProperty("--acc-spring", EASE);
    wrap.style.setProperty("--acc-dur", DUR + "ms");

    /* Direct children only, so a nested accordion is not adopted by its parent. */
    const items = Array.prototype.filter.call(
      wrap.querySelectorAll("[data-acc-item]"),
      (it) => it.closest("[data-acc]") === wrap
    );
    if (!items.length) return;

    items.forEach((it) => {
      const body = it.querySelector("[data-acc-body]");
      if (body) body.style.transition = "height " + DUR + "ms " + EASE;
      if (MERGE) {
        /* Opacity rides along because this inline shorthand replaces the one
           the CSS tab sets, and the sibling dim would otherwise jump. Its
           duration stays a variable so the dim keeps its slow-in, quick-out. */
        it.style.transition = "margin-top " + DUR + "ms " + EASE +
          ", border-radius " + DUR + "ms " + EASE +
          ", opacity var(--acc-dim-t, 300ms) var(--ease-out-quint, ease)";
      }
    });

    const isOpen = (i) => !!items[i] && items[i].dataset.accOpen === "true";

    /* Anything sitting between two items — usually a Designer spacer. When
       present the gap is driven through the spacer's height, because a
       negative margin on the item cannot pull past it. */
    function spacersAfter(i) {
      const out = [];
      let n = items[i] && items[i].nextElementSibling;
      while (n && n !== items[i + 1]) {
        if (!n.hasAttribute("data-acc-item")) out.push(n);
        n = n.nextElementSibling;
      }
      return out;
    }
    const SPACERS = items.map((_, i) => spacersAfter(i));

    if (MERGE) {
      SPACERS.forEach((list) => list.forEach((sp) => {
        sp.style.transition = "height " + DUR + "ms " + EASE;
        sp.style.overflow = "hidden";
      }));
    }

    /* Group geometry.
       Closed items sit flush and read as a single card: only the outer corners
       of the group are rounded. An open item detaches with a gap above and
       below and rounds all four of its own corners. */
    function geometry() {
      if (!MERGE) return;
      const last = items.length - 1;

      items.forEach((it, i) => {
        const topRound = i === 0 || isOpen(i) || isOpen(i - 1);
        const botRound = i === last || isOpen(i) || isOpen(i + 1);
        const detach = i > 0 && (isOpen(i) || isOpen(i - 1));

        it.style.borderTopLeftRadius = it.style.borderTopRightRadius =
          (topRound ? RADIUS : INNER) + "px";
        it.style.borderBottomLeftRadius = it.style.borderBottomRightRadius =
          (botRound ? RADIUS : INNER) + "px";

        const sp = SPACERS[i - 1] || [];
        if (sp.length) {
          sp.forEach((e, k) => { e.style.height = (detach && k === 0 ? GAP : 0) + "px"; });
          it.style.marginTop = detach ? "0px" : "-1px";
        } else {
          it.style.marginTop = i === 0 ? "0px" : (detach ? GAP + "px" : "-1px");
        }

        it.style.zIndex = isOpen(i) ? "1" : "";
        it.style.position = it.style.position || "relative";
      });
    }

    /* True content height.
       scrollHeight must NOT be used here: it measures the scrollable overflow
       area, which counts children displaced by a transform. The panel content
       enters on translateY(8px), so scrollHeight reported 8px too much — the
       panel opened too far and collapsed back by those 8px at the end. */
    function contentHeight(body) {
      const h0 = body.style.height;
      const t0 = body.style.transition;
      body.style.transition = "none";
      body.style.height = "auto";
      const h = body.offsetHeight;
      body.style.height = h0;
      body.style.transition = t0;
      void body.offsetHeight;
      return h;
    }

    function setOpen(it, open) {
      const body = it.querySelector("[data-acc-body]");
      const head = it.querySelector("[data-acc-head]");
      if (!body) return;

      const start = body.offsetHeight;               /* animate from where it is now */

      if (open) {
        it.dataset.accOpen = "true";
        if (head) head.setAttribute("aria-expanded", "true");
        const target = contentHeight(body);
        body.style.height = start + "px";
        void body.offsetHeight;                      /* force reflow between values */
        body.style.height = target + "px";
      } else {
        it.dataset.accOpen = "false";
        if (head) head.setAttribute("aria-expanded", "false");
        body.style.height = start + "px";            /* height:auto is not animatable */
        void body.offsetHeight;
        body.style.height = "0px";
      }
    }

    items.forEach((it) => {
      const body = it.querySelector("[data-acc-body]");
      const head = it.querySelector("[data-acc-head]");
      if (!body || !head) return;

      it.dataset.accOpen = "false";
      head.setAttribute("aria-expanded", "false");

      /* Only when the head is not already a <button>. */
      if (!head.hasAttribute("role") && head.tagName !== "BUTTON") {
        head.setAttribute("role", "button");
      }
      if (!head.hasAttribute("tabindex") && head.tagName !== "BUTTON") {
        head.setAttribute("tabindex", "0");
      }

      /* Release to auto once open, so the panel keeps up with a resize or a
         late-loading font instead of clipping at its measured height. */
      body.addEventListener("transitionend", (e) => {
        if (e.propertyName === "height" && it.dataset.accOpen === "true") {
          body.style.height = "auto";
        }
      });

      function toggle() {
        const wasOpen = it.dataset.accOpen === "true";
        if (!MULTI) {
          items.forEach((o) => {
            if (o !== it && o.dataset.accOpen === "true") setOpen(o, false);
          });
        }
        setOpen(it, !wasOpen);
        geometry();
      }

      head.addEventListener("click", toggle);
      head.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); }
      });
    });

    /* An open panel pinned to a pixel height lies after a reflow. */
    let t;
    window.addEventListener("resize", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        items.forEach((it) => {
          if (it.dataset.accOpen === "true") {
            it.querySelector("[data-acc-body]").style.height = "auto";
          }
        });
      }, 150);
    });

    if (flags.indexOf("debug") > -1) {
      console.info("[rs-accordion]", {
        items: items.length, merge: MERGE, multi: MULTI, first: FIRST,
        duration: DUR + "ms", easing: EASE.slice(0, 40) + "…"
      });
    }

    geometry();
    if (FIRST) { setOpen(items[0], true); geometry(); }
  }

  document.querySelectorAll("[data-acc]").forEach(init);
}

/* Call after injecting accordions from the CMS or a late fetch. Already-wired
   wrappers are skipped, so this is safe to call repeatedly. */
window.rsAccordionRefresh = initAccordion;


/* ==========================================================================
   4. ODOMETER  [data-odometer-group]
   --------------------------------------------------------------------------
   Each digit becomes a vertical strip of 0-9 repeated `digitCycles` times,
   inside a clipped mask. Counting up is a translateY on the strip, so the
   whole animation is one transform per digit.

   Attributes
     group:   data-odometer-stagger, -stagger-order, -trigger-start
     element: data-odometer-start, -duration, -grow
   ========================================================================== */
function initNumberOdometer() {
  if (!HAS_GSAP) return;

  const prefersReducedMotion = PREFERS_STILL;
  const initFlag = "data-odometer-initialized";

  const defaults = {
    duration: 1, ease: "power3.out", elementStagger: 0.1, digitStagger: 0.04,
    revealDuration: 0.5, revealEase: "power2.out", triggerStart: "top 80%",
    staggerOrder: "left", digitCycles: 2
  };

  document.querySelectorAll("[data-odometer-group]").forEach((group) => {
    if (group.hasAttribute(initFlag)) return;
    group.setAttribute(initFlag, "");

    const elements = Array.from(group.querySelectorAll("[data-odometer-element]"));
    if (!elements.length || prefersReducedMotion) return;

    const staggerOrder = group.getAttribute("data-odometer-stagger-order") || defaults.staggerOrder;
    const triggerStart = group.getAttribute("data-odometer-trigger-start") || defaults.triggerStart;
    const elementStagger = parseFloat(group.getAttribute("data-odometer-stagger")) || defaults.elementStagger;

    const elementData = elements.map((el) => {
      const originalText = el.textContent.trim();
      const hasExplicitStart = el.hasAttribute("data-odometer-start");
      const startValue = parseFloat(el.getAttribute("data-odometer-start")) || 0;
      const duration = parseFloat(el.getAttribute("data-odometer-duration")) || defaults.duration;
      const step = getLineHeightRatio(el);

      let segments = parseSegments(originalText);
      segments = mapStartDigits(segments, startValue);
      segments = markHiddenSegments(segments, startValue);

      const grow = shouldGrow(el, hasExplicitStart, startValue, segments);
      const { rollers, revealEls } = buildRollerDOM(el, segments, step, grow);

      const fontSize = parseFloat(getComputedStyle(el).fontSize);
      const revealData = revealEls.map((revealEl) => {
        const widthEm = revealEl.offsetWidth / fontSize;
        gsap.set(revealEl, { width: 0, overflow: "hidden" });
        return { el: revealEl, widthEm };
      });

      return { el, rollers, duration, step, revealData, originalText };
    });

    const ordered = applyStaggerOrder(elementData, staggerOrder);

    const tl = gsap.timeline({
      scrollTrigger: { trigger: group, start: triggerStart, once: true },
      onComplete() {
        elementData.forEach(({ el, originalText }) => cleanupElement(el, originalText));
      }
    });

    ordered.forEach((data, orderIdx) => {
      const { rollers, duration, step, revealData } = data;
      const offset = orderIdx * elementStagger;

      revealData.forEach(({ el, widthEm }) => {
        tl.to(el, {
          width: widthEm + "em", opacity: 1,
          duration: defaults.revealDuration, ease: defaults.revealEase
        }, offset);
      });

      /* Rightmost digit leads, so the roll reads right-to-left like a counter. */
      rollers.forEach(({ roller, targetPos }, digitIdx) => {
        const reversedIdx = rollers.length - 1 - digitIdx;
        tl.to(roller, {
          /* End exactly on the target cell as laid out (read when the tween
             starts, after the web font is in): an em offset could land a
             fraction of a pixel off the cell on phones, and the digit
             snapped by that fraction when the strip was swapped for text.
             force3D "auto" drops the GPU layer at the end for the same
             reason (a composited layer renders text on a different
             sub-pixel grid). */
          y: () => {
            const cell = roller.children[targetPos];
            return cell ? -(cell.getBoundingClientRect().top - roller.getBoundingClientRect().top) : -targetPos * step + "em";
          },
          duration, ease: defaults.ease, force3D: "auto"
        }, offset + reversedIdx * defaults.digitStagger);
      });
    });
  });

  /* ---- helpers ---- */

  function getLineHeightRatio(el) {
    const cs = getComputedStyle(el);
    if (cs.lineHeight === "normal") return 1.2;
    return parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
  }

  function parseSegments(text) {
    return [...text].map((char) => ({ type: /\d/.test(char) ? "digit" : "static", char }));
  }

  function mapStartDigits(segments, startValue) {
    const digitSlots = segments.filter((s) => s.type === "digit");
    const padded = String(Math.floor(Math.abs(startValue)))
      .padStart(digitSlots.length, "0")
      .slice(-digitSlots.length);
    let di = 0;
    return segments.map((s) =>
      s.type === "digit" ? { ...s, startDigit: parseInt(padded[di++], 10) } : s);
  }

  /* Leading zeros of the start value are hidden, along with any separator that
     trails a hidden digit — so "0,042" shows as "42" before it counts up. */
  function markHiddenSegments(segments, startValue) {
    const totalDigits = segments.filter((s) => s.type === "digit").length;
    const absStart = Math.floor(Math.abs(startValue));
    const startDigitCount = absStart === 0 ? 1 : String(absStart).length;
    const leadingZeros = Math.max(0, totalDigits - startDigitCount);
    if (leadingZeros === 0) return segments;

    let digitsSeen = 0, firstDigitSeen = false, prevDigitHidden = false;
    return segments.map((seg) => {
      if (seg.type === "digit") {
        firstDigitSeen = true;
        const hidden = digitsSeen < leadingZeros;
        prevDigitHidden = hidden;
        digitsSeen++;
        return { ...seg, hidden };
      }
      return { ...seg, hidden: firstDigitSeen && prevDigitHidden };
    });
  }

  /* "Grow" widens the number as digits appear, rather than reserving the full
     width up front. On by default only when the number gains digits. */
  function shouldGrow(el, hasExplicitStart, startValue, segments) {
    if (el.hasAttribute("data-odometer-grow")) {
      return el.getAttribute("data-odometer-grow") !== "false";
    }
    if (!hasExplicitStart) return false;
    const absStart = Math.floor(Math.abs(startValue));
    const startDigitCount = absStart === 0 ? 1 : String(absStart).length;
    const endDigitCount = segments.filter((s) => s.type === "digit").length;
    return startDigitCount < endDigitCount;
  }

  /* Every part is an inline-block exactly one line tall (step em, top
     aligned). Each mask holds its final digit as an invisible sizer, so the
     mask is exactly as wide as that digit will be in the plain text, whatever
     the font load timing; the strip of cells is laid over it (absolute) and
     clipped. At the end the strip is removed and the sizer shown: nothing
     moves. History (Nov 2026): first the masks were inline spans with a text
     strip (vertical drift and a sideways jump at the swap on phones), then a
     measured width (measured before the web font loaded on phones, so the
     digits still jumped sideways at the swap). */
  function partStyle(node, step) {
    node.style.display = "inline-block";
    node.style.verticalAlign = "top";
    node.style.height = step + "em";
    node.style.lineHeight = step;
  }

  function buildRollerDOM(el, segments, step, grow) {
    el.innerHTML = "";
    el.style.height = "";

    const rollers = [], revealEls = [];
    const totalCells = 10 * defaults.digitCycles;

    segments.forEach((seg) => {
      if (seg.type === "static") {
        const span = document.createElement("span");
        span.setAttribute("data-odometer-part", "static");
        partStyle(span, step);
        span.textContent = seg.char;
        el.appendChild(span);
        if (grow && seg.hidden) { gsap.set(span, { opacity: 0 }); revealEls.push(span); }
        return;
      }

      const mask = document.createElement("span");
      mask.setAttribute("data-odometer-part", "mask");
      partStyle(mask, step);
      mask.style.position = "relative";
      /* Inline overflow:hidden: the stylesheet clips with overflow:clip, which
         iOS Safari before 16 ignores, so the whole 0-9 strip showed on phones. */
      mask.style.overflow = "hidden";

      const sizer = document.createElement("span");
      sizer.setAttribute("data-odometer-part", "sizer");
      sizer.style.visibility = "hidden";
      sizer.textContent = seg.char;
      mask.appendChild(sizer);

      const roller = document.createElement("span");
      roller.setAttribute("data-odometer-part", "roller");
      roller.style.position = "absolute";
      roller.style.left = "-0.5em";
      roller.style.right = "-0.5em";
      roller.style.top = "0";

      for (let d = 0; d < totalCells; d++) {
        const cell = document.createElement("span");
        cell.style.display = "block";
        cell.style.height = step + "em";
        cell.style.lineHeight = step;
        cell.style.textAlign = "center";
        cell.style.whiteSpace = "pre";
        cell.textContent = String(d % 10);
        roller.appendChild(cell);
      }
      mask.appendChild(roller);
      el.appendChild(mask);

      const startDigit = seg.startDigit || 0;
      const isReveal = grow && seg.hidden;
      gsap.set(roller, { y: isReveal ? step + "em" : -startDigit * step + "em" });

      /* Always roll forwards: if the target digit is below the start, go round
         through the second cycle rather than spinning backwards. */
      const endDigit = parseInt(seg.char, 10);
      const targetPos = endDigit > startDigit ? endDigit : 10 + endDigit;

      rollers.push({ roller, targetPos });
      if (isReveal) revealEls.push(mask);
    });

    return { rollers, revealEls };
  }

  /* Drop the rollers once the timeline finishes and show the sizer digits,
     leaving plain selectable text in the same boxes, so nothing moves. */
  function cleanupElement(el, originalText) {
    el.style.overflow = "";
    el.style.height = "";

    el.querySelectorAll('[data-odometer-part="mask"]').forEach((mask) => {
      const roller = mask.querySelector('[data-odometer-part="roller"]');
      if (roller) roller.remove();
      const sizer = mask.querySelector('[data-odometer-part="sizer"]');
      if (sizer) sizer.style.visibility = "";
      mask.style.willChange = "";
      mask.style.opacity = "";
    });

    el.querySelectorAll('[data-odometer-part="static"]')
      .forEach((stat) => { stat.style.opacity = ""; });
  }

  function applyStaggerOrder(items, order) {
    return order === "right" ? [...items].reverse() : [...items];
  }
}


/* ==========================================================================
   6. SWIPER  [data-swiper-group]
   --------------------------------------------------------------------------
   Markup
     [data-swiper-group]
       [data-swiper-wrap].swiper > .swiper-wrapper > .swiper-slide
       [data-swiper-prev] / [data-swiper-next]
       [data-swiper-pagination]        optional, scoped to this group

   Slides per view, as "mobile,tablet,desktop" on the group
     data-swiper-per="1.25,1.8,3.5"    default, the Rattlesnake rhythm
     data-swiper-per="1,2,3"           whole cards, so every dot moves a card

   Pagination is looked up inside the group only. A page-level fallback would
   let a second slider claim the first one's bullets.
   ========================================================================== */
/* Swiper JS (151 KB) loads only on pages that have a slider (14 Nov 2026).
   swiper-bundle.min.css stays global in Global Styles [Before], so slides
   are laid out before the script arrives and nothing shifts. */
var SWIPER_SRC = "https://cdn.jsdelivr.net/npm/swiper@11.2.10/swiper-bundle.min.js"; /* exact version: jsDelivr caches it for a year (a range gets 7 days) */
var swiperLoading = false;
function loadSwiper(cb) {
  if (typeof Swiper !== "undefined") { cb(); return; }
  if (swiperLoading) return;
  swiperLoading = true;
  var sc = document.createElement("script");
  sc.src = SWIPER_SRC;
  sc.async = true;
  sc.onload = cb;
  document.head.appendChild(sc);
}

function initSwiperSlider() {
  if (!document.querySelector("[data-swiper-group]")) return;
  if (typeof Swiper === "undefined") { loadSwiper(initSwiperSlider); return; }

  document.querySelectorAll("[data-swiper-group]").forEach((group) => {
    const wrap = group.querySelector("[data-swiper-wrap]");
    if (!wrap || wrap.swiper) return;

    /* Case showcase: only cases that have a video stay in the slider (the
       rest showed a glow panel instead of a film). */
    wrap.querySelectorAll(".div-case-slide").forEach((sl) => {
      const md = sl.querySelector("[data-yt-id]");
      if (md && !(md.getAttribute("data-yt-id") || "").trim()) sl.remove();
    });

    /* A slider placed without its controls (the /case-studies showcase) gets
       the same prev / dots / next row the home page has in Designer. */
    if (!group.querySelector("[data-swiper-next]") && wrap.querySelectorAll(".swiper-slide").length > 1) {
      const ctl = document.createElement("div");
      ctl.className = "div-slider-controls is-auto";
      const arrow = (dir, label, d) =>
        '<a href="#" data-swiper-' + dir + ' aria-label="' + label + '" class="div-slider-button is-light w-inline-block"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="' + d + '" fill="currentColor"/></svg></a>';
      ctl.innerHTML =
        arrow("prev", "Previous case", "M11.5247 15.8332C11.4002 15.8337 11.2772 15.8062 11.1647 15.7528C11.0523 15.6995 10.9532 15.6216 10.8747 15.5249L6.84973 10.5249C6.72716 10.3758 6.66016 10.1888 6.66016 9.99574C6.66016 9.80272 6.72716 9.61568 6.84973 9.46657L11.0164 4.46657C11.1578 4.29639 11.3611 4.18937 11.5815 4.16905C11.8018 4.14874 12.0212 4.21679 12.1914 4.35824C12.3616 4.49969 12.4686 4.70295 12.4889 4.9233C12.5092 5.14366 12.4412 5.36306 12.2997 5.53324L8.57473 9.9999L12.1747 14.4666C12.2766 14.5889 12.3414 14.7378 12.3613 14.8958C12.3812 15.0538 12.3554 15.2141 12.287 15.3579C12.2186 15.5017 12.1105 15.6228 11.9754 15.7071C11.8403 15.7913 11.6839 15.8351 11.5247 15.8332Z") +
        '<div data-swiper-pagination class="div-slider-pagination is-light"></div>' +
        arrow("next", "Next case", "M8.47527 4.16676C8.59977 4.16634 8.72277 4.19382 8.83526 4.24717C8.94774 4.30053 9.04684 4.37841 9.12527 4.4751L13.1503 9.4751C13.2728 9.62421 13.3398 9.81124 13.3398 10.0043C13.3398 10.1973 13.2728 10.3843 13.1503 10.5334L8.9836 15.5334C8.84215 15.7036 8.6389 15.8106 8.41854 15.8309C8.19819 15.8513 7.97878 15.7832 7.8086 15.6418C7.63842 15.5003 7.5314 15.2971 7.51109 15.0767C7.49077 14.8563 7.55882 14.6369 7.70027 14.4668L11.4253 10.0001L7.82527 5.53343C7.72337 5.41111 7.65864 5.26216 7.63874 5.1042C7.61884 4.94624 7.6446 4.78589 7.71298 4.64212C7.78136 4.49834 7.8895 4.37717 8.02459 4.29292C8.15968 4.20868 8.31608 4.1649 8.47527 4.16676Z");
      ctl.querySelectorAll("a").forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));
      group.appendChild(ctl);
    }

    const per = (group.getAttribute("data-swiper-per") || "1.25,1.8,3.5")
      .split(",").map(Number);
    const pagination = group.querySelector("[data-swiper-pagination]") ||
      group.querySelector(".swiper-pagination");

    const sw = new Swiper(wrap, {
      slidesPerView: per[0] || 1,
      /* No spaceBetween: the gutter is padding on the slide, set in CSS
         (section 10), so Designer can change it per slider with --gap. */
      speed: 600,
      /* No Swiper mousewheel module: in Safari it swallowed vertical page
         scroll over the slider even with forceToAxis. Horizontal trackpad
         swipes are handled below, vertical wheel always scrolls the page. */
      mousewheel: false,
      grabCursor: true,
      breakpoints: {
        480: { slidesPerView: per[1] || per[0] || 1 },
        992: { slidesPerView: per[2] || per[1] || per[0] || 1 }
      },
      navigation: {
        nextEl: group.querySelector("[data-swiper-next]"),
        prevEl: group.querySelector("[data-swiper-prev]")
      },
      /* Numbered step sliders draw their own bullets, one per card (below). */
      pagination: pagination && !wrap.querySelector(".div-step-slide") ? { el: pagination, type: "bullets", clickable: true } : false,
      keyboard: { enabled: true, onlyInViewport: true },
      /* CMS sliders: the wrapper is a Webflow list (role="list"), so slides
         keep role="listitem" instead of Swiper's default "group". */
      a11y: { slideRole: wrap.querySelector('[role="list"]') ? "listitem" : "group" }
    });
    /* Numbered steps (Slider [Dark]): with two or more cards in view the
       last cards could never become the active slide, so their number badge
       was never lit. Client, 15 Nov 2026: first Next walked a highlight
       through the last cards without moving (a dead click), then a jump to
       the last card skipped a step. Now the track gets room after the last
       card (slidesOffsetAfter = the visible cards minus one), so every Next
       moves exactly one card, every card becomes the active one in turn,
       the badge follows the active card and Next disables on the last. */
    if (wrap.querySelector(".div-step-slide")) {
      /* 15 Nov (late): the last card must not travel left once it is in view.
         The track has no extra room after the last card. Every step moves the
         track by an equal share of its run and the badge by one card, so each
         Next still moves something, no card is skipped, and the last card
         stops at the right edge. */
      const slides = Array.from(wrap.querySelectorAll(".swiper-slide"));
      const n = slides.length;
      const nextB = group.querySelector("[data-swiper-next]"), prevB = group.querySelector("[data-swiper-prev]");
      let dots = [], f = 0, own = 0, ownT = 0;
      const off = (b, v) => { if (!b) return; b.classList.toggle("swiper-button-disabled", v); b.setAttribute("aria-disabled", v ? "true" : "false"); };
      const paint = () => {
        group.classList.remove("has-focus");
        slides.forEach((x, i) => x.classList.toggle("is-focus", i === f));
        dots.forEach((b, i) => b.classList.toggle("swiper-pagination-bullet-active", i === f));
        off(prevB, f <= 0);
        off(nextB, f >= n - 1);
      };
      const go = (i, speed) => {
        f = Math.max(0, Math.min(n - 1, i));
        const a = sw.minTranslate(), b = sw.maxTranslate();
        own = 1;
        clearTimeout(ownT);
        sw.translateTo(n > 1 ? a + (b - a) * (f / (n - 1)) : a, speed === undefined ? 600 : speed, true, true);
        ownT = setTimeout(() => { own = 0; paint(); }, (speed === undefined ? 600 : speed) + 80);
        paint();
      };
      wrap.__stepFocus = (dir) => { go(f + dir); return true; };
      group.addEventListener("click", (e) => {
        const b = e.target.closest && e.target.closest("[data-swiper-next],[data-swiper-prev]");
        if (!b || !group.contains(b)) return;
        e.preventDefault();
        e.stopPropagation();
        go(f + (b.hasAttribute("data-swiper-next") ? 1 : -1));
      }, true);
      if (pagination) {
        pagination.innerHTML = "";
        pagination.classList.add("swiper-pagination-bullets", "swiper-pagination-horizontal");
        dots = slides.map((x, i) => {
          const b = document.createElement("span");
          b.className = "swiper-pagination-bullet";
          b.setAttribute("role", "button");
          b.setAttribute("tabindex", "0");
          b.setAttribute("aria-label", "Go to step " + (i + 1));
          b.addEventListener("click", () => go(i));
          pagination.appendChild(b);
          return b;
        });
      }
      /* A drag or the keyboard lands on a card snap: the badge follows it. */
      sw.on("transitionEnd", () => { if (own || n < 2) return; f = Math.round(sw.progress * (n - 1)); paint(); });
      sw.on("resize", () => requestAnimationFrame(() => go(f, 0)));
      sw.on("breakpoint", () => requestAnimationFrame(() => go(f, 0)));
      paint();
    }
    /* Horizontal two-finger swipe moves one slide; only clearly horizontal
       gestures are taken (and only those call preventDefault). */
    let acc = 0, lock = 0;
    wrap.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2) return;
      e.preventDefault();
      if (Date.now() < lock) return;
      acc += e.deltaX;
      if (Math.abs(acc) < 30) return;
      if (!(wrap.__stepFocus && wrap.__stepFocus(acc > 0 ? 1 : -1))) {
        if (acc > 0) wrap.swiper.slideNext(); else wrap.swiper.slidePrev();
      }
      acc = 0;
      lock = Date.now() + 550;
    }, { passive: false });
  });
}


/* ==========================================================================
   10. REVEAL
   --------------------------------------------------------------------------
   Titles and subtitles arriving the way Lightspark do it. The numbers are
   theirs, read out of the bundle:

     /_next/static/chunks/1568-...js   hero: 0.7s, cubic-bezier(.27,.09,.24,1),
                                       opacity 0 -> 1, y 10px -> 0,
                                       blur(14px) -> blur(0),
                                       delays 0.1 / 0.25 / 0.35, on mount
     /_next/static/chunks/6261-...js   lists: 0.24s ease-out, y 4px, 40ms per
                                       item, useInView threshold 0.2, once

   Their hero has no per-line stagger. The <span> line wrappers inside the h1
   are line breaks; the heading animates as one element. The sequencing you see
   is only those three delays across title, subtitle and buttons.

   All timing lives in the CSS. This file decides who animates, in what order,
   and when the run starts.
   ========================================================================== */

/* Which elements move.

   Marking every child in Designer is tedious and easy to forget, so the
   attribute is optional: with no [data-reveal-item] inside the group, the
   group's own direct children are used instead. Webflow spacers and empty
   layout wrappers are skipped, because a delay spent on an invisible 2rem div
   is a delay the reader waits through for nothing.

   Put data-reveal-skip on anything that should sit still. */
function revealItems(group) {
  const marked = group.querySelectorAll("[data-reveal-item]");
  if (marked.length) return [].slice.call(marked);

  const fallback = [].slice.call(group.children).filter((el) => {
    if (el.hasAttribute("data-reveal-skip")) return false;
    if (/spacer|divider/i.test(el.className || "")) return false;
    /* Something to look at: words, or a picture. */
    const hasText = (el.textContent || "").trim().length > 0;
    const hasMedia = !!el.querySelector("img, svg, video, canvas, picture");
    return hasText || hasMedia;
  });

  /* Stamped on, so the CSS has one contract to match either way and does not
     need a second set of selectors for the children it was not told about. */
  fallback.forEach((el) => el.setAttribute("data-reveal-item", ""));
  return fallback;
}

/* Would the observer below fire immediately on this element? Same rule in both
   places, written once: twenty per cent of the box visible, or any part of it
   for a block taller than the viewport, which can never reach twenty per cent.

   Called before anything is hidden, so the rect is the finished layout. */
function isOnScreenNow(el) {
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  const r = el.getBoundingClientRect();
  if (!r.height || !vh) return false;
  const shown = Math.min(r.bottom, vh) - Math.max(r.top, 0);
  if (shown <= 0) return false;
  return r.height > vh * 0.8 ? true : shown >= r.height * 0.2;
}

function initReveal() {
  const groups = document.querySelectorAll("[data-reveal]");

  /* Set by the optional head snippet, which hides the groups before this file
     has loaded so nothing flashes in and back out. Released here whatever
     happens next, including when there is nothing on the page to reveal. */
  document.documentElement.classList.remove("js-reveal");

  if (!groups.length) return;

  /* Lightspark's three, then a steady step for anything after. */
  const HERO_DELAYS = [0.1, 0.25, 0.35];
  const HERO_STEP   = 0.1;

  /* A preset with an even stagger says so here. Anything not listed falls back
     to Lightspark's three hand-written delays, which suit a heading block and
     read wrong on a grid, where an even step is what the eye expects. */
  const EVEN_STEP = { rise: 0.04, tilt: 0.1 };

  groups.forEach((group) => {
    const mode = group.getAttribute("data-reveal") || "";
    const items = revealItems(group);
    if (!items.length) return;

    const step = mode in EVEN_STEP ? EVEN_STEP[mode] : null;

    /* Already on screen when the page loaded? Then show it, finished, and never
       arm it at all.

       This is the one place worth diverging from Rejouice. Their entrances are
       plain ScrollTriggers with start "top 90%" and once:true and no viewport
       pre-check anywhere in the bundle, so on any load that starts mid-page —
       a refresh with the scroll restored, a link to an anchor, the back button
       — every trigger already past its start fires on the same tick. The reader
       lands looking at a block and watches it assemble itself, which is an
       animation played to somebody who has already arrived. Worse, everything
       ABOVE the restored position fires too, so an entire page of staggers runs
       at once out of sight.

       An entrance earns its keep by marking a transition: this was not here,
       now it is. Content that was on screen at the first paint has no such
       transition to mark. So it is left alone, and the animation is spent only
       on what the reader actually scrolls to.

       The test mirrors the observer below rather than inventing a second
       number: it asks whether that observer would have fired on its very first
       callback anyway. Measured before arming, so it reads the real laid-out
       box and there is no race with the hidden state. */
    if (mode !== "load" && isOnScreenNow(group)) return;

    items.forEach((item, i) => {
      /* An explicit delay on the element always wins, so one odd element can be
         resequenced in Designer without touching this file. */
      if (item.hasAttribute("data-reveal-delay")) {
        item.style.setProperty("--reveal-delay", item.getAttribute("data-reveal-delay") + "s");
        return;
      }
      const d = step !== null
        ? i * step
        : (i < HERO_DELAYS.length ? HERO_DELAYS[i] : HERO_DELAYS[HERO_DELAYS.length - 1] + (i - 2) * HERO_STEP);
      /* Rounded: 3 * 0.1 in binary floating point is 0.30000000000000004, and
         that lands in the DOM verbatim. */
      item.style.setProperty("--reveal-delay", Math.round(d * 1000) / 1000 + "s");
    });

    /* Arming is what hides the items, and it happens in script so that a
       visitor with no JS, or with JS that failed, gets the finished page. */
    group.classList.add("is-armed");

    if (PREFERS_STILL) { group.classList.add("is-in"); return; }

    /* A filter is expensive to keep. Once an item has finished, drop it.
       Guarded on is-in: without it any transition that fires before the reveal
       would retire the item early and it would snap in with no animation. */
    items.forEach((item) => {
      item.addEventListener("transitionend", function done(e) {
        if (!group.classList.contains("is-in")) return;
        if (e.propertyName !== "opacity") return;
        item.classList.add("is-done");
        item.removeEventListener("transitionend", done);
      });
    });

    const play = () => {
      /* Two frames. A class set in the same frame the start state was written
         is folded into the initial computed style and never transitions. */
      requestAnimationFrame(() => requestAnimationFrame(() => {
        group.classList.add("is-in");
      }));
    };

    /* Un-hide with no animation at all. Removing the armed class rather than
       adding the finished one is what makes it instant: the transition is
       declared only on .is-in, so a group that never gets that class has
       nothing to tween and simply stands there. */
    const snap = () => { group.classList.remove("is-armed"); };

    /* The reader's own scrolling is what an entrance responds to. A trigger
       that fires before the page has settled is the page arriving underneath a
       reader who is already there, so that one is shown rather than played. */
    const arrive = () => { PAGE_SETTLED ? play() : snap(); };

    if (mode === "load") { play(); return; }

    if (!("IntersectionObserver" in window)) { play(); return; }

    /* Their react-intersection-observer call is {threshold: .2, triggerOnce}. */
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      arrive();
    }, { threshold: 0.2 });

    /* A block taller than the viewport can never reach 20 per cent visible, so
       it would sit hidden forever. Fall back to any intersection at all. */
    if (group.getBoundingClientRect().height > window.innerHeight * 0.8) {
      const io2 = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        io2.disconnect();
        io.disconnect();
        arrive();
      }, { threshold: 0 });
      io2.observe(group);
    } else {
      io.observe(group);
    }
  });
}


/* ==========================================================================
   12. CLAMP  [data-clamp]
   --------------------------------------------------------------------------
   Cuts long copy to a fixed number of lines and offers a Read more.

   Three decisions worth knowing about.

   It counts LINES. A character threshold is the obvious idea and the wrong
   one: a hundred characters is two lines in a narrow column and one in a wide
   one, so a row of three would still be uneven at the widths where evenness
   mattered. Lines are what the eye levels.

   The button appears only when the text really does overflow, measured after
   layout rather than guessed from length. The same paragraph fits at one
   breakpoint and does not at another, and a Read more that opens nothing is
   worse than none at all.

   The motion is the accordion's, taken from the same rsSpring() rather than
   from numbers typed to match. Retune the accordion and this follows.
   ========================================================================== */
function initClamp() {
  const nodes = document.querySelectorAll("[data-clamp]");
  if (!nodes.length) return;

  /* Critically damped, the accordion's own default: spring-like with no
     overshoot. A panel of body copy that bounces reads as a toy. */
  const HAS_LINEAR = !!(window.CSS && CSS.supports &&
    CSS.supports("transition-timing-function", "linear(0,1)"));
  const S = rsSpring(340, 37, 1, 48);
  const EASE = (!PREFERS_STILL && HAS_LINEAR) ? S.easing : "cubic-bezier(.32,.72,0,1)";
  const DUR  = (!PREFERS_STILL && HAS_LINEAR) ? S.duration : 500;

  const CHEVRON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="6 9 12 15 18 9"/></svg>';

  nodes.forEach((el) => {
    if (el.__clampReady) return;
    el.__clampReady = true;

    const LINES = Math.max(1, parseInt(el.getAttribute("data-clamp"), 10) || 5);
    const MORE  = el.getAttribute("data-clamp-more") || "Read more";
    const LESS  = el.getAttribute("data-clamp-less") || "Read less";

    el.style.setProperty("--clamp-ease", EASE);
    el.style.setProperty("--clamp-dur", DUR + "ms");

    /* Colour comes from a real Webflow class rather than from this file, so it
       follows the palette wherever the component lands. Absent attribute means
       the default; an empty one means no class. */
    const CLS = el.getAttribute("data-clamp-class");
    const COLOUR = (CLS === null ? "text-color-black text-size-xsmall" : CLS).trim();

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rs-clamp-toggle" + (COLOUR ? " " + COLOUR : "");
    btn.setAttribute("aria-expanded", "false");
    btn.hidden = true;
    btn.innerHTML = "<span></span>" + CHEVRON;
    const label = btn.firstChild;
    label.textContent = MORE;

    /* aria-controls needs an id, and the element may not have one. */
    if (!el.id) el.id = "rs-clamp-" + Math.random().toString(36).slice(2, 8);
    btn.setAttribute("aria-controls", el.id);
    el.insertAdjacentElement("afterend", btn);

    /* The element the type is copied from: whichever element actually holds the
       first run of text. Not el itself, because in Designer the size class
       usually sits on the text block inside the wrapper, and the wrapper's own
       computed size is whatever it inherited from the section. */
    function typeSource() {
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.nodeValue && n.nodeValue.trim())
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
      });
      const t = walk.nextNode();
      return (t && t.parentElement) || el;
    }

    /* font: inherit would be the PARENT's font, and the button is a sibling of
       the copy, not a child of it. So the font is measured off the copy and
       handed to the CSS as custom properties. Re-measured whenever apply() runs,
       because a breakpoint can change the size of the text but not of a value
       written once at init. */
    function matchType() {
      const cs = getComputedStyle(typeSource());
      btn.style.setProperty("--clamp-ff", cs.fontFamily);
      btn.style.setProperty("--clamp-fs", cs.fontSize);
      btn.style.setProperty("--clamp-fw", cs.fontWeight);
      btn.style.setProperty("--clamp-fi", cs.fontStyle);
      btn.style.setProperty("--clamp-tt", cs.textTransform);

      /* Tracking is converted to em, because a size class on the button is
         meant to win and a px value measured off 16px copy would be far too
         loose once the label is rendered at 12. Leading is not copied at all;
         the button is one line and the CSS sets it to 1. */
      const fs = parseFloat(cs.fontSize) || 16;
      const ls = parseFloat(cs.letterSpacing);
      btn.style.setProperty("--clamp-ls", isNaN(ls) ? "normal" : (ls / fs) + "em");
    }

    let open = false;
    let closedH = 0;

    /* The height of N lines, from this element's OWN line-height rather than a
       guess, so the cut sits on a baseline instead of slicing a row of text.
       getComputedStyle returns "normal" when nothing is set, which is not a
       number; 1.5 is the usual rendered ratio and only ever a fallback. */
    function lineHeight() {
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight);
      return isNaN(lh) ? parseFloat(cs.fontSize) * 1.5 : lh;
    }

    /* Measured with the clamp lifted, because scrollHeight on an element that
       is already clipped reports the clipped box in some engines. */
    function fullHeight() {
      const prev = el.style.maxHeight;
      el.style.transition = "none";
      el.style.maxHeight = "none";
      const h = el.scrollHeight;
      el.style.maxHeight = prev;
      void el.offsetHeight;
      el.style.transition = "";
      return h;
    }

    function apply() {
      matchType();
      closedH = Math.round(lineHeight() * LINES);
      const full = fullHeight();

      /* One line of slack. Sub-pixel line heights mean a paragraph that fits
         exactly can measure a pixel over, and a Read more that reveals one
         pixel is a broken promise. */
      const overflows = full > closedH + 4;

      btn.hidden = !overflows;

      if (!overflows) {
        el.classList.remove("is-clamped", "is-open");
        el.style.removeProperty("--clamp-h");
        el.style.maxHeight = "";
        open = false;
        btn.setAttribute("aria-expanded", "false");
        label.textContent = MORE;
        return;
      }

      el.style.setProperty("--clamp-h", closedH + "px");
      if (open) {
        /* Already open and the copy rewrapped: stay open, drop the pinned
           height so the panel keeps up with its own content. */
        el.classList.remove("is-clamped");
        el.classList.add("is-open");
        el.style.maxHeight = "none";
      } else {
        el.classList.add("is-clamped");
        el.classList.remove("is-open");
        el.style.maxHeight = "";
      }
    }

    function toggle() {
      const full = fullHeight();

      if (!open) {
        /* From the pinned closed height to the measured full height. Both ends
           are pixels, because max-height does not animate to or from auto. */
        el.style.maxHeight = closedH + "px";
        void el.offsetHeight;
        el.classList.remove("is-clamped");
        el.classList.add("is-open");
        el.style.maxHeight = full + "px";
      } else {
        /* Pin the current height first. Going straight from none to the closed
           value gives the transition nothing to start from. */
        el.style.maxHeight = full + "px";
        void el.offsetHeight;
        el.classList.add("is-clamped");
        el.classList.remove("is-open");
        el.style.maxHeight = closedH + "px";
      }

      open = !open;
      btn.setAttribute("aria-expanded", String(open));
      label.textContent = open ? LESS : MORE;
    }

    /* Released to none once open, so a resize or a late-loading font cannot
       leave the panel clipped at the height it happened to measure. */
    el.addEventListener("transitionend", (e) => {
      if (e.propertyName !== "max-height") return;
      if (open) el.style.maxHeight = "none";
    });

    btn.addEventListener("click", toggle);

    if (PREFERS_STILL) { btn.hidden = true; return; }

    apply();

    /* Web fonts land after first layout and change the line height, so the
       first measure can be wrong by a line. */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(apply);

    let t;
    window.addEventListener("resize", () => {
      clearTimeout(t);
      t = setTimeout(apply, 150);
    });
  });
}

/* Call after injecting copy from the CMS or a late fetch. Elements already
   wired are skipped, so this is safe to call repeatedly. */
window.rsClampRefresh = initClamp;


/* ==========================================================================
   13. UNDERLINE  [data-underline="through"]
   --------------------------------------------------------------------------
   Only one variant needs script. The other four are two states and a
   transform, which CSS does on its own and does better.

   "through" is the one that comes in from the left and leaves to the right,
   and that is two different end points for what CSS treats as one resting
   state. The CSS fallback fakes it by flipping transform-origin at the moments
   when the line is either invisible or full width, which is exact right up to
   the moment somebody interrupts it: flip the origin while the line is half
   drawn and the line jumps sideways.

   What GSAP does here is compensate that flip. What this does instead is never
   flip anything: the line is clipped, growing moves its right edge, leaving
   moves its left edge, and an interruption simply retargets from wherever the
   edges are. Same result, no library, and the interrupted case is smooth by
   construction rather than by correction.
   ========================================================================== */
function initUnderline() {
  const nodes = document.querySelectorAll('[data-underline="through"]');
  if (!nodes.length) return;

  /* Without clip-path the CSS fallback is already in place and is the better
     of the two available answers, so leave it alone. */
  if (PREFERS_STILL) return;
  if (!(window.CSS && CSS.supports && CSS.supports("clip-path", "inset(0 0 0 100%)"))) return;

  const OPEN   = "inset(0px 0px 0px 0px)";
  const SHUT_R = "inset(0px 0px 0px 100%)";   /* collapsed against the right */
  const SHUT_L = "inset(0px 100% 0px 0px)";   /* collapsed against the left  */

  nodes.forEach((el) => {
    if (el.__ulReady) return;
    el.__ulReady = true;

    const bar = document.createElement("i");
    bar.className = "rs-ul";
    bar.setAttribute("aria-hidden", "true");
    el.appendChild(bar);

    /* Tells the CSS to drop the pseudo-element version, set only once the real
       bar is in the DOM so there is never a frame with neither. */
    el.setAttribute("data-ul-js", "");

    /* "shut" means settled at the right edge, which is the only state that
       needs special handling on the way in: the line has to be moved to the
       far side first, or it would grow leftwards out of the right edge. The
       move is invisible because at that moment the line has no width. */
    let shut = true;

    function enter() {
      if (shut) {
        bar.style.transition = "none";
        bar.style.clipPath = SHUT_L;
        void bar.offsetWidth;          /* commit the jump before re-arming */
        bar.style.transition = "";
      }
      shut = false;
      bar.style.clipPath = OPEN;
    }

    function leave() {
      shut = false;                    /* not settled again until it arrives */
      bar.style.clipPath = SHUT_R;
    }

    bar.addEventListener("transitionend", (e) => {
      if (e.propertyName !== "clip-path") return;
      shut = bar.style.clipPath === SHUT_R;
    });

    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("focus", enter);
    el.addEventListener("blur", leave);
  });
}


/* ==========================================================================
   14. STICKY CTA  [data-sticky]
   --------------------------------------------------------------------------
   Shows the fixed button once a "from" element has crossed the trigger line
   and hides it again once an "until" element crosses the same line.

   Crossed, not visible. An observer reports whether an element is intersecting
   right now, and the button has to stay up long after the element that brought
   it in has scrolled off the top. So the observer is used only as a cheap way
   of knowing WHEN to look; the decision is made by comparing each trigger's
   top edge against the line, which is a fact that holds whether the element is
   on screen, above it or below it.

   rootMargin puts the observer's own bottom edge on that same line, so the
   callbacks land exactly at the moments the answer can change rather than
   merely when something enters the viewport.
   ========================================================================== */
function initStickyCta() {
  const nodes = document.querySelectorAll("[data-sticky]");
  if (!nodes.length) return;

  nodes.forEach((el) => {
    if (el.__stickyReady) return;
    el.__stickyReady = true;

    /* Named triggers, so two sticky elements on one page do not read each
       other's. An unnamed button pairs with unnamed triggers. */
    const key = el.getAttribute("data-sticky") || "";
    const pick = (attr) => {
      const all = document.querySelectorAll("[" + attr + "]");
      for (let i = 0; i < all.length; i++) {
        if ((all[i].getAttribute(attr) || "") === key) return all[i];
      }
      return null;
    };

    const from  = pick("data-sticky-from");
    const until = pick("data-sticky-until");

    const asked = parseFloat(el.getAttribute("data-sticky-line"));
    const RATIO = isNaN(asked) ? 0.9 : Math.min(Math.max(asked, 0), 1);

    /* The CSS keeps the button visible until this lands, so that a script that
       never runs cannot leave the page without its CTA. */
    el.setAttribute("data-sticky-ready", "");

    const vh = () => window.innerHeight || document.documentElement.clientHeight || 0;

    /* The two triggers answer two different questions and therefore watch two
       different edges.

       "from" is AFTER: its bottom edge has to clear the top of the screen
       before the button is earned. Watching its top instead would make a full
       height hero qualify at a scroll position of zero, which is the one place
       the button must not be.

       "until" is AT: its top edge crossing the line is the moment the reader
       has arrived, and the button should be gone by the time they are reading
       it rather than fading out over the top of it. */
    const cleared = (n) => !!n && n.getBoundingClientRect().bottom <= 0;
    const reached = (n) => !!n && n.getBoundingClientRect().top <= vh() * RATIO;

    let on = null;
    function measure() {
      const next = (from ? cleared(from) : true) && !reached(until);
      if (next === on) return;       /* toggling a class it already has would
                                        restart nothing, but it would churn */
      on = next;
      el.classList.toggle("is-on", next);
    }

    if (from || until) {
      const io = new IntersectionObserver(measure, {
        /* Bottom edge lifted to the trigger line. -10% for the default 0.9. */
        rootMargin: "0px 0px " + ((RATIO - 1) * 100).toFixed(2) + "% 0px",
        threshold: 0,
      });
      if (from)  io.observe(from);
      if (until) io.observe(until);
    }

    /* The observer recomputes its own margins on resize but only calls back if
       an intersection actually changed, and the line can move underneath a
       trigger without that happening. */
    let t;
    window.addEventListener("resize", () => {
      clearTimeout(t);
      t = setTimeout(measure, 150);
    });

    measure();
  });
}


/* ==========================================================================
   15. ACCORDION MEDIA PANE  [data-acc-media]
   --------------------------------------------------------------------------
   Swaps a media pane when a row of the accordion opens.

   This does NOT touch section 2, and that is deliberate. The accordion already
   writes data-acc-open on every row as its single source of truth, so this
   watches that attribute with a MutationObserver instead of hooking into
   setOpen. Three things fall out of that for free: it works with the "first"
   flag, it works with "multi" (the topmost open row wins), and it works with
   any open triggered later from code. Section 2 stays exactly as it is, which
   means one less file to re-paste into Slater.

   Matching is BY ORDER: first layer to first row. Where the two lists can
   drift apart, which really means a CMS Collection List on one side and hand
   built rows on the other, put data-acc-media-key on both and it matches by
   key instead.

   If a row has no matching layer the pane simply keeps what it is showing,
   rather than going blank. Same when every row is closed: it falls back to the
   first layer. An empty pane is never the right answer here.
   ========================================================================== */
function initAccMedia() {
  document.querySelectorAll("[data-acc-scene]").forEach((scene) => {
    if (scene.__accmReady) return;
    scene.__accmReady = true;

    const pane = scene.querySelector("[data-acc-media]");
    const acc = scene.querySelector("[data-acc]");
    if (!pane || !acc) return;

    /* Element children only: a stray text node between layers is not a layer. */
    const layers = Array.prototype.filter.call(
      pane.children,
      (n) => n.nodeType === 1 && !n.classList.contains("glow-bg")
    );

    /* Same ownership test section 2 uses, so a nested accordion inside a
       panel cannot steal the outer one's rows. */
    const items = Array.prototype.filter.call(
      acc.querySelectorAll("[data-acc-item]"),
      (it) => it.closest("[data-acc]") === acc
    );

    if (!layers.length || !items.length) return;

    /* Tells the CSS the script is live, which releases the "show only the
       first child" fallback. */
    pane.setAttribute("data-accm-ready", "");

    function layerFor(it) {
      const key = it.getAttribute("data-acc-media-key");
      if (key) {
        for (let i = 0; i < layers.length; i++) {
          if (layers[i].getAttribute("data-acc-media-key") === key) return layers[i];
        }
        return null;
      }
      return layers[items.indexOf(it)] || null;
    }

    let current = null;

    function show(el) {
      if (!el || el === current) return;
      if (current) current.removeAttribute("data-accm-on");
      el.setAttribute("data-accm-on", "");
      current = el;
    }

    function sync() {
      let open = null;
      for (let i = 0; i < items.length; i++) {
        if (items[i].dataset.accOpen === "true") { open = items[i]; break; }
      }
      show(layerFor(open || items[0]));
    }

    const mo = new MutationObserver(sync);
    items.forEach((it) => {
      mo.observe(it, { attributes: true, attributeFilter: ["data-acc-open"] });
    });

    sync();
  });
}


/* ==========================================================================
   16. TABS WITH A VISUAL  [data-tabs="wrapper"]
   --------------------------------------------------------------------------
   A list of tabs on one side, a stack of visuals on the
   other. The open tab grows its details to auto height while its visual
   slides in; the outgoing pair leaves on the same timeline.

   Markup
     [data-tabs="wrapper"]
       [data-tabs="content-item"]        one tab, the click target
         [data-tabs="item-details"]      the part that opens
         [data-tabs="item-progress"]     optional bar, styled in CSS
       [data-tabs="visual-item"]         one visual per tab, matched by order

   The open pair carries .active. Style both states in Designer against that
   class. Keyboard: Enter and Space open a tab, so give each tab tabindex="0".
   ========================================================================== */
function initTabSystem() {
  if (!HAS_GSAP) return;

  document.querySelectorAll('[data-tabs="wrapper"]').forEach((wrapper) => {
    if (wrapper.hasAttribute("data-tabs-ready")) return;
    wrapper.setAttribute("data-tabs-ready", "");

    const contentItems = wrapper.querySelectorAll('[data-tabs="content-item"]');
    const visualItems  = wrapper.querySelectorAll('[data-tabs="visual-item"]');
    if (!contentItems.length) return;

    let activeContent = null;
    let activeVisual  = null;
    let isAnimating   = false;

    function switchTab(index) {
      const incomingContent = contentItems[index];
      if (isAnimating || incomingContent === activeContent) return;
      isAnimating = true;

      const outgoingContent = activeContent;
      const outgoingVisual  = activeVisual;
      const incomingVisual  = visualItems[index];

      outgoingContent?.classList.remove("active");
      outgoingVisual?.classList.remove("active");
      outgoingContent?.setAttribute("aria-selected", "false");
      incomingContent.classList.add("active");
      incomingVisual?.classList.add("active");
      incomingContent.setAttribute("aria-selected", "true");

      const tl = gsap.timeline({
        defaults: { duration: PREFERS_STILL ? 0.01 : 0.65, ease: "power3" },
        onComplete: () => {
          activeContent = incomingContent;
          activeVisual  = incomingVisual;
          isAnimating   = false;
        }
      });

      if (outgoingContent) {
        const outDetails = outgoingContent.querySelector('[data-tabs="item-details"]');
        if (outgoingVisual) tl.to(outgoingVisual, { autoAlpha: 0, xPercent: 3 }, 0);
        if (outDetails) tl.to(outDetails, { height: 0 }, 0);
      }

      const inDetails = incomingContent.querySelector('[data-tabs="item-details"]');
      if (incomingVisual) {
        tl.fromTo(incomingVisual, { autoAlpha: 0, xPercent: 3 }, { autoAlpha: 1, xPercent: 0 }, 0.3);
      }
      if (inDetails) tl.fromTo(inDetails, { height: 0 }, { height: "auto" }, 0);
    }

    /* Closed state is set here rather than in Designer, so every tab stays
       readable while editing and on a page whose script never ran. */
    contentItems.forEach((item, i) => {
      const details = item.querySelector('[data-tabs="item-details"]');
      if (details) gsap.set(details, { height: 0, overflow: "hidden" });
      if (visualItems[i]) gsap.set(visualItems[i], { autoAlpha: 0 });
      item.setAttribute("role", "tab");
      item.setAttribute("aria-selected", "false");
      item.addEventListener("click", () => switchTab(i));
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); switchTab(i); }
      });
    });

    switchTab(0);
  });
}


/* ==========================================================================
   17. LOGO WALL CYCLE  [data-logo-wall-cycle-init]
   --------------------------------------------------------------------------
   A fixed grid of logo cells; every 1.5s one random cell
   swaps its logo for the next one from the pool, so a 12-cell grid can show
   any number of clients without growing.

   Markup
     [data-logo-wall-cycle-init]
       [data-logo-wall-list]
         [data-logo-wall-item]                 one cell, repeat
           [data-logo-wall-target-parent]      optional inner holder
             [data-logo-wall-target]           the logo itself

   Cells hidden with display:none (CSS caps the grid at 12) are not used, and
   the pool holds every logo, so put more items in the list than cells shown.
   data-logo-wall-shuffle="false" keeps the first screen in Designer order.
   Pauses off screen and in a background tab.
   ========================================================================== */
function initLogoWallCycle() {
  if (!HAS_GSAP || !window.ScrollTrigger || PREFERS_STILL) return;
  const loopDelay = 1.5;
  const duration = 0.9;
  document.querySelectorAll('[data-logo-wall-cycle-init]').forEach(root => {
    const list = root.querySelector('[data-logo-wall-list]');
    const items = Array.from(list.querySelectorAll('[data-logo-wall-item]'));
    const shuffleFront = root.getAttribute('data-logo-wall-shuffle') !== 'false';
    const originalTargets = items
      .map(item => item.querySelector('[data-logo-wall-target]'))
      .filter(Boolean);
    let visibleItems = [];
    let visibleCount = 0;
    let pool = [];
    let pattern = [];
    let patternIndex = 0;
    let tl;
    function isVisible(el) {
      return window.getComputedStyle(el).display !== 'none';
    }
    function shuffleArray(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
    function setup() {
      if (tl) tl.kill();
      visibleItems = items.filter(isVisible);
      visibleCount = visibleItems.length;
      pattern = shuffleArray(Array.from({ length: visibleCount }, (_, i) => i));
      patternIndex = 0;
      items.forEach(item => {
        item.querySelectorAll('[data-logo-wall-target]').forEach(old => old.remove());
      });
      pool = originalTargets.map(n => n.cloneNode(true));
      let front, rest;
      if (shuffleFront) {
        const shuffledAll = shuffleArray(pool);
        front = shuffledAll.slice(0, visibleCount);
        rest = shuffleArray(shuffledAll.slice(visibleCount));
      } else {
        front = pool.slice(0, visibleCount);
        rest = shuffleArray(pool.slice(visibleCount));
      }
      pool = front.concat(rest);
      for (let i = 0; i < visibleCount; i++) {
        const parent =
          visibleItems[i].querySelector('[data-logo-wall-target-parent]') ||
          visibleItems[i];
        parent.appendChild(pool.shift());
      }
      tl = gsap.timeline({ repeat: -1, repeatDelay: loopDelay });
      tl.call(swapNext);
      tl.play();
    }
    function swapNext() {
      const nowCount = items.filter(isVisible).length;
      if (nowCount !== visibleCount) { setup(); return; }
      if (!pool.length) return;
      const idx = pattern[patternIndex % visibleCount];
      patternIndex++;
      const container = visibleItems[idx];
      const parent =
        container.querySelector('[data-logo-wall-target-parent]') ||
        container.querySelector('*:has(> [data-logo-wall-target])') ||
        container;
      const existing = parent.querySelectorAll('[data-logo-wall-target]');
      if (existing.length > 1) return;
      const current = parent.querySelector('[data-logo-wall-target]');
      const incoming = pool.shift();
      gsap.set(incoming, { yPercent: 50, autoAlpha: 0 });
      parent.appendChild(incoming);
      if (current) {
        gsap.to(current, {
          yPercent: -50,
          autoAlpha: 0,
          duration,
          ease: 'expo.inOut',
          onComplete: () => { current.remove(); pool.push(current); }
        });
      }
      gsap.to(incoming, {
        yPercent: 0,
        autoAlpha: 1,
        duration,
        delay: 0.1,
        ease: 'expo.inOut'
      });
    }
    setup();
    ScrollTrigger.create({
      trigger: root,
      start: 'top bottom',
      end: 'bottom top',
      onEnter:     () => tl.play(),
      onLeave:     () => tl.pause(),
      onEnterBack: () => tl.play(),
      onLeaveBack: () => tl.pause(),
    });
    document.addEventListener('visibilitychange', () =>
      document.hidden ? tl.pause() : tl.play()
    );
  });
}

/* ==========================================================================
   19. BACKGROUND FX  [data-aurora] [data-code-bg] [data-text-glow] [data-text-reveal]
   --------------------------------------------------------------------------
   The Rattlesnake bg-fx module, unchanged and self-starting. It keeps its own
   IIFE and its own init, so it does not go through the entry point below.
     data-aurora        live WebGL aurora behind the section
     data-code-bg       code glyphs that light up around the cursor
   Options for each are documented inside the module.
   ========================================================================== */
/* 19a. ROTATING HEADLINE PRE-LAYOUT. Before the letter entrance splits the
   home h1 (section 19), its text is set out the way section 49 shows it:
   the shared start ("Hire engineers who") on the first line, the ending on
   its own line. The entrance then plays in the final layout, so the
   heading does not reflow (and push the hero down) when the rotator takes
   over. The text itself is unchanged. */
(function () {
  function pre() {
    document.querySelectorAll("[data-rotate]").forEach(function (h) {
      if (h.querySelector(".rot-line, .bgfx-w")) return;
      var base = h.textContent.replace(/\s+/g, " ").trim();
      var lines = h.getAttribute("data-rotate").split("|").map(function (x) { return x.trim(); }).filter(Boolean);
      if (lines.indexOf(base) < 0) lines.unshift(base);
      if (lines.length < 2) return;
      var ws = lines.map(function (l) { return l.split(" "); }), p = [];
      for (var i = 0; i < ws[0].length - 1; i++) {
        var w = ws[0][i];
        if (ws.every(function (x) { return x.length > i + 1 && x[i] === w; })) p.push(w); else break;
      }
      if (!p.length || base.indexOf(p.join(" ")) !== 0) return;
      var prefix = p.join(" "), tail = base.slice(prefix.length).trim();
      h.textContent = "";
      var a = document.createElement("span");
      a.className = "rot-pre";
      a.textContent = prefix;
      var b = document.createElement("span");
      b.className = "rot-line";
      b.style.display = "block";
      b.textContent = tail;
      h.appendChild(a);
      h.appendChild(document.createTextNode(" "));
      h.appendChild(b);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pre);
  else pre();
})();

/*!
 * bg-fx v1.3 | Rattlesnake
 *
 * data-aurora     Live WebGL aurora background. Value: "dark" (default) | "light"
 * data-code-bg    Code glyphs on hover. Value: "auto" (default) | "dark" | "light"
 * data-text-glow  Heading animation on entering the viewport. Value: "once" (default) | "loop" | "letters"
 * data-text-reveal  Word-by-word reveal for secondary text. Value: "plain" (default) | "color"
 *
 * data-aurora and data-code-bg can sit on the same element.
 * Optional settings are listed above each section.
 */
(function () {
  'use strict';
  if (window.BgFx) return;

  /* ---------- Shared ---------- */

  var CSS = [
    '.bgfx-aurora,.bgfx-glyphs,.bgfx-gl,.bgfx-grain{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:inherit}',
    '.bgfx-aurora{z-index:-2;overflow:hidden}',
    '.bgfx-glyphs{z-index:-1;display:block}',
    '.bgfx-gl{display:block}',
    '.bgfx-grain{mix-blend-mode:overlay;',
    'background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\'%3E',
    '%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E',
    '%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")}',
    '.bgfx-text{background-image:linear-gradient(90deg,var(--f) 0%,var(--f) 16%,var(--c0) 30%,var(--c1) 42%,',
    'var(--c2) 54%,var(--c3) 66%,var(--f) 82%,var(--f) 100%);background-size:300% 100%;background-position:100% 0;',
    '-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}',
    '.bgfx-text-run{animation:bgfx-sweep var(--d) cubic-bezier(.45,0,.2,1) var(--dl) forwards}',
    '.bgfx-text-loop{animation:bgfx-sweep var(--d) ease-in-out var(--dl) infinite alternate}',
    '@keyframes bgfx-sweep{from{background-position:100% 0}to{background-position:0 0}}',
    '.bgfx-w{display:inline-block;white-space:nowrap}',
    '.bgfx-l{display:inline-block}',
    '.bgfx-lt .bgfx-l{opacity:0;will-change:transform,opacity}',
    '.bgfx-lt.bgfx-run .bgfx-l{animation:bgfx-letter var(--d) cubic-bezier(.2,.7,.2,1) forwards}',
    '@keyframes bgfx-letter{0%{opacity:0;transform:translateY(.45em) scale(.9);color:var(--lc)}',
    '55%{opacity:1;transform:none;color:var(--lc)}100%{opacity:1;transform:none;color:var(--f)}}',
    '.bgfx-pw{display:inline-block}',
    '.bgfx-pr .bgfx-pw{opacity:0;transform:translateY(.5em);will-change:transform,opacity}',
    '.bgfx-pr.bgfx-run .bgfx-pw{animation:bgfx-word var(--d) cubic-bezier(.2,.7,.2,1) forwards}',
    '.bgfx-pr.bgfx-tint.bgfx-run .bgfx-pw{animation-name:bgfx-word-tint}',
    '@keyframes bgfx-word{to{opacity:1;transform:none}}',
    '@keyframes bgfx-word-tint{0%{color:var(--lc)}60%{opacity:1;transform:none;color:var(--lc)}100%{opacity:1;transform:none;color:var(--f)}}',
    '.bgfx-done.bgfx-done .bgfx-pw{opacity:1;animation:none;transform:none;color:inherit}',
    '.bgfx-done.bgfx-done .bgfx-l{opacity:1;animation:none;transform:none;color:inherit}'
  ].join('');

  function mq(q) { return !!(window.matchMedia && window.matchMedia(q).matches); }
  function num(v, def) { var x = parseFloat(v); return isNaN(x) ? def : x; }
  function list(v) { return (v || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }

  function injectCss() {
    if (document.getElementById('bgfx-css')) return;
    var s = document.createElement('style');
    s.id = 'bgfx-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // Effects render on negative z-index layers: above the element's own
  // background, below its content. Needs a positioned, isolated parent.
  function prep(el) {
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.style.isolation = 'isolate';
  }

  // Any CSS color -> [r, g, b] 0-255
  var scratch;
  function toRgb(color) {
    scratch = scratch || document.createElement('canvas').getContext('2d');
    scratch.fillStyle = '#000';
    scratch.fillStyle = color;
    var v = scratch.fillStyle;
    if (v.charAt(0) === '#') {
      return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
    }
    var m = v.match(/[\d.]+/g);
    return [+m[0], +m[1], +m[2]];
  }

  /* ---------- Aurora ----------
   * data-aurora-colors    4 comma-separated colors, left to right
   * data-aurora-base      Base background color
   * data-aurora-position  "bottom" (default) | "top"
   * data-aurora-height    Glow height multiplier (default 1)
   * data-aurora-speed     Animation speed multiplier (default 1)
   * data-aurora-grain     Grain opacity, 0 to disable
   * data-aurora-quality   Render scale 0.25-1 (default 0.5, the glow is soft so half res is enough)
   */

  var PRESETS = {
    dark:  { base: '#0c0c0f', colors: ['#3e5a8c', '#e3a086', '#8a6aa3', '#b9c0cc'], grain: 0.14 },
    light: { base: '#f6f5f2', colors: ['#c7d4ff', '#ffd6c4', '#e2d3f6', '#d6e6ff'], grain: 0.08 }
  };

  var VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';

  // 2D simplex noise: Ian McEwan, Ashima Arts (MIT)
  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uRes;uniform float uTime;uniform float uFlip;uniform float uHeight;',
    'uniform vec3 uBase;uniform vec3 uC0;uniform vec3 uC1;uniform vec3 uC2;uniform vec3 uC3;',
    'vec3 permute(vec3 x){return mod(((x*34.0)+1.0)*x,289.0);}',
    'float snoise(vec2 v){',
    '  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);',
    '  vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);',
    '  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);',
    '  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.0);',
    '  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));',
    '  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);m=m*m;m=m*m;',
    '  vec3 x=2.0*fract(p*C.www)-1.0;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;',
    '  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);',
    '  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;',
    '  return 130.0*dot(m,g);',
    '}',
    'float fbm(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<3;i++){v+=a*snoise(p);p*=2.0;a*=0.5;}return v;}',
    'vec3 ramp(float s){',
    '  s=clamp(s,0.0,1.0)*3.0;',
    '  if(s<1.0)return mix(uC0,uC1,s);',
    '  if(s<2.0)return mix(uC1,uC2,s-1.0);',
    '  return mix(uC2,uC3,s-2.0);',
    '}',
    'void main(){',
    '  vec2 uv=gl_FragCoord.xy/uRes;',
    '  float y=mix(uv.y,1.0-uv.y,uFlip);',
    '  vec2 p=vec2(uv.x*uRes.x/uRes.y,y);',
    '  float t=uTime;',
    // Domain warp drives the flowing motion
    '  vec2 q=vec2(fbm(p*0.55+vec2(0.0,t*0.06)),fbm(p*0.55+vec2(5.2,-t*0.05)));',
    '  float n=fbm(p*0.8+q*0.9+vec2(t*0.04,0.0));',
    // Moving ridge line of the glow
    '  float ridge=uHeight*(0.5+0.16*snoise(vec2(p.x*0.7+t*0.09,t*0.11))+0.07*snoise(vec2(p.x*1.9-t*0.14,t*0.17)));',
    '  float glow=1.0-smoothstep(ridge-0.35,ridge+0.3,y+0.2*q.y);',
    '  glow*=0.8+0.35*n;',
    '  glow*=0.94+0.06*snoise(vec2(p.x*3.0+t*0.2,y*0.4-t*0.08));',
    '  vec3 col=ramp(uv.x+0.3*q.x+0.1*sin(t*0.2));',
    '  vec3 c=mix(uBase,col,clamp(glow,0.0,1.0));',
    // Dither against banding
    '  c+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-0.5)/255.0;',
    '  gl_FragColor=vec4(c,1.0);',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }

  function Aurora(el) {
    var preset = PRESETS[el.getAttribute('data-aurora')] || PRESETS.dark;
    var colors = list(el.getAttribute('data-aurora-colors'));
    if (!colors.length) colors = preset.colors;
    while (colors.length < 4) colors.push(colors[colors.length % colors.length]);
    var grain = num(el.getAttribute('data-aurora-grain'), preset.grain);
    var base = el.getAttribute('data-aurora-base') || preset.base;

    this.el = el;
    this.speed = num(el.getAttribute('data-aurora-speed'), 1);
    this.height = num(el.getAttribute('data-aurora-height'), 1);
    this.flip = el.getAttribute('data-aurora-position') === 'top' ? 1 : 0;
    this.scale = Math.min(1, Math.max(0.25, num(el.getAttribute('data-aurora-quality'), 0.5)));
    this.t = Math.random() * 100;
    this.raf = 0;
    this.last = 0;
    this.visible = true;

    // Layer background doubles as the no-WebGL fallback and as the
    // colour the glyph script reads to pick its theme
    var layer = document.createElement('div');
    layer.className = 'bgfx-aurora';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.backgroundColor = base;
    this.layer = layer;

    var cv = document.createElement('canvas');
    cv.className = 'bgfx-gl';
    layer.appendChild(cv);

    if (grain > 0) {
      var g = document.createElement('div');
      g.className = 'bgfx-grain';
      g.style.opacity = grain;
      layer.appendChild(g);
    }
    el.insertBefore(layer, el.firstChild);

    var gl = cv.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' });
    if (!gl || !this.initGl(gl, base, colors)) { layer.removeChild(cv); return; }
    this.cv = cv;
    this.gl = gl;
    this.soft = softGL(gl);

    var self = this;
    this._frame = function (now) { self.frame(now); };
    this.still = mq('(prefers-reduced-motion: reduce)');

    this.resize();
    if (window.ResizeObserver) new ResizeObserver(function () { self.resize(); }).observe(el);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        self.visible = entries[0].isIntersecting;
        if (self.visible) self.play();
      }).observe(el);
    }
    this.play();
  }

  Aurora.prototype.initGl = function (gl, base, colors) {
    var vs = compile(gl, gl.VERTEX_SHADER, VERT), fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);

    // One triangle covering the viewport
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    function vec(name, color) {
      var c = toRgb(color);
      gl.uniform3f(gl.getUniformLocation(prog, name), c[0] / 255, c[1] / 255, c[2] / 255);
    }
    vec('uBase', base);
    vec('uC0', colors[0]);
    vec('uC1', colors[1]);
    vec('uC2', colors[2]);
    vec('uC3', colors[3]);
    gl.uniform1f(gl.getUniformLocation(prog, 'uFlip'), this.flip);
    gl.uniform1f(gl.getUniformLocation(prog, 'uHeight'), this.height);

    this.uRes = gl.getUniformLocation(prog, 'uRes');
    this.uTime = gl.getUniformLocation(prog, 'uTime');
    return true;
  };

  Aurora.prototype.resize = function () {
    var w = Math.max(1, Math.round(this.el.clientWidth * this.scale));
    var h = Math.max(1, Math.round(this.el.clientHeight * this.scale));
    if (w === this.cv.width && h === this.cv.height) return;
    this.cv.width = w;
    this.cv.height = h;
    this.gl.viewport(0, 0, w, h);
    this.gl.uniform2f(this.uRes, w, h);
    this.draw();
  };

  Aurora.prototype.draw = function () {
    this.gl.uniform1f(this.uTime, this.t % 1000);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
  };

  Aurora.prototype.play = function () {
    if (this.still || this.soft || this.raf) return;
    if (!MOTION.on) {
      if (!this.gated) { this.gated = 1; var me = this; whenMotion(function () { me.play(); }); }
      return;
    }
    this.last = 0;
    this.raf = requestAnimationFrame(this._frame);
  };

  Aurora.prototype.frame = function (now) {
    this.raf = 0;
    if (!this.visible) return;
    var dt = this.last ? Math.min((now - this.last) / 1000, 0.1) : 0;
    this.last = now;
    this.t += dt * this.speed;
    this.draw();
    this.raf = requestAnimationFrame(this._frame);
  };

  /* ---------- Code glyphs ----------
   * data-code-bg-colors   Colors a glyph flashes on appear, then settles to the base color.
   *                       Comma-separated, or "none" to disable
   * data-code-bg-word     Repeat a word instead of glyphs, e.g. "YOTEWO"
   * data-code-bg-chars    Custom glyph set
   * data-code-bg-color    Base glyph color (overrides auto theme)
   * data-code-bg-accent   Fixed accent color for ~8% of glyphs
   * data-code-bg-font     Font stack (default: monospace)
   * data-code-bg-size     Font size px (default 13)
   * data-code-bg-spacing  Grid spacing multiplier (default 1.7)
   * data-code-bg-radius   Cursor radius px (default 150)
   * data-code-bg-density  0 to 1 (default 0.5)
   * data-code-bg-opacity  Max opacity (default 0.55)
   * data-code-bg-decay    Fade speed per frame (default 0.022)
   * data-code-bg-ambient  Hero loop: glyphs twinkle on their own across the whole
   *                       area, no cursor needed (touch too). Value = glyphs lit
   *                       per frame, e.g. "0.5". Runs only while on screen and
   *                       the tab is visible; the cursor still lights its circle.
   */

  var CHARS = '{}[]()<>/\\;:=+-*&|!?#$%@~^_01λΣΔ≠≤≥→∞⌘⌥';
  var MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace';

  var GLYPH_COLORS = {
    dark:  ['#c3a6e0', '#e8bf96', '#e09ab6', '#9dbbf0'],
    light: ['#6b4f7a', '#9a7a5c', '#8a5f86', '#4f6a8f']
  };

  // Walk up to the first opaque background and check its luminance
  function isDarkBg(node) {
    while (node && node.nodeType === 1) {
      var m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(node).backgroundColor);
      if (m) {
        var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
        if ((p.length > 3 ? p[3] : 1) > 0.5) return (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255 < 0.55;
      }
      node = node.parentElement;
    }
    return false;
  }

  function Glyphs(el) {
    var d = el.dataset;
    this.el = el;
    this.theme = d.codeBg || 'auto';
    this.size = num(d.codeBgSize, 13);
    this.spacing = num(d.codeBgSpacing, 1.7);
    this.radius = num(d.codeBgRadius, 150);
    /* Client, Nov 2026: fewer symbols site-wide. CALM scales the cursor
       density and the ambient twinkle of every [data-code-bg] at once. */
    var CALM = 0.45;
    this.density = num(d.codeBgDensity, 0.5) * CALM;
    this.opacity = num(d.codeBgOpacity, 0.55);
    this.decay = num(d.codeBgDecay, 0.022);
    this.scramble = 0.03;
    this.word = Array.from((d.codeBgWord || '').replace(/\s+/g, ''));
    this.chars = Array.from(d.codeBgChars || CHARS);
    this.color = d.codeBgColor || '';
    this.colors = d.codeBgColors || '';
    this.accent = d.codeBgAccent || '';
    this.font = d.codeBgFont || MONO;
    this.clock = 0;
    this.ready = false;
    this.raf = 0;
    this.inside = false;
    this.amb = num(d.codeBgAmbient, 0) * CALM;
    this.onScreen = false;

    var self = this;
    this._tick = function () { self.tick(); };

    // Ambient (hero loop): set up at once and twinkle while on screen
    if (this.amb > 0) {
      this.setup();
      var wake = function () {
        if (!MOTION.on) { if (!self.gated) { self.gated = 1; whenMotion(wake); } return; }
        if (self.onScreen && !document.hidden && !self.raf) self.raf = requestAnimationFrame(self._tick);
      };
      if (window.IntersectionObserver) {
        new IntersectionObserver(function (es) {
          self.onScreen = es[es.length - 1].isIntersecting;
          wake();
        }).observe(el);
      } else { this.onScreen = true; wake(); }
      document.addEventListener('visibilitychange', wake);
    }

    // Canvas is created on first hover only
    el.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'touch') return;
      if (!self.ready) self.setup();
      self.move(e);
    });
    el.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'touch' && self.ready) self.move(e);
    });
    el.addEventListener('pointerleave', function () { self.inside = false; });

    /* Falling columns (client, Nov 2026: "matrix" reference, kept in the
       site's own glyph style: same characters, colours, opacity and fade).
       Since 14 Nov they fall on their own around the cursor while it moves
       over the area (and now and then across ambient heroes); a click writes
       a short code easter egg at the click point (EGGS), typed letter by
       letter, held, then it fades and drips. Clicks on links, buttons and
       form fields are left alone. */
    this.drops = [];
    this.eggs = [];
    el.addEventListener('click', function (e) {
      if (REDUCED_DROPS) return;
      if (e.target.closest && e.target.closest('a,button,input,textarea,select,label,summary,[role="button"]')) return;
      if (!self.ready) self.setup();
      self.egg(e);
    });
  }

  var REDUCED_DROPS = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* Spawn the falling columns around the click. Speed is in rows per frame:
     0.035-0.08 is roughly 45-110px a second, slow enough to read as a drift. */
  Glyphs.prototype.rain = function (e) {
    var rect = this.el.getBoundingClientRect();
    var x = e.clientX - rect.left - this.el.clientLeft, y = e.clientY - rect.top - this.el.clientTop;
    var c0 = Math.floor(x / this.cw), r0 = Math.floor(y / this.ch);
    var span = Math.max(3, Math.round(this.radius * 0.9 / this.cw));
    var want = 5 + ((Math.random() * 4) | 0), used = {}, tries = 0;
    while (want > 0 && tries++ < 40) {
      /* Two random numbers averaged: columns cluster near the click. */
      var off = Math.round((Math.random() + Math.random() - 1) * span);
      var c = c0 + off;
      if (c < 0 || c >= this.cols || used[c]) continue;
      used[c] = 1;
      want--;
      var near = 1 - Math.abs(off) / (span + 1);
      this.drops.push({
        c: c,
        y: r0 + (Math.random() * 3 - 1.5),
        last: -1,
        v: 0.13 + Math.random() * 0.15,
        left: 7 + Math.random() * 12,
        total: 0,
        wait: (Math.random() * 10) | 0,
        k: 0.55 + 0.45 * near
      });
    }
    if (this.drops.length > 60) this.drops.splice(0, this.drops.length - 60);
    if (!this.raf) this.raf = requestAnimationFrame(this._tick);
  };

  /* One falling column at a given column/row (used by the auto rain). */
  Glyphs.prototype.drop = function (c, r, k) {
    if (c < 0 || c >= this.cols) return;
    this.drops.push({ c: c, y: r, last: -1, v: 0.1 + Math.random() * 0.12, left: 6 + Math.random() * 10, total: 0, wait: 0, k: k });
    if (this.drops.length > 60) this.drops.splice(0, this.drops.length - 60);
  };

  /* Easter eggs: short code lines, shown in order from a random start so the
     same one does not come twice in a row. */
  var EGGS = ['Hello, World!', 'git commit -m "hired"', 'npm install senior-dev', 'it works on my machine',
    '// TODO: hire faster', 'sudo make me a team', 'while (true) ship();', "console.log('48h');",
    'SELECT * FROM vetted;', 'if (vetted) hire();', '404: bugs not found', 'git push --force',
    'rm -rf legacy/', '<Yotewo />', '200 OK', 'return true;', 'tests: 42 passed', 'Rattlesnake Group built this website', "console.log('Made by Rattlesnake Group');", '\u2191\u2191\u2193\u2193\u2190\u2192\u2190\u2192BA'];
  var eggAt = (Math.random() * EGGS.length) | 0;

  /* Client, 15 Nov 2026: the easter egg must not run over the UI. The
     glyph canvas sits under the content, but a line drawn under a heading,
     a button or a glass card still showed through. The line is measured
     first and placed on the nearest free strip around the click (stepping
     up and down, then sideways). A strip is free when it does not touch
     any visible UI box inside the area: text, links, buttons, images,
     icons, and any filled or bordered box smaller than the area itself
     (cards, widgets, chips). Layout wrappers and full-bleed backgrounds do
     not count. With no free strip nearby the click only rains glyphs. */
  var EGG_UI = /^(A|BUTTON|INPUT|TEXTAREA|SELECT|LABEL|IMG|SVG|PICTURE|VIDEO|IFRAME|H[1-6]|P|LI|BLOCKQUOTE|FIGURE|CODE|PRE)$/;
  Glyphs.prototype.uiRects = function (hostR) {
    var out = [], all = this.el.getElementsByTagName("*"), big = hostR.width * hostR.height * 0.6;
    for (var i = 0; i < all.length; i++) {
      var n = all[i];
      if (n === this.cv || n.closest(".bgfx-glyphs")) continue;
      var r = n.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue;
      var tag = n.tagName.toUpperCase(), ui = EGG_UI.test(tag);
      if (!ui) for (var t = n.firstChild; t; t = t.nextSibling) if (t.nodeType === 3 && t.nodeValue.trim()) { ui = true; break; }
      var cs = null;
      if (!ui && r.width * r.height < big) {
        cs = getComputedStyle(n);
        var bg = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor);
        var al = bg ? bg[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat)[3] : 0;
        ui = (al === undefined ? 1 : al) > 0.05 || cs.backgroundImage !== "none" || parseFloat(cs.borderTopWidth) > 0;
      }
      if (!ui) continue;
      cs = cs || getComputedStyle(n);
      if (cs.visibility === "hidden" || cs.opacity === "0" || cs.display === "none") continue;
      out.push(r);
    }
    return out;
  };
  Glyphs.prototype.egg = function (e) {
    /* Client batch 26 Nov, after the "matrix" reference they sent: a click
       snaps the line out at the cursor (quick fade-in plus a thin ring from
       the click), then the line floats away slowly and fades over about five
       seconds. Earlier lines are not cut short, they keep drifting, so many
       clicks build a cloud of lines that thin out on their own (up to 12).
       Each line is one fillText per frame, no blur filter and no per-letter
       work, so rapid clicking stays smooth. */
    var rect = this.el.getBoundingClientRect();
    var ox = rect.left + this.el.clientLeft, oy = rect.top + this.el.clientTop;
    var x = e.clientX - ox, y = e.clientY - oy;
    var s = EGGS[eggAt % EGGS.length];
    eggAt++;
    var ctx = this.ctx, fs = Math.round(this.size * 1.05);
    ctx.font = '500 ' + fs + 'px ' + this.font;
    var w = ctx.measureText(s).width;
    var x0 = Math.max(12, Math.min(this.w - w - 12, x - w / 2)), y0 = Math.max(fs, Math.min(this.h - fs, y));
    this.eggs.push({
      s: s, w: w, x0: x0, y: y0, t: 0, life: 1,
      vx: (Math.random() * 16 - 8) / 60,
      vy: -(6 + Math.random() * 10) / 60
    });
    if (this.eggs.length > 12) this.eggs.shift();
    (this.rings = this.rings || []).push({ x: x, y: y, r: 0, life: 1 });
    if (this.rings.length > 6) this.rings.shift();
    /* Client, 26 Nov ("as in the example, but on click"): the glyphs around
       the click fly apart from it, brighter, and settle back. The cells in
       the radius light up first so there is something to scatter. */
    (this.bursts = this.bursts || []).push({ x: x, y: y, t: 0, e: 0 });
    if (this.bursts.length > 4) this.bursts.shift();
    var BR = 150, cw = this.cw, ch = this.ch, life = this.life, heat = this.heat, seed = this.seed;
    var c0 = Math.max(0, Math.floor((x - BR) / cw)), c1 = Math.min(this.cols - 1, Math.ceil((x + BR) / cw));
    var r0 = Math.max(0, Math.floor((y - BR) / ch)), r1 = Math.min(this.rows - 1, Math.ceil((y + BR) / ch));
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      var ddx = c * cw + cw / 2 - x, ddy = r * ch + ch / 2 - y, dd = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dd >= BR) continue;
      var k = 1 - dd / BR, ci = r * this.cols + c;
      if (seed[ci] < 0.25 + 0.6 * k && life[ci] < 0.5 + 0.7 * k) { life[ci] = 0.5 + 0.7 * k; heat[ci] = 1; this.glyph[ci] = this.pick(ci); }
    }
    if (!this.raf) this.raf = requestAnimationFrame(this._tick);
  };

  var EGG_LIFE = 60 * 5.2;
  function expo(x) { return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); }

  /* Glyphs of the field step aside under the newest lines only (cheap). */
  Glyphs.prototype.underEgg = function (x, y) {
    var eggs = this.eggs;
    for (var k = eggs.length - 1, n = 0; k >= 0 && n < 4; k--, n++) {
      var g = eggs[k];
      if (g.life > 0.35 && x > g.x0 - 8 && x < g.x0 + g.w + 8 && Math.abs(y - g.y) < this.ch * 0.8) return true;
    }
    return false;
  };

  Glyphs.prototype.drawEggs = function (ctx) {
    var eggs = this.eggs, rings = this.rings;
    if (rings && rings.length) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = this.fg;
      for (var q = rings.length - 1; q >= 0; q--) {
        var rg = rings[q];
        rg.r += 8.7;
        rg.life -= 0.025;
        if (rg.life <= 0) { rings.splice(q, 1); continue; }
        ctx.globalAlpha = rg.life * 0.4;
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, rg.r, 0, 6.2832);
        ctx.stroke();
      }
    }
    if (!eggs.length) { ctx.globalAlpha = 1; return; }
    var fs = Math.round(this.size * 1.05);
    ctx.font = '500 ' + fs + 'px ' + this.font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (var k = eggs.length - 1; k >= 0; k--) {
      var g = eggs[k];
      g.t++;
      g.x0 += g.vx;
      g.y += g.vy;
      g.life -= 1 / EGG_LIFE;
      if (g.life <= 0) { eggs.splice(k, 1); continue; }
      var a = expo(Math.min(1, g.t / 14)), pop = (1 - a) * 4;
      /* Lit in the site's glow palette for the first second, then base ink. */
      var heat = this.pal.length ? Math.max(0, 1 - g.t / 70) : 0;
      ctx.fillStyle = heat > 0 ? this.tint(g.x0 + g.w / 2, heat * (2 - heat)) : this.fg;
      ctx.globalAlpha = a * Math.min(1, g.life * 1.4) * 0.92;
      ctx.fillText(g.s, g.x0, g.y + pop);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
  };

  Glyphs.prototype.setup = function () {
    var el = this.el;
    prep(el);

    var cv = document.createElement('canvas');
    cv.className = 'bgfx-glyphs';
    cv.setAttribute('aria-hidden', 'true');
    el.insertBefore(cv, el.firstChild);
    this.cv = cv;
    this.ctx = cv.getContext('2d');

    // With an aurora layer, read its base color instead of the element's
    var bgNode = el.querySelector(':scope > .bgfx-aurora') || el;
    var dark = this.theme === 'dark' || (this.theme !== 'light' && isDarkBg(bgNode));
    this.fg = this.color || (dark ? '#ffffff' : '#111111');
    this.fgRgb = toRgb(this.fg);

    var pal = this.colors === 'none' ? [] : (list(this.colors).length ? list(this.colors) : GLYPH_COLORS[dark ? 'dark' : 'light']);
    this.pal = pal.map(toRgb);

    this.resize();
    var self = this;
    if (window.ResizeObserver) new ResizeObserver(function () { self.resize(); }).observe(el);
    this.ready = true;
  };

  Glyphs.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.el.clientWidth;
    this.h = this.el.clientHeight;
    this.cv.width = Math.round(this.w * dpr);
    this.cv.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.ch = this.size * this.spacing;
    this.cw = this.ch * 0.75;
    this.cols = Math.ceil(this.w / this.cw) + 1;
    this.rows = Math.ceil(this.h / this.ch) + 1;

    var n = this.cols * this.rows;
    this.life = new Float32Array(n);
    this.heat = new Float32Array(n);
    this.seed = new Float32Array(n);
    this.acc = new Uint8Array(n);
    this.glyph = new Array(n);
    for (var i = 0; i < n; i++) {
      this.seed[i] = Math.random();
      this.acc[i] = this.accent && Math.random() < 0.08 ? 1 : 0;
      this.glyph[i] = this.pick(i);
    }
  };

  Glyphs.prototype.pick = function (i) {
    if (this.word.length) {
      var c = i % this.cols, r = (i / this.cols) | 0;
      return this.word[(c + r) % this.word.length];
    }
    return this.chars[(Math.random() * this.chars.length) | 0];
  };

  // Palette colour drifting across the x axis over time, mixed towards the base colour by k
  Glyphs.prototype.tint = function (x, k) {
    var p = this.pal, n = p.length;
    var u = ((x / this.w + this.clock * 0.08) % 1 + 1) % 1 * n;
    var i = u | 0, f = u - i, a = p[i], b = p[(i + 1) % n], fg = this.fgRgb;
    var r = a[0] + (b[0] - a[0]) * f, g = a[1] + (b[1] - a[1]) * f, bl = a[2] + (b[2] - a[2]) * f;
    return 'rgb(' + Math.round(fg[0] + (r - fg[0]) * k) + ',' + Math.round(fg[1] + (g - fg[1]) * k) + ',' +
      Math.round(fg[2] + (bl - fg[2]) * k) + ')';
  };

  Glyphs.prototype.move = function (e) {
    var rect = this.el.getBoundingClientRect();
    this.px = e.clientX - rect.left - this.el.clientLeft;
    this.py = e.clientY - rect.top - this.el.clientTop;
    this.inside = true;
    if (!this.raf) this.raf = requestAnimationFrame(this._tick);
  };

  Glyphs.prototype.tick = function () {
    this.raf = 0;
    this.clock += 1 / 60;
    var ctx = this.ctx, cols = this.cols, rows = this.rows, cw = this.cw, ch = this.ch;
    var life = this.life, heat = this.heat, seed = this.seed, R = this.radius, i, c, r;

    // Ambient: light a few random cells each frame (fractional rate carries over)
    var ambOn = this.amb > 0 && this.onScreen && !document.hidden;
    if (ambOn) {
      this.ambAcc = (this.ambAcc || 0) + this.amb;
      while (this.ambAcc >= 1) {
        this.ambAcc -= 1;
        i = (Math.random() * life.length) | 0;
        if (life[i] <= 0.05) {
          life[i] = 0.45 + Math.random() * 0.55;
          heat[i] = 1;
          this.glyph[i] = this.pick(i);
        }
      }
    }

    // Light up cells around the cursor, sparser towards the edge
    if (this.inside) {
      var c0 = Math.max(0, Math.floor((this.px - R) / cw)), c1 = Math.min(cols - 1, Math.ceil((this.px + R) / cw));
      var r0 = Math.max(0, Math.floor((this.py - R) / ch)), r1 = Math.min(rows - 1, Math.ceil((this.py + R) / ch));
      for (r = r0; r <= r1; r++) {
        for (c = c0; c <= c1; c++) {
          var dx = c * cw + cw / 2 - this.px, dy = r * ch + ch / 2 - this.py;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= R) continue;
          var t = 1 - dist / R;
          i = r * cols + c;
          if (seed[i] < this.density * (0.35 + 0.65 * t) && life[i] < t) {
            if (life[i] <= 0.05) heat[i] = 1; // freshly appeared: start colour flash
            life[i] = t;
          }
        }
      }
    }

    /* Auto rain: near the cursor while it is over the area, and now and
       then anywhere on an ambient hero that is on screen. */
    if (!REDUCED_DROPS) {
      if (this.inside && Math.random() < 0.035) {
        var span0 = Math.max(3, Math.round(R * 0.9 / cw));
        this.drop(Math.floor(this.px / cw) + Math.round((Math.random() + Math.random() - 1) * span0), Math.floor(this.py / ch) + (Math.random() * 3 - 1.5), 0.5 + Math.random() * 0.4);
      }
      if (ambOn && Math.random() < 0.012) this.drop((Math.random() * cols) | 0, (Math.random() * rows * 0.6) | 0, 0.4 + Math.random() * 0.3);
    }

    /* Falling columns: each drop lights the next cell below it as
       it passes; the trail fades with the normal decay. Life above 1 holds the
       cell at full strength a little longer, which gives the trail its length. */
    var drops = this.drops;
    for (var di = drops.length - 1; di >= 0; di--) {
      var dr = drops[di];
      if (dr.wait > 0) { dr.wait--; continue; }
      if (!dr.total) dr.total = dr.left;
      dr.y += dr.v;
      dr.left -= dr.v;
      var row = Math.floor(dr.y);
      if (row !== dr.last) {
        dr.last = row;
        if (row >= 0 && row < rows && dr.c < cols) {
          i = row * cols + dr.c;
          var str = dr.k * Math.min(1, dr.left / (dr.total * 0.35));
          if (str > 0.05) {
            if (life[i] < 0.6 + str) life[i] = 0.6 + str;
            heat[i] = 1;
            this.glyph[i] = this.pick(i);
          }
        }
      }
      if (dr.left <= 0 || row >= rows) drops.splice(di, 1);
    }

    ctx.clearRect(0, 0, this.w, this.h);
    ctx.font = '500 ' + this.size + 'px ' + this.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    var alive = false, scr = this.word.length ? 0 : this.scramble, hasPal = this.pal.length > 0;
    /* Click scatter (see egg): out fast (6 frames), back over ~45 frames. */
    var bursts = this.bursts || [];
    for (var bi = bursts.length - 1; bi >= 0; bi--) {
      var bu = bursts[bi];
      bu.t++;
      bu.e = bu.t < 6 ? bu.t / 6 : Math.pow(Math.max(0, 1 - (bu.t - 6) / 45), 2);
      if (bu.t > 51) bursts.splice(bi, 1);
    }
    var nb = bursts.length;
    for (i = 0; i < life.length; i++) {
      var l = life[i];
      if (l <= 0) continue;
      alive = true;
      if (scr && Math.random() < scr) this.glyph[i] = this.pick(i);

      var x = (i % cols) * cw + cw / 2, y = ((i / cols) | 0) * ch + ch / 2;
      if (this.acc[i]) {
        ctx.fillStyle = this.accent;
      } else if (hasPal && heat[i] > 0) {
        var h = heat[i];
        ctx.fillStyle = this.tint(x, h * (2 - h)); // ease-out
        heat[i] = h - 0.02;
      } else {
        ctx.fillStyle = this.fg;
      }
      ctx.globalAlpha = (l > 1 ? 1 : l) * this.opacity;
      if (this.eggs.length && this.underEgg(x, y)) { life[i] = l - this.decay * 4; continue; }
      if (nb) {
        var gx = x, gy = y, push = 0;
        for (var bj = 0; bj < nb; bj++) {
          var bb = bursts[bj], bdx = x - bb.x, bdy = y - bb.y, bd = Math.sqrt(bdx * bdx + bdy * bdy);
          if (bd >= 150 || !bb.e) continue;
          var pw = (150 - bd) / 150 * bb.e;
          bd = bd || 1;
          gx += bdx / bd * pw * 55;
          gy += bdy / bd * pw * 38;
          if (pw > push) push = pw;
        }
        if (push) {
          ctx.globalAlpha = Math.min(1, (l > 1 ? 1 : l) * this.opacity * (1 + push * 1.5));
          if (hasPal) ctx.fillStyle = this.tint(x, push);
          ctx.fillText(this.glyph[i], gx, gy);
          life[i] = l - this.decay;
          continue;
        }
      }
      ctx.fillText(this.glyph[i], x, y);
      life[i] = l - this.decay;
    }
    ctx.globalAlpha = 1;
    this.drawEggs(ctx);

    // Keep running while hovered, while drops fall or while glyphs are still fading out
    if (alive || this.inside || ambOn || drops.length || this.eggs.length || (this.rings && this.rings.length) || nb) this.raf = requestAnimationFrame(this._tick);
  };

  /* ---------- Text glow ----------
   * Values:
   *   "once"      Colour wave sweeps across the heading (default)
   *   "loop"      Same wave, back and forth forever
   *   "letters"   Letters rise one by one, flash colour, settle
   *
   * data-text-glow-colors    4 comma-separated colors
   * data-text-glow-duration  Seconds (wave: 2.4, loop: 6, letters: 0.9 per letter)
   * data-text-glow-stagger   Milliseconds between letters (default 35)
   * data-text-glow-delay     Seconds before it starts (default 0)
   * data-text-glow-start     Share of the heading visible before it starts, 0-1 (default 0.4)
   *
   * The heading keeps its own colour; every mode settles back into it.
   * Text content is never changed, so crawlers and screen readers see the plain heading.
   */

  var TEXT_COLORS = {
    onLight: ['#6b4f7a', '#9a7a5c', '#8a5f86', '#4f6a8f'],
    onDark:  ['#c3a6e0', '#e8bf96', '#e09ab6', '#9dbbf0']
  };

  // Headings announce their start so a following paragraph can time itself
  function started(el, lead) {
    el.__bgfxStart = { at: performance.now(), lead: lead };
    el.dispatchEvent(new CustomEvent('bgfx:start'));
  }

  function whenInView(el, fn) {
    if (!('IntersectionObserver' in window)) return fn();
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      fn();
    }, { threshold: num(el.getAttribute('data-text-glow-start'), 0.4) });
    io.observe(el);
  }

  // Colour at position u (0-1) along the palette
  function paletteAt(pal, u) {
    var x = Math.min(0.999, Math.max(0, u)) * (pal.length - 1);
    var i = x | 0, f = x - i, a = pal[i], b = pal[i + 1] || a;
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * f) + ',' + Math.round(a[1] + (b[1] - a[1]) * f) + ',' +
      Math.round(a[2] + (b[2] - a[2]) * f) + ')';
  }

  /* 19 Nov: a letter or word inside a differently coloured span (the grey
     second line of a title, e.g. .blog-title_accent) lands on that span's
     colour, not the title's, so grey words no longer flash black on load. */
  function inkOf(node, host, el) {
    if (!host || host === el || host.nodeType !== 1) return;
    if (!host.__bgfxInk) host.__bgfxInk = getComputedStyle(host).color;
    node.style.setProperty('--f', host.__bgfxInk);
  }

  // Wrap every character in a span, keeping words unbreakable and inner markup intact
  function splitLetters(el) {
    var letters = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 1) return walk(child);
        if (child.nodeType !== 3 || !child.nodeValue.trim()) return;
        var frag = document.createDocumentFragment();
        child.nodeValue.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(part));
          var word = document.createElement('span');
          word.className = 'bgfx-w';
          word.setAttribute('aria-hidden', 'true');
          Array.from(part).forEach(function (ch) {
            var l = document.createElement('span');
            l.className = 'bgfx-l';
            l.textContent = ch;
            word.appendChild(l);
            letters.push(l);
          });
          frag.appendChild(word);
        });
        child.parentNode.replaceChild(frag, child);
      });
    })(el);
    return letters;
  }

  function mountTextGlow(el) {
    var mode = el.getAttribute('data-text-glow') || 'once';
    var fg = toRgb(getComputedStyle(el).color);
    var lightText = (0.2126 * fg[0] + 0.7152 * fg[1] + 0.0722 * fg[2]) / 255 > 0.55;
    var colors = list(el.getAttribute('data-text-glow-colors'));
    if (!colors.length) colors = TEXT_COLORS[lightText ? 'onDark' : 'onLight'];
    while (colors.length < 4) colors.push(colors[colors.length % colors.length]);
    var delay = num(el.getAttribute('data-text-glow-delay'), 0);

    el.style.setProperty('--f', 'rgb(' + fg.join(',') + ')');

    if (mode === 'letters') return mountLetters(el, colors.map(toRgb), delay);

    var loop = mode === 'loop';
    colors.forEach(function (c, i) { el.style.setProperty('--c' + i, c); });
    el.style.setProperty('--d', num(el.getAttribute('data-text-glow-duration'), loop ? 6 : 2.4) + 's');
    el.style.setProperty('--dl', delay + 's');
    el.classList.add('bgfx-text');

    // Back to plain text once the wave is done: crisper rendering, normal selection
    el.addEventListener('animationend', function (e) {
      if (e.animationName === 'bgfx-sweep' && !loop) el.classList.remove('bgfx-text', 'bgfx-text-run');
    });
    whenInView(el, function () {
      el.classList.add(loop ? 'bgfx-text-loop' : 'bgfx-text-run');
      started(el, delay + 0.6);
    });
  }

  function mountLetters(el, pal, delay) {
    if (!el.hasAttribute('aria-label')) {
      el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
      // aria-label is only valid on elements with a role: give plain divs/spans one.
      if (!/^(H[1-6]|A|BUTTON)$/.test(el.tagName) && !el.hasAttribute('role')) el.setAttribute('role', 'group');
    }
    var letters = splitLetters(el);
    var n = letters.length;
    if (!n) return;
    var stagger = num(el.getAttribute('data-text-glow-stagger'), 35);

    letters.forEach(function (l, i) {
      l.style.setProperty('--lc', paletteAt(pal, i / Math.max(1, n - 1)));
      inkOf(l, l.parentNode.parentNode, el);
      l.style.animationDelay = (delay + i * stagger / 1000) + 's';
    });
    el.style.setProperty('--d', num(el.getAttribute('data-text-glow-duration'), 0.9) + 's');
    el.classList.add('bgfx-lt');

    // Yotewo rule: every title plays the colour letter entrance when it
    // scrolls in, on light and dark blocks alike (light blocks use the
    // darker onLight palette). Only titles inside a WebGL glow block skip
    // it: the glow already moves there. The letters stay split afterwards
    // for the cursor colour play (section 47).
    if (el.closest('[data-glow-bg]')) {
      el.classList.add('bgfx-run', 'bgfx-done');
      started(el, 0);
      return;
    }

    // Release letters to plain inherited styles once the last one lands
    letters[n - 1].addEventListener('animationend', function () { el.classList.add('bgfx-done'); });
    whenInView(el, function () {
      el.classList.add('bgfx-run');
      started(el, delay + n * stagger / 2000);
    });
  }

  /* ---------- Text reveal ----------
   * For the paragraph under a title. Words rise in one by one.
   * "color" adds the same colour flash as the heading.
   *
   * If the previous sibling has data-text-glow, it starts when the heading is
   * about halfway in. Otherwise it starts on entering the viewport.
   *
   * data-text-reveal-stagger   Milliseconds between words (default 22)
   * data-text-reveal-duration  Seconds per word (default 0.8)
   * data-text-reveal-delay     Extra seconds (default 0)
   * data-text-reveal-colors    4 comma-separated colors for "color"
   */

  function splitWords(el) {
    var words = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 1) return walk(child);
        if (child.nodeType !== 3 || !child.nodeValue.trim()) return;
        var frag = document.createDocumentFragment();
        child.nodeValue.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(part));
          var w = document.createElement('span');
          w.className = 'bgfx-pw';
          w.textContent = part;
          frag.appendChild(w);
          words.push(w);
        });
        child.parentNode.replaceChild(frag, child);
      });
    })(el);
    return words;
  }

  function mountTextReveal(el) {
    var words = splitWords(el);
    var n = words.length;
    if (!n) return;
    var tint = el.getAttribute('data-text-reveal') === 'color';
    var stagger = num(el.getAttribute('data-text-reveal-stagger'), 22);
    var extra = num(el.getAttribute('data-text-reveal-delay'), 0);
    var fg = toRgb(getComputedStyle(el).color);

    if (tint) {
      var lightText = (0.2126 * fg[0] + 0.7152 * fg[1] + 0.0722 * fg[2]) / 255 > 0.55;
      var colors = list(el.getAttribute('data-text-reveal-colors'));
      if (!colors.length) colors = TEXT_COLORS[lightText ? 'onDark' : 'onLight'];
      var pal = colors.map(toRgb);
      el.style.setProperty('--f', 'rgb(' + fg.join(',') + ')');
      words.forEach(function (w, i) { w.style.setProperty('--lc', paletteAt(pal, i / Math.max(1, n - 1))); inkOf(w, w.parentNode, el); });
      el.classList.add('bgfx-tint');
    }
    el.style.setProperty('--d', num(el.getAttribute('data-text-reveal-duration'), 0.8) + 's');
    el.classList.add('bgfx-pr');

    words[n - 1].addEventListener('animationend', function () { el.classList.add('bgfx-done'); });

    var run = function (offset) {
      words.forEach(function (w, i) { w.style.animationDelay = (offset + extra + i * stagger / 1000) + 's'; });
      el.classList.add('bgfx-run');
    };

    var head = el.previousElementSibling;
    if (head && head.hasAttribute('data-text-glow')) {
      var follow = function () {
        var s = head.__bgfxStart;
        run(Math.max(0, s.lead - (performance.now() - s.at) / 1000));
      };
      if (head.__bgfxStart) follow();
      else head.addEventListener('bgfx:start', follow, { once: true });
      return;
    }
    whenInView(el, function () { run(0); });
  }

  /* ---------- Init ---------- */

  function init(root) {
    root = root || document;
    injectCss();

    root.querySelectorAll('[data-aurora]').forEach(function (el) {
      if (el.__bgfxAurora) return;
      prep(el);
      el.__bgfxAurora = new Aurora(el);
    });

    if (mq('(prefers-reduced-motion: reduce)')) return;

    root.querySelectorAll('[data-text-glow]').forEach(function (el) {
      if (el.__bgfxText) return;
      el.__bgfxText = true;
      mountTextGlow(el);
    });

    root.querySelectorAll('[data-text-reveal]').forEach(function (el) {
      if (el.__bgfxReveal) return;
      el.__bgfxReveal = true;
      mountTextReveal(el);
    });

    // Ambient glyphs (hero loop) run on touch screens too
    root.querySelectorAll('[data-code-bg][data-code-bg-ambient]').forEach(function (el) {
      if (!el.__bgfxGlyphs) el.__bgfxGlyphs = new Glyphs(el);
    });

    // Glyphs need a mouse
    if (!mq('(hover: hover)')) return;
    root.querySelectorAll('[data-code-bg]').forEach(function (el) {
      if (!el.__bgfxGlyphs) el.__bgfxGlyphs = new Glyphs(el);
    });
  }

  // Call BgFx.init() again after injecting new elements (CMS load more, etc.)
  window.BgFx = { init: init };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); });
  else init();
})();


/* ==========================================================================
   20. LOGO MARQUEE WITH A WAVE  [data-logo-marquee]
   --------------------------------------------------------------------------
   An endless strip of logo cards. Hovering a card lifts it and lets the lift
   spill onto its neighbours, falling off with distance, so the row moves
   like a wave rather than one tile jumping on its own.

   Markup
     [data-logo-marquee]                 the clipping window
       [data-logo-marquee-track]         the row that scrolls
         [data-logo-marquee-item]        one card, repeat. Either holds an
                                         <img>, or carries data-logo-src and
                                         data-logo-name and gets one built

   The script clones the items once, so the row can loop at -50% with no
   seam and nothing to measure on resize. Spacing between cards must be a
   margin-right on the item, not a gap on the track: a gap leaves one gap
   short at the join and the loop jumps by that much.

   Optional, on the window
     data-logo-marquee-speed="40"        seconds per lap
     data-logo-marquee-lift="12,6,2"     px for the card, its neighbours,
                                         and the next ones out
   The strip glides to a stop while hovered (section 48), so the card under
   the pointer stays under it.
   ========================================================================== */
function initLogoMarquee() {
  document.querySelectorAll("[data-logo-marquee]").forEach((root) => {
    if (root.hasAttribute("data-logo-marquee-ready")) return;
    const track = root.querySelector("[data-logo-marquee-track]");
    if (!track) return;
    root.setAttribute("data-logo-marquee-ready", "");

    const originals = Array.from(track.querySelectorAll("[data-logo-marquee-item]"));
    if (!originals.length) return;

    /* Logos can come as an <img> built in Designer, or as a URL on the card:
       data-logo-src="..." data-logo-name="React". The URL route exists for
       icons served from a CDN, which Designer will not keep as an image. */
    originals.forEach((item) => {
      const src = item.getAttribute("data-logo-src");
      if (!src || item.querySelector("img")) return;
      const img = document.createElement("img");
      img.className = "logo-card_icon";
      img.src = src;
      img.alt = item.getAttribute("data-logo-name") || "";
      img.loading = "lazy";
      img.decoding = "async";
      item.appendChild(img);
    });
    originals.forEach((item) => {
      const copy = item.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      track.appendChild(copy);
    });

    const speed = parseFloat(root.getAttribute("data-logo-marquee-speed")) || 40;
    root.style.setProperty("--lm-duration", speed + "s");

    const lifts = (root.getAttribute("data-logo-marquee-lift") || "12,6,2")
      .split(",").map(Number);
    const items = Array.from(track.querySelectorAll("[data-logo-marquee-item]"));

    function wave(index) {
      items.forEach((item, i) => {
        const d = index < 0 ? Infinity : Math.abs(i - index);
        item.style.setProperty("--lm-lift", (lifts[d] || 0) + "px");
      });
    }

    items.forEach((item, i) => {
      item.addEventListener("pointerenter", (e) => {
        if (e.pointerType === "touch") return;
        wave(i);
      });
    });
    root.addEventListener("pointerleave", () => wave(-1));

    if (PREFERS_STILL) root.setAttribute("data-logo-marquee-still", "");
  });
}


/* ==========================================================================
   21. HEADER  .header [data-burger] [data-dropdown] [data-sticky-cta]
   ==========================================================================
   Mobile menu (built from the desktop nav), mega dropdown, compact state after
   80px, sticky CTA hidden over the footer banner. Pages with
   [data-nav-theme="light"] start compact. Markup lives in the Header component. */
function initHeader() {
  function run() {
    var h = document.querySelector(".header");
    if (!h) return;
    var c = h.querySelector("[data-sticky-cta]"),
      b = h.querySelector("[data-burger]"),
      links = h.querySelector("[data-mobile-links]"),
      acts = h.querySelector("[data-mobile-actions]"),
      cn = h.querySelector(".container-nav");
    function ddFor(n) {
      var k = n.getAttribute("data-dropdown-trigger");
      return h.querySelector('[data-dropdown="' + k + '"]');
    }
    var arrow =
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 12l4-4-4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var i = 0;
    if (links && !links.children.length) {
      [].slice.call(h.querySelectorAll(".nav-menu .nav-item")).forEach(function (n) {
        var a = document.createElement("a");
        a.className = "div-mobile-link";
        a.href = n.getAttribute("href") || "#";
        a.style.transitionDelay = 0.06 + i * 0.035 + "s";
        i++;
        a.innerHTML = "<span></span>" + arrow;
        a.firstChild.textContent = n.textContent.trim();
        links.appendChild(a);
        var dd = n.hasAttribute("data-dropdown-trigger") && ddFor(n);
        if (dd) {
          a.setAttribute("aria-expanded", "false");
          var s = document.createElement("div");
          s.className = "div-mobile-sub";
          s.innerHTML =
            '<div class="div-mobile-sub-inner"><div class="div-mobile-sub-grid"></div></div>';
          var g = s.querySelector(".div-mobile-sub-grid");
          var cols = dd.querySelectorAll(".div-nav-dropdown-col");
          if (cols.length < 2) g.classList.add("is-single");
          [].slice.call(cols).forEach(function (col) {
            g.appendChild(col.cloneNode(true));
          });
          links.appendChild(s);
          a.addEventListener("click", function (e) {
            e.preventDefault();
            var o = !s.classList.contains("is-open");
            s.classList.toggle("is-open", o);
            a.classList.toggle("is-open", o);
            a.setAttribute("aria-expanded", o);
          });
        }
      });
    }
    var gb = [].slice.call(h.querySelectorAll(".grid-nav a.button,.grid-nav a.button-text"));
    var tx = function (x) {
      return x ? (x.querySelector(".btn-roll_sr") || x).textContent.trim() : "";
    };
    var li = gb.filter(function (x) {
        return /log\s*in/i.test(tx(x));
      })[0],
      bd = gb.filter(function (x) {
        return x !== li;
      })[0];
    if (li) li.classList.add("is-hdr-login");
    if (bd) bd.classList.add("is-hdr-cta");
    if (acts && !acts.children.length) {
      [
        [li, "is-ghost", "Log in"],
        [bd, "is-solid", "Book a strategy call"],
      ].forEach(function (x) {
        var a = document.createElement("a");
        a.className = x[1];
        a.href = (x[0] && x[0].getAttribute("href")) || "#";
        a.textContent = tx(x[0]) || x[2];
        acts.appendChild(a);
      });
    }
    var open = false,
      sy = 0;
    function setOpen(v) {
      if (v === open) return;
      open = v;
      h.classList.toggle("is-menu-open", v);
      if (b) {
        b.setAttribute("aria-expanded", v);
        b.setAttribute("aria-label", v ? "Close menu" : "Open menu");
      }
      document.documentElement.style.overflow = v ? "hidden" : "";
      document.body.style.overflow = v ? "hidden" : "";
    }
    if (b)
      b.addEventListener("click", function (e) {
        e.preventDefault();
        setOpen(!open);
      });
    h.addEventListener("click", function (e) {
      var l = e.target.closest("[data-mobile-menu] a");
      if (open && l && !l.hasAttribute("aria-expanded")) setOpen(false);
    });
    /* Several dropdowns: trigger [data-dropdown-trigger="x"] opens [data-dropdown="x"].
       Only one is open at a time; header gets .is-dd-open and data-dd="x". */
    var tm,
      cur = null,
      pairs = [].slice
        .call(h.querySelectorAll(".nav-menu [data-dropdown-trigger]"))
        .map(function (t) {
          return { t: t, d: ddFor(t) };
        })
        .filter(function (p) {
          return p.d;
        });
    function place() {
      if (!cur) return;
      var r = cur.t.getBoundingClientRect(),
        cb = cn.getBoundingClientRect(),
        w = cur.d.offsetWidth,
        big = cur.d.querySelectorAll(".div-nav-dropdown-col").length > 1,
        x = big ? r.left + r.width / 2 - w / 2 : r.left - 12;
      cur.d.style.left = Math.round(Math.min(Math.max(x, 16), window.innerWidth - w - 16)) + "px";
      cur.d.style.top = Math.round(cb.bottom + 8) + "px";
    }
    function closeCur() {
      if (!cur) return;
      cur.d.classList.remove("is-open");
      cur.t.setAttribute("aria-expanded", "false");
      cur = null;
      h.classList.remove("is-dd-open");
      h.removeAttribute("data-dd");
    }
    function ddShow(p) {
      if (window.innerWidth < 992) return;
      clearTimeout(tm);
      if (cur !== p) closeCur();
      cur = p;
      place();
      p.d.classList.add("is-open");
      p.t.setAttribute("aria-expanded", "true");
      h.classList.add("is-dd-open");
      h.setAttribute("data-dd", p.t.getAttribute("data-dropdown-trigger"));
    }
    function ddHide(now) {
      clearTimeout(tm);
      tm = setTimeout(closeCur, now ? 0 : 160);
    }
    pairs.forEach(function (p) {
      p.t.addEventListener("mouseenter", function () {
        ddShow(p);
      });
      p.t.addEventListener("mouseleave", function () {
        ddHide();
      });
      p.d.addEventListener("mouseenter", function () {
        clearTimeout(tm);
      });
      p.d.addEventListener("mouseleave", function () {
        ddHide();
      });
      p.t.addEventListener("click", function (e) {
        e.preventDefault();
        cur === p ? ddHide(true) : ddShow(p);
      });
    });
    if (pairs.length) {
      document.addEventListener("click", function (e) {
        if (!e.target.closest("[data-dropdown],[data-dropdown-trigger]")) ddHide(true);
      });
      cn.addEventListener("transitionend", function () {
        if (cur) place();
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        setOpen(false);
        ddHide(true);
      }
    });
    var FC = !!document.querySelector('[data-nav-theme="light"]');
    if (FC) {
      h.classList.add("no-tr", "is-compact");
      setTimeout(function () {
        h.classList.remove("no-tr");
      }, 80);
    }
    var stops = [].slice.call(document.querySelectorAll(".footer,.div-banner-footer"));
    var t = false,
      lastW = window.innerWidth;
    function u() {
      t = false;
      var y = window.scrollY || 0;
      var cmp = FC || y > 80;
      if (cmp !== h.classList.contains("is-compact")) h.classList.toggle("is-compact", cmp);
      if (h.classList.contains("is-dd-open")) place();
      if (c) {
        var hide = stops.some(function (s) {
          return s.getBoundingClientRect().top < window.innerHeight - 40;
        });
        var vis = y > window.innerHeight * 0.6 && !hide;
        if (vis !== c.classList.contains("is-visible")) c.classList.toggle("is-visible", vis);
      }
    }
    window.addEventListener(
      "scroll",
      function () {
        if (!t) {
          t = true;
          requestAnimationFrame(u);
        }
      },
      { passive: true },
    );
    window.addEventListener("resize", function () {
      if (window.innerWidth !== lastW) {
        lastW = window.innerWidth;
        if (lastW > 991) setOpen(false);
        if (lastW < 992) ddHide(true);
      }
      u();
    });
    u();
  }
  run();
}

/* ==========================================================================
   23. BUTTON TEXT ROLL  a.button a.button-text [data-btn-roll]
   ==========================================================================
   Splits button labels into letters for the hover roll. data-btn-roll="off"
   opts a button out. Exposed as window.ytBtnRoll for content added later. */
function initButtonRoll() {
  var SEL =
    "a.button,button.button,a.button-text,.cta-banner-widget,.div-button-widget,.div-sticky-cta,.nav a.is-solid,.ev-btn-sm,.ev-btn-block,.ev-btn,.jobs-role-link,.gl-cta_btn,[data-btn-roll]";
  var T = "rgba(0, 0, 0, 0)";
  function leaves(b) {
    if (
      !b.children.length ||
      [].every.call(b.children, function (c) {
        return c.tagName === "SPAN" && !c.children.length && !c.className;
      })
    )
      return [b];
    return [].slice.call(b.querySelectorAll("*")).filter(function (e) {
      return (
        !e.children.length &&
        e.textContent.trim() &&
        !e.closest("svg") &&
        e.tagName !== "SCRIPT" &&
        e.tagName !== "STYLE"
      );
    });
  }
  function split(t) {
    var txt = t.textContent.replace(/\s+/g, " ").trim();
    if (!txt) return;
    var cs = getComputedStyle(t);
    var lh = parseFloat(cs.lineHeight);
    if (!lh) lh = parseFloat(cs.fontSize) * 1.2;
    var sr = document.createElement("span");
    sr.className = "btn-roll_sr";
    sr.textContent = txt;
    var clip = document.createElement("span");
    clip.className = "btn-roll_clip";
    clip.setAttribute("aria-hidden", "true");
    clip.style.setProperty("--rb-lh", lh + "px");
    var i = 0,
      n = txt.replace(/ /g, "").length,
      step = Math.min(0.012, 0.1 / Math.max(n, 1));
    txt.split(" ").forEach(function (w, wi) {
      if (wi) clip.appendChild(document.createTextNode(" "));
      var ws = document.createElement("span");
      ws.className = "btn-roll_w";
      w.split("").forEach(function (ch) {
        var l = document.createElement("span");
        l.className = "btn-roll_l";
        l.textContent = ch;
        l.style.transitionDelay = (i++ * step).toFixed(4) + "s";
        ws.appendChild(l);
      });
      clip.appendChild(ws);
    });
    t.textContent = "";
    t.appendChild(sr);
    t.appendChild(clip);
  }
  function init(b) {
    if (b.__roll || b.getAttribute("data-btn-roll") === "off") return;
    var ls = leaves(b);
    if (!ls.length) return;
    b.__roll = 1;
    ls.forEach(split);
    var cs = getComputedStyle(b);
    if (
      (cs.backgroundColor && cs.backgroundColor !== T && cs.backgroundColor !== "transparent") ||
      cs.boxShadow !== "none"
    )
      b.classList.add("has-bg");
    b.classList.add("btn-roll");
  }
  function run() {
    [].slice.call(document.querySelectorAll(SEL)).forEach(init);
  }
  window.ytBtnRoll = run;
  run();
}

/* ==========================================================================
   24. REVEAL GROUPS  .section .container  [data-reveal-group]
   ==========================================================================
   Blocks rise 2em and fade, .8s power4.inOut, .1s stagger.
   Auto groups: every .section .container(-large). data-reveal-group (with
   data-stagger ms, data-distance, data-start), ="off" disables,
   data-reveal-skip on a child, data-reveal-group-nested staggers children.
   Blocks are split down to rows: every item of a multi-column grid or flex
   row rises on its own (stagger), plain wrappers are opened up, and anything
   with its own surface or its own motion rises whole (see expand). Logo grids ([data-logo-wall]) and
   [data-reveal-each] fade their children in one by one (no rise, 80ms).
   Also appends data-item-slug to links.
   The pre-paint guard (html.rg-wait) stays inline in the Header embed so
   nothing flashes before this file runs. Replaces section 10. */
function initRevealGroups() {
  var root = document.documentElement;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) {
    moveCms();
    return;
  }
  /* Legal pages (.legal-rich): long text reads better standing still, so
     their containers sit out of the reveal (no line-by-line rise). */
  [].forEach.call(document.querySelectorAll(".legal-rich,.career-rich"), function (l) {
    var c = l.closest(".container,.container-large") || l;
    c.setAttribute("data-reveal-group", "off");
  });
  root.classList.add("rg-wait");
  /* Lifting the guard: blocks the reveal does not animate (absolute media,
     legal text, wrappers whose children rise, anything it skipped) used to
     snap in when html.rg-wait went away. Those on screen now fade in over
     .45s instead; blocks GSAP hides itself carry inline styles and are left
     to the reveal. */
  function lift() {
    if (!root.classList.contains("rg-wait")) return;
    var vh = window.innerHeight || 800;
    [].forEach.call(document.querySelectorAll("[data-reveal-group] > *, .section .container > *, .section .container-large > *"), function (el) {
      if (!el.animate || el.style.visibility || el.style.opacity) return;
      var r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= vh || !r.height) return;
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: "cubic-bezier(.2,.7,.2,1)" });
    });
    root.classList.remove("rg-wait");
  }
  var safety = setTimeout(lift, 3000);
  var SKIP = /(^|\s)(spacer[\w-]*|divider[\w-]*|w-embed|w-condition-invisible)(\s|$)/;
  function strip() {
    [].forEach.call(document.querySelectorAll("[data-reveal]"), function (e) {
      e.removeAttribute("data-reveal");
      e.classList.remove("is-armed", "is-in");
    });
  }
  function usable(el) {
    if (
      el.nodeType !== 1 ||
      el.hasAttribute("data-reveal-skip") ||
      el.getAttribute("data-ignore") === "true"
    )
      return false;
    if (SKIP.test(el.className || "")) return false;
    var cs = getComputedStyle(el);
    if (cs.display === "none" || cs.position === "absolute" || cs.position === "fixed")
      return false;
    return (
      (el.textContent || "").trim().length > 0 || !!el.querySelector("img,svg,video,canvas,picture")
    );
  }
  /* Logo grids and [data-reveal-each]: children fade in one by one, no rise. */
  var EACH = "[data-reveal-each],[data-logo-wall]";
  function eachKids(el) {
    var host = el.matches(EACH) ? el : el.querySelector(EACH);
    if (!host) return null;
    var k = [].filter.call(host.children, usable);
    return k.length ? k : null;
  }
  /* Split a block into what should rise one by one.
     - Rows (multi-column grids, flex rows) with 2+ items: every item.
     - Plain wrappers (no background, border or shadow): recurse, so a
       heading stack rises line by line and a card grid deeper inside still
       staggers card by card.
     - Anything with its own surface, and widgets that move their children
       themselves (marquees, sliders, rotators, tabs), rise as one piece. */
  var ATOMIC =
    ".swiper,[data-swiper-group],[data-logo-marquee],[data-ab-values-list],[data-ab-ms]," +
    "[data-process],[data-sticky],[data-acc],[data-seg],[data-orbit-layer],[data-full-rows]," +
    ".w-tabs,.w-slider,[data-reveal-atomic],canvas,video,picture,img,svg,a,button,h1,h2,h3,h4,h5,h6,p";
  function isRow(el, cs, n) {
    if (n < 2) return false;
    if (cs.display === "grid" || cs.display === "inline-grid")
      return (cs.gridTemplateColumns || "").trim().split(/\s+/).length > 1;
    if (cs.display === "flex" || cs.display === "inline-flex")
      return cs.flexDirection.indexOf("row") === 0;
    return false;
  }
  function hasSurface(cs) {
    return (
      (cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) ||
      cs.backgroundImage !== "none" ||
      parseFloat(cs.borderTopWidth) > 0 ||
      parseFloat(cs.borderBottomWidth) > 0 ||
      parseFloat(cs.borderLeftWidth) > 0 ||
      cs.boxShadow !== "none"
    );
  }
  function expand(el, depth) {
    depth = depth || 0;
    if (el.matches(ATOMIC) || el.closest(".swiper")) return [el];
    var kids = [].filter.call(el.children, usable);
    if (!kids.length) return [el];
    if (el.hasAttribute("data-reveal-group-nested")) return kids;
    /* Text made of inline pieces (a number and its unit, etc.) stays whole. */
    if (kids.every(function (k) { return /^(SPAN|STRONG|EM|B|I|SUP|SUB|BR)$/.test(k.tagName); })) return [el];
    var cs = getComputedStyle(el);
    if (hasSurface(cs)) return [el];
    if (isRow(el, cs, kids.length)) {
      /* A strip of 6+ small controls (A-Z letters, chips, pills, tags) rises
         as one piece: letter-by-letter looks like a picket fence. */
      if (kids.length >= 6 && kids.every(function (k) { return k.offsetHeight < 64 && k.offsetWidth < 240; })) return [el];
      return kids;
    }
    if (depth >= 5) return [el];
    var out = [];
    kids.forEach(function (k) {
      out = out.concat(expand(k, depth + 1));
    });
    return out;
  }
  function groups() {
    var list = [].slice.call(
      document.querySelectorAll('[data-reveal-group]:not([data-reveal-group="off"])'),
    );
    [].forEach.call(
      document.querySelectorAll(".section .container,.section .container-large"),
      function (c) {
        if (c.closest('header,footer,nav,[data-reveal-group="off"]')) return;
        if (
          list.some(function (g) {
            return g === c || g.contains(c) || c.contains(g);
          })
        )
          return;
        list.push(c);
      },
    );
    return list;
  }
  function moveCms() {
    [].forEach.call(document.querySelectorAll("a[data-item-slug]"), function (a) {
      var s = a.getAttribute("data-item-slug"),
        h = (a.getAttribute("href") || "").replace(/\/$/, ""),
        bases = { technology: "/technology", roles: "/roles", industries: "/industries", product: "/product" },
        t = a.getAttribute("data-menu-type");
      if (!s) return;
      /* Static fallback to the hub (SEO: no redirecting legacy URLs in HTML). */
      if (h === "/hire-talent" || h.indexOf("/hire/") === 0) return;
      // API-set links publish "#" or "detail_<collection>": rebuild from data-menu-type.
      if ((!h || h === "#" || h.indexOf("#/") === 0 || h.indexOf("detail_") === 0) && bases[t]) h = bases[t];
      if (h.slice(-(s.length + 1)) !== "/" + s) a.setAttribute("href", h + "/" + s);
    });
  }
  /* After a jump (anchor link, restored scroll, fast fling) a batch can hold
     dozens of items that are already above the viewport. Show those at once
     and stagger only what is on screen, with the whole stagger capped at
     0.6s, so a long list never leaves the viewport blank for seconds. */
  function settlePassed(b, to) {
    var passed = [], rest = [];
    b.forEach(function (el) { (el.getBoundingClientRect().bottom < 0 ? passed : rest).push(el); });
    if (passed.length) gsap.set(passed, Object.assign({}, to, { clearProps: "transform,opacity,visibility" }));
    return rest;
  }
  function capStagger(step, n) {
    return n > 1 ? Math.min(step, 0.6 / (n - 1)) : step;
  }
  function init() {
    moveCms();
    strip();
    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
      lift();
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    groups().forEach(function (g) {
      if (g.__rg) return;
      g.__rg = 1;
      var dist = g.getAttribute("data-distance") || "2em";
      var stag = (parseFloat(g.getAttribute("data-stagger")) || 100) / 1000;
      var start = g.getAttribute("data-start") || "top 90%";
      var items = [];
      var fades = [];
      [].filter.call(g.children, usable).forEach(function (c) {
        var kids = eachKids(c);
        if (kids) fades = fades.concat(kids);
        else items = items.concat(expand(c));
      });
      if (fades.length) {
        gsap.set(fades, { autoAlpha: 0 });
        ScrollTrigger.batch(fades, {
          start: start,
          once: true,
          onEnter: function (b) {
            b = settlePassed(b, { autoAlpha: 1 });
            if (!b.length) return;
            gsap.to(b, {
              autoAlpha: 1,
              duration: 0.6,
              ease: "power2.out",
              stagger: capStagger(0.08, b.length),
              overwrite: true,
              onComplete: function () {
                gsap.set(b, { clearProps: "opacity,visibility" });
              },
            });
          },
        });
      }
      if (!items.length) return;
      gsap.set(items, { y: dist, autoAlpha: 0 });
      ScrollTrigger.batch(items, {
        start: start,
        once: true,
        onEnter: function (b) {
          b = settlePassed(b, { y: 0, autoAlpha: 1 });
          if (!b.length) return;
          gsap.to(b, {
            y: 0,
            autoAlpha: 1,
            duration: 0.8,
            ease: "power4.inOut",
            stagger: capStagger(stag, b.length),
            overwrite: true,
            onComplete: function () {
              gsap.set(b, { clearProps: "transform,opacity,visibility" });
            },
          });
        },
      });
    });
    clearTimeout(safety);
    lift();
    ScrollTrigger.refresh();
  }
  init();
}

/* ==========================================================================
   25. GLOW BACKGROUND  [data-glow-bg]
   ==========================================================================
   WebGL "voice glow" (ref: libraries.dev/voice): a colour field rising from
   the bottom edge with a bright rim, sweeping side to side and leaning
   toward the cursor. Optional data-glow-colors (4 hex), -reach, -gain,
   -speed, -quality.
   Several glows on one page get different looks by their order on the page
   (mirrored sweep, off-centre column, shifted colour order, reach), so cards
   in a row never look identical. data-glow-variant="0-5" picks one by hand.
   The .glow-bg canvas styles stay in Global Styles [After]. */
function initGlowBg() {
  var VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";
  var FS = [
    "precision highp float;",
    "uniform vec2 uRes;uniform float uTime;uniform float uAmp;uniform float uReach;uniform float uBlend;uniform float uGain;",
    "uniform vec3 uC0;uniform vec3 uC1;uniform vec3 uC2;uniform vec3 uC3;uniform vec2 uM;uniform vec2 uP;uniform float uHov;uniform vec4 uV;",
    "vec3 permute(vec3 x){return mod(((x*34.0)+1.0)*x,289.0);}",
    "float snoise(vec2 v){const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.0);vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);m=m*m;m=m*m;vec3 x=2.0*fract(p*C.www)-1.0;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.0*dot(m,g);}",
    "vec3 ramp(float s){s=fract(s)*4.0;if(s<1.0)return mix(uC0,uC1,s);if(s<2.0)return mix(uC1,uC2,s-1.0);if(s<3.0)return mix(uC2,uC3,s-2.0);return mix(uC3,uC0,s-3.0);}",
    /* Voice-glow look: a colour field that rises from the bottom edge, sweeps
       side to side, leans toward the cursor, with a bright rim at the base. */
    "void main(){vec2 uv=gl_FragCoord.xy/uRes;float ux=uv.x;float t=uTime;float asp=uRes.x/uRes.y;if(uV.x>0.5)uv.x=1.0-uv.x;",
    "uv.x-=uM.x*0.04;",
    "float sw=uV.y+(0.24-0.3*abs(uV.y-0.5))*sin(t*0.33)+0.06*sin(t*0.91+1.3);float cx=mix(sw,uP.x,uHov*0.7);",
    "float dx=(uv.x-cx)*min(asp,2.0);",
    "float n1=snoise(vec2(uv.x*0.9+t*0.08,t*0.15));",
    "float H=0.12*uReach*(0.78+0.3*n1);",
    "float col=exp(-dx*dx*1.7);",
    "float I=col*exp(-uv.y/max(H,0.02));",
    "I+=0.22*exp(-uv.y/0.07)*smoothstep(1.6,0.2,abs(dx));",
    /* Rim: a shallow arc that stays inside the block edge to edge (it used
       to dip to the bottom edge and fade out before the sides on wide cards). */
    "float rimY=0.034+0.03*exp(-dx*dx*2.2);float rim=exp(-pow((uv.y-rimY)/0.012,2.0))*(0.35+0.65*exp(-dx*dx*1.4));",
    "vec2 dp=(uv-uP)*vec2(asp,1.0);float bloom=uHov*0.45*exp(-dot(dp,dp)*6.0);",
    "I=uGain*0.95*I+bloom;",
    "vec3 c=ramp(ux*0.8+uv.y*0.25+0.12*sin(t*0.27)+0.05*n1+uV.z);",
    "c=mix(c,vec3(1.0),0.4*exp(-uv.y/0.04)*col);",
    "vec3 o=c*min(I,1.1)+vec3(0.9,0.94,1.0)*rim*0.8*uGain;",
    "float a=clamp(max(max(o.r,o.g),o.b),0.0,1.0);",
    "o+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-0.5)/255.0;",
    "gl_FragColor=vec4(clamp(o,0.0,1.0),a);}",
  ].join("\n");
  function rgb(hex) {
    hex = hex.replace("#", "");
    if (hex.length === 3)
      hex = hex
        .split("")
        .map(function (c) {
          return c + c;
        })
        .join("");
    var n = parseInt(hex, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function sh(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  /* [mirror, centre, colour shift, reach x] per variant; 0 is the original look.
     Variants differ only in motion and shape. The colour shift stays 0 and the
     colour ramp ignores the mirror, so every glow on the site shows the same
     Figma palette in the same order (steel blue left, mauve and peach right). */
  var VARS = [
    [0, 0.5, 0, 1],
    [1, 0.32, 0, 0.9],
    [0, 0.68, 0, 1.12],
    [1, 0.42, 0, 1],
    [0, 0.58, 0, 0.95],
    [1, 0.28, 0, 1.08],
  ];
  /* One shared WebGL context for every glow (16 Nov 2026). Each glow used to
     open its own context; browsers keep only a handful alive (iOS Safari
     fewer than desktop Chrome), so on long pages and on phones the older
     glows were dropped and fell back to the static picture. Now one hidden
     canvas renders each visible glow in turn and copies the frame into that
     glow's own 2D canvas. */
  var GR = null;
  function glowRenderer() {
    if (GR !== null) return GR || null;
    var cv = document.createElement("canvas");
    var gl = cv.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true, powerPreference: "low-power" });
    if (!gl) { GR = false; return null; }
    var SOFT = softGL(gl);
    var vs = sh(gl, gl.VERTEX_SHADER, VS), fs = sh(gl, gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { GR = false; return null; }
    var pr = gl.createProgram();
    gl.attachShader(pr, vs);
    gl.attachShader(pr, fs);
    gl.linkProgram(pr);
    gl.useProgram(pr);
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var u = {};
    ["uRes", "uTime", "uAmp", "uReach", "uBlend", "uGain", "uC0", "uC1", "uC2", "uC3", "uM", "uP", "uHov", "uV"].forEach(function (n) {
      u[n] = gl.getUniformLocation(pr, n);
    });
    gl.clearColor(0, 0, 0, 0);
    var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches,
      list = [],
      raf = 0,
      dead = false;
    cv.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      list.forEach(function (i) {
        i.wrap.classList.add("is-fallback");
        i.cv.style.display = "none";
      });
    });
    function paint(i, ms) {
      if (dead || !i.w || !i.h) return;
      i.mx += (i.tx - i.mx) * 0.04;
      i.my += (i.ty - i.my) * 0.04;
      i.hv += (i.th - i.hv) * 0.05;
      if (cv.width !== i.w || cv.height !== i.h) {
        cv.width = i.w;
        cv.height = i.h;
      }
      gl.viewport(0, 0, i.w, i.h);
      gl.uniform2f(u.uRes, i.w, i.h);
      gl.uniform1f(u.uAmp, i.amp);
      gl.uniform1f(u.uReach, i.reach * i.V[3]);
      gl.uniform4f(u.uV, i.V[0], i.V[1], i.V[2], i.V[3]);
      gl.uniform1f(u.uBlend, i.blend);
      gl.uniform1f(u.uGain, i.gain);
      gl.uniform3fv(u.uC0, i.colors[0]);
      gl.uniform3fv(u.uC1, i.colors[1]);
      gl.uniform3fv(u.uC2, i.colors[2]);
      gl.uniform3fv(u.uC3, i.colors[3]);
      /* Mirrored variants flip the cursor too, so the lean still follows it. */
      var fx = i.V[0] ? -i.mx : i.mx;
      gl.uniform2f(u.uM, fx, -i.my);
      gl.uniform2f(u.uP, (fx + 1) / 2, 1 - (i.my + 1) / 2);
      gl.uniform1f(u.uHov, i.hv);
      gl.uniform1f(u.uTime, ms * 0.001 * i.speed + i.phase);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      i.ctx.clearRect(0, 0, i.w, i.h);
      i.ctx.drawImage(cv, 0, 0);
    }
    /* Client batch 25 Nov (lag on the client's laptop): the glow moves slowly,
       so it is drawn at about 30 fps instead of every frame. Each draw is a
       WebGL pass plus a copy into the glow's own canvas, so pages with many
       live covers (blog, podcast, events) did twice the work for no visible
       difference. */
    var lastTs = -1e9;
    function loop(ts) {
      raf = 0;
      if (document.hidden || dead) return;
      var any = false, due = ts - lastTs >= 30;
      if (due) lastTs = ts;
      list.forEach(function (i) {
        if (!i.vis) return;
        if (i.t0 === null) i.t0 = ts - i.last;
        i.last = ts - i.t0;
        if (due) paint(i, i.last);
        any = true;
      });
      if (any) raf = requestAnimationFrame(loop);
    }
    function start() { if (!RM && !SOFT && !raf && !dead) raf = requestAnimationFrame(loop); }
    var gated = false;
    function update(i) {
      if (list.indexOf(i) < 0) list.push(i);
      if (!i.vis) i.t0 = null;
      if (MOTION.on && !SOFT) { start(); return; }
      /* Before the first interaction (or on software WebGL): one still frame. */
      if (i.vis && !i.painted) {
        i.painted = 1;
        requestAnimationFrame(function () { if (!dead) paint(i, i.last || 0); });
      }
      if (!gated && !SOFT) { gated = true; whenMotion(start); }
    }
    document.addEventListener("visibilitychange", function () {
      list.forEach(function (i) {
        i.t0 = null;
      });
      if (MOTION.on) start();
    });
    GR = { paint: paint, update: update };
    return GR;
  }
  var count = 0;
  function init(el) {
    if (el.__au) return;
    el.__au = 1;
    var vi = parseInt(el.getAttribute("data-glow-variant"), 10);
    var V = VARS[(isNaN(vi) ? count : vi) % VARS.length];
    count++;
    /* Default palette from the Figma glows and illustration backdrops: steel
       blue, mauve, peach, dusty rose (muted, like the design, not neon). */
    var colors = (el.getAttribute("data-glow-colors") || "#5b78b0,#a77895,#d99a86,#c48ea9")
      .split(",")
      .map(function (s) {
        return rgb(s.trim());
      });
    while (colors.length < 4) colors.push(colors[colors.length - 1]);
    var reach = parseFloat(el.getAttribute("data-glow-reach")) || 2.6,
      amp = parseFloat(el.getAttribute("data-glow-amp")) || 1,
      blend = parseFloat(el.getAttribute("data-glow-blend")) || 0.6,
      gain = parseFloat(el.getAttribute("data-glow-gain")) || 1.3,
      speed = parseFloat(el.getAttribute("data-glow-speed")) || 1,
      q = Math.min(1, Math.max(0.25, parseFloat(el.getAttribute("data-glow-quality")) || 0.6));
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.style.isolation = "isolate";
    var wrap = document.createElement("div");
    wrap.className = "glow-bg";
    wrap.setAttribute("aria-hidden", "true");
    /* Hosts that switch their children (accordion media panes) hide every
       child that is not the active layer; the glow is not a layer. */
    wrap.style.setProperty("opacity", "1", "important");
    wrap.style.setProperty("visibility", "visible", "important");
    var cv = document.createElement("canvas");
    wrap.appendChild(cv);
    el.insertBefore(wrap, el.firstChild);
    var ctx = cv.getContext("2d");
    var R = glowRenderer();
    if (!ctx || !R) {
      wrap.classList.add("is-fallback");
      return;
    }
    var inst = {
      el: el, cv: cv, ctx: ctx, wrap: wrap, V: V, colors: colors,
      reach: reach, amp: amp, blend: blend, gain: gain, speed: speed,
      /* Each block starts at its own point of the sweep, so cards in a row differ. */
      phase: Math.random() * 40,
      mx: 0, my: 0, tx: 0, ty: 0, hv: 0, th: 0,
      vis: false, last: 8000, t0: null, w: 0, h: 0,
    };
    /* Cursor drift: the glow leans a little toward the pointer (eased). */
    window.addEventListener("pointermove", function (e) {
      if (!inst.vis) return;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var px = ((e.clientX - r.left) / r.width) * 2 - 1, py = ((e.clientY - r.top) / r.height) * 2 - 1;
      inst.tx = Math.max(-1, Math.min(1, px));
      inst.ty = Math.max(-1, Math.min(1, py));
      /* Light bloom follows the cursor while it is over the block. */
      inst.th = px >= -1 && px <= 1 && py >= -1 && py <= 1 ? 1 : 0;
    }, { passive: true });
    function size() {
      var d = Math.min(window.devicePixelRatio || 1, 2) * q;
      inst.w = cv.width = Math.max(1, Math.round(el.clientWidth * d));
      inst.h = cv.height = Math.max(1, Math.round(el.clientHeight * d));
      R.paint(inst, inst.last);
    }
    if ("ResizeObserver" in window) new ResizeObserver(size).observe(el);
    else window.addEventListener("resize", size);
    size();
    if ("IntersectionObserver" in window)
      new IntersectionObserver(
        function (e) {
          inst.vis = e[0].isIntersecting;
          R.update(inst);
        },
        { rootMargin: "100px" },
      ).observe(el);
    else {
      inst.vis = true;
      R.update(inst);
    }
  }
  function run() {
    /* CMS media with no image (case studies without a photo yet): use the
       YouTube poster of the case video when there is one (maxres, falling
       back to mqdefault, both 16:9 without letterbox bars); only media with
       no video either get the glow panel instead of an empty box. Fewer glow
       panels also keeps the page under the browser's WebGL context limit,
       which showed a "lost context" face in the last cards. */
    [].slice.call(document.querySelectorAll("[data-yt-popup],[data-glow-fallback]")).forEach(function (m) {
      var im = m.querySelector("img");
      if (!im || (im.getAttribute("src") && !im.classList.contains("w-dyn-bind-empty")) || m.hasAttribute("data-glow-bg")) return;
      var raw = m.getAttribute("data-yt-id") || "";
      var mt = raw.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/) || raw.match(/^([\w-]{11})$/);
      if (mt) {
        im.classList.remove("w-dyn-bind-empty");
        im.setAttribute("data-yt-poster", "");
        im.onerror = function () {
          im.onerror = null;
          im.src = "https://i.ytimg.com/vi/" + mt[1] + "/mqdefault.jpg";
        };
        im.src = "https://i.ytimg.com/vi/" + mt[1] + "/maxresdefault.jpg";
        return;
      }
      m.setAttribute("data-glow-bg", "");
      m.style.backgroundColor = "#000";
      if (getComputedStyle(m).position === "static") m.style.position = "relative";
    });
    /* Engagement models media box (home): the glow rose only a third of the
       box and drifted to one corner (mirrored variant), so the widget floated
       over a dark gap (client, 26 Nov). Centred variant as in the process
       blocks, and a longer reach so it lights the bottom of the card. */
    document.querySelectorAll(".div-ways-media:not([data-glow-reach])").forEach(function (m) { m.setAttribute("data-glow-reach", "3.8"); m.setAttribute("data-glow-variant", "0"); });
    /* Contexts are created only when a glow comes near the viewport, so pages
       with many glow cards (case studies slider) do not open them all at once. */
    var all = [].slice.call(document.querySelectorAll("[data-glow-bg]"));
    if (!("IntersectionObserver" in window)) {
      all.forEach(init);
      return;
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        init(en.target);
      });
    }, { rootMargin: "300px" });
    all.forEach(function (el) {
      io.observe(el);
    });
  }
  /* Glow on demand for blocks created later (live widget slots). */
  window.ytGlow = function (el) {
    el.setAttribute("data-glow-bg", "");
    if (!("IntersectionObserver" in window)) return init(el);
    var o = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      o.disconnect();
      init(el);
    }, { rootMargin: "300px" });
    o.observe(el);
  };
  run();
}

/* ==========================================================================
   26. FULL ROWS  [data-full-rows]
   ==========================================================================
   Hides grid items that would leave a partial last row. Exposed as
   window.ytFullRows (used by 27). */
function initFullRows() {
  function rows(g) {
    var it = [].slice.call(g.children).filter(function (c) {
      return !c.classList.contains("w-condition-invisible");
    });
    it.forEach(function (c) {
      c.classList.remove("is-row-hidden", "is-last-row");
    });
    var cols = getComputedStyle(g).gridTemplateColumns.split(" ").filter(Boolean).length || 1;
    var lim = parseInt(g.getAttribute("data-full-rows"), 10);
    var keep;
    if (lim > 0) {
      var n = Math.min(it.length, lim);
      keep = n < cols ? n : Math.floor(n / cols) * cols;
    } else {
      var max = cols >= 6 ? 1 : cols >= 4 ? 2 : 3;
      keep = Math.min(Math.max(cols, Math.floor(it.length / cols) * cols), cols * max);
    }
    it.forEach(function (c, i) {
      if (i >= keep) c.classList.add("is-row-hidden");
      else if (i >= keep - cols) c.classList.add("is-last-row");
    });
  }
  window.ytFullRows = rows;
  function run() {
    var gs = [].slice.call(document.querySelectorAll("[data-full-rows]"));
    gs.forEach(rows);
    var tr;
    window.addEventListener("resize", function () {
      clearTimeout(tr);
      tr = setTimeout(function () {
        gs.forEach(rows);
      }, 150);
    });
  }
  run();
}

/* ==========================================================================
   27. LOGO WALL SWAP  [data-logo-wall]
   ==========================================================================
   Cells swap logos one at a time from the pool (CMS source, then cells,
   then [data-logo-wall-pool]). data-logo-wall-slots, data-logo-wall-cell. */
function initLogoWall() {
  var E = "cubic-bezier(0.87,0,0.13,1)";
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)),
        x = a[i];
      a[i] = a[j];
      a[j] = x;
    }
    return a;
  }
  function key(im) {
    return im.getAttribute("src");
  }
  function setImg(im, p) {
    im.setAttribute("src", p.src);
    if (p.srcset) im.setAttribute("srcset", p.srcset);
    else im.removeAttribute("srcset");
    if (p.sizes) im.setAttribute("sizes", p.sizes);
    else im.removeAttribute("sizes");
    im.alt = p.alt || "";
    /* Linked logos (partner grid): the link travels with the logo. */
    if (p.href) im.setAttribute("data-lw-href", p.href);
    else im.removeAttribute("data-lw-href");
  }
  function link(im) {
    var a = im.closest && im.closest("a[href]");
    return a ? a.getAttribute("href") : null;
  }
  function relink(cell, im) {
    var h = im.getAttribute("data-lw-href"),
      a = cell.matches && cell.matches("a[href]") ? cell : cell.querySelector("a[href]");
    if (h && a) {
      a.setAttribute("href", h);
      if (im.alt) a.setAttribute("aria-label", im.alt);
    }
  }
  function rec(im) {
    return {
      src: key(im),
      srcset: im.getAttribute("srcset"),
      sizes: im.getAttribute("sizes"),
      alt: im.alt,
      href: im.getAttribute("data-lw-href") || link(im),
    };
  }
  function init(wall) {
    if (wall.__lw) return;
    wall.__lw = 1;
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var cells = [].slice.call(
      wall.querySelectorAll(wall.getAttribute("data-logo-wall-cell") || ".div-logo-teaser"),
    );
    cells = cells.filter(function (c) {
      if (c.closest(".w-condition-invisible")) {
        c.remove();
        return false;
      }
      return true;
    });
    var poolEl = wall.parentNode.querySelector("[data-logo-wall-pool]");
    var seen = {},
      pool = [];
    function add(im) {
      var k = key(im);
      if (!k || seen[k]) return;
      seen[k] = 1;
      pool.push(rec(im));
    }
    var src = wall.hasAttribute("data-logo-wall-own")
      ? []
      : [].slice.call(
          document.querySelectorAll(
            "[data-logo-wall-source] .w-dyn-item:not(.w-condition-invisible) img",
          ),
        );
    function ord(i) {
      var v = parseFloat(i.closest(".w-dyn-item").getAttribute("data-order"));
      return isNaN(v) ? 1e9 : v;
    }
    src
      .map(function (im, i) {
        return { im: im, o: ord(im), i: i };
      })
      .sort(function (a, b) {
        return a.o - b.o || a.i - b.i;
      })
      .forEach(function (x) {
        add(x.im);
      });
    var cms = pool.length > 0;
    if (!cms) {
      cells.forEach(function (c) {
        var im = c.querySelector("img");
        if (im) add(im);
      });
      if (poolEl) [].slice.call(poolEl.querySelectorAll("img")).forEach(add);
    }
    var ms = wall.getAttribute("data-logo-wall-slots");
    var max = ms === "auto" ? 0 : parseInt(ms, 10) || 10;
    if (max && cells.length > max) {
      cells.slice(max).forEach(function (c) {
        c.remove();
      });
      cells = cells.slice(0, max);
    } else if (max && cells.length && cells.length < max) {
      var n = cells.length;
      for (var k = n; k < max; k++) {
        var cl = cells[k % n].cloneNode(true);
        cells[n - 1].parentNode.appendChild(cl);
        cells.push(cl);
      }
    }
    if (wall.hasAttribute("data-full-rows") && window.ytFullRows) window.ytFullRows(wall);
    var slots = [];
    cells.forEach(function (c) {
      var im = c.querySelector("img");
      if (!im) return;
      var h0 = link(im);
      if (h0 && !im.hasAttribute("data-lw-href")) im.setAttribute("data-lw-href", h0);
      var t = document.createElement("span");
      t.className = "lw-target";
      im.parentNode.insertBefore(t, im);
      t.appendChild(im);
      slots.push({ cell: c, t: t, img: im });
    });
    if (!slots.length || !pool.length) return;
    if (cms)
      slots.forEach(function (s, i) {
        s.img.removeAttribute("loading");
        setImg(s.img, pool[i % pool.length]);
      });
    function vis(s) {
      return !!s.cell.offsetParent;
    }
    function counts() {
      var m = {};
      slots.forEach(function (s) {
        if (!vis(s)) return;
        var k = key(s.img);
        m[k] = (m[k] || 0) + 1;
      });
      return m;
    }
    var used = {};
    slots
      .filter(vis)
      .concat(
        slots.filter(function (s) {
          return !vis(s);
        }),
      )
      .forEach(function (s) {
        var k = key(s.img);
        if (used[k]) {
          var free = pool.filter(function (p) {
            return !used[p.src];
          })[0];
          if (free) {
            setImg(s.img, free);
            k = free.src;
          }
        }
        used[k] = 1;
      });
    var queue = shuffle(
      pool
        .filter(function (p) {
          return !used[p.src];
        })
        .concat(
          shuffle(
            pool.filter(function (p) {
              return used[p.src];
            }),
          ),
        ),
    );
    if (pool.length < 2) return;
    var order = [],
      oi = 0;
    function nextSlot() {
      if (oi >= order.length) {
        order = shuffle(
          slots.map(function (_, i) {
            return i;
          }),
        );
        oi = 0;
      }
      return slots[order[oi++]];
    }
    function pick(cur) {
      var m = counts();
      for (var i = 0; i < queue.length; i++) {
        if (!m[queue[i].src]) return queue.splice(i, 1)[0];
      }
      var best = -1,
        bc = 1e9;
      queue.forEach(function (p, i) {
        if (p.src === cur) return;
        var c = m[p.src] || 0;
        if (c < bc) {
          bc = c;
          best = i;
        }
      });
      return best < 0 ? null : queue.splice(best, 1)[0];
    }
    var busy = false;
    function swap() {
      if (busy) return;
      var s,
        n = 0;
      /* The cell under the pointer never swaps: hovering a logo used to see
         it replaced by another one mid-read. */
      function ok(x) {
        return vis(x) && !(x.cell.matches && x.cell.matches(":hover"));
      }
      do {
        s = nextSlot();
      } while (!ok(s) && ++n < slots.length);
      if (!ok(s)) return;
      var cur = key(s.img);
      var p = pick(cur);
      if (!p) return;
      var out = s.img,
        inc = out.cloneNode(false);
      inc.removeAttribute("loading");
      setImg(inc, p);
      busy = true;
      function go() {
        s.t.appendChild(inc);
        relink(s.cell, inc);
        var a = out.animate(
          [
            { transform: "translateY(0)", opacity: 1 },
            { transform: "translateY(-50%)", opacity: 0 },
          ],
          { duration: 900, easing: E, fill: "forwards" },
        );
        inc.animate(
          [
            { transform: "translateY(50%)", opacity: 0 },
            { transform: "translateY(0)", opacity: 1 },
          ],
          { duration: 900, delay: 100, easing: E, fill: "backwards" },
        );
        s.img = inc;
        queue.push(rec(out));
        var done = function () {
          out.remove();
          busy = false;
        };
        a.finished ? a.finished.then(done, done) : setTimeout(done, 950);
      }
      if (inc.complete && inc.naturalWidth) go();
      else {
        inc.onload = go;
        inc.onerror = function () {
          busy = false;
          queue.push(p);
        };
      }
    }
    var timer = null,
      inView = false;
    function play() {
      if (timer || reduce || !inView || document.hidden) return;
      timer = setInterval(swap, 1500);
    }
    function stop() {
      clearInterval(timer);
      timer = null;
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        inView = en[0].isIntersecting;
        inView ? play() : stop();
      }).observe(wall);
    } else {
      inView = true;
      play();
    }
    document.addEventListener("visibilitychange", function () {
      document.hidden ? stop() : play();
    });
  }
  function run() {
    /* Partner network grid (/for-partners): same bottom-up swap as the logo
       walls on Home and About. 12 cells (2 rows of 6 on desktop, full rows at
       3 and 2 columns too) cycle through all partners; each partner's link
       moves with its logo. Uses only its own logos, never the client pool. */
    [].slice
      .call(document.querySelectorAll("[data-partners-network] .partners-grid"))
      .forEach(function (g) {
        if (g.hasAttribute("data-logo-wall")) return;
        g.setAttribute("data-logo-wall", "");
        g.setAttribute("data-logo-wall-own", "");
        g.setAttribute("data-logo-wall-cell", ".w-dyn-item");
        g.setAttribute("data-logo-wall-slots", "12");
      });
    [].slice.call(document.querySelectorAll("[data-logo-wall]")).forEach(init);
  }
  run();
}

/* ==========================================================================
   28. SEGMENTED CONTROL  [data-seg] .div-seg
   ==========================================================================
   Buttons [data-seg-btn] switch panes [data-seg-pane]; a sliding pill marks
   the active button. Arrow keys move between buttons. The rate calculator
   segments (.rc-seg) use the same pill, so every toggle on the site slides. */
function initSegmented() {
  document.querySelectorAll("[data-seg]").forEach(function (root) {
    var b = root.querySelectorAll("[data-seg-btn]"),
      p = root.querySelectorAll("[data-seg-pane]");
    b.forEach(function (x) {
      x.addEventListener("click", function (e) {
        e.preventDefault();
        var i = x.getAttribute("data-seg-btn");
        b.forEach(function (y) {
          y.classList.toggle("is-active", y === x);
          y.setAttribute("aria-selected", y === x);
        });
        p.forEach(function (q) {
          q.classList.toggle("is-hidden", q.getAttribute("data-seg-pane") !== i);
        });
      });
    });
  });
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function init(seg) {
    if (seg.__pill) return;
    seg.__pill = 1;
    var btns = [].slice.call(seg.querySelectorAll("[data-seg-btn], .rc-seg_btn"));
    if (btns.length < 2) return;
    var root = seg.closest("[data-seg]");
    var pill = document.createElement("span");
    pill.className = "seg-pill";
    pill.setAttribute("aria-hidden", "true");
    seg.insertBefore(pill, seg.firstChild);
    seg.classList.add("is-pill");
    var cur = Math.max(
      0,
      btns.findIndex(function (b) {
        return b.classList.contains("is-active") || b.getAttribute("aria-pressed") === "true";
      }),
    );
    function place(i, anim) {
      var b = btns[i],
        W = seg.clientWidth,
        l = b.offsetLeft,
        r = W - l - b.offsetWidth;
      var dir = i > cur ? 1 : i < cur ? -1 : 0;
      if (!anim || RM || !dir) {
        pill.style.transition = "none";
        pill.style.setProperty("--seg-l", l + "px");
        pill.style.setProperty("--seg-r", r + "px");
        pill.offsetWidth;
        pill.style.transition = "";
      } else {
        var d = ".09s";
        pill.style.transitionDelay = dir > 0 ? d + ",0s,0s" : "0s," + d + ",0s";
        pill.style.setProperty("--seg-l", l + "px");
        pill.style.setProperty("--seg-r", r + "px");
      }
      cur = i;
    }
    place(cur, false);
    /* Other modules (Events) can move the pill when they pick the start tab. */
    seg.__segSelect = function (btn) {
      var i = btns.indexOf(btn);
      /* Skip when the pill is already there: re-placing without transition
         would snap a slide that the click just started. */
      if (i > -1 && i !== cur) place(i, false);
    };
    btns.forEach(function (b, i) {
      b.setAttribute("aria-selected", i === cur);
      b.setAttribute("tabindex", i === cur ? "0" : "-1");
      b.addEventListener("pointerdown", function () {
        seg.classList.add("is-pressed");
      });
      b.addEventListener("click", function () {
        var prev = cur;
        place(i, true);
        btns.forEach(function (x, k) {
          x.setAttribute("tabindex", k === i ? "0" : "-1");
        });
        if (prev !== i && root && !RM) {
          var p = root.querySelector('[data-seg-pane="' + b.getAttribute("data-seg-btn") + '"]');
          if (p)
            requestAnimationFrame(function () {
              p.animate(
                [
                  { opacity: 0, transform: "translateY(.75rem)" },
                  { opacity: 1, transform: "none" },
                ],
                { duration: 600, easing: "cubic-bezier(.625,.05,0,1)" },
              );
            });
        }
      });
      b.addEventListener("keydown", function (e) {
        var k = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!k) return;
        e.preventDefault();
        var n = btns[(i + k + btns.length) % btns.length];
        n.focus();
        n.click();
      });
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
      seg.addEventListener(ev, function () {
        seg.classList.remove("is-pressed");
      });
    });
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        place(cur, false);
      }, 100);
    });
    if (document.fonts && document.fonts.ready)
      document.fonts.ready.then(function () {
        place(cur, false);
      });
  }
  function run() {
    [].slice.call(document.querySelectorAll(".div-seg, .rc-seg")).forEach(init);
  }
  run();
}

/* ==========================================================================
   29. PROCESS STEPS  [data-process]
   ==========================================================================
   Scroll-driven, Figma Technologies "Process". The media column is sticky
   (native, .div-process-media). While the steps scroll past the middle of
   the viewport the blue line (.div-process-line-fill) grows down to the
   current point, the step whose number has passed it becomes .is-active and
   the image with the same data-process-image index fades in. Clicking a step
   scrolls it to that point. */
function initProcessSteps() {
  const roots = Array.from(document.querySelectorAll("[data-process]"));
  if (!roots.length) return;

  const items = roots.map((root) => ({
    root,
    steps: Array.from(root.querySelectorAll("[data-process-step]")),
    images: Array.from(root.querySelectorAll("[data-process-image]")),
    line: root.querySelector(".div-process-line"),
    fill: root.querySelector(".div-process-line-fill"),
    current: -1,
    pin: null,
  }));

  /* Step images are lazy in Webflow; an image that only starts loading when
     its step turns active pops in late, so all of them load up front. */
  items.forEach((it) => it.images.forEach((img) => {
    if (img.loading === "lazy") img.loading = "eager";
    /* Decode ahead too, so the first switch to a step does not wait for it. */
    if (img.decode) img.decode().catch(function () {});
  }));

  const trigger = () => window.innerHeight * 0.5;
  const anchor = (step) => {
    const num = step.querySelector(".div-process-num") || step;
    const r = num.getBoundingClientRect();
    return r.top + r.height / 2;
  };

  function update() {
    const vh = window.innerHeight;
    items.forEach((it) => {
      if (!it.steps.length) return;
      /* The trigger sits in the middle of the screen. Near the end of the
         block it slides down to the bottom edge as the block bottom comes in,
         so the last steps light up one after another (3, then 4) instead of
         jumping straight to the last one. */
      const dist = it.root.getBoundingClientRect().bottom - (vh - 24);
      const t = Math.max(vh * 0.5, Math.min(vh, vh - dist));
      let active = 0;
      it.steps.forEach((step, i) => {
        if (anchor(step) <= t) active = i;
      });
      const last = it.steps.length - 1;
      const atEnd = dist <= 0 && anchor(it.steps[last]) < vh;
      if (atEnd) active = last;
      /* Client, 15 Nov 2026: a clicked step stays the active one (blue) until
         the visitor scrolls on, also near the end of the block where the
         scroll position alone would light the last step. */
      if (it.pin !== null) active = it.pin;
      if (it.line && it.fill) {
        const r = it.line.getBoundingClientRect();
        const h = it.pin !== null
          ? Math.max(0, Math.min(r.height, anchor(it.steps[it.pin]) - r.top))
          : atEnd ? r.height : Math.max(0, Math.min(r.height, t - r.top));
        it.fill.style.height = h + "px";
      }
      if (active === it.current) return;
      it.current = active;
      it.steps.forEach((step, i) => step.classList.toggle("is-active", i === active));
      it.images.forEach((img) =>
        img.classList.toggle("is-active", +img.getAttribute("data-process-image") === active)
      );
    });
  }

  items.forEach((it) => {
    it.steps.forEach((step, i) => {
      step.addEventListener("click", () => {
        it.pin = i;
        it.current = -1;
        update();
        const y = window.scrollY + anchor(step) - trigger() + 2;
        window.scrollTo({ top: y, behavior: PREFERS_STILL ? "auto" : "smooth" });
      });
    });
  });

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      update();
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  const unpin = () => { items.forEach((it) => { it.pin = null; }); };
  ["wheel", "touchmove", "keydown"].forEach((ev) => window.addEventListener(ev, unpin, { passive: true }));
  update();
}

/* ==========================================================================
   30. TABLE OF CONTENTS  [data-toc] [data-toc-source]
   ==========================================================================
   Builds links from the h3s of the article body and highlights the current one. */
function initToc() {
  var src = document.querySelector("[data-toc-source]"),
    list = document.querySelector("[data-toc]");
  if (src && list) {
    /* Hire pages (CMS SEO content) use h2 sections; blog/glossary bodies h3.
       The "Related skills" block added by initHirePage is not a section. */
    var hs = [].slice.call(src.querySelectorAll(document.querySelector("[data-hp-related],[data-hp-talent]") ? "h2" : "h3")).filter(function (h) { return !h.closest("[data-hp-related]"); });
    if (!hs.length) {
      list.parentNode.style.display = "none";
      return;
    }
    hs.forEach(function (h, i) {
      if (!h.id)
        h.id =
          "s" +
          (i + 1) +
          "-" +
          h.textContent
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 60);
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.className = "div-toc-link";
      a.innerHTML =
        '<span class="div-toc-arrow"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="8" fill="#0059ED"/><path d="M6.5 11L9.5 8L6.5 5" stroke="white" stroke-linecap="round"/></svg></span><span></span>';
      a.lastChild.textContent = h.textContent;
      list.appendChild(a);
    });
    var l = list.querySelectorAll("a");
    function on() {
      var x = 0;
      hs.forEach(function (h, i) {
        if (h.getBoundingClientRect().top < 180) x = i;
      });
      l.forEach(function (a, i) {
        a.classList.toggle("is-active", i === x);
      });
    }
    window.addEventListener("scroll", on, { passive: true });
    on();
  }
}

/* ==========================================================================
   31. VIDEO POPUP  [data-yt-popup]
   ==========================================================================
   YouTube lightbox. data-yt-id (id or URL), data-yt-name for the label. */
function initVideoPopup() {
  var m = null,
    last = null;
  function ytId(v) {
    v = (v || "").trim();
    var x = v.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([\w-]{11})/);
    if (x) return x[1];
    return /^[\w-]{11}$/.test(v) ? v : "";
  }
  function esc(e) {
    if (e.key === "Escape") close();
  }
  function open(id, from) {
    if (!id || m) return;
    last = from;
    try {
      window.dispatchEvent(new CustomEvent("ytp:pauseall"));
    } catch (_) {}
    m = document.createElement("div");
    m.className = "ytm";
    m.setAttribute("role", "dialog");
    m.setAttribute("aria-modal", "true");
    m.setAttribute("aria-label", "Video");
    m.innerHTML =
      '<button type="button" class="ytm-close" aria-label="Close video"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button><div class="ytm-box"><iframe src="https://www.youtube-nocookie.com/embed/' +
      encodeURIComponent(id) +
      '?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&cc_load_policy=0&enablejsapi=1&origin=' + encodeURIComponent(location.origin) + '" title="Video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>';
    document.body.appendChild(m);
    /* The films carry their own burned-in subtitles: YouTube's caption track
       (on by viewer preference or auto) is switched off once the player runs. */
    (function (fr) {
      if (!fr) return;
      fr.addEventListener("load", function () {
        var n = 0;
        var t = setInterval(function () {
          if (!fr.isConnected || n++ > 16) { clearInterval(t); return; }
          try {
            ["captions", "cc"].forEach(function (k) {
              fr.contentWindow.postMessage(JSON.stringify({ event: "command", func: "unloadModule", args: [k] }), "*");
            });
          } catch (e) {}
        }, 600);
      });
    })(m.querySelector("iframe"));
    document.documentElement.style.overflow = "hidden";
    m.addEventListener("click", function (e) {
      if (!e.target.closest(".ytm-box")) close();
    });
    document.addEventListener("keydown", esc);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (m) m.classList.add("is-open");
      });
    });
    m.querySelector(".ytm-close").focus({ preventScroll: true });
  }
  function close() {
    if (!m) return;
    var x = m;
    m = null;
    document.removeEventListener("keydown", esc);
    x.classList.remove("is-open");
    setTimeout(function () {
      x.remove();
    }, 360);
    document.documentElement.style.overflow = "";
    if (last && last.focus) last.focus({ preventScroll: true });
  }
  function init(el) {
    if (el.__ytm) return;
    el.__ytm = 1;
    var id = ytId(el.getAttribute("data-yt-id"));
    if (!id) {
      el.setAttribute("data-yt-empty", "");
      return;
    }
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    var n = el.getAttribute("data-yt-name");
    el.setAttribute("aria-label", n ? "Play " + n + " case study video" : "Play video");
    var go = function (e) {
      e.preventDefault();
      open(id, el);
    };
    el.addEventListener("click", go);
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") go(e);
    });
  }
  function run() {
    ytHomePopup();
    [].slice.call(document.querySelectorAll("[data-yt-popup]")).forEach(init);
  }
  run();
}

/* ==========================================================================
   32. VIDEO PLAYER  [data-yt-player]
   ==========================================================================
   Background or inline YouTube player with custom controls (Video component). */
/* Home, video under the hero: it opens in the same popup as the case study
   films instead of playing inline. The poster and play button stay. Runs
   before either video init, whichever comes first. */
function ytHomePopup() {
  if (location.pathname !== "/") return;
  [].slice.call(document.querySelectorAll("[data-yt-player]")).forEach(function (el) {
    el.removeAttribute("data-yt-player");
    el.setAttribute("data-yt-popup", "");
    el.setAttribute("data-yt-state", "bg");
    el.setAttribute("data-yt-playing", "false");
    el.style.cursor = "pointer";
  });
}

function initVideoPlayer() {
  ytHomePopup();
  var Q = [];
  function yt(cb) {
    if (window.YT && window.YT.Player) return cb();
    Q.push(cb);
    if (window.__ytApiLoading) return;
    window.__ytApiLoading = 1;
    var prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (prev) prev();
      Q.splice(0).forEach(function (f) {
        f();
      });
    };
    var s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  }
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function fmt(t) {
    t = Math.max(0, Math.floor(t || 0));
    var m = Math.floor(t / 60),
      s = t % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  var I = {
    play: '<svg data-i="play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.52.85l10.4-6.5a1 1 0 0 0 0-1.7L9.52 4.65A1 1 0 0 0 8 5.5Z"/></svg>',
    pause:
      '<svg data-i="pause" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    vol: '<svg data-i="vol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    muted:
      '<svg data-i="muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>',
    fs: '<svg data-i="fs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  };
  function init(el) {
    if (el.__ytp) return;
    var id = el.getAttribute("data-yt-id");
    if (!id) return;
    el.__ytp = 1;
    var A = function (k, v) {
      el.setAttribute("data-yt-" + k, v);
    };
    A("state", "bg");
    A("playing", "false");
    A("muted", "true");
    A("hover", "false");
    var stage = document.createElement("div");
    stage.className = "ytp-stage";
    var holder = document.createElement("div");
    stage.appendChild(holder);
    el.insertBefore(stage, el.firstChild);
    var dim = document.createElement("div");
    dim.className = "ytp-dim";
    el.appendChild(dim);
    var hit = document.createElement("button");
    hit.type = "button";
    hit.className = "ytp-hit";
    hit.setAttribute("aria-label", "Play video");
    el.appendChild(hit);
    var ui = document.createElement("div");
    ui.className = "ytp-ui";
    ui.innerHTML =
      '<button type="button" class="ytp-btn" data-a="toggle" aria-label="Play or pause">' +
      I.play +
      I.pause +
      '</button><span class="ytp-time"><span data-t="cur">0:00</span> / <span data-t="dur">0:00</span></span><div class="ytp-bar"><div class="ytp-fill"></div><input type="range" min="0" max="1000" step="1" value="0" aria-label="Seek"></div><button type="button" class="ytp-btn" data-a="mute" aria-label="Mute or unmute">' +
      I.vol +
      I.muted +
      '</button><button type="button" class="ytp-btn" data-a="fs" aria-label="Fullscreen">' +
      I.fs +
      "</button>";
    el.appendChild(ui);
    var cur = ui.querySelector('[data-t="cur"]'),
      dur = ui.querySelector('[data-t="dur"]'),
      fill = ui.querySelector(".ytp-fill"),
      range = ui.querySelector("input");
    var canFs = !!(el.requestFullscreen || el.webkitRequestFullscreen);
    if (!canFs) A("nofs", "");
    var player = null,
      ready = false,
      mode = "bg",
      inView = false,
      pending = false,
      poll = null,
      dragging = false,
      lastT = 0,
      hoverT = null,
      ptype = "mouse";
    function size() {
      var f = stage.querySelector("iframe");
      if (!f) return;
      var w = el.clientWidth,
        h = el.clientHeight;
      if (!w || !h) return;
      var r = 16 / 9,
        W,
        H;
      if (w / h > r) {
        W = w;
        H = w / r;
      } else {
        H = h;
        W = h * r;
      }
      var cut = Math.min(120, h * 0.16);
      if (H < h + cut) {
        H = h + cut;
        W = H * r;
      }
      f.style.width = Math.ceil(W + 2) + "px";
      f.style.height = Math.ceil(H + 2) + "px";
    }
    if ("ResizeObserver" in window) new ResizeObserver(size).observe(el);
    else window.addEventListener("resize", size);
    function create() {
      if (player) return;
      yt(function () {
        player = new YT.Player(holder, {
          host: "https://www.youtube-nocookie.com",
          videoId: id,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            mute: 1,
            controls: 0,
            loop: 1,
            playlist: id,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            disablekb: 1,
            fs: 0,
            cc_load_policy: 0,
            enablejsapi: 1,
            origin: location.origin,
          },
          events: { onReady: onReady, onStateChange: onState },
        });
      });
    }
    /* Captions: the video has its own burned-in subtitles and the player has
       no CC button, so YouTube's caption track (on by viewer preference or
       auto) is unloaded every time playback starts. */
    function noCc() {
      try {
        player.unloadModule("captions");
        player.unloadModule("cc");
      } catch (_) {}
    }
    function onReady() {
      ready = true;
      noCc();
      var f = stage.querySelector("iframe");
      if (f) {
        f.setAttribute("tabindex", "-1");
        f.setAttribute("aria-hidden", "true");
        f.setAttribute("title", "Background video");
      }
      size();
      player.mute();
      if (pending) {
        pending = false;
        start();
        return;
      }
      if (!RM && inView) player.playVideo();
    }
    function onState(e) {
      var S = YT.PlayerState;
      if (e.data === S.PLAYING) {
        noCc();
        /* The poster stays on top for a moment after playback starts, so
           YouTube's start/loop overlay (title, gradient, prev/next) is never
           seen; it fades out once the frame is clean. */
        clearTimeout(el.__liveT);
        el.__liveT = setTimeout(function () {
          A("live", "");
        }, 1400);
        /* Background loop: jump back just before the end instead of letting
           YouTube end and restart, which flashes its end/start overlay. */
        clearInterval(el.__bgL);
        el.__bgL = setInterval(function () {
          if (mode === "active" || !player || !player.getDuration) return;
          var d = player.getDuration() || 0,
            t = player.getCurrentTime() || 0;
          if (d && t >= d - 0.6) player.seekTo(0, true);
        }, 300);
        if (mode === "active") {
          A("seen", "");
          A("playing", "true");
          tick();
        }
      } else if (e.data === S.PAUSED) {
        clearTimeout(el.__liveT);
        clearInterval(el.__bgL);
        el.removeAttribute("data-yt-live");
        if (mode === "active") A("playing", "false");
      } else if (e.data === S.ENDED) {
        clearTimeout(el.__liveT);
        el.removeAttribute("data-yt-live");
        if (mode === "active") exitActive();
        else if (inView && !RM) player.playVideo();
      }
    }
    function setMuted(m) {
      A("muted", m ? "true" : "false");
    }
    function start() {
      if (!player || !ready) {
        pending = true;
        create();
        return;
      }
      mode = "active";
      A("state", "active");
      player.unMute();
      player.setVolume(100);
      setMuted(false);
      player.seekTo(0, true);
      player.playVideo();
      A("playing", "true");
      lastT = 0;
      tick();
      showUi();
    }
    function exitActive() {
      mode = "bg";
      A("state", "bg");
      el.removeAttribute("data-yt-seen");
      A("playing", "false");
      stopTick();
      if (document.fullscreenElement === el && document.exitFullscreen) document.exitFullscreen();
      if (!player) return;
      player.mute();
      setMuted(true);
      player.seekTo(0, true);
      if (inView && !RM) player.playVideo();
      else player.pauseVideo();
    }
    function toggle() {
      if (mode !== "active") return start();
      if (el.getAttribute("data-yt-playing") === "true") {
        player.pauseVideo();
        A("playing", "false");
      } else {
        player.playVideo();
        A("playing", "true");
      }
      showUi();
    }
    function tick() {
      stopTick();
      poll = setInterval(update, 250);
      update();
    }
    function stopTick() {
      clearInterval(poll);
      poll = null;
    }
    function update() {
      if (!player || !player.getDuration) return;
      var d = player.getDuration() || 0,
        t = player.getCurrentTime() || 0;
      if (mode === "active" && el.getAttribute("data-yt-playing") === "true") {
        if (d && t >= d - 0.35) {
          exitActive();
          return;
        }
        if (t + 1 < lastT && !dragging) {
          exitActive();
          return;
        }
      }
      lastT = t;
      dur.textContent = fmt(d);
      cur.textContent = fmt(t);
      if (!dragging && d) {
        range.value = Math.round((t / d) * 1000);
        fill.style.width = (t / d) * 100 + "%";
      }
    }
    function showUi() {
      A("hover", "true");
      clearTimeout(hoverT);
      hoverT = setTimeout(function () {
        if (!dragging) A("hover", "false");
      }, 2500);
    }
    el.addEventListener("pointermove", function (e) {
      if (e.pointerType === "mouse") showUi();
    });
    el.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "mouse") {
        clearTimeout(hoverT);
        A("hover", "false");
      }
    });
    hit.addEventListener("pointerdown", function (e) {
      ptype = e.pointerType || "mouse";
    });
    hit.addEventListener("click", function (e) {
      e.preventDefault();
      if (
        ptype === "touch" &&
        mode === "active" &&
        el.getAttribute("data-yt-playing") === "true" &&
        el.getAttribute("data-yt-hover") !== "true"
      ) {
        showUi();
        return;
      }
      toggle();
    });
    ui.addEventListener("click", function (e) {
      var b = e.target.closest("[data-a]");
      e.stopPropagation();
      showUi();
      if (!b || !player) return;
      var a = b.getAttribute("data-a");
      if (a === "toggle") toggle();
      else if (a === "mute") {
        if (player.isMuted()) {
          player.unMute();
          player.setVolume(100);
          setMuted(false);
        } else {
          player.mute();
          setMuted(true);
        }
      } else if (a === "fs") {
        var fe = document.fullscreenElement || document.webkitFullscreenElement;
        if (fe) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
          (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
        }
      }
    });
    range.addEventListener("input", function () {
      dragging = true;
      var d = player && player.getDuration ? player.getDuration() : 0;
      fill.style.width = range.value / 10 + "%";
      if (d) cur.textContent = fmt((range.value / 1000) * d);
      showUi();
    });
    range.addEventListener("change", function () {
      var d = player && player.getDuration ? player.getDuration() : 0;
      if (d) {
        player.seekTo((range.value / 1000) * d, true);
        lastT = (range.value / 1000) * d;
      }
      dragging = false;
    });
    document.addEventListener("keydown", function (e) {
      if (mode !== "active" || !el.contains(document.activeElement)) return;
      if (e.key === "Escape" && !document.fullscreenElement) exitActive();
    });
    window.addEventListener("ytp:pauseall", function () {
      if (mode === "active" && player) {
        player.pauseVideo();
        A("playing", "false");
      }
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        function (en) {
          if (en[0].isIntersecting) create();
        },
        { rootMargin: "400px 0px" },
      ).observe(el);
      new IntersectionObserver(
        function (en) {
          inView = en[0].isIntersecting;
          if (!player || !ready) return;
          if (inView) {
            if (mode === "bg" && !RM) player.playVideo();
          } else {
            if (mode === "bg") player.pauseVideo();
            else if (el.getAttribute("data-yt-playing") === "true") {
              player.pauseVideo();
              A("playing", "false");
            }
          }
        },
        { threshold: 0.2 },
      ).observe(el);
    } else {
      inView = true;
      create();
    }
    document.addEventListener("visibilitychange", function () {
      if (!player || !ready || mode !== "bg") return;
      if (document.hidden) player.pauseVideo();
      else if (inView && !RM) player.playVideo();
    });
  }
  function run() {
    [].slice.call(document.querySelectorAll("[data-yt-player]")).forEach(init);
  }
  run();
}

/* ==========================================================================
   33. HIRE ORBIT  .section.is-dark-hire [data-orbit]
   ==========================================================================
   CTA [Hire] holds the orbit natively: .hire-orbit[data-orbit-layer] with the
   ellipse lines (DOM svg) and static icon cards [data-orbit-card]. This only
   moves the cards along the middle ellipse and fits the layer height to the
   heading divider on every page. --f fades a card near the bottom edge. */
function initHireOrbit() {
  var W = 1280,
    H = 397,
    CX = 640,
    CY = 649.5,
    RX = 622,
    RY = 656.5,
    SPEED = 3,
    D = Math.PI / 180;
  function init(L) {
    var sec = L.closest("section") || L.parentNode;
    if (sec.__orbit) return;
    sec.__orbit = 1;
    var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var head = sec.querySelector(".container");
    function fit() {
      if (!head) return;
      var os = parseFloat(getComputedStyle(L).getPropertyValue("--os")) || 1;
      var h = head.getBoundingClientRect().bottom - sec.getBoundingClientRect().top;
      if (h > 0) L.style.height = h / os + "px";
    }
    fit();
    if ("ResizeObserver" in window && head) new ResizeObserver(fit).observe(head);
    else window.addEventListener("resize", fit);
    var cards = [].slice.call(L.querySelectorAll("[data-orbit-card]")),
      N = cards.length;
    if (!N) return;
    var STEP = 360 / N,
      t0 = 0,
      last = null,
      raf = 0,
      vis = false;
    function draw() {
      for (var k = 0; k < N; k++) {
        var a = (t0 + k * STEP) % 360;
        if (a > 180) a -= 360;
        var r = a * D,
          x = CX + RX * Math.sin(r),
          y = CY - RY * Math.cos(r),
          c = cards[k];
        if (y > H + 60) {
          c.style.visibility = "hidden";
          continue;
        }
        var f = Math.max(0, Math.min(1, (H + 40 - y) / 200));
        c.style.setProperty("--f", f.toFixed(3));
        c.style.transform = "translate3d(" + x.toFixed(2) + "px," + y.toFixed(2) + "px,0)";
        c.style.visibility = "visible";
      }
    }
    function loop(ts) {
      if (last !== null) t0 = (t0 + ((ts - last) / 1000) * SPEED) % 360;
      last = ts;
      draw();
      raf = requestAnimationFrame(loop);
    }
    function play() {
      if (raf || RM) return;
      if (!MOTION.on) { draw(); whenMotion(play); return; }
      last = null;
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    draw();
    if ("IntersectionObserver" in window)
      new IntersectionObserver(function (e) {
        vis = e[0].isIntersecting;
        vis && !document.hidden ? play() : stop();
      }).observe(L);
    else play();
    document.addEventListener("visibilitychange", function () {
      document.hidden ? stop() : vis && play();
    });
  }
  function run() {
    [].slice.call(document.querySelectorAll("[data-orbit-layer]")).forEach(init);
  }
  run();
}

/* ==========================================================================
   34. LOGO MARQUEE FILL  [data-logo-marquee]
   ==========================================================================
   After 20 has built the track: adds copies until the loop covers two
   viewports and keeps the speed constant. Runs on window load. */
function initLogoMarqueeFill() {
  function fill(m) {
    var t = m.querySelector("[data-logo-marquee-track]");
    if (!t) return;
    var base = [].slice.call(t.children).filter(function (c) {
      return !c.hasAttribute("aria-hidden");
    });
    if (!base.length) return;
    var n = Math.round(t.children.length / base.length) || 2;
    var P = t.scrollWidth / n;
    if (!P) return;
    var V = m.clientWidth,
      need = Math.ceil((2 * V) / P);
    if (need % 2) need++;
    if (need <= n) return;
    for (var k = n; k < need; k++)
      base.forEach(function (b) {
        var c = b.cloneNode(true);
        c.setAttribute("aria-hidden", "true");
        t.appendChild(c);
      });
    var sp = parseFloat(m.getAttribute("data-logo-marquee-speed")) || 45;
    m.style.setProperty("--lm-duration", (sp * need) / 2 + "s");
  }
  function run() {
    var ms = [].slice.call(document.querySelectorAll("[data-logo-marquee]"));
    if (!ms.length) return;
    var tries = 0;
    (function wait() {
      var ok = ms.every(function (m) {
        return m.hasAttribute("data-logo-marquee-ready");
      });
      if (ok || tries++ > 40) {
        ms.forEach(fill);
        var to;
        window.addEventListener("resize", function () {
          clearTimeout(to);
          to = setTimeout(function () {
            ms.forEach(fill);
          }, 200);
        });
      } else setTimeout(wait, 100);
    })();
  }
  document.readyState === "complete" ? run() : window.addEventListener("load", run);
}

/* ==========================================================================
   35. CAL.COM POPUP + LOGIN  "Book a call" / "Book a strategy call" / [data-cal-link], "Log in"
   ==========================================================================
   Every booking button on the site opens the Cal.com popup (yotewo/strategy-call,
   month view) instead of navigating. Triggers are found by their label
   ("Book a call...", "Book a strategy call") or by data-cal-link, through one
   delegated click, so cloned buttons (mobile menu, sticky CTA, CMS cards) work
   too. Native Cal.com modal; the link keeps the real
   cal.com URL (set in Webflow, filled in here if a button still has "#"),
   and the click is intercepted, so a booking button never leaves the page. The embed script loads on the first hover/focus of a
   trigger, or when the browser is idle, so it never blocks the page.
   "Log in" links (header, mobile menu, "Log in to see more") go to the app. */
var CAL_NS = "strategy-call",
  CAL_LINK = "yotewo/strategy-call",
  APP_URL = "https://app.yotewo.com/";
function calLabel(a) {
  return ((a.querySelector(".btn-roll_sr") || a).textContent || "").replace(/\s+/g, " ").trim();
}
function isCalTrigger(a) {
  return a.hasAttribute("data-cal-link") || a.hasAttribute("data-cal-trigger") || /^book (a )?(strategy )?call\b/i.test(calLabel(a));
}
function calLoad() {
  if (window.Cal && Cal.ns && Cal.ns[CAL_NS]) return;
  (function (C, A, L) {
    var p = function (a, ar) {
      a.q.push(ar);
    };
    var d = C.document;
    C.Cal =
      C.Cal ||
      function () {
        var cal = C.Cal;
        var ar = arguments;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          d.head.appendChild(d.createElement("script")).src = A;
          cal.loaded = true;
        }
        if (ar[0] === L) {
          var api = function () {
            p(api, arguments);
          };
          var namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === "string") {
            cal.ns[namespace] = cal.ns[namespace] || api;
            p(cal.ns[namespace], ar);
            p(cal, ["initNamespace", namespace]);
          } else p(cal, ar);
          return;
        }
        p(cal, ar);
      };
  })(window, "https://app.cal.com/embed/embed.js", "init");
  Cal("init", CAL_NS, { origin: "https://app.cal.com" });
  Cal.config = Cal.config || {};
  Cal.config.forwardQueryParams = true;
  Cal.ns[CAL_NS]("ui", { hideEventTypeDetails: false, layout: "month_view" });
}
function calOpen() {
  calLoad();
  Cal.ns[CAL_NS]("modal", {
    calLink: CAL_LINK,
    config: { layout: "month_view", useSlotsViewOnSmallScreen: "true" },
  });
}
function initCalEmbed() {
  var tag = function () {
    document.querySelectorAll("a, button").forEach(function (a) {
      if (a.__calT) return;
      if (isCalTrigger(a)) {
        a.__calT = 1;
        /* The real booking URL stays on the link (crawlers, middle-click,
           no-JS); the delegated click below opens the popup instead. */
        if (a.tagName === "A") {
          var h = a.getAttribute("href");
          if (!h || h === "#") a.setAttribute("href", "https://cal.com/" + CAL_LINK);
          a.removeAttribute("target");
        }
        a.setAttribute("aria-haspopup", "dialog");
      } else if (a.tagName === "A" && /^log ?in\b/i.test(calLabel(a))) {
        a.__calT = 1;
        a.setAttribute("href", APP_URL);
      }
    });
  };
  /* FAQ footer row ("Didn't find the answer... Book a Call", avatars): the
     whole row is the trigger, a button for keyboard and screen readers. */
  var tagFaq = function () {
    document.querySelectorAll(".div-faq-avatars").forEach(function (av) {
      var row = av.parentElement;
      if (!row || row.hasAttribute("data-cal-trigger") || row.closest("a, button")) return;
      row.setAttribute("data-cal-trigger", "");
      row.setAttribute("role", "button");
      row.setAttribute("tabindex", "0");
      row.setAttribute("aria-label", "Book a call");
      row.classList.add("is-cal-row");
    });
  };
  tagFaq();
  tag();
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.hasAttribute && e.target.hasAttribute("data-cal-trigger")) {
      e.preventDefault();
      calOpen();
    }
  });
  /* Buttons added later (mobile menu clone, CMS lists, popups). */
  setTimeout(tag, 1200);
  window.addEventListener("load", tag);
  document.addEventListener(
    "click",
    function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest("a, button, [data-cal-trigger]");
      if (!a || !isCalTrigger(a)) return;
      e.preventDefault();
      calOpen();
    },
    true,
  );
  var warm = function (e) {
    var a = e.target.closest && e.target.closest("a, button, [data-cal-trigger]");
    if (a && isCalTrigger(a)) calLoad();
  };
  document.addEventListener("pointerover", warm, { passive: true });
  document.addEventListener("focusin", warm);
  /* No idle preload (17 Nov, page speed): the Cal.com embed is heavy third-party
     JS, so it loads only on hover/focus of a booking button, or on the click. */
}


/* ==========================================================================
   TITLE GLOW EVERYWHERE  h1, section and secondary titles
   ==========================================================================
   The brand letter animation (bg-fx data-text-glow="letters": letter entrance
   on dark blocks, cursor colour play on light ones) was set per heading in
   the components. This gives it to every page title (h1) and every h2, h3 and
   h4 of 20px and up that does not have it yet: section titles and secondary
   titles alike (process steps, stage titles, CTA titles, slider cards).
   Left out: text inside rich text, legal and article bodies, links, buttons,
   live widgets and the nav, small labels and FAQ questions (under 20px),
   gradient-clipped titles (their letters would vanish), and anything marked
   data-text-glow-off. */
function initTitleGlow() {
  var SKIP = ".w-richtext,.text-rich-text,.legal-rich,.div-article-body,a,button,.lw,.nav,[data-text-glow-off]";
  var n = 0;
  document.querySelectorAll("h1:not([data-text-glow]),h2:not([data-text-glow]),h3:not([data-text-glow]),h4:not([data-text-glow])").forEach(function (h) {
    /* Rich text is skipped (blog and legal body copy), except the role page
       description (.career-rich), whose section headings are page titles. */
    if ((h.closest(SKIP) && !h.closest(".career-rich")) || !h.textContent.trim()) return;
    var cs = getComputedStyle(h);
    if (h.tagName !== "H1" && parseFloat(cs.fontSize) < 20) return;
    /* Gradient-clipped titles (background-clip: text) already carry their own
       colour; split letters would lose the clip and turn invisible. */
    if (cs.webkitTextFillColor === "rgba(0, 0, 0, 0)" || /text/.test(cs.backgroundClip || cs.webkitBackgroundClip || "")) return;
    h.setAttribute("data-text-glow", "letters");
    if (!h.hasAttribute("data-text-glow-stagger")) h.setAttribute("data-text-glow-stagger", "18");
    n++;
  });
  if (n && window.BgFx) window.BgFx.init(document);
  /* Lifts the pre-paint guard (Global Styles [Before]) that keeps h1 hidden
     until it is split into letters, so the plain title never flashes first. */
  document.documentElement.classList.add("yt-tg");
}

/* Podcast covers (Nov 2026). The cover art is drawn in HTML instead of the
   baked-in webp: gradient, thin lines cut from the Yotewo logo (wing curve,
   V strokes, head ring) at a scale, angle and offset that differ per episode,
   guests top right, "Yotewo(TM) Podcast #N" bottom left with the episode
   topic in grey under it (wide covers only). The webp stays in the DOM for
   its alt text but is hidden. Sizes follow the cover width (container query
   units), so the same markup serves the feature, the cards and the episode
   page. Styles: Global Styles [After], embed 61. */
var YT_LOGO_PATHS = [
  "M20.449 10.8259C21.9005 8.89182 24.8264 8.50604 26.1512 8.53482C25.4888 8.73628 23.9913 9.27172 22.9545 9.96245C21.6586 10.8259 21.2266 12.5527 19.1531 16.2654C17.0796 19.978 16.1292 19.3736 14.4014 19.3736C13.1572 19.2355 11.5503 17.9922 10.9455 16.3517C10.7767 15.3061 10.825 14.4426 10.8978 13.6971C10.5063 13.4545 10.0912 13.1884 9.64956 12.898C8.39161 12.071 8.20088 11.2864 8.12044 10.7354C7.47067 10.8558 6.71767 10.8354 5.84814 10.3078C8.11013 9.65476 8.00854 9.96893 8.12044 10.7354C9.27839 10.521 10.1085 9.85969 10.6863 10.8259C11.1843 11.6586 11.0112 12.5344 10.8978 13.6971C13.4161 15.2578 14.9562 15.8452 16.3021 15.661C17.9463 15.4359 18.6347 13.2434 20.449 10.8259Z",
  "M16.2482 26.0001L26.1518 8.53375C25.4909 8.56235 24.3343 8.81459 23.1473 9.67854C22.5493 10.1684 21.9855 10.8636 21.3738 11.5207C20.7921 12.2714 20.2191 13.0949 19.7232 14.2405C19.1605 15.5408 18.6057 16.4918 18.0726 17.1804C16.422 19.1702 15.032 18.9962 14.1633 18.7368C14.2212 19.2401 14.3196 20.6967 14.9452 22.4952C15.5706 24.2937 16.0745 25.5811 16.2482 26.0001Z",
  "M10.9182 16.4667L16.2844 26.0001C16.1113 25.5802 15.6093 24.2897 14.9862 22.487C14.363 20.6844 14.0918 19.2246 14.0341 18.7201C13.2574 18.501 11.647 17.7667 10.9182 16.4667Z",
  "M18.1405 10.9644A2.9506 2.9644 0 1 1 12.2392 10.9644A2.9506 2.9644 0 1 1 18.1405 10.9644Z"
];
/* Logo lines on podcast and blog covers (client, 15 Nov 2026: the lines
   must follow the Yotewo logo icon and be one whole contour). The line is
   the exact outline of the logo icon (yotewo-logo-white.svg, the same mark
   as Figma Logo 906:20746, scaled to Figma units): the icon's six vector
   pieces united with a vector boolean (paper.js), so every curve is the
   logo's own Bezier, with no tracing. Checked against the filled icon at 200 px per
   unit: identical except two source slivers (pieces of the icon that do
   not quite meet): a 0.05 unit double bottom tip, merged into one, and a
   spike at the arm-to-body corner. Client 15 Nov: that corner showed as a
   hook, then as a kink, on the covers; it is now a curvature-continuous
   blend (a quintic with zero curvature where it leaves the straight V
   edge, 4.5 units below the corner, and the curvature of the body edge
   where it joins it near the neck, written as twelve cubic pieces; peak
   curvature 0.15 per unit, at most 0.28 unit inside the icon corner;
   the client chose smoothness over exactness here), hugging the filled
   icon. Every other
   join is tangent-continuous; the sharp turns left belong to the icon
   (wing tip, bottom tip, left arm tip, right armpit, arm leaf, neck). The two places where the line touches itself (the left arm
   leaf and the neck where the arm meets the body) are how the icon is
   drawn. Each of the three variants puts the icon at the scale, angle and
   position of the matching cover in the cover file (09p2EddPxPpoQyvPIkMB7L:
   23:44, 31:153, 32:199), solved from two icon points (YT_MARK_FIT) and
   checked against each Figma head ring. Variant 3 keeps its rotated frame
   clip. Coordinates of a 1600x984 cover; stroke widths as in Figma, scaled
   with the cover and never under one screen pixel; 10% opacity, dark on
   podcast covers and white on blog covers. ytCoverVar alternates the
   variants so the same one is never next to or directly under itself. */
var YT_MARK = ["M18.1377 3.51036C19.9408 1.10785 23.5754 0.628613 25.221 0.664365L24.8593 1.3026L12.9642 22.3603L8.5055 14.439C8.4093 14.2681 8.313 14.0971 8.2155 13.9234C8.1181 13.7497 8.0195 13.5733 7.9201 13.393C7.8206 13.2126 7.7203 13.0282 7.6202 12.8395C7.5202 12.6507 7.4204 12.4577 7.3227 12.2607C7.225 12.0637 7.1295 11.8628 7.0381 11.659C6.9467 11.4553 6.8596 11.2486 6.7788 11.0403C6.698 10.832 6.6236 10.6221 6.5575 10.412C6.4914 10.2019 6.4335 9.9916 6.3852 9.7824C6.3369 9.5732 6.2982 9.3651 6.2695 9.159C6.2407 8.9529 6.222 8.7488 6.2125 8.547C6.203 8.3452 6.2028 8.1458 6.2096 7.9482C6.2163 7.7506 6.2301 7.5549 6.2468 7.3595C6.255 7.2639 6.2638 7.1698 6.2728 7.0772C5.7865 6.7758 5.2709 6.4452 4.7222 6.0845C3.1596 5.0571 2.9226 4.0824 2.8227 3.398C2.0155 3.5475 1.0801 3.5222 0 2.8668C2.8099 2.0556 2.6837 2.4459 2.8227 3.398C4.2612 3.1316 5.2924 2.3102 6.0101 3.5104C6.6287 4.5448 6.4138 5.6327 6.2728 7.0772C9.4012 9.016 11.3143 9.7456 12.9862 9.5167C15.0287 9.2372 15.8839 6.5136 18.1377 3.51036ZM7.9392 3.6825C7.9392 1.6487 9.5803 0 11.6046 0C13.629 0 15.27 1.6487 15.27 3.6825C15.27 5.7163 13.629 7.3651 11.6046 7.3651C9.5803 7.3651 7.9392 5.7164 7.9392 3.6825Z"];
/* [mark point, cover point, mark point, cover point, Figma stroke width] */
var YT_MARK_FIT = [
  [[11.60455, 3.68252], [1161.47, 347.95], [12.9642, 22.3603], [1489.0, 2179.5], 3.04],
  [[6.29816, 10.5175], [-676.254, 919.061], [12.9642, 22.3603], [433.154, 2738.39], 3.62],
  [[6.29816, 10.5175], [671.333, 646.654], [12.9642, 22.3603], [1610.74, 1598.43], 2.4]
];
function ytMarkMatrix(f) {
  var P = f[0], Q = f[1], P2 = f[2], Q2 = f[3];
  var dx = P2[0] - P[0], dy = P2[1] - P[1], ex = Q2[0] - Q[0], ey = Q2[1] - Q[1], d = dx * dx + dy * dy;
  var a = (ex * dx + ey * dy) / d, b = (ey * dx - ex * dy) / d;
  return [a, b, -b, a, Q[0] - (a * P[0] - b * P[1]), Q[1] - (b * P[0] + a * P[1])];
}
/* Variant for the k-th card of a three-column grid: 0 1 2 / 1 2 0 / 2 0 1 ... */
/* Client, 15 Nov 2026 (late): every cover uses the first Figma line pattern. */
function ytCoverVar(k) { return 0; }
var ytLinesN = 0;
function ytFigmaLines(cls, color, v) {
  var NS = "http://www.w3.org/2000/svg";
  var n = ++ytLinesN, vv = ((v % 3) + 3) % 3, f = YT_MARK_FIT[vv];
  var svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", cls);
  svg.setAttribute("viewBox", "0 0 1600 984");
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.setAttribute("aria-hidden", "true");
  svg.style.opacity = "1";
  var host = svg;
  if (vv === 2) {
    var defs = document.createElementNS(NS, "defs"), cp = document.createElementNS(NS, "clipPath"), rc = document.createElementNS(NS, "rect");
    cp.setAttribute("id", "ytlc" + n);
    rc.setAttribute("width", "1600");
    rc.setAttribute("height", "1600");
    rc.setAttribute("transform", "translate(-129.504 -108.637) rotate(-15.151)");
    cp.appendChild(rc);
    defs.appendChild(cp);
    svg.appendChild(defs);
    host = document.createElementNS(NS, "g");
    host.setAttribute("clip-path", "url(#ytlc" + n + ")");
    svg.appendChild(host);
  }
  var g = document.createElementNS(NS, "g");
  g.setAttribute("transform", "matrix(" + ytMarkMatrix(f).map(function (x) { return +x.toFixed(4); }).join(" ") + ")");
  host.appendChild(g);
  var ps = YT_MARK.map(function (d) {
    var p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    p.style.cssText = "fill:none;stroke:" + color + ";stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke";
    g.appendChild(p);
    return p;
  });
  requestAnimationFrame(function () {
    var w = svg.getBoundingClientRect().width;
    ps.forEach(function (p) { p.style.strokeWidth = Math.max(1, (f[4] * w) / 1600).toFixed(2) + "px"; });
  });
  return svg;
}
function initPodCovers() {
  var covers = [].slice.call(document.querySelectorAll(".pod-cover"));
  if (!covers.length) return;
  /* Draw only when embed 61 is live (it sets --pc-ready), otherwise the
     unstyled SVG would fill the cover black. */
  if (!getComputedStyle(document.documentElement).getPropertyValue("--pc-ready").trim()) return;
  var NS = "http://www.w3.org/2000/svg";
  function rnd(seed) {
    var x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  }
  var cardCovers = covers.filter(function (c) { return !c.closest(".pod-feature"); });
  covers.forEach(function (c, idx) {
    if (c.__pc) return;
    var img = c.querySelector("img");
    var full = ((img && img.getAttribute("alt")) || "").replace(/\s+/g, " ").trim();
    var m = full.match(/^(.*?#\s*(\d+))\s*(.*)$/);
    if (!m) return;
    /* A few alts read "Yotewo(TM) #17 ...": the cover always says Podcast. */
    m[1] = "Yotewo™ Podcast #" + m[2];
    c.__pc = 1;
    var n = +m[2] || idx + 1;
    var host = c.closest(".pod-feature, .pod-card, [data-pod-card]") || document;
    var guestsEl = host.querySelector(".pod-excerpt, .pod-card_excerpt, [data-pod-guests]");
    /* Only the person's name shows (cover and the line under the title):
       a company in brackets after the name stays in the markup, hidden. */
    if (guestsEl && !guestsEl.__names) {
      guestsEl.__names = 1;
      var rawG = guestsEl.textContent;
      if (/\([^)]*\)/.test(rawG)) {
        guestsEl.textContent = "";
        rawG.split(/(\s*\([^)]*\))/).forEach(function (p) {
          if (!p) return;
          if (/^\s*\(/.test(p)) { var h = document.createElement("span"); h.className = "pod-co"; h.textContent = p; guestsEl.appendChild(h); }
          else guestsEl.appendChild(document.createTextNode(p));
        });
      }
    }
    var guests = guestsEl ? guestsEl.textContent.replace(/\s*\([^)]*\)/g, "").split(/\s+(?:x|×|&)\s+|,\s*/i).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 3) : [];

    /* Cards are counted on their own (the feature cover sits above the grid). */
    var k = c.closest(".pod-feature") ? 0 : [].indexOf.call(cardCovers, c);
    var v = ytCoverVar(Math.max(0, k));
    var svg = ytFigmaLines("pc-lines", "rgba(11,12,14,.1)", v);
    /* Gradient arrangement follows the same variant (embed 65e). */
    c.classList.add("is-v" + v);

    var bg = document.createElement("div");
    bg.className = "pc-bg";
    bg.setAttribute("aria-hidden", "true");
    /* Gradient centres shift a little per episode too. */
    bg.style.setProperty("--a", (20 + rnd(n * 3) * 30).toFixed(0) + "%");
    bg.style.setProperty("--b", (70 + rnd(n * 5) * 25).toFixed(0) + "%");

    var txt = document.createElement("div");
    txt.className = "pc-text";
    txt.setAttribute("aria-hidden", "true");
    var who = document.createElement("div");
    who.className = "pc-guests";
    guests.forEach(function (g) { var s = document.createElement("span"); s.textContent = g; who.appendChild(s); });
    var ttl = document.createElement("div");
    ttl.className = "pc-title";
    var t1 = document.createElement("span");
    t1.textContent = m[1];
    ttl.appendChild(t1);
    if (m[3]) { var t2 = document.createElement("span"); t2.className = "pc-topic"; t2.textContent = m[3]; ttl.appendChild(t2); }
    txt.appendChild(who);
    txt.appendChild(ttl);

    c.classList.add("is-drawn");
    /* Client, 25 Nov 2026: covers move like the glows elsewhere. Shared WebGL
       glow (section 25) in the podcast pastels (lavender, peach, rose) over
       .pc-bg, under the lines and text (yotewo.css block 94). */
    c.setAttribute("data-glow-bg", "");
    c.setAttribute("data-glow-colors", "#b7a3d9,#f2c4a6,#e6a6bf,#c7b3e6");
    c.setAttribute("data-glow-gain", "0.8"); c.setAttribute("data-glow-quality", "0.4");
    var r = c.getBoundingClientRect();
    if (r.width && r.height / r.width > 0.8) c.classList.add("is-square");
    c.insertBefore(bg, c.firstChild);
    c.insertBefore(svg, bg.nextSibling);
    c.appendChild(txt);
  });
}

/* ==========================================================================
   PODCAST COVERS LIVE GRADIENT  .pod-cover
   ==========================================================================
   The podcast covers are images with the title baked in over a soft
   lavender, peach and rose gradient. A layer of blurred colour blobs in the
   same palette drifts over the gradient part only (top band and right edge,
   masked away from the text), so the covers move like the glows elsewhere
   while keeping their colours. The layer leans a little toward the cursor.
   Styles: Global Styles [After], embed 49. */
function initPodLive() {
  var covers = document.querySelectorAll(".pod-cover");
  if (!covers.length) return;
  covers.forEach(function (c) {
    if (c.querySelector(".pod-live")) return;
    var d = document.createElement("div");
    d.className = "pod-live";
    d.setAttribute("aria-hidden", "true");
    d.innerHTML = "<i></i><i></i><i></i><i></i><i></i>";
    /* Each cover starts at its own point of the loop, so a row never moves in sync. */
    d.style.setProperty("--d", (Math.random() * 20).toFixed(1) + "s");
    c.appendChild(d);
  });
  if (PREFERS_STILL || !window.matchMedia("(hover:hover) and (pointer:fine)").matches) return;
  document.addEventListener(
    "pointermove",
    function (e) {
      var c = e.target.closest && e.target.closest(".pod-feature, .pod-card, .pod-cover");
      c = c && (c.classList.contains("pod-cover") ? c : c.querySelector(".pod-cover"));
      var l = c && c.querySelector(".pod-live");
      if (!l) return;
      var r = c.getBoundingClientRect();
      l.style.setProperty("--px", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      l.style.setProperty("--py", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
      if (!l.__out) {
        l.__out = function () {
          l.style.setProperty("--px", 0);
          l.style.setProperty("--py", 0);
        };
        (c.closest(".pod-feature, .pod-card") || c).addEventListener("pointerleave", l.__out);
      }
    },
    { passive: true },
  );
}


/* Blog covers (Nov 2026), same idea as the podcast covers: the cover keeps
   its own colour (the blurred photo stays as the background), and on top get
   the Yotewo logo outline blown up so only fragments show (framing differs
   per post), a drifting glow in the cover palette that moves on hover and
   leans to the cursor, and on the cards some content: the topic top right,
   "Yotewo(TM) Blog" and the post title bottom left. The featured post keeps
   its cover without text (lines and glow only). Every .blog-card_img and
   .blog-feature_img is wrapped in .bc-cover. Styles: Global Styles [After],
   embed 63 (it sets --bc-ready; without it nothing is drawn). */
function initBlogCovers() {
  var imgs = [].slice.call(document.querySelectorAll(".blog-card_img, .blog-feature_img"));
  if (!imgs.length) return;
  if (!getComputedStyle(document.documentElement).getPropertyValue("--bc-ready").trim()) return;
  var NS = "http://www.w3.org/2000/svg";
  function rnd(seed) { var x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); }
  function hash(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h) % 997 + 1; }
  var cardImgs = imgs.filter(function (im) { return !im.classList.contains("blog-feature_img"); });
  imgs.forEach(function (img, idx) {
    if (img.__bc || (img.parentNode && img.parentNode.classList && img.parentNode.classList.contains("bc-cover"))) return;
    img.__bc = 1;
    var feature = img.classList.contains("blog-feature_img");
    var card = img.closest(".blog-card, .blog-feature") || img.parentNode;
    var titleEl = card.querySelector(".blog-card_title, .blog-feature_title");
    var title = (titleEl ? titleEl.textContent : img.getAttribute("alt") || "").replace(/\s+/g, " ").trim();
    var topicEl = card.querySelector(".cs-badge");
    var topic = topicEl ? topicEl.textContent.trim() : "";
    var n = hash(title || String(idx));

    var wrap = document.createElement("div");
    wrap.className = "bc-cover" + (feature ? " is-feature" : "");
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);

    var live = document.createElement("div");
    live.className = "bc-live";
    live.setAttribute("aria-hidden", "true");
    live.innerHTML = "<i></i><i></i><i></i><i></i>";
    live.style.setProperty("--d", (rnd(n * 11) * 20).toFixed(1) + "s");
    wrap.appendChild(live);

    var bk = feature ? 0 : cardImgs.indexOf(img);
    var bv = ytCoverVar(Math.max(0, bk));
    var svg = ytFigmaLines("bc-lines", "rgba(255,255,255,.1)", bv);
    wrap.classList.add("is-v" + bv);
    wrap.appendChild(svg);

    if (!feature && title) {
      var txt = document.createElement("div");
      txt.className = "bc-text";
      txt.setAttribute("aria-hidden", "true");
      var top = document.createElement("div");
      top.className = "bc-topic";
      top.textContent = topic;
      var bot = document.createElement("div");
      bot.className = "bc-title";
      var b1 = document.createElement("span");
      b1.textContent = "Yotewo™ Blog";
      var b2 = document.createElement("span");
      b2.className = "bc-sub";
      b2.textContent = title;
      bot.appendChild(b1);
      bot.appendChild(b2);
      txt.appendChild(top);
      txt.appendChild(bot);
      wrap.appendChild(txt);
    }
    wrap.classList.add("is-drawn");
    /* Client, 25 Nov 2026: covers move like the glows elsewhere. The shared
       WebGL glow (section 25, default palette: slate, mauve, peach, rose, as
       the Figma blog gradient) over the gradient picture, under the lines
       and text (yotewo.css block 94). */
    wrap.setAttribute("data-glow-bg", "");
    wrap.setAttribute("data-glow-gain", "0.9"); wrap.setAttribute("data-glow-quality", "0.4");
  });
  if (PREFERS_STILL || !window.matchMedia("(hover:hover) and (pointer:fine)").matches) return;
  document.addEventListener("pointermove", function (e) {
    var host = e.target.closest && e.target.closest(".blog-card, .blog-feature");
    var l = host && host.querySelector(".bc-live");
    if (!l) return;
    var r = l.getBoundingClientRect();
    l.style.setProperty("--px", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    l.style.setProperty("--py", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    if (!l.__out) {
      l.__out = function () { l.style.setProperty("--px", 0); l.style.setProperty("--py", 0); };
      host.addEventListener("pointerleave", l.__out);
    }
  }, { passive: true });
}

/* ==========================================================================
   EVENT COVERS LIVE  img.ev-row_img, img.ev-cover, .ev-feature_visual
   ==========================================================================
   Client, 25 Nov 2026: event covers follow cover variant B of the Figma
   file 09p2EddPxPpoQyvPIkMB7L (110:642 and the four next to it) and move
   like the glows elsewhere instead of being flat pictures. Each cover image
   is wrapped in .evc: the B gradient (yotewo.css block 93), the shared
   WebGL glow (section 25) in the B blues and mauves, the logo outline of
   the Figma cover (vector 110:721 at its own position and angle, white 10%),
   "Events" top right and the title with "date · city" bottom left, all in
   cover units (1600 wide). The CMS image stays inside, invisible, for its
   alt text; og:image still uses the uploaded PNG. The featured card keeps
   its headline and gets the same gradient, glow colours and outline. Runs
   before initGlowBg so the glow picks up the colours. */
var EVC_D = "M1800.2 348.4C1979.2 110 2339.9 62.4 2503.3 65.9C2421.6 90.8 2237 156.8 2109.1 242C1949.4 348.4 1896.1 561.3 1640.4 1019.1C1384.8 1476.8 1267.6 1402.3 1054.6 1402.3C901.2 1385.3 703 1232 628.5 1029.7C607.7 900.8 613.6 794.3 622.6 702.4C574.3 672.5 523.2 639.7 468.7 603.9C313.6 501.9 290.1 405.2 280.2 337.3C200 352.1 107.2 349.6 0 284.5C278.9 204 266.4 242.8 280.2 337.3C422.9 310.8 525.3 229.3 596.5 348.4C657.9 451.1 636.6 559.1 622.6 702.4C933.1 894.9 1123 967.3 1288.9 944.6C1491.6 916.8 1576.5 646.5 1800.2 348.4ZM1286.7 2219.3L2503.2 65.8C2422 69.3 2285.9 103.8 2140.1 210.6C2066.6 271.1 1991.5 348.7 1916.3 429.9C1844.9 522.7 1775.7 636.9 1713.6 776.8C1644.5 937.4 1576.3 1054.8 1510.8 1139.9C1331.6 1400.8 1101.8 1369.8 1009.3 1321.7C1016.4 1383.9 1049.8 1563.9 1126.7 1786.2C1203.5 2008.4 1265.4 2167.6 1286.7 2219.3ZM1151.8 731C1352.7 731 1515.6 567.4 1515.6 365.5C1515.6 163.6 1352.7 0 1151.8 0C950.9 0 788 163.6 788 365.5C788 567.4 950.9 731 1151.8 731Z";
var EVC_GLOW = "#5b78b0,#9a6a96,#4f6aa6,#b07fa3";
function evcLines() {
  var NS = "http://www.w3.org/2000/svg";
  var s = document.createElementNS(NS, "svg");
  s.setAttribute("class", "evc-lines");
  s.setAttribute("viewBox", "0 0 1600 984");
  s.setAttribute("preserveAspectRatio", "xMidYMid slice");
  s.setAttribute("aria-hidden", "true");
  var g = document.createElementNS(NS, "g");
  g.setAttribute("transform", "matrix(0.99442 -0.1055 0.1055 0.99442 -21.96 106)");
  var p = document.createElementNS(NS, "path");
  p.setAttribute("d", EVC_D);
  p.style.cssText = "fill:none;stroke:rgba(255,255,255,.1);stroke-width:1px;stroke-linejoin:round;vector-effect:non-scaling-stroke";
  g.appendChild(p);
  s.appendChild(g);
  requestAnimationFrame(function () {
    var w = s.getBoundingClientRect().width;
    p.style.strokeWidth = Math.max(1, (3.04 * w) / 1600).toFixed(2) + "px";
  });
  return s;
}
function initEventCovers() {
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function shortDate(txt) {
    var m = (txt || "").match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/);
    if (!m) return "";
    var i = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(m[1]);
    return +m[2] + " " + MON[i] + " " + m[3];
  }
  function city(txt) { return ((txt || "").split(",")[0] || "").trim() || "London"; }
  function glow(el) {
    el.setAttribute("data-glow-bg", "");
    el.setAttribute("data-glow-colors", EVC_GLOW);
    el.setAttribute("data-glow-gain", "0.9");
    el.setAttribute("data-glow-reach", "3.2"); el.setAttribute("data-glow-quality", "0.4");
  }
  var cur = document.querySelector("[data-ev-current]");
  var curSlug = cur ? cur.getAttribute("data-ev-current") : "";
  [].slice.call(document.querySelectorAll("img.ev-row_img, img.ev-cover")).forEach(function (img) {
    if (img.__evc || (img.parentNode && img.parentNode.classList.contains("evc"))) return;
    img.__evc = 1;
    var title = "", when = "", place = "";
    var row = img.closest(".ev-row");
    if (row) {
      var t = row.querySelector(".ev-row_title"), meta = row.querySelector("[data-ev-start]"), b = row.querySelector(".ev-badge");
      title = t ? t.textContent : "";
      when = shortDate(meta ? meta.getAttribute("data-ev-start") : "");
      place = city(b ? b.textContent : "");
    } else {
      var h = document.querySelector("h1");
      title = img.getAttribute("alt") || (h ? h.textContent : "");
      var sd = document.querySelector(".ev-side_date");
      when = shortDate(sd ? sd.textContent : "");
      var other = curSlug && document.querySelector('[data-ev-slug="' + curSlug + '"]');
      var ob = other && other.parentNode.querySelector(".ev-badge");
      place = city(ob ? ob.textContent : "");
    }
    title = title.replace(/\s+/g, " ").trim();
    var w = document.createElement("div");
    w.className = "evc " + img.className;
    img.parentNode.insertBefore(w, img);
    w.appendChild(img);
    w.appendChild(evcLines());
    var lab = document.createElement("div");
    lab.className = "evc-label";
    lab.setAttribute("aria-hidden", "true");
    lab.textContent = "Events";
    var tx = document.createElement("div");
    tx.className = "evc-text";
    tx.setAttribute("aria-hidden", "true");
    var s1 = document.createElement("span");
    s1.textContent = title;
    tx.appendChild(s1);
    if (when) {
      var s2 = document.createElement("span");
      s2.className = "evc-when";
      s2.textContent = when + " \u00b7 " + place;
      tx.appendChild(s2);
    }
    w.appendChild(lab);
    w.appendChild(tx);
    glow(w);
  });
  [].slice.call(document.querySelectorAll(".ev-feature_visual")).forEach(function (v) {
    if (v.__evc) return;
    v.__evc = 1;
    v.classList.add("evc-b");
    v.insertBefore(evcLines(), v.firstChild);
    glow(v);
  });
}

/* ==========================================================================
   36. BLOG  [data-blog-list] [data-blog-body]
   ==========================================================================
   Index: topic pills, search and pagination over the CMS cards, client side.
   Article: TOC with scrollspy from the body h2s, share links, "Explore with AI",
   and the similar list without the article being read. */
/* Smooth filter swap: newly shown items fade up, the list height eases
   to its new size. First call per box applies instantly (initial render). */
function smoothSwap(box, mutate) {
  if (!box) return mutate();
  var sel = "[data-swap-item], .w-dyn-item, .careers-group, .gl-head";
  var shown = function (e) { return e.getClientRects().length > 0; };
  /* Client, 15 Nov 2026: on the blog a topic filter showed an empty list.
     The scroll reveal (section 24) parks items at opacity 0 / hidden until
     they scroll into view; cards that were display:none then (later pages,
     other topics) never got their trigger, so a filter showed them still
     hidden. Any item a swap shows is released from the reveal state. */
  var release = function () {
    [].slice.call(box.querySelectorAll(sel)).filter(shown).forEach(function (e) {
      if (e.style.visibility !== "hidden" && e.style.opacity !== "0") return;
      if (window.gsap) { gsap.killTweensOf(e); gsap.set(e, { clearProps: "transform,opacity,visibility" }); }
      else { e.style.opacity = ""; e.style.visibility = ""; e.style.transform = ""; }
    });
  };
  if (!box.__swapReady || PREFERS_STILL || !box.animate) {
    var first = box.__swapReady;
    box.__swapReady = 1;
    var res = mutate();
    if (first) release();
    return res;
  }
  var before = [].slice.call(box.querySelectorAll(sel)).filter(shown);
  var h0 = box.getBoundingClientRect().height;
  var out = mutate();
  release();
  var h1 = box.getBoundingClientRect().height;
  var EASE = "cubic-bezier(.625,.05,0,1)";
  var entering = [].slice.call(box.querySelectorAll(sel)).filter(function (e) {
    return shown(e) && before.indexOf(e) < 0 && !(e.parentElement && e.parentElement.closest(".careers-group") && e.className.indexOf("careers-group") < 0 && before.indexOf(e.parentElement.closest(".careers-group")) < 0);
  });
  /* Only the outermost new items move (a card, not also the chips inside it). */
  entering = entering.filter(function (e) { return !entering.some(function (o) { return o !== e && o.contains(e); }); });
  entering.slice(0, 24).forEach(function (e, i) {
    e.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }],
      { duration: 500, delay: Math.min(i, 8) * 40, easing: EASE, fill: "backwards" });
  });
  if (Math.abs(h1 - h0) > 2) {
    var ov = box.style.overflow;
    box.style.overflow = "hidden";
    var a = box.animate([{ height: h0 + "px" }, { height: h1 + "px" }], { duration: 450, easing: EASE });
    a.onfinish = a.oncancel = function () { box.style.overflow = ov; };
  }
  return out;
}

/* Page numbers as in Figma: 1 2 3 4 5 … 10 (0 = gap) */
function pageRange(page, total) {
  if (total <= 7) return Array.from({ length: total }, function (_, i) { return i + 1; });
  var a = [1], lo = Math.max(2, page - 2), hi = Math.min(total - 1, page + 2);
  if (page <= 4) { lo = 2; hi = 5; }
  if (page >= total - 3) { lo = total - 4; hi = total - 1; }
  if (lo > 2) a.push(0);
  for (var i = lo; i <= hi; i++) a.push(i);
  if (hi < total - 1) a.push(0);
  a.push(total);
  return a;
}
/* "9 / page" select in the right slot of the pagination ([data-per-page]) */
function perPageControl(slot, current, onChange) {
  if (!slot || slot.__per) return;
  slot.__per = 1;
  slot.textContent = "";
  var wrap = document.createElement("label");
  wrap.className = "blog-per";
  var sel = document.createElement("select");
  sel.setAttribute("aria-label", "Items per page");
  [6, 9, 12, 18].forEach(function (n) {
    var o = document.createElement("option");
    o.value = n; o.textContent = n + " / page";
    if (n === current) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener("change", function () { onChange(parseInt(sel.value, 10)); });
  wrap.appendChild(sel);
  slot.appendChild(wrap);
}

function initBlog() {
  var PER_PAGE = 9;
  var url = location.origin + location.pathname;

  /* ---------- Index ---------- */
  var list = document.querySelector("[data-blog-list]");
  if (list) {
    var cards = [].slice.call(list.querySelectorAll("[data-blog-card]"));
    var feature = document.querySelector(".blog-feature");
    /* 19 Nov: the grid lists every post (no Featured filter in Webflow), so a
       post never disappears when two are switched to Featured. The one shown
       in the featured block is dropped from the grid here. */
    if (feature) {
      var slugOf = function (a) { return a ? (a.getAttribute("href") || "").replace(/[?#].*$/, "").replace(/\/$/, "") : ""; };
      var fSlug = slugOf(feature.matches("a[href]") ? feature : feature.querySelector("a[href]"));
      if (fSlug) cards = cards.filter(function (c) {
        if (slugOf(c.matches("a[href]") ? c : c.querySelector("a[href]")) !== fSlug) return true;
        (c.closest(".w-dyn-item") || c).remove();
        return false;
      });
    }
    var divider = document.querySelector(".blog-divider");
    var pills = [].slice.call(document.querySelectorAll("[data-blog-filter]"));
    var search = document.querySelector("[data-blog-search]");
    var empty = document.querySelector("[data-blog-empty]");
    var pag = document.querySelector("[data-blog-pagination]");
    var info = document.querySelector("[data-blog-info]");
    var pagesEl = document.querySelector("[data-blog-pages]");
    var params = new URLSearchParams(location.search);
    var topic = params.get("topic") || "all";
    var q = "";
    var page = 1;

    function text(el, sel) {
      var x = el && el.querySelector(sel);
      return x ? x.textContent.trim() : "";
    }
    function matches(el) {
      if (!el) return false;
      if (topic !== "all" && text(el, ".cs-badge").toLowerCase() !== topic.toLowerCase()) return false;
      if (!q) return true;
      return el.textContent.toLowerCase().indexOf(q) > -1;
    }
    function btn(label, p, cls, aria, disabled) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = cls;
      b.innerHTML = label;
      if (aria) b.setAttribute("aria-label", aria);
      if (disabled) {
        b.disabled = true;
        b.style.opacity = ".4";
        b.style.cursor = "default";
      } else
        b.addEventListener("click", function () {
          page = p;
          render(true);
        });
      return b;
    }
    function render(scroll) {
      var filtering = topic !== "all" || !!q;
      var featOk = feature ? (filtering ? matches(feature) : true) : false;
      var hits = cards.filter(matches);
      var total = Math.max(1, Math.ceil(hits.length / PER_PAGE));
      if (page > total) page = total;
      var from = (page - 1) * PER_PAGE;
      cards.forEach(function (c) {
        var i = hits.indexOf(c);
        c.parentElement.style.display = i >= from && i < from + PER_PAGE ? "" : "none";
      });
      if (feature) feature.parentElement.style.display = featOk && page === 1 ? "" : "none";
      if (divider) divider.style.display = featOk && page === 1 && hits.length ? "" : "none";
      if (empty) empty.style.display = !hits.length && !featOk ? "block" : "none";
      if (pag) {
        pag.style.display = total > 1 || PER_PAGE !== 9 ? "flex" : "none";
        perPageControl(pag.querySelector("[data-per-page]"), PER_PAGE, function (n) { PER_PAGE = n; page = 1; render(true); });
        if (info) info.textContent = hits.length ? "Page " + page + " of " + total : "";
        if (pagesEl) {
          pagesEl.innerHTML = "";
          var arrow = function (d) {
            return '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="' + d + '" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          };
          pagesEl.appendChild(btn(arrow("M8.5 3.5 5 7l3.5 3.5"), page - 1, "blog-page", "Previous page", page === 1));
          pageRange(page, total).forEach(function (p) {
            if (p === 0) { var gap = document.createElement("span"); gap.className = "blog-page is-gap"; gap.textContent = "…"; pagesEl.appendChild(gap); return; }
            var b = btn(String(p), p, "blog-page" + (p === page ? " is-current" : ""), "Page " + p, false);
            if (p === page) b.setAttribute("aria-current", "page");
            pagesEl.appendChild(b);
          });
          pagesEl.appendChild(btn(arrow("M5.5 3.5 9 7l-3.5 3.5"), page + 1, "blog-page", "Next page", page === total));
        }
      }
      if (scroll) {
        var top = list.getBoundingClientRect().top + window.scrollY - 140;
        if (feature && feature.parentElement.style.display !== "none") top = feature.getBoundingClientRect().top + window.scrollY - 140;
        window.scrollTo({ top: top, behavior: PREFERS_STILL ? "auto" : "smooth" });
      }
    }
    var renderNow = render, swapBox = list.closest(".container") || list;
    render = function (scroll) { smoothSwap(swapBox, function () { renderNow(scroll); }); };
    function setTopic(t) {
      topic = t;
      page = 1;
      pills.forEach(function (p) {
        var on = p.getAttribute("data-blog-filter") === t;
        p.classList.toggle("is-active", on);
        p.setAttribute("aria-pressed", on ? "true" : "false");
      });
      var u = new URL(location.href);
      if (t === "all") u.searchParams.delete("topic");
      else u.searchParams.set("topic", t);
      history.replaceState(null, "", u);
      render(false);
    }
    pills.forEach(function (p) {
      p.addEventListener("click", function () {
        setTopic(p.getAttribute("data-blog-filter"));
      });
    });
    if (search) {
      var timer;
      search.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          q = search.value.trim().toLowerCase();
          page = 1;
          render(false);
        }, 150);
      });
      var form = search.closest("form");
      if (form)
        form.addEventListener("submit", function (e) {
          e.preventDefault();
        });
    }
    if (!pills.some(function (p) { return p.getAttribute("data-blog-filter") === topic; })) topic = "all";
    setTopic(topic);
  }

  /* ---------- Article ---------- */
  var body = document.querySelector("[data-blog-body]");
  if (body) {
    var toc = document.querySelector("[data-blog-toc]");
    var hs = [].slice.call(body.querySelectorAll("h2"));
    if (toc) {
      if (!hs.length) {
        toc.style.display = "none";
        var lab = toc.previousElementSibling;
        if (lab) lab.style.display = "none";
        var div = toc.nextElementSibling;
        if (div) div.style.display = "none";
      } else {
        var used = {};
        hs.forEach(function (h) {
          if (!h.id) {
            var base = h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "section";
            var id = base, n = 2;
            while (used[id] || document.getElementById(id)) id = base + "-" + n++;
            h.id = id;
          }
          used[h.id] = 1;
          var a = document.createElement("a");
          a.href = "#" + h.id;
          a.textContent = h.textContent;
          a.addEventListener("click", function (e) {
            e.preventDefault();
            var y = h.getBoundingClientRect().top + window.scrollY - 110;
            window.scrollTo({ top: y, behavior: PREFERS_STILL ? "auto" : "smooth" });
            history.replaceState(null, "", "#" + h.id);
          });
          toc.appendChild(a);
        });
        var links = [].slice.call(toc.querySelectorAll("a"));
        var cur = -1, tick = false;
        var spy = function () {
          tick = false;
          var x = 0;
          hs.forEach(function (h, i) {
            if (h.getBoundingClientRect().top < 160) x = i;
          });
          if (x === cur) return;
          cur = x;
          links.forEach(function (a, i) {
            a.classList.toggle("is-active", i === x);
            if (i === x) a.setAttribute("aria-current", "true");
            else a.removeAttribute("aria-current");
          });
        };
        window.addEventListener("scroll", function () {
          if (!tick) {
            tick = true;
            requestAnimationFrame(spy);
          }
        }, { passive: true });
        spy();
      }
    }

    var title = (document.querySelector("h1") || {}).textContent || document.title;
    title = title.trim();
    var enc = encodeURIComponent;
    var copy = function (s) {
      if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(s);
      var t = document.createElement("textarea");
      t.value = s;
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      try { document.execCommand("copy"); } catch (_) {}
      t.remove();
      return Promise.resolve();
    };
    var shares = {
      linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=" + enc(url),
      x: "https://twitter.com/intent/tweet?url=" + enc(url) + "&text=" + enc(title),
      telegram: "https://t.me/share/url?url=" + enc(url) + "&text=" + enc(title)
    };
    [].forEach.call(document.querySelectorAll("[data-share]"), function (a) {
      var k = a.getAttribute("data-share");
      if (k === "copy") {
        a.setAttribute("role", "button");
        a.addEventListener("click", function (e) {
          e.preventDefault();
          copy(url).then(function () {
            var lbl = a.getAttribute("aria-label");
            a.classList.add("is-copied");
            a.setAttribute("aria-label", "Link copied");
            setTimeout(function () {
              a.classList.remove("is-copied");
              a.setAttribute("aria-label", lbl);
            }, 1600);
          });
        });
      } else if (shares[k]) {
        a.href = shares[k];
        a.target = "_blank";
        a.rel = "noopener";
      }
    });

    var prompt = "Read this article and summarise the key points, then answer my follow-up questions about it: " + url;
    var ai = {
      chatgpt: "https://chatgpt.com/?q=" + enc(prompt),
      claude: "https://claude.ai/new?q=" + enc(prompt)
    };
    [].forEach.call(document.querySelectorAll("[data-ai]"), function (a) {
      var k = a.getAttribute("data-ai");
      if (ai[k]) a.href = ai[k];
      else if (k === "gemini") {
        /* Gemini has no documented prefill parameter: copy the prompt, then open it. */
        a.href = "https://gemini.google.com/app";
        a.addEventListener("click", function () {
          copy(prompt);
        });
        a.title = "The prompt is copied to your clipboard, paste it into Gemini";
      }
    });

    var author = document.querySelector("[data-blog-author]");
    if (author) {
      var h = author.getAttribute("href");
      if (!h || h === "#") author.style.display = "none";
      else {
        author.target = "_blank";
        author.rel = "noopener";
      }
    }
  }

  var similar = document.querySelector("[data-blog-similar]");
  if (similar) {
    var items = [].slice.call(similar.children);
    var shown = 0;
    items.forEach(function (it) {
      var a = it.querySelector("a[href]");
      var same = a && a.pathname.replace(/\/$/, "") === location.pathname.replace(/\/$/, "");
      if (same || shown >= 3) it.style.display = "none";
      else shown++;
    });
    if (!shown) {
      var sec = document.querySelector("[data-blog-similar-section]");
      if (sec) sec.style.display = "none";
    }
  }
}

/* ==========================================================================
   37. CAREERS  [data-careers]
   ==========================================================================
   Open Roles: groups the Careers CMS rows by department (data-dept) under
   h3 headings, fills the Location / Department selects from the data and
   filters by both plus the search box. Without JS the flat list still shows.
   ========================================================================== */
/* Apply now on a careers row is a plain mailto (the CMS Link field rejects a
   query string): add the role as the email subject, here and on any other
   list of roles (Featured roles), so applications arrive labelled. */
function careersMailSubject(row) {
  var a = row.querySelector('a[href^="mailto:"]');
  if (!a || /[?&]subject=/i.test(a.getAttribute("href"))) return;
  var name = row.querySelector(".careers-role_name");
  var role = name ? name.textContent.trim() : "";
  a.setAttribute("href", a.getAttribute("href") + "?subject=" + encodeURIComponent("Application: " + (role || "Open role")));
  a.removeAttribute("aria-disabled");
}
/* Learn more: every role row (Open Roles, Featured roles on About) gets a
   "Learn more" link to its CMS page /careers-role/<slug>, next to Apply now,
   and the role name links there too. The slug is the Webflow slug of the
   name (data-career-slug on the row wins when present). */
function careerSlug(s) {
  return (s || "").toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function careersLearnMore(row) {
  if (row.querySelector(".careers-role_more")) return;
  var name = row.querySelector(".careers-role_name");
  var slug = row.getAttribute("data-career-slug") || careerSlug(name && name.textContent);
  if (!slug) return;
  var url = "/careers-role/" + slug;
  var apply = row.querySelector(".careers-role_link");
  var more = document.createElement("a");
  more.className = "careers-role_more";
  more.href = url;
  more.textContent = "Learn more";
  if (name && !name.querySelector("a")) {
    var t = document.createElement("a");
    t.className = "careers-role_title-link";
    t.href = url;
    while (name.firstChild) t.appendChild(name.firstChild);
    name.appendChild(t);
  }
  var box = document.createElement("div");
  box.className = "careers-role_actions";
  if (apply) { apply.parentNode.insertBefore(box, apply); box.appendChild(more); box.appendChild(apply); }
  else { row.appendChild(box); box.appendChild(more); }
}
/* Role page (Careers template): hide empty badges (placeholder roles have no
   seniority) and label the Apply mail with the role, like the list rows. */
function initCareerPage() {
  var hero = document.querySelector("[data-career-hero]");
  if (!hero) return;
  hero.querySelectorAll(".careers-badge").forEach(function (b) {
    if (!b.textContent.trim()) b.style.display = "none";
  });
  var a = hero.querySelector("[data-career-apply]");
  var h = hero.querySelector("h1");
  if (a && /^mailto:/i.test(a.getAttribute("href") || "") && !/[?&]subject=/i.test(a.getAttribute("href"))) {
    a.setAttribute("href", a.getAttribute("href") + "?subject=" + encodeURIComponent("Application: " + (h ? h.textContent.trim() : "Open role")));
  }
}
/* Talent and job cards: skill chips are cut to two rows. When chips are
   hidden, a "+N" chip (.is-more) closes the last visible row, N = skills
   not shown; boxes that show every chip get nothing. The skill that matched
   the filter or search is moved to the front first (initHireTalent), so it
   is never among the hidden ones. Recomputed after filtering, on resize and
   when cards are copied onto other pages. Styles: Global Styles [After],
   embed 63. */
function ytChipFade(scope) {
  [].forEach.call((scope || document).querySelectorAll(".div-talent-card-stack .div-talent-chips"), function (box) {
    [].forEach.call(box.querySelectorAll(".chip-more"), function (m) { m.remove(); });
    [].forEach.call(box.querySelectorAll(".is-cut"), function (m) { m.classList.remove("is-cut"); });
    box.classList.remove("is-clipped");
    if (!box.offsetParent || box.scrollHeight <= box.clientHeight + 1) return;
    var items = [].filter.call(box.children, function (el) { return el.querySelector(".is-chip"); });
    var bottom = function () { return box.getBoundingClientRect().bottom + 1; };
    var k = 0;
    items.forEach(function (el, i) { var r = el.getBoundingClientRect(); if (r.height && r.bottom <= bottom()) k = i + 1; });
    if (k >= items.length) return;
    box.classList.add("is-clipped");
    var more = document.createElement("div");
    more.className = "chip-more";
    more.setAttribute("role", "listitem");
    var chip = document.createElement("div");
    chip.className = "tag is-chip is-more";
    more.appendChild(chip);
    /* Chips after the counter are taken out of the flow (is-cut), so none
       of them can wrap into view behind it and the count stays exact. */
    var place = function () {
      chip.textContent = "+" + (items.length - k);
      more.setAttribute("aria-label", (items.length - k) + " more skills");
      box.insertBefore(more, items[k]);
      items.forEach(function (el, i) { el.classList.toggle("is-cut", i >= k); });
    };
    place();
    /* The counter itself must fit in the visible rows: give up one more
       chip until it does. */
    while (k > 0 && more.getBoundingClientRect().bottom > bottom()) { k--; place(); }
  });
}
function initChipFade() {
  if (!document.querySelector(".div-talent-card-stack .div-talent-chips")) return;
  ytChipFade();
  window.addEventListener("load", function () { ytChipFade(); });
  var t;
  window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(function () { ytChipFade(); }, 150); });
}
/* Hire page: developers block [data-hire-talent] in the dark talent section.
   Developers CMS list (talent cards, sort Order) with Role / Skill /
   Experience / Availability selects and a search box in the careers toolbar
   style. Role, Skill and Availability options are read from the cards (hidden
   roles list [data-hire-role], skills chips, status line), most common first.
   8 cards show at first, "Show more developers" adds 8 at a time; filters
   and search apply to all cards. ?role=... and ?skill=React preselect. */
function initHireTalent() {
  var root = document.querySelector("[data-hire-talent]");
  if (!root) return;
  var cards = [].slice.call(root.querySelectorAll("[data-hire-card]"));
  if (!cards.length) return;
  var STEP = 8, shown = STEP;
  var selRole = root.querySelector('[data-hire-filter="role"]');
  var selSkill = root.querySelector('[data-hire-filter="skill"]');
  var selExp = root.querySelector('[data-hire-filter="experience"]');
  var selAv = root.querySelector('[data-hire-filter="availability"]');
  var search = root.querySelector("[data-hire-search]");
  var empty = root.querySelector("[data-hire-empty]");
  var more = root.querySelector("[data-hire-more]");
  var moreWrap = root.querySelector("[data-hire-more-wrap]") || more;
  var txt = function (el) { return el ? (el.textContent || "").replace(/\s+/g, " ").trim() : ""; };
  var data = cards.map(function (c) {
    var skills = [].filter.call(c.querySelectorAll(".is-chip:not(.is-more)"), function (x) { return !x.closest("[data-talent-badges]"); }).map(txt).filter(Boolean);
    return {
      el: c.closest(".w-dyn-item") || c,
      name: txt(c.querySelector("[data-hire-name]")),
      roles: [].map.call(c.querySelectorAll("[data-hire-role]"), txt).filter(Boolean),
      skills: skills,
      /* Client, Nov 2026: cards show seniority (Middle, Senior, Team Lead,
         Architect) instead of years, so the experience filter matches it. */
      exp: txt(c.querySelector("[data-hire-exp]")),
      status: txt(c.querySelector("[data-hire-status]")),
      /* Search looks at what the card is about (name, skills, roles,
         seniority), not the hidden long description: a match there showed
         cards with no visible reason for being in the results. */
      hay: [txt(c.querySelector("[data-hire-name]")), skills.join(" "),
        [].map.call(c.querySelectorAll("[data-hire-role]"), txt).join(" "),
        txt(c.querySelector("[data-hire-exp]"))].join(" ").toLowerCase(),
      /* Skill chips in CMS order. The card shows only the first two rows of
         chips, so a filter or search hit further down would match a card
         that looks unrelated; apply() moves the hit chips to the front. */
      chips: [].filter.call(c.querySelectorAll(".is-chip:not(.is-more)"), function (x) { return !x.closest("[data-talent-badges]"); })
        .map(function (x) { return { chip: x, item: x.closest(".w-dyn-item") || x, text: txt(x).toLowerCase() }; })
    };
  });
  function showHits(d, sk, q) {
    if (!d.chips.length) return;
    var box = d.chips[0].item.parentNode;
    var hit = function (c) { return (sk && c.text === sk.toLowerCase()) || (q && c.text.indexOf(q) > -1); };
    var first = d.chips.filter(hit), rest = d.chips.filter(function (c) { return !hit(c); });
    first.concat(rest).forEach(function (c) {
      c.chip.classList.toggle("is-hit", first.indexOf(c) > -1);
      if (c.item.parentNode === box) box.appendChild(c.item);
    });
  }
  /* Available engineers first (CMS order kept within each group): the
     synced list put the 9 unavailable profiles on the first screen. */
  var off = function (d) { return /^unavailable$/i.test(d.status) ? 1 : 0; };
  data = data.map(function (d, i) { d.i = i; return d; }).sort(function (x, y) { return off(x) - off(y) || x.i - y.i; });
  data.forEach(function (d) { d.el.parentNode.appendChild(d.el); });
  var count = {}, rcount = {}, statuses = [];
  data.forEach(function (d) {
    d.skills.forEach(function (s) { count[s] = (count[s] || 0) + 1; });
    d.roles.forEach(function (r) { rcount[r] = (rcount[r] || 0) + 1; });
    if (d.status && statuses.indexOf(d.status) < 0) statuses.push(d.status);
  });
  var fill = function (sel, values) {
    if (!sel) return;
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v; o.textContent = v; sel.appendChild(o);
    });
  };
  var byCount = function (c) { return Object.keys(c).sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b); }); };
  fill(selRole, byCount(rcount));
  fill(selSkill, byCount(count));
  fill(selAv, statuses.sort());
  if (selExp) {
    var RANK = ["junior", "middle", "senior", "team lead", "lead", "architect"];
    var rk = function (v) { var i = RANK.indexOf(v.toLowerCase()); return i < 0 ? 99 : i; };
    [].slice.call(selExp.options).forEach(function (o) { if (o.value) o.remove(); else o.textContent = "Seniority"; });
    selExp.setAttribute("aria-label", "Filter by seniority");
    var levels = [];
    data.forEach(function (d) { if (d.exp && levels.indexOf(d.exp) < 0) levels.push(d.exp); });
    fill(selExp, levels.sort(function (x, y) { return rk(x) - rk(y) || x.localeCompare(y); }));
  }
  var qs = new URLSearchParams(location.search);
  [[selRole, "role"], [selSkill, "skill"]].forEach(function (p) {
    var v = qs.get(p[1]);
    if (!v || !p[0]) return;
    var hit = [].filter.call(p[0].options, function (o) { return o.value.toLowerCase() === v.toLowerCase(); })[0];
    if (hit) p[0].value = hit.value;
  });
  var list = data.length ? data[0].el.parentNode : null;
  /* Filter changes animate like the blog and glossary filters: newly shown
     cards fade up and the grid height eases (smoothSwap; the first render
     is instant). */
  function apply() { smoothSwap(list, applyNow); }
  function applyNow() {
    var ro = selRole ? selRole.value : "", sk = selSkill ? selSkill.value : "", ex = selExp ? selExp.value : "";
    var av = selAv ? selAv.value : "", q = search ? search.value.trim().toLowerCase() : "";
    var match = data.filter(function (d) {
      return (!ro || d.roles.indexOf(ro) > -1) && (!sk || d.skills.indexOf(sk) > -1) && (!ex || d.exp === ex) && (!av || d.status === av) && (!q || d.hay.indexOf(q) > -1);
    });
    data.forEach(function (d) { d.el.style.display = "none"; showHits(d, sk, q); });
    match.forEach(function (d, i) { if (i < shown) d.el.style.display = ""; });
    if (empty) empty.style.display = match.length ? "none" : "block";
    if (moreWrap) moreWrap.style.display = match.length > shown ? "" : "none";
    ytChipFade(root);
  }
  [selRole, selSkill, selExp, selAv].forEach(function (s) {
    if (s) s.addEventListener("change", function () { shown = STEP; apply(); });
  });
  if (search) search.addEventListener("input", function () { shown = STEP; apply(); });
  if (more) more.addEventListener("click", function () { shown += STEP; apply(); });
  apply();
}
function initCareers() {
  initCareerPage();
  initHireTalent();
  document.querySelectorAll(".careers-role").forEach(function (r) { careersMailSubject(r); careersLearnMore(r); });
  var root = document.querySelector("[data-careers]");
  if (!root) return;
  var rows = Array.prototype.slice.call(root.querySelectorAll("[data-careers-item]"));
  if (!rows.length) return;
  var list = root.querySelector("[data-careers-list]");
  var empty = root.querySelector("[data-careers-empty]");
  var selLoc = root.querySelector('[data-careers-filter="location"]');
  var selDept = root.querySelector('[data-careers-filter="department"]');
  var search = root.querySelector("[data-careers-search]");
  var clean = function (v) { return (v || "").trim(); };

  // Group by department, keeping CMS order
  var groups = {}, order = [];
  rows.forEach(function (r) {
    var d = clean(r.getAttribute("data-dept")) || "Other";
    if (!groups[d]) { groups[d] = []; order.push(d); }
    groups[d].push(r);
    // Empty apply link: keep the row but drop the dead link
    var a = r.querySelector("a");
    if (a && (!a.getAttribute("href") || a.getAttribute("href") === "#")) a.setAttribute("aria-disabled", "true");
    careersMailSubject(r);
  });
  var wrap = document.createElement("div");
  var groupEls = order.map(function (d) {
    var g = document.createElement("div");
    g.className = "careers-group";
    var h = document.createElement("h3");
    h.className = "careers-group_title";
    h.textContent = d;
    var ul = document.createElement("div");
    ul.className = "careers-roles";
    ul.setAttribute("role", "list");
    groups[d].forEach(function (r) {
      var item = r.closest(".w-dyn-item") || r;
      item.setAttribute("role", "listitem");
      ul.appendChild(item);
    });
    g.appendChild(h); g.appendChild(ul); wrap.appendChild(g);
    return { el: g, dept: d, rows: groups[d] };
  });
  if (list) { list.innerHTML = ""; list.appendChild(wrap); }

  // Options
  var fill = function (sel, values) {
    if (!sel) return;
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v; o.textContent = v; sel.appendChild(o);
    });
  };
  var locs = [];
  rows.forEach(function (r) {
    var l = clean(r.getAttribute("data-loc"));
    if (l && locs.indexOf(l) < 0) locs.push(l);
  });
  fill(selLoc, locs);
  fill(selDept, order);

  var apply = function () {
    var loc = selLoc ? selLoc.value : "";
    var dept = selDept ? selDept.value : "";
    var q = search ? search.value.trim().toLowerCase() : "";
    var total = 0;
    groupEls.forEach(function (g) {
      var n = 0;
      g.rows.forEach(function (r) {
        var item = r.closest(".w-dyn-item") || r;
        var ok = (!dept || g.dept === dept) &&
          (!loc || clean(r.getAttribute("data-loc")) === loc) &&
          (!q || r.textContent.toLowerCase().indexOf(q) > -1);
        item.style.display = ok ? "" : "none";
        if (ok) n++;
      });
      g.el.style.display = n ? "" : "none";
      total += n;
    });
    if (empty) empty.style.display = total ? "none" : "block";
  };
  var applyNow = apply;
  apply = function () { smoothSwap(list, applyNow); };
  apply();
  [selLoc, selDept].forEach(function (s) { if (s) s.addEventListener("change", apply); });
  if (search) {
    search.addEventListener("input", apply);
    search.addEventListener("keydown", function (e) { if (e.key === "Enter") e.preventDefault(); });
  }
}

/* ==========================================================================
   38. EVENTS  [data-events] [data-ev-more]
   ==========================================================================
   Events page: Upcoming / Past tabs over one CMS list (data-ev-start on each
   row, date only). The tabs use the site segmented control (.div-seg with
   data-seg-btn), so the sliding pill comes from section 28. Past events are shown newest first. If nothing is upcoming
   the Past tab opens and the Upcoming tab shows the empty note.
   Event template: "Upcoming events" drops the current and past events and
   hides itself when empty; hides Speakers, venue link and Registration when
   their CMS fields are empty.
   ========================================================================== */
function initEvents() {
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var parse = function (el) {
    var m = el && el.querySelector("[data-ev-start]");
    var d = m ? new Date(m.getAttribute("data-ev-start")) : null;
    return d && !isNaN(d) ? d : null;
  };
  var itemOf = function (row) { return row.closest(".w-dyn-item") || row; };
  var fixLink = function (row) {
    var m = row.querySelector("[data-ev-slug]");
    var slug = m && m.getAttribute("data-ev-slug");
    row.querySelectorAll("a").forEach(function (a) {
      var h = a.getAttribute("href");
      if ((!h || h === "#") && slug) a.setAttribute("href", "/events/" + slug);
    });
  };

  // Email placeholder on the notify form
  document.querySelectorAll(".ev-subscribe_input").forEach(function (i) {
    if (!i.getAttribute("placeholder")) i.setAttribute("placeholder", "Enter your email");
  });

  // Events page
  var root = document.querySelector("[data-events]");
  if (root) {
    var rows = Array.prototype.slice.call(root.querySelectorAll(".ev-row"));
    var list = rows.length ? rows[0].parentNode : null;
    /* Client batch 25 Nov: the featured event is not repeated in the list
       below it. Its row stays in the DOM (CMS), hidden and out of the tabs. */
    var fLink = document.querySelector("[data-ev-featured] [data-cms-slug]");
    var fSlug = fLink && fLink.getAttribute("data-cms-slug");
    if (fSlug) rows = rows.filter(function (r) {
      var m = r.querySelector("[data-ev-slug]");
      if (m && m.getAttribute("data-ev-slug") === fSlug) { itemOf(r).classList.add("ev-dup"); return false; }
      return true;
    });
    var up = [], past = [];
    rows.forEach(function (r) {
      fixLink(r);
      var d = parse(r);
      (d && d < today ? past : up).push(r);
    });
    past.sort(function (a, b) { return parse(b) - parse(a); });
    if (list) past.forEach(function (r) { list.appendChild(itemOf(r)); });
    var empty = root.querySelector("[data-ev-empty]");
    var tabs = root.querySelectorAll("[data-ev-tab]");
    var show = function (which) {
      tabs.forEach(function (t) {
        var on = t.getAttribute("data-ev-tab") === which;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-pressed", on ? "true" : "false");
      });
      tabs.forEach(function (t) {
        var seg = t.parentNode;
        if (seg.__segSelect && t.getAttribute("data-ev-tab") === which) seg.__segSelect(t);
      });
      up.forEach(function (r) { itemOf(r).style.display = which === "upcoming" ? "" : "none"; });
      past.forEach(function (r) { itemOf(r).style.display = which === "past" ? "" : "none"; });
      if (empty) {
        empty.hidden = !(which === "upcoming" && !up.length);
        /* The empty note is hidden when the scroll reveal runs, so the reveal
           leaves it at opacity 0 / visibility hidden for good; reset that
           and fade it in the same way when the Upcoming tab shows it. */
        if (!empty.hidden) {
          ["opacity", "visibility", "transform", "translate", "rotate", "scale"].forEach(function (k) { empty.style.removeProperty(k); });
          if (empty.animate && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches))
            empty.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 450, easing: "cubic-bezier(.2,.7,.2,1)" });
        }
      }
    };
    tabs.forEach(function (t) {
      t.addEventListener("click", function () { show(t.getAttribute("data-ev-tab")); });
    });
    var showNow = show;
    show = function (w) { smoothSwap(list, function () { showNow(w); }); };
    show(!up.length && past.length ? "past" : "upcoming");
  }
  document.querySelectorAll("[data-ev-featured] .ev-feature").forEach(fixLink);

  // Event template
  var cur = document.querySelector("[data-ev-current]");
  var more = document.querySelector("[data-ev-more]");
  if (more) {
    var slug = cur ? cur.getAttribute("data-ev-current") : "";
    var shown = 0;
    more.querySelectorAll(".ev-row").forEach(function (r) {
      fixLink(r);
      var m = r.querySelector("[data-ev-slug]");
      var d = parse(r);
      var hide = (m && m.getAttribute("data-ev-slug") === slug) || !d || d < today || shown >= 3;
      itemOf(r).style.display = hide ? "none" : "";
      if (!hide) shown++;
    });
    if (!shown) {
      var sec = document.querySelector("[data-ev-more-section]");
      if (sec) sec.style.display = "none";
    }
  }
  var spk = document.querySelector("[data-ev-speakers-wrap]");
  if (spk && !spk.querySelector(".ev-speaker")) spk.style.display = "none";
  document.querySelectorAll("[data-ev-venue]").forEach(function (a) {
    var h = a.getAttribute("href");
    if (!h || h === "#") {
      a.removeAttribute("href");
      var ic = a.querySelector(".ev-venue_icon");
      if (ic) ic.style.display = "none";
    }
  });
  /* Registration (client 14 Nov): upcoming events show Register on Luma when
     the link is set; past events keep the button, disabled, as Registration
     closed. The event date comes from its own row in Upcoming events
     (data-ev-start, bound to Start), else from the When date in the sidebar. */
  var evDate = null, curSlug = cur ? cur.getAttribute("data-ev-current") : "";
  if (curSlug) document.querySelectorAll("[data-ev-slug]").forEach(function (m) {
    if (!evDate && m.getAttribute("data-ev-slug") === curSlug) evDate = parse(m.closest(".ev-row") || m.parentNode);
  });
  if (!evDate) {
    var sd = document.querySelector(".ev-side_date"), mm = sd && sd.textContent.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    var mi = mm ? "january february march april may june july august september october november december".split(" ").indexOf(mm[1].toLowerCase()) : -1;
    if (mi >= 0) evDate = new Date(+mm[3], mi, +mm[2]);
  }
  var isPast = !!(evDate && evDate < today);
  document.querySelectorAll("[data-ev-register]").forEach(function (a) {
    var h = a.getAttribute("href");
    if (isPast) {
      a.removeAttribute("href");
      a.removeAttribute("target");
      a.setAttribute("aria-disabled", "true");
      a.classList.add("is-disabled");
      a.textContent = "Registration closed";
      return;
    }
    if (!h || h === "#") a.style.display = "none";
  });
}

/* ==========================================================================
   39. CMS ITEM LINKS FALLBACK
   Links inside Collection Lists set to "Current item" via the API publish
   href="#". Each such link carries data-cms-base ("/blog/") and
   data-cms-slug (bound to Slug); if the href is empty or "#", build it.
   Harmless once the link is set to Current item in the Designer.
   ========================================================================== */
function initCmsLinks() {
  document.querySelectorAll("a[data-cms-slug]").forEach(function (a) {
    var h = a.getAttribute("href");
    var slug = a.getAttribute("data-cms-slug");
    var base = a.getAttribute("data-cms-base") || "/";
    if ((!h || h === "#" || h.indexOf("detail_") === 0) && slug) a.setAttribute("href", base + slug);
  });
}

/* ==========================================================================
   40. PODCAST
   Season pills (button[data-pod-season="2"]) + search over the episode grid
   ([data-pod-list] > .pod-card with data-pod-season on the card). The
   featured episode (.pod-feature, own data-pod-season) shows only when its
   season is selected and no search is typed. Pills with no episodes are
   hidden; the newest season opens by default (?season=1 in the URL wins).
   Pagination reuses the Blog markup: [data-pod-pagination] with
   [data-pod-info] and [data-pod-pages].
   ========================================================================== */
function initPodcast() {
  var list = document.querySelector("[data-pod-list]");
  if (!list) return;
  var PER_PAGE = 9;
  var cards = [].slice.call(list.querySelectorAll("[data-pod-card]"));
  var feature = document.querySelector(".pod-feature");
  var divider = document.querySelector("[data-pod-divider]");
  var pills = [].slice.call(document.querySelectorAll("[data-pod-season]")).filter(function (p) {
    return p.tagName === "BUTTON";
  });
  var search = document.querySelector("[data-pod-search]");
  var empty = document.querySelector("[data-pod-empty]");
  var pag = document.querySelector("[data-pod-pagination]");
  var info = document.querySelector("[data-pod-info]");
  var pagesEl = document.querySelector("[data-pod-pages]");
  var seasonOf = function (el) { return el ? String(parseInt(el.getAttribute("data-pod-season"), 10) || "") : ""; };
  var seasons = {};
  cards.concat(feature ? [feature] : []).forEach(function (c) { seasons[seasonOf(c)] = true; });
  pills.forEach(function (p) { if (!seasons[seasonOf(p)]) p.style.display = "none"; });
  var nums = Object.keys(seasons).filter(Boolean).map(Number).sort(function (a, b) { return b - a; });
  var wanted = new URLSearchParams(location.search).get("season");
  var season = wanted && seasons[wanted] ? wanted : nums.length ? String(nums[0]) : "";
  var q = "";
  var page = 1;

  // Two-digit season in the badge ("S 02 : E 28")
  document.querySelectorAll("[data-pod-num]").forEach(function (n) {
    var v = n.textContent.trim();
    if (/^\d$/.test(v)) n.textContent = "0" + v;
  });
  // Empty platform links: hide the icon
  document.querySelectorAll("[data-pod-platform]").forEach(function (a) {
    var h = a.getAttribute("href");
    if (!h || h === "#") a.style.display = "none";
  });

  function matches(el) {
    if (!el) return false;
    if (q) return el.textContent.toLowerCase().indexOf(q) > -1;
    return !season || seasonOf(el) === season;
  }
  function btn(label, p, cls, aria, disabled) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.innerHTML = label;
    if (aria) b.setAttribute("aria-label", aria);
    if (disabled) {
      b.disabled = true;
      b.style.opacity = ".4";
      b.style.cursor = "default";
    } else
      b.addEventListener("click", function () { page = p; render(true); });
    return b;
  }
  function render(scroll) {
    var featOk = feature ? matches(feature) && !q : false;
    var hits = cards.filter(matches);
    var total = Math.max(1, Math.ceil(hits.length / PER_PAGE));
    if (page > total) page = total;
    var from = (page - 1) * PER_PAGE;
    cards.forEach(function (c) {
      var i = hits.indexOf(c);
      (c.closest(".w-dyn-item") || c).style.display = i >= from && i < from + PER_PAGE ? "" : "none";
    });
    if (feature) (feature.closest(".w-dyn-item") || feature).style.display = featOk && page === 1 ? "" : "none";
    if (divider) divider.style.display = featOk && page === 1 && hits.length ? "" : "none";
    if (empty) empty.style.display = !hits.length && !featOk ? "block" : "none";
    if (pag) {
      pag.style.display = total > 1 || PER_PAGE !== 9 ? "flex" : "none";
      perPageControl(pag.querySelector("[data-per-page]"), PER_PAGE, function (n) { PER_PAGE = n; page = 1; render(true); });
      if (info) info.textContent = hits.length ? "Page " + page + " of " + total : "";
      if (pagesEl) {
        pagesEl.innerHTML = "";
        var arrow = function (d) {
          return '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="' + d + '" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        };
        pagesEl.appendChild(btn(arrow("M8.5 3.5 5 7l3.5 3.5"), page - 1, "blog-page", "Previous page", page === 1));
        pageRange(page, total).forEach(function (p) {
          if (p === 0) { var gap = document.createElement("span"); gap.className = "blog-page is-gap"; gap.textContent = "…"; pagesEl.appendChild(gap); return; }
          var b = btn(String(p), p, "blog-page" + (p === page ? " is-current" : ""), "Page " + p, false);
          if (p === page) b.setAttribute("aria-current", "page");
          pagesEl.appendChild(b);
        });
        pagesEl.appendChild(btn(arrow("M5.5 3.5 9 7l-3.5 3.5"), page + 1, "blog-page", "Next page", page === total));
      }
    }
    if (scroll) {
      var target = feature && featOk && page === 1 ? feature : list;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 140, behavior: PREFERS_STILL ? "auto" : "smooth" });
    }
  }
  var renderNow = render, swapBox = list.closest(".container") || list;
  render = function (scroll) { smoothSwap(swapBox, function () { renderNow(scroll); }); };
  function setSeason(s) {
    season = s;
    page = 1;
    pills.forEach(function (p) {
      var on = seasonOf(p) === s;
      p.classList.toggle("is-active", on);
      p.setAttribute("aria-pressed", on ? "true" : "false");
    });
    render(false);
  }
  pills.forEach(function (p) {
    p.addEventListener("click", function () { setSeason(seasonOf(p)); });
  });
  if (search) {
    var timer;
    search.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        q = search.value.trim().toLowerCase();
        page = 1;
        render(false);
      }, 150);
    });
    var form = search.closest("form");
    if (form) form.addEventListener("submit", function (e) { e.preventDefault(); });
  }
  setSeason(season);
}

/* ==========================================================================
   41. GLOSSARY
   List page (/it-hiring-glossary): one CMS list of .gl-card[data-gl-card]
   sorted by name. JS inserts a letter header (.gl-head, styled in the page
   embed) before the first card of every letter, filters by category
   (button[data-gl-cat], card has data-gl-cat) and search ([data-gl-search]),
   shows 12 cards and reveals 12 more per "Load more" ([data-gl-more]).
   Letter nav buttons ([data-gl-letter]) jump to their header; letters with
   no terms get .is-empty and are disabled.
   Term page: hides an empty subtitle and empty "Related:" rows, drops the
   current term from "Explore more" and keeps 4, hides the section if empty.
   ========================================================================== */
function initGlossary() {
  // Shared: empty "Related:" rows and subtitle
  document.querySelectorAll("[data-gl-related-row]").forEach(function (row) {
    var v = row.querySelector("[data-gl-related]");
    if (!v || !v.textContent.trim()) row.style.display = "none";
  });
  document.querySelectorAll("[data-gl-sub]").forEach(function (s) {
    if (!s.textContent.trim()) s.style.display = "none";
  });

  // Term page: related terms
  var rel = document.querySelector("[data-gl-related-list]");
  if (rel) {
    var here = location.pathname.replace(/\/$/, "");
    var shownRel = 0;
    rel.querySelectorAll("[data-gl-card]").forEach(function (c) {
      var item = c.closest(".w-dyn-item") || c;
      var same = c.pathname && c.pathname.replace(/\/$/, "") === here;
      if (same || shownRel >= 4) item.style.display = "none";
      else shownRel++;
    });
    if (!shownRel) {
      var sec = document.querySelector("[data-gl-more-section]");
      if (sec) sec.style.display = "none";
    }
  }

  // List page
  var wrap = document.querySelector("[data-gl-list]");
  if (!wrap) return;
  var STEP = 12;
  var cards = [].slice.call(wrap.querySelectorAll("[data-gl-card]"));
  if (!cards.length) return;
  var listEl = (cards[0].closest(".w-dyn-item") || cards[0]).parentNode;
  var search = document.querySelector("[data-gl-search]");
  var empty = document.querySelector("[data-gl-empty]");
  var more = document.querySelector("[data-gl-more]");
  var cats = [].slice.call(document.querySelectorAll("button[data-gl-cat]"));
  var letterBtns = [].slice.call(document.querySelectorAll("[data-gl-letter]"));
  var cat = "all", q = "", limit = STEP;

  var letterOf = function (c) {
    var t = (c.querySelector(".gl-card_title") || c).textContent.trim().charAt(0).toUpperCase();
    return /[A-Z]/.test(t) ? t : "#";
  };
  var data = cards.map(function (c) {
    return { card: c, item: c.closest(".w-dyn-item") || c, letter: letterOf(c), cat: (c.getAttribute("data-gl-cat") || "").trim(), text: c.textContent.toLowerCase() };
  });

  // Letter headers
  var heads = {};
  data.forEach(function (d) {
    if (heads[d.letter]) return;
    var h = document.createElement("div");
    h.className = "gl-head";
    h.setAttribute("role", "heading");
    h.setAttribute("aria-level", "2");
    h.id = "letter-" + d.letter.toLowerCase();
    h.setAttribute("data-gl-head", d.letter);
    var s = document.createElement("span");
    s.textContent = d.letter;
    h.appendChild(s);
    listEl.insertBefore(h, d.item);
    heads[d.letter] = h;
  });
  // Letter headers sit between list items, so the list/listitem roles no longer hold.
  listEl.removeAttribute("role");
  data.forEach(function (d) { if (d.item.getAttribute("role") === "listitem") d.item.removeAttribute("role"); });

  // Letter nav: disable letters without terms
  letterBtns.forEach(function (b) {
    var L = b.getAttribute("data-gl-letter");
    if (!heads[L]) {
      b.classList.add("is-empty");
      b.disabled = true;
      b.setAttribute("aria-disabled", "true");
    }
  });

  function matches(d) {
    if (cat !== "all" && d.cat !== cat) return false;
    return !q || d.text.indexOf(q) > -1;
  }
  function setActiveLetter(L) {
    letterBtns.forEach(function (b) { b.classList.toggle("is-active", b.getAttribute("data-gl-letter") === L); });
    Object.keys(heads).forEach(function (k) { heads[k].classList.toggle("is-active", k === L); });
  }
  function render() {
    var hits = data.filter(matches);
    var shownLetters = {};
    data.forEach(function (d) { d.item.style.display = "none"; });
    hits.forEach(function (d, i) {
      if (i < limit) {
        d.item.style.display = "";
        shownLetters[d.letter] = true;
      }
    });
    Object.keys(heads).forEach(function (k) { heads[k].style.display = shownLetters[k] ? "" : "none"; });
    if (empty) empty.style.display = hits.length ? "none" : "block";
    if (more) (more.parentElement || more).style.display = hits.length > limit ? "" : "none";
    var first = hits[0] ? hits[0].letter : "";
    setActiveLetter(first);
    return hits;
  }

  var renderNow = render, swapBox = data.length ? data[0].item.parentElement : null;
  render = function () { return smoothSwap(swapBox, renderNow); };
  cats.forEach(function (b) {
    b.addEventListener("click", function () {
      cat = b.getAttribute("data-gl-cat");
      limit = STEP;
      cats.forEach(function (x) {
        var on = x === b;
        x.classList.toggle("is-active", on);
        x.setAttribute("aria-pressed", on ? "true" : "false");
      });
      render();
    });
  });
  if (search) {
    var timer;
    search.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        q = search.value.trim().toLowerCase();
        limit = STEP;
        render();
      }, 150);
    });
    var form = search.closest("form");
    if (form) form.addEventListener("submit", function (e) { e.preventDefault(); });
  }
  if (more) more.addEventListener("click", function () { limit += STEP; render(); });

  letterBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      var L = b.getAttribute("data-gl-letter");
      if (!heads[L]) return;
      // Reset filters if the letter is filtered out, then make sure it is loaded
      if (!data.some(function (d) { return d.letter === L && matches(d); })) {
        cat = "all"; q = "";
        if (search) search.value = "";
        cats.forEach(function (x) {
          var on = x.getAttribute("data-gl-cat") === "all";
          x.classList.toggle("is-active", on);
          x.setAttribute("aria-pressed", on ? "true" : "false");
        });
      }
      var hits = data.filter(matches);
      var idx = -1;
      hits.forEach(function (d, i) { if (idx < 0 && d.letter === L) idx = i; });
      var lastOfLetter = idx;
      hits.forEach(function (d, i) { if (d.letter === L) lastOfLetter = i; });
      if (lastOfLetter >= limit) limit = Math.ceil((lastOfLetter + 1) / STEP) * STEP;
      render();
      setActiveLetter(L);
      var y = heads[L].getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top: y, behavior: PREFERS_STILL ? "auto" : "smooth" });
    });
  });

  cats.forEach(function (x) { x.classList.toggle("is-active", x.getAttribute("data-gl-cat") === "all"); });
  render();
}

/* ==========================================================================
   42. ABOUT  [data-ab-values] [data-ab-ms]
   --------------------------------------------------------------------------
   Values rotator: ul[data-ab-values-list] inside .ab-values_window. The
   middle item is the active pill (white). Every tick the list slides up one
   row, then the first item moves to the end, so the loop never jumps.
   Opacity fades with distance from the middle, like the Figma frame.
   Pauses off screen. Reduced motion: static list, middle item active.

   Milestones: [data-ab-ms] with [data-ab-ms-row] (cards), [data-ab-ms-bar],
   [data-ab-ms-prev] / [data-ab-ms-next], [data-ab-ms-dots]. Pages are
   counted from how many cards fit; cards not fully in view get is-dim.
   ========================================================================== */
function initAbout() {
  /* Values rotator */
  document.querySelectorAll("[data-ab-values-list]").forEach(function (list) {
    var win = list.parentElement;
    var items = [].slice.call(list.children);
    if (items.length < 3) return;
    var K = Math.floor(items.length / 2);
    var FADE = [1, 0.7, 0.45, 0.25, 0.12, 0.06];
    var EASE = "cubic-bezier(.65,0,.35,1)";
    var step = 0, base = 0, timer = null, busy = false, onScreen = false;

    function measure() {
      var a = list.children[0].getBoundingClientRect();
      var b = list.children[1].getBoundingClientRect();
      step = b.top - a.top;
      base = win.clientHeight / 2 - (K * step + a.height / 2);
    }
    function paint(shift) {
      [].slice.call(list.children).forEach(function (li, i) {
        var d = Math.abs(i - shift - K);
        li.style.opacity = FADE[Math.min(d, FADE.length - 1)];
        /* Inactive pills sit a step smaller; scale from the arrow side so the
           column keeps its left edge. */
        li.style.transform = d === 0 ? "scale(1)" : "scale(" + Math.max(0.78, 0.9 - (d - 1) * 0.03) + ")";
        li.classList.toggle("is-active", d === 0);
      });
    }
    function place() {
      list.style.transition = "none";
      list.style.transform = "translateY(" + base + "px)";
    }
    function tick() {
      if (busy || !onScreen || document.hidden) return;
      busy = true;
      list.style.transition = "transform .7s " + EASE;
      list.style.transform = "translateY(" + (base - step) + "px)";
      paint(1);
      setTimeout(function () {
        list.appendChild(list.children[0]);
        place();
        paint(0);
        busy = false;
      }, 720);
    }

    measure(); place(); paint(0);
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { measure(); place(); }, 150);
    });
    if (PREFERS_STILL) return;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; })
        .observe(win);
    } else onScreen = true;
    timer = setInterval(tick, 2200);
  });

  /* Milestones slider */
  document.querySelectorAll("[data-ab-ms]").forEach(function (root) {
    var row = root.querySelector("[data-ab-ms-row]");
    if (!row) return;
    var view = row.parentElement;
    var cards = [].slice.call(row.children);
    var bar = root.querySelector("[data-ab-ms-bar]");
    var prev = root.querySelector("[data-ab-ms-prev]");
    var next = root.querySelector("[data-ab-ms-next]");
    var dotsEl = root.querySelector("[data-ab-ms-dots]");
    var i = 0, pages = 1, cardW = 0, maxShift = 0;

    function measure() {
      cardW = cards[0].getBoundingClientRect().width;
      maxShift = Math.max(0, row.scrollWidth - view.clientWidth);
      pages = maxShift > 1 ? Math.ceil(maxShift / cardW - 0.05) + 1 : 1;
      if (i > pages - 1) i = pages - 1;
      if (dotsEl) {
        dotsEl.innerHTML = "";
        for (var p = 0; p < pages; p++) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "ab-ms_dot";
          b.setAttribute("aria-label", "Go to milestone group " + (p + 1));
          b.addEventListener("click", (function (n) { return function () { go(n); }; })(p));
          dotsEl.appendChild(b);
        }
      }
      var nav = root.querySelector(".ab-ms_nav");
      if (nav) nav.style.display = pages > 1 ? "" : "none";
    }
    function render() {
      var x = Math.min(i * cardW, maxShift);
      row.style.transform = "translateX(" + -x + "px)";
      var left = x, right = x + view.clientWidth;
      cards.forEach(function (c) {
        var a = c.offsetLeft, z = a + c.offsetWidth;
        c.classList.toggle("is-dim", a < left - 2 || z > right + 2);
      });
      if (bar) bar.style.width = (pages > 1 ? ((i + 1) / pages) * 100 : 100) + "%";
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i >= pages - 1;
      if (dotsEl) [].slice.call(dotsEl.children).forEach(function (d, n) {
        d.classList.toggle("is-active", n === i);
        d.setAttribute("aria-current", n === i ? "true" : "false");
      });
    }
    function go(n) { i = Math.max(0, Math.min(pages - 1, n)); render(); }

    if (prev) prev.addEventListener("click", function () { go(i - 1); });
    if (next) next.addEventListener("click", function () { go(i + 1); });
    var sx = null;
    view.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    view.addEventListener("touchend", function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
      sx = null;
    });
    measure(); render();
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { measure(); render(); }, 150);
    });
  });
}

/* ==========================================================================
   43b. TESTIMONIALS SLIDER FROM THE CMS  (Cases [Slider], "Built with Yotewo")
   The slider is a native Case Studies collection list inside the component
   (items with "Show in testimonials" on; Webflow hides the rest). Quote,
   person, role, Stat 3, photo, company icon and logo are CMS bindings, the
   link is Current Case Study. CSS 65s decides photo+icon or logo alone.
   ========================================================================== */
/* Case study page, "More stories": the big card (first list, 2 items) and the
   two small cards (second list, 4 items) both come from Case Studies sorted by
   Order, so Webflow alone would show the same three stories on every page,
   including the page itself. Here the current story is dropped, the big card
   keeps one item and the small cards skip it and keep two. */
function initCaseRelated() {
  var m = location.pathname.match(/^\/case-studies\/([^\/]+)\/?$/);
  if (!m) return;
  var cur = m[1];
  document.querySelectorAll(".cases-grid").forEach(function (grid) {
    var lists = grid.querySelectorAll(":scope > .cases-grid_list.w-dyn-list");
    if (lists.length < 2) return;
    var slug = function (it) {
      var a = it.querySelector("a[href]");
      return a ? (a.getAttribute("data-cms-slug") || a.getAttribute("href").split("/").filter(Boolean).pop()) : "";
    };
    var seen = {};
    seen[cur] = 1;
    [[lists[0], 1], [lists[1], 2]].forEach(function (pair) {
      var kept = 0;
      pair[0].querySelectorAll(".w-dyn-item").forEach(function (it) {
        var s = slug(it);
        if (seen[s] || kept >= pair[1]) { it.remove(); return; }
        seen[s] = 1;
        kept++;
      });
    });
  });
}

function initCasesCms() {
  /* Testimonials slider (Cases [Slider]) is a native Case Studies list since
     14 Nov: Webflow renders the slides (Show in testimonials on), so the HTML
     carries every quote, name and link. Here only the card colour alternates,
     dark then light, as in Figma. */
  document.querySelectorAll(".div-cases-slider [data-swiper-wrap] .w-dyn-item").forEach(function (item, i) {
    var card = item.querySelector("[data-case-card]");
    if (!card || i % 2 === 0) return;
    card.classList.remove("is-dark");
    card.classList.add("is-light");
  });
}

/* ==========================================================================
   43. CMS MENU  [data-menu-col] [data-menu-nav] [data-footer-nav]
   --------------------------------------------------------------------------
   Header and Footer are components that also sit on CMS template pages, and
   Webflow does not allow a Collection List inside such a component. So the
   menus are filled from the system page /nav-data (noindex): one Collection
   List per source, each item a div[data-n] with data-s (slug), data-o
   (Order), data-h (link, Navigation only), data-g (group, Navigation only),
   data-t (hero title, Comparisons) and two flag children whose visibility is
   bound to the switches; Webflow drops a hidden flag from the HTML, so
   [data-m] present = Show in menu / Show in header, [data-f] present = Show
   in footer.
   Sources: technology, roles, industries, product, jobs (collection pages),
   vs (Comparisons), navigation (collection Navigation: links to static
   pages, with Group = the header dropdown / footer column they go in).
   Header: div[data-menu-col="technology|roles|industries|product|jobs"]
   gets the first 6 items with Show in menu (by Order, then name);
   div[data-menu-nav="<Group>"] gets the Navigation items of that group with
   Show in header (a column can have both: jobs + For engineers). Its See all
   link (a[data-menu-all]) stays last. A collection column with nothing to
   show is hidden. The mobile menu clones the desktop columns, attributes
   included, so it is filled the same way.
   Footer: div[data-footer-nav="<Group>|<Group>"] is rebuilt from the
   Navigation items of those groups with Show in footer. If it also has
   [data-footer-cms], the Show in footer items of the four Hire collections
   come first ("<Name> developers" for skills and industries). If it has
   [data-footer-vs], the Comparisons with Show in footer follow the divider
   ([data-footer-divider]) as "Yotewo vs <Name>".
   The data is read once per tab and kept in sessionStorage for 10 minutes.
   The static links stay in the published HTML, so crawlers that do not run
   JS still get real URLs, and if /nav-data cannot be loaded nothing changes.
   ========================================================================== */
function initCmsMenu() {
  if (!document.querySelector("[data-menu-col],[data-menu-nav],[data-footer-nav]")) return;

  /* "hire" = Hire Pages collection (/hire/{slug}, Nov 2026). Its items carry
     an Axis (data-g: Skill, Role, Industry, Product) that maps to the header
     column; when a column has Hire Pages flagged Show in menu, they replace
     the synced taxonomy items there, and the footer lists Hire Pages too. */
  var BASE = { technology: "/technology/", roles: "/roles/", industries: "/industries/", product: "/product/", jobs: "/jobs/", vs: "/vs/", hire: "/hire/" };
  var HIRE = ["technology", "roles", "industries", "product"];
  var AXIS = { Skill: "technology", Role: "roles", Industry: "industries", Product: "product" };
  var KEY = "ytw-cms-menu-v3";
  var TTL = 10 * 60 * 1000;

  function parse(doc) {
    var out = [];
    doc.querySelectorAll("[data-nav-src]").forEach(function (w) {
      var src = w.getAttribute("data-nav-src");
      w.querySelectorAll("[data-n]").forEach(function (el) {
        var name = (el.getAttribute("data-n") || "").trim();
        var slug = el.getAttribute("data-s") || "";
        var href = src === "navigation" ? el.getAttribute("data-h") || "" : BASE[src] ? BASE[src] + slug : "";
        /* Hire Pages: the item link inside nav-data carries the real collection
           path (/hire/ once the collection slug is "hire"). */
        if (src === "hire") { var il = el.querySelector("a[href]"); if (il && /^\/[^#]+\/[^\/]+$/.test(il.getAttribute("href"))) href = il.getAttribute("href"); }
        if (!name || !href || (src !== "navigation" && !slug)) return;
        var ord = parseFloat(el.getAttribute("data-o"));
        out.push({
          src: src,
          name: name,
          href: href,
          group: (el.getAttribute("data-g") || "").trim(),
          title: (el.getAttribute("data-t") || "").trim(),
          order: isNaN(ord) ? 9999 : ord,
          menu: !!el.querySelector("[data-m]"),
          footer: !!el.querySelector("[data-f]")
        });
      });
    });
    return out;
  }
  function readCache() {
    try {
      var c = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (c && Date.now() - c.t < TTL && c.items && c.items.length) return c.items;
    } catch (e) {}
    return null;
  }
  function writeCache(items) {
    try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), items: items })); } catch (e) {}
  }
  function load() {
    if (document.querySelector("[data-nav-data]")) return Promise.resolve(parse(document));
    var cached = readCache();
    if (cached) return Promise.resolve(cached);
    if (!window.fetch || !window.DOMParser) return Promise.resolve([]);
    return fetch("/nav-data", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (html) {
        if (!html) return [];
        var items = parse(new DOMParser().parseFromString(html, "text/html"));
        if (items.length) writeCache(items);
        return items;
      })
      .catch(function () { return []; });
  }
  function byOrder(a, b) {
    return a.order - b.order || a.name.localeCompare(b.name);
  }
  function clean(p) {
    try { return new URL(p, location.origin).pathname.replace(/\/$/, "") || "/"; } catch (e) { return p; }
  }
  var here = clean(location.pathname);
  function link(cls, href, text) {
    var a = document.createElement("a");
    a.className = cls;
    a.href = href;
    a.textContent = text;
    if (/^https?:\/\//.test(href) && href.indexOf(location.host) < 0) { a.target = "_blank"; a.rel = "noopener"; }
    else if (clean(href) === here) a.classList.add("w--current");
    return a;
  }
  function baseClass(links, fallback) {
    var a = links.filter(function (x) { return !x.children.length; })[0] || links[0];
    return a ? a.className.replace(/\bw--current\b/, "").replace(/\bis-all\b/, "").replace(/\s+/g, " ").trim() : fallback;
  }

  function fillHeader(items) {
    document.querySelectorAll("[data-menu-col],[data-menu-nav]").forEach(function (col) {
      var type = col.getAttribute("data-menu-col");
      var group = col.getAttribute("data-menu-nav");
      var list = [];
      if (type) {
        list = items.filter(function (i) { return i.src === "hire" && i.menu && AXIS[i.group] === type; }).sort(byOrder).slice(0, 6);
        if (!list.length) list = items.filter(function (i) { return i.src === type && i.menu; }).sort(byOrder).slice(0, 6);
      }
      if (group) list = list.concat(items.filter(function (i) { return i.src === "navigation" && i.group === group && i.menu; }).sort(byOrder));
      if (!list.length) {
        if (type) col.style.display = "none";
        return;
      }
      col.style.display = "";
      var all = col.querySelector("[data-menu-all]");
      var old = [].slice.call(col.querySelectorAll("a")).filter(function (a) { return !a.hasAttribute("data-menu-all"); });
      var cls = baseClass(old, "div-nav-dropdown-link");
      old.forEach(function (a) { a.remove(); });
      list.forEach(function (i) {
        var a = link(cls, i.href, i.name);
        if (all && all.parentNode === col) col.insertBefore(a, all); else col.appendChild(a);
      });
    });
  }

  /* Footer "Hire talent": one plain list (Hire Pages by axis, then Order).
     The Navigation link of that column ("All roles and skills") is shown as
     "See all" with an arrow. At most FOOTER_MAX hire links are listed;
     which ones and in what order is set in the CMS (Show in menu, Order). The comparisons get a "Compare us" label above
     them. Styles in Global Styles [After], embed 62 (.footer-group,
     .link-footer.is-all). */
  var FOOTER_MAX = 8;
  function fillFooter(items) {
    document.querySelectorAll("[data-footer-nav]").forEach(function (box) {
      var groups = box.getAttribute("data-footer-nav").split("|").map(function (g) { return g.trim(); });
      var cms = box.hasAttribute("data-footer-cms");
      var list = [];
      var hp = items.filter(function (i) { return i.src === "hire" && i.menu && AXIS[i.group]; });
      if (cms && hp.length) {
        list = hp.sort(function (a, b) { return HIRE.indexOf(AXIS[a.group]) - HIRE.indexOf(AXIS[b.group]) || byOrder(a, b); })
          .map(function (i) { return { href: i.href, text: i.title || i.name, axis: AXIS[i.group] }; })
          .slice(0, FOOTER_MAX);
      } else if (cms) {
        list = items.filter(function (i) { return HIRE.indexOf(i.src) > -1 && i.footer; })
          .sort(function (a, b) { return HIRE.indexOf(a.src) - HIRE.indexOf(b.src) || byOrder(a, b); })
          .map(function (i) {
            return { href: i.href, text: i.src === "technology" || i.src === "industries" ? i.name + " developers" : i.name, axis: i.src };
          })
          .slice(0, FOOTER_MAX);
      }
      list = list.concat(items.filter(function (i) { return i.src === "navigation" && i.footer && groups.indexOf(i.group) > -1; })
        .sort(function (a, b) { return groups.indexOf(a.group) - groups.indexOf(b.group) || byOrder(a, b); })
        .map(function (i) { return { href: i.href, text: i.name, all: cms }; }));
      var vs = !box.hasAttribute("data-footer-vs") ? [] : items.filter(function (i) { return i.src === "vs" && i.footer; }).sort(byOrder)
        .map(function (i) { return { href: i.href, text: i.title || "Yotewo vs " + i.name }; });
      if (!list.length && !vs.length) return;
      var old = [].slice.call(box.querySelectorAll("a"));
      var cls = baseClass(old, "link-footer");
      old.forEach(function (a) { a.remove(); });
      [].slice.call(box.querySelectorAll("[data-footer-gen]")).forEach(function (n) { n.remove(); });
      var div = box.querySelector("[data-footer-divider]");
      function put(node) { if (div) box.insertBefore(node, div); else box.appendChild(node); }
      function label(text, divided) {
        var l = document.createElement("div");
        l.className = "footer-group" + (divided ? " is-divided" : "");
        l.setAttribute("data-footer-gen", "");
        l.textContent = text;
        return l;
      }
      list.forEach(function (i) {
        var a = link(cls, i.href, i.text);
        if (i.all) {
          a.classList.add("is-all");
          a.setAttribute("aria-label", i.text);
          a.textContent = "See all";
        }
        put(a);
      });
      /* "Compare us" reads as a footer column title (same class as "Legal"),
         with the comparisons under it and a See all to the /compare hub.
         The divider line stays between Legal and Compare us (client, Nov
         2026); it is only hidden when there are no comparisons. */
      if (div) div.style.display = vs.length ? "" : "none";
      if (vs.length) {
        var t = label("Compare us", false);
        var colTitle = box.parentNode && box.parentNode.querySelector(".text-footer-title");
        t.className = (colTitle ? colTitle.className : "text-footer-title") + " is-sub";
        /* With the line above it the gap is already there (8px margin plus
           the column gap), so the title only gets extra space without it. */
        t.style.marginTop = div ? "0" : "1.5rem";
        box.appendChild(t);
        vs.forEach(function (i) { box.appendChild(link(cls, i.href, i.text)); });
        var all = link(cls, "/compare", "See all");
        all.classList.add("is-all");
        all.setAttribute("aria-label", "See all comparisons");
        box.appendChild(all);
      }
    });
  }

  load().then(function (items) {
    if (!items || !items.length) return;
    fillHeader(items);
    fillFooter(items);
    hpFixLinks(document);
  });
}

/* ==========================================================================
   44. MESH HOVER  [data-mesh] + known gradient backgrounds
   --------------------------------------------------------------------------
   Soft gradient backgrounds lean a little toward the cursor. Covers images
   used as backgrounds (img.ab-values_bg, img.ev-feature_bg) and elements
   whose own background is a gradient or picture (
   .div-uneven-card.is-gradient, .div-banner-background-action). Add
   data-mesh to any other element to opt in; data-mesh="off" opts out.
   An element background is moved onto an inner layer so it can be scaled
   and shifted without touching the content. The WebGL glow (section 25)
   follows the cursor on its own.
   Optional: data-mesh-shift (fraction of size, default 0.03).
   ========================================================================== */
function initMeshHover() {
  if (PREFERS_STILL) return;
  if (window.matchMedia && !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  var SEL =
    '[data-mesh]:not([data-mesh="off"]),img.ab-values_bg,img.ev-feature_bg,' +
    ".div-uneven-card.is-gradient"; /* photo banners (.div-banner-background-action) stay still: only gradients follow the cursor */
  var css = document.createElement("style");
  css.textContent =
    ".mesh-layer{position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;" +
    "will-change:transform}.has-mesh{isolation:isolate}";
  document.head.appendChild(css);

  function layerFor(el) {
    if (el.tagName === "IMG") return el;
    var cs = getComputedStyle(el);
    if (cs.backgroundImage === "none") return null;
    var layer = document.createElement("div");
    layer.className = "mesh-layer";
    layer.style.backgroundImage = cs.backgroundImage;
    layer.style.backgroundSize = cs.backgroundSize;
    layer.style.backgroundPosition = cs.backgroundPosition;
    layer.style.backgroundRepeat = cs.backgroundRepeat;
    el.style.backgroundImage = "none";
    if (cs.position === "static") el.style.position = "relative";
    if (cs.overflow === "visible") el.style.overflow = "hidden";
    el.classList.add("has-mesh");
    el.insertBefore(layer, el.firstChild);
    return layer;
  }

  [].forEach.call(document.querySelectorAll(SEL), function (el) {
    if (el.__mesh) return;
    el.__mesh = 1;
    var layer = layerFor(el);
    if (!layer) return;
    var host = el.tagName === "IMG" ? el.closest("section,.section,[class*='card'],[class*='feature']") || el.parentElement : el;
    var shift = parseFloat(el.getAttribute("data-mesh-shift")) || 0.03;
    /* Keep any scale the element already has (e.g. the blurred values bg). */
    var base = 1;
    var m = getComputedStyle(layer).transform;
    if (m && m.indexOf("matrix(") === 0) base = parseFloat(m.slice(7).split(",")[0]) || 1;
    var scale = base * (1 + shift * 2.4);
    var mx = 0, my = 0, tx = 0, ty = 0, raf = 0;
    layer.style.transformOrigin = "50% 50%";
    function frame() {
      mx += (tx - mx) * 0.06;
      my += (ty - my) * 0.06;
      layer.style.transform =
        "translate3d(" + (mx * shift * 100).toFixed(3) + "%," + (my * shift * 100).toFixed(3) + "%,0) scale(" + scale + ")";
      if (Math.abs(tx - mx) > 0.001 || Math.abs(ty - my) > 0.001) raf = requestAnimationFrame(frame);
      else raf = 0;
    }
    function kick() {
      if (!raf) raf = requestAnimationFrame(frame);
    }
    layer.style.transform = "scale(" + scale + ")";
    host.addEventListener("pointermove", function (e) {
      var r = host.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      kick();
    }, { passive: true });
    host.addEventListener("pointerleave", function () {
      tx = 0;
      ty = 0;
      kick();
    });
  });
}

/* ==========================================================================
   45. FACE ARC  img[data-face-arc="sprite url"][data-face-count]
   --------------------------------------------------------------------------
   Careers "Build what's next with us": the static arc picture becomes three
   wide rows of avatars sliding along concentric arcs, neighbouring rows in
   opposite directions (Biograph-style). Faces come from a horizontal sprite
   of square cells (128 px each, data-face-count cells). Faces fade and blur
   toward the sides and below the cut line above the heading. The <img> stays in
   place as the layout box and the no-JS / reduced-motion fallback.
   ========================================================================== */
function initFaceArc() {
  document.querySelectorAll("img[data-face-arc]").forEach(function (img) {
    var sprite = img.getAttribute("data-face-arc");
    var count = parseInt(img.getAttribute("data-face-count"), 10) || 0;
    if (!sprite || !count || PREFERS_STILL) return;
    /* Design units: the img box is the 1198 x 205 Figma frame. Three wide,
       flat, concentric arcs centred under the frame; each face is FACE units.
       Faces live on a strip that loops along the arc, so only the visible
       window is ever populated. */
    var DW = 1198, DH = 205, FACE = 40, STEP = 54, CX = 599, CY = 1100;
    var YCUT = 196, YFADE = 46, XFADE = 90;
    /* r: radius, v: units per second along the arc (sign = direction) */
    var ROWS = [
      { r: 1086, v: 13, o: 0 },
      { r: 1034, v: -17, o: 9 },
      { r: 982, v: 11, o: 19 }
    ];
    var box = document.createElement("div");
    box.className = "face-arc";
    box.setAttribute("aria-hidden", "true");
    box.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible";
    var host = img.parentElement;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.appendChild(box);

    var faces = [];
    ROWS.forEach(function (row) {
      /* half angle where the face centre drops below the cut line, plus margin */
      var th = Math.acos(Math.min(1, (CY - YCUT) / row.r)) + (STEP * 2) / row.r;
      row.n = Math.ceil((2 * th * row.r) / STEP);
      row.len = row.n * STEP;
      for (var k = 0; k < row.n; k++) {
        var d = document.createElement("div");
        var idx = (k * 5 + row.o) % count;
        d.style.cssText =
          "position:absolute;left:0;top:0;border-radius:50%;background-repeat:no-repeat;" +
          "background-image:url(" + sprite + ");background-size:" + count * 100 + "% 100%;" +
          "background-position:" + (count > 1 ? (idx / (count - 1)) * 100 : 0) + "% 0;" +
          "box-shadow:0 0 0 1px rgba(20,21,26,.06);will-change:transform,opacity;display:none";
        box.appendChild(d);
        faces.push({ el: d, row: row, k: k });
      }
    });

    var scale = 1, ox = 0, oy = 0;
    function measurePos() {
      var r = img.getBoundingClientRect(), h = host.getBoundingClientRect();
      ox = r.left - h.left;
      oy = r.top - h.top + (r.height - DH * scale) / 2;
    }
    function measure() {
      scale = img.getBoundingClientRect().width / DW;
      measurePos();
      var sz = FACE * scale;
      faces.forEach(function (f) {
        f.el.style.width = sz + "px";
        f.el.style.height = sz + "px";
      });
    }
    function ease(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
    var t = 0, last = 0, raf = 0, vis = false, shown = false;
    function render() {
      faces.forEach(function (f) {
        var row = f.row;
        var s = (((f.k * STEP + t * row.v) % row.len) + row.len) % row.len - row.len / 2;
        var a = s / row.r;
        var x = CX + row.r * Math.sin(a), y = CY - row.r * Math.cos(a);
        var o = Math.min(ease((YCUT - y) / YFADE), ease(x / XFADE), ease((DW - x) / XFADE));
        if (o <= 0.01) {
          if (f.on) { f.el.style.display = "none"; f.on = false; }
          return;
        }
        if (!f.on) { f.el.style.display = "block"; f.on = true; }
        var px = (x - FACE / 2) * scale + ox, py = (y - FACE / 2) * scale + oy;
        f.el.style.transform = "translate3d(" + px.toFixed(2) + "px," + py.toFixed(2) + "px,0) scale(" + (0.82 + 0.18 * o).toFixed(3) + ")";
        f.el.style.opacity = o.toFixed(3);
        f.el.style.filter = o < 0.98 ? "blur(" + ((1 - o) * 3).toFixed(2) + "px)" : "none";
      });
    }
    function loop(ts) {
      if (!last) last = ts;
      t += Math.min(0.05, (ts - last) / 1000);
      last = ts;
      measurePos();
      render();
      raf = vis ? requestAnimationFrame(loop) : 0;
    }
    var pic = new Image();
    pic.onload = function () {
      measure();
      render();
      if (!document.getElementById("face-arc-css")) {
        var st = document.createElement("style");
        st.id = "face-arc-css";
        st.textContent = ".face-arc-src{visibility:hidden!important}";
        document.head.appendChild(st);
      }
      img.classList.add("face-arc-src");
      shown = true;
      whenMotion(function () { if (vis && !raf) { last = 0; raf = requestAnimationFrame(loop); } });
    };
    pic.src = sprite;
    window.addEventListener("resize", function () { measure(); render(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) {
        vis = e[0].isIntersecting;
        if (vis && shown && !raf && MOTION.on) { last = 0; raf = requestAnimationFrame(loop); }
      }, { rootMargin: "100px" }).observe(host);
    } else vis = true;
  });
}

/* ==========================================================================
   46. PROMPT TYPING  img[data-prompt-type]
   --------------------------------------------------------------------------
   Interim hero "Talent search": the prompt line baked into the picture is
   covered by a live line that types, holds and erases a few prompts in a
   loop. data-prompt-type: prompts separated by "|". data-prompt-box:
   "left,top,width,height" of the prompt line in % of the image (Figma
   343:19669, placeholder 802:31874). data-prompt-font: font size in % of
   the image width (13.76px at 1280). Starts when the hero is on screen.
   ========================================================================== */
function initPromptType() {
  document.querySelectorAll("img[data-prompt-type]").forEach(function (img) {
    var prompts = (img.getAttribute("data-prompt-type") || "").split("|").map(function (p) { return p.trim(); }).filter(Boolean);
    var box = (img.getAttribute("data-prompt-box") || "").split(",").map(parseFloat);
    if (!prompts.length || box.length < 4) return;
    var fontPct = parseFloat(img.getAttribute("data-prompt-font")) || 1.075;
    var host = img.parentElement;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";

    if (!document.getElementById("prompt-type-css")) {
      var st = document.createElement("style");
      st.id = "prompt-type-css";
      st.textContent =
        ".prompt-type{position:absolute;z-index:2;display:flex;align-items:center;background:#fff;color:#141519;" +
        "font-family:Inter,sans-serif;white-space:nowrap;overflow:hidden;pointer-events:none}" +
        ".prompt-type_caret{display:inline-block;width:1px;height:1.15em;margin-left:1px;background:#0059ed;" +
        "animation:prompt-caret 1s steps(1) infinite}@keyframes prompt-caret{50%{opacity:0}}";
      document.head.appendChild(st);
    }
    var line = document.createElement("div");
    line.className = "prompt-type";
    line.setAttribute("aria-hidden", "true");
    var txt = document.createElement("span");
    var caret = document.createElement("span");
    caret.className = "prompt-type_caret";
    line.appendChild(txt);
    line.appendChild(caret);
    host.appendChild(line);

    /* The picture is object-fit: cover, so work in the drawn image box,
       not the element box. */
    function place() {
      var r = img.getBoundingClientRect(), h = host.getBoundingClientRect();
      var nw = img.naturalWidth || 1280, nh = img.naturalHeight || 456;
      var k = getComputedStyle(img).objectFit === "cover" ? Math.max(r.width / nw, r.height / nh) : Math.min(r.width / nw, r.height / nh);
      var dw = nw * k, dh = nh * k;
      var dx = r.left - h.left + (r.width - dw) / 2, dy = r.top - h.top + (r.height - dh) / 2;
      line.style.left = dx + (box[0] / 100) * dw + "px";
      line.style.top = dy + (box[1] / 100) * dh + "px";
      line.style.width = (box[2] / 100) * dw + "px";
      line.style.height = (box[3] / 100) * dh + "px";
      line.style.fontSize = (fontPct / 100) * dw + "px";
    }
    /* Per-page chips and profile roles over the baked search card, so each
       solution page shows candidates that fit it (the picture itself is the
       Interim one). Avatars, names and rates stay from the picture. Opaque
       white areas get a white patch; the translucent result rows get a hole
       cut in the picture (CSS mask) and a matching translucent patch. All
       numbers are px of the 2560x912 source. */
    var TS = {
      "/solutions/consulting": [["Consulting", "Principal", "Cloud"], ["Technology Consultant", "GCP Cloud Consultant", "AI Consultant"]],
      "/solutions/agencies": [["Engineering", "Senior", "React Native"], ["Senior React Native Engineer", "Senior React Engineer", "Senior Frontend Engineer"]],
      "/solutions/delivery-teams": [["Delivery", "Team", "MVP"], ["Delivery Manager", "Senior Full-Stack Engineer", "Business Analyst"]],
      "/solutions/enterprises": [["Engineering", "Senior", "Data"], ["Senior Data Engineer", "DevOps Lead", "Platform Engineer"]],
      "/solutions/permanent-executive": [["Leadership", "Permanent", "CTO"], ["Chief Technology Officer", "Founding Engineer", "Lead Data Engineer"]],
      "/solutions/vc-private-equity": [["Leadership", "Interim", "Due diligence"], ["Interim CTO", "Technical Due Diligence Lead", "Senior Backend Engineer"]]
    }[location.pathname.replace(/\/$/, "")];
    var tsEls = [];
    if (TS && img.getAttribute("src") && /hero-interim/.test(img.getAttribute("src"))) {
      var RATES = ["\u00a365/h", "\u00a360/h", "\u00a370/h"];
      var ICO = [
        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5"/></svg>',
        '<svg viewBox="0 0 16 16"><path fill="currentColor" d="m8 .9 1.7 1.3 2.1-.1.7 2 1.7 1.2-.7 2 .7 2-1.7 1.2-.7 2-2.1-.1L8 13.7l-1.7-1.3-2.1.1-.7-2L1.8 9.3l.7-2-.7-2 1.7-1.2.7-2 2.1.1z"/><path d="m5.6 7.4 1.7 1.7 3.2-3.2" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="6"/></svg>'
      ];
      if (!document.getElementById("ts-ov-css")) {
        var st2 = document.createElement("style");
        st2.id = "ts-ov-css";
        st2.textContent =
          ".ts-ov{position:absolute;z-index:2;display:flex;align-items:center;font-family:Inter,sans-serif;white-space:nowrap;overflow:hidden;pointer-events:none;letter-spacing:-.01em}" +
          ".ts-ov.is-chips{background:#fff}.ts-ov.is-r0{background:#fff;color:#74767d}.ts-ov.is-r1,.ts-ov.is-r2{background:rgba(249,249,249,.168);color:rgba(255,255,255,.62)}" +
          ".ts-chip{display:inline-flex;align-items:center;flex:none;border-radius:999px;background:#f2f3f5;color:#141519}.ts-chip.is-a{background:#e7f0ff;color:#0059ed}" +
          ".ts-chip svg{flex:none}.ts-chip i{font-style:normal;opacity:.45}.ts-sep{opacity:.35}.ts-rate{font-weight:500;color:#3a3c42}.ts-ov.is-r1 .ts-rate,.ts-ov.is-r2 .ts-rate{color:rgba(255,255,255,.75)}";
        document.head.appendChild(st2);
      }
      var chips = document.createElement("div");
      chips.className = "ts-ov is-chips";
      chips.setAttribute("aria-hidden", "true");
      chips.innerHTML = TS[0].map(function (c, j) {
        return '<span class="ts-chip' + (j ? "" : " is-a") + '">' + ICO[j] + "<span>" + c + "</span><i>\u00d7</i></span>";
      }).join("");
      host.appendChild(chips);
      tsEls.push([chips, [800, 286, 720, 52]]);
      [574, 650, 726].forEach(function (y, j) {
        var row = document.createElement("div");
        row.className = "ts-ov is-r" + j;
        row.setAttribute("aria-hidden", "true");
        row.innerHTML = "<span>" + TS[1][j] + '</span><span class="ts-sep">|</span><span class="ts-rate">' + RATES[j] + "</span>";
        host.appendChild(row);
        tsEls.push([row, [1062, y, 478, 30]]);
      });
    }
    function placeTs() {
      if (!tsEls.length) return;
      var r = img.getBoundingClientRect(), h = host.getBoundingClientRect();
      var nw = img.naturalWidth || 2560, nh = img.naturalHeight || 912;
      var k = getComputedStyle(img).objectFit === "cover" ? Math.max(r.width / nw, r.height / nh) : Math.min(r.width / nw, r.height / nh);
      var ox = (r.width - nw * k) / 2, oy = (r.height - nh * k) / 2;
      var f = k * (nw / 2560);
      var holes = [];
      tsEls.forEach(function (e, j) {
        var b = e[1], el = e[0];
        /* Whole pixels, shared by the patch and the hole, so no seam shows. */
        var bx = r.left - h.left, by = r.top - h.top;
        var HL = Math.round(bx + ox + b[0] * f), HT = Math.round(by + oy + b[1] * f), W = Math.round(b[2] * f), H = Math.round(b[3] * f);
        var L = HL - bx, T = HT - by;
        el.style.left = HL + "px";
        el.style.top = HT + "px";
        el.style.width = W + "px";
        el.style.height = H + "px";
        if (j === 0) {
          el.style.gap = 13 * f + "px";
          el.style.paddingLeft = 11 * f + "px";
          [].forEach.call(el.children, function (c) {
            c.style.height = 40 * f + "px";
            c.style.padding = "0 " + 15 * f + "px 0 " + 13 * f + "px";
            c.style.gap = 9 * f + "px";
            c.style.fontSize = 22 * f + "px";
            [].forEach.call(c.querySelectorAll("svg"), function (s) { s.style.width = s.style.height = 21 * f + "px"; });
          });
        } else {
          el.style.fontSize = 17.5 * f + "px";
          el.style.gap = 12 * f + "px";
          el.style.paddingLeft = 4 * f + "px";
          if (j > 1) holes.push([L, T, W, H]);
        }
      });
      var imgs = ["linear-gradient(#000,#000)"], sz = ["100% 100%"], ps = ["0 0"];
      holes.forEach(function (q) {
        imgs.push("linear-gradient(#000,#000)");
        sz.push(q[2] + "px " + q[3] + "px");
        ps.push(q[0] + "px " + q[1] + "px");
      });
      ["webkitMask", "mask"].forEach(function (p) {
        img.style[p + "Image"] = imgs.join(",");
        img.style[p + "Size"] = sz.join(",");
        img.style[p + "Position"] = ps.join(",");
        img.style[p + "Repeat"] = "no-repeat";
      });
      img.style.webkitMaskComposite = "xor";
      img.style.maskComposite = "exclude";
    }
    var place0 = place;
    place = function () { place0(); placeTs(); };
    place();
    window.addEventListener("resize", place);
    if (img.complete) place(); else img.addEventListener("load", place);

    txt.textContent = prompts[0];
    if (PREFERS_STILL) return;
    var i = 0, pos = prompts[0].length, mode = "hold", timer = 0, running = false;
    function step() {
      var p = prompts[i];
      if (mode === "type") {
        pos++;
        txt.textContent = p.slice(0, pos);
        if (pos >= p.length) { mode = "hold"; return later(2400); }
        return later(38 + Math.random() * 40);
      }
      if (mode === "hold") { mode = "erase"; return later(20); }
      if (mode === "erase") {
        pos = Math.max(0, pos - 2);
        txt.textContent = p.slice(0, pos);
        if (pos === 0) { i = (i + 1) % prompts.length; mode = "type"; return later(350); }
        return later(18);
      }
    }
    function later(ms) { timer = setTimeout(function () { if (running) step(); }, ms); }
    function start() { if (running) return; running = true; place(); later(1800); }
    function stop() { running = false; clearTimeout(timer); }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { e[0].isIntersecting ? start() : stop(); }).observe(host);
    } else start();
  });
}

/* ==========================================================================
   47. LETTER COLOUR PLAY  .bgfx-lt (headings split by data-text-glow="letters")
   --------------------------------------------------------------------------
   Letters near the cursor take their palette colour (--lc, set by section
   19) and lift a couple of pixels; they settle back as the cursor moves on.
   Works on every split heading once its entrance is done (.bgfx-done), on
   light and dark blocks alike. Fine pointers only, off for reduced motion.
   ========================================================================== */
function initLetterPlay() {
  if (PREFERS_STILL) return;
  if (window.matchMedia && !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  var R = 130;
  var heads = [];
  function collect() {
    document.querySelectorAll(".bgfx-lt").forEach(function (h) {
      if (h.__lp) return;
      h.__lp = { letters: [].slice.call(h.querySelectorAll(".bgfx-l")), pts: null, hot: false };
      heads.push(h);
    });
  }
  function measure(h) {
    var hr = h.getBoundingClientRect();
    h.__lp.pts = h.__lp.letters.map(function (l) {
      var r = l.getBoundingClientRect();
      return [r.left - hr.left + r.width / 2, r.top - hr.top + r.height / 2];
    });
  }
  var mx = -9999, my = -9999, raf = 0;
  function frame() {
    raf = 0;
    heads.forEach(function (h) {
      var st = h.__lp;
      if (!h.classList.contains("bgfx-done")) return;
      var hr = h.getBoundingClientRect();
      var near = mx > hr.left - R && mx < hr.right + R && my > hr.top - R && my < hr.bottom + R;
      if (!near && !st.hot) return;
      if (!st.pts) measure(h);
      var any = false;
      st.letters.forEach(function (l, i) {
        var p = st.pts[i];
        var dx = hr.left + p[0] - mx, dy = hr.top + p[1] - my;
        var t = near ? Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / R) : 0;
        t = t * t * (3 - 2 * t);
        if (t > 0.01) {
          any = true;
          l.style.webkitTextFillColor = "color-mix(in srgb, var(--lc) " + Math.round(t * 100) + "%, currentColor)";
          l.style.translate = "0 " + (-t * 3).toFixed(2) + "px";
          l.__lpOn = true;
        } else if (l.__lpOn) {
          l.style.webkitTextFillColor = "";
          l.style.translate = "";
          l.__lpOn = false;
        }
      });
      st.hot = any;
    });
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  collect();
  document.addEventListener("pointermove", function (e) {
    mx = e.clientX;
    my = e.clientY;
    kick();
  }, { passive: true });
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", function () {
    heads.forEach(function (h) { h.__lp.pts = null; });
  });
  /* Headings split later (CMS lists, late entrances) */
  setTimeout(collect, 1500);
  var css = document.createElement("style");
  css.textContent = ".bgfx-done .bgfx-l{transition:translate .35s cubic-bezier(.2,.7,.2,1)}";
  document.head.appendChild(css);
}

/* ==========================================================================
   48. MARQUEE EASE  .brands-marquee_track  [data-logo-marquee-track]
   --------------------------------------------------------------------------
   Hovering a marquee no longer freezes it on the spot: the CSS loop keeps
   running and its playback rate eases down to a stop (and back up on leave),
   so the strip glides to a halt. Works on any infinite CSS animation on the
   tracks below; the old :hover pause rule is overridden here.
   ========================================================================== */
/* Marquee logos, optical size. Every logo used to get the same height, so a
   wide wordmark looked three or four times bigger than a compact mark. Each
   image now carries --lr (file width / height); the CSS in Global Styles
   [After], embed 60, turns it into a height that gives all logos about the
   same area. Covers the marquees, the logo wall cells and the case study tiles.
   Without that CSS, or before an image has loaded, nothing changes. */
function initLogoOptical() {
  var SEL = ".brands-marquee_logo,.logo-teaser_logo,.img-case-logo,.partners-cell_logo";
  /* Logo files carry different amounts of empty space around the mark, so
     sizing by the file's ratio still left logos looking different sizes
     (client, Nov 2026). The visible mark is measured once on a canvas
     (pixels that differ from the corner, i.e. transparent or a flat
     background): --lr becomes the mark's own ratio, and --ink-h plus the
     four --ink-* fractions (of the file height) let the CSS size the mark
     itself and pull the empty margins back with negative margins (.is-ink).
     If the file cannot be read (no CORS), the file ratio is kept. */
  var cache = {};
  function ink(src, done) {
    if (cache[src]) return cache[src].length ? done(cache[src]) : null;
    var im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = function () {
      var r = null;
      try {
        var nw = im.naturalWidth || 300, nh = im.naturalHeight || 100;
        var W = 240, H = Math.max(8, Math.round(W * nh / nw));
        var cv = document.createElement("canvas");
        cv.width = W; cv.height = H;
        var cx = cv.getContext("2d");
        cx.drawImage(im, 0, 0, W, H);
        var d = cx.getImageData(0, 0, W, H).data;
        /* Transparent files: the mark is whatever is not transparent. Opaque
           files (flat background): whatever differs from the corner. */
        var c0 = [d[0], d[1], d[2], d[3]], clear = 0;
        for (var k = 3; k < d.length; k += 4) if (d[k] < 16) clear++;
        var alpha = clear > d.length / 4 * 0.05;
        var x0 = W, y0 = H, x1 = -1, y1 = -1, cnt = 0;
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
          var i = (y * W + x) * 4;
          var on = alpha ? d[i + 3] > 24 :
            Math.abs(d[i] - c0[0]) + Math.abs(d[i + 1] - c0[1]) + Math.abs(d[i + 2] - c0[2]) > 60;
          if (on) { cnt++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        /* Visual weight: share of the mark's box that is ink. Heavy marks
           (bold wordmarks, solid blocks) read bigger than thin ones at the
           same size, so they are scaled down a little and thin ones up
           (--ink-d, 0.8 to 1.25; 0.38 is a typical wordmark). */
        if (x1 > x0 && y1 > y0) {
          var dens = cnt / ((x1 - x0 + 1) * (y1 - y0 + 1));
          r = [W / H, x0 / H, (W - 1 - x1) / H, y0 / H, (H - 1 - y1) / H, (x1 - x0 + 1) / (y1 - y0 + 1), H / (y1 - y0 + 1),
            Math.max(0.8, Math.min(1.25, Math.sqrt(0.38 / Math.max(dens, 0.05))))];
        }
      } catch (e) { r = null; }
      cache[src] = r || [];
      if (r) done(r);
    };
    im.onerror = function () { cache[src] = []; };
    im.src = src;
  }
  function fit(img) {
    var w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return;
    img.style.setProperty("--lr", (w / h).toFixed(3));
    var src = img.currentSrc || img.src;
    if (!src || img.__ink === src) return;
    img.__ink = src;
    /* A new picture in the same img (or a copy of another logo) must not
       keep the previous logo's mark measurements. */
    img.classList.remove("is-ink");
    ["--ink-h", "--ink-l", "--ink-r", "--ink-t", "--ink-b", "--ink-d"].forEach(function (k) { img.style.removeProperty(k); });
    ink(src, function (r) {
      /* r: file ratio, left, right, top, bottom (fractions of file height),
         mark ratio, file height / mark height */
      img.style.setProperty("--lr", r[5].toFixed(3));
      img.style.setProperty("--ink-h", r[6].toFixed(3));
      img.style.setProperty("--ink-r", r[2].toFixed(4));
      img.style.setProperty("--ink-t", r[3].toFixed(4));
      img.style.setProperty("--ink-b", r[4].toFixed(4));
      img.style.setProperty("--ink-l", r[1].toFixed(4));
      img.style.setProperty("--ink-d", r[7].toFixed(3));
      img.classList.add("is-ink");
    });
  }
  [].forEach.call(document.querySelectorAll(SEL), function (img) {
    if (img.complete) fit(img);
  });
  /* Load does not bubble, so listen in the capture phase: this also covers
     lazy images and logos added later (logo wall, case pagination). */
  document.addEventListener("load", function (e) {
    var t = e.target;
    if (t && t.tagName === "IMG" && t.matches(SEL)) fit(t);
  }, true);
  /* Logos copied in later (the logo wall cycle clones its items) can come
     from the cache and be complete before anyone listens for load, so new
     or re-pointed images are also measured as soon as they appear. */
  if (window.MutationObserver) {
    var check = function (img) { if (img.complete && img.naturalWidth) fit(img); };
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === "attributes") { if (m.target.matches && m.target.matches(SEL)) { m.target.__ink = null; check(m.target); } return; }
        [].forEach.call(m.addedNodes, function (n) {
          if (n.nodeType !== 1) return;
          if (n.matches(SEL)) check(n);
          [].forEach.call(n.querySelectorAll ? n.querySelectorAll(SEL) : [], check);
        });
      });
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
  }
}

function initMarqueeEase() {
  var TRACKS = ".brands-marquee_track,[data-logo-marquee-track]";
  var HOSTS = ".div-brands-strip,[data-logo-marquee]";
  var css = document.createElement("style");
  css.textContent = ".div-brands-strip:hover .brands-marquee_track{animation-play-state:running!important}";
  document.head.appendChild(css);
  if (!document.getAnimations || PREFERS_STILL) return;
  var TAU = 0.35; /* seconds: time constant of the slow-down */
  document.querySelectorAll(TRACKS).forEach(function (track) {
    var host = track.closest(HOSTS) || track.parentElement;
    if (!host || host.__mqe) return;
    host.__mqe = 1;
    var rate = 1, target = 1, raf = 0, last = 0;
    function anims() {
      return track.getAnimations().filter(function (a) {
        var t = a.effect && a.effect.getTiming();
        return t && t.iterations === Infinity;
      });
    }
    /* The rate is applied by moving currentTime by hand while the CSS
       animation is paused, not with playbackRate: Safari does not honour
       playbackRate on CSS animations reliably and snapped the strip to
       another position a few seconds into a hover. */
    function step(ts) {
      var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0.016;
      last = ts;
      rate += (target - rate) * (1 - Math.exp(-dt / TAU));
      if (Math.abs(target - rate) < 0.01) rate = target;
      var done = rate === target;
      anims().forEach(function (a) {
        if (done && rate === 1) { if (a.playState === "paused") a.play(); return; }
        if (a.playState !== "paused") a.pause();
        var t = (a.currentTime || 0) + dt * 1000 * rate;
        a.currentTime = t;
      });
      raf = done ? 0 : requestAnimationFrame(step);
    }
    function go(t) {
      target = t;
      if (!raf) { last = 0; raf = requestAnimationFrame(step); }
    }
    host.addEventListener("pointerenter", function (e) { if (e.pointerType !== "touch") go(0); });
    host.addEventListener("pointerleave", function () { go(1); });
  });
}

/* ==========================================================================
   50. COMPARISON ROWS  .vs-table
   --------------------------------------------------------------------------
   Criteria come from the CMS and differ in length per competitor, so the
   rail row, the Yotewo row and the competitor row are given the same height
   (the tallest of the three). From 768px up; on phones the cards stack and
   rows keep their natural height.
   ========================================================================== */
function initVsRows() {
  var t = document.querySelector(".vs-table");
  if (!t) return;
  var rail = [].slice.call(t.querySelectorAll(".vs-rail .vs-crit"));
  var cols = [].slice.call(t.querySelectorAll(".vs-card")).map(function (c) {
    return [].slice.call(c.querySelectorAll(".vs-key"));
  });
  function sync() {
    var all = [rail].concat(cols);
    all.forEach(function (list) { list.forEach(function (e) { e.style.minHeight = ""; }); });
    if (window.innerWidth < 768 || !rail.length) return;
    rail.forEach(function (_, i) {
      var h = 0;
      all.forEach(function (list) { if (list[i]) h = Math.max(h, list[i].offsetHeight); });
      all.forEach(function (list) { if (list[i]) list[i].style.minHeight = h + "px"; });
    });
  }
  sync();
  var tm;
  window.addEventListener("resize", function () { clearTimeout(tm); tm = setTimeout(sync, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync);
}

/* ==========================================================================
   49. ROTATING HEADLINE  [data-rotate="line 1|line 2|..."]
   --------------------------------------------------------------------------
   The heading keeps its own text in the HTML (SEO, no-JS) and stays the only
   h1. Words all lines start with (e.g. "Hire engineers who") stay fixed on
   the first line; every few seconds the rest, on its own line, blurs and
   fades out, is replaced with the next ending, and comes back in from a blur. One element animates (no
   per-letter work), so it stays smooth. Gradient letter colours from
   section 19 are rebuilt for each line. Pauses off screen and in background
   tabs. Optional data-rotate-interval="3600" (ms).
   ========================================================================== */
function initHeadlineRotate() {
  if (PREFERS_STILL) return;
  document.querySelectorAll("[data-rotate]").forEach(function (h) {
    if (h.__rot) return;
    h.__rot = 1;
    var base = h.textContent.replace(/\s+/g, " ").trim();
    var lines = h.getAttribute("data-rotate").split("|").map(function (s) { return s.trim(); }).filter(Boolean);
    if (lines.indexOf(base) < 0) lines.unshift(base);
    if (lines.length < 2) return;
    var interval = parseInt(h.getAttribute("data-rotate-interval"), 10) || 3600;
    var OUT = 380, tries = 0;
    (function wait() {
      var split = h.querySelector(".bgfx-w");
      if (split && !h.classList.contains("bgfx-done") && tries++ < 40) return setTimeout(wait, 150);
      setup(!!split);
    })();

    function setup(split) {
      var colors = [].map.call(h.querySelectorAll(".bgfx-l"), function (l) { return l.style.getPropertyValue("--lc"); });
      var idx = Math.max(0, lines.indexOf(base)), timer = 0, vis = true, busy = false;
      /* Words every line starts with ("Hire engineers who") stay put on the
         first line; only the rest, on its own line below, blurs and changes. */
      var ws = lines.map(function (l) { return l.split(" "); }), pre = [];
      for (var pi = 0; pi < ws[0].length - 1; pi++) {
        var wd = ws[0][pi];
        if (ws.every(function (w) { return w.length > pi + 1 && w[pi] === wd; })) pre.push(wd); else break;
      }
      var prefix = pre.join(" ");
      var tails = lines.map(function (l) { return prefix ? l.slice(prefix.length).trim() : l; });
      var longest = Math.max.apply(null, lines.map(function (l) { return l.replace(/\s+/g, "").length; }));
      function colorAt(i, n) {
        if (!colors.length) return "";
        return colors[Math.round((i / Math.max(1, n - 1)) * (colors.length - 1))];
      }
      function words(text, k0, n) {
        var frag = document.createDocumentFragment(), k = k0;
        if (!split) { frag.appendChild(document.createTextNode(text)); return frag; }
        text.split(" ").forEach(function (word, wi) {
          if (wi) frag.appendChild(document.createTextNode(" "));
          var w = document.createElement("span");
          w.className = "bgfx-w";
          w.setAttribute("aria-hidden", "true");
          w.style.whiteSpace = "nowrap";
          for (var c = 0; c < word.length; c++) {
            var l = document.createElement("span");
            l.className = "bgfx-l";
            l.textContent = word[c];
            var col = colorAt(k++, n);
            if (col) l.style.setProperty("--lc", col);
            w.appendChild(l);
          }
          frag.appendChild(w);
        });
        return frag;
      }
      var el = h, preN = prefix.replace(/\s+/g, "").length;
      if (prefix) {
        h.textContent = "";
        var ps = document.createElement("span");
        ps.className = "rot-pre";
        ps.appendChild(words(prefix, 0, longest));
        el = document.createElement("span");
        el.className = "rot-line";
        el.style.display = "block";
        h.appendChild(ps);
        h.appendChild(el);
      }
      el.style.willChange = "opacity, transform, filter";
      function render(i) {
        el.textContent = "";
        el.appendChild(words(tails[i], preN, preN + tails[i].replace(/\s+/g, "").length));
        if (h.__lp) { h.__lp.letters = [].slice.call(h.querySelectorAll(".bgfx-l")); h.__lp.pts = null; }
      }
      if (prefix) render(idx);
      h.setAttribute("aria-label", lines[idx]);
      /* Keep the block height steady when a line wraps differently. */
      /* Lock to the tallest line, not the first one: on phones some endings
         wrap to an extra line and would push the paragraph down mid-loop. */
      var fixH = function () {
        h.style.minHeight = "";
        var mx = h.offsetHeight;
        if (prefix) {
          tails.forEach(function (t, i) { render(i); mx = Math.max(mx, h.offsetHeight); });
          render(idx);
        }
        h.style.minHeight = mx + "px";
      };
      fixH();
      window.addEventListener("resize", fixH);
      function swap() {
        if (busy) return;
        busy = true;
        el.style.transition = "opacity " + OUT + "ms ease, transform " + OUT + "ms ease, filter " + OUT + "ms ease";
        el.style.opacity = "0";
        el.style.transform = "translateY(-0.12em)";
        el.style.filter = "blur(12px)";
        setTimeout(function () {
          idx = (idx + 1) % lines.length;
          el.style.transition = "none";
          el.style.transform = "translateY(0.15em)";
          el.style.filter = "blur(12px)";
          render(idx);
          h.setAttribute("aria-label", lines[idx]);
          void el.offsetWidth;
          el.style.transition = "opacity .6s ease, transform .7s cubic-bezier(.2,.7,.2,1), filter .7s cubic-bezier(.2,.7,.2,1)";
          el.style.opacity = "";
          el.style.transform = "";
          el.style.filter = "";
          setTimeout(function () { busy = false; }, 720);
        }, OUT + 20);
      }
      function tick() {
        timer = 0;
        if (!vis || document.hidden) return;
        swap();
        timer = setTimeout(tick, interval);
      }
      function start() { if (!timer) timer = setTimeout(tick, interval); }
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (e) {
          vis = e[0].isIntersecting;
          if (vis) start(); else { clearTimeout(timer); timer = 0; }
        }).observe(h);
      } else start();
      document.addEventListener("visibilitychange", function () { if (!document.hidden && vis) start(); });
    }
  });
}



/* ==========================================================================
   51. COVER IMAGE SIZES  img[srcset] with object-fit: cover
   ==========================================================================
   Webflow writes `sizes` from the element width only. A cover image in a
   box taller than its own aspect (photo heroes, hero visuals on mobile) is
   cropped and scaled up, so the browser picks a variant that is far too
   small and the photo looks soft. This sets `sizes` to the width the image
   is really drawn at, so the browser takes a sharp candidate from srcset.
   It only ever raises `sizes`, re-checks on resize, and skips images that
   are hidden or already sharp. */
function initCoverSizes() {
  function need(img) {
    var r = img.getBoundingClientRect();
    if (!r.width || !r.height) return 0;
    var cs = getComputedStyle(img);
    if (cs.objectFit !== "cover") return 0;
    var nw = img.naturalWidth, nh = img.naturalHeight;
    /* Before decode the intrinsic size is unknown: fall back to the
       width/height attributes, then to 16:9 (the common hero ratio). */
    var ar = nw && nh ? nw / nh : (+img.getAttribute("width") && +img.getAttribute("height") ? img.getAttribute("width") / img.getAttribute("height") : 16 / 9);
    return Math.ceil(Math.max(r.width, r.height * ar));
  }
  function fix(img) {
    var w = need(img);
    if (!w) return;
    var cur = parseInt(img.getAttribute("data-cover-sizes"), 10) || 0;
    if (w <= cur) return;
    /* Skip when the current sizes already asks for at least this width. */
    var s = img.getAttribute("sizes") || "";
    if (!cur && /^\s*\d+px\s*$/.test(s) && parseInt(s, 10) >= w) return;
    img.setAttribute("data-cover-sizes", w);
    img.setAttribute("sizes", w + "px");
  }
  function run() {
    [].slice.call(document.querySelectorAll("img[srcset]")).forEach(fix);
  }
  run();
  /* Lazy images get their real box once laid out; check again after load. */
  [].slice.call(document.querySelectorAll("img[srcset]")).forEach(function (img) {
    if (!img.complete) img.addEventListener("load", function () { fix(img); }, { once: true });
  });
  var t;
  window.addEventListener("resize", function () {
    clearTimeout(t);
    t = setTimeout(run, 200);
  }, { passive: true });
}

/* ==========================================================================
   52. ROLE DRUM  .grid-vet-examples .vet-example_media  (/vetting)
   ==========================================================================
   Live version of the Figma role cards: role names fan out above and below
   the pill (left aligned, tilted like a wheel seen from the side) over the
   card's own glow, the card's role first in the pill, one step every 2.4s.
   Slot geometry (offset, tilt, opacity) is measured from the Figma frames
   and scales with the card (cqh). Roles come from the cards' h3
   (.vet-example_role) plus the grid's data-role-drum-extra list. Each card
   starts at its own role with an offset, pauses off screen and in hidden
   tabs, and stays still with reduced motion. Styles: Global Styles [After]
   embed 315f4cc7. The original <img> stays as the no-JS fallback. */
function initRoleDrum() {
  var grid = document.querySelector(".grid-vet-examples");
  if (!grid) return;
  var cards = [].slice.call(grid.querySelectorAll(".vet-example"));
  if (!cards.length) return;
  var extra = (grid.getAttribute("data-role-drum-extra") ||
    "Senior Product Engineer,Interim Head of Engineering,DevOps Engineer,Frontend Developer")
    .split(",").map(function (x) { return x.trim(); }).filter(Boolean);
  var roles = [];
  cards.forEach(function (c) {
    var h = c.querySelector(".vet-example_role");
    var t = h && h.textContent.trim();
    if (t && roles.indexOf(t) < 0) roles.push(t);
  });
  extra.forEach(function (t) { if (roles.indexOf(t) < 0) roles.push(t); });
  if (roles.length < 5) return;
  var N = roles.length, HOLD = 2400;
  /* d = position relative to the pill: [offset cqh, tilt deg, opacity] */
  var SLOT = {
    "-3": [-45, -22, 0], "-2": [-32.5, -14, 0.3], "-1": [-18.5, -5, 0.78],
    "0": [0, 0, 0],
    "1": [18.5, 5, 0.78], "2": [32.5, 14, 0.3], "3": [45, 22, 0]
  };
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MARK = '<svg viewBox="0 0 16 16" fill="none"><path d="M2 6.5c2-2 4-2 6 0s4 2 6 0M2 10.5c2-2 4-2 6 0s4 2 6 0" stroke="#0b0c0e" stroke-width="1.8" stroke-linecap="round"/></svg>';
  cards.forEach(function (card, ci) {
    var media = card.querySelector(".vet-example_media");
    var h = card.querySelector(".vet-example_role");
    if (!media || !h || media.__drum) return;
    media.__drum = 1;
    var idx = Math.max(0, roles.indexOf(h.textContent.trim()));
    var drum = document.createElement("div");
    drum.className = "vr-drum";
    drum.setAttribute("aria-hidden", "true");
    var names = roles.map(function (r) {
      var n = document.createElement("span");
      n.className = "vr-name";
      n.textContent = r;
      drum.appendChild(n);
      return n;
    });
    var pill = document.createElement("div");
    pill.className = "vr-pill";
    pill.setAttribute("aria-hidden", "true");
    pill.innerHTML = '<span class="vr-mark">' + MARK + '</span><span class="vr-label"><span></span></span>';
    var label = pill.querySelector(".vr-label");
    media.appendChild(drum);
    media.appendChild(pill);
    media.classList.add("vr-on");
    function paint() {
      names.forEach(function (n, i) {
        var d = (((i - idx) % N) + N) % N;
        if (d > N / 2) d -= N;
        var s = SLOT[Math.max(-3, Math.min(3, d))];
        n.style.setProperty("--y", s[0] + "cqh");
        n.style.setProperty("--r", s[1] + "deg");
        n.style.opacity = s[2];
        /* a name wrapping round the back (top to bottom) jumps unseen */
        n.style.transition = n._d != null && Math.abs(d - n._d) > 1 ? "none" : "";
        n._d = d;
      });
    }
    function setLabel(text, animate) {
      var cur = label.lastElementChild;
      if (!animate) {
        cur.textContent = text;
        label.style.width = cur.scrollWidth + "px";
        return;
      }
      var nx = document.createElement("span");
      nx.textContent = text;
      nx.className = "is-in";
      label.appendChild(nx);
      label.style.width = nx.scrollWidth + "px";
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          cur.classList.add("is-out");
          nx.classList.remove("is-in");
        });
      });
      setTimeout(function () { if (cur.parentNode) cur.parentNode.removeChild(cur); }, 900);
    }
    paint();
    setLabel(roles[idx], false);
    if (still) return;
    var visible = false;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.2 }).observe(media);
    } else visible = true;
    function tick() {
      if (visible && !document.hidden) {
        idx = (idx + 1) % N;
        paint();
        setLabel(roles[idx], true);
      }
      setTimeout(tick, HOLD);
    }
    setTimeout(tick, HOLD + ci * 600);
  });
}

/* ==========================================================================
   53. LIVE WIDGETS  img[src*="ill-"], img[src*="-stage-"]
   ==========================================================================
   The product UI illustrations are drawn in HTML/CSS (kit + widget styles in
   Global Styles, "Live widgets"). The webp stays in the page as the fallback
   and keeps its alt text; the widget is laid over it, aria-hidden and
   data-nosnippet, so search and AI answers never quote mockup names or
   numbers. At rest nothing moves; on hover the widget lifts slightly and runs
   its one story (CSS data-fx), counters count up. The glow behind stays the
   site's own (it follows the cursor as before). Touch and
   reduced motion get the still widget. Widgets mount when they come near the
   viewport. Templates: LW_TEMPLATES (built from scratchpad lw/widgets).
   Hero widgets loop instead of waiting for hover: skills-hero-chat
   (Technologies and Roles hero) and vs-hero-visual (compare pages /vs: the
   search is typed and sent, the request runs through the Yotewo tile and
   the three vetted matches arrive; styles in Global Styles embed 57). */
var LW_TEMPLATES = {/*LW_TEMPLATES*/
  "delivery-scope": "<div class=\"lw lw-delivery-scope\" style=\"--W:478;--H:400\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:71;--y:106;--w:336;--a:.1;--r:14.7\"><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pt:11.8;--pb:11.8;--pr:13.5;--pl:13.5;--g:6.8\"><svg class=\"lw-ico\" style=\"--s:13.5\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2 10v2h8v-2zm0 4v2h6v-2z\"/></svg><span class=\"lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">Project scope</span><span class=\"lw-chip gb\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5\">AI draft</span></div><div class=\"sc lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot d1\"></i>User accounts</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5\">40h</span><span class=\"lw-chip gb\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--i:0\">Estimated</span></div><div class=\"sc lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot d2\"></i>Payments</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5\">56h</span><span class=\"lw-chip gb\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--i:1\">Estimated</span></div><div class=\"sc lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot d3\"></i>Admin dashboard</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5\">64h</span><span class=\"lw-chip gb\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--i:2\">Estimated</span></div><div class=\"sc lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot d4\"></i>Reporting API</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5\">?</span><span class=\"lw-chip bl\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--i:3\">Clarify</span></div></div></div></div>",
  "delivery-estimate": "<div class=\"lw lw-delivery-estimate\" style=\"--W:478;--H:400\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:71;--y:100;--w:336;--a:.1;--r:14.7\"><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pt:11.8;--pb:11.8;--pr:13.5;--pl:13.5;--g:6.8\"><svg class=\"lw-ico\" style=\"--s:13.5\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"><rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"2\"/><path d=\"M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h2M12 18h2\"/></svg><span class=\"lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">Estimate</span><span class=\"lw-chip bl\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5\">Approved</span></div><div class=\"sc lw-col lw-pad\" style=\"--pt:13.5;--pb:13.5;--pl:13.5;--pr:13.5;--g:8.5\"><span class=\"lw-t lw-m cap\" style=\"--fs:8.5;--lh:10.2;--ls:.14;opacity:.5\">Total effort</span><span class=\"lw-t lw-w\" style=\"--fs:30.6;--lh:34;--ls:-.3\"><span data-lw-count=\"420\" data-lw-from=\"0\">420</span>h</span><div class=\"lw-row\" style=\"height:calc(8.5*var(--u));gap:calc(2.5*var(--u))\"><i class=\"lw-dot d1\" style=\"background:#7aa7ff;flex:160 1 0;width:auto;height:100%;border-radius:calc(3*var(--u))\"></i><i class=\"lw-dot d2\" style=\"background:#a98bff;flex:200 1 0;width:auto;height:100%;border-radius:calc(3*var(--u))\"></i><i class=\"lw-dot d3\" style=\"background:#4ade80;flex:60 1 0;width:auto;height:100%;border-radius:calc(3*var(--u))\"></i></div><div class=\"lw-row\" style=\"--g:13.5;flex-wrap:wrap\"><span class=\"lw-row lw-t\" data-fx=\"pop\" style=\"--fs:10.2;--lh:13.5;--g:5.1;--i:0\"><i class=\"lw-dot d1\" style=\"background:#7aa7ff\"></i>Frontend<span class=\"lw-m\" style=\"opacity:.6\">160h</span></span><span class=\"lw-row lw-t\" data-fx=\"pop\" style=\"--fs:10.2;--lh:13.5;--g:5.1;--i:1\"><i class=\"lw-dot d2\" style=\"background:#a98bff\"></i>Backend<span class=\"lw-m\" style=\"opacity:.6\">200h</span></span><span class=\"lw-row lw-t\" data-fx=\"pop\" style=\"--fs:10.2;--lh:13.5;--g:5.1;--i:2\"><i class=\"lw-dot d3\" style=\"background:#4ade80\"></i>QA<span class=\"lw-m\" style=\"opacity:.6\">60h</span></span></div></div><div class=\"sc lw-row lw-pad\" style=\"--h:41.1;--pl:13.5;--pr:13.5;--g:6.8\"><span class=\"lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">Timeline and budget</span><span class=\"lw-chip bl\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--i:4\">Fixed</span></div></div></div></div>",
  "engagement-setup": "<div class=\"lw lw-bento-interim-1 lw-engagement-setup\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs bk\" style=\"--x:393.5;--y:93.5;--w:6;--h:153;--d:9;--i:1;opacity:.7\" data-fx=\"slide-x\"></div><div class=\"lw-abs bk\" style=\"--x:387.5;--y:65.5;--w:6;--h:209;--d:5\" data-fx=\"slide-x\"></div><div class=\"lw-abs lw-glass lw-col lw-pad\" style=\"--x:162.5;--y:48.5;--w:225;--h:242.9;--r:10.2;--a:.2;--p:10.2;--g:10.2\"><div class=\"lw-row lw-between\"><span class=\"lw-row\" style=\"--g:5.1\"><svg class=\"lw-ico\" style=\"--s:15.3;opacity:.6\" viewBox=\"0 0 16 16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\"><circle cx=\"8\" cy=\"9\" r=\"5.2\"/><path d=\"M8 6.4V9M6 1.8h4\"/></svg><span class=\"lw-t lw-m lw-w\" style=\"--fs:10.2;--lh:15.3;--ls:-.11\">Workload</span></span><span class=\"lw-btn is-glass\" style=\"--h:20.7;--px:5.5;--r:5.1;--fs:8.9;gap:calc(2*var(--u))\"><svg class=\"lw-ico\" style=\"--s:10;opacity:.5\" viewBox=\"0 0 10 10\" fill=\"currentColor\"><rect x=\"1\" y=\"5\" width=\"2\" height=\"4\" rx=\".4\"/><rect x=\"4\" y=\"1\" width=\"2\" height=\"8\" rx=\".4\"/><rect x=\"7\" y=\"3.5\" width=\"2\" height=\"5.5\" rx=\".4\"/></svg>Ranges</span></div><div class=\"tm lw-col\"><div class=\"dd lw-row lw-pad\" style=\"--g:6;--pl:7.7;--pr:6.4\"><svg class=\"lw-ico\" style=\"--s:10\" viewBox=\"0 0 10 10\" fill=\"currentColor\"><path d=\"M3.5 2V1.4c0-.3.2-.5.5-.5h2c.3 0 .5.2.5.5V2h2.2c.4 0 .8.4.8.8v1.5H.5V2.8c0-.4.4-.8.8-.8zM.5 5h9v3.2c0 .5-.4.8-.8.8H1.3c-.4 0-.8-.3-.8-.8z\"/></svg><span class=\"lw-t lw-m lw-w lw-grow\" style=\"--fs:8.9;--lh:12.8\">Part-time workload</span><svg class=\"lw-ico\" style=\"--s:12.8;opacity:.5\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3.5 4.8 6 7.2l2.5-2.4\"/></svg></div><div class=\"ct lw-col lw-center\" style=\"--h:76.7;--g:3.8\"><span class=\"lw-t lw-m lw-w6 cap\" style=\"--fs:7;--lh:7.7;--ls:.14\">Selected workload</span><span class=\"lw-t lw-m lw-w\" style=\"--fs:25.6;--lh:30.7;--ls:-.26\"><span data-lw-count=\"80\" data-lw-from=\"40\">80</span>h<span style=\"opacity:.5\">/mo</span></span></div></div><span class=\"lw-t lw-m cap\" style=\"--fs:7;--lh:8;--ls:.14;opacity:.5\">Common options</span><div class=\"lw-row\" style=\"--g:6.4;align-items:flex-start\"><span class=\"ic\" style=\"--w:25.6;--h:25.6\"><svg class=\"lw-ico\" style=\"--s:12.8\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".9\" stroke-linecap=\"round\"><circle cx=\"6\" cy=\"4\" r=\"2.2\"/><path d=\"M2.2 10.4c.5-1.8 2-2.8 3.8-2.8s3.3 1 3.8 2.8\"/></svg></span><span class=\"lw-col lw-grow\" style=\"--g:2.6\"><span class=\"lw-t lw-m lw-w\" style=\"--fs:8.9;--lh:12.8\">Part-time workload</span><span class=\"lw-t lw-w6\" style=\"--fs:7.7;--lh:10.2;opacity:.85\">40\u2013120h per month</span></span><svg class=\"lw-ico\" style=\"--s:12.8;opacity:.5;margin:calc(3.8*var(--u))\" viewBox=\"0 0 12 12\" fill=\"currentColor\"><circle cx=\"6\" cy=\"2.6\" r=\".75\"/><circle cx=\"6\" cy=\"6\" r=\".75\"/><circle cx=\"6\" cy=\"9.4\" r=\".75\"/></svg></div><div class=\"lw-row\" style=\"--g:6.4;align-items:flex-start\"><span class=\"ic\" style=\"--w:25.6;--h:25.6\"><svg class=\"lw-ico\" style=\"--s:12.8\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".9\" stroke-linecap=\"round\"><circle cx=\"4.6\" cy=\"4\" r=\"2\"/><path d=\"M1.2 10.2c.4-1.6 1.8-2.6 3.4-2.6s3 1 3.4 2.6M8 2.1a2 2 0 0 1 0 3.8M9.4 7.8c.8.4 1.2 1.2 1.4 2.4\"/></svg></span><span class=\"lw-col lw-grow\" style=\"--g:2.6\"><span class=\"lw-t lw-m lw-w\" style=\"--fs:8.9;--lh:12.8\">Full-time workload</span><span class=\"lw-t lw-w6\" style=\"--fs:7.7;--lh:10.2;opacity:.85\">160\u2013184h per month</span></span><svg class=\"lw-ico\" style=\"--s:12.8;opacity:.5;margin:calc(3.8*var(--u))\" viewBox=\"0 0 12 12\" fill=\"currentColor\"><circle cx=\"6\" cy=\"2.6\" r=\".75\"/><circle cx=\"6\" cy=\"6\" r=\".75\"/><circle cx=\"6\" cy=\"9.4\" r=\".75\"/></svg></div></div></div></div>",
  "acq-diligence": "<div class=\"lw lw-acq-diligence\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:135.0;--y:40;--w:280;--r:13;--a:.1\"><div class=\"lw-row lw-between lw-pad\" style=\"--p:11;--g:6\"><span class=\"lw-row\" style=\"--g:6\"><svg class=\"lw-ico\" style=\"--s:12;color:rgba(255,255,255,.6)\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2 10v2h8v-2zm0 4v2h6v-2z\"/></svg><span class=\"lw-t lw-m lw-w\" style=\"--fs:11;--lh:15\">Due diligence</span></span><span class=\"lw-chip is-glass\" style=\"--fs:8.5;--px:6;--py:2;--r:99;--i:0\">4 areas</span></div><div class=\"lw-row lw-between lw-pad\" style=\"--pt:8;--pb:8;--pl:11;--pr:11;border-top:calc(.6*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-w\" style=\"--fs:10;--lh:13\">Financials</span><span class=\"lw-t\" style=\"--fs:8.5;--lh:11;color:rgba(255,255,255,.55)\">Revenue, margins, EBITDA</span></span><span style=\"color:rgba(255,255,255,.35);--i:1;border-radius:50%;display:inline-grid\" data-fx=\"ok\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"currentColor\"/><path d=\"m7 12.5 3.3 3.3L17 9\" fill=\"none\" stroke=\"#1b1d22\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span></div><div class=\"lw-row lw-between lw-pad\" style=\"--pt:8;--pb:8;--pl:11;--pr:11;border-top:calc(.6*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-w\" style=\"--fs:10;--lh:13\">Client base</span><span class=\"lw-t\" style=\"--fs:8.5;--lh:11;color:rgba(255,255,255,.55)\">Contracts and retention</span></span><span style=\"color:rgba(255,255,255,.35);--i:2;border-radius:50%;display:inline-grid\" data-fx=\"ok\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"currentColor\"/><path d=\"m7 12.5 3.3 3.3L17 9\" fill=\"none\" stroke=\"#1b1d22\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span></div><div class=\"lw-row lw-between lw-pad\" style=\"--pt:8;--pb:8;--pl:11;--pr:11;border-top:calc(.6*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-w\" style=\"--fs:10;--lh:13\">Team</span><span class=\"lw-t\" style=\"--fs:8.5;--lh:11;color:rgba(255,255,255,.55)\">Recruiters and key people</span></span><span style=\"color:rgba(255,255,255,.35);--i:3;border-radius:50%;display:inline-grid\" data-fx=\"ok\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"currentColor\"/><path d=\"m7 12.5 3.3 3.3L17 9\" fill=\"none\" stroke=\"#1b1d22\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span></div><div class=\"lw-row lw-between lw-pad\" style=\"--pt:8;--pb:8;--pl:11;--pr:11;border-top:calc(.6*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-w\" style=\"--fs:10;--lh:13\">Operations</span><span class=\"lw-t\" style=\"--fs:8.5;--lh:11;color:rgba(255,255,255,.55)\">Process and tooling</span></span><span style=\"color:rgba(255,255,255,.35);--i:4;border-radius:50%;display:inline-grid\" data-fx=\"ok\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"currentColor\"/><path d=\"m7 12.5 3.3 3.3L17 9\" fill=\"none\" stroke=\"#1b1d22\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span></div><div class=\"lw-pad\" style=\"--p:11\"><div class=\"lw-bar\" style=\"--h:4\" data-fx=\"fill\"><i style=\"--v:55;--to:100\"></i></div></div></div></div></div>",
  "acq-intro": "<div class=\"lw lw-acq-intro\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:135.0;--y:78;--w:280;--r:13;--a:.1\"><div class=\"lw-row lw-between lw-pad\" style=\"--p:11;--g:6\"><span class=\"lw-row\" style=\"--g:6\"><svg class=\"lw-ico\" style=\"--s:12;color:rgba(255,255,255,.6)\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"><rect x=\"3.5\" y=\"5\" width=\"17\" height=\"15\" rx=\"3\"/><path d=\"M8 3v4M16 3v4M3.5 10h17\"/></svg><span class=\"lw-t lw-m lw-w\" style=\"--fs:11;--lh:15\">Introductory call</span></span><span class=\"lw-chip is-glass\" style=\"--fs:8.5;--px:6;--py:2;--r:99;--i:0\">30 min</span></div><div class=\"lw-row lw-between lw-pad\" style=\"--pt:8;--pb:8;--pl:11;--pr:11;border-top:calc(.6*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-w\" style=\"--fs:10;--lh:13\">Agency founder</span><span class=\"lw-t\" style=\"--fs:8.5;--lh:11;color:rgba(255,255,255,.55)\">Your goals and timing</span></span><span style=\"color:rgba(255,255,255,.35);--i:1;border-radius:50%;display:inline-grid\" data-fx=\"ok\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"currentColor\"/><path d=\"m7 12.5 3.3 3.3L17 9\" fill=\"none\" stroke=\"#1b1d22\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span></div><div class=\"lw-row lw-between lw-pad\" style=\"--pt:8;--pb:8;--pl:11;--pr:11;border-top:calc(.6*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-w\" style=\"--fs:10;--lh:13\">Yotewo M&amp;A team</span><span class=\"lw-t\" style=\"--fs:8.5;--lh:11;color:rgba(255,255,255,.55)\">Questions about the exit</span></span><span style=\"color:rgba(255,255,255,.35);--i:2;border-radius:50%;display:inline-grid\" data-fx=\"ok\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"currentColor\"/><path d=\"m7 12.5 3.3 3.3L17 9\" fill=\"none\" stroke=\"#1b1d22\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span></div><div class=\"lw-row lw-between lw-pad\" style=\"--p:11\"><span class=\"lw-t\" style=\"--fs:9;color:rgba(255,255,255,.55)\">Video call</span><span style=\"display:inline-grid;justify-items:end\"><span class=\"lw-t lw-m lw-w\" style=\"--fs:9.5;grid-area:1/1;--i:3\" data-fx=\"swap-out\">Pending</span><span class=\"lw-t lw-m\" style=\"--fs:9.5;grid-area:1/1;color:#3ee089;--i:3\" data-fx=\"swap-in\">Confirmed</span></span></div></div></div></div>",
  "acq-offer": "<div class=\"lw lw-acq-offer\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:135.0;--y:50;--w:280;--r:13;--a:.1\"><div class=\"lw-row lw-between lw-pad\" style=\"--p:11;--g:6\"><span class=\"lw-row\" style=\"--g:6\"><svg class=\"lw-ico\" style=\"--s:12;color:rgba(255,255,255,.6)\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 21V4h11l-2 4 2 4H5\"/></svg><span class=\"lw-t lw-m lw-w\" style=\"--fs:11;--lh:15\">Offer</span></span><span style=\"display:inline-grid;justify-items:end\"><span class=\"lw-chip is-glass\" style=\"--fs:8.5;--px:6;--py:2;--r:99;grid-area:1/1\" data-fx=\"swap-out\">Sent</span><span class=\"lw-chip\" style=\"--bg:#ecfdec;--c:#269141;--fs:8.5;--px:6;--py:2;--r:99;grid-area:1/1\" data-fx=\"swap-in\">Accepted</span></span></div><div class=\"lw-row lw-between lw-pad\" style=\"--pt:8;--pb:8;--pl:11;--pr:11;border-top:calc(.6*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-w\" style=\"--fs:10;--lh:13\">Structure</span><span class=\"lw-t\" style=\"--fs:8.5;--lh:11;color:rgba(255,255,255,.55)\">Share or asset purchase</span></span><span class=\"lw-t lw-w8\" style=\"--fs:9.5\">Share</span></div><div class=\"lw-row lw-between lw-pad\" style=\"--pt:8;--pb:8;--pl:11;--pr:11;border-top:calc(.6*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-w\" style=\"--fs:10;--lh:13\">Valuation</span><span class=\"lw-t\" style=\"--fs:8.5;--lh:11;color:rgba(255,255,255,.55)\">Based on core indicators</span></span><span class=\"lw-t lw-w8\" style=\"--fs:9.5\">Agreed</span></div><div class=\"lw-row lw-between lw-pad\" style=\"--pt:8;--pb:8;--pl:11;--pr:11;border-top:calc(.6*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-w\" style=\"--fs:10;--lh:13\">Payment</span><span class=\"lw-t\" style=\"--fs:8.5;--lh:11;color:rgba(255,255,255,.55)\">Built around your liquidity</span></span><span class=\"lw-t lw-w8\" style=\"--fs:9.5\">Upfront + deferred</span></div><div class=\"lw-pad\" style=\"--p:11\"><span class=\"lw-btn\" style=\"--h:24;width:100%\">Review offer</span></div></div></div></div>",
  "acq-structure": "<div class=\"lw lw-acq-structure\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:135.0;--y:90;--w:280;--r:13;--a:.1\"><div class=\"lw-row lw-between lw-pad\" style=\"--p:11;--g:6\"><span class=\"lw-row\" style=\"--g:6\"><svg class=\"lw-ico\" style=\"--s:12;color:rgba(255,255,255,.6)\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2 10v2h8v-2zm0 4v2h6v-2z\"/></svg><span class=\"lw-t lw-m lw-w\" style=\"--fs:11;--lh:15\">Deal structure</span></span><span class=\"lw-chip is-glass\" style=\"--fs:8.5;--px:6;--py:2;--r:99;--i:0\">Tailored</span></div><div class=\"lw-row lw-pad\" style=\"--p:11;--g:8\"><div class=\"lw-col lw-grow lw-pad\" style=\"--p:9;--g:3;border-radius:calc(9*var(--u));background:rgba(255,255,255,.14);border:calc(.7*var(--u)) solid rgba(255,255,255,.35)\"><span class=\"lw-t lw-m lw-w\" style=\"--fs:10\">Share purchase</span><span class=\"lw-t\" style=\"--fs:8.5;color:rgba(255,255,255,.55)\">Whole company</span></div><div class=\"lw-col lw-grow lw-pad\" style=\"--p:9;--g:3;border-radius:calc(9*var(--u));background:rgba(255,255,255,.05);border:calc(.7*var(--u)) solid rgba(255,255,255,.1)\"><span class=\"lw-t lw-m lw-w8\" style=\"--fs:10\">Asset purchase</span><span class=\"lw-t\" style=\"--fs:8.5;color:rgba(255,255,255,.55)\">Selected assets</span></div></div><div class=\"lw-col lw-pad\" style=\"--pt:2;--pb:12;--pl:11;--pr:11;--g:6\"><div class=\"lw-row lw-between\"><span class=\"lw-t\" style=\"--fs:8.5;color:rgba(255,255,255,.55)\">Upfront</span><span class=\"lw-t\" style=\"--fs:8.5;color:rgba(255,255,255,.55)\">Deferred</span></div><div class=\"lw-bar lw-grad\" style=\"--h:6;--track:rgba(255,255,255,.12)\" data-fx=\"fill\"><i style=\"--v:45;--to:70\"></i></div></div></div></div></div>",
  "acq-timeline": "<div class=\"lw lw-acq-timeline\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:135.0;--y:40;--w:280;--r:13;--a:.1\"><div class=\"lw-row lw-between lw-pad\" style=\"--p:11;--g:6\"><span class=\"lw-row\" style=\"--g:6\"><svg class=\"lw-ico\" style=\"--s:12;color:rgba(255,255,255,.6)\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/></svg><span class=\"lw-t lw-m lw-w\" style=\"--fs:11;--lh:15\">Deal timeline</span></span><span class=\"lw-chip is-glass\" style=\"--fs:8.5;--px:6;--py:2;--r:99;--i:0\">Under 10 weeks</span></div><div class=\"lw-row lw-between lw-pad\" style=\"--pt:8;--pb:8;--pl:11;--pr:11;border-top:calc(.6*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-w\" style=\"--fs:10;--lh:13\">Introduction</span><span class=\"lw-t\" style=\"--fs:8.5;--lh:11;color:rgba(255,255,255,.55)\">First weeks</span></span><span style=\"color:rgba(255,255,255,.35);--i:1;border-radius:50%;display:inline-grid\" data-fx=\"ok\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"currentColor\"/><path d=\"m7 12.5 3.3 3.3L17 9\" fill=\"none\" stroke=\"#1b1d22\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span></div><div class=\"lw-row lw-between lw-pad\" style=\"--pt:8;--pb:8;--pl:11;--pr:11;border-top:calc(.6*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-w\" style=\"--fs:10;--lh:13\">Due diligence</span><span class=\"lw-t\" style=\"--fs:8.5;--lh:11;color:rgba(255,255,255,.55)\">Financials, clients, team</span></span><span style=\"color:rgba(255,255,255,.35);--i:2;border-radius:50%;display:inline-grid\" data-fx=\"ok\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"currentColor\"/><path d=\"m7 12.5 3.3 3.3L17 9\" fill=\"none\" stroke=\"#1b1d22\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span></div><div class=\"lw-row lw-between lw-pad\" style=\"--pt:8;--pb:8;--pl:11;--pr:11;border-top:calc(.6*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-w\" style=\"--fs:10;--lh:13\">Offer</span><span class=\"lw-t\" style=\"--fs:8.5;--lh:11;color:rgba(255,255,255,.55)\">Structure agreed</span></span><span style=\"color:rgba(255,255,255,.35);--i:3;border-radius:50%;display:inline-grid\" data-fx=\"ok\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"currentColor\"/><path d=\"m7 12.5 3.3 3.3L17 9\" fill=\"none\" stroke=\"#1b1d22\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span></div><div class=\"lw-row lw-between lw-pad\" style=\"--pt:8;--pb:8;--pl:11;--pr:11;border-top:calc(.6*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-w\" style=\"--fs:10;--lh:13\">Completion</span><span class=\"lw-t\" style=\"--fs:8.5;--lh:11;color:rgba(255,255,255,.55)\">Handover plan in place</span></span><span style=\"color:rgba(255,255,255,.35);--i:4;border-radius:50%;display:inline-grid\" data-fx=\"ok\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"currentColor\"/><path d=\"m7 12.5 3.3 3.3L17 9\" fill=\"none\" stroke=\"#1b1d22\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span></div><div class=\"lw-pad\" style=\"--p:11\"><div class=\"lw-bar lw-grad\" style=\"--h:4\" data-fx=\"fill\"><i style=\"--v:40;--to:100\"></i></div></div></div></div></div>",
  "acq-transition": "<div class=\"lw lw-acq-transition\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:135.0;--y:62;--w:280;--r:13;--a:.1\"><div class=\"lw-row lw-between lw-pad\" style=\"--p:11;--g:6\"><span class=\"lw-row\" style=\"--g:6\"><svg class=\"lw-ico\" style=\"--s:12;color:rgba(255,255,255,.6)\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/></svg><span class=\"lw-t lw-m lw-w\" style=\"--fs:11;--lh:15\">Handover plan</span></span><span class=\"lw-chip is-glass\" style=\"--fs:8.5;--px:6;--py:2;--r:99;--i:0\">After completion</span></div><div class=\"lw-row lw-between lw-pad\" style=\"--pt:8;--pb:8;--pl:11;--pr:11;border-top:calc(.6*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-w\" style=\"--fs:10;--lh:13\">Brand and name kept</span></span><span style=\"color:rgba(255,255,255,.35);--i:1;border-radius:50%;display:inline-grid\" data-fx=\"ok\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"currentColor\"/><path d=\"m7 12.5 3.3 3.3L17 9\" fill=\"none\" stroke=\"#1b1d22\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span></div><div class=\"lw-row lw-between lw-pad\" style=\"--pt:8;--pb:8;--pl:11;--pr:11;border-top:calc(.6*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-w\" style=\"--fs:10;--lh:13\">Clients introduced</span></span><span style=\"color:rgba(255,255,255,.35);--i:2;border-radius:50%;display:inline-grid\" data-fx=\"ok\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"currentColor\"/><path d=\"m7 12.5 3.3 3.3L17 9\" fill=\"none\" stroke=\"#1b1d22\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span></div><div class=\"lw-row lw-between lw-pad\" style=\"--pt:8;--pb:8;--pl:11;--pr:11;border-top:calc(.6*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-w\" style=\"--fs:10;--lh:13\">Team stays on</span></span><span style=\"color:rgba(255,255,255,.35);--i:3;border-radius:50%;display:inline-grid\" data-fx=\"ok\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"currentColor\"/><path d=\"m7 12.5 3.3 3.3L17 9\" fill=\"none\" stroke=\"#1b1d22\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span></div><div class=\"lw-row lw-between lw-pad\" style=\"--pt:8;--pb:8;--pl:11;--pr:11;border-top:calc(.6*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-w\" style=\"--fs:10;--lh:13\">Moved onto the Yotewo platform</span></span><span style=\"color:rgba(255,255,255,.35);--i:4;border-radius:50%;display:inline-grid\" data-fx=\"ok\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"currentColor\"/><path d=\"m7 12.5 3.3 3.3L17 9\" fill=\"none\" stroke=\"#1b1d22\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span></div></div></div></div>",
  "banner-talents-photo": "<div class=\"lw lw-banner-talents lw-keep\" style=\"--W:1440;--H:710\"><div class=\"lw-stage\"><div class=\"lw-abs gd\" style=\"--x:0;--y:0;width:100%;height:100%\"></div><div class=\"lw-abs sw\" style=\"--x:918;--y:221\"><div class=\"sc\"><div class=\"tabs\"><b>Frontend Engineers <em>12</em></b><span>UI Engineers 8</span><span>Software Architects 8</span></div><div class=\"rows\"><div class=\"rw\" style=\"--i:0\"><img class=\"av\" style=\"--s:16.7\" src=\"https://cdn.prod.website-files.com/6ac42caa6ba35878847056dc/6ad977f3dd9c966bca37a0ba_6ad9779e1c68a9589356511c_avatar-8.webp\" alt=\"\" loading=\"lazy\"><span class=\"n\">Sarah K.</span><span class=\"r\">Frontend Engineer</span><span class=\"p\">\u00a365/h</span></div><div class=\"rw\" style=\"--i:1\"><img class=\"av\" style=\"--s:16.7\" src=\"https://cdn.prod.website-files.com/6ac42caa6ba35878847056dc/6ad977f2dd9c966bca37a0b5_6ad9779ed1f67bc501505799_avatar-7.webp\" alt=\"\" loading=\"lazy\"><span class=\"n\">Jamal P.</span><span class=\"r\">Full-Stack Engineer</span><span class=\"p\">\u00a342/h</span></div><div class=\"rw\" style=\"--i:2\"><img class=\"av\" style=\"--s:16.7\" src=\"https://cdn.prod.website-files.com/6ac42caa6ba35878847056dc/6ad977f0dd9c966bca37a09c_6ad9779df88f487a4d56c130_avatar-2.webp\" alt=\"\" loading=\"lazy\"><span class=\"n\">Lucia C.</span><span class=\"r\">Solution Architect</span><span class=\"p\">\u00a338/h</span></div><div class=\"rw\" style=\"--i:3\"><span class=\"tm\" style=\"font-size:calc(6.5*var(--u));font-weight:600;line-height:1\">OK</span><span class=\"n\">Olivia K.</span><span class=\"r\">React Engineer</span><span class=\"p\">\u00a348/h</span></div><div class=\"rw\" style=\"--i:4\"><img class=\"av\" style=\"--s:16.7\" src=\"https://cdn.prod.website-files.com/6ac42caa6ba35878847056dc/6ad977f1dd9c966bca37a0a1_6ad9779d0209c220b80bedd9_avatar-3.webp\" alt=\"\" loading=\"lazy\"><span class=\"n\">Michael T.</span><span class=\"r\">UI Designer</span><span class=\"p\">\u00a375/h</span></div></div></div></div></div></div>",
  "bento-hiw-1": "<div class=\"lw lw-bento-hiw-1\" style=\"--W:700;--H:400\"><div class=\"lw-stage\"><svg width=\"0\" height=\"0\" style=\"position:absolute\"><symbol id=\"lw-h1-t\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"currentColor\"/><path d=\"M7.8 12.2l2.8 2.8 5.6-5.6\" fill=\"none\" stroke=\"#14151a\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></symbol></svg><div class=\"lw-abs lw-col\" style=\"--x:178;--y:92;--w:344;--g:8\"><div class=\"tc lw-row lw-pad\" style=\"--h:54;--g:8;--p:10;--pr:12\"><span class=\"ic\" style=\"--w:34;--h:34\"><svg class=\"lw-ico\" style=\"--s:19\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M8 2h8a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zm2 3v1.5h4V5zm2 4.5a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6zM8.3 18.5h7.4c0-2-1.7-3.3-3.7-3.3s-3.7 1.3-3.7 3.3z\"/></svg></span><div class=\"lw-col lw-grow\" style=\"--g:2\"><span class=\"lw-t lw-m\" style=\"--fs:12;--lh:16\">Identity check</span><span class=\"lw-t lw-w6\" style=\"--fs:12;--lh:16\">Identity and personal details verified</span></div><span class=\"st\" style=\"--w:24;--h:24\"><svg class=\"lw-ico\" style=\"--s:14.4\" data-fx=\"ok-text pop\"><use href=\"#lw-h1-t\"/></svg></span></div><div class=\"tc lw-row lw-pad\" style=\"--h:54;--g:8;--p:10;--pr:12\"><span class=\"ic\" style=\"--w:34;--h:34\"><svg class=\"lw-ico\" style=\"--s:19\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M9 3h6a2 2 0 0 1 2 2v1h2.5A2.5 2.5 0 0 1 22 8.5V12H2V8.5A2.5 2.5 0 0 1 4.5 6H7V5a2 2 0 0 1 2-2zm0 2v1h6V5zM2 13.5h8.5V15h3v-1.5H22v4A2.5 2.5 0 0 1 19.5 20h-15A2.5 2.5 0 0 1 2 17.5z\"/></svg></span><div class=\"lw-col lw-grow\" style=\"--g:2\"><span class=\"lw-t lw-m\" style=\"--fs:12;--lh:16\">Right to work</span><span class=\"lw-t lw-w6\" style=\"--fs:12;--lh:16\">UK work eligibility confirmed</span></div><span class=\"st\" style=\"--w:24;--h:24\"><svg class=\"lw-ico\" style=\"--s:14.4;--i:2\" data-fx=\"ok-text pop\"><use href=\"#lw-h1-t\"/></svg></span></div><div class=\"tc lw-row lw-pad\" style=\"--h:54;--g:8;--p:10;--pr:12\"><span class=\"ic\" style=\"--w:34;--h:34\"><svg class=\"lw-ico\" style=\"--s:19\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M6 2h7v5a2 2 0 0 0 2 2h5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm9 .5L19.5 7H15zM8 12v1.6h8V12zm0 4v1.6h5V16z\"/></svg></span><div class=\"lw-col lw-grow\" style=\"--g:2\"><span class=\"lw-t lw-m\" style=\"--fs:12;--lh:16\">IR35 assessment</span><span class=\"lw-t lw-w6\" style=\"--fs:12;--lh:16\">Assessed as Outside IR35</span></div><span class=\"st\" style=\"--w:24;--h:24\"><svg class=\"lw-ico\" style=\"--s:13.5;--i:4\" data-fx=\"swap-out\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><path d=\"M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8\"/></svg><svg class=\"lw-ico\" style=\"--s:14.4;--i:4\" data-fx=\"swap-in ok-text pop\"><use href=\"#lw-h1-t\"/></svg></span></div></div></div></div>",
  "bento-hiw-2": "<div class=\"lw lw-bento-hiw-2\" style=\"--W:478;--H:400\"><div class=\"lw-stage\"><svg width=\"0\" height=\"0\" style=\"position:absolute\"><symbol id=\"lw-h2-d\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" d=\"M6 2h7v5a2 2 0 0 0 2 2h5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm9 .5L19.5 7H15zM8 12v1.6h8V12zm0 4v1.6h5V16z\"/></symbol></svg><div class=\"lw-abs cd lw-pad\" style=\"--x:131.8;--y:206.7;--w:215.3;--h:34.9;--p:7.25;--d:16;--i:1;gap:calc(7.1*var(--u));border-radius:calc(8.7*var(--u));background:rgba(115,118,122,.9);opacity:.4\" data-fx=\"slide-y unblur\"><span class=\"ic\" style=\"--w:20.4;--h:20.4;border-radius:calc(5.4*var(--u))\"><svg class=\"lw-ico\" style=\"--s:8.6\"><use href=\"#lw-h2-d\"/></svg></span><span class=\"lw-col\" style=\"--g:2.1\"><span class=\"lw-t lw-m\" style=\"--fs:7.6;--lh:9\">IR35 assessment</span><span class=\"lw-row lw-t lw-w6\" style=\"--fs:6.85;--lh:7.75;--g:2.7\">Yotewo <span class=\"sl\">/</span> 5 years</span></span><span class=\"bd\" style=\"height:calc(11.2*var(--u));padding:0 calc(4.1*var(--u));border-radius:calc(4.1*var(--u));font-size:calc(6.15*var(--u))\">Outside IR35</span></div><div class=\"lw-abs cd lw-pad\" style=\"--x:98;--y:184.4;--w:278;--h:45;--p:9.36;--d:8;gap:calc(9.2*var(--u));border-radius:calc(11.2*var(--u));background:#999a9d\" data-fx=\"slide-y\"><span class=\"ic\" style=\"--w:26.3;--h:26.3;border-radius:calc(6.9*var(--u))\"><svg class=\"lw-ico\" style=\"--s:11.1\"><use href=\"#lw-h2-d\"/></svg></span><span class=\"lw-col\" style=\"--g:2.7\"><span class=\"lw-t lw-m\" style=\"--fs:9.85;--lh:12\">IR35 assessment</span><span class=\"lw-row lw-t lw-w6\" style=\"--fs:8.56;--lh:9.7;--g:3.3\">Yotewo <span class=\"sl\">/</span> 8 years</span></span><span class=\"bd\" style=\"height:calc(14.2*var(--u));padding:0 calc(5.3*var(--u));border-radius:calc(5.3*var(--u));font-size:calc(7.9*var(--u))\">Outside IR35</span></div><div class=\"lw-abs cd lw-pad\" style=\"--x:65;--y:158;--w:349;--h:56.5;--p:11.75;gap:calc(11.5*var(--u));border-radius:calc(14.1*var(--u));background:rgba(11,12,14,.9);-webkit-backdrop-filter:blur(calc(30*var(--u)));backdrop-filter:blur(calc(30*var(--u)))\"><span class=\"ic\" style=\"--w:33;--h:33;border-radius:calc(7.4*var(--u));background:rgba(255,255,255,.14);border:calc(.7*var(--u)) solid rgba(255,255,255,.08)\"><svg class=\"lw-ico\" style=\"fill:currentColor;stroke:none;--s:19;height:auto;aspect-ratio:22.56/20\" viewBox=\"5.848 8 20.304 18\" fill=\"currentColor\"><path d=\"M20.449 10.8259C21.9005 8.89182 24.8264 8.50604 26.1512 8.53482C25.4888 8.73628 23.9913 9.27172 22.9545 9.96245C21.6586 10.8259 21.2266 12.5527 19.1531 16.2654C17.0796 19.978 16.1292 19.3736 14.4014 19.3736C13.1572 19.2355 11.5503 17.9922 10.9455 16.3517C10.7767 15.3061 10.825 14.4426 10.8978 13.6971C10.5063 13.4545 10.0912 13.1884 9.64956 12.898C8.39161 12.071 8.20088 11.2864 8.12044 10.7354C7.47067 10.8558 6.71767 10.8354 5.84814 10.3078C8.11013 9.65476 8.00854 9.96893 8.12044 10.7354C9.27839 10.521 10.1085 9.85969 10.6863 10.8259C11.1843 11.6586 11.0112 12.5344 10.8978 13.6971C13.4161 15.2578 14.9562 15.8452 16.3021 15.661C17.9463 15.4359 18.6347 13.2434 20.449 10.8259Z\"/><path d=\"M16.2482 26.0001L26.1518 8.53375C25.4909 8.56235 24.3343 8.81459 23.1473 9.67854C22.5493 10.1684 21.9855 10.8636 21.3738 11.5207C20.7921 12.2714 20.2191 13.0949 19.7232 14.2405C19.1605 15.5408 18.6057 16.4918 18.0726 17.1804C16.422 19.1702 15.032 18.9962 14.1633 18.7368C14.2212 19.2401 14.3196 20.6967 14.9452 22.4952C15.5706 24.2937 16.0745 25.5811 16.2482 26.0001Z\"/><path d=\"M10.9182 16.4667L16.2844 26.0001C16.1113 25.5802 15.6093 24.2897 14.9862 22.487C14.363 20.6844 14.0918 19.2246 14.0341 18.7201C13.2574 18.501 11.647 17.7667 10.9182 16.4667Z\"/><path d=\"M15.1899 13.9289C16.8195 13.9289 18.1405 12.6017 18.1405 10.9644C18.1405 9.32722 16.8195 8 15.1899 8C13.5603 8 12.2392 9.32722 12.2392 10.9644C12.2392 12.6017 13.5603 13.9289 15.1899 13.9289Z\"/></svg></span><span class=\"lw-col\" style=\"--g:3.4\"><span class=\"lw-t lw-m\" style=\"--fs:12.36;--lh:15\">Senior Frontend Engineer</span><span class=\"lw-row lw-t lw-w6\" style=\"--fs:10.27;--lh:11.6;--g:4\">Yotewo <span class=\"sl\">/</span> 5 years</span></span><span class=\"bd lw-t\" style=\"--fs:10.85;--lh:17.7;padding:0 calc(8.7*var(--u)) 0 calc(6.5*var(--u));gap:calc(3.25*var(--u));border-radius:99px;background:rgba(255,255,255,.15);font-weight:400\"><svg class=\"lw-ico\" style=\"--s:10.9\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"currentColor\"/><path d=\"m7.8 12.2 2.8 2.8 5.6-5.6\" fill=\"none\" stroke=\"#14151a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>Verified</span></div></div></div>",
  "bento-hiw-3": "<div class=\"lw lw-bento-hiw-3\" style=\"--W:478;--H:400\"><div class=\"lw-stage\"><svg width=\"0\" height=\"0\" style=\"position:absolute\"><symbol id=\"lw-h3-r\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\"><ellipse cx=\"12\" cy=\"12\" rx=\"10\" ry=\"4\"/><ellipse cx=\"12\" cy=\"12\" rx=\"10\" ry=\"4\" transform=\"rotate(60 12 12)\"/><ellipse cx=\"12\" cy=\"12\" rx=\"10\" ry=\"4\" transform=\"rotate(120 12 12)\"/><circle cx=\"12\" cy=\"12\" r=\"1.8\" fill=\"currentColor\" stroke=\"none\"/></symbol><symbol id=\"lw-h3-h\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linejoin=\"round\"><path d=\"M7 3.5h10l5 8.5-5 8.5H7L2 12z\"/><path d=\"M8.5 9.5h4l-4 5h7\"/></symbol></svg><div class=\"lw-abs tb lw-pad\" style=\"--x:101.9;--y:158.6;--w:275.3;--h:61.6;--p:8.5;gap:calc(11.87*var(--u))\"><span class=\"hl\" style=\"--d:53.47\" data-fx=\"slide-x\"></span><span class=\"it\"><svg class=\"lw-ico dk\" style=\"--s:28\" data-fx=\"swap-out\"><use href=\"#lw-h3-r\"/></svg><svg class=\"lw-ico\" style=\"--s:24\" data-fx=\"swap-in\"><use href=\"#lw-h3-r\"/></svg></span><span class=\"it\"><svg class=\"lw-ico\" style=\"--s:24;--i:1\" data-fx=\"swap-out\"><use href=\"#lw-h3-h\"/></svg><svg class=\"lw-ico dk\" style=\"--s:24;--i:1\" data-fx=\"swap-in\"><use href=\"#lw-h3-h\"/></svg></span><span class=\"it\"><svg class=\"lw-ico\" style=\"--s:24\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12.5 2c.6 3.4-1.4 5-3 7-1.7 2-2.4 3.8-2.4 5.6A5 5 0 0 0 12 20c-1.5-1.3-1.7-3.3-.5-5 .4 1.3 1.3 2 2.3 2.3-.6-2.4.2-4.6 2.2-6.3.3 2.6 2.4 3.6 2.4 6.3A5.6 5.6 0 0 1 12.4 22 7.3 7.3 0 0 1 5 14.6C5 9 11.5 7.4 12.5 2z\"/></svg></span><span class=\"it\"><svg class=\"lw-ico\" style=\"--s:24\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M2 15.5 9.5 5h6.2L22 9.2 14.4 19H8.6zm7.4.3h4.2l4.7-6-2.9-2h-3.3z\"/></svg></span><span class=\"it\"><svg class=\"lw-ico\" style=\"--s:24\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M9.4 3h4.8A2.8 2.8 0 0 1 17 5.8V10H9.4a2.4 2.4 0 0 0-2.4 2.4V15H5.8A2.8 2.8 0 0 1 3 12.2V9.4A6.4 6.4 0 0 1 9.4 3zm1 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z\" opacity=\".6\"/><path d=\"M14.6 21H9.8A2.8 2.8 0 0 1 7 18.2V14h7.6a2.4 2.4 0 0 0 2.4-2.4V9h1.2A2.8 2.8 0 0 1 21 11.8v2.8a6.4 6.4 0 0 1-6.4 6.4zm-1-2a1 1 0 1 0 0-2 1 1 0 0 0 0 2z\"/></svg></span></div></div></div>",
  "bento-hiw-4": "<div class=\"lw lw-bento-hiw-4\" style=\"--W:700;--H:400\"><div class=\"lw-stage\"><svg width=\"0\" height=\"0\" style=\"position:absolute\"><symbol id=\"lw-h4-c\" viewBox=\"0 0 12 12\"><circle cx=\"6\" cy=\"6\" r=\"6\" fill=\"#4be15d\"/><path d=\"m3.3 6.2 1.8 1.7 3.6-3.6\" fill=\"none\" stroke=\"#0b0c0e\" stroke-width=\"1.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></symbol></svg><div class=\"lw-abs cd lw-col lw-pad\" style=\"--x:167;--y:89;--w:366;--h:199.3;--p:13.8;--g:7.9\"><div class=\"lw-row\" style=\"--g:7.9;--h:20\"><span class=\"ci\" style=\"--w:15.8;--h:15.8\"><svg class=\"lw-ico w8\" style=\"--s:11.8\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4.5 20c.8-3.6 3.8-6 7.5-6s6.7 2.4 7.5 6z\"/></svg></span><span class=\"lw-t lw-m\" style=\"--fs:13.8;--lh:19.7;--ls:-.1\">Human skills</span></div><div class=\"ls lw-col lw-pad\" style=\"--pt:7.9;--pb:7.9;--pl:15.8;--pr:15.8\"><div class=\"rw lw-row\" style=\"--g:9.85\"><svg class=\"lw-ico\" style=\"--s:11.8\" data-fx=\"pop\"><use href=\"#lw-h4-c\"/></svg><span class=\"lw-t w8\" style=\"--fs:11.8;--lh:15.8\">Values alignment reviewed</span></div><div class=\"rw lw-row\" style=\"--g:9.85\"><svg class=\"lw-ico\" style=\"--s:11.8;--i:1\" data-fx=\"pop\"><use href=\"#lw-h4-c\"/></svg><span class=\"lw-t w8\" style=\"--fs:11.8;--lh:15.8\">Motivations discussed</span></div><div class=\"rw lw-row\" style=\"--g:9.85\"><svg class=\"lw-ico\" style=\"--s:11.8;--i:2\" data-fx=\"pop\"><use href=\"#lw-h4-c\"/></svg><span class=\"lw-t w8\" style=\"--fs:11.8;--lh:15.8\">Communication assessed</span></div><div class=\"rw lw-row\" style=\"--g:9.85\"><svg class=\"lw-ico\" style=\"--s:11.8;--i:3\" data-fx=\"pop\"><use href=\"#lw-h4-c\"/></svg><span class=\"lw-t w8\" style=\"--fs:11.8;--lh:15.8\">Linguistic fluency confirmed</span></div><div class=\"rw lw-row\" style=\"--g:9.85\"><svg class=\"lw-ico\" style=\"--s:11.8;--i:4\" data-fx=\"pop\"><use href=\"#lw-h4-c\"/></svg><span class=\"lw-t w8\" style=\"--fs:11.8;--lh:15.8\">Interpersonal style reviewed</span></div></div></div></div></div>",
  "bento-interim-1": "<div class=\"lw lw-bento-interim-1\" style=\"--W:700;--H:400\"><div class=\"lw-stage\"><div class=\"lw-abs bk\" style=\"--x:619;--y:73;--w:6;--h:153;--d:9;--i:1;opacity:.7\" data-fx=\"slide-x\"></div><div class=\"lw-abs bk\" style=\"--x:613;--y:45;--w:6;--h:209;--d:5\" data-fx=\"slide-x\"></div><div class=\"lw-abs lw-glass lw-col lw-pad\" style=\"--x:388;--y:28;--w:225;--h:242.9;--r:10.2;--a:.2;--p:10.2;--g:10.2\"><div class=\"lw-row lw-between\"><span class=\"lw-row\" style=\"--g:5.1\"><svg class=\"lw-ico\" style=\"--s:15.3;opacity:.6\" viewBox=\"0 0 16 16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\"><circle cx=\"8\" cy=\"9\" r=\"5.2\"/><path d=\"M8 6.4V9M6 1.8h4\"/></svg><span class=\"lw-t lw-m lw-w\" style=\"--fs:10.2;--lh:15.3;--ls:-.11\">Workload</span></span><span class=\"lw-btn is-glass\" style=\"--h:20.7;--px:5.5;--r:5.1;--fs:8.9;gap:calc(2*var(--u))\"><svg class=\"lw-ico\" style=\"--s:10;opacity:.5\" viewBox=\"0 0 10 10\" fill=\"currentColor\"><rect x=\"1\" y=\"5\" width=\"2\" height=\"4\" rx=\".4\"/><rect x=\"4\" y=\"1\" width=\"2\" height=\"8\" rx=\".4\"/><rect x=\"7\" y=\"3.5\" width=\"2\" height=\"5.5\" rx=\".4\"/></svg>Ranges</span></div><div class=\"tm lw-col\"><div class=\"dd lw-row lw-pad\" style=\"--g:6;--pl:7.7;--pr:6.4\"><svg class=\"lw-ico\" style=\"--s:10\" viewBox=\"0 0 10 10\" fill=\"currentColor\"><path d=\"M3.5 2V1.4c0-.3.2-.5.5-.5h2c.3 0 .5.2.5.5V2h2.2c.4 0 .8.4.8.8v1.5H.5V2.8c0-.4.4-.8.8-.8zM.5 5h9v3.2c0 .5-.4.8-.8.8H1.3c-.4 0-.8-.3-.8-.8z\"/></svg><span class=\"lw-t lw-m lw-w lw-grow\" style=\"--fs:8.9;--lh:12.8\">Part-time workload</span><svg class=\"lw-ico\" style=\"--s:12.8;opacity:.5\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3.5 4.8 6 7.2l2.5-2.4\"/></svg></div><div class=\"ct lw-col lw-center\" style=\"--h:76.7;--g:3.8\"><span class=\"lw-t lw-m lw-w6 cap\" style=\"--fs:7;--lh:7.7;--ls:.14\">Selected workload</span><span class=\"lw-t lw-m lw-w\" style=\"--fs:25.6;--lh:30.7;--ls:-.26\"><span data-lw-count=\"80\" data-lw-from=\"40\">80</span>h<span style=\"opacity:.5\">/mo</span></span></div></div><span class=\"lw-t lw-m cap\" style=\"--fs:7;--lh:8;--ls:.14;opacity:.5\">Common options</span><div class=\"lw-row\" style=\"--g:6.4;align-items:flex-start\"><span class=\"ic\" style=\"--w:25.6;--h:25.6\"><svg class=\"lw-ico\" style=\"--s:12.8\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".9\" stroke-linecap=\"round\"><circle cx=\"6\" cy=\"4\" r=\"2.2\"/><path d=\"M2.2 10.4c.5-1.8 2-2.8 3.8-2.8s3.3 1 3.8 2.8\"/></svg></span><span class=\"lw-col lw-grow\" style=\"--g:2.6\"><span class=\"lw-t lw-m lw-w\" style=\"--fs:8.9;--lh:12.8\">Part-time workload</span><span class=\"lw-t lw-w6\" style=\"--fs:7.7;--lh:10.2;opacity:.85\">40\u2013120h per month</span></span><svg class=\"lw-ico\" style=\"--s:12.8;opacity:.5;margin:calc(3.8*var(--u))\" viewBox=\"0 0 12 12\" fill=\"currentColor\"><circle cx=\"6\" cy=\"2.6\" r=\".75\"/><circle cx=\"6\" cy=\"6\" r=\".75\"/><circle cx=\"6\" cy=\"9.4\" r=\".75\"/></svg></div><div class=\"lw-row\" style=\"--g:6.4;align-items:flex-start\"><span class=\"ic\" style=\"--w:25.6;--h:25.6\"><svg class=\"lw-ico\" style=\"--s:12.8\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".9\" stroke-linecap=\"round\"><circle cx=\"4.6\" cy=\"4\" r=\"2\"/><path d=\"M1.2 10.2c.4-1.6 1.8-2.6 3.4-2.6s3 1 3.4 2.6M8 2.1a2 2 0 0 1 0 3.8M9.4 7.8c.8.4 1.2 1.2 1.4 2.4\"/></svg></span><span class=\"lw-col lw-grow\" style=\"--g:2.6\"><span class=\"lw-t lw-m lw-w\" style=\"--fs:8.9;--lh:12.8\">Full-time workload</span><span class=\"lw-t lw-w6\" style=\"--fs:7.7;--lh:10.2;opacity:.85\">160\u2013184h per month</span></span><svg class=\"lw-ico\" style=\"--s:12.8;opacity:.5;margin:calc(3.8*var(--u))\" viewBox=\"0 0 12 12\" fill=\"currentColor\"><circle cx=\"6\" cy=\"2.6\" r=\".75\"/><circle cx=\"6\" cy=\"6\" r=\".75\"/><circle cx=\"6\" cy=\"9.4\" r=\".75\"/></svg></div></div></div></div>",
  "bento-interim-2": "<div class=\"lw lw-bento-interim-2\" style=\"--W:478;--H:400\"><div class=\"lw-stage\"><div class=\"lw-abs cd lw-col lw-pad\" style=\"--x:81;--y:125;--w:316;--h:118.6;--p:6;--g:3\"><div class=\"lw-row lw-pad rw on\" style=\"--g:7.6;--p:4.8;--pr:7.6\"><span class=\"lw-av\" style=\"--s:24;background:linear-gradient(150deg,#c9a28a,#6b4a3c)\">HK</span><span class=\"lw-col lw-grow\"><span class=\"lw-row\" style=\"--g:1.2\"><span class=\"lw-t lw-m lw-ink\" style=\"--fs:9.5;--lh:12;--ls:-.01\">Harriet K.</span><svg class=\"lw-ico vf\" style=\"--s:9.6\" viewBox=\"0 0 10 10\"><path d=\"M5 .6l1.2 1 1.6-.1.4 1.5 1.3.9-.6 1.5.6 1.5-1.3.9-.4 1.5-1.6-.1L5 9.4l-1.2-1-1.6.1-.4-1.5L.5 6.1l.6-1.5L.5 3.1l1.3-.9.4-1.5 1.6.1z\" fill=\"currentColor\"/><path d=\"m3.2 5 1.2 1.2 2.4-2.4\" fill=\"none\" stroke=\"#fff\" stroke-width=\".9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span><span class=\"lw-row\" style=\"--g:4.8\"><span class=\"lw-row\" style=\"--g:3.8\"><i class=\"fl gb\"></i><span class=\"lw-t s7\" style=\"--fs:8.4;--lh:12;--ls:-.01\">AI Engineer</span></span><i class=\"sp\"></i><span class=\"lw-t lw-m s7\" style=\"--fs:8.4;--lh:12\">\u00a365/h</span><i class=\"sp\"></i><span class=\"lw-t lw-m s7\" style=\"--fs:8.4;--lh:12\">120h cap</span></span></span><svg class=\"lw-ico\" style=\"--s:10.8;color:rgba(13,17,38,.4)\" viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4.2\" fill=\"currentColor\"/><path d=\"M3.4 5h3.2M5.4 3.8 6.6 5 5.4 6.2\" fill=\"none\" stroke=\"#fff\" stroke-width=\".8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></div><div class=\"lw-row lw-pad rw lw-dim\" style=\"--g:7.6;--p:4.8;--pr:7.6;--o:.6;--b:0;--i:1\" data-fx=\"unblur\"><span class=\"lw-av\" style=\"--s:24;background:linear-gradient(150deg,#b8bcc4,#5a5f6b)\">TW</span><span class=\"lw-col lw-grow\"><span class=\"lw-row\" style=\"--g:1.2\"><span class=\"lw-t lw-m lw-ink\" style=\"--fs:9.5;--lh:12;--ls:-.01\">Thomas W.</span><svg class=\"lw-ico vf\" style=\"--s:9.6\" viewBox=\"0 0 10 10\"><path d=\"M5 .6l1.2 1 1.6-.1.4 1.5 1.3.9-.6 1.5.6 1.5-1.3.9-.4 1.5-1.6-.1L5 9.4l-1.2-1-1.6.1-.4-1.5L.5 6.1l.6-1.5L.5 3.1l1.3-.9.4-1.5 1.6.1z\" fill=\"currentColor\"/><path d=\"m3.2 5 1.2 1.2 2.4-2.4\" fill=\"none\" stroke=\"#fff\" stroke-width=\".9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span><span class=\"lw-row\" style=\"--g:4.8\"><span class=\"lw-row\" style=\"--g:3.8\"><i class=\"fl gb\"></i><span class=\"lw-t s7\" style=\"--fs:8.4;--lh:12;--ls:-.01\">Data Engineer</span></span><i class=\"sp\"></i><span class=\"lw-t lw-m s7\" style=\"--fs:8.4;--lh:12\">\u00a360/h</span><i class=\"sp\"></i><span class=\"lw-t lw-m s7\" style=\"--fs:8.4;--lh:12\">100h cap</span></span></span></div><div class=\"lw-row lw-pad rw lw-dim\" style=\"--g:7.6;--p:4.8;--pr:7.6;--o:.3;--b:0;--i:2\" data-fx=\"unblur\"><span class=\"lw-av\" style=\"--s:24;background:linear-gradient(150deg,#d6d0c4,#7e7566)\">JD</span><span class=\"lw-col lw-grow\"><span class=\"lw-row\" style=\"--g:1.2\"><span class=\"lw-t lw-m lw-ink\" style=\"--fs:9.5;--lh:12;--ls:-.01\">James D.</span><svg class=\"lw-ico vf\" style=\"--s:9.6\" viewBox=\"0 0 10 10\"><path d=\"M5 .6l1.2 1 1.6-.1.4 1.5 1.3.9-.6 1.5.6 1.5-1.3.9-.4 1.5-1.6-.1L5 9.4l-1.2-1-1.6.1-.4-1.5L.5 6.1l.6-1.5L.5 3.1l1.3-.9.4-1.5 1.6.1z\" fill=\"currentColor\"/><path d=\"m3.2 5 1.2 1.2 2.4-2.4\" fill=\"none\" stroke=\"#fff\" stroke-width=\".9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span><span class=\"lw-row\" style=\"--g:4.8\"><span class=\"lw-row\" style=\"--g:3.8\"><i class=\"fl gb\"></i><span class=\"lw-t s7\" style=\"--fs:8.4;--lh:12;--ls:-.01\">Forward-Deployed Engineer</span></span><i class=\"sp\"></i><span class=\"lw-t lw-m s7\" style=\"--fs:8.4;--lh:12\">\u00a370/h</span><i class=\"sp\"></i><span class=\"lw-t lw-m s7\" style=\"--fs:8.4;--lh:12\">140h cap</span></span></span></div></div></div></div>",
  "bento-interim-3": "<div class=\"lw lw-bento-interim-3\" style=\"--W:478;--H:400\"><div class=\"lw-stage\"><div class=\"lw-abs cd lw-col lw-pad\" style=\"--x:90;--y:130.1;--w:298;--h:120.7;--p:10;--g:11.1\"><div class=\"lw-row lw-between\"><span class=\"lw-row\" style=\"--g:5.5\"><svg class=\"lw-ico\" style=\"--s:16;color:rgba(10,15,41,.3)\" viewBox=\"0 0 16 16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\"><circle cx=\"8\" cy=\"9\" r=\"5.2\"/><path d=\"M8 6.4V9M6 1.8h4\"/></svg><span class=\"lw-t lw-m\" style=\"--fs:12;--lh:16;--ls:-.13;color:#0b0c0e\">Hour Tracking</span></span><span class=\"db\">Details</span></div><div class=\"hr\"></div><span class=\"lw-t q\" style=\"--fs:12;--lh:16;--ls:-.13\"><b>12</b> hours <b><span data-lw-count=\"27\" data-lw-from=\"5\">27</span></b> minutes tracked today</span><div class=\"lw-bar\" style=\"--h:6.9\" data-fx=\"fill\"><i style=\"--v:95;--to:100\"><span class=\"sg\"><b style=\"width:calc(241.5*var(--u));background:#f6c1aa\"></b><b style=\"width:calc(33.2*var(--u));background:#8ec9e0\"></b></span></i></div><div class=\"lw-row\" style=\"--g:11.1\"><span class=\"lw-row\" style=\"--g:5.3\"><i class=\"lw-dot\" style=\"--s:6;--c:#f6c1aa\"></i><span class=\"lw-t lw-m lw-grey\" style=\"--fs:8.3;--lh:12\">Tracked</span></span><span class=\"lw-row\" style=\"--g:5.3\"><i class=\"lw-dot\" style=\"--s:6;--c:#8ec9e0\"></i><span class=\"lw-t lw-m lw-grey\" style=\"--fs:8.3;--lh:12\">Extra Time</span></span></div></div></div></div>",
  "bento-interim-4": "<div class=\"lw lw-bento-interim-4\" style=\"--W:700;--H:400\"><div class=\"lw-stage\"><div class=\"lw-abs cd lw-col\" style=\"--x:194;--y:107;--w:311;--h:136\"><div class=\"lw-row lw-between lw-pad hf\" style=\"--pt:16;--pr:12;--pb:8;--pl:12\"><span class=\"lw-col\" style=\"--g:4\"><span class=\"lw-t lw-m q\" style=\"--fs:7;--lh:9;--ls:-.04\">Current Cap</span><span class=\"lw-t lw-m\" style=\"--fs:24.5;--lh:30.6;--ls:-.12;color:#0b0c0e\">120h</span></span><span class=\"lw-col\" style=\"--g:4.6;align-items:flex-end\"><span class=\"lw-t lw-m q\" style=\"--fs:7.2;--lh:9.6\">Used: 120h / 120h</span><span style=\"display:inline-grid;justify-items:end\"><span class=\"bd rd\" style=\"grid-area:1/1;--i:3\" data-fx=\"swap-out\">Monthly cap reached</span><span class=\"bd gn\" style=\"grid-area:1/1;--i:3\" data-fx=\"swap-in\">20h requested</span></span></span></div><div class=\"lw-abs ln\" style=\"--x:81;--y:68;--w:149.3\"></div><span class=\"lw-abs pl\" style=\"--x:144.5;--y:49.3;--w:22.7;--h:22.7\"><svg class=\"lw-ico\" style=\"--s:9\" viewBox=\"0 0 10 10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\"><path d=\"M5 1.5v7M1.5 5h7\"/></svg></span><div class=\"lw-row lw-between lw-pad hf\" style=\"--pt:8;--pr:12;--pb:16;--pl:12\"><span class=\"lw-col\" style=\"--g:4\"><span class=\"lw-t lw-m q\" style=\"--fs:7;--lh:9;--ls:-.04\">Request extra</span><span class=\"lw-t lw-m\" style=\"--fs:24.5;--lh:30.6;--ls:-.12;color:#7898da\">+<span data-lw-count=\"20\" data-lw-from=\"0\">20</span>h</span></span><span class=\"lw-col\" style=\"--g:4.6;align-items:flex-end\"><span class=\"lw-t lw-m q\" style=\"--fs:7.2;--lh:9.6\">Available this month</span><span class=\"bd gy\">New total: <span data-lw-count=\"140\" data-lw-from=\"120\">140</span>h</span></span></div></div><div class=\"lw-abs rb lw-row lw-center\" style=\"--x:194;--y:251;--w:311\"><span class=\"lw-t lw-m\" style=\"--fs:11;--lh:16;--ls:-.01\">Request extra hours</span></div></div></div>",
  "compliance": "<div class=\"lw lw-compliance\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><svg width=\"0\" height=\"0\" style=\"position:absolute\"><symbol id=\"lw-cp-t\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"currentColor\"/><path d=\"M7.8 12.2l2.8 2.8 5.6-5.6\" fill=\"none\" stroke=\"#14151a\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></symbol></svg><div class=\"lw-abs lw-col\" style=\"--x:102.5;--y:81.2;--w:344;--g:8\"><div class=\"tc lw-row lw-pad\" style=\"--h:54;--g:8;--p:10;--pr:12\"><span class=\"ic\" style=\"--w:34;--h:34\"><svg class=\"lw-ico\" style=\"--s:19\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M8 2h8a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zm2 3v1.5h4V5zm2 4.5a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6zM8.3 18.5h7.4c0-2-1.7-3.3-3.7-3.3s-3.7 1.3-3.7 3.3z\"/></svg></span><div class=\"lw-col lw-grow\" style=\"--g:2\"><span class=\"lw-t lw-m\" style=\"--fs:12;--lh:16\">Identity check</span><span class=\"lw-t lw-w6\" style=\"--fs:12;--lh:16\">Identity and personal details verified</span></div><span class=\"st\" style=\"--w:24;--h:24\"><svg class=\"lw-ico\" style=\"--s:14.4\" data-fx=\"ok-text pop\"><use href=\"#lw-cp-t\"/></svg></span></div><div class=\"tc lw-row lw-pad\" style=\"--h:54;--g:8;--p:10;--pr:12\"><span class=\"ic\" style=\"--w:34;--h:34\"><svg class=\"lw-ico\" style=\"--s:19\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M9 3h6a2 2 0 0 1 2 2v1h2.5A2.5 2.5 0 0 1 22 8.5V12H2V8.5A2.5 2.5 0 0 1 4.5 6H7V5a2 2 0 0 1 2-2zm0 2v1h6V5zM2 13.5h8.5V15h3v-1.5H22v4A2.5 2.5 0 0 1 19.5 20h-15A2.5 2.5 0 0 1 2 17.5z\"/></svg></span><div class=\"lw-col lw-grow\" style=\"--g:2\"><span class=\"lw-t lw-m\" style=\"--fs:12;--lh:16\">Right to work</span><span class=\"lw-t lw-w6\" style=\"--fs:12;--lh:16\">UK work eligibility confirmed</span></div><span class=\"st\" style=\"--w:24;--h:24\"><svg class=\"lw-ico\" style=\"--s:14.4;--i:2\" data-fx=\"ok-text pop\"><use href=\"#lw-cp-t\"/></svg></span></div><div class=\"tc lw-row lw-pad\" style=\"--h:54;--g:8;--p:10;--pr:12\"><span class=\"ic\" style=\"--w:34;--h:34\"><svg class=\"lw-ico\" style=\"--s:19\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M6 2h7v5a2 2 0 0 0 2 2h5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm9 .5L19.5 7H15zM8 12v1.6h8V12zm0 4v1.6h5V16z\"/></svg></span><div class=\"lw-col lw-grow\" style=\"--g:2\"><span class=\"lw-t lw-m\" style=\"--fs:12;--lh:16\">IR35 assessment</span><span class=\"lw-t lw-w6\" style=\"--fs:12;--lh:16\">Assessed as Outside IR35</span></div><span class=\"st\" style=\"--w:24;--h:24\"><svg class=\"lw-ico\" style=\"--s:13.5;--i:4\" data-fx=\"swap-out\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><path d=\"M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8\"/></svg><svg class=\"lw-ico\" style=\"--s:14.4;--i:4\" data-fx=\"swap-in ok-text pop\"><use href=\"#lw-cp-t\"/></svg></span></div></div></div></div>",
  "create-profile": "<div class=\"lw lw-create-profile\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col lw-pad\" style=\"--x:141;--y:73;--w:268.4;--h:194.3;--p:16;--g:13.4\"><div class=\"lw-col\" style=\"--g:8;align-items:center;text-align:center\"><span class=\"ib\" style=\"--w:28;--h:28\" data-fx=\"pop\"><svg class=\"lw-ico\" style=\"--s:16.8\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"><circle cx=\"12\" cy=\"5\" r=\"2.4\"/><circle cx=\"5\" cy=\"17.5\" r=\"2.4\"/><circle cx=\"19\" cy=\"17.5\" r=\"2.4\"/><path d=\"M7.6 4.9a8.6 8.6 0 0 0-4.3 8.3M16.4 4.9a8.6 8.6 0 0 1 4.3 8.3M8 20.6a8.6 8.6 0 0 0 8 0\"/></svg></span><span class=\"lw-t lw-m\" style=\"--fs:13.4;--lh:17.9;--ls:-.2\">Referral Program Overview</span><span class=\"lw-t is-wrap lw-w8\" style=\"--fs:7.8;--lh:11.2;--ls:-.1;--w:218\">Invite clients through your unique referral link and earn commission on every successful deal.</span></div><div class=\"tr lw-row lw-center\" style=\"--h:32;--d:-6;--i:2\" data-fx=\"lift\"><span class=\"lw-t lw-m\" style=\"--fs:8.5;--lh:12;--ls:-.1\"><span data-lw-count=\"10\" data-lw-from=\"0\">10</span>% referral fee or 10% discount</span></div><span class=\"lw-btn\" style=\"--h:22\">Share your link</span></div><span class=\"lw-abs x\" style=\"--x:383.2;--y:83.7;--w:13.8;--h:13.8\"><svg class=\"lw-ico\" style=\"--s:8\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" opacity=\".8\"><path d=\"M6 6l12 12M18 6L6 18\"/></svg></span></div></div>",
  "earn-commission": "<div class=\"lw lw-earn-commission\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col lw-pad\" style=\"--x:150;--y:64.8;--w:251;--h:209.7;--a:.2;--r:9.5;--pt:9.5;--pb:9.5;--pl:12;--pr:12;--g:9.5\"><div class=\"lw-row lw-between\"><span class=\"lw-t lw-m\" style=\"--fs:10;--lh:12\">Referral List</span><span class=\"lw-btn is-glass sa\" style=\"--h:17.8;--px:7.4;--r:4.8;--fs:9\">See All</span></div><div class=\"lw-divider-w\"></div><div class=\"lw-row\" style=\"--g:7.9\"><span class=\"lw-av\" style=\"--s:23\">JA</span><div class=\"lw-col lw-grow\" style=\"--g:1.6\"><span class=\"lw-t lw-m\" style=\"--fs:7.9;--lh:10.3\">Jessica A.</span><span class=\"lw-t lw-w8\" style=\"--fs:7;--lh:8.7\">jessica.a@email.com</span></div><span class=\"lw-chip\" style=\"--bg:rgba(255,255,255,.08);--c:#fff;--fs:8;--px:6.3;--py:2.6;--r:80\" data-fx=\"ok\">+ \u00a328,75</span></div><div class=\"lw-row\" style=\"--g:7.9\"><span class=\"lw-av\" style=\"--s:23\">KO</span><div class=\"lw-col lw-grow\" style=\"--g:1.6\"><span class=\"lw-t lw-m\" style=\"--fs:7.9;--lh:10.3\">Kwame O.</span><span class=\"lw-t lw-w8\" style=\"--fs:7;--lh:8.7\">kwame.o@email.com</span></div><span class=\"lw-chip\" style=\"--bg:rgba(255,255,255,.08);--c:#fff;--fs:8;--px:6.3;--py:2.6;--r:80;--i:2\" data-fx=\"ok\">+ \u00a332,03</span></div><div class=\"lw-row\" style=\"--g:7.9\"><span class=\"lw-av\" style=\"--s:23\">SL</span><div class=\"lw-col lw-grow\" style=\"--g:1.6\"><span class=\"lw-t lw-m\" style=\"--fs:7.9;--lh:10.3\">Sana L.</span><span class=\"lw-t lw-w8\" style=\"--fs:7;--lh:8.7\">sana.l@email.com</span></div><span class=\"lw-chip\" style=\"--bg:rgba(255,255,255,.08);--c:#fff;--fs:8;--px:6.3;--py:2.6;--r:80;--i:4\" data-fx=\"ok\">+ \u00a345,67</span></div><div class=\"lw-row\" style=\"--g:7.9\"><span class=\"lw-av\" style=\"--s:23\">RJ</span><div class=\"lw-col lw-grow\" style=\"--g:1.6\"><span class=\"lw-t lw-m\" style=\"--fs:7.9;--lh:10.3\">Rory J.</span><span class=\"lw-t lw-w8\" style=\"--fs:7;--lh:8.7\">rory.j@email.com</span></div><span class=\"lw-chip\" style=\"--bg:rgba(255,255,255,.08);--c:#fff;--fs:8;--px:6.3;--py:2.6;--r:80;--i:6\" data-fx=\"ok\">+ \u00a326,99</span></div><span class=\"lw-btn\" style=\"--h:23;--r:6.4;--fs:9\">Share Unique URL</span></div></div></div>",
  "engagement": "<div class=\"lw lw-engagement\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:161.2;--y:59.6;--w:228;--h:220.1;--r:10;--a:.2\"><svg class=\"lw-ico lw-ex lw-eg\" style=\"--s:6.8\" viewBox=\"0 0 10 10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".8\" stroke-linecap=\"round\"><path d=\"m2.5 2.5 5 5m0-5-5 5\"/></svg><div class=\"lw-col lw-pad\" style=\"--p:7.7;--pb:5.8;--g:5.8\"><span class=\"lw-ei lw-tile\" style=\"--w:19.3;--h:19.3;--r:4.8\"><svg class=\"lw-ico\" style=\"--s:11.6\" viewBox=\"0 0 12 12\" fill=\"currentColor\"><circle cx=\"4.6\" cy=\"3.6\" r=\"2\"/><path d=\"M1 10c0-2 1.6-3.4 3.6-3.4S8.2 8 8.2 10Z\"/><path d=\"M8 1.8a1.8 1.8 0 0 1 0 3.6M9.2 6.8c1.2.4 1.8 1.6 1.8 3.2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".9\" stroke-linecap=\"round\"/></svg></span><div class=\"lw-col\" style=\"--g:1\"><span class=\"lw-t lw-m lw-w\" style=\"--fs:7.7;--lh:11.6;--ls:-.08\">Invite Team Members</span><span class=\"lw-t lw-eg\" style=\"--fs:6.8;--lh:9.7\">Add emails below, separated by commas, to send invites.</span></div></div><div class=\"lw-row lw-pad\" style=\"--p:7.7;--g:4.8\"><div class=\"lw-field lw-grow\" style=\"--h:19.7;--r:5.8;--fs:6.8;padding:0 calc(5.8*var(--u))\"><span class=\"lw-eg lw-grow\" style=\"padding-left:calc(1.9*var(--u))\">Emails, coma separated</span><span class=\"lw-m\">Guest</span><svg class=\"lw-ico\" style=\"--s:7.7\" viewBox=\"0 0 10 10\"><path d=\"M3 4h4L5 6.4Z\" fill=\"currentColor\" opacity=\".5\"/></svg></div><span class=\"lw-btn\" style=\"--h:18.7;--fs:7;--px:7.7;--r:5.8\">Invite</span></div><div class=\"lw-col\" style=\"--g:3.9\"><span class=\"lw-t lw-w6\" style=\"--fs:6.8;--lh:9.7;padding:calc(6.8*var(--u)) calc(7.7*var(--u)) 0\">Who can access</span><div class=\"lw-col\"><div class=\"lw-eu\"><span class=\"lw-ek lw-tile\" style=\"--w:11.6;--h:11.6;--r:3.9\"><svg class=\"lw-ico\" style=\"--s:7.7\" viewBox=\"0 0 10 10\" fill=\"none\" stroke=\"#fff\" stroke-width=\".7\"><circle cx=\"5\" cy=\"5\" r=\"3.8\"/><path d=\"M1.2 5h7.6M5 1.2c-1.4 1.6-1.4 6 0 7.6M5 1.2c1.4 1.6 1.4 6 0 7.6\"/></svg></span><span class=\"lw-t lw-w\" style=\"--fs:6.8;--lh:9.7\">Anyone with the link</span><span class=\"lw-chip lw-eb\">Guest</span><svg class=\"lw-ico lw-eg\" style=\"--s:7.7\" viewBox=\"0 0 10 10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"5\" cy=\"5\" r=\"3.8\"/><path d=\"M3.6 4.4 5 5.8l1.4-1.4\"/></svg></div><div class=\"lw-eu\"><span class=\"lw-av lw-ea lw-e1\">EH</span><span class=\"lw-t lw-w\" style=\"--fs:6.8;--lh:9.7\">Elizabeth H. <span class=\"lw-ey\">(you)</span></span><span class=\"lw-chip lw-eb lw-eo\">Owner</span></div><div class=\"lw-eu\"><span class=\"lw-av lw-ea lw-e2\">SA</span><span class=\"lw-t lw-w\" style=\"--fs:6.8;--lh:9.7\">Sophie A.</span><span class=\"lw-chip lw-eb\">Admin</span><svg class=\"lw-ico lw-eg\" style=\"--s:7.7\" viewBox=\"0 0 10 10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"5\" cy=\"5\" r=\"3.8\"/><path d=\"M3.6 4.4 5 5.8l1.4-1.4\"/></svg></div><div class=\"lw-eu\"><span class=\"lw-av lw-ea lw-ez\" data-fx=\"ok\">AS</span><span class=\"lw-t lw-w\" style=\"--fs:6.8;--lh:9.7\">Aisha S.</span><span style=\"display:inline-grid;justify-items:end\"><span class=\"lw-chip lw-eb\" style=\"grid-area:1/1;--i:3\" data-fx=\"swap-out\">Guest</span><span class=\"lw-status\" style=\"--fs:5.8;grid-area:1/1;--i:3\" data-fx=\"swap-in\"><i class=\"lw-dot\" style=\"--s:2.6\"></i>Joined</span></span><svg class=\"lw-ico lw-eg\" style=\"--s:7.7\" viewBox=\"0 0 10 10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"5\" cy=\"5\" r=\"3.8\"/><path d=\"M3.6 4.4 5 5.8l1.4-1.4\"/></svg></div></div></div><div class=\"lw-row lw-pad lw-t lw-m lw-w6\" style=\"--p:7.7;--g:1.9;--fs:6.8;--lh:9.7;margin-top:auto\"><span class=\"lw-grow\">Share via Link</span><svg class=\"lw-ico\" style=\"--s:7.7\" viewBox=\"0 0 10 10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".7\" stroke-linecap=\"round\"><path d=\"M4.2 3H3a2 2 0 0 0 0 4h1.2M5.8 3H7a2 2 0 0 1 0 4H5.8M3.4 5h3.2\"/></svg>Copy Link </div></div></div></div>",
  "feedback": "<div class=\"lw lw-feedback\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><svg width=\"0\" height=\"0\" style=\"position:absolute\"><symbol id=\"lw-fb-s\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" d=\"M12 2.2l3 6.2 6.8 1-4.9 4.8 1.2 6.8-6.1-3.2-6.1 3.2 1.2-6.8-4.9-4.8 6.8-1z\"/></symbol></svg><div class=\"lw-abs lw-glass lw-col lw-pad\" style=\"--x:139.5;--y:48.3;--w:271;--h:243;--pt:14;--pr:18;--pb:14;--pl:18;--g:13.4\"><div class=\"lw-row lw-pad bg\" style=\"--g:2.2;--p:2.2;--pr:3.4\"><span class=\"lw-t lw-m lw-grey\" style=\"--fs:8;--lh:12;--ls:-.1\">1 of 4</span><span class=\"lw-t lw-m\" style=\"--fs:8;--lh:10;--ls:-.1;padding:0 calc(2.2*var(--u))\">Weekly Check-in</span><svg class=\"lw-ico\" style=\"--s:8.9\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\".8\"><path d=\"M9 6l6 6-6 6\"/></svg></div><div class=\"lw-col\" style=\"--g:4.5;align-items:center;text-align:center\"><span class=\"lw-t lw-m\" style=\"--fs:12;--lh:17.9;--ls:-.2\">How is the engagement going this week?</span><span class=\"lw-t is-wrap lw-w6\" style=\"--fs:7.8;--lh:11.2;--ls:-.1;--w:188\">Share your feedback on progress, communication and collaboration.</span></div><div class=\"ra\" style=\"--h:90.8\"><div class=\"rb\"><b><svg class=\"lw-ico\" style=\"--s:12.9\"><use href=\"#lw-fb-s\"/></svg><svg class=\"lw-ico\" style=\"--s:12.9;--i:0\" data-fx=\"show pop\"><use href=\"#lw-fb-s\"/></svg></b><b><svg class=\"lw-ico\" style=\"--s:12.9\"><use href=\"#lw-fb-s\"/></svg><svg class=\"lw-ico\" style=\"--s:12.9;--i:1\" data-fx=\"show pop\"><use href=\"#lw-fb-s\"/></svg></b><b><svg class=\"lw-ico\" style=\"--s:12.9\"><use href=\"#lw-fb-s\"/></svg><svg class=\"lw-ico\" style=\"--s:12.9;--i:2\" data-fx=\"show pop\"><use href=\"#lw-fb-s\"/></svg></b><b><svg class=\"lw-ico\" style=\"--s:12.9\"><use href=\"#lw-fb-s\"/></svg><svg class=\"lw-ico\" style=\"--s:12.9;--i:3\" data-fx=\"show pop\"><use href=\"#lw-fb-s\"/></svg></b><b><svg class=\"lw-ico\" style=\"--s:12.9\"><use href=\"#lw-fb-s\"/></svg><svg class=\"lw-ico\" style=\"--s:12.9;--i:4\" data-fx=\"show pop\"><use href=\"#lw-fb-s\"/></svg></b></div><div class=\"lw-pad\" style=\"--p:7.8\"><span class=\"lw-t\" style=\"--fs:9.1;--lh:12.9;--ls:-.06;opacity:.7\">Tell us why!</span></div></div><span class=\"lw-btn\" style=\"--h:22\">Next Question</span></div></div></div>",
  "interview": "<div class=\"lw lw-interview\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:151;--y:71;--w:248;--r:12.3;--a:.1\"><div class=\"lw-row lw-pad\" style=\"--p:9.9;--pl:11.3;--g:5.7\"><svg class=\"lw-ico\" style=\"--s:11.3\" viewBox=\"0 0 12 12\" fill=\"currentColor\"><rect x=\"1\" y=\"3\" width=\"7.2\" height=\"6\" rx=\"1.4\"/><path d=\"m8.8 5.3 2.2-1.3v4l-2.2-1.3Z\"/></svg><span class=\"lw-t lw-m lw-w lw-grow\" style=\"--fs:9.9;--lh:14.2;--ls:-.1\">Interview: Stage 1/3</span><span class=\"lw-t lw-m lw-ic\" style=\"--fs:8.5;--lh:11.3\">Close</span></div><div class=\"lw-ir\"><svg class=\"lw-ico\" style=\"--s:11.3\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".9\" stroke-linecap=\"round\"><circle cx=\"6\" cy=\"6\" r=\"4.8\"/><circle cx=\"6\" cy=\"5\" r=\"1.6\"/><path d=\"M3.3 9.6c.6-1.1 1.6-1.6 2.7-1.6s2.1.5 2.7 1.6\"/></svg><div class=\"lw-col\" style=\"--g:2.8\"><span class=\"lw-t lw-w\" style=\"--fs:9.9;--lh:14.2;--ls:-.1\">Guests</span><span class=\"lw-row\" style=\"--g:5.7\"><span class=\"lw-row\"><span class=\"lw-av lw-ia\" style=\"--s:14.3\">EH<i class=\"lw-dot\" style=\"--s:4.2\"></i></span><span class=\"lw-av lw-ia\" style=\"--s:14.3\" data-fx=\"pop\">SA<i class=\"lw-dot lw-iw\" style=\"--s:4.2\" data-fx=\"ok\"></i></span></span><span style=\"display:inline-grid;justify-items:start\"><span class=\"lw-t lw-w\" style=\"--fs:9.9;--lh:14.2;--ls:-.1;grid-area:1/1;--i:3\" data-fx=\"swap-out\">1 going, 1 awaiting</span><span class=\"lw-t lw-w\" style=\"--fs:9.9;--lh:14.2;--ls:-.1;grid-area:1/1;--i:3\" data-fx=\"swap-in\">2 going</span></span></span></div></div><div class=\"lw-ir\" style=\"padding-block:calc(8.5*var(--u))\"><svg class=\"lw-ico\" style=\"--s:11.3\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".9\" stroke-linejoin=\"round\"><circle cx=\"6\" cy=\"6\" r=\"4.8\"/><path d=\"M3.7 4.8h2.8v2.4H3.7ZM6.5 5.6l1.6-.9v2.6l-1.6-.9\"/></svg><span class=\"lw-t lw-w\" style=\"--fs:9.9;--lh:14.2;--ls:-.1\">https://meet.google.com/piv-nxrh-pcx</span></div><div class=\"lw-ir\"><svg class=\"lw-ico\" style=\"--s:11.3\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".9\" stroke-linecap=\"round\"><circle cx=\"6\" cy=\"6\" r=\"4.8\"/><path d=\"M6 3.6V6l1.6 1.2\"/></svg><div class=\"lw-col lw-t\" style=\"--fs:9.9;--lh:14.2;--ls:-.1\"><span class=\"lw-row lw-w\" style=\"--g:4.3\">10:00<svg class=\"lw-ico\" style=\"--s:9.9\" viewBox=\"0 0 10 10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".9\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\".7\"><path d=\"M1.2 5h7.4M6 2.6 8.6 5 6 7.4\"/></svg>10:30</span><span class=\"lw-row lw-w8\" style=\"--g:4.3\">16 Jul 2025<svg class=\"lw-ico\" style=\"--s:9.9\" viewBox=\"0 0 10 10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M1.2 5h7.4M6 2.6 8.6 5 6 7.4\"/></svg>16 Jul 2025</span></div></div><div class=\"lw-row lw-between lw-ir\" style=\"--p:9.9;padding:calc(9.9*var(--u))\"><span class=\"lw-btn is-glass\">Cancel</span><span class=\"lw-row\" style=\"--g:5.7\"><span class=\"lw-btn is-glass\">Reschedule</span><span class=\"lw-btn lw-ij\">Join Meet</span></span></div></div></div></div>",
  "jobs-why-contract": "<div class=\"lw lw-jobs-why-contract\" style=\"--W:291;--H:280\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col lw-pad\" style=\"--x:49.4;--y:88.5;--w:190.3;--r:8.6;--a:.1;--pt:5.3;--pb:5.3;--pl:6.4;--pr:6.4;--g:3.1\"><div class=\"lw-row lw-pad\" style=\"--h:19;--pl:6.2;--g:6.9\"><svg class=\"lw-ico\" style=\"--s:10.5;color:rgba(255,255,255,.5)\" viewBox=\"0 0 12 12\"><path d=\"M3 1.2h4l2.4 2.4v7.2H3Z\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M4.6 6.4h3M4.6 8.2h3\" stroke=\"#0b0c0e\" stroke-width=\".7\" opacity=\".5\"/></svg><span class=\"lw-t\" style=\"--fs:8.6;--lh:10.3;color:rgba(255,255,255,.7)\">Engagement terms</span></div><div class=\"cc lw-col lw-pad\" style=\"--p:8.6;--g:6.9;--d:-4\" data-fx=\"lift\"><div class=\"lw-row lw-between\"><span class=\"lw-t lw-m\" style=\"--fs:10.8;--lh:13.5;--ls:-.2\">Frontend Engineer</span><svg class=\"lw-ico\" style=\"--s:8.7;color:rgba(255,255,255,.6)\" viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4.2\" fill=\"currentColor\" stroke=\"none\"/><path d=\"m3.6 3.6 2.8 2.8m0-2.8L3.6 6.4\" stroke=\"#2a2b30\" stroke-width=\"1\"/></svg></div><div class=\"lw-row\" style=\"--g:6.4\"><span class=\"lw-row\" style=\"--g:3.2\"><svg class=\"lw-ico mt\" style=\"--s:8.6\" viewBox=\"0 0 10 10\"><rect x=\"1\" y=\"2.8\" width=\"8\" height=\"5.6\" rx=\"1\"/><path d=\"M3.6 2.8V1.8h2.8v1M1 5.2h8\"/></svg><span class=\"lw-t mt\">Temporary</span></span><span class=\"lw-row\" style=\"--g:3.2\"><svg class=\"lw-ico mt\" style=\"--s:8.6\" viewBox=\"0 0 10 10\"><path d=\"M5 9S2.2 6.2 2.2 4.1a2.8 2.8 0 0 1 5.6 0C7.8 6.2 5 9 5 9Z\"/><circle cx=\"5\" cy=\"4.1\" r=\".9\"/></svg><span class=\"lw-t mt\">Hybrid</span></span></div><div class=\"lw-row lw-pad\" style=\"--pt:1.2;--g:4.3\"><span class=\"lw-chip bg\" style=\"--bg:rgba(202,223,242,.8);--c:#0059ed;--i:3\" data-fx=\"pop\">Inside IR35</span><span class=\"lw-chip bg\" style=\"--bg:rgba(255,255,255,.1);--c:rgba(255,255,255,.8)\">3 months</span></div></div></div></div></div>",
  "jobs-why-fast": "<div class=\"lw lw-jobs-why-fast\" style=\"--W:291;--H:280\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col lw-pad\" style=\"--x:50.3;--y:68.3;--w:189.5;--r:8.3;--a:.1;--p:9.1\"><div class=\"lw-row\" style=\"--g:5.4;--h:29.6;align-items:flex-start\"><span class=\"lw-row lw-center\" style=\"--w:20;--h:20.9;border-radius:calc(5.2*var(--u));background:rgba(255,255,255,.1)\"><svg class=\"lw-ico\" style=\"--s:9.1\" viewBox=\"0 0 10 10\" fill=\"none\" stroke=\"#fff\" stroke-width=\".9\" stroke-linejoin=\"round\"><rect x=\"1\" y=\"2.8\" width=\"8\" height=\"5.8\" rx=\"1\"/><path d=\"M3.6 2.8V1.6h2.8v1.2M1 5.4h8\"/></svg></span><div class=\"lw-col lw-pad\" style=\"--pt:.3;--g:2.2\"><span class=\"lw-t lw-m\" style=\"--fs:7.5;--lh:9.4;--ls:-.06;color:var(--cr)\">Senior Product Designer</span><span class=\"lw-t lw-w6\" style=\"--fs:5.6;--lh:7.5;--ls:-.03\">Temporary \u00b7 Hybrid \u00b7 \u00a3450\u2013\u00a3550/day</span></div></div><i style=\"height:calc(.25*var(--u));background:rgba(255,255,255,.1)\"></i><div class=\"lw-col lw-pad\" style=\"--pt:5;position:relative\"><i class=\"ln\" style=\"top:calc(6.7*var(--u));height:calc(64.3*var(--u))\"></i><div class=\"lw-row st\"><span class=\"ind\"><span class=\"ck lw-t lw-m\" style=\"--fs:4.8\">\u2713</span></span><div class=\"lw-col lw-grow\" style=\"--g:2.5;padding-top:calc(2.3*var(--u))\"><span class=\"lw-t lw-m ti\">Application reviewed</span><span class=\"lw-t me\">Oct 10, 10:24</span></div><span class=\"lw-row\" style=\"--g:0;margin-top:calc(2.3*var(--u))\"><span class=\"lw-av pt\" style=\"background:linear-gradient(135deg,#d9b9a0,#7a5a48)\">AL</span><span class=\"lw-av pt\" style=\"background:linear-gradient(135deg,#c8c2bc,#5f5a58);margin-left:calc(-2.5*var(--u))\">MR</span><span class=\"lw-av\" style=\"--s:15;background:#464a53;margin-left:calc(-2.5*var(--u));font-size:calc(6.2*var(--u))\">+1</span></span></div><div class=\"lw-row st\"><span class=\"ind\"><span class=\"ck lw-t lw-m\" style=\"--fs:4.8\">\u2713</span></span><div class=\"lw-col lw-grow\" style=\"--g:2.5;padding-top:calc(2.3*var(--u))\"><span class=\"lw-t lw-m ti\">Interview</span><span class=\"lw-t me\">Oct 11, 14:00 \u2013 14:45</span></div><span class=\"lw-chip bd\" style=\"margin-top:calc(2.3*var(--u))\">Completed</span></div><div class=\"lw-row st\"><span class=\"ind\" style=\"display:inline-grid\"><span style=\"grid-area:1/1;width:calc(8.4*var(--u));height:calc(8.4*var(--u));border-radius:50%;background:radial-gradient(circle,#ffa04f 0 41%,rgba(154,73,23,.2) 43%);border:calc(.3*var(--u)) solid rgba(212,128,53,.2);box-shadow:0 0 calc(3.4*var(--u)) rgba(247,126,68,.25);--i:1\" data-fx=\"swap-out\"></span><span class=\"ck lw-t lw-m\" style=\"grid-area:1/1;--fs:4.8;background:var(--lw-ok);color:#fff;--i:1\" data-fx=\"swap-in pop\">\u2713</span></span><div class=\"lw-col lw-grow\" style=\"--g:2.5;padding-top:calc(4*var(--u))\"><span class=\"lw-t lw-m ti\">Client decision</span><span class=\"lw-t me\">Within 48 hours</span></div><span style=\"display:inline-grid;justify-items:end;margin-top:calc(4*var(--u))\"><span class=\"lw-chip bd or\" style=\"grid-area:1/1;--i:3\" data-fx=\"swap-out\">Oct 13, 14:00</span><span class=\"lw-chip bd\" style=\"grid-area:1/1;--i:3\" data-fx=\"swap-in\">Approved</span></span></div></div></div></div></div>",
  "jobs-why-rates": "<div class=\"lw lw-jobs-why-rates\" style=\"--W:291;--H:280\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col lw-pad\" style=\"--x:51.2;--y:70.4;--w:187.7;--h:140;--r:8.9;--a:.1;--pt:8.5;--pr:9.8;--pb:11.1;--pl:9.8;--g:18.5\"><div class=\"lw-row lw-between\"><span class=\"lw-t lw-m\" style=\"--fs:9.4;--lh:11.6;--ls:-.07\">Open roles</span><span class=\"lw-row lw-w8\" style=\"--g:2\"><span class=\"lw-t lw-m\" style=\"--fs:5.8;--lh:7.6;--ls:-.03\">All roles</span><svg class=\"lw-ico\" style=\"--s:6.7\" viewBox=\"0 0 8 8\"><path d=\"M2.2 3.1 4 4.9l1.8-1.8\"/></svg></span></div><div class=\"lw-row\" style=\"--g:3.6;align-items:flex-start\"><div class=\"lw-col\" style=\"--w:38.7\"><div class=\"ba\"><i class=\"br\" style=\"--h:33.8\"></i></div><div class=\"lw-col lw-pad rd\"><svg class=\"lw-ico\" style=\"--s:8.5\" viewBox=\"0 0 9 9\"><path d=\"M3 2.6 1.2 4.5 3 6.4M6 2.6l1.8 1.9L6 6.4M5 2 4 7\"/></svg><span class=\"lw-t lw-m nm\">Frontend Engineer</span><span class=\"lw-t sl\">\u00a360\u2013\u00a375/hr</span></div></div><div class=\"lw-col\" style=\"--w:38.7\"><div class=\"ba\"><i class=\"br hi\" style=\"--h:58.3;--d:-5\" data-fx=\"lift\"></i></div><div class=\"lw-col lw-pad rd on\"><svg class=\"lw-ico\" style=\"--s:8.5\" viewBox=\"0 0 9 9\"><path d=\"M2 7.6V5M4.5 7.6V1.6M7 7.6V3.6\" stroke-width=\"1.3\"/></svg><span class=\"lw-t lw-m nm\">Product Designer</span><span class=\"lw-t sl\" style=\"display:inline-block;--i:2\" data-fx=\"pop\">\u00a350\u2013\u00a360/hr</span></div></div><div class=\"lw-col\" style=\"--w:38.7\"><div class=\"ba\"><i class=\"br\" style=\"--h:58.3\"></i></div><div class=\"lw-col lw-pad rd\"><svg class=\"lw-ico\" style=\"--s:8.5\" viewBox=\"0 0 9 9\"><circle cx=\"4.5\" cy=\"4.5\" r=\"3.4\"/><circle cx=\"4.5\" cy=\"4.5\" r=\"1.2\"/></svg><span class=\"lw-t lw-m nm\">Product Manager</span><span class=\"lw-t sl\">\u00a390k\u2013\u00a3120k</span></div></div><div class=\"lw-col\" style=\"--w:38.7\"><div class=\"ba\"><i class=\"br\" style=\"--h:38.3\"></i></div><div class=\"lw-col lw-pad rd\"><svg class=\"lw-ico\" style=\"--s:8.5\" viewBox=\"0 0 9 9\"><circle cx=\"4.5\" cy=\"2.8\" r=\"1.3\"/><circle cx=\"2\" cy=\"4.6\" r=\".9\"/><circle cx=\"7\" cy=\"4.6\" r=\".9\"/><path d=\"M2.6 7.6c.2-1.4 1-2.2 1.9-2.2s1.7.8 1.9 2.2M.8 7.4c.1-.8.6-1.2 1.2-1.2M8.2 7.4c-.1-.8-.6-1.2-1.2-1.2\"/></svg><span class=\"lw-t lw-m nm\">Engineering Lead</span><span class=\"lw-t sl\">\u00a3450\u2013\u00a3600/day</span></div></div></div></div></div></div>",
  "jobs-why-seniority": "<div class=\"lw lw-jobs-why-seniority\" style=\"--W:291;--H:280\"><div class=\"lw-stage\"><div class=\"lw-abs\" style=\"--x:47.3;--y:92.8;--w:134.9;--h:155\"><div class=\"lw-paper lw-col lw-pad jc bk lw-dim\" style=\"--a:.8;--p:9.1;--g:8.3;--w:134.9;--h:155;--o:.4;--b:.5;--d:-20\" data-fx=\"fan-l\"><div class=\"lw-row hd\"><span class=\"lw-av\">BW</span><div class=\"lw-col nmc\"><span class=\"lw-t lw-m nm\">Bethan W.</span><span class=\"lw-t lw-m lw-mut yr\">5+ years</span></div><span class=\"lw-chip mt\">96% match</span></div><i class=\"lw-divider\"></i><div class=\"lw-col bd\"><span class=\"lw-t lw-m ti\">Senior-Level Product Designer</span><span class=\"lw-row\" style=\"--g:1.8\"><span class=\"lw-chip tg\">UX Research</span><span class=\"lw-chip tg\">AWS</span><span class=\"lw-chip tg\">Kubernetes</span></span><i class=\"lw-divider\"></i><span class=\"lw-t is-wrap ds\">Product Designer focused on intuitive digital products and scalable design systems. Experienced across research, interaction design, prototyping, and product delivery.</span></div><i class=\"lw-divider\"></i><div class=\"lw-row lw-between\"><div class=\"lw-col prc\"><span class=\"lw-t lw-m pr\">\u00a3<b class=\"sb\">60/hr</b></span><span class=\"lw-t lc\">Full-Time / London</span></div><span class=\"lw-btn is-dark ap\">Hire now</span></div></div></div><div class=\"lw-abs\" style=\"--x:160;--y:92.8;--w:134.9;--h:155\"><div class=\"lw-paper lw-col lw-pad jc bk lw-dim\" style=\"--a:.8;--p:9.1;--g:8.3;--w:134.9;--h:155;--o:.4;--b:.5;--d:20;--i:1\" data-fx=\"fan-r\"><div class=\"lw-row hd\"><span class=\"lw-av\">ER</span><div class=\"lw-col nmc\"><span class=\"lw-t lw-m nm\">Ethan R.</span><span class=\"lw-t lw-m lw-mut yr\">7+ years</span></div><span class=\"lw-chip mt\">92% match</span></div><i class=\"lw-divider\"></i><div class=\"lw-col bd\"><span class=\"lw-t lw-m ti\">Senior Backend Engineer</span><span class=\"lw-row\" style=\"--g:1.8\"><span class=\"lw-chip tg\">React</span><span class=\"lw-chip tg\">Kubernetes</span><span class=\"lw-chip tg\">Python</span><span class=\"lw-chip tg\">+4</span></span><i class=\"lw-divider\"></i><span class=\"lw-t is-wrap ds\">Senior Backend Engineer building reliable, scalable platforms and APIs. Strong experience in system architecture, cloud infrastructure, performance, and complex integrations.</span></div><i class=\"lw-divider\"></i><div class=\"lw-row lw-between\"><div class=\"lw-col prc\"><span class=\"lw-t lw-m pr\">\u00a3<b class=\"sb\">75/hr</b></span><span class=\"lw-t lc\">Full-Time / London</span></div><span class=\"lw-btn is-dark ap\">Hire now</span></div></div></div><div class=\"lw-abs lw-paper lw-col lw-pad jc\" style=\"--x:77.5;--y:62.5;--w:134.9;--h:155;--a:.88;--p:9.1;--g:8.3\"><div class=\"lw-row hd\"><span class=\"lw-av\">LF</span><div class=\"lw-col nmc\"><span class=\"lw-t lw-m nm\">Leo F.</span><span class=\"lw-t lw-m lw-mut yr\">7+ years</span></div><span class=\"lw-chip mt\">96% match</span></div><i class=\"lw-divider\"></i><div class=\"lw-col bd\"><span class=\"lw-t lw-m ti\">Senior Frontend Engineer</span><span class=\"lw-row\" style=\"--g:1.8\"><span class=\"lw-chip tg\">React</span><span class=\"lw-chip tg\">AWS</span><span class=\"lw-chip tg\">Kubernetes</span><span class=\"lw-chip tg\">Docker</span><span class=\"lw-chip tg\">+3</span></span><i class=\"lw-divider\"></i><span class=\"lw-t is-wrap ds\">Senior Frontend Engineer specialising in scalable, high-performance web applications. Expert in frontend architecture, performance optimisation, and accessible user experiences.</span></div><i class=\"lw-divider\"></i><div class=\"lw-row lw-between\"><div class=\"lw-col prc\"><span class=\"lw-t lw-m pr\">\u00a3<b class=\"sb\">75/hr</b></span><span class=\"lw-t lc\">Full-Time / London</span></div><span class=\"lw-btn is-dark ap\">Hire now</span></div></div></div></div>",
  "matching-2": "<div class=\"lw lw-matching-2\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-paper lw-dim lw-col lw-between lw-pad\" style=\"--x:114;--y:100;--w:121;--h:139.1;--a:.7;--r:10.9;--p:9.7;--o:.5;--b:0;--d:-30\" data-fx=\"fan-l\"><div class=\"lw-row lw-between\"><span class=\"lw-av\" style=\"--s:16;background:#0b0c0e;color:#fff\"><svg class=\"lw-ico\" style=\"fill:currentColor;stroke:none;--s:9.4;height:auto;aspect-ratio:22.56/20\" viewBox=\"5.848 8 20.304 18\" fill=\"currentColor\"><path d=\"M20.449 10.8259C21.9005 8.89182 24.8264 8.50604 26.1512 8.53482C25.4888 8.73628 23.9913 9.27172 22.9545 9.96245C21.6586 10.8259 21.2266 12.5527 19.1531 16.2654C17.0796 19.978 16.1292 19.3736 14.4014 19.3736C13.1572 19.2355 11.5503 17.9922 10.9455 16.3517C10.7767 15.3061 10.825 14.4426 10.8978 13.6971C10.5063 13.4545 10.0912 13.1884 9.64956 12.898C8.39161 12.071 8.20088 11.2864 8.12044 10.7354C7.47067 10.8558 6.71767 10.8354 5.84814 10.3078C8.11013 9.65476 8.00854 9.96893 8.12044 10.7354C9.27839 10.521 10.1085 9.85969 10.6863 10.8259C11.1843 11.6586 11.0112 12.5344 10.8978 13.6971C13.4161 15.2578 14.9562 15.8452 16.3021 15.661C17.9463 15.4359 18.6347 13.2434 20.449 10.8259Z\"/><path d=\"M16.2482 26.0001L26.1518 8.53375C25.4909 8.56235 24.3343 8.81459 23.1473 9.67854C22.5493 10.1684 21.9855 10.8636 21.3738 11.5207C20.7921 12.2714 20.2191 13.0949 19.7232 14.2405C19.1605 15.5408 18.6057 16.4918 18.0726 17.1804C16.422 19.1702 15.032 18.9962 14.1633 18.7368C14.2212 19.2401 14.3196 20.6967 14.9452 22.4952C15.5706 24.2937 16.0745 25.5811 16.2482 26.0001Z\"/><path d=\"M10.9182 16.4667L16.2844 26.0001C16.1113 25.5802 15.6093 24.2897 14.9862 22.487C14.363 20.6844 14.0918 19.2246 14.0341 18.7201C13.2574 18.501 11.647 17.7667 10.9182 16.4667Z\"/><path d=\"M15.1899 13.9289C16.8195 13.9289 18.1405 12.6017 18.1405 10.9644C18.1405 9.32722 16.8195 8 15.1899 8C13.5603 8 12.2392 9.32722 12.2392 10.9644C12.2392 12.6017 13.5603 13.9289 15.1899 13.9289Z\"/></svg></span><span class=\"lw-btn\" style=\"--h:10.8;--px:3.8;--r:3.2;--fs:4.5;background:rgba(10,15,41,.2);color:#fff\">Apply now</span></div><div class=\"lw-col\" style=\"--g:4.8\"><div class=\"lw-row\" style=\"--g:2.4;align-items:baseline\"><span class=\"lw-t co\" style=\"--fs:5.4;--lh:7.9\">Yotewo</span><span class=\"lw-t g5\" style=\"--fs:4.2\">1 days ago</span></div><span class=\"lw-t lw-m lw-ink\" style=\"--fs:8.5;--lh:10.9;--ls:-.2\">Senior UI/UX Designer</span><div class=\"lw-row\" style=\"--g:2.4\"><span class=\"lw-chip c4\">Part-time</span><span class=\"lw-chip c4\">Flexible Schedule</span></div></div><div class=\"ln\"></div><div class=\"lw-row lw-between\"><div class=\"lw-col\" style=\"--g:1.2\"><span class=\"lw-t lw-ink\" style=\"--fs:7.3;--lh:9.7;--fw:600;--ls:-.1\">\u00a3150\u2013220k</span><span class=\"lw-t g5\" style=\"--fs:4.2\">Remote</span></div><span class=\"lw-btn is-dark\" style=\"--h:14.2;--px:6.2;--r:3.7;--fs:5\">Apply now</span></div></div><div class=\"lw-abs lw-paper lw-dim lw-col lw-between lw-pad\" style=\"--x:316;--y:100;--w:121;--h:139.1;--a:.7;--r:10.9;--p:9.7;--o:.5;--b:0;--d:30\" data-fx=\"fan-r\"><div class=\"lw-row lw-between\"><span class=\"lw-av\" style=\"--s:19.4;background:#0b0c0e;color:#fff\"><svg class=\"lw-ico\" style=\"fill:currentColor;stroke:none;--s:11.3;height:auto;aspect-ratio:22.56/20\" viewBox=\"5.848 8 20.304 18\" fill=\"currentColor\"><path d=\"M20.449 10.8259C21.9005 8.89182 24.8264 8.50604 26.1512 8.53482C25.4888 8.73628 23.9913 9.27172 22.9545 9.96245C21.6586 10.8259 21.2266 12.5527 19.1531 16.2654C17.0796 19.978 16.1292 19.3736 14.4014 19.3736C13.1572 19.2355 11.5503 17.9922 10.9455 16.3517C10.7767 15.3061 10.825 14.4426 10.8978 13.6971C10.5063 13.4545 10.0912 13.1884 9.64956 12.898C8.39161 12.071 8.20088 11.2864 8.12044 10.7354C7.47067 10.8558 6.71767 10.8354 5.84814 10.3078C8.11013 9.65476 8.00854 9.96893 8.12044 10.7354C9.27839 10.521 10.1085 9.85969 10.6863 10.8259C11.1843 11.6586 11.0112 12.5344 10.8978 13.6971C13.4161 15.2578 14.9562 15.8452 16.3021 15.661C17.9463 15.4359 18.6347 13.2434 20.449 10.8259Z\"/><path d=\"M16.2482 26.0001L26.1518 8.53375C25.4909 8.56235 24.3343 8.81459 23.1473 9.67854C22.5493 10.1684 21.9855 10.8636 21.3738 11.5207C20.7921 12.2714 20.2191 13.0949 19.7232 14.2405C19.1605 15.5408 18.6057 16.4918 18.0726 17.1804C16.422 19.1702 15.032 18.9962 14.1633 18.7368C14.2212 19.2401 14.3196 20.6967 14.9452 22.4952C15.5706 24.2937 16.0745 25.5811 16.2482 26.0001Z\"/><path d=\"M10.9182 16.4667L16.2844 26.0001C16.1113 25.5802 15.6093 24.2897 14.9862 22.487C14.363 20.6844 14.0918 19.2246 14.0341 18.7201C13.2574 18.501 11.647 17.7667 10.9182 16.4667Z\"/><path d=\"M15.1899 13.9289C16.8195 13.9289 18.1405 12.6017 18.1405 10.9644C18.1405 9.32722 16.8195 8 15.1899 8C13.5603 8 12.2392 9.32722 12.2392 10.9644C12.2392 12.6017 13.5603 13.9289 15.1899 13.9289Z\"/></svg></span><span class=\"lw-btn\" style=\"--h:10.6;--px:3.6;--r:3;--fs:4.2\">Saved</span></div><div class=\"lw-col\" style=\"--g:4.8\"><div class=\"lw-row\" style=\"--g:2.4;align-items:baseline\"><span class=\"lw-t co\" style=\"--fs:5.4;--lh:7.9\">Yotewo</span><span class=\"lw-t g5\" style=\"--fs:4.2\">5 days ago</span></div><span class=\"lw-t lw-m lw-ink\" style=\"--fs:8.5;--lh:10.9;--ls:-.2\">Backend Engineer</span><div class=\"lw-row\" style=\"--g:2.4\"><span class=\"lw-chip c4\">Part-time</span><span class=\"lw-chip c4\">Senior</span></div></div><div class=\"ln\"></div><div class=\"lw-row lw-between\"><div class=\"lw-col\" style=\"--g:1.2\"><span class=\"lw-t lw-ink\" style=\"--fs:7.3;--lh:9.7;--fw:600;--ls:-.1\">\u00a365/hr</span><span class=\"lw-t g5\" style=\"--fs:4.2\">London / Hybrid 3 days</span></div><span class=\"lw-btn is-dark\" style=\"--h:14;--px:6;--r:3.6;--fs:4.8\">Apply now</span></div></div><div class=\"lw-abs lw-paper lw-col lw-between lw-pad\" style=\"--x:181.4;--y:62;--w:187.8;--h:216;--a:.7;--r:16.9;--p:15;--d:-5\" data-fx=\"lift\"><div class=\"lw-row lw-between\"><span class=\"lw-av\" style=\"--s:30.1;background:#0b0c0e;color:#fff\"><svg class=\"lw-ico\" style=\"fill:currentColor;stroke:none;--s:17.5;height:auto;aspect-ratio:22.56/20\" viewBox=\"5.848 8 20.304 18\" fill=\"currentColor\"><path d=\"M20.449 10.8259C21.9005 8.89182 24.8264 8.50604 26.1512 8.53482C25.4888 8.73628 23.9913 9.27172 22.9545 9.96245C21.6586 10.8259 21.2266 12.5527 19.1531 16.2654C17.0796 19.978 16.1292 19.3736 14.4014 19.3736C13.1572 19.2355 11.5503 17.9922 10.9455 16.3517C10.7767 15.3061 10.825 14.4426 10.8978 13.6971C10.5063 13.4545 10.0912 13.1884 9.64956 12.898C8.39161 12.071 8.20088 11.2864 8.12044 10.7354C7.47067 10.8558 6.71767 10.8354 5.84814 10.3078C8.11013 9.65476 8.00854 9.96893 8.12044 10.7354C9.27839 10.521 10.1085 9.85969 10.6863 10.8259C11.1843 11.6586 11.0112 12.5344 10.8978 13.6971C13.4161 15.2578 14.9562 15.8452 16.3021 15.661C17.9463 15.4359 18.6347 13.2434 20.449 10.8259Z\"/><path d=\"M16.2482 26.0001L26.1518 8.53375C25.4909 8.56235 24.3343 8.81459 23.1473 9.67854C22.5493 10.1684 21.9855 10.8636 21.3738 11.5207C20.7921 12.2714 20.2191 13.0949 19.7232 14.2405C19.1605 15.5408 18.6057 16.4918 18.0726 17.1804C16.422 19.1702 15.032 18.9962 14.1633 18.7368C14.2212 19.2401 14.3196 20.6967 14.9452 22.4952C15.5706 24.2937 16.0745 25.5811 16.2482 26.0001Z\"/><path d=\"M10.9182 16.4667L16.2844 26.0001C16.1113 25.5802 15.6093 24.2897 14.9862 22.487C14.363 20.6844 14.0918 19.2246 14.0341 18.7201C13.2574 18.501 11.647 17.7667 10.9182 16.4667Z\"/><path d=\"M15.1899 13.9289C16.8195 13.9289 18.1405 12.6017 18.1405 10.9644C18.1405 9.32722 16.8195 8 15.1899 8C13.5603 8 12.2392 9.32722 12.2392 10.9644C12.2392 12.6017 13.5603 13.9289 15.1899 13.9289Z\"/></svg></span><span class=\"lw-btn\" style=\"--h:15.6;--px:5.6;--r:4.7;--fs:6.6\">Saved<svg class=\"lw-ico\" style=\"--s:6.6;fill:currentColor\" viewBox=\"0 0 24 24\"><path d=\"M5 2h14v20l-7-5-7 5z\"/></svg></span></div><div class=\"lw-col\" style=\"--g:7.5\"><div class=\"lw-row\" style=\"--g:3.8;align-items:baseline\"><span class=\"lw-t co\" style=\"--fs:8.5;--lh:12.2\">Yotewo</span><span class=\"lw-t g5\" style=\"--fs:6.6\">5 days ago</span></div><span class=\"lw-t lw-m lw-ink\" style=\"--fs:13.1;--lh:16.9;--ls:-.2\">Frontend Engineer I / II</span><div class=\"lw-row\" style=\"--g:3.8\"><span class=\"lw-chip c6\">Part-time</span><span class=\"lw-chip c6\">Senior</span></div></div><div class=\"ln\"></div><div class=\"lw-row lw-between\"><div class=\"lw-col\" style=\"--g:1.9\"><span class=\"lw-t lw-ink\" style=\"--fs:11.3;--lh:15;--fw:600;--ls:-.1\">\u00a370/hr</span><span class=\"lw-t g5\" style=\"--fs:6.6\">London / Hybrid 3 days</span></div><span class=\"lw-btn is-dark\" style=\"--h:16.4;--px:7.4;--r:4.4;--fs:5.9\">Apply now</span></div></div></div></div>",
  "matching": "<div class=\"lw lw-matching\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-paper lw-dim lw-col lw-pad\" data-fx=\"fan-l\" style=\"--x:136;--y:89;--w:138.6;--h:162.3;--r:8;--p:6;--g:4\"><span class=\"lw-av\" style=\"--s:23.8\">SR</span><span class=\"lw-t lw-m\" style=\"--fs:6.7\">Sofia R.</span><span class=\"lw-row\" style=\"--g:3\"><span class=\"lw-t\">Italy, UTC +1:00</span><span class=\"lw-status\" style=\"--fs:4.5\"><i class=\"lw-dot\"></i>Available</span></span><div class=\"lw-row\" style=\"--g:3\"><div class=\"lw-tile lw-grow lw-col lw-pad\"><span class=\"lw-t lw-mut lw-ms\">Industries:</span><span class=\"lw-t lw-m\">EdTech, Marketing</span></div><div class=\"lw-tile lw-grow lw-col lw-pad\"><span class=\"lw-t lw-mut lw-ms\">AI Quick Check:</span><span class=\"lw-t lw-m\">82% Match</span></div></div><span class=\"lw-row\" style=\"--g:2.1\"><span class=\"lw-chip\">Snowflake</span><span class=\"lw-chip\">Python</span><span class=\"lw-chip\">dbt</span><span class=\"lw-chip\">BigQuery</span></span><span class=\"lw-t\">English (B2), Spanish (Native)</span><span class=\"lw-row lw-between\"><span class=\"lw-t lw-m\" style=\"--fs:6\">\u00a350/h</span><span class=\"lw-btn is-line\" style=\"--h:15.5;--fs:5.2;--px:4.5;--r:4.5\">View Profile</span></span></div><div class=\"lw-abs lw-paper lw-dim lw-col lw-pad\" data-fx=\"fan-r\" style=\"--x:274.6;--y:89;--w:138.6;--h:162.3;--r:8;--p:6;--g:4\"><span class=\"lw-av\" style=\"--s:23.8\">MT</span><span class=\"lw-t lw-m\" style=\"--fs:6.7\">Marco T.</span><span class=\"lw-row\" style=\"--g:3\"><span class=\"lw-t\">United Kingdom, UTC +0:00</span><span class=\"lw-status\" style=\"--fs:4.5\"><i class=\"lw-dot\"></i>Available</span></span><div class=\"lw-row\" style=\"--g:3\"><div class=\"lw-tile lw-grow lw-col lw-pad\"><span class=\"lw-t lw-mut lw-ms\">Industries:</span><span class=\"lw-t lw-m\">Travel, Fintech</span></div><div class=\"lw-tile lw-grow lw-col lw-pad\"><span class=\"lw-t lw-mut lw-ms\">AI Quick Check:</span><span class=\"lw-t lw-m\">86% Match</span></div></div><span class=\"lw-row\" style=\"--g:2.1\"><span class=\"lw-chip\">Snowflake</span><span class=\"lw-chip\">Python</span><span class=\"lw-chip\">dbt</span><span class=\"lw-chip\">BigQuery</span></span><span class=\"lw-t\">English (C1), Spanish (B1)</span><span class=\"lw-row lw-between\"><span class=\"lw-t lw-m\" style=\"--fs:6\">\u00a345/h</span><span class=\"lw-btn is-line\" style=\"--h:15.5;--fs:5.2;--px:4.5;--r:4.5\">View Profile</span></span></div><div class=\"lw-abs lw-paper lw-mf lw-col\" data-fx=\"lift\" style=\"--x:189.3;--y:70;--w:170.8;--h:200;--r:10;--a:.6;--i:1\"><div class=\"lw-col lw-pad\" style=\"--p:7.3;--pb:0;--g:4.6\"><span class=\"lw-av\" style=\"--s:29.4\">D</span><svg class=\"lw-ico lw-mx\" style=\"--s:9.2\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".8\" stroke-linejoin=\"round\"><path d=\"M6 10.2S1.6 7.6 1.6 4.6A2.3 2.3 0 0 1 6 3.4a2.3 2.3 0 0 1 4.4 1.2C10.4 7.6 6 10.2 6 10.2Z\"/></svg><div class=\"lw-col\" style=\"--g:.9\"><span class=\"lw-row lw-t lw-m lw-ink\" style=\"--fs:8.3;--lh:11.9;--ls:-.08;--g:.9\">Arjun P.<svg class=\"lw-ico\" style=\"--s:8.3\" viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4.4\" fill=\"#0059ed\"/><path d=\"M3.2 5.1 4.5 6.3 6.9 3.8\" stroke=\"#fff\" stroke-width=\".9\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span><span class=\"lw-row\" style=\"--g:3.7\"><span class=\"lw-row lw-t lw-ink\" style=\"--fs:6.4;--lh:9.2;--g:1.8\"><svg class=\"lw-ico\" style=\"--s:5.5;border-radius:50%\" viewBox=\"0 0 10 10\"><path fill=\"#012169\" d=\"M0 0h10v10H0z\"/><path stroke=\"#fff\" stroke-width=\"2\" d=\"M0 0l10 10M10 0L0 10\"/><path stroke=\"#c8102e\" stroke-width=\".8\" d=\"M0 0l10 10M10 0L0 10\"/><path stroke=\"#fff\" stroke-width=\"3.2\" d=\"M5 0v10M0 5h10\"/><path stroke=\"#c8102e\" stroke-width=\"1.9\" d=\"M5 0v10M0 5h10\"/></svg>United Kingdom, UTC +0:00</span><span class=\"lw-status\"><i class=\"lw-dot\" style=\"--s:2.8\"></i>Available</span></span></div></div><div class=\"lw-row lw-pad\" style=\"--pt:8.3;--pb:8.3;--pl:7.3;--pr:7.3;--g:3.7\"><div class=\"lw-tile lw-grow lw-col lw-pad\"><span class=\"lw-t lw-m lw-mut\" style=\"--fs:5.5;--lh:7.3\">Industries:</span><span class=\"lw-t lw-m lw-ink lw-mv\" style=\"--fs:6.4;--lh:9.2\">FinTech, HealthTech, Logistics</span><span class=\"lw-t lw-m lw-blue\" style=\"--fs:5.5;--lh:7.3\">Since 2022</span></div><div class=\"lw-tile lw-grow lw-col lw-pad\"><span class=\"lw-t lw-m lw-mut\" style=\"--fs:5.5;--lh:7.3\">AI Quick Check:</span><span class=\"lw-row lw-t lw-m lw-ink\" style=\"--fs:6.4;--lh:9.2;--g:2.8\"><i class=\"lw-dot lw-md\" style=\"--s:3.2\"></i><span><span data-lw-count=\"94\" data-lw-from=\"82\">94</span>% Match</span></span><span class=\"lw-t lw-m lw-blue\" style=\"--fs:5.5;--lh:7.3\">Strong Compatibility</span></div></div><div class=\"lw-row lw-wrap lw-pad\" style=\"--pt:1.8;--pb:1.8;--pl:7.3;--pr:7.3;--g:2.8\"><span class=\"lw-chip\">Snowflake</span><span class=\"lw-chip\">Python</span><span class=\"lw-chip\">dbt</span><span class=\"lw-chip\">BigQuery</span><span class=\"lw-chip\">Airflow</span><span class=\"lw-chip\">Looker</span><span class=\"lw-chip\">Tableau</span><span class=\"lw-chip\">Fivetran</span></div><span class=\"lw-t lw-ink lw-pad\" style=\"--fs:6.4;--lh:9.2;--pt:8.3;--pb:8.3;--pl:7.3\">English (C1), German (B2)</span><div class=\"lw-row lw-between lw-mb lw-pad\" style=\"--pt:7.3;--pb:7.3\"><span class=\"lw-col\"><span class=\"lw-t lw-mut\" style=\"--fs:5.5;--lh:7.3\">Average Rate:</span><span class=\"lw-t lw-m lw-ink\" style=\"--fs:7.3;--lh:11;--ls:-.07\">\u00a355/h</span></span><span class=\"lw-btn is-line\" style=\"--h:16;--fs:6;--px:5.5;--r:5.5\">View Profile<svg class=\"lw-ico\" style=\"--s:7\" viewBox=\"0 0 10 10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"5\" cy=\"5\" r=\"4.2\"/><path d=\"M3.3 5h3.4M5.4 3.6 6.8 5 5.4 6.4\"/></svg></span></div></div></div></div>",
  "offer": "<div class=\"lw lw-offer\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:122;--y:80;--w:306.8;--h:180.1;--r:11.7;--d:-6\" data-fx=\"lift\"><div class=\"lw-col lw-pad\" style=\"--pt:12.5;--pr:12.5;--pl:12.5;--pb:9.3;--g:9.3\"><span class=\"tk\" style=\"--w:31.1;--h:31.1;--i:2\" data-fx=\"ok\"><svg class=\"lw-ico\" style=\"--s:18.7\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"9.5\"/><path d=\"m8 12 3 3 5-6\"/></svg></span><div class=\"lw-col\" style=\"--g:1.6\"><span class=\"lw-t lw-m\" style=\"--fs:12.5;--lh:18.7;--ls:-.2\">You\u2019re in! Welcome to Yotewo!</span><span class=\"lw-t is-wrap\" style=\"--fs:10.9;--lh:15.6;--ls:-.1;color:rgba(255,255,255,.7)\">Here, you can manage your profile, review offers from companies, and track your engagements and hours in one place.</span></div></div><div class=\"lw-pad\" style=\"--p:9.3\"><span class=\"lw-btn\" style=\"width:100%;--h:31.6;--r:9.3;--fs:10.9\">Get Started</span></div><span class=\"lw-abs lw-row lw-center\" style=\"--x:278.7;--y:9.3;--w:18.7;--h:18.7;border-radius:50%;background:rgba(255,255,255,.14);color:rgba(255,255,255,.6)\"><svg class=\"lw-ico\" style=\"--s:10.9\" viewBox=\"0 0 24 24\"><path d=\"M6 6l12 12M18 6 6 18\"/></svg></span></div></div></div>",
  "referral-hires": "<div class=\"lw lw-referral-hires\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-paper lw-dim lw-col lw-pad\" style=\"--x:185;--y:76;--w:179.8;--h:73.2;--a:.4;--r:8;--o:1;--b:4.2;--p:7.7;--g:7.7;--d:-15\" data-fx=\"slide-y unblur\"><span class=\"lw-t lw-m lw-ink\" style=\"--fs:7.7;--lh:11.5;--ls:-.1\">Registered Clients</span><span class=\"lw-t lw-m lw-ink\" style=\"--fs:17.3;--lh:21.1;--ls:-.3\">68</span><div class=\"lw-row\" style=\"--g:1.9\"><span class=\"lw-t up\" style=\"--fs:6.7;--lh:9.6;--fw:600\">+12%</span><span class=\"lw-t lw-mut\" style=\"--fs:6.7;--lh:9.6\">vs last month</span></div><div class=\"lw-abs ic\" style=\"--x:155;--y:7.7;--w:17.3;--h:17.3;background:#dff0ff;color:#0060f2\"><svg class=\"lw-ico\" style=\"--s:11.5\" viewBox=\"0 0 24 24\"><path d=\"M14 3h3a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h-3zM3 11h8.6l-2.8-2.8 1.4-1.4L15.4 12l-5.2 5.2-1.4-1.4 2.8-2.8H3z\"/></svg></div></div><div class=\"lw-abs lw-paper lw-dim lw-col lw-pad\" style=\"--x:185;--y:189.2;--w:179.8;--h:74.2;--a:.4;--r:8;--o:1;--b:4.2;--p:7.7;--g:7.7;--d:15\" data-fx=\"slide-y unblur\"><span class=\"lw-t lw-m lw-ink\" style=\"--fs:7.7;--lh:11.5;--ls:-.1\">Active Clients</span><span class=\"lw-t lw-m lw-ink\" style=\"--fs:17.3;--lh:21.1;--ls:-.3\">49</span><div class=\"lw-row\" style=\"--g:1.9\"><span class=\"lw-t\" style=\"--fs:6.7;--lh:9.6;--fw:600;color:#fc0036\">-4%</span><span class=\"lw-t lw-mut\" style=\"--fs:6.7;--lh:9.6\">vs last month</span></div><div class=\"lw-abs ic\" style=\"--x:155;--y:7.7;--w:17.3;--h:17.3;background:#d2fad2;color:#0f7e32\"><svg class=\"lw-ico\" style=\"--s:11.5\" viewBox=\"0 0 24 24\"><path d=\"M14 2 5 13.5h6L9.5 22 19 10h-6z\"/></svg></div></div><div class=\"lw-abs lw-paper lw-col lw-pad\" style=\"--x:147;--y:118;--w:255;--h:104.5;--a:.8;--r:12;--p:10.9;--g:10.9\"><span class=\"lw-t lw-m\" style=\"--fs:10.9;--lh:16.3;--ls:-.1;color:#464a53\">Earnings</span><span class=\"lw-t lw-m lw-ink\" style=\"--fs:24.5;--lh:29.9;--ls:-.5\">\u00a3<span data-lw-count=\"381\" data-lw-from=\"342\">381</span>,09</span><div class=\"lw-row\" style=\"--g:2.7\"><span class=\"lw-t up\" style=\"--fs:9.5;--lh:13.6;--fw:600;--ls:-.1\">+19%</span><span class=\"lw-t lw-mut\" style=\"--fs:9.5;--lh:13.6;--ls:-.1\">vs last month</span></div><div class=\"lw-abs ic\" style=\"--x:219.6;--y:10.9;--w:24.5;--h:24.5;border-radius:calc(7.5*var(--u));background:linear-gradient(180deg,#709fe1,rgba(112,159,225,.6));color:#fff\"><svg class=\"lw-ico\" style=\"--s:14\" viewBox=\"0 0 24 24\"><path d=\"M6.5 7.5 15 3l2 4.5zM2 10a2.5 2.5 0 0 1 2.5-2.5h15A2.5 2.5 0 0 1 22 10v8a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 18z\"/><circle cx=\"12\" cy=\"14\" r=\"2\" fill=\"#709fe1\"/></svg></div></div></div></div>",
  "register-profile": "<div class=\"lw lw-register-profile\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col lw-pad\" style=\"--x:161;--y:55;--w:228;--h:166.9;--r:12;--p:12;--g:10.1;align-items:center\"><span class=\"lw-chip\" style=\"--bg:rgba(255,255,255,.25);--c:#fff;--fs:6;--px:3.4;--py:.6;--r:99\">3 of 4</span><div class=\"lw-col\" style=\"--g:3.7;--w:155.3;text-align:center\"><span class=\"lw-t lw-m\" style=\"--fs:11;--lh:14.7;--ls:-.1\">Team Expertise &amp; Tech Stack</span><span class=\"lw-t lw-w6 is-wrap\" style=\"--fs:6.4;--lh:9.2\">Choose the key expertise and technologies your team specializes in.</span></div><div class=\"lw-col\" style=\"--g:5.7;--w:203.9\"><div class=\"lw-field\" style=\"--h:21;--r:5.8;--fs:5.6\"><svg class=\"lw-ico\" style=\"--s:9.7\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21a8 8 0 0 1 16 0\"/></svg><span class=\"lw-chip\" style=\"--bg:rgba(255,255,255,.8);--c:#0b0c0e;--fs:5.6;--px:3;--py:.6;--r:2.9\">Frontend Developer</span><span class=\"lw-chip\" style=\"--bg:rgba(255,255,255,.8);--c:#0b0c0e;--fs:5.6;--px:3;--py:.6;--r:2.9\">Full-Stack Engineer</span><span class=\"lw-grow\">+3 more</span><svg class=\"lw-ico\" style=\"--s:9.7\" viewBox=\"0 0 24 24\"><path d=\"m7 10 5 5 5-5z\" fill=\"currentColor\"/></svg></div><div class=\"lw-field\" style=\"--h:21.4;--r:6.2;--fs:6.6;border-color:rgba(255,255,255,.3)\"><svg class=\"lw-ico\" style=\"--s:10.4\" viewBox=\"0 0 24 24\"><path d=\"m12 3 9 5-9 5-9-5zM3 13l9 5 9-5\"/></svg><span class=\"lw-grow\" style=\"display:inline-grid;justify-items:start;align-items:center\"><span style=\"grid-area:1/1;--i:3\" data-fx=\"swap-out\">Select Tech Stack...</span><span class=\"lw-chip\" style=\"--bg:rgba(255,255,255,.8);--c:#0b0c0e;--fs:5.6;--px:3;--py:.6;--r:2.9;grid-area:1/1;--i:3\" data-fx=\"swap-in\">TypeScript</span></span><svg class=\"lw-ico\" style=\"--s:10.4\" viewBox=\"0 0 24 24\"><path d=\"m7 14 5-5 5 5z\" fill=\"currentColor\"/></svg></div></div><i style=\"width:100%;height:calc(16*var(--u));border-radius:calc(5*var(--u));background:rgba(255,255,255,.1)\"></i></div><div class=\"lw-abs lw-glass lw-col pn\" style=\"--x:171.4;--y:187.2;--w:206.2;--h:114.5;--a:.08;--r:5.7;padding:calc(1.9*var(--u)) 0\"><div class=\"lw-row lw-pad sr\" style=\"--h:20.5;--pl:4.6;--pr:4.6;--g:3.8\"><svg class=\"lw-ico\" style=\"--s:6.1\" viewBox=\"0 0 24 24\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-4-4\"/></svg><i style=\"width:calc(.6*var(--u));height:calc(6.9*var(--u));background:#94cdff\"></i><span class=\"lw-t\" style=\"--fs:6.6;--lh:10.4;color:rgba(255,255,255,.7)\">Search tech stack\u2026</span></div><div class=\"lw-col lw-pad\" style=\"--pl:5.7;--pr:5.7\"><div class=\"lw-row op\" style=\"--h:18;--g:3.8\"><i class=\"cb\"></i><span class=\"lw-t\" style=\"--fs:6.6;--lh:10.4\">React</span></div><div class=\"lw-row op\" style=\"--h:18;--g:3.8;background:rgba(255,255,255,.14)\"><i class=\"cb\" data-fx=\"ok\"><svg class=\"lw-ico\" style=\"--s:5\" viewBox=\"0 0 24 24\" data-fx=\"show\"><path d=\"m5 12 5 5 9-10\" stroke-width=\"3\"/></svg></i><span class=\"lw-t lw-m\" style=\"--fs:6.6;--lh:10.4\">TypeScript</span></div><div class=\"lw-row op\" style=\"--h:18;--g:3.8\"><i class=\"cb\"></i><span class=\"lw-t\" style=\"--fs:6.6;--lh:10.4\">Node.js</span></div><div class=\"lw-row op\" style=\"--h:18;--g:3.8;opacity:.7\"><i class=\"cb\"></i><span class=\"lw-t\" style=\"--fs:6.6;--lh:10.4\">Next.js</span></div><div class=\"lw-row op\" style=\"--h:18;--g:3.8;opacity:.4\"><i class=\"cb\"></i><span class=\"lw-t\" style=\"--fs:6.6;--lh:10.4\">Python</span></div></div><i class=\"lw-abs\" style=\"--x:202.9;--y:24.6;--w:.9;--h:55.8;border-radius:99px;background:rgba(255,255,255,.25)\"></i></div></div></div>",
  "request": "<div class=\"lw lw-request\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col lw-pad\" style=\"--x:139.5;--y:62;--w:271;--h:215.6;--r:16;--a:.1;--pt:14;--pb:14;--pl:18;--pr:18;--g:13.4\"><div class=\"lw-row lw-pad lw-rq-pill\" style=\"--g:2.2;--p:2.2;--pr:3.4\"><span class=\"lw-chip\" style=\"--bg:#fff;--c:#717684;--fs:8;--px:4.5;--py:.4;--r:99;--i:4;overflow:hidden\" data-fx=\"pop\"><span style=\"display:inline-grid;justify-items:start\"><span style=\"grid-area:1/1;--i:3\" data-fx=\"swap-out\">2 of 4</span><span style=\"grid-area:1/1;--i:3\" data-fx=\"swap-in\">3 of 4</span></span></span><span class=\"lw-t lw-m lw-w\" style=\"--fs:8;--lh:10;--ls:-.06;padding:0 calc(2.2*var(--u))\">Role Details</span><svg class=\"lw-ico\" style=\"--s:8.9\" viewBox=\"0 0 10 10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\".8\"><path d=\"M3.6 2.2 6.4 5 3.6 7.8\"/></svg></div><div class=\"lw-col lw-center\" style=\"--g:4.5\"><span class=\"lw-t lw-m lw-w\" style=\"--fs:13.4;--lh:17.9;--ls:-.17\">Who Do You Want to Hire?</span><span class=\"lw-t lw-w8\" style=\"--fs:7.8;--lh:11.2;--ls:-.06\">Select role and required technologies.</span></div><div class=\"lw-col\" style=\"--g:8.9\"><div class=\"lw-field\"><svg class=\"lw-ico\" style=\"--s:11.2\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".8\" stroke-linecap=\"round\"><circle cx=\"6\" cy=\"4\" r=\"2.2\"/><path d=\"M2.2 10.4c.5-1.8 2-2.8 3.8-2.8s3.3 1 3.8 2.8\"/></svg><span class=\"lw-t\" style=\"--fs:7.8;--lh:11.2;--ls:-.06\">Full-Stack Engineer</span><span class=\"lw-rq-chev\" style=\"display:inline-grid;justify-items:start\"><svg class=\"lw-ico\" style=\"--s:11.2;grid-area:1/1\" viewBox=\"0 0 12 12\" data-fx=\"swap-out\"><path d=\"M3.4 4.8h5.2L6 7.6Z\" fill=\"currentColor\"/></svg><svg class=\"lw-ico\" style=\"--s:11.2;grid-area:1/1;color:var(--lw-ok)\" viewBox=\"0 0 12 12\" data-fx=\"swap-in pop\"><circle cx=\"6\" cy=\"6\" r=\"5\" fill=\"currentColor\"/><path d=\"m3.8 6.1 1.5 1.5 2.9-3\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span></div><div class=\"lw-field\"><svg class=\"lw-ico\" style=\"--s:11.2\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".8\" stroke-linejoin=\"round\"><path d=\"M6 1.8 10.2 4 6 6.2 1.8 4Z\"/><path d=\"M1.8 6.2 6 8.4l4.2-2.2M1.8 8.2 6 10.4l4.2-2.2\"/></svg><span class=\"lw-row\" style=\"--g:2.2\"><span class=\"lw-chip is-glass\" style=\"--fs:6.5;--px:3.4;--py:1.1;--r:3.4\">Figma</span><span class=\"lw-chip is-glass\" style=\"--fs:6.5;--px:3.4;--py:1.1;--r:3.4\">Python</span><span class=\"lw-chip is-glass\" style=\"--fs:6.5;--px:3.4;--py:1.1;--r:3.4\">Principle</span><span class=\"lw-t\" style=\"--fs:6.5;--lh:8.7;color:rgba(255,255,255,.7)\">+7 more</span></span><svg class=\"lw-ico lw-rq-chev\" style=\"--s:11.2\" viewBox=\"0 0 12 12\"><path d=\"M3.4 4.8h5.2L6 7.6Z\" fill=\"currentColor\"/></svg></div></div><div class=\"lw-col lw-center\" style=\"--g:10\"><span class=\"lw-btn\" style=\"--h:22;--fs:8;width:100%\">Next Step</span><span class=\"lw-row lw-t lw-m lw-w\" style=\"--fs:8;--lh:10;--g:2.2;--ls:-.06\"><svg class=\"lw-ico\" style=\"--s:8.9\" viewBox=\"0 0 10 10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"5\" cy=\"5\" r=\"4\"/><path d=\"M5.8 3.4 4.2 5l1.6 1.6\"/></svg>Previous Step</span></div></div></div></div>",
  "security": "<div class=\"lw lw-security\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><span class=\"lw-abs lw-t hd\" style=\"--x:88;--y:69;--fs:12;--lh:16\">Security policy</span><div class=\"lw-abs r\" style=\"--x:88;--y:97.6;--w:374;--h:45.3\"><div class=\"lw-bar\"><i style=\"--v:100\"></i></div><span class=\"lw-t\" style=\"--fs:15.5;--lh:18.1\">Access management</span><span class=\"lw-t lw-w8\" style=\"--fs:14;--lh:18\">Enforced</span></div><div class=\"lw-abs r\" style=\"--x:88;--y:151.6;--w:374;--h:45.3\"><div class=\"lw-bar\" data-fx=\"fill\"><i style=\"--v:70;--to:100;--i:1\"></i></div><span class=\"lw-t\" style=\"--fs:15.5;--lh:18.1\">Data protection</span><span class=\"lw-t lw-w8\" style=\"--fs:14;--lh:18\">Encrypted</span></div><div class=\"lw-abs r\" style=\"--x:88;--y:205.5;--w:374;--h:45.3\"><div class=\"lw-bar\" data-fx=\"fill\"><i style=\"--v:60;--to:100;--i:3\"></i></div><span class=\"lw-t\" style=\"--fs:15.5;--lh:18.1\">Device security</span><span class=\"lw-t lw-w8\" style=\"--fs:14;--lh:18\">Managed</span></div></div></div>",
  "share-link": "<div class=\"lw lw-share-link\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lc lw-col lw-pad\" style=\"--x:115;--y:70;--w:321;--h:76;--p:12.5;--g:6\"><div class=\"lw-row\" style=\"--g:6.3\"><span class=\"lw-t lw-m\" style=\"--fs:10.5;--lh:14.9;--ls:-.07\">Personal referral link</span><span class=\"li\" style=\"--w:12.5;--h:12.5\"><svg class=\"lw-ico\" style=\"--s:9.9\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\"><path d=\"M10 14a4 4 0 0 0 5.7 0l3.6-3.6a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3.6 3.6a4 4 0 0 0 5.7 5.7l1-1\"/></svg></span></div><div class=\"in lw-row lw-pad\" style=\"--h:29.9;--g:6;--pl:9;--pr:9\"><svg class=\"lw-ico\" style=\"--s:11.9\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" opacity=\".6\"><path d=\"M10 14a4 4 0 0 0 5.7 0l3.6-3.6a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3.6 3.6a4 4 0 0 0 5.7 5.7l1-1\"/></svg><span class=\"lw-t\" style=\"--fs:10.5;--lh:14.9;--ls:-.07\">https://app.yotewo.com/ref/alex-123</span></div></div><div class=\"lw-abs sk\" style=\"--x:161.2;--y:275.2;--w:229.6;--h:6.3;--d:10;--i:2\" data-fx=\"slide-y\"></div><div class=\"lw-abs sk\" style=\"--x:151.8;--y:268.9;--w:248.4;--h:6.3;--d:5;--i:1\" data-fx=\"slide-y\"></div><div class=\"lw-abs lw-paper nt lw-col lw-pad\" style=\"--x:139;--y:166;--w:274;--h:102.9;--a:.8;--r:9.4;--pt:7.8;--pb:7.8;--pl:12;--pr:12;--g:6.3\"><div class=\"lw-row lw-between\" style=\"padding:calc(2*var(--u)) 0\"><div class=\"lw-row\" style=\"--g:6\"><span class=\"lg\" style=\"--w:16.4;--h:16.4\"><svg class=\"lw-ico\" style=\"fill:currentColor;stroke:none;--s:10;height:auto;aspect-ratio:22.56/20\" viewBox=\"5.848 8 20.304 18\" fill=\"currentColor\"><path d=\"M20.449 10.8259C21.9005 8.89182 24.8264 8.50604 26.1512 8.53482C25.4888 8.73628 23.9913 9.27172 22.9545 9.96245C21.6586 10.8259 21.2266 12.5527 19.1531 16.2654C17.0796 19.978 16.1292 19.3736 14.4014 19.3736C13.1572 19.2355 11.5503 17.9922 10.9455 16.3517C10.7767 15.3061 10.825 14.4426 10.8978 13.6971C10.5063 13.4545 10.0912 13.1884 9.64956 12.898C8.39161 12.071 8.20088 11.2864 8.12044 10.7354C7.47067 10.8558 6.71767 10.8354 5.84814 10.3078C8.11013 9.65476 8.00854 9.96893 8.12044 10.7354C9.27839 10.521 10.1085 9.85969 10.6863 10.8259C11.1843 11.6586 11.0112 12.5344 10.8978 13.6971C13.4161 15.2578 14.9562 15.8452 16.3021 15.661C17.9463 15.4359 18.6347 13.2434 20.449 10.8259Z\"/><path d=\"M16.2482 26.0001L26.1518 8.53375C25.4909 8.56235 24.3343 8.81459 23.1473 9.67854C22.5493 10.1684 21.9855 10.8636 21.3738 11.5207C20.7921 12.2714 20.2191 13.0949 19.7232 14.2405C19.1605 15.5408 18.6057 16.4918 18.0726 17.1804C16.422 19.1702 15.032 18.9962 14.1633 18.7368C14.2212 19.2401 14.3196 20.6967 14.9452 22.4952C15.5706 24.2937 16.0745 25.5811 16.2482 26.0001Z\"/><path d=\"M10.9182 16.4667L16.2844 26.0001C16.1113 25.5802 15.6093 24.2897 14.9862 22.487C14.363 20.6844 14.0918 19.2246 14.0341 18.7201C13.2574 18.501 11.647 17.7667 10.9182 16.4667Z\"/><path d=\"M15.1899 13.9289C16.8195 13.9289 18.1405 12.6017 18.1405 10.9644C18.1405 9.32722 16.8195 8 15.1899 8C13.5603 8 12.2392 9.32722 12.2392 10.9644C12.2392 12.6017 13.5603 13.9289 15.1899 13.9289Z\"/></svg></span><span class=\"lw-t lw-m an\" style=\"--fs:9.4;--lh:11.4;--ls:-.09\">Yotewo</span></div><span class=\"lw-t lw-m q\" style=\"--fs:9.4;--lh:11.4;--ls:-.09\">1h ago</span></div><div class=\"lw-col\" style=\"--g:4.3\"><span class=\"lw-t lw-m lw-ink\" style=\"--fs:11;--lh:13.3;--ls:-.11\">Referral reward earned</span><span class=\"lw-t is-wrap lw-grey\" style=\"--fs:11;--lh:13.3;--ls:-.11\"><b class=\"lw-m lw-ink\">James </b>closed a deal! You earned \u00a3184.13 from your referral.</span></div><span class=\"lw-t q\" style=\"--fs:9.4;--lh:11.4;--ls:-.09\">3 more notifications</span></div></div></div>",
  "skills-hero-chat": "<div class=\"lw lw-skills-hero-chat\" style=\"--W:402;--H:363\"><div class=\"lw-stage\"><svg width=\"0\" height=\"0\" style=\"position:absolute\"><symbol id=\"lw-sc-v\" viewBox=\"0 0 12 12\"><path fill=\"#006bff\" d=\"m6 .4 1.5 1.1 1.9-.1.6 1.8 1.5 1.1-.6 1.8.6 1.8-1.5 1.1-.6 1.8-1.9-.1L6 11.6l-1.5-1.1-1.9.1L2 8.8.5 7.7l.6-1.8L.5 4.2 2 3.1l.6-1.8 1.9.1z\"/><path d=\"m3.9 6 1.4 1.4 2.8-2.8\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></symbol><symbol id=\"lw-sc-a\" viewBox=\"0 0 12 12\"><circle cx=\"6\" cy=\"6\" r=\"6\" fill=\"currentColor\"/><path d=\"M3.4 6h5M6.4 4 8.4 6l-2 2\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></symbol><symbol id=\"lw-sc-t\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.1\" stroke-linejoin=\"round\"><path d=\"M3.4 5.2v6H1.2v-6zM3.4 5.2 5.6.8c.9 0 1.5.7 1.4 1.6l-.3 2.2h3.1c.8 0 1.4.7 1.2 1.5l-.9 3.8c-.2.8-.8 1.3-1.6 1.3H3.4\"/></symbol></svg><span class=\"lw-abs lw-av ai\" style=\"--x:.4;--y:3.5;--s:21.6;background:#fff;border-color:#e9eaec;color:#000\"><svg class=\"lw-ico\" style=\"fill:currentColor;stroke:none;--s:13.8;height:auto;aspect-ratio:22.56/20\" viewBox=\"5.848 8 20.304 18\" fill=\"currentColor\"><path d=\"M20.449 10.8259C21.9005 8.89182 24.8264 8.50604 26.1512 8.53482C25.4888 8.73628 23.9913 9.27172 22.9545 9.96245C21.6586 10.8259 21.2266 12.5527 19.1531 16.2654C17.0796 19.978 16.1292 19.3736 14.4014 19.3736C13.1572 19.2355 11.5503 17.9922 10.9455 16.3517C10.7767 15.3061 10.825 14.4426 10.8978 13.6971C10.5063 13.4545 10.0912 13.1884 9.64956 12.898C8.39161 12.071 8.20088 11.2864 8.12044 10.7354C7.47067 10.8558 6.71767 10.8354 5.84814 10.3078C8.11013 9.65476 8.00854 9.96893 8.12044 10.7354C9.27839 10.521 10.1085 9.85969 10.6863 10.8259C11.1843 11.6586 11.0112 12.5344 10.8978 13.6971C13.4161 15.2578 14.9562 15.8452 16.3021 15.661C17.9463 15.4359 18.6347 13.2434 20.449 10.8259Z\"/><path d=\"M16.2482 26.0001L26.1518 8.53375C25.4909 8.56235 24.3343 8.81459 23.1473 9.67854C22.5493 10.1684 21.9855 10.8636 21.3738 11.5207C20.7921 12.2714 20.2191 13.0949 19.7232 14.2405C19.1605 15.5408 18.6057 16.4918 18.0726 17.1804C16.422 19.1702 15.032 18.9962 14.1633 18.7368C14.2212 19.2401 14.3196 20.6967 14.9452 22.4952C15.5706 24.2937 16.0745 25.5811 16.2482 26.0001Z\"/><path d=\"M10.9182 16.4667L16.2844 26.0001C16.1113 25.5802 15.6093 24.2897 14.9862 22.487C14.363 20.6844 14.0918 19.2246 14.0341 18.7201C13.2574 18.501 11.647 17.7667 10.9182 16.4667Z\"/><path d=\"M15.1899 13.9289C16.8195 13.9289 18.1405 12.6017 18.1405 10.9644C18.1405 9.32722 16.8195 8 15.1899 8C13.5603 8 12.2392 9.32722 12.2392 10.9644C12.2392 12.6017 13.5603 13.9289 15.1899 13.9289Z\"/></svg></span><span class=\"lw-abs lw-t lw-m ai\" style=\"--x:33.1;--y:6;--fs:12;--lh:16\">Yotewo AI</span><span class=\"lw-abs lw-t ai\" style=\"--x:33.1;--y:28;--fs:12;--lh:17.3\">We've found candidates that match your request. Review them<br>now and move forward with confidence.</span><div class=\"lw-abs rw\" style=\"--x:28.1;--y:68.3;--w:373.5;--h:51;--d:-5;border-color:#dee0e3\" data-fx=\"lift\"><span class=\"lw-av\" style=\"--s:34.6\">FN</span><div class=\"lw-col\" style=\"--g:2\"><span class=\"lw-row lw-t lw-m nm\">Freya N.<svg class=\"lw-ico\" style=\"--s:11.5\" data-fx=\"pop\"><use href=\"#lw-sc-v\"/></svg></span><span class=\"lw-row lw-t rl\"><svg class=\"lw-ico\" style=\"--s:10.4\" viewBox=\"0 0 10 10\"><clipPath id=\"lw-sc-c\"><circle cx=\"5\" cy=\"5\" r=\"5\"/></clipPath><g clip-path=\"url(#lw-sc-c)\"><path fill=\"#012169\" d=\"M0 0h10v10H0z\"/><path stroke=\"#fff\" stroke-width=\"2\" d=\"M0 0l10 10M10 0L0 10\"/><path stroke=\"#c8102e\" stroke-width=\".8\" d=\"M0 0l10 10M10 0L0 10\"/><path stroke=\"#fff\" stroke-width=\"3.2\" d=\"M5 0v10M0 5h10\"/><path stroke=\"#c8102e\" stroke-width=\"1.9\" d=\"M5 0v10M0 5h10\"/></g></svg>Data Scientist<i class=\"dv\"></i><b class=\"lw-m\">\u00a352/h</b></span></div><svg class=\"lw-ico ar\" style=\"--s:13;left:calc(271.5*var(--u))\"><use href=\"#lw-sc-a\"/></svg></div><div class=\"lw-abs rw\" style=\"--x:28.1;--y:125.3;--w:373.5;--h:51;--d:-5;--i:2\" data-fx=\"lift\"><span class=\"lw-av\" style=\"--s:34.6;background:linear-gradient(150deg,#e2a07c,#9a4b3c)\">CR</span><div class=\"lw-col\" style=\"--g:2\"><span class=\"lw-row lw-t lw-m nm\">Callum R.<svg class=\"lw-ico\" style=\"--s:11.5;--i:2\" data-fx=\"pop\"><use href=\"#lw-sc-v\"/></svg></span><span class=\"lw-row lw-t rl\"><svg class=\"lw-ico\" style=\"--s:10.4\" viewBox=\"0 0 10 10\"><g clip-path=\"url(#lw-sc-c)\"><path fill=\"#012169\" d=\"M0 0h10v10H0z\"/><path stroke=\"#fff\" stroke-width=\"2\" d=\"M0 0l10 10M10 0L0 10\"/><path stroke=\"#c8102e\" stroke-width=\".8\" d=\"M0 0l10 10M10 0L0 10\"/><path stroke=\"#fff\" stroke-width=\"3.2\" d=\"M5 0v10M0 5h10\"/><path stroke=\"#c8102e\" stroke-width=\"1.9\" d=\"M5 0v10M0 5h10\"/></g></svg>Product Designer<i class=\"dv\"></i><b class=\"lw-m\">\u00a346/h</b></span></div><svg class=\"lw-ico ar\" style=\"--s:13;left:calc(351*var(--u))\"><use href=\"#lw-sc-a\"/></svg></div><div class=\"lw-abs rw\" style=\"--x:28.1;--y:182.4;--w:373.5;--h:51;--d:-5;--i:4\" data-fx=\"lift\"><span class=\"lw-av\" style=\"--s:34.6;background:linear-gradient(150deg,#c4cad3,#4a505c)\">EF</span><div class=\"lw-col\" style=\"--g:2\"><span class=\"lw-row lw-t lw-m nm\">Eleanor F.<svg class=\"lw-ico\" style=\"--s:11.5;--i:4\" data-fx=\"pop\"><use href=\"#lw-sc-v\"/></svg></span><span class=\"lw-row lw-t rl\"><svg class=\"lw-ico\" style=\"--s:10.4\" viewBox=\"0 0 10 10\"><g clip-path=\"url(#lw-sc-c)\"><path fill=\"#012169\" d=\"M0 0h10v10H0z\"/><path stroke=\"#fff\" stroke-width=\"2\" d=\"M0 0l10 10M10 0L0 10\"/><path stroke=\"#c8102e\" stroke-width=\".8\" d=\"M0 0l10 10M10 0L0 10\"/><path stroke=\"#fff\" stroke-width=\"3.2\" d=\"M5 0v10M0 5h10\"/><path stroke=\"#c8102e\" stroke-width=\"1.9\" d=\"M5 0v10M0 5h10\"/></g></svg>UI/UX Designer<i class=\"dv\"></i><b class=\"lw-m\">\u00a355/h</b></span></div><svg class=\"lw-ico ar\" style=\"--s:13;left:calc(271.5*var(--u))\"><use href=\"#lw-sc-a\"/></svg></div><div class=\"lw-abs lw-row q\" style=\"--x:34;--y:246.8;--g:14\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.1\" stroke-linejoin=\"round\"><rect x=\"3.8\" y=\"3.8\" width=\"7.4\" height=\"7.4\" rx=\"1.6\"/><path d=\"M8.2 3.8V2.4A1.6 1.6 0 0 0 6.6.8H2.4A1.6 1.6 0 0 0 .8 2.4v4.2a1.6 1.6 0 0 0 1.6 1.6h1.4\"/></svg><svg class=\"lw-ico\" style=\"--s:12\"><use href=\"#lw-sc-t\"/></svg><svg class=\"lw-ico\" style=\"--s:12;transform:rotate(180deg)\"><use href=\"#lw-sc-t\"/></svg></div><div class=\"lw-abs in\" style=\"--x:28.1;--y:276.6;--w:373.5;--h:86.4\"><span class=\"lw-abs tw lw-t\" style=\"--x:16;--y:14.2;--fs:12;--lh:15.6\"><span class=\"ty\">Senior React engineer, TypeScript, UK time</span><span class=\"cr\"></span></span><span class=\"lw-abs lw-t q\" style=\"--x:18.9;--y:14.2;--fs:12;--lh:15.6\">Type your answer here</span><span class=\"lw-abs lw-row q\" style=\"--x:18.9;--y:59.5;--g:14.4\"><svg class=\"lw-ico\" style=\"--s:11.5\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8\"/></svg><svg class=\"lw-ico\" style=\"--s:11.5\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"4\"/><circle cx=\"9\" cy=\"9\" r=\"2\"/><path d=\"m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21\"/></svg></span><svg class=\"lw-abs lw-ico sd\" style=\"--x:342.2;--y:55.1;--s:20.2\" viewBox=\"0 0 20 20\"><circle cx=\"10\" cy=\"10\" r=\"10\"/><path d=\"M10 14.5v-9M6.4 9 10 5.4 13.6 9\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></div></div></div>",
  "startups-foundations": "<div class=\"lw lw-startups-foundations\" style=\"--W:578;--H:370\"><div class=\"lw-stage\"><span class=\"lw-abs lw-av\" style=\"--x:161.4;--y:116.8;--s:47.9\">MR</span><span class=\"lw-abs lw-av b\" style=\"--x:158;--y:192.1;--s:47.9\">JT</span><span class=\"lw-abs lw-av c\" style=\"--x:202.5;--y:252.5;--s:47.9\">DK</span><span class=\"lw-abs lw-av\" style=\"--x:275.4;--y:268.4;--s:47.9\">EL</span><span class=\"lw-abs lw-av c\" style=\"--x:342.7;--y:235.4;--s:47.9\">SH</span><span class=\"lw-abs lw-av k\" style=\"--x:371.2;--y:165.8;--s:47.9\">AN</span><span class=\"lw-abs lw-av b\" style=\"--x:349.5;--y:94;--s:47.9;--d:8;--i:4\" data-fx=\"slide-y pop\">PV</span><span class=\"lw-abs lw-av\" style=\"--x:286.8;--y:53;--s:47.9\">TC</span><span class=\"lw-abs lw-av b\" style=\"--x:212.7;--y:62.1;--s:47.9\">RO</span><div class=\"lw-abs lw-paper bar lw-row lw-pad\" style=\"--x:132;--y:164;--w:315;--h:41.3;--r:12.2;--pl:13;--pr:11.5;--g:8.4\"><svg class=\"lw-ico q\" style=\"--s:13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-4-4\"/></svg><span class=\"lw-grow q\" style=\"display:inline-grid;justify-items:start\"><span class=\"lw-t\" style=\"--fs:13;--lh:16;grid-area:1/1\" data-fx=\"swap-out\">Find a talent</span><span class=\"lw-t lw-ink\" style=\"--fs:13;--lh:16;grid-area:1/1\" data-fx=\"swap-in\">Senior React engineer</span></span><span class=\"lw-chip\" style=\"--bg:#fff;--c:#77727d;--fs:9.94;--px:4;--py:3;--r:5\">\u2318 F</span></div></div></div>",
  "startups-hero-photo-clean": "<div class=\"lw lw-startups-hero-visual lw-keep\" style=\"--W:1280;--H:456\"><div class=\"lw-stage\"><div class=\"lw-abs gd\" style=\"--x:0;--y:0;--w:1280;--h:456\"></div><div class=\"lw-abs bb\" style=\"--x:311;--y:42;--w:149;--h:48;white-space:nowrap\">Hey Yotewo \ud83d\udc4b</div><div class=\"lw-abs bb\" style=\"--x:311;--y:102;--w:359;--h:72;align-items:flex-start\">We\u2019ve just raised our seed round and need a senior product engineer.</div><div class=\"lw-abs bb is-y\" style=\"--x:602;--y:246;--w:367;--h:120\"><span class=\"mk\"><svg class=\"lw-ico\" style=\"fill:currentColor;stroke:none;--s:14;height:auto;aspect-ratio:22.56/20\" viewBox=\"5.848 8 20.304 18\" fill=\"currentColor\"><path d=\"M20.449 10.8259C21.9005 8.89182 24.8264 8.50604 26.1512 8.53482C25.4888 8.73628 23.9913 9.27172 22.9545 9.96245C21.6586 10.8259 21.2266 12.5527 19.1531 16.2654C17.0796 19.978 16.1292 19.3736 14.4014 19.3736C13.1572 19.2355 11.5503 17.9922 10.9455 16.3517C10.7767 15.3061 10.825 14.4426 10.8978 13.6971C10.5063 13.4545 10.0912 13.1884 9.64956 12.898C8.39161 12.071 8.20088 11.2864 8.12044 10.7354C7.47067 10.8558 6.71767 10.8354 5.84814 10.3078C8.11013 9.65476 8.00854 9.96893 8.12044 10.7354C9.27839 10.521 10.1085 9.85969 10.6863 10.8259C11.1843 11.6586 11.0112 12.5344 10.8978 13.6971C13.4161 15.2578 14.9562 15.8452 16.3021 15.661C17.9463 15.4359 18.6347 13.2434 20.449 10.8259Z\"/><path d=\"M16.2482 26.0001L26.1518 8.53375C25.4909 8.56235 24.3343 8.81459 23.1473 9.67854C22.5493 10.1684 21.9855 10.8636 21.3738 11.5207C20.7921 12.2714 20.2191 13.0949 19.7232 14.2405C19.1605 15.5408 18.6057 16.4918 18.0726 17.1804C16.422 19.1702 15.032 18.9962 14.1633 18.7368C14.2212 19.2401 14.3196 20.6967 14.9452 22.4952C15.5706 24.2937 16.0745 25.5811 16.2482 26.0001Z\"/><path d=\"M10.9182 16.4667L16.2844 26.0001C16.1113 25.5802 15.6093 24.2897 14.9862 22.487C14.363 20.6844 14.0918 19.2246 14.0341 18.7201C13.2574 18.501 11.647 17.7667 10.9182 16.4667Z\"/><path d=\"M15.1899 13.9289C16.8195 13.9289 18.1405 12.6017 18.1405 10.9644C18.1405 9.32722 16.8195 8 15.1899 8C13.5603 8 12.2392 9.32722 12.2392 10.9644C12.2392 12.6017 13.5603 13.9289 15.1899 13.9289Z\"/></svg></span><span class=\"fd\">Congrats on the raise. We can help with a permanent hire, interim support, or a managed team depending on how quickly you need to scale.</span></div><div class=\"lw-abs st\" style=\"--x:602;--y:382;--w:297;--h:20\"><svg class=\"lw-ico\" style=\"fill:currentColor;stroke:none;--s:14;height:auto;aspect-ratio:22.56/20\" viewBox=\"5.848 8 20.304 18\" fill=\"#fff\"><path d=\"M20.449 10.8259C21.9005 8.89182 24.8264 8.50604 26.1512 8.53482C25.4888 8.73628 23.9913 9.27172 22.9545 9.96245C21.6586 10.8259 21.2266 12.5527 19.1531 16.2654C17.0796 19.978 16.1292 19.3736 14.4014 19.3736C13.1572 19.2355 11.5503 17.9922 10.9455 16.3517C10.7767 15.3061 10.825 14.4426 10.8978 13.6971C10.5063 13.4545 10.0912 13.1884 9.64956 12.898C8.39161 12.071 8.20088 11.2864 8.12044 10.7354C7.47067 10.8558 6.71767 10.8354 5.84814 10.3078C8.11013 9.65476 8.00854 9.96893 8.12044 10.7354C9.27839 10.521 10.1085 9.85969 10.6863 10.8259C11.1843 11.6586 11.0112 12.5344 10.8978 13.6971C13.4161 15.2578 14.9562 15.8452 16.3021 15.661C17.9463 15.4359 18.6347 13.2434 20.449 10.8259Z\"/><path d=\"M16.2482 26.0001L26.1518 8.53375C25.4909 8.56235 24.3343 8.81459 23.1473 9.67854C22.5493 10.1684 21.9855 10.8636 21.3738 11.5207C20.7921 12.2714 20.2191 13.0949 19.7232 14.2405C19.1605 15.5408 18.6057 16.4918 18.0726 17.1804C16.422 19.1702 15.032 18.9962 14.1633 18.7368C14.2212 19.2401 14.3196 20.6967 14.9452 22.4952C15.5706 24.2937 16.0745 25.5811 16.2482 26.0001Z\"/><path d=\"M10.9182 16.4667L16.2844 26.0001C16.1113 25.5802 15.6093 24.2897 14.9862 22.487C14.363 20.6844 14.0918 19.2246 14.0341 18.7201C13.2574 18.501 11.647 17.7667 10.9182 16.4667Z\"/><path d=\"M15.1899 13.9289C16.8195 13.9289 18.1405 12.6017 18.1405 10.9644C18.1405 9.32722 16.8195 8 15.1899 8C13.5603 8 12.2392 9.32722 12.2392 10.9644C12.2392 12.6017 13.5603 13.9289 15.1899 13.9289Z\"/></svg><span class=\"sh\">We\u2019re finding the right candidate for you...</span></div><div class=\"lw-abs mc lw-col\" style=\"--x:602;--y:418;--w:367;--h:144;--g:12\"><span class=\"lw-t\" style=\"--fs:10;--lh:12;color:rgba(255,255,255,.5)\">3 top matches found</span><div class=\"lw-col\" style=\"--g:8\"><div class=\"mt\"><span class=\"lw-av\" style=\"--s:24;background:linear-gradient(150deg,#d9c8b8,#7a6d66)\">JB</span><span class=\"lw-col\" style=\"--g:2.6;flex:1\"><span class=\"lw-t lw-m\" style=\"--fs:9;--lh:12.8\">James B.</span><span class=\"lw-t\" style=\"--fs:7.7;--lh:10.3;color:rgba(255,255,255,.7)\">Frontend Engineer</span></span><span class=\"bd\"><svg class=\"lw-ico\" style=\"--s:10.6\" viewBox=\"0 0 24 24\" fill=\"#3ee089\"><path d=\"m12 7 7 8H5l7-8Z\"/></svg>96% match</span></div><div class=\"mt\"><span class=\"lw-av\" style=\"--s:24;background:linear-gradient(150deg,#b7c3d9,#5f6b80)\">DK</span><span class=\"lw-col\" style=\"--g:2.6;flex:1\"><span class=\"lw-t lw-m\" style=\"--fs:9;--lh:12.8\">Darius K.</span><span class=\"lw-t\" style=\"--fs:7.7;--lh:10.3;color:rgba(255,255,255,.7)\">Full-Stack Engineer</span></span><span class=\"bd\"><svg class=\"lw-ico\" style=\"--s:10.6\" viewBox=\"0 0 24 24\" fill=\"#3ee089\"><path d=\"m12 7 7 8H5l7-8Z\"/></svg>90% match</span></div><div class=\"mt\"><span class=\"lw-av\" style=\"--s:24;background:linear-gradient(150deg,#e3c3c9,#8a6470)\">MC</span><span class=\"lw-col\" style=\"--g:2.6;flex:1\"><span class=\"lw-t lw-m\" style=\"--fs:9;--lh:12.8\">Maria C.</span><span class=\"lw-t\" style=\"--fs:7.7;--lh:10.3;color:rgba(255,255,255,.7)\">Frontend Engineer</span></span><span class=\"bd\"><svg class=\"lw-ico\" style=\"--s:10.6\" viewBox=\"0 0 24 24\" fill=\"#3ee089\"><path d=\"m12 7 7 8H5l7-8Z\"/></svg>96% match</span></div></div></div></div></div>",
  "startups-pmf": "<div class=\"lw lw-startups-pmf\" style=\"--W:578;--H:370\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col lw-pad\" style=\"--x:141;--y:79.5;--w:296;--h:211.7;--a:.1;--r:12.2;--pt:7.6;--pb:7.6;--pl:9.1;--pr:9.1;--g:4.4\"><div class=\"lw-row lw-pad\" style=\"--h:27.2;--pt:6.1;--pb:6.1;--pl:8.8;--pr:8.8;--g:9.9\"><svg class=\"lw-ico ar\" style=\"--s:14.9\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><circle cx=\"8.5\" cy=\"7.5\" r=\"3.5\"/><circle cx=\"16.5\" cy=\"7.5\" r=\"3.5\"/><path d=\"M2 19.5c0-3.4 2.9-5.5 6.5-5.5s6.5 2.1 6.5 5.5zM15.8 19.5c0-2-.6-3.6-1.7-4.9 4.3-.9 7.9 1 7.9 4.9z\"/></svg><span class=\"lw-t w7\" style=\"--fs:12.18;--lh:14.6\">Seed stage hiring</span></div><div class=\"in lw-col lw-pad\" style=\"--h:164.9;--pt:12;--pb:12;--pl:12.2;--pr:12.2;--g:10\"><div class=\"dv lw-col lw-pad\" style=\"--pb:10;--g:9.9\"><div class=\"lw-row lw-between tp\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-m\" style=\"--fs:15.4;--lh:19.2;--ls:-.3\">Permanent engineering</span><span class=\"lw-t w7\" style=\"--fs:12.18;--lh:14.6\">Build your core team</span></span><svg class=\"lw-ico ar\" style=\"--s:14\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1.3 5.3 4 4a1 1 0 0 1 0 1.4l-4 4-1.4-1.4 2.3-2.3H7v-2h7.2l-2.3-2.3z\"/></svg></div><div class=\"lw-row w7\" style=\"--g:9.1\"><span class=\"lw-row\" style=\"--g:4.6\" data-fx=\"ok-text pop\"><svg class=\"lw-ico\" style=\"--s:12.2\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M13.5 2 5 13.5h6L10 22l9-12h-6z\"/></svg><span class=\"lw-t\" style=\"--fs:10.46;--lh:13\">48 hours</span></span><span class=\"lw-row\" style=\"--g:4.6\"><svg class=\"lw-ico\" style=\"--s:12.2\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"m8.5 15.5 5-5\"/></svg><span class=\"lw-t\" style=\"--fs:10.46;--lh:13\">Long-term</span></span></div></div><div class=\"lw-col\" style=\"--g:9.9\"><div class=\"lw-row lw-between tp\"><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-m\" style=\"--fs:15.4;--lh:19.2;--ls:-.3\">Interim engineers</span><span class=\"lw-t w7\" style=\"--fs:12.18;--lh:14.6\">Scale support when needed</span></span><svg class=\"lw-ico ar\" style=\"--s:14\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1.3 5.3 4 4a1 1 0 0 1 0 1.4l-4 4-1.4-1.4 2.3-2.3H7v-2h7.2l-2.3-2.3z\"/></svg></div><div class=\"lw-row w7\" style=\"--g:9.1\"><span class=\"lw-row\" style=\"--g:4.6;--i:3\" data-fx=\"ok-text pop\"><svg class=\"lw-ico\" style=\"--s:12.2\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M13.5 2 5 13.5h6L10 22l9-12h-6z\"/></svg><span class=\"lw-t\" style=\"--fs:10.46;--lh:13\">48 hours</span></span><span class=\"lw-row\" style=\"--g:4.6\"><svg class=\"lw-ico\" style=\"--s:12.2\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><circle cx=\"12\" cy=\"12\" r=\"3.5\"/><path d=\"M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1\"/></svg><span class=\"lw-t\" style=\"--fs:10.46;--lh:13\">Flexible</span></span></div></div></div></div></div></div>",
  "startups-scale": "<div class=\"lw lw-startups-scale\" style=\"--W:578;--H:370\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col lw-pad\" style=\"--x:133;--y:86;--w:312.2;--h:197.5;--a:.1;--r:16.7;--pt:12.2;--pb:14.2;--pl:10.2;--pr:10.2;--g:11.2\"><div class=\"lw-col lw-pad\" style=\"--pl:6.7;--pr:6.7;--g:4.5\"><span class=\"lw-t lw-m\" style=\"--fs:14.24;--lh:17\">Scaling capacity</span><span class=\"lw-t w4\" style=\"--fs:12.2;--lh:15\">Series A+</span></div><div class=\"lw-col\" style=\"--g:6.7\"><div class=\"rw lw-row lw-between lw-pad\" style=\"--h:36.6;--pl:10.2;--pr:10.2\"><span class=\"lw-bar\" style=\"--h:36.6\"><i style=\"--v:100\"></i></span><span class=\"lw-t\" style=\"--fs:13.2;--lh:16\">/hiring demand</span><span class=\"nm lw-t lw-m\" style=\"--fs:13.2;--lh:16\"><span class=\"n\">48</span><span class=\"p\">100%</span></span></div><div class=\"rw lw-row lw-between lw-pad\" style=\"--h:36.6;--pl:10.2;--pr:10.2\"><span class=\"lw-bar\" style=\"--h:36.6;--i:1\" data-fx=\"fill\"><i style=\"--v:58;--to:71\"></i></span><span class=\"lw-t\" style=\"--fs:13.2;--lh:16\">/covered by Yotewo</span><span class=\"nm lw-t lw-m\" style=\"--fs:13.2;--lh:16\"><span class=\"n\" data-lw-count=\"34\" data-lw-from=\"28\">34</span><span class=\"p\"><span data-lw-count=\"70\" data-lw-from=\"58\">70</span>%</span></span></div><div class=\"rw lw-row lw-between lw-pad\" style=\"--h:36.6;--pl:10.2;--pr:10.2\"><span class=\"lw-bar\" style=\"--h:36.6;--i:2\" data-fx=\"fill\"><i style=\"--v:45;--to:50\"></i></span><span class=\"lw-t\" style=\"--fs:13.2;--lh:16\">/internal pipeline</span><span class=\"nm lw-t lw-m\" style=\"--fs:13.2;--lh:16\"><span class=\"n\" data-lw-count=\"14\" data-lw-from=\"11\">14</span><span class=\"p\"><span data-lw-count=\"30\" data-lw-from=\"24\">30</span>%</span></span></div></div></div></div></div>",
  "startups-validate": "<div class=\"lw lw-startups-validate\" style=\"--W:578;--H:370\"><div class=\"lw-stage\"><div class=\"lw-abs lw-col\" style=\"--x:117;--y:94.3;--w:344;--g:8\"><div class=\"lw-glass lw-row lw-pad\" style=\"--h:55;--a:.1;--r:12;--p:10;--pr:12;--g:8\"><span class=\"ib\"><svg class=\"lw-ico\" style=\"--s:18\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M13.5 2 5 13.5h6L10 22l9-12h-6z\"/></svg></span><span class=\"lw-col lw-grow\" style=\"--g:2\"><span class=\"lw-t lw-m\" style=\"--fs:12;--lh:16\">Business analyst</span><span class=\"lw-t lw-w8\" style=\"--fs:12;--lh:16\">Scope the idea</span></span><span class=\"lw-chip ch\" style=\"--fs:10.85;--px:7.6;--py:1;--r:99\"><svg class=\"lw-ico ck\" style=\"--s:10.9\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"3\" stroke-linecap=\"round\"><circle cx=\"12\" cy=\"12\" r=\"11\"/><path d=\"m7 12.5 3.3 3.3L17 9\"/></svg>Assigned</span></div><div class=\"lw-glass lw-row lw-pad\" style=\"--h:55;--a:.1;--r:12;--p:10;--pr:12;--g:8\"><span class=\"ib\"><svg class=\"lw-ico\" style=\"--s:18\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M21.7 6.3a6 6 0 0 1-7.9 7.4l-7.3 7.4a2.5 2.5 0 0 1-3.6-3.6l7.4-7.3a6 6 0 0 1 7.4-7.9l-3.5 3.5.7 3.4 3.4.7z\"/></svg></span><span class=\"lw-col lw-grow\" style=\"--g:2\"><span class=\"lw-t lw-m\" style=\"--fs:12;--lh:16\">Delivery team</span><span class=\"lw-t lw-w8\" style=\"--fs:12;--lh:16\">Build first version</span></span><span class=\"lw-chip ch\" style=\"--fs:10.85;--px:7.6;--py:1;--r:99\"><svg class=\"lw-ico ck\" style=\"--s:10.9\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"3\" stroke-linecap=\"round\"><circle cx=\"12\" cy=\"12\" r=\"11\"/><path d=\"m7 12.5 3.3 3.3L17 9\"/></svg>Assigned</span></div><div class=\"lw-glass lw-row lw-pad\" style=\"--h:55;--a:.1;--r:12;--p:10;--pr:12;--g:8\"><span class=\"ib\"><svg class=\"lw-ico\" style=\"--s:18\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><circle cx=\"9\" cy=\"7.5\" r=\"4\"/><path d=\"M1.5 21c0-4.3 3.4-7 7.5-7s7.5 2.7 7.5 7z\"/><path d=\"M15.5 3.7a4 4 0 0 1 0 7.6M18 14.4c2.6.8 4.5 3 4.5 6.6H19\" opacity=\".7\"/></svg></span><span class=\"lw-col lw-grow\" style=\"--g:2\"><span class=\"lw-t lw-m\" style=\"--fs:12;--lh:16\">User validation</span><span class=\"lw-t lw-w8\" style=\"--fs:12;--lh:16\">Put in front of users &amp; investors</span></span><span class=\"sw\"><svg class=\"lw-ico\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" data-fx=\"swap-out\" style=\"--s:18;--i:1\"><path d=\"M12 2v4\"/><path d=\"m19.1 4.9-2.8 2.8\" opacity=\".9\"/><path d=\"M22 12h-4\" opacity=\".8\"/><path d=\"m19.1 19.1-2.8-2.8\" opacity=\".7\"/><path d=\"M12 22v-4\" opacity=\".6\"/><path d=\"m4.9 19.1 2.8-2.8\" opacity=\".5\"/><path d=\"M2 12h4\" opacity=\".4\"/><path d=\"m4.9 4.9 2.8 2.8\" opacity=\".3\"/></svg><span class=\"lw-chip ch\" style=\"--fs:10.85;--px:7.6;--py:1;--r:99;--i:1\" data-fx=\"swap-in ok\"><svg class=\"lw-ico ck\" style=\"--s:10.9\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"3\" stroke-linecap=\"round\"><circle cx=\"12\" cy=\"12\" r=\"11\"/><path d=\"m7 12.5 3.3 3.3L17 9\"/></svg>Assigned</span></span></div></div></div></div>",
  "time-tracking": "<div class=\"lw lw-time-tracking\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col lw-pad\" style=\"--x:120;--y:95;--w:309;--h:150.2;--r:13.4;--p:11.2;--g:8.9\"><div class=\"lw-row lw-between\" style=\"padding:0 calc(2.2*var(--u))\"><span class=\"lw-t lw-m\" style=\"--fs:11;--lh:16.6;--ls:-.1\">Hours and approvals</span><span class=\"lw-t lw-m ok all\" style=\"--fs:7.3;--lh:9.8\">All approved</span></div><div class=\"pn lw-pad\" style=\"--pt:4.5;--pb:4.5;--pl:8.9;--pr:8.9\"><div class=\"lw-row pr\" style=\"--g:8.3\"><span class=\"lw-av\" style=\"--s:20.2\">DH</span><span class=\"lw-t lw-m\" style=\"--fs:8.9;--lh:11.9;--ls:-.1;--w:51.3\">Daniel H.</span><span class=\"lw-t lw-w8\" style=\"--fs:8.9;--lh:11.9;--ls:-.1;--w:82.3\">Full-Stack Engineer</span><span class=\"lw-t lw-m\" style=\"--fs:8.9;--lh:11.9;--ls:-.1;--w:32.1\"><span data-lw-count=\"86\" data-lw-from=\"62\">86</span>h</span><span class=\"lw-t lw-m ok\" style=\"--fs:7.3;--lh:9.8;--i:0\" data-fx=\"pop\">Approved</span></div><div class=\"lw-row pr\" style=\"--g:8.3\"><span class=\"lw-av\" style=\"--s:20.2\">HW</span><span class=\"lw-t lw-m\" style=\"--fs:8.9;--lh:11.9;--ls:-.1;--w:51.3\">Hannah W.</span><span class=\"lw-t lw-w8\" style=\"--fs:8.9;--lh:11.9;--ls:-.1;--w:82.3\">UX/UI Designer</span><span class=\"lw-t lw-m\" style=\"--fs:8.9;--lh:11.9;--ls:-.1;--w:32.1\"><span data-lw-count=\"104\" data-lw-from=\"78\">104</span>h</span><span class=\"lw-t lw-m ok\" style=\"--fs:7.3;--lh:9.8;--i:1\" data-fx=\"pop\">Approved</span></div><div class=\"lw-row pr\" style=\"--g:8.3\"><span class=\"lw-av\" style=\"--s:20.2\">AL</span><span class=\"lw-t lw-m\" style=\"--fs:8.9;--lh:11.9;--ls:-.1;--w:51.3\">Alice L.</span><span class=\"lw-t lw-w8\" style=\"--fs:8.9;--lh:11.9;--ls:-.1;--w:82.3\">QA Engineer</span><span class=\"lw-t lw-m\" style=\"--fs:8.9;--lh:11.9;--ls:-.1;--w:32.1\"><span data-lw-count=\"90\" data-lw-from=\"66\">90</span>h</span><span class=\"lw-t lw-m ok\" style=\"--fs:7.3;--lh:9.8;--i:2\" data-fx=\"pop\">Approved</span></div></div></div></div></div>",
  "vet-1": "<div class=\"lw lw-vet-1\" style=\"--W:578;--H:370\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-dim sd lw-col lw-pad\" style=\"--x:116;--y:96;--w:179;--h:179;--a:.2;--r:10.5;--o:.4;--b:.5;--p:10.5;--pb:8.6;--g:11.5;--d:-34\" data-fx=\"fan-l\"><div class=\"lw-row\" style=\"--g:5.3\"><span class=\"lw-av sq\" style=\"--s:33.9\">OH</span><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-m\" style=\"--fs:7.4;--lh:10.5\">Olivia</span><span class=\"lw-t w7\" style=\"--fs:6.5;--lh:8.4\">Senior Frontend Engineer</span></span></div><div class=\"lw-col\" style=\"--g:5.7\"><span class=\"lw-row\" style=\"--g:2.1\"><span class=\"lw-chip tg\" style=\"--fs:5.7;--px:4.5;--py:1.8;--r:3.6\">CV</span><span class=\"lw-chip tg\" style=\"--fs:5.7;--px:4.5;--py:1.8;--r:3.6\">LinkedIn</span></span><div><div class=\"rw\"><span><i class=\"lw-dot d1\"></i>Role seniority</span>Senior</div><div class=\"rw\"><span><i class=\"lw-dot d2\"></i>Work history</span>8 years</div><div class=\"rw\"><span><i class=\"lw-dot d3\"></i>Production experience</span>6+ years</div><div class=\"rw\"><span><i class=\"lw-dot d4\"></i>Technology depth</span>React, TypeScript, AWS</div></div></div><span class=\"lw-btn\" style=\"--h:16.6;--r:6;--fs:5.7\">Invite for an interview</span></div><div class=\"lw-abs lw-glass lw-dim sd lw-col lw-pad\" style=\"--x:300;--y:96;--w:179;--h:179;--a:.2;--r:10.5;--o:.4;--b:.5;--p:10.5;--pb:8.6;--g:11.5;--d:34\" data-fx=\"fan-r\"><div class=\"lw-row\" style=\"--g:5.3\"><span class=\"lw-av sq\" style=\"--s:33.9\">DK</span><span class=\"lw-col\" style=\"--g:2\"><span class=\"lw-t lw-m\" style=\"--fs:7.4;--lh:10.5\">Olivia</span><span class=\"lw-t w7\" style=\"--fs:6.5;--lh:8.4\">Senior Frontend Engineer</span></span></div><div class=\"lw-col\" style=\"--g:5.7\"><span style=\"--h:11.6\"></span><div><div class=\"rw\"><span></span>Senior<b>Verified</b></div><div class=\"rw\"><span></span>8 years<b>Verified</b></div><div class=\"rw\"><span></span>6+ years<b>Verified</b></div><div class=\"rw\"><span></span>React, TypeScript, AWS<b>Verified</b></div></div></div><span class=\"lw-btn\" style=\"--h:16.6;--r:6;--fs:5.7\">Invite for an interview</span></div><div class=\"lw-abs lw-glass lw-col lw-pad\" style=\"--x:172;--y:60;--w:250;--h:250;--a:.2;--r:14.7;--p:14.7;--pb:12;--g:12\" data-fx=\"lift\"><div class=\"lw-row\" style=\"--g:10\"><span class=\"lw-av sq\" style=\"--s:51.3\">OL</span><span class=\"lw-col\" style=\"--g:7\"><span class=\"lw-col\" style=\"--g:3\"><span class=\"lw-t lw-m\" style=\"--fs:10.3;--lh:14.7\">Oscar L.</span><span class=\"lw-t w7\" style=\"--fs:9;--lh:11.8\">Senior Frontend Engineer</span></span><span class=\"lw-row\" style=\"--g:3\"><span class=\"lw-chip bd\" style=\"--fs:7;--px:6.3;--py:1.6;--r:20\"><svg class=\"lw-ico\" style=\"--s:7\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M9 3h6a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3V5a2 2 0 0 1 2-2zm0 3h6V5H9z\"/></svg>8 years</span><span class=\"lw-chip bd\" style=\"--fs:7;--px:6.3;--py:1.6;--r:20\"><svg class=\"lw-ico\" style=\"--s:7\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M4 2h11v20H4zM16 9h4v13h-4zM7 5v2h2V5zm0 4v2h2V9zm0 4v2h2v-2z\"/></svg>Fintech</span></span></span></div><div class=\"lw-col\" style=\"--g:8\"><span class=\"lw-row\" style=\"--g:2.9\"><span class=\"lw-chip tg\" style=\"--fs:8;--px:6.3;--py:1.6;--r:5.1\"><svg class=\"lw-ico li\" style=\"--s:8\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2 10v2h8v-2zm0 4v2h6v-2z\"/></svg>CV</span><span class=\"lw-chip tg\" style=\"--fs:8;--px:6.3;--py:1.6;--r:5.1\"><svg class=\"lw-ico li\" style=\"--s:9\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M4 9h3.5v11H4zM5.7 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM10 9h3.3v1.6c.5-.9 1.7-1.9 3.5-1.9 3.6 0 4.2 2.3 4.2 5.4V20h-3.5v-5.2c0-1.3 0-2.9-1.8-2.9s-2.1 1.4-2.1 2.8V20H10z\"/></svg>LinkedIn</span></span><div><div class=\"rw\"><span><i class=\"lw-dot d1\"></i>Role seniority</span>Senior<b>Verified</b></div><div class=\"rw\"><span><i class=\"lw-dot d2\"></i>Work history</span>8 years<b>Verified</b></div><div class=\"rw\"><span><i class=\"lw-dot d3\"></i>Production experience</span>6+ years<b>Verified</b></div><div class=\"rw\"><span><i class=\"lw-dot d4\"></i>Technology depth</span>React, TypeScript, AWS<b>Verified</b></div></div></div><span class=\"lw-btn bt\" style=\"--h:23;--r:8;--fs:8;--px:9.3\"><i style=\"--w:8\"></i>Invite for an interview<svg class=\"lw-ico\" style=\"--s:8\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12h16m-6-6 6 6-6 6\"/></svg></span></div></div></div>",
  "vet-2": "<div class=\"lw lw-vet-2\" style=\"--W:578;--H:370\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col lw-pad\" style=\"--x:101;--y:88;--w:377;--h:193.4;--a:.1;--r:13.7;--pt:14.1;--pb:14.1;--pl:12.8;--pr:12.8;--g:17.7\"><span class=\"lw-av pp\" style=\"--s:28.3\">OL</span><div class=\"lw-col lw-pad\" style=\"--pl:4.3;--pr:4.3;--g:7.4\"><span class=\"lw-t w7\" style=\"--fs:8.9;--lh:11.8\">Oscar L.</span><span class=\"lw-t\" style=\"--fs:17.1;--lh:20.5;--ls:-.5\">Senior assessment overview</span></div><div class=\"gr\"><div><span><i class=\"lw-dot d1\"></i>Ownership</span><b data-fx=\"ok\">Verified</b></div><div><span><i class=\"lw-dot d2\"></i>Cross-functional influence</span><b data-fx=\"ok\">Verified</b></div><div><span><i class=\"lw-dot d3\"></i>System design</span><b data-fx=\"ok\" style=\"--i:3\">Verified</b></div><div><span><i class=\"lw-dot d4\"></i>Architecture</span><b data-fx=\"ok\" style=\"--i:3\">Verified</b></div><div><span><i class=\"lw-dot d5\"></i>Technical leadership</span><b data-fx=\"ok\" style=\"--i:6\">Verified</b></div><div><span><i class=\"lw-dot d6\"></i>Communication</span><b data-fx=\"ok\" style=\"--i:6\">Verified</b></div></div></div></div></div>",
  "vet-3": "<div class=\"lw lw-vet-3\" style=\"--W:578;--H:370\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:121;--y:72;--w:336;--a:.1;--r:14.7\"><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pt:11.8;--pb:11.8;--pr:13.5;--pl:13.5;--g:6.8\"><svg class=\"lw-ico\" style=\"--s:13.5\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16\"/></svg><span class=\"lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">Technology skills</span><span class=\"lw-t lw-m w5\" style=\"--fs:10.2;--lh:13.5\">Oscar L.</span></div><div class=\"sc lw-row lw-pad\" style=\"--pt:10.2;--pb:10.2;--pl:13.5;--pr:13.5;--g:5.1;flex-wrap:wrap\"><span class=\"lw-chip gb\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--i:0\">React</span><span class=\"lw-chip gb\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--i:1\">TypeScript</span><span class=\"lw-chip gb\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--i:2\">Node.js</span><span class=\"lw-chip gb\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--i:3\">PostgreSQL</span><span class=\"lw-chip gb\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--i:4\">AWS</span></div><div class=\"sc lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot d1\"></i>Frontend</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5\">React, TypeScript</span><span class=\"lw-chip bl\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--i:6\">Expert</span></div><div class=\"sc lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot d2\"></i>Backend</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5\">Node.js, PostgreSQL</span><span class=\"lw-chip gb\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--i:7\">Advanced</span></div><div class=\"sc lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot d3\"></i>Cloud</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5\">AWS, Docker</span><span class=\"lw-chip gb\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--i:8\">Advanced</span></div><div class=\"sc lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot d4\"></i>AI tools</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5\">Copilot, Cursor</span><span class=\"lw-chip gb\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--i:9\">Daily use</span></div></div></div></div>",
  "vet-4": "<div class=\"lw lw-vet-4\" style=\"--W:578;--H:370\"><div class=\"lw-stage\"><div class=\"lw-abs lw-col\" style=\"--x:102.1;--y:93.8;--w:374;--g:8.6\"><span class=\"lw-t w5\" style=\"--fs:12;--lh:16;--h:20\">Collaboration assessment</span><div class=\"rw lw-row lw-between lw-pad\" style=\"--h:45.3;--pl:18.8;--pr:18.8\"><span class=\"lw-bar\" style=\"--h:45.3\" data-fx=\"fill\"><i style=\"--v:74;--to:84.5\"></i></span><span class=\"lw-t\" style=\"--fs:15.5;--lh:18.1\">Reliability</span><span class=\"lw-t v\" style=\"--fs:16;--lh:18\" data-lw-count=\"95\" data-lw-from=\"84\">95</span></div><div class=\"rw lw-row lw-between lw-pad\" style=\"--h:45.3;--pl:18.8;--pr:18.8\"><span class=\"lw-bar\" style=\"--h:45.3;--i:1\" data-fx=\"fill\"><i style=\"--v:70;--to:80.2\"></i></span><span class=\"lw-t\" style=\"--fs:15.5;--lh:18.1\">Ownership</span><span class=\"lw-t v\" style=\"--fs:16;--lh:18\" data-lw-count=\"92\" data-lw-from=\"81\">92</span></div><div class=\"rw lw-row lw-between lw-pad\" style=\"--h:45.3;--pl:18.8;--pr:18.8\"><span class=\"lw-bar\" style=\"--h:45.3;--i:2\" data-fx=\"fill\"><i style=\"--v:76;--to:86.9\"></i></span><span class=\"lw-t\" style=\"--fs:15.5;--lh:18.1\">Collaboration style</span><span class=\"lw-t v\" style=\"--fs:16;--lh:18\" data-lw-count=\"96\" data-lw-from=\"85\">96</span></div></div></div></div>",
  "vet-5": "<div class=\"lw lw-vet-5\" style=\"--W:578;--H:370\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-dim lw-row lw-pad\" style=\"--o:.6;--b:1.2;--x:157.6;--y:193.2;--w:263.1;--h:42.6;--a:.1;--r:10.6;--p:8.9;--g:8.7;--d:22;--i:1\" data-fx=\"slide-y\"><span class=\"bx r6\" style=\"--w:24.9;--h:24.9\"><svg class=\"lw-ico\" style=\"--s:10.5\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2 10v2h8v-2zm0 4v2h6v-2z\"/></svg></span><span class=\"lw-col lw-grow\" style=\"--g:2.6\"><span class=\"lw-t lw-m\" style=\"--fs:9.3;--lh:11\">IR35 assessment</span><span class=\"lw-row lw-t w6\" style=\"--fs:8.4;--lh:10;--g:3.3\">Yotewo <i class=\"w3\">/</i> 5 years</span></span><span class=\"lw-chip bg\" style=\"--fs:7.5;--px:5;--py:1.4;--r:5\">Outside IR35</span></div><div class=\"lw-abs lw-glass lw-dim lw-row lw-pad\" style=\"--o:.75;--b:1;--x:117;--y:157;--w:339;--h:63;--a:.1;--r:13.6;--pl:10.8;--pr:10.8;--pt:20.4;--g:11.2;--d:12\" data-fx=\"slide-y\"><span class=\"bx r8\" style=\"--w:32.1;--h:32.1\"><svg class=\"lw-ico\" style=\"--s:13.5\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2 10v2h8v-2zm0 4v2h6v-2z\"/></svg></span><span class=\"lw-col lw-grow\" style=\"--g:3.3\"><span class=\"lw-t lw-m\" style=\"--fs:12;--lh:15\">IR35 assessment</span><span class=\"lw-row lw-t w6\" style=\"--fs:10.5;--lh:12;--g:4.1\">Yotewo <i class=\"w3\">/</i> 8 years</span></span><span class=\"lw-chip bg\" style=\"--fs:9.7;--px:6.5;--py:2;--r:6.5\">Outside IR35</span></div><div class=\"lw-abs lw-glass lw-row lw-pad\" style=\"--x:76;--y:133.7;--w:426.4;--h:69;--a:.1;--r:17.2;--p:14.4;--g:14.1\" data-fx=\"lift\"><span class=\"bx lg r9\" style=\"--w:40.3;--h:40.3\"><svg class=\"lw-ico\" style=\"fill:currentColor;stroke:none;--s:23.4;height:auto;aspect-ratio:22.56/20\" viewBox=\"5.848 8 20.304 18\" fill=\"currentColor\"><path d=\"M20.449 10.8259C21.9005 8.89182 24.8264 8.50604 26.1512 8.53482C25.4888 8.73628 23.9913 9.27172 22.9545 9.96245C21.6586 10.8259 21.2266 12.5527 19.1531 16.2654C17.0796 19.978 16.1292 19.3736 14.4014 19.3736C13.1572 19.2355 11.5503 17.9922 10.9455 16.3517C10.7767 15.3061 10.825 14.4426 10.8978 13.6971C10.5063 13.4545 10.0912 13.1884 9.64956 12.898C8.39161 12.071 8.20088 11.2864 8.12044 10.7354C7.47067 10.8558 6.71767 10.8354 5.84814 10.3078C8.11013 9.65476 8.00854 9.96893 8.12044 10.7354C9.27839 10.521 10.1085 9.85969 10.6863 10.8259C11.1843 11.6586 11.0112 12.5344 10.8978 13.6971C13.4161 15.2578 14.9562 15.8452 16.3021 15.661C17.9463 15.4359 18.6347 13.2434 20.449 10.8259Z\"/><path d=\"M16.2482 26.0001L26.1518 8.53375C25.4909 8.56235 24.3343 8.81459 23.1473 9.67854C22.5493 10.1684 21.9855 10.8636 21.3738 11.5207C20.7921 12.2714 20.2191 13.0949 19.7232 14.2405C19.1605 15.5408 18.6057 16.4918 18.0726 17.1804C16.422 19.1702 15.032 18.9962 14.1633 18.7368C14.2212 19.2401 14.3196 20.6967 14.9452 22.4952C15.5706 24.2937 16.0745 25.5811 16.2482 26.0001Z\"/><path d=\"M10.9182 16.4667L16.2844 26.0001C16.1113 25.5802 15.6093 24.2897 14.9862 22.487C14.363 20.6844 14.0918 19.2246 14.0341 18.7201C13.2574 18.501 11.647 17.7667 10.9182 16.4667Z\"/><path d=\"M15.1899 13.9289C16.8195 13.9289 18.1405 12.6017 18.1405 10.9644C18.1405 9.32722 16.8195 8 15.1899 8C13.5603 8 12.2392 9.32722 12.2392 10.9644C12.2392 12.6017 13.5603 13.9289 15.1899 13.9289Z\"/></svg></span><span class=\"lw-col lw-grow\" style=\"--g:4.2\"><span class=\"lw-t lw-m\" style=\"--fs:15.1;--lh:18\">Senior Frontend Engineer</span><span class=\"lw-row lw-t w6\" style=\"--fs:12.6;--lh:14.2;--g:4.9\">Yotewo <i class=\"w3\">/</i> 5 years</span></span><span class=\"lw-chip ok\" style=\"--fs:13.3;--px:9;--py:.9;--r:99\" data-fx=\"ok\"><svg class=\"lw-ico ck\" style=\"--s:13.3\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"3\" stroke-linecap=\"round\"><circle cx=\"12\" cy=\"12\" r=\"11\"/><path d=\"m7 12.5 3.3 3.3L17 9\"/></svg>Verified</span></div></div></div>",
  "vet-hero-photo-clean": "<div class=\"lw lw-hero-how-we-vet lw-keep\" style=\"--W:1440;--H:804\"><div class=\"lw-stage\"><div class=\"lw-abs gd\" style=\"--x:0;--y:0;--w:1440;--h:804\"></div><div class=\"lw-abs ch\" style=\"--x:1125;--y:217;--w:224;--h:29\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"#c8cad0\" stroke-width=\"1\" stroke-linejoin=\"round\"><path d=\"M5 1.5 6 4.5 9 5.5 6 6.5 5 9.5 4 6.5 1 5.5 4 4.5Z\"/><path d=\"M9.5 1v2M8.5 2h2\"/></svg><span class=\"lw-t lw-m\" style=\"--fs:11;--lh:13\">Tailor this language for executives</span></div><div class=\"lw-abs cd lw-col\" style=\"--x:916;--y:281;--w:453;--h:227;padding:calc(16.5*var(--u)) calc(14.9*var(--u));gap:calc(20.6*var(--u))\"><div class=\"lw-row lw-between\" style=\"padding:0 calc(5*var(--u))\"><div class=\"lw-col\" style=\"--g:8.6\"><span class=\"lw-t\" style=\"--fs:11;--lh:14;color:rgba(255,255,255,.7)\">Oscar L.</span><span class=\"lw-t\" style=\"--fs:19.9;--lh:23.9;--ls:-.6\">Senior assessment overview</span></div><img class=\"lw-av pp\" style=\"--s:45.9\" src=\"https://cdn.prod.website-files.com/6ac429767ffb1fa6d7e6e71a/6ae8e0ee85a5fa22471ce5b6_vet-hero-raw-2.jpg\" alt=\"\" loading=\"lazy\"></div><div class=\"gr\"><div><span><i class=\"lw-dot\" style=\"--c:#b99ae7\"></i>Ownership</span><b data-fx=\"pop\" style=\"--i:0\">Verified</b></div><div><span><i class=\"lw-dot\" style=\"--c:#ea7b43\"></i>Cross-functional influence</span><b data-fx=\"pop\" style=\"--i:1\">Verified</b></div><div><span><i class=\"lw-dot\" style=\"--c:#ef729e\"></i>System design</span><b data-fx=\"pop\" style=\"--i:2\">Verified</b></div><div><span><i class=\"lw-dot\" style=\"--c:#727dcb\"></i>Architecture</span><b data-fx=\"pop\" style=\"--i:3\">Verified</b></div><div><span><i class=\"lw-dot\" style=\"--c:#81a063\"></i>Technical leadership</span><b data-fx=\"pop\" style=\"--i:4\">Verified</b></div><div><span><i class=\"lw-dot\" style=\"--c:#72becb\"></i>Communication</span><b data-fx=\"pop\" style=\"--i:5\">Verified</b></div></div></div><div class=\"lw-abs ch\" style=\"--x:947;--y:541;--w:183;--h:29\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"6\" cy=\"6\" r=\"5\"/><path d=\"m4 6.1 1.4 1.4 2.7-2.8\"/></svg><span class=\"lw-t lw-m\" style=\"--fs:11;--lh:13\">Proofread with Grammarly</span></div></div></div>",
  "vetting": "<div class=\"lw lw-vetting\" style=\"--W:550;--H:340\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-row lw-pad\" style=\"--x:137;--y:53.6;--w:276.3;--h:42.1;--r:8.9;--pt:7;--pb:7;--pl:8.4;--pr:8.4;--g:9.8\"><span class=\"tl\"><svg class=\"lw-ico\" style=\"--s:11.8\" viewBox=\"0 0 24 24\"><path d=\"M6 2h8l5 5v15H6z\" fill=\"currentColor\"/><path d=\"M9 13h6M9 17h4\" stroke=\"#7b7b80\"/></svg></span><div class=\"lw-col lw-grow\" style=\"--g:2.9\"><span class=\"lw-t lw-m\" style=\"--fs:10.5;--lh:13\">Technical screening</span><span class=\"lw-t lw-m lw-w6\" style=\"--fs:8.7;--lh:9.9\">One-time four-stage assessment</span></div><span class=\"lw-chip\" style=\"--bg:rgba(255,255,255,.14);--c:#fff;--fs:8.5;--px:5.7;--py:1.6;--r:5.7\" data-fx=\"ok\">Completed</span></div><i class=\"lw-abs ln\" style=\"--x:274.9;--y:95.7;--w:.7;--h:35.1\"></i><div class=\"lw-abs lw-glass lw-row lw-center\" style=\"--x:253;--y:130.8;--w:44.3;--h:44.3;--r:11.8\"><svg class=\"lw-ico\" style=\"fill:currentColor;stroke:none;--s:24;height:auto;aspect-ratio:22.56/20\" viewBox=\"5.848 8 20.304 18\" fill=\"currentColor\"><path d=\"M20.449 10.8259C21.9005 8.89182 24.8264 8.50604 26.1512 8.53482C25.4888 8.73628 23.9913 9.27172 22.9545 9.96245C21.6586 10.8259 21.2266 12.5527 19.1531 16.2654C17.0796 19.978 16.1292 19.3736 14.4014 19.3736C13.1572 19.2355 11.5503 17.9922 10.9455 16.3517C10.7767 15.3061 10.825 14.4426 10.8978 13.6971C10.5063 13.4545 10.0912 13.1884 9.64956 12.898C8.39161 12.071 8.20088 11.2864 8.12044 10.7354C7.47067 10.8558 6.71767 10.8354 5.84814 10.3078C8.11013 9.65476 8.00854 9.96893 8.12044 10.7354C9.27839 10.521 10.1085 9.85969 10.6863 10.8259C11.1843 11.6586 11.0112 12.5344 10.8978 13.6971C13.4161 15.2578 14.9562 15.8452 16.3021 15.661C17.9463 15.4359 18.6347 13.2434 20.449 10.8259Z\"/><path d=\"M16.2482 26.0001L26.1518 8.53375C25.4909 8.56235 24.3343 8.81459 23.1473 9.67854C22.5493 10.1684 21.9855 10.8636 21.3738 11.5207C20.7921 12.2714 20.2191 13.0949 19.7232 14.2405C19.1605 15.5408 18.6057 16.4918 18.0726 17.1804C16.422 19.1702 15.032 18.9962 14.1633 18.7368C14.2212 19.2401 14.3196 20.6967 14.9452 22.4952C15.5706 24.2937 16.0745 25.5811 16.2482 26.0001Z\"/><path d=\"M10.9182 16.4667L16.2844 26.0001C16.1113 25.5802 15.6093 24.2897 14.9862 22.487C14.363 20.6844 14.0918 19.2246 14.0341 18.7201C13.2574 18.501 11.647 17.7667 10.9182 16.4667Z\"/><path d=\"M15.1899 13.9289C16.8195 13.9289 18.1405 12.6017 18.1405 10.9644C18.1405 9.32722 16.8195 8 15.1899 8C13.5603 8 12.2392 9.32722 12.2392 10.9644C12.2392 12.6017 13.5603 13.9289 15.1899 13.9289Z\"/></svg></div><i class=\"lw-abs ln\" style=\"--x:274.9;--y:175.1;--w:.7;--h:35.1\"></i><div class=\"lw-abs lw-glass lw-col lw-pad\" style=\"--x:137;--y:210.2;--w:276.3;--h:75.9;--a:.08;--r:11;--pt:8.4;--pl:8.4;--pr:8.4;--pb:9.8;--g:10;--i:3;--d:-6\" data-fx=\"lift\"><div class=\"lw-row\" style=\"--g:9.8\"><span class=\"tl\" style=\"--i:4\" data-fx=\"ok\"><svg class=\"lw-ico\" style=\"--s:11.8\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"currentColor\" stroke=\"none\"/><path d=\"m8 12 3 3 5-6\" stroke=\"#6b6b70\" stroke-width=\"2.4\"/></svg></span><div class=\"lw-col\" style=\"--g:2.9\"><span class=\"lw-t lw-m\" style=\"--fs:10.5;--lh:13\">Applies to future applications</span><span class=\"lw-t lw-m lw-w8\" style=\"--fs:8.7;--lh:9.9;opacity:.88\">No repeat screening for each client</span></div></div><div class=\"lw-col\" style=\"--g:5.3\"><div class=\"lw-row lw-between\"><span class=\"lw-t lw-w8\" style=\"--fs:8;--lh:10;opacity:.88\">Assessment complete</span><span class=\"lw-t lw-m lw-w8\" style=\"--fs:8;--lh:10;opacity:.88\">100%</span></div><div class=\"lw-bar\" style=\"--h:4.2\"><i style=\"--v:100;--fill:linear-gradient(90deg,#d1879d,#c89d8f,#d1cbb9)\"></i></div></div></div></div></div>",
  "vs-hero-visual": "<div class=\"lw lw-vs-hero-visual lw-loop\" data-lw-safe=\"400\" style=\"--W:1280;--H:456\"><div class=\"lw-stage\"><div class=\"lw-abs gl fd lw-row\" style=\"--x:452.5;--y:72.5;--w:375;--h:38.5;--g:8\"><svg class=\"lw-ico\" style=\"--s:13;color:rgba(255,255,255,.55)\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-3.6-3.6\"/></svg><span class=\"lw-t tw\" style=\"--fs:13.7;--lh:17\"><span class=\"ty\">React Engineer, UK</span><span class=\"cr\"></span></span><span class=\"sd\"><svg class=\"lw-ico\" style=\"--s:12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12h15M13 6l6 6-6 6\"/></svg></span></div><span class=\"lw-abs ln a\" style=\"--x:639.5;--y:111;--h:49\"></span><span class=\"lw-abs dt\" style=\"--x:637;--y:111\"></span><div class=\"lw-abs gl lg\" style=\"--x:610;--y:160;--w:60;--h:60\"><span class=\"rg\"></span><svg class=\"lw-ico\" style=\"fill:currentColor;stroke:none;--s:33;height:calc(29.3*var(--u))\" viewBox=\"5.848 8 20.304 18\" fill=\"#fff\"><path d=\"M20.449 10.8259C21.9005 8.89182 24.8264 8.50604 26.1512 8.53482C25.4888 8.73628 23.9913 9.27172 22.9545 9.96245C21.6586 10.8259 21.2266 12.5527 19.1531 16.2654C17.0796 19.978 16.1292 19.3736 14.4014 19.3736C13.1572 19.2355 11.5503 17.9922 10.9455 16.3517C10.7767 15.3061 10.825 14.4426 10.8978 13.6971C10.5063 13.4545 10.0912 13.1884 9.64956 12.898C8.39161 12.071 8.20088 11.2864 8.12044 10.7354C7.47067 10.8558 6.71767 10.8354 5.84814 10.3078C8.11013 9.65476 8.00854 9.96893 8.12044 10.7354C9.27839 10.521 10.1085 9.85969 10.6863 10.8259C11.1843 11.6586 11.0112 12.5344 10.8978 13.6971C13.4161 15.2578 14.9562 15.8452 16.3021 15.661C17.9463 15.4359 18.6347 13.2434 20.449 10.8259Z\"/><path d=\"M16.2482 26.0001L26.1518 8.53375C25.4909 8.56235 24.3343 8.81459 23.1473 9.67854C22.5493 10.1684 21.9855 10.8636 21.3738 11.5207C20.7921 12.2714 20.2191 13.0949 19.7232 14.2405C19.1605 15.5408 18.6057 16.4918 18.0726 17.1804C16.422 19.1702 15.032 18.9962 14.1633 18.7368C14.2212 19.2401 14.3196 20.6967 14.9452 22.4952C15.5706 24.2937 16.0745 25.5811 16.2482 26.0001Z\"/><path d=\"M10.9182 16.4667L16.2844 26.0001C16.1113 25.5802 15.6093 24.2897 14.9862 22.487C14.363 20.6844 14.0918 19.2246 14.0341 18.7201C13.2574 18.501 11.647 17.7667 10.9182 16.4667Z\"/><path d=\"M15.1899 13.9289C16.8195 13.9289 18.1405 12.6017 18.1405 10.9644C18.1405 9.32722 16.8195 8 15.1899 8C13.5603 8 12.2392 9.32722 12.2392 10.9644C12.2392 12.6017 13.5603 13.9289 15.1899 13.9289Z\"/></svg></div><span class=\"lw-abs ln b\" style=\"--x:639.5;--y:220;--h:48\"></span><span class=\"lw-abs dt b\" style=\"--x:637;--y:220\"></span><div class=\"lw-abs gl cd\" style=\"--x:452.5;--y:268;--w:375;--h:143.5\"><div class=\"lw-abs lw-row\" style=\"--x:12;--y:15;--g:9\"><span class=\"ok\"><svg class=\"lw-ico\" style=\"--s:9\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m2.8 6.2 2.1 2.1 4.3-4.4\"/></svg></span><span class=\"lw-t\" style=\"--fs:12;--lh:15\">Vetted match ready</span></div><span class=\"lw-abs lw-t\" style=\"--x:262;--y:17;--w:101;--fs:8;--lh:10;text-align:right;color:rgba(255,255,255,.7)\">3 top matches found</span><div class=\"lw-abs ls\" style=\"--x:11.5;--y:40.5;--w:352;--h:90\"><div class=\"rw\"><img class=\"lw-av\" style=\"--s:19\" src=\"https://cdn.prod.website-files.com/6ac42caa6ba35878847056dc/6ad977f2dd9c966bca37a0b5_6ad9779ed1f67bc501505799_avatar-7.webp\" alt=\"\" loading=\"lazy\"><span class=\"lw-t lw-m\" style=\"--fs:8.8;--lh:11\">Ravi S.</span><span class=\"lw-t r\" style=\"--fs:8.8;--lh:11\">React Engineer</span><span class=\"lw-t lw-m\" style=\"--fs:8.8;--lh:11\">\u00a375/h</span><span class=\"bd\">96% match</span></div><div class=\"rw\" style=\"--i:1\"><img class=\"lw-av\" style=\"--s:19\" src=\"https://cdn.prod.website-files.com/6ac42caa6ba35878847056dc/6ad977f3dd9c966bca37a0ba_6ad9779e1c68a9589356511c_avatar-8.webp\" alt=\"\" loading=\"lazy\"><span class=\"lw-t lw-m\" style=\"--fs:8.8;--lh:11\">Megan O.</span><span class=\"lw-t r\" style=\"--fs:8.8;--lh:11\">Full-Stack Engineer</span><span class=\"lw-t lw-m\" style=\"--fs:8.8;--lh:11\">\u00a372/h</span><span class=\"bd\">92% match</span></div><div class=\"rw\" style=\"--i:2\"><img class=\"lw-av\" style=\"--s:19\" src=\"https://cdn.prod.website-files.com/6ac42caa6ba35878847056dc/6ad977f0dd9c966bca37a09c_6ad9779df88f487a4d56c130_avatar-2.webp\" alt=\"\" loading=\"lazy\"><span class=\"lw-t lw-m\" style=\"--fs:8.8;--lh:11\">Tomasz K.</span><span class=\"lw-t r\" style=\"--fs:8.8;--lh:11\">Frontend Engineer</span><span class=\"lw-t lw-m\" style=\"--fs:8.8;--lh:11\">\u00a368/h</span><span class=\"bd\">89% match</span></div></div></div></div></div>",
  "ways-consulting": "<div class=\"lw lw-ways-consulting\" style=\"--W:638;--H:460\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:139;--y:115;--w:360;--a:.12;--r:16\" data-fx=\"lift\"><div class=\"lw-row lw-pad\" style=\"--h:52;--pl:16;--pr:16;--g:9\"><span class=\"lw-t lw-m lw-grow\" style=\"--fs:14;--lh:19.6;--ls:-.1\">Architecture review</span><span class=\"lw-chip\" style=\"--fs:11.5;--px:7.5;--py:3.6;--r:9;--bg:rgba(6,109,173,.3);--c:#4fd0ff\">Report ready</span></div><div class=\"lw-row lw-pad\" style=\"--h:44;--pl:16;--pr:16;--g:9;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.1)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:12.5;--lh:17;--g:8\"><i class=\"lw-dot\" style=\"--c:#4fffa0;--s:5\"></i>Cloud costs</span><span class=\"lw-t\" style=\"--fs:11.5;--lh:16.1;--ls:-.1;opacity:0.65\">\u221218% possible</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:11;--px:7.5;--py:3.6;--r:9;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:0\">Recommend</span></div><div class=\"lw-row lw-pad\" style=\"--h:44;--pl:16;--pr:16;--g:9;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.1)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:12.5;--lh:17;--g:8\"><i class=\"lw-dot\" style=\"--c:#ff9b4f;--s:5\"></i>Security</span><span class=\"lw-t\" style=\"--fs:11.5;--lh:16.1;--ls:-.1;opacity:0.65\">3 findings</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:11;--px:7.5;--py:3.6;--r:9;--bg:rgba(139,64,17,.3);--c:#ff9b4f;--i:1\">Fix first</span></div><div class=\"lw-row lw-pad\" style=\"--h:44;--pl:16;--pr:16;--g:9;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.1)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:12.5;--lh:17;--g:8\"><i class=\"lw-dot\" style=\"--c:#4fd0ff;--s:5\"></i>Scalability</span><span class=\"lw-t\" style=\"--fs:11.5;--lh:16.1;--ls:-.1;opacity:0.65\">Next 12 months</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:11;--px:7.5;--py:3.6;--r:9;--bg:rgba(6,109,173,.3);--c:#4fd0ff;--i:2\">Planned</span></div><div class=\"lw-row lw-pad\" style=\"--h:44;--pl:16;--pr:16;--g:9;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.1)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:12.5;--lh:17;--g:8\"><i class=\"lw-dot\" style=\"--c:#c3a6e0;--s:5\"></i>Code quality</span><span class=\"lw-t\" style=\"--fs:11.5;--lh:16.1;--ls:-.1;opacity:0.65\">Reviewed</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:11;--px:7.5;--py:3.6;--r:9;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:3\">Good</span></div></div></div></div>",
  "ways-delivery": "<div class=\"lw lw-ways-delivery\" style=\"--W:638;--H:460\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:139;--y:129;--w:360;--a:.12;--r:16\" data-fx=\"lift\"><div class=\"lw-row lw-pad\" style=\"--h:52;--pl:16;--pr:16;--g:9\"><span class=\"lw-t lw-m lw-grow\" style=\"--fs:14;--lh:19.6;--ls:-.1\">Product Delivery Team</span><span class=\"lw-chip\" style=\"--fs:11.5;--px:7.5;--py:3.6;--r:9;--bg:rgba(4,144,70,.3);--c:#4fffa0\">Owns delivery</span></div><div class=\"lw-row lw-pad\" style=\"--h:52;--pl:16;--pr:16;--g:9;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.1)\"><span class=\"lw-row\" style=\"--g:0\"><span class=\"lw-av\"  style=\"--s:30;background:linear-gradient(150deg,#d8c2b4,#7a7584)\">PM</span><span class=\"lw-av\"  style=\"--s:30;background:linear-gradient(150deg,#c4cad3,#4a505c)\">TL</span><span class=\"lw-av\"  style=\"--s:30;background:linear-gradient(150deg,#e2a07c,#9a4b3c)\">EN</span><span class=\"lw-av\"  style=\"--s:30;background:linear-gradient(150deg,#b9c8a8,#56664a)\">EN</span><span class=\"lw-av\"  style=\"--s:30;background:linear-gradient(150deg,#c3a6e0,#5d4f7a)\">QA</span></span><span class=\"lw-t\" style=\"--fs:12;--lh:16.8;--ls:-.1;opacity:0.7\">5 talents, one owner</span></div><div class=\"lw-row lw-wrap lw-pad\" style=\"--pl:16;--pr:16;--pb:10;--pt:2;--g:6\"><span class=\"lw-chip\" style=\"--fs:11;--px:7;--py:3.4;--r:8;--bg:rgba(255,255,255,.14);--c:#fff\">Project Manager</span><span class=\"lw-chip\" style=\"--fs:11;--px:7;--py:3.4;--r:8;--bg:rgba(255,255,255,.14);--c:#fff\">Tech Lead</span><span class=\"lw-chip\" style=\"--fs:11;--px:7;--py:3.4;--r:8;--bg:rgba(255,255,255,.14);--c:#fff\">2 Engineers</span><span class=\"lw-chip\" style=\"--fs:11;--px:7;--py:3.4;--r:8;--bg:rgba(255,255,255,.14);--c:#fff\">QA</span></div><div class=\"lw-row lw-pad\" style=\"--h:44;--pl:16;--pr:16;--g:9;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.1)\"><span class=\"lw-t lw-grow\" style=\"--fs:12.5;--lh:17.5;--ls:-.1;opacity:0.7\">Sprint 4</span><span class=\"lw-t lw-m\" style=\"--fs:12.5;--lh:17.5;--ls:-.1\">68%</span></div><div class=\"lw-pad\" style=\"--pl:16;--pr:16;--pb:14\"><div class=\"lw-bar\" style=\"--h:5;--v:68;--fill:#4fffa0\"><i></i></div></div></div></div></div>",
  "ways-permanent": "<div class=\"lw lw-ways-permanent\" style=\"--W:638;--H:460\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:139;--y:110;--w:360;--a:.12;--r:16\" data-fx=\"lift\"><div class=\"lw-row lw-pad\" style=\"--h:64;--pl:16;--pr:16;--g:9\"><span class=\"lw-av\" style=\"--s:38;background:linear-gradient(150deg,#e2a07c,#9a4b3c)\">HE</span><span class=\"lw-col lw-grow\" style=\"--g:2\"><span class=\"lw-t lw-m\" style=\"--fs:14;--lh:19.6;--ls:-.1\">Head of Engineering</span><span class=\"lw-t\" style=\"--fs:12;--lh:16.8;--ls:-.1;opacity:0.6\">Permanent engagement</span></span></div><div class=\"lw-row lw-pad\" style=\"--h:44;--pl:16;--pr:16;--g:9;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.1)\"><span class=\"lw-t lw-grow\" style=\"--fs:12.5;--lh:17.5;--ls:-.1;opacity:0.7\">Shortlist</span><span class=\"lw-t lw-m\" style=\"--fs:12.5;--lh:17.5;--ls:-.1\">3 candidates</span></div><div class=\"lw-row lw-pad\" style=\"--h:44;--pl:16;--pr:16;--g:9;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.1)\"><span class=\"lw-t lw-grow\" style=\"--fs:12.5;--lh:17.5;--ls:-.1;opacity:0.7\">Offer</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:11.5;--px:7.5;--py:3.6;--r:9;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:0\">Accepted</span></div><div class=\"lw-row lw-pad\" style=\"--h:44;--pl:16;--pr:16;--g:9;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.1)\"><span class=\"lw-t lw-grow\" style=\"--fs:12.5;--lh:17.5;--ls:-.1;opacity:0.7\">Joins</span><span class=\"lw-t lw-m\" style=\"--fs:12.5;--lh:17.5;--ls:-.1\">Your payroll</span></div><div class=\"lw-row lw-pad\" style=\"--h:44;--pl:16;--pr:16;--g:9;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.1)\"><span class=\"lw-t lw-grow\" style=\"--fs:12.5;--lh:17.5;--ls:-.1;opacity:0.7\">Start date</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:11.5;--px:7.5;--py:3.6;--r:9;--bg:rgba(6,109,173,.3);--c:#4fd0ff;--i:1\">In 4 weeks</span></div></div></div></div>",
  "ways-temporary": "<div class=\"lw lw-ways-temporary\" style=\"--W:638;--H:460\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:139;--y:126;--w:360;--a:.12;--r:16\" data-fx=\"lift\"><div class=\"lw-row lw-pad\" style=\"--h:64;--pl:16;--pr:16;--g:9\"><span class=\"lw-av\" style=\"--s:38;background:linear-gradient(150deg,#c4cad3,#4a505c)\">SB</span><span class=\"lw-col lw-grow\" style=\"--g:2\"><span class=\"lw-t lw-m\" style=\"--fs:14;--lh:19.6;--ls:-.1\">Senior Backend Engineer</span><span class=\"lw-t\" style=\"--fs:12;--lh:16.8;--ls:-.1;opacity:0.6\">Temporary engagement</span></span><span class=\"lw-chip\" style=\"--fs:11.5;--px:7.5;--py:3.6;--r:9;--bg:rgba(4,144,70,.3);--c:#4fffa0\">Active</span></div><div class=\"lw-row lw-pad\" style=\"--h:44;--pl:16;--pr:16;--g:9;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.1)\"><span class=\"lw-t lw-grow\" style=\"--fs:12.5;--lh:17.5;--ls:-.1;opacity:0.7\">Duration</span><span class=\"lw-t lw-m\" style=\"--fs:12.5;--lh:17.5;--ls:-.1\">Month 2 of 6</span></div><div class=\"lw-pad\" style=\"--pl:16;--pr:16;--pb:6\"><div class=\"lw-bar\" style=\"--h:5;--v:33;--fill:#4fd0ff\" data-fx=\"fill\" data-to=\"33\"><i></i></div></div><div class=\"lw-row lw-pad\" style=\"--h:44;--pl:16;--pr:16;--g:9;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.1)\"><span class=\"lw-t lw-grow\" style=\"--fs:12.5;--lh:17.5;--ls:-.1;opacity:0.7\">Monthly hours</span><span class=\"lw-t lw-m\" style=\"--fs:12.5;--lh:17.5;--ls:-.1\">80 h</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:11.5;--px:7.5;--py:3.6;--r:9;--bg:rgba(255,255,255,.14);--c:#fff;--i:0\">Cap 100 h</span></div><div class=\"lw-row lw-pad\" style=\"--h:44;--pl:16;--pr:16;--g:9;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.1)\"><span class=\"lw-t lw-grow\" style=\"--fs:12.5;--lh:17.5;--ls:-.1;opacity:0.7\">Notice</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:11.5;--px:7.5;--py:3.6;--r:9;--bg:rgba(6,109,173,.3);--c:#4fd0ff;--i:1\">30 days</span></div></div></div></div>",
  "why-accountable": "<div class=\"lw lw-why-accountable\" style=\"--W:384;--H:380\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-wc-main lw-col lw-pad\" style=\"--x:49;--y:120;--w:286;--h:139;--r:12.4;--p:10.3;--g:8.3\"><div class=\"lw-row lw-between lw-pad\" style=\"--pl:2;--pr:2\"><span class=\"lw-t lw-m lw-w\" style=\"--fs:10.2;--lh:15.4\">Hours and approvals</span><span class=\"lw-chip lw-wc-ok\" style=\"--bg:rgba(13,194,98,.2);--py:1.6;--i:4\" data-fx=\"pop\">All approved</span></div><div class=\"lw-col lw-wc-in lw-pad\" style=\"--pt:4.1;--pb:4.1;--pl:8.3;--pr:8.3\"><div class=\"lw-row lw-wc-r\"><span class=\"lw-av\" style=\"--s:18.7\">DH</span><span class=\"lw-t lw-m lw-w\" style=\"--w:47.5\">Daniel H.</span><span class=\"lw-t lw-w8\" style=\"--w:76.5\">Full-Stack Engineer</span><span class=\"lw-t lw-m lw-w\" style=\"--w:29.7\">86h</span><span class=\"lw-chip lw-wc-ok\" style=\"--i:1\" data-fx=\"pop\">Approved</span></div><div class=\"lw-row lw-wc-r\"><span class=\"lw-av\" style=\"--s:18.7\">HW</span><span class=\"lw-t lw-m lw-w\" style=\"--w:47.5\">Hannah W.</span><span class=\"lw-t lw-w8\" style=\"--w:76.5\">UX/UI Designer</span><span class=\"lw-t lw-m lw-w\" style=\"--w:29.7\">104h</span><span class=\"lw-chip lw-wc-ok\" style=\"--i:2\" data-fx=\"pop\">Approved</span></div><div class=\"lw-row lw-wc-r\"><span class=\"lw-av\" style=\"--s:18.7\">AL</span><span class=\"lw-t lw-m lw-w\" style=\"--w:47.5\">Alice L.</span><span class=\"lw-t lw-w8\" style=\"--w:76.5\">QA Engineer</span><span class=\"lw-t lw-m lw-w\" style=\"--w:29.7\">90h</span><span class=\"lw-chip lw-wc-ok\" style=\"--i:3\" data-fx=\"pop\">Approved</span></div></div></div></div></div>",
  "why-adaptive": "<div class=\"lw lw-why-adaptive\" style=\"--W:384;--H:380\"><div class=\"lw-stage\"><div class=\"lw-abs lw-wa-s\" style=\"--x:77;--y:280.2;--w:229;--h:6;opacity:.75;--d:6;--i:4\" data-fx=\"slide-y\"></div><div class=\"lw-abs lw-wa-s\" style=\"--x:66;--y:274.2;--w:251;--h:6;--d:3;--i:3\" data-fx=\"slide-y\"></div><div class=\"lw-abs lw-paper lw-col\" style=\"--x:57;--y:102;--w:269;--h:172.2;--r:10;--a:.9\"><div class=\"lw-row lw-pad lw-wa-top\" style=\"--p:9.7;--pb:5.1;--g:5.1;align-items:flex-start\"><span class=\"lw-row lw-center\" style=\"--w:16.9;--h:16.9;background:var(--lw-ink);border-radius:calc(4.2*var(--u));color:#fff\"><svg class=\"lw-ico\" style=\"--s:10.2\" viewBox=\"0 0 10 10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".6\" stroke-linecap=\"round\"><circle cx=\"3.6\" cy=\"2.8\" r=\"1.9\"/><path d=\"M.8 8.9c.2-1.5 1.4-2.4 2.8-2.4s2.6.9 2.8 2.4M6.8 1.2a1.6 1.6 0 0 1 0 3.1M8 6.6c.8.3 1.2 1 1.3 1.9\"/></svg></span><span class=\"lw-col\" style=\"--g:.8\"><span class=\"lw-t lw-m lw-ink\" style=\"--fs:6.8;--lh:10.2\">Set team capacity</span><span class=\"lw-t lw-mut\" style=\"--fs:5.9;--lh:8.5\">Adjust workload, hour cap, and cost as your priorities change.</span></span><span class=\"lw-row lw-center\" style=\"margin-left:auto;--w:10.2;--h:10.2;border-radius:calc(3.4*var(--u));background:#fff\"><svg class=\"lw-ico\" style=\"--s:5.9\" viewBox=\"0 0 6 6\" stroke=\"var(--lw-mut)\" stroke-width=\".6\" stroke-linecap=\"round\"><path d=\"m.6.6 4.8 4.8M5.4.6.6 5.4\"/></svg></span></div><div class=\"lw-row lw-pad\" style=\"--pt:3.9;--pl:9.7;--pr:9.7;--g:4.2\"><span class=\"lw-field is-light lw-grow\" style=\"--h:17;--r:5.1;padding:0 calc(5.1*var(--u));border-color:#dee0e3\"><span class=\"lw-t lw-wa-h\" style=\"--fs:6;--lh:8;padding-left:calc(1.7*var(--u))\">Emails, coma separated</span><span class=\"lw-row lw-t lw-m lw-ink\" style=\"--fs:6;--lh:8;margin-left:auto;--g:2\">Senior Frontend Engineer<svg class=\"lw-ico\" style=\"--s:6.8\" viewBox=\"0 0 7 7\"><path d=\"M1.5 2.6h4L3.5 4.8Z\" fill=\"rgba(13,17,38,.4)\"/></svg></span></span><span class=\"lw-btn is-dark\" style=\"--h:17;--px:6.8;--r:5.1;--fs:7\">Invite</span></div><div class=\"lw-row lw-wa-r lw-t lw-wa-h\" style=\"--fs:5;--lh:8;margin-top:calc(5.9*var(--u));height:calc(8*var(--u))\"><span>Team member</span><span style=\"padding:0\">Role</span><span>Monthly hours</span><span>Rate</span></div><div class=\"lw-col\" style=\"margin-top:calc(3.4*var(--u))\"><div class=\"lw-row lw-wa-r\"><span class=\"lw-row\" style=\"--g:3.4\"><span class=\"lw-av\" style=\"--s:10.2\">EH</span><span class=\"lw-t lw-ink\" style=\"--fs:6;--lh:8\">Elizabeth H. <span class=\"lw-blue\">(you)</span></span></span><span class=\"lw-wa-b\">Owner</span><span class=\"lw-wa-b\" style=\"opacity:.6;color:#464a53\">0<i>h</i></span><span class=\"lw-wa-b\" style=\"opacity:.6;color:#464a53\">0<i>/h</i></span></div><div class=\"lw-row lw-wa-r\"><span class=\"lw-row\" style=\"--g:3.4\"><span class=\"lw-av\" style=\"--s:10.2\">ZA</span><span class=\"lw-t lw-ink\" style=\"--fs:6;--lh:8\">Zara A.</span></span><span class=\"lw-wa-b\">Senior Frontend Engineer</span><span class=\"lw-wa-b\"><span data-lw-count=\"80\" data-lw-from=\"40\">80</span><i>h</i></span><span class=\"lw-wa-b\">\u00a370<i>/h</i></span><svg class=\"lw-wa-x\" viewBox=\"0 0 7 7\"><circle cx=\"3.4\" cy=\"3.4\" r=\"1.7\" fill=\"currentColor\"/><path d=\"m2.8 2.8 1.2 1.2m0-1.2L2.8 4\" stroke=\"#fff\" stroke-width=\".4\"/></svg></div><div class=\"lw-row lw-wa-r\"><span class=\"lw-row\" style=\"--g:3.4\"><span class=\"lw-av\" style=\"--s:10.2\">DM</span><span class=\"lw-t lw-ink\" style=\"--fs:6;--lh:8\">Diego M.</span></span><span class=\"lw-wa-b\">Product Designer</span><span class=\"lw-wa-b\"><span data-lw-count=\"80\" data-lw-from=\"32\">80</span><i>h</i></span><span class=\"lw-wa-b\">\u00a365<i>/h</i></span><svg class=\"lw-wa-x\" viewBox=\"0 0 7 7\"><circle cx=\"3.4\" cy=\"3.4\" r=\"1.7\" fill=\"currentColor\"/><path d=\"m2.8 2.8 1.2 1.2m0-1.2L2.8 4\" stroke=\"#fff\" stroke-width=\".4\"/></svg></div><div class=\"lw-row lw-wa-r\"><span class=\"lw-row\" style=\"--g:3.4\"><span class=\"lw-av\" style=\"--s:10.2\">LJ</span><span class=\"lw-t lw-ink\" style=\"--fs:6;--lh:8\">Liam J.</span></span><span class=\"lw-wa-b\">Backend Engineer</span><span class=\"lw-wa-b\"><span data-lw-count=\"75\" data-lw-from=\"20\">75</span><i>h</i></span><span class=\"lw-wa-b\">\u00a363<i>/h</i></span><svg class=\"lw-wa-x\" viewBox=\"0 0 7 7\"><circle cx=\"3.4\" cy=\"3.4\" r=\"1.7\" fill=\"currentColor\"/><path d=\"m2.8 2.8 1.2 1.2m0-1.2L2.8 4\" stroke=\"#fff\" stroke-width=\".4\"/></svg></div></div><div class=\"lw-row lw-between lw-pad\" style=\"--p:7.7\"><span class=\"lw-btn is-line\" style=\"--h:15.2;--px:5.9;--r:3.9;--fs:7.4;border-color:#dee0e3\">Cancel</span><span class=\"lw-btn\" style=\"--h:15.2;--px:5.9;--r:3.9;--fs:7.4;background:var(--lw-link);color:#fff\">Create team</span></div></div></div></div>",
  "why-fast": "<div class=\"lw lw-why-fast\" style=\"--W:384;--H:380\"><div class=\"lw-stage\"><svg class=\"lw-abs\" style=\"--x:95;--y:103;--w:194.2;--h:194.2\" viewBox=\"0 0 194.2 194.2\" fill=\"none\"><defs><linearGradient id=\"lwWfG\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#d1879d\"/><stop offset=\".5\" stop-color=\"#c89d8f\"/><stop offset=\"1\" stop-color=\"#d1cbb9\"/></linearGradient></defs><circle cx=\"97.1\" cy=\"97.1\" r=\"94.5\" stroke=\"#fff\" stroke-opacity=\".16\" stroke-width=\"5.2\"/><circle cx=\"97.1\" cy=\"97.1\" r=\"94.5\" stroke=\"url(#lwWfG)\" stroke-width=\"5.2\" stroke-dasharray=\"463.2 600\" transform=\"rotate(90 97.1 97.1)\"/></svg><div class=\"lw-abs lw-col lw-center\" style=\"--x:142;--y:160;--w:99.7;--g:1\"><span class=\"lw-t lw-w lw-wf-num\"><span data-lw-count=\"78\" data-lw-from=\"52\">78</span>%</span><span class=\"lw-t is-wrap lw-wf-sub\" style=\"--fs:10;--lh:14;--ls:.2\">of candidates pass<br>to the next stage</span></div><div class=\"lw-abs lw-glass lw-wf-card lw-col lw-pad\" style=\"--x:27;--y:62;--w:185.1;--h:60.4;--r:8.9;--p:10;--g:7.4\"><div class=\"lw-row\" style=\"--g:7;align-items:flex-start\"><span class=\"lw-av\" style=\"--s:22;background:#6b6f7a\">GM</span><span class=\"lw-col lw-grow\" style=\"--g:2\"><span class=\"lw-t lw-m lw-w\" style=\"--fs:7;--lh:10.1\">Grace M.</span><span class=\"lw-t lw-wf-sub\" style=\"--fs:6;--lh:8.1;text-align:left\">DevOps Engineer</span></span><span class=\"lw-chip\" style=\"--bg:rgba(31,193,107,.2);--c:#3ee089;--fs:6;--px:6;--py:1.4;--r:99\" data-fx=\"pop\">Good match</span></div><span class=\"lw-row\" style=\"--g:2.6\"><span class=\"lw-chip lw-wf-tag\">React</span><span class=\"lw-chip lw-wf-tag\">AWS</span><span class=\"lw-chip lw-wf-tag\">Kubernetes</span><span class=\"lw-chip lw-wf-tag\">Docker</span><span class=\"lw-chip lw-wf-tag\" style=\"--px:5.5\">+3</span></span></div><div class=\"lw-abs lw-glass lw-wf-pill lw-row lw-pad\" style=\"--x:193;--y:263;--w:111.1;--a:.2;--pl:8.2;--pr:8.2;--g:5.5;--i:1\" data-fx=\"pop\"><svg class=\"lw-ico\" style=\"--s:11.1\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"6\" cy=\"6\" r=\"4.5\"/><path d=\"m4.1 6.1 1.3 1.3 2.6-2.8\"/></svg><span class=\"lw-t lw-w\" style=\"--fs:7.6;--lh:9\">CV or LinkedIn profile</span></div><div class=\"lw-abs lw-glass lw-wf-pill lw-row lw-pad\" style=\"--x:223.4;--y:289.4;--w:120.1;--a:.2;--pl:8.2;--pr:8.2;--g:5.5;--i:3\" data-fx=\"pop\"><svg class=\"lw-ico\" style=\"--s:11.1\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\".8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"6\" cy=\"6\" r=\"4.5\"/><path d=\"m4.1 6.1 1.3 1.3 2.6-2.8\"/></svg><span class=\"lw-t lw-w\" style=\"--fs:7.6;--lh:9\">Work history and tenure</span></div></div></div>",
  "con-roadmap": "<div class=\"lw lw-con-roadmap\" style=\"--W:478;--H:400\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:71;--y:84.3;--w:336;--a:.1;--r:14.7\"><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pt:11.8;--pb:11.8;--pr:13.5;--pl:13.5;--g:6.8\"><svg class=\"lw-ico\" style=\"--s:13.5\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z\"/><path d=\"M9 3v15M15 6v15\"/></svg><span class=\"lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">Technology roadmap</span><span class=\"lw-chip\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(6,109,173,.3);--c:#4fd0ff\">Draft</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#4fffa0\"></i>Discovery and architecture</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Q1</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:0\">Planned</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#4fd0ff\"></i>Core platform</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Q2</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:1\">Planned</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#c3a6e0\"></i>Integrations</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Q3</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(6,109,173,.3);--c:#4fd0ff;--i:2\">Sequenced</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#e8bf96\"></i>Scale and hardening</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Q4</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(255,255,255,.14);--c:#fff;--i:3\">Costed</span></div><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.14)\"><span class=\"lw-t lw-grow lw-m\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">Vision, order, cost, capacity</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:4\">Balanced</span></div></div></div></div>",
  "con-migration": "<div class=\"lw lw-con-migration\" style=\"--W:478;--H:400\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:71;--y:103.0;--w:336;--a:.1;--r:14.7\"><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pt:11.8;--pb:11.8;--pr:13.5;--pl:13.5;--g:6.8\"><svg class=\"lw-ico\" style=\"--s:13.5\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 7h13l-3-3M20 17H7l3 3\"/></svg><span class=\"lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">Legacy migration</span><span class=\"lw-chip\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(6,109,173,.3);--c:#4fd0ff\">In progress</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#4fffa0\"></i>Billing service</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Day 12</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:0\">Migrated</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#4fd0ff\"></i>Reporting jobs</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Day 19</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:1\">Migrated</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#c3a6e0\"></i>Customer data</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Day 26</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(6,109,173,.3);--c:#4fd0ff;--i:2\">Moving</span></div><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.14)\"><span class=\"lw-t lw-grow lw-m\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">Switch off old system</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(139,64,17,.3);--c:#ff9b4f;--i:3\">1 dependency left</span></div></div></div></div>",
  "con-ai": "<div class=\"lw lw-con-ai\" style=\"--W:478;--H:400\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:71;--y:103.0;--w:336;--a:.1;--r:14.7\"><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pt:11.8;--pb:11.8;--pr:13.5;--pl:13.5;--g:6.8\"><svg class=\"lw-ico\" style=\"--s:13.5\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7z\"/><path d=\"M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z\"/></svg><span class=\"lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">AI opportunities</span><span class=\"lw-chip\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(6,109,173,.3);--c:#4fd0ff\">Assessed</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#4fffa0\"></i>Support ticket triage</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">\u221230h/mo</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:0\">Worth building</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#4fd0ff\"></i>Document extraction</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">\u221218h/mo</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:1\">Worth building</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#c3a6e0\"></i>Demand forecasting</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Low gain</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(139,64,17,.3);--c:#ff9b4f;--i:2\">Not yet</span></div><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.14)\"><span class=\"lw-t lw-grow lw-m\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">Recommendation</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:3\">Build 2 of 3</span></div></div></div></div>",
  "ent-ai-team": "<div class=\"lw lw-ent-ai-team\" style=\"--W:478;--H:400\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:71;--y:103.0;--w:336;--a:.1;--r:14.7\"><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pt:11.8;--pb:11.8;--pr:13.5;--pl:13.5;--g:6.8\"><svg class=\"lw-ico\" style=\"--s:13.5\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"9\" cy=\"8\" r=\"3.5\"/><path d=\"M2.5 20c.6-3.3 3.3-5.5 6.5-5.5s5.9 2.2 6.5 5.5\"/><path d=\"M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.7.8 2.8 2.6 3 5.2\"/></svg><span class=\"lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">AI programme team</span><span class=\"lw-chip\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(6,109,173,.3);--c:#4fd0ff\">48 hours</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#4fffa0\"></i>ML Engineer</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Temporary</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:0\">Started</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#4fd0ff\"></i>Data Engineer</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Temporary</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:1\">Started</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#c3a6e0\"></i>MLOps Engineer</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Managed team</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(6,109,173,.3);--c:#4fd0ff;--i:2\">Starting</span></div><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.14)\"><span class=\"lw-t lw-grow lw-m\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">AI taken into production before</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:3\">All 3</span></div></div></div></div>",
  "del-status": "<div class=\"lw lw-del-status\" style=\"--W:478;--H:400\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:71;--y:103.0;--w:336;--a:.1;--r:14.7\"><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pt:11.8;--pb:11.8;--pr:13.5;--pl:13.5;--g:6.8\"><span class=\"lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">Delivery plan</span><span class=\"lw-chip\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0\">On track</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#4fffa0\"></i>Discovery</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Week 2</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:0\">Done</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#4fd0ff\"></i>MVP build</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Week 8</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(6,109,173,.3);--c:#4fd0ff;--i:1\">In progress</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#c3a6e0\"></i>Launch</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Week 10</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(255,255,255,.14);--c:#fff;--i:2\">Planned</span></div><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.14)\"><span class=\"lw-t lw-grow lw-m\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">Project Manager</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:3\">Accountable</span></div></div></div></div>",
  "perm-function": "<div class=\"lw lw-perm-function\" style=\"--W:478;--H:400\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:71;--y:103.0;--w:336;--a:.1;--r:14.7\"><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pt:11.8;--pb:11.8;--pr:13.5;--pl:13.5;--g:6.8\"><svg class=\"lw-ico\" style=\"--s:13.5\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z\"/><path d=\"M8.5 12l2.5 2.5 4.5-5\"/></svg><span class=\"lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">New function: Security</span><span class=\"lw-chip\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(6,109,173,.3);--c:#4fd0ff\">From zero</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#4fffa0\"></i>Head of Security</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Permanent</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:0\">Hired</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#4fd0ff\"></i>Security roadmap</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Owned</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(6,109,173,.3);--c:#4fd0ff;--i:1\">Drafting</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#c3a6e0\"></i>First team hires</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">2 roles</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(255,255,255,.14);--c:#fff;--i:2\">Next</span></div><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.14)\"><span class=\"lw-t lw-grow lw-m\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">Leads the function</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:3\">In-house</span></div></div></div></div>",
  "vc-interim-cto": "<div class=\"lw lw-vc-interim-cto\" style=\"--W:478;--H:400\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:71;--y:103.0;--w:336;--a:.1;--r:14.7\"><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pt:11.8;--pb:11.8;--pr:13.5;--pl:13.5;--g:6.8\"><svg class=\"lw-ico\" style=\"--s:13.5\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5\"/></svg><span class=\"lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">Portfolio company</span><span class=\"lw-chip\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(6,109,173,.3);--c:#4fd0ff\">48 hours</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#4fffa0\"></i>Interim CTO</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Owns architecture</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:0\">Started</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#4fd0ff\"></i>Engineering team</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">6 engineers</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:1\">Managed</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#c3a6e0\"></i>Permanent CTO search</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">In parallel</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(6,109,173,.3);--c:#4fd0ff;--i:2\">Shortlist</span></div><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.14)\"><span class=\"lw-t lw-grow lw-m\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">Company keeps building</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:3\">No pause</span></div></div></div></div>",
  "vc-tech-audit": "<div class=\"lw lw-vc-tech-audit\" style=\"--W:478;--H:400\"><div class=\"lw-stage\"><div class=\"lw-abs lw-glass lw-col\" style=\"--x:71;--y:86.2;--w:336;--a:.1;--r:14.7\"><div class=\"lw-row lw-pad\" style=\"--h:41.1;--pt:11.8;--pb:11.8;--pr:13.5;--pl:13.5;--g:6.8\"><svg class=\"lw-ico\" style=\"--s:13.5\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"M20 20l-3.5-3.5\"/></svg><span class=\"lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1\">Technical due diligence</span><span class=\"lw-chip\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0\">Exit-ready</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#4fffa0\"></i>Architecture</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Reviewed</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:0\">Ready</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#4fd0ff\"></i>Security</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Reviewed</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:1\">Ready</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#c3a6e0\"></i>Tech debt</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">2 items</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(6,109,173,.3);--c:#4fd0ff;--i:2\">Closing</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#e8bf96\"></i>Code quality</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Reviewed</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:3\">Ready</span></div><div class=\"lw-row lw-pad\" style=\"--h:37.3;--pl:13.5;--pr:13.5;--g:6.8;border-top:calc(.5*var(--u)) solid rgba(255,255,255,.08)\"><span class=\"lw-row lw-t lw-grow\" style=\"--fs:11.8;--lh:16.9;--ls:-.1;--g:6.8\"><i class=\"lw-dot\" style=\"--c:#e09ab6\"></i>Documentation</span><span class=\"lw-t lw-m\" style=\"--fs:10.2;--lh:13.5;opacity:.75\">Updated</span><span class=\"lw-chip\" data-fx=\"pop\" style=\"--fs:10.2;--px:6.8;--py:3.4;--r:8.5;--bg:rgba(4,144,70,.3);--c:#4fffa0;--i:4\">Ready</span></div></div></div></div>"
};
/* Hero chat (skills-hero-chat) on /hire/* pages: the typed request and the
   three matched roles follow the page (client 14 Nov), e.g. Hire Jest
   Developers types a test-automation request and returns test engineers.
   Pages not listed keep the default React request. The typing runs over a
   fixed width, so the step count is set from the real text width to keep one
   character per step. */
var LW_CHAT_PAGES = {
  "frontend-engineers": ["Senior frontend engineer, React, UK time", ["Senior Frontend Engineer", "Lead Frontend Engineer", "Frontend Engineer"]],
  "back-end-engineers": ["Senior backend engineer, Node.js, UK time", ["Senior Backend Engineer", "Lead Backend Engineer", "Backend Engineer"]],
  "fractional-ctos": ["Fractional CTO, two days a week", ["Fractional CTO", "Interim CTO", "Fractional CTO"]],
  "python-developers": ["Senior Python engineer, Django, UK time", ["Senior Python Engineer", "Lead Python Engineer", "Python Engineer"]],
  "react-developers": ["Senior React engineer, TypeScript, UK time", ["Senior React Engineer", "Lead React Engineer", "React Engineer"]],
  "java-developers": ["Senior Java engineer, Spring Boot, UK time", ["Senior Java Engineer", "Lead Java Engineer", "Java Engineer"]],
  "fintech-developers": ["Senior fintech engineer, payments, UK time", ["Senior Fintech Engineer", "Payments Engineer", "Backend Engineer"]],
  "healthtech-medtech-developers": ["Senior healthtech engineer, UK time", ["Senior Healthtech Engineer", "Medtech Software Engineer", "Full-Stack Engineer"]],
  "e-commerce-developers": ["Senior e-commerce engineer, Shopify", ["Senior E-commerce Engineer", "Shopify Developer", "Full-Stack Engineer"]],
  "by-product-outcome": ["A team to ship our new product feature", ["Product Engineer", "Senior Full-Stack Engineer", "Product Designer"]],
  "mvp-development-team": ["MVP team: PM, two engineers, a designer", ["Delivery Manager", "Senior Full-Stack Engineer", "Product Designer"]],
  "web-app-development-team": ["Web app team, React and Node.js", ["Senior Frontend Engineer", "Senior Backend Engineer", "Product Designer"]],
  "mobile-app-development-team": ["Mobile app team, iOS and Android", ["Senior iOS Engineer", "Senior Android Engineer", "React Native Engineer"]],
  "ruby-on-rails-developers": ["Senior Ruby on Rails developer, UK time", ["Senior Rails Developer", "Lead Ruby Engineer", "Ruby on Rails Developer"]],
  "angular-developers": ["Senior Angular developer, TypeScript", ["Senior Angular Developer", "Lead Frontend Engineer", "Angular Developer"]],
  "unity-developers": ["Senior Unity developer, C#, UK time", ["Senior Unity Developer", "Unity Game Developer", "C# Developer"]],
  "django-developers": ["Senior Django developer, Python, UK time", ["Senior Django Developer", "Lead Python Engineer", "Django Developer"]],
  "xcode-developers": ["Senior iOS developer, Swift and Xcode", ["Senior iOS Developer", "Swift Developer", "iOS Engineer"]],
  "php-developers": ["Senior PHP developer, Laravel, UK time", ["Senior PHP Developer", "Laravel Developer", "PHP Developer"]],
  "jest-developers": ["Senior test engineer, Jest, TypeScript", ["Senior Test Automation Engineer", "QA Automation Engineer", "Frontend Engineer"]],
  "vercel-developers": ["Senior Next.js developer, Vercel, UK time", ["Senior Next.js Developer", "Frontend Engineer", "Full-Stack Developer"]],
  "ai-ml-engineers": ["Senior ML engineer, Python, LLMs", ["Senior ML Engineer", "AI Engineer", "Data Scientist"]]
};
/* Client, 16 Nov 2026: every hire page shows its own three people (name,
   initials, rate), so the same person never appears with a different role on
   another page. Three names per page, in the order of LW_CHAT_PAGES. Rates
   stay between 38 and 73 pounds an hour. */
var LW_CHAT_PEOPLE = "Amelia F.|Noah G.|Isla P.|George N.|Chloe D.|Harry V.|Zara I.|Jack E.|Poppy S.|Alfie C.|Ruby H.|Charlie Y.|Evie B.|Archie T.|Florence K.|Freddie O.|Lily A.|Henry J.|Rosie M.|Theo W.|Phoebe L.|Edward R.|Matilda G.|Finlay D.|Esme N.|Lewis P.|Martha S.|Reuben C.|Clara V.|Dylan F.|Ivy T.|Rhys B.|Layla H.|Connor E.|Nia J.|Joel K.|Anya M.|Hugo A.|Priya N.|Mateo L.|Yusuf O.|Ingrid S.|Kofi A.|Mei L.|Lukas B.|Amara D.|Tariq H.|Elena V.|Sanjay R.|Chiara P.|Jonas W.|Fatima Z.|Andrei C.|Naomi E.|Declan O.|Saoirse K.|Euan M.|Iona F.|Gethin L.|Carys T.|Angus R.|Fiona G.|Callan S.|Tessa Y.|Bram J.|Lena Q.".split("|");
function lwChatForPage(layer) {
  var m = location.pathname.match(/^\/hire\/([^\/]+)/), cfg = m && LW_CHAT_PAGES[m[1]];
  if (!cfg) return;
  var ty = layer.querySelector(".ty");
  if (ty) ty.textContent = cfg[0];
  [].slice.call(layer.querySelectorAll(".rl")).forEach(function (rl, i) {
    var role = cfg[1][i];
    if (!role) return;
    [].some.call(rl.childNodes, function (n) {
      if (n.nodeType === 3 && n.nodeValue.trim()) { n.nodeValue = role; return true; }
      return false;
    });
  });
  var idx = Object.keys(LW_CHAT_PAGES).indexOf(m[1]);
  [].slice.call(layer.querySelectorAll(".rl")).forEach(function (rl, i) {
    var role = cfg[1][i] || rl.textContent;
    var p = LW_CHAT_PEOPLE[idx * 3 + i], rw = rl.closest(".rw") || rl.parentNode.parentNode;
    if (!p || !rw) return;
    var av = rw.querySelector(".lw-av"), nm = rw.querySelector(".nm");
    if (av) av.textContent = p.charAt(0) + p.charAt(p.indexOf(" ") + 1);
    if (nm) [].some.call(nm.childNodes, function (n) {
      if (n.nodeType === 3 && n.nodeValue.trim()) { n.nodeValue = p; return true; }
      return false;
    });
    /* Rate follows the level in the role (client 25 Nov: a Senior at £38 next
       to a mid-level engineer at £60 read wrong): Lead/Principal/Head/Staff/CTO/Architect
       £63-74, Senior £51-62, others £38-49. */
    var lv = /\b(lead|principal|head|staff|cto|architect|director)\b/i.test(role || "") ? 2 : /\bsenior\b/i.test(role || "") ? 1 : 0;
    var rate = [38, 51, 63][lv] + ((idx * 7 + i * 5) % 12);
    var w = document.createTreeWalker(rw, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) if (/\u00a3\d/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/\u00a3[\d.,]+/, "\u00a3" + rate);
  });
  if (ty) requestAnimationFrame(function () {
    var lw = layer.querySelector(".lw"), u = lw ? lw.getBoundingClientRect().width / 402 : 0;
    var w = ty.scrollWidth;
    if (u > 0 && w > 0) ty.style.animationTimingFunction = "steps(" + Math.max(8, Math.round(cfg[0].length * 250 * u / w)) + ")";
  });
}
/* Some slots reuse a picture whose UI does not fit their copy, so the step
   title picks the widget instead (client comments, Nov 2026):
   - Slider [Dark] "Engagement" and "Reporting" steps: workload setup and
     hours approval, not an interview and a team invite;
   - Sell your agency (acquisitions): its own deal widgets instead of the
     hiring ones, in the "What we offer" slider and the process steps. */
/* Situation blocks on Solutions pages (Stages [Sticky], client 14 Nov: the
   Startups "Growth stages" structure on every Solutions page). The picture of
   each situation is picked by page and step number; the step images set in
   the Designer are only the no-script fallback. */
var LW_STAGE_KEYS = {
  "/solutions/consulting": ["con-roadmap", "con-migration", "ways-consulting", "con-ai"],
  "/solutions/enterprises": ["startups-scale", "ent-ai-team", "bento-interim-2", "compliance"],
  "/solutions/agencies": ["delivery-estimate", "why-adaptive", "startups-foundations", "delivery-scope"],
  "/solutions/delivery-teams": ["startups-validate", "delivery-scope", "del-status", "delivery-estimate"],
  "/solutions/permanent-executive": ["startups-pmf", "perm-function", "jobs-why-seniority", "ways-permanent"],
  "/solutions/vc-private-equity": ["startups-pmf", "con-migration", "vc-interim-cto", "vc-tech-audit"],
  "/solutions/interim-technology-talent": ["ways-temporary", "startups-foundations", "delivery-estimate", "why-adaptive"]
};
/* Vetting funnel (How we vet, Find a job pages): the step pictures were
   numbered for the old step order, so Compliance check showed the CV review.
   The funnel picks its widget by step title instead (client 14 Nov). */
var LW_FUNNEL_KEYS = [[/^Compliance/i, "compliance"], [/^Field experience/i, "vet-1"], [/^Technology skills/i, "vet-3"], [/^Human skills/i, "bento-hiw-4"], [/^Stage fit/i, "vet-2"]];
function lwStageKey(img) {
  var grid = img.closest("[data-stages]");
  if (!grid) return null;
  var n = img.getAttribute("data-process-image");
  if (n === null) { var st = img.closest("[data-process-step]"); n = st && st.getAttribute("data-process-step"); }
  var map = LW_STAGE_KEYS[location.pathname.replace(/\/$/, "")];
  if (map) return map[+n] || null;
  var step = grid.querySelector('[data-process-step="' + (+n) + '"] h3');
  var title = step ? step.textContent.trim() : "";
  for (var i = 0; i < LW_FUNNEL_KEYS.length; i++) if (LW_FUNNEL_KEYS[i][0].test(title)) return LW_FUNNEL_KEYS[i][1];
  return null;
}
function lwKeyByContext(img) {
  var stk = lwStageKey(img);
  if (stk) return stk;
  var sell = /^\/sell-your-agency/.test(location.pathname);
  var slide = img.closest(".div-step-slide");
  if (slide) {
    var t = slide.textContent.replace(/\s+/g, " ").trim().replace(/^\d+\s*/, "");
    var S = [[/^Engagement/i, "engagement-setup"], [/^Reporting/i, "time-tracking"],
      /* Delivery teams slider: scope and estimate steps had the extra-hours
         and hour-cap widgets of interim hiring. */
      [/^Scope/i, "delivery-scope"], [/^Estimate/i, "delivery-estimate"], [/^Hour Tracking/i, "bento-interim-3"]];
    if (sell) S = S.concat([[/^Flexible purchase/i, "acq-structure"], [/^Competitive valuation/i, "acq-diligence"], [/^Quick transaction/i, "acq-timeline"], [/^Seamless transition/i, "acq-transition"]]);
    for (var i = 0; i < S.length; i++) if (S[i][0].test(t)) return S[i][1];
    return sell ? "acq-structure" : null;
  }
  /* Process [Sticky] steps (client 14 Nov): the same title rules as the
     home slider, so hire pages show workload setup for Engagement and hours
     approval for Reporting instead of the team invite and the interview.
     The talent "offer" picture (welcome card) is not site content, so the
     offer step shows the How we vet stage-fit visual (IR35, verified). */
  if (!sell) {
    var sec = img.closest("section"), pr = sec && sec.querySelector("[data-process]:not(.is-stages)");
    var own = lwKeyFromSrc(img.getAttribute("src"));
    if (pr && own === "offer") return "vet-5";
    if (pr && (own === "engagement" || own === "interview")) {
      var k = +(img.getAttribute("data-process-image") || (img.closest("[data-process-image]") || {getAttribute: function () { return 0; }}).getAttribute("data-process-image") || 0);
      var stp = pr.querySelectorAll("[data-process-step]")[k], hd = stp && stp.querySelector("h3");
      var ht = hd ? hd.textContent.trim() : "";
      if (/^Engagement/i.test(ht)) return "engagement-setup";
      if (/^Reporting/i.test(ht)) return "time-tracking";
    }
  }
  var proc = sell && img.closest("[data-process]");
  if (proc) {
    var n = +img.getAttribute("data-process-image") || +(img.closest("[data-process-image]") || {getAttribute: function () { return 0; }}).getAttribute("data-process-image");
    var steps = proc.querySelectorAll("[data-process-step]");
    var st = (steps[n] || {}).textContent || "";
    if (/Introduction/i.test(st)) return "acq-intro";
    if (/Diligence/i.test(st)) return "acq-diligence";
    if (/Offer/i.test(st)) return "acq-offer";
    if (/Completion|Handover/i.test(st)) return "acq-transition";
    return "acq-timeline";
  }
  return null;
}
function lwKeyFromSrc(src) {
  var f = decodeURIComponent((src || "").split("?")[0].split("/").pop() || "").replace(/^[0-9a-f]{24}_/, "");
  var m = f.match(/^startups-stage-([a-z]+)-t@3x/);
  if (m) return "startups-" + m[1];
  m = f.match(/^vet-stage-(\d)-t@3x/);
  if (m) return "vet-" + m[1];
  /* Jobs template process steps use their own image files but show the same
     four steps as Find Jobs (profile, vetting, matching, offer) */
  m = f.match(/^process-jobs-([1-4])-3x/);
  if (m) return ["register-profile", "vetting", "matching-2", "vet-5"][m[1] - 1];
  /* ill-request@3x.webp -> request, why-fast-t@3x.webp -> why-fast, bento-hiw-2-3x.webp -> bento-hiw-2 */
  return f.replace(/\.(webp|png|jpe?g|avif)$/, "").replace(/(-t)?(@[23]x|-3x)$/, "").replace(/^ill-/, "") || null;
}
function initLiveWidgets() {
  if (!Object.keys(LW_TEMPLATES).length) return;
  var fine = window.matchMedia && matchMedia("(hover:hover) and (pointer:fine)").matches && !PREFERS_STILL;
  var imgs = [].slice.call(document.querySelectorAll("img[src]"));
  var todo = [];
  imgs.forEach(function (img) {
    var key = lwKeyByContext(img) || lwKeyFromSrc(img.getAttribute("src"));
    if (key && LW_TEMPLATES[key] && !img.__lw) { img.__lw = 1; todo.push({ img: img, key: key }); }
  });
  if (!todo.length) return;

  /* The layer covers the image box. When the image is object-fit:cover and
     its box has another ratio than the widget frame, the layer is scaled the
     same way and clipped to the box, so the widget sits where the picture was. */
  function place(layer, img) {
    var bw = img.offsetWidth, bh = img.offsetHeight, W = layer.__W, H = layer.__H;
    var w = bw, h = bh, dx = 0, dy = 0;
    if (W && H && bw && bh && Math.abs(bw / bh - W / H) > 0.01 && getComputedStyle(img).objectFit === "cover") {
      var k = Math.max(bw / W, bh / H);
      /* data-lw-safe="N": the centre N frame px must stay in view (narrow
         phones), so the widget is scaled down instead of cropped there. Its
         background is transparent, so the gap shows the media box behind. */
      if (layer.__safe) k = Math.min(k, bw / layer.__safe);
      var op = getComputedStyle(img).objectPosition.split(" ");
      var px = /%$/.test(op[0]) ? parseFloat(op[0]) / 100 : 0.5, py = /%$/.test(op[1] || "") ? parseFloat(op[1]) / 100 : 0.5;
      w = W * k; h = H * k; dx = (bw - w) * px; dy = (bh - h) * py;
    }
    /* offsetLeft/Top ignore transforms; add the image's own translate
       (e.g. translateX(-50%) on the technology hero chat). */
    var tx = 0, ty = 0, tf = getComputedStyle(img).transform;
    if (tf && tf !== "none" && window.DOMMatrixReadOnly) {
      var mx = new DOMMatrixReadOnly(tf);
      tx = mx.m41; ty = mx.m42;
    }
    layer.style.left = img.offsetLeft + tx + dx + "px";
    layer.style.top = img.offsetTop + ty + dy + "px";
    layer.style.width = w + "px";
    layer.style.height = h + "px";
    /* Clip back to the image box: crop is -dx on the left and w-bw+dx on the
       right (unequal when object-position is not centred), same vertically. */
    layer.style.clipPath = dx || dy ? "inset(" + -dy + "px " + (w - bw + dx) + "px " + (h - bh + dy) + "px " + -dx + "px round " + (getComputedStyle(img).borderTopLeftRadius || "0px") + ")" : "";
    /* Live glow behind the widget where its box would otherwise show the
       static gradient (phones: the stage pictures of the process blocks,
       which have no sticky glow panel behind them). One shared renderer
       draws every glow, so extra glows cost no WebGL contexts. */
    if (window.ytGlow && !layer.__gl && /gradient/.test(getComputedStyle(layer).backgroundImage)) {
      layer.__gl = document.createElement("div");
      layer.__gl.className = "lw-glow-slot";
      layer.__gl.setAttribute("aria-hidden", "true");
      layer.parentNode.insertBefore(layer.__gl, layer);
      layer.classList.add("has-glow");
      window.ytGlow(layer.__gl);
    }
    if (layer.__gl) {
      var gs = layer.__gl.style;
      gs.left = img.offsetLeft + tx + "px";
      gs.top = img.offsetTop + ty + "px";
      gs.width = bw + "px";
      gs.height = bh + "px";
      gs.borderRadius = getComputedStyle(img).borderTopLeftRadius || "0px";
    }
  }
  function count(el) {
    if (el.__run) return;
    el.__run = 1;
    var to = +el.getAttribute("data-lw-count"), from = +(el.getAttribute("data-lw-from") || to - 10), t0 = performance.now();
    (function tick(t) {
      var k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(tick); else el.__run = 0;
    })(t0);
  }
  function mount(item) {
    var img = item.img, host = img.parentElement;
    if (!host) return;
    /* No position change on the host: the layer sits next to the image and
       shares its containing block, so offsetLeft/Top line up. Making the host
       relative would move absolutely positioned images (bento cards). */
    var layer = document.createElement("div");
    layer.className = "lw-host";
    layer.setAttribute("aria-hidden", "true");
    layer.setAttribute("data-nosnippet", "");
    layer.style.position = "absolute";
    /* Some media boxes (e.g. .hiw-card-visual) set pointer-events:none; the
       layer must still receive the hover. */
    layer.style.pointerEvents = "auto";
    layer.innerHTML = LW_TEMPLATES[item.key];
    if (item.key === "skills-hero-chat") lwChatForPage(layer);
    /* Profile step widget (Find jobs, job pages): the platform screen was the
       partner one (team expertise); for engineers it speaks to them. Partner
       pages keep the team wording. */
    if (item.key === "register-profile" && !/^\/(for-partners|sell-your-agency|partners)/.test(location.pathname)) {
      layer.innerHTML = layer.innerHTML.replace("Team Expertise &amp; Tech Stack", "Your Expertise &amp; Tech Stack").replace("Choose the key expertise and technologies your team specializes in.", "Choose your roles and the technologies you work with best.");
    }
    /* Right after the image, so content that follows it in the box (hero
       text, buttons) still paints above the layer. */
    img.insertAdjacentElement("afterend", layer);
    /* Same stacking level as the picture it replaces (hero shades, text and
       buttons that sit above the photo stay above the layer too). */
    var zi = getComputedStyle(img).zIndex;
    layer.style.zIndex = zi === "auto" ? "0" : zi;
    var lw0 = layer.querySelector(".lw");
    /* lw-keep: the photo stays visible and the layer only adds UI over it
       (hero cards); it never takes pointer events or plays the entrance.
       It goes above the hero shade (the absolute layers right after the
       photo), as in Figma, and stays under the hero text. */
    var keep = lw0 && lw0.classList.contains("lw-keep");
    if (keep) {
      layer.style.pointerEvents = "none";
      var sib = layer.nextElementSibling, last = null;
      while (sib && getComputedStyle(sib).position === "absolute") { last = sib; sib = sib.nextElementSibling; }
      if (last) {
        last.insertAdjacentElement("afterend", layer);
        var zs = getComputedStyle(last).zIndex;
        if (zs !== "auto") layer.style.zIndex = zs;
      }
    }
    if (lw0) {
      var cs0 = getComputedStyle(lw0);
      layer.__W = parseFloat(cs0.getPropertyValue("--W"));
      layer.__H = parseFloat(cs0.getPropertyValue("--H"));
      layer.__safe = parseFloat(lw0.getAttribute("data-lw-safe")) || 0;
    }
    place(layer, img);
    if (!keep) img.classList.add("lw-src");
    var lw = layer.querySelector(".lw");
    /* lw-loop (hero widgets that loop, e.g. vs-hero-visual): no entrance, the
       widget is simply there from the first frame and its loop runs. */
    if (lw && !keep && !lw.classList.contains("lw-loop") && !PREFERS_STILL && "IntersectionObserver" in window) {
      lw.classList.add("lw-anim");
      var seen = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        seen.disconnect();
        requestAnimationFrame(function () {
          lw.classList.add("is-in");
          setTimeout(function () { lw.classList.add("is-done"); }, 1400);
        });
      }, { threshold: 0.35 });
      seen.observe(layer);
    }
    if ("ResizeObserver" in window) new ResizeObserver(function () { place(layer, img); }).observe(img);
    /* Scroll-driven stacks (section 29): the layer follows its image's
       is-active state, so only the current step's widget shows. */
    if (img.hasAttribute("data-process-image")) {
      /* Client batch 25-26 Nov (lag on step switch): the widgets are see-through
         glass, so a cross-fade showed both at half strength on top of each
         other. The old widget now leaves quickly and the new one comes in
         right after it, above it. */
      var sync = function () {
        var on = img.classList.contains("is-active");
        layer.style.transition = on ? "opacity .38s cubic-bezier(.22,1,.36,1) .14s" : "opacity .16s ease";
        layer.style.zIndex = on ? "2" : "1";
        layer.style.opacity = on ? "" : "0";
        layer.style.pointerEvents = on ? "auto" : "none";
      };
      sync();
      new MutationObserver(sync).observe(img, { attributes: true, attributeFilter: ["class"] });
    }
    if (!fine) return;
    var counters = [].slice.call(layer.querySelectorAll("[data-lw-count]"));
    if (counters.length) host.addEventListener("pointerenter", function () { counters.forEach(count); });
  }
  if (!("IntersectionObserver" in window)) { todo.forEach(mount); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      todo.forEach(function (it) { if (it.img === e.target) mount(it); });
    });
  }, { rootMargin: "400px 0px" });
  todo.forEach(function (it) { io.observe(it.img); });
}

var TALENT_RATE = { cur: 0, items: [], open: null, bound: false };
function initTalentRate(root) {
  /* Talent cards (Technologies template, Rate Calculator): the hourly rate
     can be shown per hour, day, month or year, as on app.yotewo.com profiles
     (8 h day, 160 h month, 1920 h year). One period for every card on the
     page, also for cards added later (pass their root); the figure counts to
     the new value and the unit crossfades. */
  var rates = [].slice.call((root || document).querySelectorAll(".div-talent-rate")).filter(function (r) {
    return !r.querySelector(".talent-rate-sw");
  });
  if (!rates.length) return;
  var S = TALENT_RATE;
  var P = [
    { label: "Hourly", unit: "/ h", m: 1 },
    { label: "Daily", unit: "/ d", m: 8 },
    { label: "Monthly", unit: "/ mo", m: 160 },
    { label: "Yearly", unit: "/ yr", m: 1920 }
  ];
  var ICON = '<svg width="16" height="22" viewBox="0 0 16 22" fill="none" aria-hidden="true"><rect class="tr-bg" width="16" height="22" rx="6"/><path d="M10.75 13 8 15.75 5.25 13M5.25 9 8 6.25 10.75 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var TICK = '<svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.167 10.417 8.333 14.583 16.667 5.417" stroke="#006bff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  /* job cards carry a min to max range (two figures); from 1,000 up both
     values are shortened to "k" so the range fits on one line of the card */
  function fmt(v, short) {
    if (short) return v >= 100000 ? Math.round(v / 1000) + "k" : (Math.round(v / 100) / 10) + "k";
    return Math.round(v).toLocaleString("en-GB");
  }
  /* Period switch (client, Nov 2026): no counting. Counting from 58 to
     111,360 changed the width on every frame and the card text jumped. The
     figure and its unit now leave together (fade + short lift), swap while
     hidden and come back in one move. */
  function swapOut(it, done) {
    var els = it.nums.map(function (n) { return n.el; }).concat(it.unit ? [it.unit] : []);
    if (PREFERS_STILL || !els[0].animate) { done(); return; }
    var box = it.nums[0].el.parentNode;
    box.style.minWidth = box.offsetWidth + "px";
    var a = null;
    els.forEach(function (el) {
      a = el.animate([{ opacity: 1, transform: "none", filter: "blur(0)" }, { opacity: 0, transform: "translateY(-.25em)", filter: "blur(3px)" }], { duration: 160, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" });
    });
    a.onfinish = function () {
      done();
      box.style.minWidth = "";
      els.forEach(function (el) {
        el.getAnimations().forEach(function (x) { x.cancel(); });
        el.animate([{ opacity: 0, transform: "translateY(.25em)", filter: "blur(3px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: 260, easing: "cubic-bezier(0,0,.2,1)" });
      });
    };
  }
  function render(animate, list) {
    (list || S.items).forEach(function (it) {
      var m = P[S.cur].m;
      var short = it.nums.length > 1 && it.nums[it.nums.length - 1].base * m >= 1000;
      function apply() {
        if (it.label) it.label.textContent = P[S.cur].label + " rate";
        it.nums.forEach(function (n) { n.shown = n.base * m; n.el.textContent = fmt(n.shown, short); });
        if (it.unit) it.unit.textContent = P[S.cur].unit;
      }
      if (animate) swapOut(it, apply); else apply();
      it.menu.querySelectorAll("button").forEach(function (b, i) {
        b.classList.toggle("is-selected", i === S.cur);
        b.setAttribute("aria-checked", i === S.cur ? "true" : "false");
      });
    });
  }
  function close() {
    if (!S.open) return;
    S.open.wrap.classList.remove("is-open");
    S.open.btn.setAttribute("aria-expanded", "false");
    S.open = null;
  }
  var added = [];
  S.render = render;
  rates.forEach(function (rate) {
    var els = [].slice.call(rate.querySelectorAll("[data-prefix]"));
    if (!els.length && rate.firstElementChild) els = [rate.firstElementChild];
    var nums = [];
    els.forEach(function (el) {
      var b = parseFloat((el.textContent || "").replace(/[^\d.]/g, ""));
      if (!isFinite(b)) return;
      el.classList.add("talent-rate_num");
      nums.push({ el: el, base: b, shown: b, raf: 0 });
    });
    if (!nums.length) return;
    var num = nums[0].el;
    var unit = els[els.length - 1].nextElementSibling;
    if (unit) unit.classList.add("talent-rate_unit");
    var wrap = document.createElement("div");
    wrap.className = "talent-rate-sw";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "talent-rate-sw_btn";
    btn.setAttribute("aria-label", "Rate period");
    btn.setAttribute("aria-haspopup", "menu");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = ICON;
    var menu = document.createElement("div");
    menu.className = "talent-rate-sw_menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = P.map(function (p, i) {
      return '<button type="button" role="menuitemradio" data-i="' + i + '"><span>' + p.label + "</span>" + TICK + "</button>";
    }).join("");
    wrap.appendChild(btn);
    wrap.appendChild(menu);
    rate.appendChild(wrap);
    /* the "Hourly rate" caption above the figure follows the period too */
    var cap = rate.previousElementSibling;
    if (!cap || !/^\s*hourly rate\s*$/i.test(cap.textContent)) cap = null;
    var it = { num: num, nums: nums, unit: unit, label: cap, menu: menu, wrap: wrap, btn: btn };
    S.items.push(it);
    added.push(it);
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var was = S.open === it;
      close();
      if (!was) {
        wrap.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        S.open = it;
        /* Client, Nov 2026: on narrow job cards the menu ran past the card's
           right edge. It opens to the right of the button by default and
           flips to align with the button's right edge when there is no room. */
        wrap.classList.remove("is-flip");
        var card = wrap.closest(".div-talent-card, .div-job-card, .w-dyn-item, [class*='card']") || document.body;
        var cr = card.getBoundingClientRect(), mr = menu.getBoundingClientRect();
        if (mr.right > Math.min(cr.right, window.innerWidth) - 8) wrap.classList.add("is-flip");
      }
    });
    menu.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-i]");
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      var i = +b.getAttribute("data-i");
      close();
      if (i === S.cur) return;
      S.cur = i;
      S.items = S.items.filter(function (x) { return document.contains(x.num); });
      render(true);
    });
  });
  if (!S.bound) {
    S.bound = true;
    document.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }
  render(false, added);
}

function initRoleLinks() {
  /* Find Jobs, Browse jobs by role: each link goes to its Jobs page
     (/jobs/<slug>). The CMS link may come out empty or unresolved, so the
     slug from data-role-slug sets the address. */
  var here = (location.pathname.match(/^\/jobs\/([^\/?#]+)/) || [])[1];
  document.querySelectorAll("a[data-role-slug]").forEach(function (a) {
    var slug = (a.getAttribute("data-role-slug") || "").trim();
    var href = a.getAttribute("href") || "";
    if (slug && !/^\/jobs\//.test(href)) a.setAttribute("href", "/jobs/" + slug);
    /* on a role page (Jobs template) the role itself is left out */
    if (here && slug === here) (a.closest(".w-dyn-item") || a).style.display = "none";
  });
}

function initTalentDesc(root) {
  /* 15 Nov 2026: the card button now reads "View talent" (yotewo.css). */
  (root || document).querySelectorAll('.div-talent-add[aria-label="Add candidate"]').forEach(function (a) {
    a.setAttribute("aria-label", "View talent on the Yotewo platform");
  });
  /* Talent and job cards: the summary shows two lines and ends with an
     ellipsis. Hovering it (or tapping on touch screens) shows the full text in
     a tooltip. Client, Nov 2026: the tooltip used to live inside the card and
     was cut by the slider and grid edges, and cards measured while hidden (in
     a closed tab or slide) never got one. Now whether the text is cut is
     checked at hover time, and the tooltip is one fixed layer on the body,
     placed under the text (or above it near the bottom of the screen). */
  var TIP = initTalentDesc.tip;
  if (!TIP) {
    TIP = initTalentDesc.tip = document.createElement("div");
    TIP.setAttribute("role", "tooltip");
    TIP.style.cssText = "position:fixed;z-index:2147483000;left:0;top:0;max-width:22rem;padding:.5rem .625rem;border-radius:.5rem;background:#0b0c0e;color:rgba(255,255,255,.9);font-size:.75rem;line-height:1.45;box-shadow:0 .5rem 1.5rem rgba(11,12,14,.2);pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .16s ease,transform .2s cubic-bezier(.2,.7,.2,1);visibility:hidden";
    document.body.appendChild(TIP);
    var hide = function () { TIP.style.opacity = "0"; TIP.style.transform = "translateY(4px)"; TIP.style.visibility = "hidden"; TIP.__for = null; };
    initTalentDesc.hide = hide;
    window.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("resize", hide);
    document.addEventListener("click", hide);
  }
  function cut(el) {
    var t = el.querySelector(".talent-desc_t");
    return t && t.scrollHeight > t.clientHeight + 1;
  }
  function show(el) {
    if (!cut(el)) return;
    el.classList.add("is-clamped");
    TIP.textContent = el.__full;
    var r = el.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    TIP.style.width = Math.min(r.width - 8, 352) + "px";
    TIP.style.visibility = "hidden";
    TIP.style.opacity = "0";
    var h = TIP.offsetHeight, left = Math.max(8, Math.min(r.left + 4, vw - TIP.offsetWidth - 8));
    var top = r.bottom + 6;
    if (top + h > vh - 8) top = r.top - h - 6;
    TIP.style.left = left + "px";
    TIP.style.top = Math.max(8, top) + "px";
    TIP.style.visibility = "visible";
    TIP.style.opacity = "1";
    TIP.style.transform = "none";
    TIP.__for = el;
  }
  (root || document).querySelectorAll("[data-talent-desc]").forEach(function (el) {
    if (el.classList.contains("w-dyn-bind-empty") || !el.textContent.trim() || el.querySelector(".talent-desc_t")) return;
    var full = el.textContent.trim();
    var t = document.createElement("span");
    t.className = "talent-desc_t";
    t.textContent = full;
    el.textContent = "";
    el.appendChild(t);
    el.__full = full;
    el.setAttribute("tabindex", "0");
    el.addEventListener("pointerenter", function (e) { if (e.pointerType !== "touch") show(el); });
    el.addEventListener("pointerleave", function () { initTalentDesc.hide(); });
    el.addEventListener("focus", function () { show(el); });
    el.addEventListener("blur", function () { initTalentDesc.hide(); });
    el.addEventListener("click", function (e) {
      e.stopPropagation();
      /* The description sits above the card-wide platform link (it needs
         hover for the tooltip). With a mouse a click on it opens the
         platform like the rest of the card; on touch it toggles the
         tooltip, since there is no hover. */
      var card = el.closest(".div-talent-card");
      var go = card && card.querySelector(".div-talent-add[href]");
      if (go && window.matchMedia && window.matchMedia("(hover: hover)").matches) {
        initTalentDesc.hide();
        go.click();
        return;
      }
      if (TIP.__for === el) initTalentDesc.hide(); else show(el);
    });
  });
}

function initRcTalent() {
  /* Rate Calculator: under the calculator, the developers available for the
     selected role: the native talent section of a hire page (HP_SHELL) with
     the hub's cards for that role (hpCards "role:"), loaded on demand and swapped
     with a short crossfade when the skill changes. */
  var mount = document.querySelector("[data-rc-talent]");
  var chips = [].slice.call(document.querySelectorAll("[data-rc-chip]"));
  if (!mount || !chips.length || !window.fetch || !window.DOMParser) return;
  var cache = {}, token = 0;
  function get(name) {
    if (!cache[name]) {
      /* Chips are Rate Benchmarks roles: match the hub cards' hidden role list. */
      var esc = name.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
      var core = name.replace(/\s+(developer|engineer)s?$/i, "").replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&").replace(/[-\s]+/g, "[- ]?");
      cache[name] = Promise.all([hpDoc(HP_SHELL), hpCards("role:^" + esc + "$||\\b" + core + "\\b", true)]).then(function (r) {
        var shell = r[0] && r[0].querySelector(".section.is-dark-talent");
        var grid = shell && shell.querySelector(".grid-talent-cards");
        if (!grid) return null;
        shell = shell.cloneNode(true);
        /* Logo row belongs to the hire page, not the calculator. */
        shell.querySelectorAll(".is-wings,.div-brands-row-wrap").forEach(function (el) { el.remove(); });
        grid = shell.querySelector(".grid-talent-cards");
        grid.innerHTML = "";
        r[1].forEach(function (c) { grid.appendChild(c); });
        if (!r[1].length) {
          grid.appendChild(ytEmpty("talent", { dark: true }));
          var more = shell.querySelector(".div-talent-more");
          if (more) more.remove();
        }
        var h2 = shell.querySelector(".div-talent-head h2");
        if (h2) h2.textContent = name + (/s$/i.test(name) ? "" : "s") + " available now";
        return shell;
      });
    }
    return cache[name];
  }
  function show(href) {
    var my = ++token;
    get(href).then(function (src) {
      if (my !== token) return;
      var old = mount.firstElementChild;
      if (!src) {
        if (old) { mount.classList.add("is-swapping"); setTimeout(function () { if (my === token) { mount.innerHTML = ""; mount.classList.remove("is-swapping"); } }, 220); }
        return;
      }
      var sec = src.cloneNode(true);
      var put = function () {
        if (my !== token) return;
        mount.style.minHeight = old ? mount.offsetHeight + "px" : "";
        mount.innerHTML = "";
        mount.appendChild(sec);
        ytChipFade(sec);
        if (window.BgFx) window.BgFx.init(sec);
        /* Same button motion as the rest of the site ("Log in to see more"). */
        if (window.ytBtnRoll) window.ytBtnRoll();
        initTalentRate(sec);
        initTalentDesc(sec);
        requestAnimationFrame(function () {
          mount.classList.remove("is-swapping");
          setTimeout(function () { mount.style.minHeight = ""; }, 300);
        });
      };
      if (old) { mount.classList.add("is-swapping"); setTimeout(put, 220); }
      else { mount.classList.add("is-swapping"); put(); }
    });
  }
  chips.forEach(function (c) {
    c.addEventListener("click", function () { show(c.textContent.trim()); });
  });
  var first = chips.filter(function (c) { return c.getAttribute("aria-pressed") === "true"; })[0] || chips[0];
  var start = function () { show(first.textContent.trim()); };
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      start();
    }, { rootMargin: "800px 0px" });
    io.observe(mount);
  } else start();
}


/* Hire pages (CMS template /hire/{slug}, Nov 2026).
   The talent section is native on the template (heading and text bound to
   the CMS). [data-hp-talent] (CMS "Talent filter") picks the cards from the
   hub's candidates (HP_HUB), available first, max 8:
     "skills:<re>"  a skill chip matches
     "level:<re>"   the seniority matches
     "text:<re>"    anything on the card matches (summary included)
   No match falls back to the first 8. HP_SHELL is any hire page: the Rate
   Calculator borrows its native talent section.
   [data-hp-related] = "Hire X|Hire Y|..." from the CMS; rendered as chips,
   linked when a hire page with that name exists (HP_LINKS), under the doc's
   "Related skills" label.
   Empty FAQ rows (items with fewer than 5 questions) are removed before the
   accordion is set up. */
var HP_SHELL = "/hire/frontend-engineers";
var HP_DOCS = {};
function hpDoc(href) {
  if (!HP_DOCS[href]) {
    HP_DOCS[href] = fetch(href, { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (html) { return html ? new DOMParser().parseFromString(html, "text/html") : null; })
      .catch(function () { return null; });
  }
  return HP_DOCS[href];
}
function hpCards(src, fill) {
  /* "role:<re>||<re2>": role mode, with <re2> tested on the whole card when
     the hub cards carry no role names (the synced Roles field is empty). */
  var alt = src.split("||")[1] || "";
  src = src.split("||")[0];
  var mode = (src.match(/^(skills|level|role|text|hub):/) || [])[1] || "text";
  var pat = src.replace(/^(skills|level|role|text|hub):/, "");
  var re = null;
  try { re = pat ? new RegExp(pat, "i") : null; } catch (e) { re = null; }
  return hpDoc(HP_HUB).then(function (doc) {
    var sec = doc && doc.querySelector(".section.is-dark-talent");
    if (!sec) return [];
    var all = [].slice.call(sec.querySelectorAll(".grid-talent-cards > *")).filter(function (c) { return c.querySelector(".div-talent-card"); });
    var off = function (c) { var st = c.querySelector("[data-hire-status]"); return st && /^unavailable$/i.test(st.textContent.trim()) ? 1 : 0; };
    all = all.map(function (c, i) { return [c, i]; }).sort(function (x, y) { return off(x[0]) - off(y[0]) || x[1] - y[1]; }).map(function (x) { return x[0]; });
    var test = function (c) {
      if (mode === "skills") return [].some.call(c.querySelectorAll(".is-chip:not(.is-more)"), function (x) { return !x.closest("[data-talent-badges]") && re.test(x.textContent.trim()); });
      if (mode === "level") { var l = c.querySelector("[data-hire-exp]"); return !!l && re.test(l.textContent.trim()); }
      if (mode === "role") return [].some.call(c.querySelectorAll("[data-hire-role]"), function (x) { return re.test(x.textContent.trim()); });
      return re.test(c.textContent);
    };
    if (mode === "role" && alt && !sec.querySelector("[data-hire-role]:not(:empty)")) {
      mode = "text";
      try { re = new RegExp(alt, "i"); } catch (e) { re = null; }
    }
    var hit = re ? all.filter(test) : [];
    /* fill: top up with other available engineers to a full grid of 8. */
    var list = hit.length ? hit : all;
    if (fill && list.length < 8) list = list.concat(all.filter(function (c) { return list.indexOf(c) < 0 && !off(c); }));
    return list.slice(0, 8).map(function (c) {
      c = c.cloneNode(true);
      c.querySelectorAll("[data-hire-exp]").forEach(function (el) { el.removeAttribute("data-hire-exp"); });
      /* The page's own skill (React on /hire/react-developers) goes first
         among the chips and is outlined, as with the hub's Skill filter. */
      if (re && (mode === "skills" || mode === "text")) {
        var box = c.querySelector(".div-talent-card-stack .div-talent-chips");
        var hits = box ? [].filter.call(box.children, function (el) {
          var x = el.querySelector(".is-chip:not(.is-more)");
          return x && re.test(x.textContent.trim());
        }) : [];
        hits.reverse().forEach(function (el) {
          el.querySelector(".is-chip").classList.add("is-hit");
          box.insertBefore(el, box.firstChild);
        });
      }
      [c].concat([].slice.call(c.querySelectorAll("[data-reveal-item],[data-reveal-group],[data-reveal]"))).forEach(function (el) {
        el.removeAttribute("data-reveal-item"); el.removeAttribute("data-reveal-group"); el.removeAttribute("data-reveal");
      });
      return c;
    });
  });
}
var HP_HUB = "/hire-talent";
var HP_LINKS = {
  "hire frontend engineers": "frontend-engineers",
  "hire backend engineers": "back-end-engineers",
  "hire fractional ctos": "fractional-ctos",
  "hire python engineers": "python-developers",
  "hire react engineers": "react-developers",
  "hire java engineers": "java-developers",
  "hire fintech engineers": "fintech-developers",
  "hire e-commerce engineers": "e-commerce-developers",
  "web app development": "web-app-development-team",
  "mvp development": "mvp-development-team",
  "mobile app development": "mobile-app-development-team"
};
function initHirePage() {
  var mount = document.querySelector("[data-hp-talent]");
  if (!mount) return;
  var base = "/" + (location.pathname.split("/")[1] || "hire") + "/";

  /* FAQ: drop rows without a question */
  [].slice.call(document.querySelectorAll("[data-acc-item]")).forEach(function (it) {
    if (!it.textContent.replace(/\s+/g, "")) it.remove();
  });

  /* Related skills */
  [].slice.call(document.querySelectorAll("[data-hp-related]")).forEach(function (box) {
    var raw = box.getAttribute("data-hp-related") || "";
    var names = raw.split("|").map(function (x) { return x.trim(); }).filter(Boolean);
    box.innerHTML = "";
    if (!names.length) { box.style.display = "none"; return; }
    /* Same h2 style as the article: the block goes at the end of the rich
       text. Every chip is a link: its hire page, or the hub when that page
       does not exist yet. The current page stays plain text. */
    var rich = document.querySelector("[data-toc-source] .blog-rich, [data-toc-source] .w-richtext");
    if (rich) rich.appendChild(box);
    var h = document.createElement("h2");
    h.textContent = "Related skills";
    var row = document.createElement("div");
    row.className = "div-hp-related";
    names.forEach(function (n) {
      var slug = HP_LINKS[n.toLowerCase()];
      var here = slug && location.pathname.replace(/\/$/, "") === base + slug;
      var el = document.createElement(here ? "span" : "a");
      el.className = "tag is-chip";
      el.textContent = n;
      if (!here) { el.href = slug ? base + slug : HP_HUB; el.setAttribute("data-btn-roll", ""); }
      if (here) el.setAttribute("aria-current", "page");
      row.appendChild(el);
    });
    box.appendChild(h);
    box.appendChild(row);
  });
  /* Chip links get the site's button letter roll, as the role links on Find Jobs. */
  if (window.ytBtnRoll) window.ytBtnRoll();

  /* Talent block: the section shell (tag, heading, text, "Log in" button)
     is native on the template and bound to the CMS; only the cards come from
     the hub, picked by the CMS "Talent filter". */
  var src = mount.getAttribute("data-hp-talent") || "";
  var grid = mount.querySelector("[data-hp-grid]");
  if (!grid || !window.fetch || !window.DOMParser) return;
  var start = function () {
    hpCards(src).then(function (cards) {
      if (!cards.length) {
        grid.innerHTML = "";
        grid.appendChild(ytEmpty("talent", { dark: true }));
        var more = mount.querySelector(".div-talent-more");
        if (more) more.style.display = "none";
        return;
      }
      grid.innerHTML = "";
      cards.forEach(function (c) { grid.appendChild(document.importNode(c, true)); }); ytChipFade(grid);
      var sec = grid.closest(".section") || mount;
      initTalentRate(sec);
      initTalentDesc(sec);
    });
  };
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      start();
    }, { rootMargin: "800px 0px" });
    io.observe(mount);
  } else start();
}


/* Hire Pages in the listing blocks (Nov 2026). The client controls what is
   listed through the Hire Pages collection (Axis + Order), not the synced
   taxonomy collections.
   - Hub (/hire-talent): each section (#technologies, #roles, #industries,
     #products) has a Hire Pages list whose links carry data-hp-axis. Items of
     another axis are removed (the lists are unfiltered until the Axis filter
     is set in Designer), and the section hides when nothing is left.
   - Capabilities component (Home, How it works, Technologies template): its
     four tabs still hold synced lists inside the component, which the API
     cannot rebind, so their items are replaced with the hub's Hire Pages
     links for the same axis (tab identified by its "All ..." button hash). */
var HP_AXIS = { technologies: "Skill", roles: "Role", industries: "Industry", products: "Product" };
/* Hire Pages collection path. Links built by the API in "Current item" mode
   publish "#", so the hub cards carry data-hp-slug and get their href here. */
var HP_BASE = "/hire/";
/* Until the collection slug is "hire" in Designer, the pages live under
   /hire-developers/. One HEAD request (cached per session) tells which path
   is live, and every /hire/{slug} link on the page is rewritten to it.
   Once the slug is "hire", this is a no-op. */
var HP_BASE_LIVE = null;
function hpBase() {
  if (HP_BASE_LIVE) return Promise.resolve(HP_BASE_LIVE);
  try { var c = sessionStorage.getItem("ytw-hp-base"); if (c) { HP_BASE_LIVE = c; return Promise.resolve(c); } } catch (e) {}
  if (!window.fetch) return Promise.resolve(HP_BASE);
  return fetch(HP_BASE + "frontend-engineers", { method: "HEAD", credentials: "same-origin" })
    .then(function (r) { return r.ok ? HP_BASE : "/hire-developers/"; })
    .catch(function () { return HP_BASE; })
    .then(function (b) { HP_BASE_LIVE = b; try { sessionStorage.setItem("ytw-hp-base", b); } catch (e) {} return b; });
}
function hpFixLinks(root) {
  hpBase().then(function (b) {
    if (b === HP_BASE) return;
    [].forEach.call((root || document).querySelectorAll('a[href^="' + HP_BASE + '"]'), function (a) {
      a.setAttribute("href", b + a.getAttribute("href").slice(HP_BASE.length));
    });
  });
}
function hpPrune(root) {
  [].forEach.call(root.querySelectorAll("a[data-hp-slug]"), function (a) {
    var h = a.getAttribute("href") || "";
    if (!h || h === "#" || h.indexOf("detail_") === 0) a.setAttribute("href", HP_BASE + a.getAttribute("data-hp-slug"));
  });
  Object.keys(HP_AXIS).forEach(function (id) {
    var sec = root.getElementById ? root.getElementById(id) : root.querySelector("#" + id);
    if (!sec) return;
    var links = [].slice.call(sec.querySelectorAll("a[data-hp-axis]"));
    if (!links.length) return;
    links.forEach(function (a) {
      if (a.getAttribute("data-hp-axis") !== HP_AXIS[id]) (a.closest(".w-dyn-item") || a).remove();
    });
  });
}
function initHpLists() {
  if (document.querySelector("a[data-hp-axis]")) { hpPrune(document); hpFixLinks(document); return; }
  var tabs = [].slice.call(document.querySelectorAll(".div-technology-selection")).map(function (box) {
    var all = [].filter.call(box.querySelectorAll("a[href*='#']"), function (a) { return /#(technologies|roles|industries|products)$/.test(a.getAttribute("href")); })[0];
    var grid = box.querySelector(".grid-3col-technology-selection");
    return all && grid ? { id: all.getAttribute("href").split("#")[1], grid: grid } : null;
  }).filter(Boolean);
  if (!tabs.length || !window.fetch || !window.DOMParser) return;
  /* The hub page is ~300 KB of HTML: fetch and parse it only when the first
     list comes within ~1.5 screens of the viewport (17 Nov, page speed). */
  if ("IntersectionObserver" in window && !initHpLists.go) {
    var io = new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect();
      initHpLists.go = 1;
      initHpLists();
    }, { rootMargin: "1200px 0px" });
    tabs.forEach(function (t) { io.observe(t.grid); });
    return;
  }
  fetch(HP_HUB, { credentials: "same-origin" })
    .then(function (r) { return r.ok ? r.text() : ""; })
    .then(function (html) {
      if (!html) return;
      var doc = new DOMParser().parseFromString(html, "text/html");
      hpPrune(doc);
      tabs.forEach(function (t) {
        var sec = doc.getElementById(t.id);
        var items = sec ? [].slice.call(sec.querySelectorAll("a[data-hp-axis]")) : [];
        if (!items.length) return;
        t.grid.innerHTML = "";
        items.forEach(function (a) {
          var wrap = document.createElement("div");
          wrap.className = "w-dyn-item";
          wrap.setAttribute("role", "listitem");
          wrap.appendChild(document.importNode(a, true));
          t.grid.appendChild(wrap);
        });
      });
      hpFixLinks(document);
    })
    .catch(function () {});
}


/* Home hero UI (Global hero embed, .hero-ui): client copy, Nov 2026. Only
   individual engineers, no teams, and "Engineers" instead of "Top IT
   Talents". The embed is 30 KB of inline SVG, so the two strings are swapped
   here; move them into the embed on the next Designer pass. */
function initHeroUiCopy() {
  var ui = document.querySelector(".hero-ui");
  if (!ui) return;
  [].slice.call(ui.querySelectorAll("*")).forEach(function (el) {
    [].slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType === 3 && /Top IT Talents?/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/Top IT Talents?/, "Engineers");
    });
  });
  [].slice.call(ui.querySelectorAll(".hero-ui_row-name")).forEach(function (n) {
    if (!/team/i.test(n.textContent)) return;
    var row = n.parentNode, ico = row.querySelector(".hero-ui_team"), role = row.querySelector(".hero-ui_row-role");
    n.textContent = "Olivia Kim";
    if (role) role.textContent = "QA Engineer";
    if (ico) { ico.innerHTML = "OK"; ico.style.font = "600 6.5px/1 Inter,sans-serif"; ico.style.color = "#0b0c0e"; }
  });
}


/* Case study tiles: the industry field holds several industries in one line
   ("Health, Wellness and Fitness, AI"). Each one gets its own badge (client,
   Nov 2026). Industry names that contain a comma themselves are kept whole. */
function initCaseBadges() {
  var KEEP = ["Health, Wellness and Fitness"];
  document.querySelectorAll(".case-tile_badge").forEach(function (b) {
    if (b.__split) return;
    b.__split = 1;
    var txt = b.textContent.replace(/\s+/g, " ").trim(), parts = [];
    KEEP.forEach(function (k, i) { txt = txt.split(k).join("\u0000" + i + "\u0000"); });
    txt.split(/\s*[,;|]\s*/).forEach(function (x) {
      x = x.replace(/\u0000(\d+)\u0000/g, function (_, i) { return KEEP[+i]; }).trim();
      if (x) parts.push(x);
    });
    if (parts.length < 2) return;
    b.textContent = parts[0];
    var at = b;
    parts.slice(1).forEach(function (x) {
      var c = b.cloneNode(false);
      c.textContent = x;
      at.parentNode.insertBefore(c, at.nextSibling);
      at = c;
    });
  });
}


/* Empty states (Nov 2026). One look for every empty CMS list and every
   "no results" message: icon, title, one line, button (.yt-empty, CSS in
   Global Styles [After]).
   - Webflow ".w-dyn-empty" ("No items found."): main lists get a state by
     context (talent / jobs / content); decorative lists (logos, chips, nested
     lists, header, footer, menus) stay hidden.
   - Filter messages ([data-hire-empty], [data-blog-empty], [data-pod-empty],
     [data-careers-empty], [data-gl-empty], [data-ev-empty]): text kept, icon
     and title added, "Clear filters" resets the controls of that section.
   - ytEmpty(kind) builds the markup for JS-filled grids (Hire Pages talent). */
var YT_EMPTY_ICON = {
  talent: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  jobs: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
  content: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'
};
function ytCallHref() {
  var a = [].filter.call(document.querySelectorAll("a"), function (x) { return /book a strategy call/i.test(x.textContent) && x.getAttribute("href") && x.getAttribute("href") !== "#"; })[0];
  return a ? a.getAttribute("href") : "/contact";
}
function ytEmpty(kind, opts) {
  opts = opts || {};
  var T = {
    talent: ["No engineers available right now", "We add vetted engineers every week. Tell us what you need and we will match you.", "Book a strategy call", ytCallHref()],
    jobs: ["No open roles yet", "New requests come in every week. Create your profile and we will put you forward when one fits.", "Create your profile", "https://app.yotewo.com/"],
    content: ["Nothing here yet", "New content is on its way. Check back soon.", "", ""],
    search: ["No matches", "Try another filter or search term.", "Clear filters", ""]
  }[kind] || [];
  var title = opts.title || T[0], text = opts.text || T[1], btn = opts.btn != null ? opts.btn : T[2], href = opts.href || T[3];
  var el = document.createElement("span");
  el.className = "yt-empty" + (opts.dark ? " is-dark" : "");
  el.innerHTML = '<span class="yt-empty_icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (YT_EMPTY_ICON[kind] || YT_EMPTY_ICON.content) + '</svg></span>' +
    '<span class="yt-empty_title"></span><span class="yt-empty_text"></span>';
  el.querySelector(".yt-empty_title").textContent = title;
  el.querySelector(".yt-empty_text").textContent = text;
  if (btn) {
    var b = document.createElement(href ? "a" : "button");
    b.className = "button" + (opts.dark ? " is-light" : "");
    b.textContent = btn;
    if (href) b.setAttribute("href", href); else b.type = "button";
    if (opts.onClick) b.addEventListener("click", opts.onClick);
    el.appendChild(b);
  }
  return el;
}
function ytIsDark(el) {
  return !!el.closest('.is-dark-talent,.is-dark-hire,[data-code-bg="dark"],.section.is-dark');
}
function initEmptyStates() {
  var path = location.pathname;
  [].forEach.call(document.querySelectorAll(".w-dyn-empty"), function (box) {
    var wrap = box.parentNode;
    if (!wrap || box.querySelector(".yt-empty")) return;
    var decorative = wrap.closest(".w-dyn-item,header,footer,nav,.w-nav,[data-nav-src],[data-hire-roles],.div-brands-row-wrap,.div-brands-strip,.div-talent-chips,.global-styles,[hidden]") ||
      /brand|logo|chip|menu|nav|footer/i.test((wrap.querySelector(".w-dyn-items") || {}).className || "");
    if (decorative || !wrap.offsetParent && getComputedStyle(wrap).display === "none") return;
    var listCls = (wrap.querySelector(".w-dyn-items") || {}).className || "";
    var kind = /talent/.test(listCls) && !/job/.test(listCls) && !/^\/(find-jobs|jobs)\b/.test(path) ? "talent"
      : /job|opening/i.test(listCls) || /^\/(find-jobs|jobs)\b/.test(path) ? "jobs" : "content";
    var hub = "/" + (path.split("/")[1] || "");
    var opts = { dark: ytIsDark(box) };
    if (kind === "content" && path.split("/").filter(Boolean).length > 1) { opts.btn = "See all"; opts.href = hub; }
    box.textContent = "";
    box.appendChild(ytEmpty(kind, opts));
    box.classList.add("is-yt");
    /* The gap above a CMS grid usually sits on the list itself (e.g.
       .grid-talent-cards margin-top), which Webflow does not render when the
       list is empty. Give the state the same breathing room under a heading. */
    var prev = wrap.previousElementSibling;
    if (prev && !/spacer/.test(prev.className)) box.classList.add("is-spaced");
  });
  [].forEach.call(document.querySelectorAll("[data-hire-empty],[data-blog-empty],[data-pod-empty],[data-careers-empty],[data-gl-empty],[data-ev-empty]"), function (box) {
    if (box.querySelector(".yt-empty")) return;
    var msg = box.textContent.replace(/\s+/g, " ").trim();
    var isEv = box.hasAttribute("data-ev-empty");
    var root = box.closest("section") || document;
    var clear = function () {
      [].forEach.call(root.querySelectorAll("select"), function (s) { s.selectedIndex = 0; s.dispatchEvent(new Event("change", { bubbles: true })); });
      [].forEach.call(root.querySelectorAll('input[type="search"],input[type="text"],input:not([type])'), function (i) { if (!i.value) return; i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); });
      var all = root.querySelector('[data-blog-filter="all"],[data-pod-filter="all"],[data-gl-cat="all"],[data-gl-letter="all"]');
      if (all) all.click();
    };
    var hasControls = !isEv && root.querySelector("select,input,[data-blog-filter],[data-pod-filter],[data-gl-cat]");
    box.textContent = "";
    box.appendChild(ytEmpty(isEv ? "content" : "search", { text: msg || null, title: isEv ? "No upcoming events" : null, btn: hasControls ? "Clear filters" : "", onClick: clear, dark: ytIsDark(box) }));
    box.classList.add("is-yt");
  });
}

/* ==========================================================================
   18. ENTRY POINT
   ========================================================================== */
onReady(() => {
  initPodCovers();
  initBlogCovers();
  initEmptyStates();
  initHirePage();
  initHpLists();
  initCaseBadges();
  initHeroUiCopy();
  initCoverSizes();
  initRoleDrum();
  initLiveWidgets();
  initAccordion();
  initNumberOdometer();
  initSwiperSlider();
  initClamp();
  initUnderline();
  initStickyCta();
  initAccMedia();
  initTabSystem();
  initLogoWallCycle();
  initLogoMarquee();

  initHeader();
  initButtonRoll();
  /* Logo wall first: it clones cells up to data-logo-wall-slots. Reveal must
     see the final cells, or the clones copy the hidden state and never fade in. */
  initFullRows();
  initLogoWall();
  initRevealGroups();
  initEventCovers();
  initGlowBg();
  initSegmented();
  initProcessSteps();
  initToc();
  initVideoPopup();
  initVideoPlayer();
  initHireOrbit();
  initLogoMarqueeFill();
  initCalEmbed();
  initBlog();
  initCmsLinks();
  initCareers();
  initChipFade();
  initEvents();
  initPodcast();
  initGlossary();
  initAbout();
  initCmsMenu();
  initCasesCms();
  initCaseRelated();
  initMeshHover();
  initFaceArc();
  initPromptType();
  initTitleGlow();
  initLetterPlay();
  initQuoteKinetic();
  initMarqueeEase();
  initLogoOptical();
  initHeadlineRotate();
  initVsRows();
  initDecorativeMocks();
  initCopyTemplate();
  initPnLoop();
  initPodHover();
  initVsAlign();
  initVsVisuals();
  initVsLoop();
  initTalentRate();
  initTalentDesc();
  initRoleLinks();
  initRateCalc();
  initRcTalent();
  initPodLive();
  initHashLanding();
});

/* Landing on a #anchor from another page (Hire talent dropdown See all ->
   /hire#technologies, #roles, #industries, #products): the browser jumps
   while the page is still being built (CMS lists, hero heights, fonts), so the
   target ended up under the floating header. Once the page has loaded, scroll
   to it again; CSS scroll-margin-top (Global Styles) keeps it 7rem below the
   top, clear of the header. */
function initHashLanding() {
  var id = decodeURIComponent((location.hash || "").slice(1));
  if (!id) return;
  var go = function () {
    var t = document.getElementById(id);
    if (t) t.scrollIntoView({ block: "start" });
  };
  if (document.readyState === "complete") setTimeout(go, 60);
  else window.addEventListener("load", function () { setTimeout(go, 60); }, { once: true });
}

/* Copy to clipboard  [data-copy-btn] -> [data-copy-source]
   Job description template page: copies the template body as plain text.
   The button keeps its label (btn-roll splits it into letters); it gets
   .is-copied for 2s and a polite live region announces the copy. */
function initCopyTemplate() {
  var src = document.querySelector("[data-copy-source]");
  var btns = document.querySelectorAll("[data-copy-btn]");
  if (!src || !btns.length) return;
  var live = document.createElement("span");
  live.className = "sr-only";
  live.setAttribute("aria-live", "polite");
  live.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";
  document.body.appendChild(live);
  /* Visible confirmation: a small dark tooltip above the pressed button
     (Global Styles section 42, .copy-toast). */
  var toast = document.createElement("div");
  toast.className = "copy-toast";
  toast.setAttribute("aria-hidden", "true");
  toast.textContent = "Copied to clipboard";
  document.body.appendChild(toast);
  function showToast(b) {
    var r = b.getBoundingClientRect();
    toast.style.left = r.left + r.width / 2 + "px";
    toast.style.top = r.top + "px";
    toast.classList.add("is-on");
  }
  window.addEventListener("scroll", function () { toast.classList.remove("is-on"); }, { passive: true });
  function text() {
    return src.innerText.replace(/\n{3,}/g, "\n\n").trim();
  }
  function fallback(t) {
    var ta = document.createElement("textarea");
    ta.value = t;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    ta.remove();
    return ok ? Promise.resolve() : Promise.reject();
  }
  btns.forEach(function (b) {
    var timer;
    b.addEventListener("click", function (e) {
      e.preventDefault();
      var t = text();
      var p = navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(t).catch(function () { return fallback(t); }) : fallback(t);
      p.then(function () {
        b.classList.add("is-copied");
        showToast(b);
        live.textContent = "Template copied to clipboard";
        clearTimeout(timer);
        timer = setTimeout(function () {
          toast.classList.remove("is-on");
          b.classList.remove("is-copied");
          live.textContent = "";
        }, 2000);
      }).catch(function () {});
    });
  });
}

/* Partner notification stack loop  .pn-stack (For Partners hero)
   Every few seconds the front notification slides away and the one behind
   it comes forward (the two cards swap their content), like a live feed.
   Runs only while the stack is on screen; still with reduced motion. */
function initPnLoop() {
  if (PREFERS_STILL || !Element.prototype.animate) return;
  document.querySelectorAll(".pn-stack").forEach(function (st) {
    var front = st.querySelector(".pn-card.is-front"), mid = st.querySelector(".pn-card.is-mid");
    if (!front || !mid) return;
    var ease = "cubic-bezier(.625,.05,0,1)", timer = 0, busy = false;
    /* Only the card contents move; the cards themselves never fade, and every
       step is timer-driven with no held fill, so nothing can get stuck hidden. */
    function kids(el) { return [].slice.call(el.children); }
    function step() {
      if (busy || document.hidden) return;
      busy = true;
      kids(front).forEach(function (k) {
        k.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-0.5rem)" }], { duration: 350, easing: ease, fill: "forwards" });
      });
      setTimeout(function () {
        var a = front.innerHTML;
        front.innerHTML = mid.innerHTML;
        mid.innerHTML = a;
        kids(front).forEach(function (k, i) {
          k.animate([{ opacity: 0, transform: "translateY(0.5rem)" }, { opacity: 1, transform: "none" }], { duration: 600, delay: i * 60, easing: ease, fill: "backwards" });
        });
        kids(mid).forEach(function (k) {
          k.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: ease });
        });
        busy = false;
      }, 380);
    }
    function start() { if (!timer) timer = setInterval(step, 4000); }
    function stop() { clearInterval(timer); timer = 0; }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { es[0].isIntersecting ? start() : stop(); }, { threshold: 0.3 }).observe(st);
    } else start();
  });
}

/* Podcast covers follow the cursor like the site gradients (initMeshHover):
   the drifting colour layer (.pod-cover::after, Global Styles section 40)
   shifts toward the pointer through --px/--py. The cover art and its title
   never move. */
function initPodHover() {
  if (PREFERS_STILL) return;
  if (window.matchMedia && !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  /* Delegated, so covers re-rendered by the podcast pagination still react. */
  var last = null;
  document.addEventListener("pointermove", function (e) {
    var el = e.target.closest && e.target.closest(".pod-cover");
    if (last && last !== el) { last.style.setProperty("--px", "0"); last.style.setProperty("--py", "0"); }
    last = el;
    if (!el) return;
    var r = el.getBoundingClientRect();
    el.style.setProperty("--px", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    el.style.setProperty("--py", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  }, { passive: true });
}

/* Compare pages (/vs): the criteria rail and the two cards are separate
   columns, so long CMS texts used to push rows out of line. This makes the
   two card heads the same height, starts the rail at the first row, and gives
   each row the height of its tallest cell. Re-runs on resize and font load. */
function initVsAlign() {
  var table = document.querySelector(".vs-table");
  if (!table) return;
  var rail = table.querySelector(".vs-rail");
  var cards = [].slice.call(table.querySelectorAll(".vs-card"));
  if (!rail || cards.length < 2) return;
  /* Below 992px the criteria rail is hidden (cards side by side on tablets,
     stacked on phones), so each row gets its criterion name as a small
     label above the text (.vs-key_crit, hidden on desktop by the compare
     embed). */
  var crits = [].slice.call(rail.querySelectorAll(".vs-crit_title")).map(function (c) { return c.textContent.replace(/\s+/g, " ").trim(); });
  cards.forEach(function (c) {
    [].slice.call(c.querySelectorAll(".vs-key")).forEach(function (k, i) {
      if (!crits[i] || k.querySelector(".vs-key_crit")) return;
      var body = k.querySelector(".vs-key_title");
      var lab = document.createElement("div");
      lab.className = "vs-key_crit";
      lab.textContent = crits[i];
      if (body && body.parentNode) body.parentNode.insertBefore(lab, body);
      else k.appendChild(lab);
    });
  });
  function run() {
    var heads = cards.map(function (c) { return c.querySelector(".vs-card_head"); }).filter(Boolean);
    var cols = [[].slice.call(rail.querySelectorAll(".vs-crit"))].concat(cards.map(function (c) { return [].slice.call(c.querySelectorAll(".vs-key")); }));
    heads.concat.apply(heads, cols).forEach(function (el) { el.style.minHeight = ""; });
    rail.style.paddingTop = "";
    /* Below 768px the cards stack, so rows keep their natural height. On
       tablets the rail is hidden but the two cards still sit side by side. */
    if (window.matchMedia && matchMedia("(max-width: 767px)").matches) return;
    var hMax = Math.max.apply(null, heads.map(function (h) { return h.offsetHeight; }));
    heads.forEach(function (h) { h.style.minHeight = hMax + "px"; });
    var first = cols[1][0];
    /* offsetTop chains, not getBoundingClientRect: the reveal animation may
       still be translating the cards when this runs. */
    function y(el) { var v = 0; while (el) { v += el.offsetTop; el = el.offsetParent; } return v; }
    if (first) rail.style.paddingTop = y(first) - y(rail) + "px";
    var n = Math.max.apply(null, cols.map(function (c) { return c.length; }));
    for (var i = 0; i < n; i++) {
      var cells = cols.map(function (c) { return c[i]; }).filter(Boolean);
      var m = Math.max.apply(null, cells.map(function (c) { return c.offsetHeight; }));
      cells.forEach(function (c) { c.style.minHeight = m + "px"; });
    }
  }
  run();
  var t;
  window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(run, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
}

/* Compare pages (/vs): the four "difference" cards get a live product
   widget (section 53 templates) picked from the card title, so each
   competitor page shows a visual that matches its own copy. Titles that match
   nothing keep the plain glow box. */
function initVsLoop() {
  /* /vs card visuals keep moving while on screen (15 Nov 2026, reworked the
     same day after client review). Task lists play a small story: every row
     starts queued (dashed ring), then one by one a row lifts, a progress line
     fills under it with a soft shine, its spinner turns and it lands on a
     check with a green pulse; after a short hold the list starts over.
     Assessment chips light up in turn (no row background: the cells sat too
     close) and the invoice badge pings. Styles in yotewo.css. */
  var vis = [].slice.call(document.querySelectorAll(".vs-diff-card .vsv"));
  if (!vis.length || !("IntersectionObserver" in window)) return;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  vis.forEach(function (v) {
    var rows, run, T, t = null, wait = null;
    if (v.classList.contains("vsv-tasks")) {
      rows = [].slice.call(v.querySelectorAll(".vsv-task"));
      var ok = v.querySelector(".vsv-st.is-ok"), sp = v.querySelector(".vsv-st.is-spin");
      if (!ok || !sp || !rows.length) return;
      var okHTML = ok.innerHTML, spinHTML = sp.innerHTML, n = -1, hold = 0;
      T = 1600;
      v.style.setProperty("--vsv-t", T + "ms");
      var set = function (row, state) {
        var st = row.querySelector(".vsv-st");
        row.classList.remove("is-wait", "is-hot", "is-done");
        row.classList.add("is-" + state);
        st.className = "vsv-st is-" + (state === "hot" ? "spin" : state === "done" ? "ok" : "wait");
        st.innerHTML = state === "hot" ? spinHTML : state === "done" ? okHTML : "";
      };
      run = function () {
        if (n < 0) {
          v.classList.add("is-looping");
          rows.forEach(function (r) { set(r, "wait"); });
          n = 0;
          set(rows[0], "hot");
          return;
        }
        if (n < rows.length) {
          set(rows[n], "done");
          n++;
          if (n < rows.length) set(rows[n], "hot");
          return;
        }
        if (++hold < 2) return;
        hold = 0;
        n = -1;
        run();
      };
    } else {
      rows = [].slice.call(v.querySelectorAll(v.classList.contains("vsv-ov") ? ".vsv-ov_grid > div" : ".vsv-pill:not(.is-b1):not(.is-b2)"));
      if (!rows.length) return;
      var k = -1;
      T = rows.length > 3 ? 1400 : 1800;
      run = function () {
        if (k > -1) rows[k].classList.remove("is-hot");
        k = (k + 1) % rows.length;
        void rows[k].offsetWidth;
        rows[k].classList.add("is-hot");
      };
    }
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !t && !wait) wait = setTimeout(function () { wait = null; run(); t = setInterval(run, T); }, 900);
        else if (!e.isIntersecting) { clearTimeout(wait); wait = null; clearInterval(t); t = null; }
      });
    }, { threshold: 0.4 }).observe(v);
  });
}

function initVsVisuals() {
  /* Compare pages (/vs), "Four things Yotewo does" cards: the visual in each
     card is the HTML version of the Figma UI for that card (IR35 pill stack,
     assessment overview, curated shortlist, task cards). The card title picks
     the content; the four Figma layouts are shared by all competitors. */
  var cards = [].slice.call(document.querySelectorAll(".vs-diff-card"));
  if (!cards.length) return;
  var I = {
    doc: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Zm-5 15h6v1.5H9V17Zm0-3.5h6V15H9v-1.5ZM13 9V3.5L17.5 9H13Z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M11 3a8 8 0 0 1 6.3 12.9l3.4 3.4-1.4 1.4-3.4-3.4A8 8 0 1 1 11 3Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 21s-7.4-4.6-9.5-9.2C1.1 8.6 3.1 5 6.6 5c2 0 3.5 1.1 4.4 2.6C11.9 6.1 13.4 5 15.4 5c3.5 0 5.5 3.6 4.1 6.8C17.4 16.4 12 21 12 21Z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm1 5h-2v6.6l4.9 2.9 1-1.7-3.9-2.3V7Z"/></svg>',
    case: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M9 3h6a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3V5a2 2 0 0 1 2-2Zm0 3h6V5H9v1Z"/></svg>',
    team: '<svg viewBox="0 0 24 24" fill="#fff"><circle cx="9" cy="7.5" r="3.8"/><path d="M1.5 20c0-3.8 3.4-6 7.5-6s7.5 2.2 7.5 6v1h-15v-1Z"/><circle cx="17.2" cy="8.4" r="2.9" opacity=".6"/><path d="M17.5 13.2c3 0 5 1.7 5 4.8v1h-4c0-2.5-.9-4.4-2.6-5.7.5-.1 1-.1 1.6-.1Z" opacity=".6"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2a7 7 0 0 1 4 12.7V17H8v-2.3A7 7 0 0 1 12 2Zm-3 17h6v1a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1Z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="#fff"><circle cx="9" cy="7.5" r="3.8"/><path d="M1.5 20c0-3.8 3.4-6 7.5-6s7.5 2.2 7.5 6v1h-15v-1Z"/><circle cx="17.2" cy="8.4" r="2.9"/><path d="M17.5 13.2c3 0 5 1.7 5 4.8v1h-4c0-2.5-.9-4.4-2.6-5.7.5-.1 1-.1 1.6-.1Z"/></svg>',
    ok: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fff"/><path d="m7.6 12.3 3 3 5.9-6.1" fill="none" stroke="#1b1d22" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    spin: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="#3ee089"><path d="m12 7 7 8H5l7-8Z"/></svg>'
  };
  var DOTS = ["#b99ae7", "#ea7b43", "#ef729e", "#727dcb", "#81a063", "#72becb"];
  /* Card titles come from the CMS and were rewritten per competitor (Nov
     2026), so the visual is picked by theme, first match wins: permanent
     fee, contract to permanent, vetting, cost, range of services, hours,
     retention, flexibility, ready engineers. The older title patterns stay
     below as a fallback. */
  var V = {
    perm: { t: "stack", icon: "case", title: "Permanent hire", sub: "Fee agreed before the search", badge: "Agreed" },
    cost: { t: "stack", icon: "doc", title: "Monthly invoice", sub: "Approved hours only", badge: "Paid" },
    flex: { t: "tasks", rows: [["clock", "14-day trial", "End without notice", "ok"], ["users", "Replace the engineer", "When your needs change", "ok"], ["case", "Scale up or down", "Month to month", "spin"]] }
  };
  var C0 = [
    [/fee.*permanent|permanent.*fee|lower fees|permanent hire cost/i, V.perm],
    [/go permanent|start on contract/i, "one roof"],
    [/vetted|screen|knowing who|interview/i, "threshold"],
    [/by the hour|cost|pay|budget|listing|price|fee/i, V.cost],
    [/full team|whole team|to cto|one partner|from one|advice to execution|grows|capacity|one hire|more than developers|more than one way|way to hire/i, "four ways"],
    [/hour|invoice|daily view|control/i, "control"],
    [/stay/i, "stay"],
    [/cover|commitment|replace|flexible|terms|workload|work out|keep the engineers|things change|unwind|no employment/i, V.flex],
    [/places the engineer|at work|without the search|keep building|staffed|job ad|finds the engineer|only employs/i, "bench"]
  ];
  var C = [
    [/ir35/i, { t: "stack", icon: "doc", title: "IR35 assessment", sub: "Assessed as outside IR35", badge: "Outside IR35" }],
    [/control|tracking/i, { t: "stack", icon: "clock", title: "Monthly hours report", sub: "Daily tracker with an hour cap", badge: "Approved" }],
    [/beyond the placement/i, { t: "stack", icon: "doc", title: "Engagement running", sub: "Reporting, billing and support", badge: "Active" }],
    [/threshold/i, { t: "ov", cap: "Human-led review beyond coding ability", title: "Senior assessment overview", badge: "Verified", av: "OL",
      items: ["Ownership", "Cross-functional influence", "System design", "Architecture", "Technical leadership", "Communication"] }],
    [/seniority/i, { t: "ov", cap: "Senior and above only", title: "Seniority levels", badge: "Placed", av: "OL",
      items: ["Senior", "Staff", "Principal", "Tech lead", "Head of engineering", "CTO"] }],
    [/engineering only/i, { t: "ov", cap: "Engineering and tech roles only", title: "Roles we place", badge: "Tech",
      items: ["Backend", "Frontend", "Full-stack", "Data", "DevOps", "Engineering leadership"] }],
    [/bench|marketplace/i, { t: "bench", cap: "Explore Engineers", title: "Looking for a Frontend Engineer",
      tags: ["React", "TypeScript", "SaaS", "GMT timezone"],
      rows: [["JB", "James B.", "Frontend Engineer", "96% match"], ["DK", "Darius K.", "Full-Stack Engineer", "90% match"], ["MC", "Maria C.", "Frontend Engineer", "96% match"]] }],
    [/one roof|contract and permanent/i, { t: "tasks", rows: [["doc", "Contract placement", "6 months  £650/day", "spin"], ["search", "Permanent search", "Base salary guidance included", "ok"], ["heart", "Interim cover", "Flexible short-term support", "ok"]] }],
    [/four ways|engage/i, { t: "tasks", rows: [["clock", "Temporary and interim", "Engineers for a set period", "ok"], ["case", "Permanent and executive", "Long-term and leadership hires", "ok"], ["team", "Delivery team", "A team around the product", "ok"], ["bulb", "Engineering consultants", "Short consulting engagements", "spin"]] }],
    [/stay/i, { t: "tasks", rows: [["doc", "Temporary contracts", "Average 18 months", "ok"], ["case", "Permanent hires", "Average 5 years", "ok"]] }],
    [/around work/i, { t: "tasks", rows: [["clock", "Workload and hour cap", "Set for each engineer", "ok"], ["users", "Extra hours", "Added when you need them", "spin"], ["doc", "Monthly approval", "Hours reported and approved", "ok"]] }]
  ];
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function pill(d, cls) {
    return '<div class="vsv-pill' + (cls ? " " + cls : "") + '"><i class="vsv-ib">' + I[d.icon] + '</i><span class="vsv-tx"><b>' + esc(d.title) + "</b><small>" + esc(d.sub) + "</small></span><em>" + esc(d.badge) + "</em></div>";
  }
  var R = {
    stack: function (d) { return '<div class="vsv vsv-stack">' + pill(d, "is-b2") + pill(d, "is-b1") + pill(d, "") + "</div>"; },
    ov: function (d) {
      var h = '<div class="vsv vsv-ov"><div class="vsv-ov_head"><small>' + esc(d.cap) + "</small><b>" + esc(d.title) + "</b>" + (d.av ? '<i class="vsv-av">' + d.av + "</i>" : "") + '</div><div class="vsv-ov_grid">';
      d.items.forEach(function (it, i) { h += '<div style="--i:' + i + '"><span><i style="background:' + DOTS[i % 6] + '"></i>' + esc(it) + "</span><em>" + esc(d.badge) + "</em></div>"; });
      return h + "</div></div>";
    },
    bench: function (d) {
      var h = '<div class="vsv vsv-bench"><div class="vsv-bench_head"><small>' + I.users + esc(d.cap) + "</small><b>" + esc(d.title) + '</b></div><div class="vsv-bench_tags">';
      d.tags.forEach(function (t) { h += "<span>" + esc(t) + "</span>"; });
      h += '</div><hr><div class="vsv-bench_rows">';
      d.rows.forEach(function (r, i) { h += '<div style="--i:' + i + '"><i class="vsv-av is-' + i + '">' + r[0] + "</i><span><b>" + esc(r[1]) + "</b><small>" + esc(r[2]) + "</small></span><em>" + I.up + esc(r[3]) + "</em></div>"; });
      return h + "</div></div>";
    },
    tasks: function (d) {
      var h = '<div class="vsv vsv-tasks">';
      d.rows.forEach(function (r, i) { h += '<div class="vsv-task" style="--i:' + i + '"><i class="vsv-ib">' + I[r[0]] + '</i><span class="vsv-tx"><b>' + esc(r[1]) + "</b><small>" + esc(r[2]) + '</small></span><i class="vsv-st is-' + r[3] + '">' + (r[3] === "spin" ? I.spin + I.ok : I.ok) + "</i></div>"; });
      return h + "</div>";
    }
  };
  /* Resolve the theme list: a string points at the older entry whose
     pattern matches that word. */
  C = C0.map(function (r) {
    if (typeof r[1] !== "string") return r;
    for (var j = 0; j < C.length; j++) if (C[j][0].test(r[1])) return [r[0], C[j][1]];
    return null;
  }).filter(Boolean).concat(C);
  var items = [];
  cards.forEach(function (card) {
    var vis = card.querySelector(".vs-diff-card_visual");
    var t = (card.querySelector(".vs-diff-card_title") || {}).textContent || "";
    if (!vis || vis.querySelector(".vsv")) return;
    var d = null;
    for (var i = 0; i < C.length; i++) if (C[i][0].test(t)) { d = C[i][1]; break; }
    if (!d) return;
    vis.setAttribute("aria-hidden", "true");
    vis.innerHTML = R[d.t](d);
    items.push({ card: card, vis: vis, el: vis.firstChild });
  });
  if (!items.length) return;
  /* The UI keeps its Figma size and only shrinks when the card is narrower
     (tablet and mobile). */
  function fit() {
    items.forEach(function (it) {
      it.el.style.zoom = "";
      var k = Math.min(1, (it.vis.clientWidth - 16) / it.el.offsetWidth);
      if (k < 1) it.el.style.zoom = k;
    });
  }
  fit();
  var tm;
  window.addEventListener("resize", function () { clearTimeout(tm); tm = setTimeout(fit, 120); });
  if (!("IntersectionObserver" in window)) { items.forEach(function (it) { it.card.classList.add("is-in"); }); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { threshold: 0.3 });
  items.forEach(function (it) { it.card.classList.add("vsv-anim"); io.observe(it.card); });
}

/* Quote [Kinetic] (About and other pages): the quote reacts to the cursor
   (client edit 50, "nothing happens on hover"). Letters of the kinetic
   words near the pointer turn fully opaque, grow and drift away from it; the
   gradient in the quote text follows the pointer across the line instead
   of its slow loop. Mouse and pen only; phones keep the ambient motion. */
function initQuoteKinetic() {
  if (PREFERS_STILL || !window.matchMedia("(hover: hover)").matches) return;
  document.querySelectorAll(".quote_wrap").forEach(function (wrap) {
    if (wrap.__qk) return;
    wrap.__qk = 1;
    var area = wrap.closest("section") || wrap;
    var text = wrap.querySelector(".quote_text");
    var spans = [].slice.call(wrap.querySelectorAll(".ql-word span"));
    var R = 170, raf = 0, px = 0, py = 0, on = false;
    spans.forEach(function (sp) { sp.style.transition = "transform .45s cubic-bezier(.2,.7,.2,1), opacity .35s ease"; });
    if (text) text.style.transition = "background-position .9s cubic-bezier(.2,.7,.2,1)";
    function frame() {
      raf = 0;
      spans.forEach(function (sp) {
        var r = sp.getBoundingClientRect();
        var dx = r.left + r.width / 2 - px, dy = r.top + r.height / 2 - py;
        var d = Math.sqrt(dx * dx + dy * dy);
        var f = on ? Math.max(0, 1 - d / R) : 0;
        if (f > 0.02) {
          var k = 12 * f / Math.max(d, 1);
          sp.style.animation = "none";
          sp.style.opacity = String(Math.min(1, 0.35 + f));
          sp.style.transform = "translate(" + (dx * k).toFixed(1) + "px," + (dy * k).toFixed(1) + "px) scale(" + (1 + 0.5 * f).toFixed(2) + ")";
          sp.__hot = 1;
        } else if (sp.__hot) {
          sp.__hot = 0;
          sp.style.animation = sp.style.opacity = sp.style.transform = "";
        }
      });
      /* The loop is a CSS animation, which outranks inline styles: on the
         first hover it is stopped where it is, and the gradient then moves
         with the pointer and stays where the pointer left it. */
      if (text && on) {
        if (!text.__qk) {
          text.__qk = 1;
          var cur = getComputedStyle(text).backgroundPosition;
          text.style.animation = "none";
          text.style.backgroundPosition = cur;
          void text.offsetWidth;
        }
        var tr = text.getBoundingClientRect();
        var u = Math.max(0, Math.min(1, (px - tr.left) / Math.max(1, tr.width)));
        text.style.backgroundPosition = (u * 100).toFixed(1) + "% 50%";
      }
    }
    function queue() { if (!raf) raf = requestAnimationFrame(frame); }
    area.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      px = e.clientX; py = e.clientY; on = true; queue();
    });
    area.addEventListener("pointerleave", function () { on = false; queue(); });
  });
}

/* Decorative product mockups (hero UI, notification stacks, talent cards,
   HIW dialogs) are pictures made of HTML. Take them out of the accessibility
   tree and tab order so screen readers and contrast audits skip them. */
function initDecorativeMocks() {
  document.querySelectorAll(".hero-ui, .pn-stack, .hero-talents, .hiw-dialog, .hiw-field, .hiw-search, .hiw-person, .hiw-menu").forEach(function (el) {
    el.setAttribute("aria-hidden", "true");
    el.setAttribute("inert", "");
  });
}

/* Rate calculator  [data-rc-calc] (/rate-calculator)
   Skill chips are a CMS list of buttons ([data-rc-chip] with data-mid-low ...
   data-lead-high, data-href). Seniority and engagement are button groups
   ([data-rc-level], [data-rc-model]). Coefficients live on [data-rc-calc]:
   data-rc-days, data-rc-inside, data-rc-perm, data-rc-min, data-rc-max.
   Outputs: [data-rc-out=*], level cards [data-rc-level-card], range bar
   [data-rc-band]/[data-rc-dot], CTA link inside [data-rc-cta] (href only, the
   Button keeps its static label), ranking rows [data-senior-high] in .rc-row. */
function initRateCalc() {
    var calc = document.querySelector("[data-rc-calc]");
    var chips = [].slice.call(document.querySelectorAll("[data-rc-chip]"));
    if (!calc || !chips.length) return;
    var ds = calc.dataset;
    var cfg = { days: +ds.rcDays || 220, inside: +ds.rcInside || 0.9, perm: +ds.rcPerm || 0.6, min: +ds.rcMin || 300, max: +ds.rcMax || 900 };
    var LEVELS = { mid: "Mid-level", senior: "Senior", lead: "Lead" };
    var MODELS = { outside: "contract outside IR35", inside: "contract inside IR35", perm: "permanent salary" };
    var skills = chips.map(function (c) {
      var d = c.dataset;
      return { el: c, name: c.textContent.trim(), href: d.href || "/hire-talent", mid: [+d.midLow, +d.midHigh], senior: [+d.seniorLow, +d.seniorHigh], lead: [+d.leadLow, +d.leadHigh] };
    });
    var state = { skill: skills[0], level: "senior", model: "day" };
    var $ = function (s, root) { return (root || document).querySelector(s); };
    var out = function (k) { return document.querySelectorAll('[data-rc-out="' + k + '"]'); };
    var set = function (k, v) { [].forEach.call(out(k), function (e) { e.textContent = v; }); };
    var round = function (v, step) { return Math.round(v / step) * step; };
    /* Client 17 Nov: show only what the platform sends. The platform has one day rate per skill and level, with no IR35 or permanent split, so no conversion. */
    var conv = function (v) { return v; };
    var money = function (v) { return "£" + Math.round(v); };
    var ALL = []; skills.forEach(function (s) { ["mid", "senior", "lead"].forEach(function (l) { s[l].forEach(function (v) { if (v > 0) ALL.push(v); }); }); });
    var B = ALL.length ? [Math.floor(Math.min.apply(null, ALL) / 50) * 50, Math.ceil(Math.max.apply(null, ALL) / 50) * 50] : [cfg.min, cfg.max];
    var bounds = function () { return B; };
    var pos = function (v, b) { return Math.max(0, Math.min(100, (v - b[0]) / (b[1] - b[0]) * 100)); };
    var median = function (r) { return (r[0] + r[1]) / 2; };
    /* No rate data in the CMS (empty or 0): show n/a, not £0 (client 14 Nov). */
    var has = function (r) { return r && r[0] > 0 && r[1] > 0; };
    var NA = "n/a";
    var avg = function (level) { var t = 0, n = 0; skills.forEach(function (s) { if (has(s[level])) { t += median(s[level]); n++; } }); return n ? t / n : 0; };

    function render() {
      var s = state.skill, raw = s[state.level];
      var lo = conv(raw[0]), hi = conv(raw[1]), md = conv(median(raw)), b = bounds();
      var perm = state.model === "perm", ok = has(raw);
      set("caption", LEVELS[state.level] + " " + s.name + ", day rate");
      set("range", ok ? money(lo) + "–" + money(hi) : NA);
      set("unit", perm ? "per year" : "per day");
      set("median", ok ? money(md) : NA);
      set("alt-label", perm ? "Per month" : "Per year");
      set("alt", !ok ? NA : perm ? "£" + round(md / 12, 50).toLocaleString("en-GB") : "£" + round(md * cfg.days / 1000, 1) + "k");
      var av = avg(state.level), d = ok && av ? Math.round((median(raw) / av - 1) * 100) : null;
      set("delta", d === null ? NA : (d > 0 ? "+" : "") + d + "%");
      set("axis-min", money(b[0]));
      set("axis-max", money(b[1]));
      set("skill", s.name);
      set("model", "day rate");
      var band = $("[data-rc-band]"), dot = $("[data-rc-dot]");
      if (band) { band.style.left = pos(lo, b) + "%"; band.style.width = (pos(hi, b) - pos(lo, b)) + "%"; band.style.visibility = ok ? "" : "hidden"; }
      /* Client call 24 Nov: no single median marker; one dot at each end of the band. */
      if (dot) {
        var dot2 = dot.parentNode.querySelector("[data-rc-dot2]");
        if (!dot2) { dot2 = dot.cloneNode(true); dot2.removeAttribute("data-rc-dot"); dot2.setAttribute("data-rc-dot2", ""); dot.parentNode.insertBefore(dot2, dot.nextSibling); }
        dot.style.left = pos(lo, b) + "%"; dot2.style.left = pos(hi, b) + "%";
        dot.style.visibility = dot2.style.visibility = ok ? "" : "hidden";
      }
      /* CTA goes to the matching Hire Page when one exists (the synced
         taxonomy pages are noindex), otherwise to the hub. */
      var hpKey = "hire " + s.name.toLowerCase().replace(/front-end developer/, "frontend engineers").replace(/back-end developer/, "backend engineers").replace(/ developers?$| engineers?$/, "") ;
      var hpSlug = HP_LINKS[hpKey] || HP_LINKS[hpKey + " engineers"];
      var hpBase = "/" + ((document.querySelector("a[href^='/hire/'],a[href^='/hire-developers/']") || { getAttribute: function () { return "/hire/"; } }).getAttribute("href").split("/")[1]) + "/";
      var ctaHref = hpSlug ? hpBase + hpSlug : HP_HUB;
      [].forEach.call(document.querySelectorAll("[data-rc-cta] a, a[data-rc-cta]"), function (a) { a.setAttribute("href", ctaHref); a.setAttribute("aria-label", "See vetted " + s.name + " engineers"); });
      [].forEach.call(document.querySelectorAll("[data-rc-level-card]"), function (card) {
        var lv = card.getAttribute("data-rc-level-card"), r = s[lv];
        var m = conv(median(r));
        var q = function (k) { return card.querySelector('[data-rc-lv="' + k + '"]'); };
        var rok = has(r);
        if (q("median")) q("median").textContent = rok ? money(m) : NA;
        if (q("unit")) q("unit").textContent = perm ? "per year" : "per day";
        if (q("range")) q("range").textContent = rok ? money(conv(r[0])) + " to " + money(conv(r[1])) : NA;
        if (q("fill")) q("fill").style.width = rok ? Math.max(6, pos(m, b)) + "%" : "0%";
        card.classList.toggle("is-active", lv === state.level);
      });
    }

    function press(group, btn) {
      group.forEach(function (x) { x.setAttribute("aria-pressed", x === btn ? "true" : "false"); });
    }
    chips.forEach(function (c, i) {
      c.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      c.addEventListener("click", function () { state.skill = skills[i]; press(chips, c); render(); });
    });
    ["level", "model"].forEach(function (k) {
      var btns = [].slice.call(document.querySelectorAll("[data-rc-" + k + "]"));
      btns.forEach(function (b) {
        b.addEventListener("click", function () { state[k] = b.getAttribute("data-rc-" + k); press(btns, b); render(); });
      });
    });

    // Highest-paid skills: bars from senior medians
    var rows = [].slice.call(document.querySelectorAll("[data-senior-high]")).filter(function (e) { return !e.hasAttribute("data-rc-chip"); });
    var meds = rows.map(function (e) { return (+e.getAttribute("data-senior-low") + +e.getAttribute("data-senior-high")) / 2; });
    var top = Math.max.apply(null, meds.concat([1]));
    rows.forEach(function (e, i) {
      var row = e.closest(".rc-row");
      if (!row) return;
      var v = row.querySelector(".rc-row_value"), f = row.querySelector(".rc-row_fill");
      if (v) v.textContent = meds[i] > 0 ? "£" + round(meds[i], 5) : NA;
      if (f) f.style.width = meds[i] > 0 ? Math.round(meds[i] / top * 100) + "%" : "0%";
    });

    render();
  
}

/* --------------------------------------------------------------------------
   46. MOCK PEOPLE  .hero-ui_avatar, .hero-talent_avatar, img.av, img.lw-av
   --------------------------------------------------------------------------
   Client, 15 Nov 2026: in the HTML/CSS product mockups (not the real talent
   cards) stock photos are replaced by initials and the name next to them is
   shortened to "First L.". Widgets drawn later by script are caught by a
   MutationObserver. Styles: yotewo.css block 69 (.mock-av). */
(function () {
  var SEL = ".hero-ui_avatar, .hero-talent_avatar, img.av, img.lw-av";
  var NAME = /^([A-Z][A-Za-z'’\-]+)\s+([A-Z])[A-Za-z'’\-]+$/;
  var SPARE = ["AK", "MS", "JL", "RT", "EN", "DP"], spare = 0;
  /* Two capitalised words that are a role, a place or a label, not a person. */
  var ROLE = /Developer|Engineer|Designer|Architect|Manager|Consultant|Analyst|Scientist|Lead|Stack|Time|States|Kingdom|Work|Check|Match|Rate|Profile|Quick|Product|Data|Software|Senior|Junior|Head|Team|Review|Hire|Now|Meet|\b(?:Strong|Compatibility|Join|Next|Step|Role|Details|View|Extra|Current|Cap|Hours?|Tracking|Referral|List|See|All|Question|Flexible|Schedule|Level|Get|Started|Registered|Active|Clients|Previous)\b/;
  /* The text node of a leaf. A name that carries an icon (verified badge)
     still counts: only children with text of their own rule it out. */
  function txt(el) {
    var t = null;
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) { if (t) return null; t = n; } }
      else if (n.nodeType === 1 && n.textContent.trim()) return null;
    }
    return t;
  }
  /* Client, 15 Nov 2026 (round 12): one colour scheme for every mock profile,
     as on the solutions hero: a dark circle with white initials on a light
     surface, a translucent white circle on a dark one (is-dk, yotewo.css
     block 74). The surface is read from the colour of the text beside the
     circle. First names that do not read as British are swapped for ones with
     the same initial. */
  var BRIT = { Harper: "Harriet", Tomas: "Thomas", Sophia: "Sophie", Mike: "Michael", Alyson: "Alice", Hanna: "Hannah" };
  /* Client, 16 Nov 2026: names stay mostly British with some international
     ones mixed in. Keyed by first name and surname initial, same initials. */
  var PAIR = { "James P": "Jamal", "David M": "Diego", "Amelia S": "Aisha", "Daniel K": "Darius", "Sophie L": "Sana", "Laura C": "Lucia" };
  function rgb(c) {
    var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s\/]+([\d.]+))?/.exec(c || "");
    return m ? { l: 0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  }
  function paint(el, name) {
    var row = el.parentElement, dark = null, c, cs;
    /* The name beside the circle tells the surface best: dark text sits on a
       light card, white text on a dark one. */
    if (name) {
      c = rgb(getComputedStyle(name).color);
      if (c) dark = c.l > 150;
    }
    /* The surface under the circle: the first ancestor with a solid colour.
       Glass cards are see-through, so they pass to what lies behind them. */
    for (var p = row; p && dark === null && p !== document.documentElement; p = p.parentElement) {
      cs = getComputedStyle(p);
      c = rgb(cs.backgroundColor);
      if (c && c.a >= 0.5) dark = c.l < 110;
      else if (cs.backgroundImage && cs.backgroundImage !== "none") break;
    }
    /* No solid colour found (a picture or gradient behind): light text
       beside the circle means a dark surface. */
    if (dark === null && row) {
      var k = row.querySelectorAll("*");
      for (var i = 0; i < k.length && dark === null; i++) {
        var n = k[i];
        if (n === el || el.contains(n) || n.children.length || !n.textContent.trim()) continue;
        if (n.closest(".mock-av, .mock-ini, .lw-av")) continue;
        c = rgb(getComputedStyle(n).color);
        if (c) dark = c.l > 150;
      }
    }
    el.classList.toggle("is-dk", !!dark);
    el.classList.toggle("is-lt", !dark);
  }
  function leafName(root) {
    var els = root.querySelectorAll("*");
    for (var i = 0; i < els.length; i++) {
      var el = els[i], tn = txt(el);
      if (!tn || el.closest(".mock-av")) continue;
      var tx = tn.nodeValue.replace(/\s+/g, " ").trim();
      if (ROLE.test(tx)) continue;
      var m = NAME.exec(tx);
      if (m) return { el: tn, node: el, m: m };
      var done = /^([A-Z])[a-z'’\-]+\s([A-Z])\.$/.exec(tx);
      if (done) return { el: null, node: el, m: [0, done[1], done[2]] };
    }
    return null;
  }
  function fix(img) {
    if (!img || img.tagName !== "IMG" || img.__mp) return;
    img.__mp = 1;
    if (img.closest(".div-talent, .div-talent-card, [data-talent]")) return;
    var ini = "", hit = null, row = img.parentElement;
    var alt = NAME.exec((img.getAttribute("alt") || "").trim());
    if (alt) ini = alt[1].charAt(0) + alt[2];
    for (var k = 0; k < 2 && row && !hit; k++, row = row.parentElement) {
      if (row.querySelectorAll(SEL + ", .mock-av").length > 1) break;
      hit = leafName(row);
    }
    if (hit) {
      ini = hit.m[1].charAt(0) + hit.m[2];
      if (hit.el) hit.el.textContent = hit.m[1] + " " + hit.m[2] + ".";
    }
    if (!ini) ini = SPARE[spare++ % SPARE.length];
    var sp = document.createElement("span");
    sp.className = img.className + " mock-av";
    if (img.getAttribute("style")) sp.setAttribute("style", img.getAttribute("style"));
    sp.setAttribute("aria-hidden", "true");
    var i = document.createElement("i");
    i.textContent = ini.toUpperCase();
    sp.appendChild(i);
    img.parentNode.replaceChild(sp, img);
    paint(sp, hit && hit.node);
  }
  function sweep(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches(SEL)) fix(root);
    var l = root.querySelectorAll ? root.querySelectorAll(SEL) : [];
    for (var i = 0; i < l.length; i++) fix(l[i]);
  }
  /* Mockups that already draw initials (a square or round tile with two
     capitals): the tile becomes a circle and the name beside it gets the
     short form, so every mock profile on the site reads the same. */
  var BOX = ".lw, .hero-ui, .hero-talents, .hiw-dialog, .pn-stack";
  function initials(root) {
    if (!root || !root.querySelectorAll) return;
    var els = root.querySelectorAll("*");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var tn0 = txt(el);
      if (tn0) {
        var nm = /^([A-Z][a-z]+)(\s+([A-Z])[A-Za-z.'’\-]*)$/.exec(tn0.nodeValue.trim());
        var sw = nm && (PAIR[nm[1] + " " + nm[3]] || BRIT[nm[1]]);
        if (sw) tn0.nodeValue = sw + nm[2];
      }
      if (el.__mi || el.children.length || el.closest(".mock-av")) continue;
      var tx0 = el.textContent.trim();
      /* A single letter counts only on an avatar element (lw-av and alike). */
      if (!/^[A-Z]{2}$/.test(tx0) && !(/^[A-Z]$/.test(tx0) && /(^|[\s_-])av(\s|$)/.test(el.className || ""))) continue;
      var w = el.offsetWidth, h = el.offsetHeight;
      if (!w || w > 90 || Math.abs(w - h) > w * 0.12) continue;
      el.__mi = 1;
      el.classList.add("mock-ini");
      var row = el.parentElement, hit = null;
      for (var k = 0; k < 2 && row && !hit; k++, row = row.parentElement) {
        if (row.querySelectorAll(".mock-ini, .mock-av").length > 1) break;
        hit = leafName(row);
      }
      if (hit && hit.el) hit.el.textContent = hit.m[1] + " " + hit.m[2] + ".";
      if (hit && tx0.length === 1) el.textContent = (hit.m[1].charAt(0) + hit.m[2]).toUpperCase();
      paint(el, hit && hit.node);
    }
  }
  function boxes(node) {
    if (!node || node.nodeType !== 1) return;
    var up = node.closest ? node.closest(BOX) : null;
    if (up) { initials(up); return; }
    var l = node.querySelectorAll ? node.querySelectorAll(BOX) : [];
    for (var i = 0; i < l.length; i++) initials(l[i]);
  }
  /* Names without a photo in the people rows of the home hero mockup get the
     same short form. Kept to those rows: skill chips are two capitalised
     words too. */
  function tidy() {
    var els = document.querySelectorAll(".hero-ui_row *, .hero-ui_match *");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.children.length || el.closest(".mock-av")) continue;
      var tx = el.textContent.replace(/\s+/g, " ").trim();
      if (ROLE.test(tx)) continue;
      var m = NAME.exec(tx);
      if (m) el.textContent = m[1] + " " + m[2] + ".";
    }
  }
  /* Client, 16 Nov 2026: wording of the home hero mockup. The mockup is a
     Webflow embed; its text is corrected here and the embed stays hidden
     (yotewo.css block 77) until this has run, so the old wording and
     photos never show on load. */
  var HERO_TXT = { "Frontend Architect": "Frontend Engineer", "React Developer": "Full-Stack Engineer", "UI Engineer": "Solution Architect", "QA Engineer": "React Engineer", "Web Designer": "UI Designer", "Full-Stack Developer": "Full-Stack Engineer", "Senior Frontend Engineer": "Frontend Engineer", "Looking for a Senior Frontend Engineer": "Looking for a Frontend Engineer", "EU timezone": "GMT timezone", "Pre-vetted IT professionals only": "Pre-vetted engineers only", "£28/h": "£48/h", "Frontend Developers": "Frontend Engineers", "UI Developers 8": "UI Engineers 8" };
  function heroText() {
    var roots = document.querySelectorAll(".hero-ui");
    for (var r = 0; r < roots.length; r++) {
      var w = document.createTreeWalker(roots[r], NodeFilter.SHOW_TEXT, null), n;
      while ((n = w.nextNode())) {
        var v = n.nodeValue, k = v.replace(/\s+/g, " ").trim();
        if (!k) continue;
        if (HERO_TXT[k]) n.nodeValue = v.replace(v.trim(), HERO_TXT[k]);
        else if (k.indexOf("EU timezone") >= 0) n.nodeValue = v.replace("EU timezone", "GMT timezone");
      }
    }
  }
  function ready() {
    var l = document.querySelectorAll(".hero-ui, .hiw-dialog, .hero-talents");
    for (var i = 0; i < l.length; i++) l[i].classList.add("mock-ready");
  }
  function run() {
    sweep(document.body);
    tidy();
    heroText();
    boxes(document.body);
    ready();
    /* Widgets that are measured later (hidden tabs, lazy slots). */
    setTimeout(function () { boxes(document.body); }, 1500);
    window.addEventListener("load", function () { boxes(document.body); });
    if (!window.MutationObserver) return;
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var add = list[i].addedNodes;
        for (var j = 0; j < add.length; j++) { sweep(add[j]); boxes(add[j]); }
      }
    }).observe(document.body, { childList: true, subtree: true });
    /* A widget that was hidden or unsized when it mounted is read again when
       it plays its entrance (class change), so nothing waits for a timer. */
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var t = list[i].target;
        if (t.classList && t.classList.contains("lw")) initials(t);
      }
    }).observe(document.body, { attributes: true, attributeFilter: ["class"], subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();

/* --------------------------------------------------------------------------
   47. PARTNER BOARD  /for-partners hero (.pn-stack)
   --------------------------------------------------------------------------
   Client, 15 Nov 2026: the notification stack in the For Partners hero is
   replaced by a referral dashboard in the style of the Hours and approvals
   mockup: three referrals at the stages the page describes (signed up,
   hiring, billed) and the fee card. The old embed stays in the page, hidden
   by yotewo.css block 69. Amount and wording follow the old mockup and the
   page copy (10% of the value, paid when the company is billed). */
(function () {
  function run() {
    var old = document.querySelector(".pn-stack");
    if (!old || old.parentNode.querySelector(".pr-board")) return;
    var b = document.createElement("div");
    b.className = "pr-board";
    b.setAttribute("aria-hidden", "true");
    b.innerHTML =
      '<div class="pr-card pr-main"><div class="pr-head"><span class="pr-title">Your referrals</span><span class="pr-badge">3 active</span></div>' +
      '<div class="pr-rows">' +
      '<div class="pr-row"><span class="pr-av">TB</span><span class="pr-name">Tom B.</span><span class="pr-st">2 engineers hired</span><span class="pr-fee">£184.13</span><span class="pr-chip is-ok">Billed</span></div>' +
      '<div class="pr-row"><span class="pr-av">MR</span><span class="pr-name">Maya R.</span><span class="pr-st">Interviewing engineers</span><span class="pr-fee"></span><span class="pr-chip is-run">Hiring</span></div>' +
      '<div class="pr-row"><span class="pr-av">OC</span><span class="pr-name">Oliver C.</span><span class="pr-st">Joined through your link</span><span class="pr-fee"></span><span class="pr-chip">Signed up</span></div>' +
      '</div></div>' +
      '<div class="pr-card pr-pay"><div class="pr-head"><span class="pr-title">Referral fee</span><span class="pr-badge is-blue">10% of the value</span></div>' +
      '<div class="pr-payrow"><span class="pr-ic">£</span><span class="pr-paytx"><b>Tom B.</b><small>Paid when the company is billed</small></span><span class="pr-amt">£184.13</span></div></div>';
    old.parentNode.insertBefore(b, old.nextSibling);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();


/* Analytics (17 Nov 2026, after the move to yotewo.com). Same IDs as the old WordPress site: GA4 G-XB7CSB61P9 and GTM-MWMPSQ9Q,
   so reporting continues in the same property. As on the old site they load late so they never slow the first paint, but now on
   whichever comes first: the first scroll / click / mouse move / touch, or 3.5 s after load (the old site waited for interaction
   only and so lost visits that never moved the mouse). Note: the old site also loaded both GA4 and GTM; if the GTM container
   fires the same GA4 tag, page views count twice (same as before). Only on yotewo.com, so staging and previews stay out of reports. */
(function () {
  if (!/(^|\.)yotewo\.com$/.test(location.hostname)) return;
  var GA = "G-XB7CSB61P9", GTM = "GTM-MWMPSQ9Q", done = false, EV = ["scroll", "click", "mousemove", "touchstart", "keydown"];
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  function add(src) { var s = document.createElement("script"); s.async = true; s.src = src; document.head.appendChild(s); }
  function go() {
    if (done) return; done = true;
    EV.forEach(function (e) { window.removeEventListener(e, go, { passive: true }); });
    if (!document.querySelector('script[src*="gtag/js?id=' + GA + '"]')) {
      add("https://www.googletagmanager.com/gtag/js?id=" + GA);
      window.gtag("js", new Date());
      window.gtag("config", GA);
    }
    if (!document.querySelector('script[src*="gtm.js?id=' + GTM + '"]')) {
      window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
      add("https://www.googletagmanager.com/gtm.js?id=" + GTM);
    }
  }
  EV.forEach(function (e) { window.addEventListener(e, go, { passive: true }); });
  function later() { setTimeout(go, 3500); }
  if (document.readyState === "complete") later(); else window.addEventListener("load", later);
})();

/* ===== 60. Event speakers without a photo (17 Nov): initials tile in place of the empty CMS image ===== */
(function () {
  function run() {
    document.querySelectorAll(".ev-speaker").forEach(function (s) {
      var img = s.querySelector(".ev-speaker_img");
      if (!img || s.querySelector(".ev-speaker_ini")) return;
      if (img.getAttribute("src") && !img.classList.contains("w-dyn-bind-empty")) return;
      var name = ((s.querySelector(".ev-speaker_name") || {}).textContent || "").trim().split(/\s+/).filter(Boolean);
      var ini = ((name[0] || "")[0] || "") + ((name.length > 1 ? name[name.length - 1] : "")[0] || "");
      var d = document.createElement("div");
      d.className = "ev-speaker_ini";
      d.setAttribute("aria-hidden", "true");
      d.textContent = ini.toUpperCase();
      img.parentNode.insertBefore(d, img);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();

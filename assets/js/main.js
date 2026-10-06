(function () {
  var base = document.currentScript ? document.currentScript.dataset.base || "" : "";

  // ---------- Theme toggle ----------
  var root = document.documentElement;
  var toggle = document.querySelector(".theme-toggle");
  function isDark() {
    var t = root.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      document.dispatchEvent(new Event("themechange"));
    });
  }

  // ---------- Charts ----------
  var NS = "http://www.w3.org/2000/svg";
  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function fmtStep(v) { return v >= 1000 ? (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + "k" : String(v); }
  function fmtPct(v) { return Math.round(v * 100) + "%"; }
  function scale(ax, lo, hi) {
    if (ax.type === "log") {
      var a = Math.log(ax.min), b = Math.log(ax.max);
      return function (v) { return lo + (Math.log(Math.max(v, ax.min)) - a) / (b - a) * (hi - lo); };
    }
    return function (v) { return lo + (v - ax.min) / (ax.max - ax.min) * (hi - lo); };
  }
  function nearest(xs, x) {
    var lo = 0, hi = xs.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (xs[mid] < x) lo = mid; else hi = mid; }
    return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi;
  }
  function legendHTML(items) {
    return items.map(function (it) {
      return '<span class="' + (it.faint ? "faint" : "") + '" style="--c:var(' + it.color + ')">' + it.label + "</span>";
    }).join("");
  }

  // Line chart. opts: { W, H, x:{type,min,max,ticks,fmt,title}, y:{type,min,max,ticks,fmt,title},
  //   legend:[{label,color,faint}], tipTitle(x) } ; draw(series, marks) can be called again to update.
  //   series: [{label, color, xs, ys, width, alpha, hover, fmt}]  marks: [{x, label}] (vertical markers)
  function lineChart(host, opts) {
    var W = opts.W || 480, H = opts.H || 250;
    var m = { t: 14, r: 14, b: opts.x.title ? 42 : 30, l: opts.y.title ? 54 : 42 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var X = scale(opts.x, m.l, m.l + iw), Y = scale(opts.y, m.t + ih, m.t);
    if (opts.legend) {
      var lg = document.createElement("div"); lg.className = "legend"; lg.innerHTML = legendHTML(opts.legend);
      host.appendChild(lg);
    }
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, "aria-hidden": "true" }, host);
    var grid = el("g", { class: "grid" }, svg), axis = el("g", { class: "axis" }, svg);
    opts.y.ticks.forEach(function (v) {
      el("line", { x1: m.l, x2: m.l + iw, y1: Y(v), y2: Y(v) }, grid);
      el("text", { x: m.l - 8, y: Y(v) + 4, "text-anchor": "end" }, axis).textContent = (opts.y.fmt || String)(v);
    });
    opts.x.ticks.forEach(function (v) {
      el("text", { x: X(v), y: m.t + ih + 18, "text-anchor": "middle" }, axis).textContent = (opts.x.fmt || String)(v);
    });
    if (opts.x.title) el("text", { x: m.l + iw / 2, y: H - 4, "text-anchor": "middle", class: "label" }, axis).textContent = opts.x.title;
    if (opts.y.title) el("text", { x: 12, y: m.t + ih / 2, "text-anchor": "middle", class: "label",
      transform: "rotate(-90 12 " + (m.t + ih / 2) + ")" }, axis).textContent = opts.y.title;
    if (opts.band) {
      el("rect", { class: "band", x: m.l, width: iw, y: Y(opts.band.y1), height: Math.max(1, Y(opts.band.y0) - Y(opts.band.y1)) }, svg);
      el("text", { class: "band-label", x: m.l + iw - 4, y: Y(opts.band.y1) - 4, "text-anchor": "end" }, svg).textContent = opts.band.label;
    }
    var markG = el("g", {}, svg), lineG = el("g", {}, svg), labelG = el("g", {}, svg);

    var hover = el("g", { style: "display:none" }, svg);
    var cross = el("line", { class: "crosshair", y1: m.t, y2: m.t + ih }, hover);
    var tip = document.createElement("div"); tip.className = "tooltip"; host.appendChild(tip);
    var current = [], dots = [];

    function draw(series, marks, labels) {
      current = series;
      [markG, lineG, labelG].forEach(function (g) { while (g.firstChild) g.removeChild(g.firstChild); });
      dots.forEach(function (d) { if (d) d.remove(); }); dots = [];
      (marks || []).forEach(function (mk) {
        el("line", { class: "mark-line", x1: X(mk.x), x2: X(mk.x), y1: m.t, y2: m.t + ih }, markG);
        if (mk.label) el("text", { class: "mark-label", x: X(mk.x) + 4, y: m.t + 10 }, markG).textContent = mk.label;
      });
      series.forEach(function (sr) {
        var d = "";
        for (var i = 0; i < sr.xs.length; i++) {
          if (sr.xs[i] < opts.x.min) continue;
          d += (d ? "L" : "M") + X(sr.xs[i]).toFixed(1) + " " + Y(sr.ys[i]).toFixed(1);
        }
        el("path", { class: "line", d: d, style: "stroke:var(" + sr.color + ");stroke-width:" + (sr.width || 2) +
          ";opacity:" + (sr.alpha == null ? 1 : sr.alpha) }, lineG);
        if (sr.hover !== false) dots.push(el("circle", { class: "dot", r: 4.5, style: "fill:var(" + sr.color + ")" }, hover));
        else dots.push(null);
      });
      (labels || []).forEach(function (lb) {
        el("text", { class: "series-label", x: X(lb.x), y: Y(lb.y) + (lb.dy || 0), "text-anchor": lb.anchor || "start" }, labelG).textContent = lb.text;
      });
    }
    var hit = el("rect", { x: m.l, y: 0, width: iw, height: H, fill: "transparent" }, svg);
    function inv(px) {
      var t = (px - m.l) / iw;
      if (opts.x.type === "log") return Math.exp(Math.log(opts.x.min) + t * (Math.log(opts.x.max) - Math.log(opts.x.min)));
      return opts.x.min + t * (opts.x.max - opts.x.min);
    }
    function move(evt) {
      var r = svg.getBoundingClientRect(), px = (evt.clientX - r.left) / r.width * W;
      var xv = inv(Math.max(m.l, Math.min(m.l + iw, px))), rows = [], anchorX = null;
      current.forEach(function (sr, k) {
        var dot = dots[k];
        if (!dot) return;
        var i = nearest(sr.xs, xv), sx = X(sr.xs[i]);
        if (anchorX === null) anchorX = sr.xs[i];
        dot.setAttribute("cx", sx); dot.setAttribute("cy", Y(sr.ys[i]));
        rows.push('<span class="k" style="--c:var(' + sr.color + ')">' + sr.label + " " + (sr.fmt || opts.y.fmt || String)(sr.ys[i]) + "</span>");
      });
      if (anchorX === null) return;
      cross.setAttribute("x1", X(anchorX)); cross.setAttribute("x2", X(anchorX));
      hover.style.display = "";
      tip.innerHTML = "<b>" + (opts.tipTitle ? opts.tipTitle(anchorX) : anchorX) + "</b><br>" + rows.join("<br>");
      var hw = host.clientWidth, left = X(anchorX) / W * hw + 12;
      if (left + tip.offsetWidth > hw) left = X(anchorX) / W * hw - tip.offsetWidth - 12;
      tip.style.left = Math.max(0, left) + "px"; tip.style.top = (svg.getBoundingClientRect().top - host.getBoundingClientRect().top + 6) + "px"; tip.style.opacity = 1;
    }
    function leave() { hover.style.display = "none"; tip.style.opacity = 0; }
    hit.addEventListener("pointermove", move); hit.addEventListener("pointerdown", move);
    hit.addEventListener("pointerleave", leave);
    return { draw: draw };
  }

  // Dot chart for small scaling plots. points: [{x, y, tip}], ref: {xs, ys, label}
  function dotChart(host, opts) {
    var W = opts.W || 360, H = opts.H || 240;
    var m = { t: 14, r: 14, b: 42, l: 54 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    var X = scale(opts.x, m.l, m.l + iw), Y = scale(opts.y, m.t + ih, m.t);
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": opts.aria }, host);
    var grid = el("g", { class: "grid" }, svg), axis = el("g", { class: "axis" }, svg);
    opts.y.ticks.forEach(function (v) {
      el("line", { x1: m.l, x2: m.l + iw, y1: Y(v), y2: Y(v) }, grid);
      el("text", { x: m.l - 8, y: Y(v) + 4, "text-anchor": "end" }, axis).textContent = opts.y.fmt(v);
    });
    opts.x.ticks.forEach(function (v) {
      el("text", { x: X(v), y: m.t + ih + 18, "text-anchor": "middle" }, axis).textContent = opts.x.fmt(v);
    });
    el("text", { x: m.l + iw / 2, y: H - 4, "text-anchor": "middle", class: "label" }, axis).textContent = opts.x.title;
    el("text", { x: 12, y: m.t + ih / 2, "text-anchor": "middle", class: "label", transform: "rotate(-90 12 " + (m.t + ih / 2) + ")" }, axis).textContent = opts.y.title;
    if (opts.ref) {
      var d = opts.ref.xs.map(function (v, i) { return (i ? "L" : "M") + X(v).toFixed(1) + " " + Y(opts.ref.ys[i]).toFixed(1); }).join("");
      el("path", { class: "ref-line", d: d }, svg);
      var li = opts.ref.labelAt || 0;
      el("text", { class: "series-label", x: X(opts.ref.xs[li]) + 6, y: Y(opts.ref.ys[li]) - 6 }, svg).textContent = opts.ref.label;
    }
    if (opts.meanLine) {
      var md = opts.meanLine.map(function (p, i) { return (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); }).join("");
      el("path", { class: "line", d: md, style: "stroke:var(--series-1);stroke-width:1.5;opacity:.5" }, svg);
    }
    var tip = document.createElement("div"); tip.className = "tooltip"; host.appendChild(tip);
    opts.points.forEach(function (p) {
      var c = el("circle", { class: "dot pt", cx: X(p.x) + (p.jitter || 0), cy: Y(p.y), r: 5, style: "fill:var(--series-1)" }, svg);
      var hitc = el("circle", { cx: X(p.x) + (p.jitter || 0), cy: Y(p.y), r: 12, fill: "transparent" }, svg);
      function show() {
        c.setAttribute("r", 7); tip.innerHTML = p.tip; tip.style.opacity = 1;
        var hw = host.clientWidth, left = (X(p.x) / W) * hw + 12;
        if (left + tip.offsetWidth > hw) left = (X(p.x) / W) * hw - tip.offsetWidth - 12;
        tip.style.left = Math.max(0, left) + "px"; tip.style.top = Math.max(0, (Y(p.y) / H) * host.clientHeight - 40) + "px";
      }
      function hide() { c.setAttribute("r", 5); tip.style.opacity = 0; }
      hitc.addEventListener("pointerenter", show); hitc.addEventListener("pointerdown", show); hitc.addEventListener("pointerleave", hide);
    });
  }

  var accY = { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], fmt: fmtPct };
  var logStepX = { type: "log", min: 100, max: 100000, ticks: [100, 1000, 10000, 100000], fmt: fmtStep, title: "training step (log scale)" };
  function stepTitle(v) { return "Step " + v.toLocaleString(); }

  // Original single run (project card fallback / case study).
  function drawGrokking(host, data) {
    var c = lineChart(host, {
      x: { min: 0, max: data.step[data.step.length - 1], ticks: [0, 20000, 40000, 60000, 80000, 100000], fmt: fmtStep },
      y: accY, tipTitle: stepTitle,
      legend: [{ label: "Train accuracy", color: "--series-2" }, { label: "Validation accuracy", color: "--series-1" }]
    });
    c.draw([
      { label: "Train", color: "--series-2", xs: data.step, ys: data.train_acc },
      { label: "Validation", color: "--series-1", xs: data.step, ys: data.val_acc }
    ], [], [{ text: "train", x: 6000, y: 1, dy: -8 }, { text: "validation", x: 12000, y: 0.2 }]);
  }

  // Weight-decay explorer: buttons switch lambda; seed 0 bold, seeds 1-2 faint.
  function drawWdExplorer(host, data) {
    var keys = ["0", "0.1", "0.3", "1", "3"];
    var ctl = document.createElement("div"); ctl.className = "chart-controls";
    ctl.innerHTML = '<span class="ctl-label" id="wd-lbl">Weight decay λ</span><div class="opt-seg" role="radiogroup" aria-labelledby="wd-lbl">' +
      keys.map(function (k) { return '<button type="button" role="radio" aria-checked="false" data-k="' + k + '">' + k + "</button>"; }).join("") + "</div>";
    host.appendChild(ctl);
    var readout = document.createElement("p"); readout.className = "chart-readout"; readout.setAttribute("aria-live", "polite");
    host.appendChild(readout);
    var c = lineChart(host, {
      x: logStepX, y: accY, tipTitle: stepTitle,
      legend: [{ label: "Train (seed 0)", color: "--series-2" }, { label: "Validation (seed 0)", color: "--series-1" },
               { label: "Validation (seeds 1–2)", color: "--series-1", faint: true }]
    });
    host.insertAdjacentHTML("beforeend", '<p class="panel-sub">Weight norm ‖w‖ (log scale), seed 0</p>');
    var wnHost = document.createElement("div"); wnHost.className = "chart"; host.appendChild(wnHost);
    var wn = lineChart(wnHost, {
      H: 130, x: { type: "log", min: 100, max: 100000, ticks: [100, 1000, 10000, 100000], fmt: fmtStep },
      y: { type: "log", min: 20, max: 3000, ticks: [25, 100, 500, 2500], fmt: String }, tipTitle: stepTitle,
      band: { y0: 27, y1: 35, label: "every run grokked at ‖w‖ ≈ 27–35" }
    });
    function show(k) {
      var runs = data.wd[k], r0 = runs[0], series = [];
      wn.draw([{ label: "‖w‖", color: "--text-2", xs: r0.step, ys: r0.weight_norm, width: 1.5, fmt: function (v) { return v.toFixed(1); } }],
        r0.grok ? [{ x: r0.grok }] : []);
      runs.slice(1).forEach(function (r) {
        series.push({ label: "Val s" + r.seed, color: "--series-1", xs: r.step, ys: r.val_acc, width: 1.25, alpha: 0.35, hover: false });
      });
      series.push({ label: "Train", color: "--series-2", xs: r0.step, ys: r0.train_acc });
      series.push({ label: "Validation", color: "--series-1", xs: r0.step, ys: r0.val_acc });
      var groks = runs.map(function (r) { return r.grok; }).filter(Boolean);
      c.draw(series, r0.grok ? [{ x: r0.grok, label: "grokked" }] : []);
      if (groks.length) {
        var lo = Math.min.apply(null, groks), hi = Math.max.apply(null, groks);
        readout.innerHTML = "λ = " + k + ": grokked at step <b>" + r0.grok.toLocaleString() + "</b> (seed 0" +
          (runs.length > 1 ? "; all " + runs.length + " seeds " + lo.toLocaleString() + "–" + hi.toLocaleString() : "") + ")";
      } else {
        var finals = runs.map(function (r) { return r.val_acc[r.val_acc.length - 1]; });
        readout.innerHTML = "λ = " + k + ": <b>no seed grokked</b> in 100k steps; final validation accuracy " +
          fmtPct(Math.min.apply(null, finals)) + "–" + fmtPct(Math.max.apply(null, finals)) + ".";
      }
      ctl.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-checked", b.dataset.k === k ? "true" : "false"); });
    }
    ctl.querySelectorAll("button").forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.k); }); });
    show(host.dataset.start || "0.1");
  }

  // Time-to-grok vs weight decay (log-log, with 1/lambda reference) and vs width.
  function drawScaling(host, data) {
    host.classList.add("chart-pair");
    var wd = data.scaling.wd.filter(function (r) { return r.grok; });
    var C = wd.reduce(function (s, r) { return s + r.wd * r.grok; }, 0) / wd.length;
    var none = data.scaling.wd.filter(function (r) { return !r.grok; });
    var a = document.createElement("div"); a.className = "chart-panel"; host.appendChild(a);
    a.insertAdjacentHTML("beforeend", '<p class="panel-title">Steps to grok vs. weight decay</p>');
    var jit = { 0: -5, 1: 0, 2: 5 };
    dotChart(a, {
      aria: "Steps to grok against weight decay on log-log axes; points fall on a line proportional to one over lambda.",
      x: { type: "log", min: 0.07, max: 4.5, ticks: [0.1, 0.3, 1, 3], fmt: String, title: "weight decay λ (log)" },
      y: { type: "log", min: 600, max: 60000, ticks: [1000, 3000, 10000, 30000], fmt: fmtStep, title: "steps to grok (log)" },
      ref: { xs: [0.08, 4], ys: [C / 0.08, C / 4], label: "∝ 1/λ", labelAt: 0 },
      points: wd.map(function (r) { return { x: r.wd, y: r.grok, jitter: jit[r.seed] || 0,
        tip: "<b>λ = " + r.wd + ", seed " + r.seed + "</b><br>grokked at step " + r.grok.toLocaleString() }; })
    });
    if (none.length) a.insertAdjacentHTML("beforeend", '<p class="panel-note">λ = 0: ' + none.length + "/" + none.length +
      " seeds never grokked in 100k steps. For the rest, λ × steps ≈ " + (Math.round(C / 100) * 100).toLocaleString() + ".</p>");
    var b = document.createElement("div"); b.className = "chart-panel"; host.appendChild(b);
    b.insertAdjacentHTML("beforeend", '<p class="panel-title">Steps to grok vs. width (λ = 1)</p>');
    var w = data.scaling.width, ds = [64, 128, 256, 512];
    var means = ds.map(function (d) { var g = w.filter(function (r) { return r.d === d; }); return [d, g.reduce(function (s, r) { return s + r.grok; }, 0) / g.length]; });
    dotChart(b, {
      aria: "Steps to grok against model width: 64 groks around 3,400 steps, 512 around 2,250.",
      x: { type: "log", min: 48, max: 680, ticks: ds, fmt: String, title: "width d (log)" },
      y: { min: 0, max: 4000, ticks: [0, 1000, 2000, 3000, 4000], fmt: fmtStep, title: "steps to grok" },
      meanLine: means,
      points: w.map(function (r) { return { x: r.d, y: r.grok, jitter: r.seed ? 5 : -5,
        tip: "<b>d = " + r.d + ", seed " + r.seed + "</b><br>grokked at step " + r.grok.toLocaleString() }; })
    });
    b.insertAdjacentHTML("beforeend", '<p class="panel-note">8× wider ≈ 1.5× fewer steps, but each step costs ~16× more compute.</p>');
  }

  // The dip: beta2 0.999 vs 0.98, accuracy and weight norm; buttons switch seed.
  function drawDip(host, data) {
    var ctl = document.createElement("div"); ctl.className = "chart-controls";
    ctl.innerHTML = '<span class="ctl-label" id="dip-lbl">Seed</span><div class="opt-seg" role="radiogroup" aria-labelledby="dip-lbl">' +
      '<button type="button" role="radio" data-s="0">0</button><button type="button" role="radio" data-s="1">1</button></div>' +
      '<div class="legend">' + legendHTML([{ label: "Train accuracy", color: "--series-2" }, { label: "Validation accuracy", color: "--series-1" },
        { label: "Weight norm", color: "--text-2" }]) + "</div>";
    host.appendChild(ctl);
    var pair = document.createElement("div"); pair.className = "chart-pair"; host.appendChild(pair);
    var linX = { min: 0, max: 100000, ticks: [0, 25000, 50000, 75000, 100000], fmt: fmtStep };
    function show(seed) {
      pair.textContent = "";
      ["0.999", "0.98"].forEach(function (k) {
        var r = data.dip[k].filter(function (x) { return x.seed === seed; })[0];
        var p = document.createElement("div"); p.className = "chart-panel"; pair.appendChild(p);
        p.insertAdjacentHTML("beforeend", '<p class="panel-title">Adam β2 = ' + k + (k === "0.999" ? " (PyTorch default)" : "") + "</p>");
        var acc = document.createElement("div"); acc.className = "chart"; p.appendChild(acc);
        lineChart(acc, { H: 200, x: linX, y: accY, tipTitle: stepTitle }).draw([
          { label: "Train", color: "--series-2", xs: r.step, ys: r.train_acc, width: 1.5 },
          { label: "Validation", color: "--series-1", xs: r.step, ys: r.val_acc, width: 1.5 }
        ], [{ x: r.grok, label: "grokked" }]);
        p.insertAdjacentHTML("beforeend", '<p class="panel-sub">Weight norm ‖w‖</p>');
        var wn = document.createElement("div"); wn.className = "chart"; p.appendChild(wn);
        lineChart(wn, { H: 120, x: linX, y: { min: 0, max: 500, ticks: [0, 250, 500], fmt: String }, tipTitle: stepTitle }).draw([
          { label: "‖w‖", color: "--text-2", xs: r.step, ys: r.weight_norm, width: 1.5, fmt: function (v) { return v.toFixed(1); } }
        ], [{ x: r.grok }]);
      });
      ctl.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-checked", +b.dataset.s === seed ? "true" : "false"); });
    }
    ctl.querySelectorAll("button").forEach(function (b) { b.addEventListener("click", function () { show(+b.dataset.s); }); });
    show(+(host.dataset.seed || 0));
  }

  var charts = {
    grokking: { url: "/assets/data/grokking.json", draw: drawGrokking },
    "grokking-wd": { url: "/assets/data/grokking-sweep.json", draw: drawWdExplorer },
    "grokking-scaling": { url: "/assets/data/grokking-sweep.json", draw: drawScaling },
    "grokking-dip": { url: "/assets/data/grokking-sweep.json", draw: drawDip }
  };
  var dataCache = {};
  document.querySelectorAll("[data-chart]").forEach(function (host) {
    var c = charts[host.dataset.chart];
    if (!c) return;
    dataCache[c.url] = dataCache[c.url] || fetch(base + c.url).then(function (r) { return r.json(); });
    dataCache[c.url]
      .then(function (d) { c.draw(host, d); })
      .catch(function () { (host.closest("figure") || host).style.display = "none"; });
  });
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    document.dispatchEvent(new Event("themechange"));
  });
  function whenVisible(elm, onChange) {
    if (!("IntersectionObserver" in window)) { onChange(true); return; }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { onChange(e.isIntersecting); });
    }, { threshold: 0.15 }).observe(elm);
  }

  // ---------- Terminal demo ----------
  document.querySelectorAll("[data-term]").forEach(function (body) {
    var script = JSON.parse(body.getAttribute("data-term"));
    var timer = null, started = false;
    function esc(t) { return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function renderAll() {
      body.innerHTML = script.map(function (l) {
        return '<span class="tp">' + esc(l.p) + "</span>" + esc(l.c) + (l.o ? '\n<span class="to">' + esc(l.o) + "</span>" : "");
      }).join("\n") + '\n<span class="tp">' + esc(script[script.length - 1].p) + '</span><span class="cursor"></span>';
    }
    if (reduceMotion) { renderAll(); return; }
    function play() {
      var html = "", li = 0, ci = 0;
      function frame(extra) { body.innerHTML = html + (extra || "") + '<span class="cursor"></span>'; }
      function step() {
        if (li >= script.length) { timer = setTimeout(function () { play(); }, 3500); return; }
        var l = script[li];
        if (ci === 0) html += (li ? "\n" : "") + '<span class="tp">' + esc(l.p) + "</span>";
        if (ci < l.c.length) {
          html += esc(l.c[ci++]); frame();
          timer = setTimeout(step, 28 + Math.random() * 40);
        } else {
          if (l.o) html += '\n<span class="to">' + esc(l.o) + "</span>";
          li++; ci = 0; frame();
          timer = setTimeout(step, l.o ? 700 : 450);
        }
      }
      html = ""; frame(); timer = setTimeout(step, 500);
    }
    whenVisible(body, function (vis) {
      if (vis && !started) { started = true; play(); }
    });
  });

  // ---------- Hero: optimizers on a toy loss surface ----------
  // Ambient momentum-SGD particles until someone clicks; then each click drops
  // balls that descend with the selected optimizer (or all three to compare).
  var canvas = document.getElementById("landscape");
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d");
    var stage = canvas.parentNode;
    var hero = canvas.closest(".hero-art");
    // Loss = bowl + three Gaussian wells + a little ripple (x, y in [-1, 1]).
    var wells = [
      { x: -0.45, y: -0.25, a: 0.95, s: 0.10 },
      { x: 0.5, y: 0.35, a: 0.8, s: 0.08 },
      { x: 0.25, y: -0.6, a: 0.55, s: 0.05 }
    ];
    function loss(x, y) {
      var f = 0.55 * (x * x + y * y) + 0.06 * Math.sin(4 * x) * Math.cos(5 * y);
      for (var i = 0; i < wells.length; i++) {
        var w = wells[i], dx = x - w.x, dy = y - w.y;
        f -= w.a * Math.exp(-(dx * dx + dy * dy) / w.s);
      }
      return f;
    }
    function grad(x, y) {
      var h = 1e-3;
      return [(loss(x + h, y) - loss(x - h, y)) / (2 * h), (loss(x, y + h) - loss(x, y - h)) / (2 * h)];
    }

    // Optimizers share one interface: step(ball, grad) -> [dx, dy].
    var OPT = {
      sgd: { name: "SGD", color: "--opt-sgd", shape: "circle",
        init: function () { return {}; },
        step: function (b, g) { return [-0.003 * g[0], -0.003 * g[1]]; } },
      momentum: { name: "Momentum", color: "--opt-momentum", shape: "square",
        init: function () { return { vx: 0, vy: 0 }; },
        step: function (b, g) {
          var s = b.st; s.vx = 0.95 * s.vx - 0.003 * g[0]; s.vy = 0.95 * s.vy - 0.003 * g[1];
          return [s.vx, s.vy];
        } },
      adam: { name: "Adam", color: "--opt-adam", shape: "diamond",
        init: function () { return { m: [0, 0], v: [0, 0], t: 0 }; },
        step: function (b, g) {
          var s = b.st, lr = 0.01, b1 = 0.9, b2 = 0.999, out = [0, 0];
          s.t++;
          for (var k = 0; k < 2; k++) {
            s.m[k] = b1 * s.m[k] + (1 - b1) * g[k];
            s.v[k] = b2 * s.v[k] + (1 - b2) * g[k] * g[k];
            var mh = s.m[k] / (1 - Math.pow(b1, s.t)), vh = s.v[k] / (1 - Math.pow(b2, s.t));
            out[k] = -lr * mh / (Math.sqrt(vh) + 1e-8);
          }
          return out;
        } }
    };
    var ORDER = ["sgd", "momentum", "adam"];

    var W = 0, H = 0, dpr = 1, bg = null, colors = {}, running = false, raf = 0, visible = false;
    var ambient = [], balls = [], mode = "compare", latest = {};
    function toPx(x, y) { return [(x + 1) / 2 * W, (1 - (y + 1) / 2) * H]; }
    function toXY(px, py) { return [px / W * 2 - 1, 1 - py / H * 2]; }
    function readColors() {
      var cs = getComputedStyle(document.documentElement);
      function v(n) { return cs.getPropertyValue(n).trim(); }
      colors = { accent: v("--accent"), line: v("--border-strong"), surface: v("--surface") };
      ORDER.forEach(function (k) { colors[k] = v(OPT[k].color); });
    }

    // Contour lines via marching squares, cached to an offscreen canvas.
    function drawContours() {
      bg = document.createElement("canvas");
      bg.width = W * dpr; bg.height = H * dpr;
      var g = bg.getContext("2d");
      g.scale(dpr, dpr);
      var nx = 72, ny = Math.round(72 * H / W), vals = [], lo = Infinity, hi = -Infinity, i, j;
      for (j = 0; j <= ny; j++) {
        vals.push([]);
        for (i = 0; i <= nx; i++) {
          var q = loss(i / nx * 2 - 1, 1 - j / ny * 2);
          vals[j].push(q); lo = Math.min(lo, q); hi = Math.max(hi, q);
        }
      }
      var levels = 16, cw = W / nx, ch = H / ny;
      for (var k = 1; k < levels; k++) {
        var t = lo + (hi - lo) * Math.pow(k / levels, 1.6), depth = 1 - k / levels;
        g.strokeStyle = depth > 0.6 ? colors.accent : colors.line;
        g.globalAlpha = depth > 0.6 ? 0.25 + 0.35 * (depth - 0.6) / 0.4 : 0.55;
        g.lineWidth = 1;
        g.beginPath();
        for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) {
          var a = vals[j][i], b = vals[j][i + 1], c = vals[j + 1][i + 1], d = vals[j + 1][i];
          var idx = (a > t) * 8 + (b > t) * 4 + (c > t) * 2 + (d > t);
          if (idx === 0 || idx === 15) continue;
          var x0 = i * cw, y0 = j * ch;
          var T = [x0 + cw * (t - a) / (b - a), y0], R = [x0 + cw, y0 + ch * (t - b) / (c - b)];
          var B = [x0 + cw * (t - d) / (c - d), y0 + ch], L = [x0, y0 + ch * (t - a) / (d - a)];
          var segs = { 1: [L, B], 2: [B, R], 3: [L, R], 4: [T, R], 5: [L, T, B, R], 6: [T, B], 7: [L, T],
            8: [L, T], 9: [T, B], 10: [L, B, T, R], 11: [T, R], 12: [L, R], 13: [B, R], 14: [L, B] }[idx];
          for (var n = 0; n < segs.length; n += 2) { g.moveTo(segs[n][0], segs[n][1]); g.lineTo(segs[n + 1][0], segs[n + 1][1]); }
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    // Ambient particles: momentum SGD from random rim points, respawning.
    function spawnAmbient(p) {
      p = p || {};
      var ang = Math.random() * Math.PI * 2, r = 0.75 + Math.random() * 0.2;
      p.x = Math.cos(ang) * r; p.y = Math.sin(ang) * r;
      p.vx = 0; p.vy = 0; p.trail = []; p.rest = 0; p.age = 0; p.dead = false;
      return p;
    }
    function stepAmbient(p) {
      var gr = grad(p.x, p.y);
      p.vx = 0.9 * p.vx - 0.0035 * gr[0] + (Math.random() - 0.5) * 0.0006;
      p.vy = 0.9 * p.vy - 0.0035 * gr[1] + (Math.random() - 0.5) * 0.0006;
      p.x += p.vx; p.y += p.vy; p.age++;
      p.trail.push([p.x, p.y]);
      if (p.trail.length > 90) p.trail.shift();
      if (Math.hypot(p.vx, p.vy) < 0.0006) p.rest++;
      if (p.rest > 90 || p.age > 1400 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) {
        if (balls.length) { p.dead = true; p.trail.shift(); } else spawnAmbient(p);
      }
    }

    // User balls.
    function dropBalls(x, y) {
      stage.classList.add("used");
      var kinds = mode === "compare" ? ORDER : [mode];
      kinds.forEach(function (k) {
        var b = { kind: k, x: x, y: y, trail: [[x, y]], st: OPT[k].init(), steps: 0, rest: 0, done: false };
        balls.push(b);
        latest[k] = b;
        if (reduceMotion) { while (!b.done) stepBall(b); }
      });
      if (balls.length > 24) balls.splice(0, balls.length - 24);
      clearBtn.hidden = false;
      renderReadout();
      if (reduceMotion) draw(); else start();
    }
    function stepBall(b) {
      if (b.done) return;
      var d = OPT[b.kind].step(b, grad(b.x, b.y));
      b.x += d[0]; b.y += d[1]; b.steps++;
      b.trail.push([b.x, b.y]);
      if (Math.hypot(d[0], d[1]) < 0.00015) b.rest++; else b.rest = 0;
      if (b.rest > 30 || b.steps >= 3000 || Math.abs(b.x) > 1.5 || Math.abs(b.y) > 1.5) b.done = true;
    }

    function marker(k, x, y, r) {
      var shape = OPT[k] ? OPT[k].shape : "circle";
      ctx.beginPath();
      if (shape === "square") ctx.rect(x - r, y - r, 2 * r, 2 * r);
      else if (shape === "diamond") { r *= 1.25; ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
      else ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    function trail(tr, color, alphaMax, fade) {
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      for (var i = 1; i < tr.length; i++) {
        var a = toPx(tr[i - 1][0], tr[i - 1][1]), b = toPx(tr[i][0], tr[i][1]);
        ctx.globalAlpha = fade ? (i / tr.length) * alphaMax : alphaMax;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (bg) ctx.drawImage(bg, 0, 0, W, H);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      var faded = balls.length > 0;
      ambient.forEach(function (p) {
        if (p.trail.length < 2) return;
        trail(p.trail, colors.accent, faded ? 0.35 : 0.9, true);
        if (!p.dead) {
          var q = toPx(p.x, p.y);
          ctx.globalAlpha = faded ? 0.35 : 1;
          ctx.fillStyle = colors.accent; ctx.strokeStyle = colors.surface; ctx.lineWidth = 2;
          marker("ambient", q[0], q[1], 4);
        }
      });
      balls.forEach(function (b) {
        trail(b.trail, colors[b.kind], 0.9, false);
        var q = toPx(b.x, b.y), s = toPx(b.trail[0][0], b.trail[0][1]);
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.surface; ctx.strokeStyle = colors[b.kind]; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(s[0], s[1], 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = colors[b.kind]; ctx.strokeStyle = colors.surface; ctx.lineWidth = 2;
        marker(b.kind, q[0], q[1], 5);
      });
      ctx.globalAlpha = 1;
    }

    var readout = hero.querySelector(".opt-readout"), tbody = readout.querySelector("tbody");
    var lastReadout = "";
    function renderReadout() {
      var rows = ORDER.filter(function (k) { return latest[k]; }).map(function (k) {
        var b = latest[k];
        return '<tr><td><span class="opt-name"><i class="mk mk-' + k + '"></i>' + OPT[k].name + "</span></td><td>" +
          b.steps.toLocaleString() + (b.done ? "" : "…") + "</td><td>" + loss(b.x, b.y).toFixed(3) + "</td></tr>";
      }).join("");
      if (rows !== lastReadout) { tbody.innerHTML = rows; lastReadout = rows; }
      readout.hidden = !rows;
    }

    var frame = 0;
    function tick() {
      var busy = false;
      for (var k = 0; k < 2; k++) ambient.forEach(function (p) { if (p.dead) p.trail.shift(); else stepAmbient(p); });
      balls.forEach(function (b) { for (var k = 0; k < 4; k++) stepBall(b); if (!b.done) busy = true; });
      draw();
      if (++frame % 6 === 0 || !busy) renderReadout();
      var ambientLive = ambient.some(function (p) { return !p.dead || p.trail.length; });
      if (running && (busy || ambientLive)) raf = requestAnimationFrame(tick); else running = false;
    }
    function setup() {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      readColors(); drawContours();
      if (!ambient.length) {
        for (var i = 0; i < 9; i++) {
          var p = spawnAmbient(); p.age = Math.floor(Math.random() * 300);
          for (var k = 0; k < i * 25; k++) stepAmbient(p);
          ambient.push(p);
        }
        if (reduceMotion) ambient.forEach(function (p) { for (var k = 0; k < 120; k++) stepAmbient(p); });
      }
      draw();
    }
    function start() { if (!running && !reduceMotion && visible && !document.hidden) { running = true; raf = requestAnimationFrame(tick); } }
    function stop() { running = false; cancelAnimationFrame(raf); }

    canvas.addEventListener("pointerdown", function (e) {
      var r = canvas.getBoundingClientRect(), xy = toXY(e.clientX - r.left, e.clientY - r.top);
      dropBalls(xy[0], xy[1]);
    });
    canvas.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      var ang = Math.random() * Math.PI * 2, rr = 0.6 + Math.random() * 0.3;
      dropBalls(Math.cos(ang) * rr, Math.sin(ang) * rr);
    });
    var seg = hero.querySelectorAll(".opt-seg button");
    seg.forEach(function (btn) {
      btn.addEventListener("click", function () {
        mode = btn.dataset.opt;
        seg.forEach(function (o) { o.setAttribute("aria-checked", o === btn ? "true" : "false"); });
      });
    });
    var clearBtn = hero.querySelector(".opt-clear");
    clearBtn.addEventListener("click", function () {
      balls = []; latest = {}; clearBtn.hidden = true; renderReadout();
      stage.classList.remove("used");
      ambient.forEach(function (p) { if (p.dead) spawnAmbient(p); });
      if (reduceMotion) draw(); else start();
    });

    // The hidden terminal's `sgd` command releases all three from a random rim point.
    document.addEventListener("portfolio:drop", function () {
      var prev = mode, ang = Math.random() * Math.PI * 2, rr = 0.65 + Math.random() * 0.25;
      mode = "compare"; dropBalls(Math.cos(ang) * rr, Math.sin(ang) * rr); mode = prev;
    });

    setup();
    whenVisible(canvas, function (vis) { visible = vis; vis ? start() : stop(); });
    document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(setup, 150); });
    document.addEventListener("themechange", function () { requestAnimationFrame(function () { setup(); if (!running) draw(); }); });
  }
})();

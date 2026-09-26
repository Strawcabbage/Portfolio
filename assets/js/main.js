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

  // ---------- Grokking chart ----------
  var NS = "http://www.w3.org/2000/svg";
  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function drawGrokking(host, data) {
    var W = 480, H = 250, m = { t: 12, r: 12, b: 30, l: 40 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var xMax = data.step[data.step.length - 1];
    var x = function (v) { return m.l + (v / xMax) * iw; };
    var y = function (v) { return m.t + (1 - v) * ih; };

    var legend = document.createElement("div");
    legend.className = "legend";
    legend.innerHTML =
      '<span style="--c:var(--series-2)">Train accuracy</span>' +
      '<span style="--c:var(--series-1)">Validation accuracy</span>';
    host.appendChild(legend);

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, "aria-hidden": "true" }, host);

    var grid = el("g", { class: "grid" }, svg);
    var axis = el("g", { class: "axis" }, svg);
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }, grid);
      el("text", { x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }, axis).textContent = v * 100 + "%";
    });
    [0, 20000, 40000, 60000, 80000, 100000].forEach(function (v) {
      el("text", { x: x(v), y: H - 10, "text-anchor": "middle" }, axis).textContent = v === 0 ? "0" : v / 1000 + "k";
    });

    function path(key) {
      return data.step.map(function (s, i) {
        return (i ? "L" : "M") + x(s).toFixed(1) + " " + y(data[key][i]).toFixed(1);
      }).join("");
    }
    el("path", { class: "line s2", d: path("train_acc") }, svg);
    el("path", { class: "line s1", d: path("val_acc") }, svg);

    // Selective direct labels
    el("text", { class: "series-label", x: x(6000), y: y(1) - 8 }, svg).textContent = "train";
    el("text", { class: "series-label", x: x(12000), y: y(0.2) }, svg).textContent = "validation";

    // Hover layer: crosshair + tooltip
    var hover = el("g", { style: "display:none" }, svg);
    var cross = el("line", { class: "crosshair", y1: m.t, y2: m.t + ih }, hover);
    var d2 = el("circle", { class: "dot s2", r: 4.5 }, hover);
    var d1 = el("circle", { class: "dot s1", r: 4.5 }, hover);
    var tip = document.createElement("div");
    tip.className = "tooltip";
    host.appendChild(tip);

    var hit = el("rect", { x: m.l, y: 0, width: iw, height: H, fill: "transparent" }, svg);
    function pct(v) { return (v * 100).toFixed(1) + "%"; }
    function move(evt) {
      var pt = svg.getBoundingClientRect();
      var px = ((evt.clientX - pt.left) / pt.width) * W;
      var target = ((px - m.l) / iw) * xMax;
      var i = 0, best = Infinity;
      for (var j = 0; j < data.step.length; j++) {
        var dd = Math.abs(data.step[j] - target);
        if (dd < best) { best = dd; i = j; }
      }
      var sx = x(data.step[i]);
      cross.setAttribute("x1", sx); cross.setAttribute("x2", sx);
      d1.setAttribute("cx", sx); d1.setAttribute("cy", y(data.val_acc[i]));
      d2.setAttribute("cx", sx); d2.setAttribute("cy", y(data.train_acc[i]));
      hover.style.display = "";
      tip.innerHTML =
        "<b>Step " + data.step[i].toLocaleString() + "</b><br>" +
        '<span class="k" style="--c:var(--series-2)">Train ' + pct(data.train_acc[i]) + "</span><br>" +
        '<span class="k" style="--c:var(--series-1)">Validation ' + pct(data.val_acc[i]) + "</span>";
      var hostW = host.clientWidth, left = (sx / W) * hostW + 12;
      if (left + tip.offsetWidth > hostW) left = (sx / W) * hostW - tip.offsetWidth - 12;
      tip.style.left = Math.max(0, left) + "px";
      tip.style.top = legend.offsetHeight + 8 + "px";
      tip.style.opacity = 1;
    }
    function leave() { hover.style.display = "none"; tip.style.opacity = 0; }
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerdown", move);
    hit.addEventListener("pointerleave", leave);
  }

  var charts = { grokking: { url: "/assets/data/grokking.json", draw: drawGrokking } };
  document.querySelectorAll("[data-chart]").forEach(function (host) {
    var c = charts[host.dataset.chart];
    if (!c) return;
    fetch(base + c.url)
      .then(function (r) { return r.json(); })
      .then(function (d) { c.draw(host, d); })
      .catch(function () { host.closest("figure").style.display = "none"; });
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

  // ---------- Hero: gradient descent on a toy loss surface ----------
  var canvas = document.getElementById("landscape");
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d");
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

    var W = 0, H = 0, dpr = 1, bg = null, colors = {}, particles = [], running = false, raf = 0;
    function toPx(x, y) { return [(x + 1) / 2 * W, (1 - (y + 1) / 2) * H]; }
    function readColors() {
      var cs = getComputedStyle(document.documentElement);
      colors = {
        accent: cs.getPropertyValue("--accent").trim(),
        line: cs.getPropertyValue("--border-strong").trim(),
        muted: cs.getPropertyValue("--muted").trim(),
        surface: cs.getPropertyValue("--surface").trim()
      };
    }

    // Contour lines via marching squares, cached to an offscreen canvas.
    function drawContours() {
      bg = document.createElement("canvas");
      bg.width = W * dpr; bg.height = H * dpr;
      var g = bg.getContext("2d");
      g.scale(dpr, dpr);
      var nx = 72, ny = Math.round(72 * H / W), vals = [], lo = Infinity, hi = -Infinity;
      for (var j = 0; j <= ny; j++) {
        vals.push([]);
        for (var i = 0; i <= nx; i++) {
          var v = loss(i / nx * 2 - 1, 1 - j / ny * 2);
          vals[j].push(v); lo = Math.min(lo, v); hi = Math.max(hi, v);
        }
      }
      var levels = 16, cw = W / nx, ch = H / ny;
      for (var k = 1; k < levels; k++) {
        var t = lo + (hi - lo) * Math.pow(k / levels, 1.6);
        var depth = 1 - k / levels;
        g.strokeStyle = depth > 0.6 ? colors.accent : colors.line;
        g.globalAlpha = depth > 0.6 ? 0.25 + 0.35 * (depth - 0.6) / 0.4 : 0.55;
        g.lineWidth = 1;
        g.beginPath();
        for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) {
          var a = vals[j][i], b = vals[j][i + 1], c = vals[j + 1][i + 1], d = vals[j + 1][i];
          var idx = (a > t) * 8 + (b > t) * 4 + (c > t) * 2 + (d > t);
          if (idx === 0 || idx === 15) continue;
          var x0 = i * cw, y0 = j * ch;
          var top = [x0 + cw * (t - a) / (b - a), y0], right = [x0 + cw, y0 + ch * (t - b) / (c - b)];
          var bottom = [x0 + cw * (t - d) / (c - d), y0 + ch], left = [x0, y0 + ch * (t - a) / (d - a)];
          var segs = {
            1: [left, bottom], 2: [bottom, right], 3: [left, right], 4: [top, right], 5: [left, top, bottom, right],
            6: [top, bottom], 7: [left, top], 8: [left, top], 9: [top, bottom], 10: [left, bottom, top, right],
            11: [top, right], 12: [left, right], 13: [bottom, right], 14: [left, bottom]
          }[idx];
          for (var s2 = 0; s2 < segs.length; s2 += 2) {
            g.moveTo(segs[s2][0], segs[s2][1]); g.lineTo(segs[s2 + 1][0], segs[s2 + 1][1]);
          }
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    function spawn(p) {
      p = p || {};
      var ang = Math.random() * Math.PI * 2, r = 0.75 + Math.random() * 0.2;
      p.x = Math.cos(ang) * r; p.y = Math.sin(ang) * r;
      p.vx = 0; p.vy = 0; p.trail = []; p.rest = 0; p.age = 0;
      return p;
    }
    function stepParticle(p) {
      var gr = grad(p.x, p.y), beta = 0.9, lr = 0.0035;
      p.vx = beta * p.vx - lr * gr[0] + (Math.random() - 0.5) * 0.0006;
      p.vy = beta * p.vy - lr * gr[1] + (Math.random() - 0.5) * 0.0006;
      p.x += p.vx; p.y += p.vy; p.age++;
      p.trail.push([p.x, p.y]);
      if (p.trail.length > 90) p.trail.shift();
      if (Math.hypot(p.vx, p.vy) < 0.0006) p.rest++;
      if (p.rest > 90 || p.age > 1400 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) spawn(p);
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (bg) ctx.drawImage(bg, 0, 0, W, H);
      ctx.lineCap = "round";
      particles.forEach(function (p) {
        var tr = p.trail;
        for (var i = 1; i < tr.length; i++) {
          var a = toPx(tr[i - 1][0], tr[i - 1][1]), b = toPx(tr[i][0], tr[i][1]);
          ctx.globalAlpha = (i / tr.length) * 0.9;
          ctx.strokeStyle = colors.accent; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
        var q = toPx(p.x, p.y);
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.accent; ctx.strokeStyle = colors.surface; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
    function tick() {
      for (var k = 0; k < 2; k++) particles.forEach(stepParticle);
      draw();
      if (running) raf = requestAnimationFrame(tick);
    }
    function setup() {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      readColors(); drawContours();
      if (!particles.length) {
        for (var i = 0; i < 9; i++) {
          var p = spawn(); p.age = Math.floor(Math.random() * 300);
          for (var k = 0; k < i * 25; k++) stepParticle(p);
          particles.push(p);
        }
        if (reduceMotion) particles.forEach(function (p) { for (var k = 0; k < 120; k++) stepParticle(p); });
      }
      draw();
    }
    function start() { if (!running && !reduceMotion) { running = true; raf = requestAnimationFrame(tick); } }
    function stop() { running = false; cancelAnimationFrame(raf); }
    setup();
    var visible = false;
    whenVisible(canvas, function (vis) { visible = vis; vis && !document.hidden ? start() : stop(); });
    document.addEventListener("visibilitychange", function () { document.hidden ? stop() : visible && start(); });
    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(setup, 150); });
    document.addEventListener("themechange", function () { requestAnimationFrame(setup); });
  }
})();

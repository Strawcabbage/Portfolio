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

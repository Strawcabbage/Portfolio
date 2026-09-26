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
      .catch(function () { host.parentNode.style.display = "none"; });
  });
})();

// Hidden terminal: press "/" (or the footer button) to open a tiny shell in
// the style of my C shell. Everything is rendered with textContent, so no
// user input is ever interpreted as HTML.
(function () {
  var dataEl = document.getElementById("term-data");
  if (!dataEl) return;
  var D = JSON.parse(dataEl.textContent);
  var base = D.base || "";

  // ---------- Virtual filesystem ----------
  function projectFile(p) {
    var lines = ["# " + p.title + (p.status ? "  [" + p.status + "]" : ""), "", p.summary, "", "tags: " + p.tags.join(", ")];
    if (p.repo) lines.push({ text: "source: " + p.repo, href: p.repo });
    return lines;
  }
  var FS = {
    "about.txt": function () {
      return [D.name + " — " + D.tagline, "",
        "I like understanding things by building them from first principles:",
        "transformers by hand, tensor libraries in C++, shells in C.",
        "Try: ls projects, cat research/paper.md, sgd"];
    },
    "contact.txt": function () {
      var c = D.contact, out = [];
      if (c.email) out.push({ text: "email     " + c.email, href: "mailto:" + c.email });
      if (c.github) out.push({ text: "github    github.com/" + c.github, href: "https://github.com/" + c.github });
      if (c.linkedin) out.push({ text: "linkedin  linkedin.com/in/" + c.linkedin, href: "https://www.linkedin.com/in/" + c.linkedin });
      return out;
    },
    "journey.txt": function () {
      return D.journey.map(function (e) { return pad(e.when || "", 16) + e.title + " · " + e.org; });
    },
    "skills.txt": function () {
      return D.skills.map(function (s) { return pad(s.group, 26) + s.items.join(", "); });
    },
    "resume.pdf": null,
    "projects/": {},
    "research/": {
      "paper.md": function () {
        return D.research.map(function (r) { return r.title + "  [" + r.status + "]\n" + r.authors; });
      }
    }
  };
  D.projects.forEach(function (p) { FS["projects/"][p.slug + ".md"] = function () { return projectFile(p); }; });
  var SECTION = { "": "top", "projects": "projects", "research": "research" };

  var cwd = "";
  function pad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }
  function resolve(path) {
    path = (path || "").replace(/^~\/?/, "").replace(/^\.\//, "");
    var parts = (path.indexOf("/") === 0 ? path.slice(1) : (cwd ? cwd + "/" : "") + path).split("/").filter(Boolean);
    var stack = [];
    parts.forEach(function (p) { if (p === "..") stack.pop(); else if (p !== ".") stack.push(p); });
    return stack.join("/");
  }
  function lookup(path) {
    var p = resolve(path);
    if (p === "") return { dir: FS, path: "" };
    var segs = p.split("/");
    if (segs.length === 1) {
      if (FS[segs[0] + "/"]) return { dir: FS[segs[0] + "/"], path: segs[0] };
      if (segs[0] in FS) return { file: FS[segs[0]], name: segs[0], path: p };
    } else if (segs.length === 2 && FS[segs[0] + "/"] && segs[1] in FS[segs[0] + "/"]) {
      return { file: FS[segs[0] + "/"][segs[1]], name: segs[1], path: p };
    }
    return null;
  }
  function listing(dir) { return Object.keys(dir).sort(); }

  // ---------- UI ----------
  var root = document.createElement("div");
  root.className = "tty";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Terminal");
  root.innerHTML =
    '<div class="tty-win">' +
    '<div class="term-bar"><span></span><span></span><span></span><em>jsh — Esc to close</em>' +
    '<button type="button" class="tty-x" aria-label="Close terminal">×</button></div>' +
    '<div class="tty-out" aria-live="polite"></div>' +
    '<form class="tty-line"><label class="tty-prompt" for="tty-in"></label>' +
    '<input id="tty-in" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" inputmode="text"></form>' +
    "</div>";
  document.body.appendChild(root);
  var out = root.querySelector(".tty-out"), form = root.querySelector("form"), input = root.querySelector("input");
  var promptEl = root.querySelector(".tty-prompt");
  var lastFocus = null, history = [], hIdx = 0, greeted = false;

  function prompt() { return "~/portfolio" + (cwd ? "/" + cwd : "") + "> "; }
  function setPrompt() { promptEl.textContent = prompt(); }
  function line(parts, cls) {
    var div = document.createElement("div");
    if (cls) div.className = cls;
    (Array.isArray(parts) ? parts : [parts]).forEach(function (p) {
      if (p && typeof p === "object") {
        var a = document.createElement("a");
        a.href = p.href; a.textContent = p.text;
        if (/^https?:/.test(p.href)) { a.target = "_blank"; a.rel = "noopener"; }
        div.appendChild(a);
      } else div.appendChild(document.createTextNode(p));
    });
    if (!div.textContent) div.textContent = "\u00a0";
    out.appendChild(div);
  }
  function print(lines) { lines.forEach(function (l) { line(l); }); }
  function err(msg) { line(msg, "tty-err"); }

  var COMMANDS = {
    help: function () {
      print([
        "commands:",
        "  ls [dir]        list files            cat <file>    print a file",
        "  cd <dir>        move (and scroll)     open <target> open a link or file",
        "  pwd  whoami     echo  date  history   theme [light|dark]",
        "  sgd             drop optimizers on the hero loss surface",
        "  clear           clear the screen      exit          close (or Esc)",
        "tab completes, ↑/↓ recall history."
      ]);
    },
    ls: function (args) {
      var t = lookup(args.filter(function (a) { return a[0] !== "-"; })[0] || "");
      if (!t) return err("ls: cannot access '" + args.join(" ") + "': No such file or directory");
      if (t.file !== undefined) return line(t.name);
      line(listing(t.dir).join("   "));
    },
    cd: function (args) {
      var target = args[0] || "~";
      var t = lookup(target);
      if (!t) return err("cd: " + target + ": No such file or directory");
      if (!t.dir) return err("cd: " + target + ": Not a directory");
      cwd = t.path; setPrompt();
      var id = SECTION[cwd];
      var el = id === "top" ? document.body : document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    pwd: function () { line("/home/jackson/portfolio" + (cwd ? "/" + cwd : "")); },
    cat: function (args) {
      if (!args.length) return err("cat: missing file operand");
      args.forEach(function (a) {
        var t = lookup(a);
        if (!t) return err("cat: " + a + ": No such file or directory");
        if (t.dir) return err("cat: " + a + ": Is a directory");
        if (t.file === null) return err("cat: " + a + ": binary file — try `open " + a + "`");
        print(t.file());
      });
    },
    open: function (args) {
      var a = (args[0] || "").replace(/^~\//, ""), c = D.contact, url = null;
      if (/resume(\.pdf)?$/.test(a)) url = c.resume;
      else if (a === "github") url = "https://github.com/" + c.github;
      else if (a === "linkedin") url = "https://www.linkedin.com/in/" + c.linkedin;
      else if (a === "email" || a === "mail") url = "mailto:" + c.email;
      else {
        var slug = a.replace(/^projects\//, "").replace(/\.md$/, "");
        D.projects.forEach(function (p) { if (p.slug === slug) url = p.repo || null; });
        if (!url && D.projects.some(function (p) { return p.slug === slug; })) return err("open: " + a + ": no public link (private repo)");
      }
      if (!url) return err("open: " + (a || "missing operand") + " — try resume.pdf, github, linkedin, email or projects/<name>");
      line(["opening ", { text: url, href: url }]);
      if (url.indexOf("mailto:") === 0) location.href = url; else window.open(url, "_blank", "noopener");
    },
    whoami: function () { line("jackson — CS & Physics @ UW–Madison, optimizing things"); },
    echo: function (args) { line(args.join(" ")); },
    date: function () { line(new Date().toString()); },
    history: function () { history.forEach(function (h, i) { line(pad(i + 1, 5) + h); }); },
    theme: function (args) {
      var want = args[0];
      if (want !== "light" && want !== "dark") {
        var cur = document.documentElement.getAttribute("data-theme");
        want = (cur || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark" ? "light" : "dark";
      }
      document.documentElement.setAttribute("data-theme", want);
      try { localStorage.setItem("theme", want); } catch (e) {}
      document.dispatchEvent(new Event("themechange"));
      line("theme: " + want);
    },
    sgd: function () {
      document.dispatchEvent(new CustomEvent("portfolio:drop"));
      document.getElementById("landscape") && document.getElementById("landscape").scrollIntoView({ behavior: "smooth", block: "center" });
      line("released SGD, Momentum and Adam from the same point — watch the hero.");
    },
    clear: function () { out.textContent = ""; },
    exit: function () { close(); },
    sudo: function () { err("jackson is not in the sudoers file. This incident will be reported."); },
    rm: function () { err("rm: refusing to delete my portfolio, nice try"); },
    make: function (args) { err("make: *** No rule to make target '" + (args[0] || "coffee") + "'.  Stop."); },
    vim: function () { line("you are now trapped in vim. just kidding — this terminal has no vim."); },
    ssh: function () { err("ssh: connect to host: Permission denied (publickey)"); }
  };
  COMMANDS.dir = COMMANDS.ls;
  COMMANDS.quit = COMMANDS.exit;
  COMMANDS.man = COMMANDS.help;
  COMMANDS.emacs = COMMANDS.nano = COMMANDS.vim;
  COMMANDS.cls = COMMANDS.clear;

  function run(raw) {
    var cmdline = raw.trim();
    line(prompt() + raw, "tty-echo");
    if (!cmdline) return;
    history.push(cmdline); hIdx = history.length;
    // Support simple pipes like "ls projects | wc -l" for fun: only wc -l.
    var pipe = cmdline.split("|").map(function (s) { return s.trim(); });
    var words = pipe[0].split(/\s+/), name = words.shift().toLowerCase();
    var fn = COMMANDS[name];
    if (!fn) return err(name + ": command not found (try `help`)");
    if (pipe[1] === "wc -l") {
      var before = out.childNodes.length; fn(words);
      var n = out.childNodes.length - before, text = [];
      for (var i = 0; i < n; i++) text.push(out.lastChild.textContent), out.removeChild(out.lastChild);
      var count = text.reverse().join("\n").split(/\s{3,}|\n/).filter(Boolean).length;
      return line(String(count));
    }
    if (pipe.length > 1) return err("pipes: only `| wc -l` is supported here — the real shell does the rest");
    fn(words);
  }

  function complete() {
    var v = input.value, words = v.split(/\s+/);
    var last = words[words.length - 1];
    var options;
    if (words.length === 1) options = Object.keys(COMMANDS);
    else {
      var slash = last.lastIndexOf("/"), dirPart = slash >= 0 ? last.slice(0, slash + 1) : "";
      var t = lookup(dirPart || ".");
      options = t && t.dir ? listing(t.dir).map(function (n) { return dirPart + n; }) : [];
    }
    var hits = options.filter(function (o) { return o.indexOf(last) === 0; });
    if (hits.length === 1) { words[words.length - 1] = hits[0]; input.value = words.join(" ") + (/\/$/.test(hits[0]) ? "" : " "); }
    else if (hits.length > 1) {
      line(prompt() + v, "tty-echo"); line(hits.join("   "));
      var common = hits.reduce(function (a, b) { var i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); });
      words[words.length - 1] = common; input.value = words.join(" ");
      out.scrollTop = out.scrollHeight;
    }
  }

  function open() {
    if (!root.hidden) return;
    lastFocus = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add("tty-open");
    setPrompt();
    if (!greeted) {
      greeted = true;
      print(["jsh 1.0 — a tiny cousin of my C shell (github.com/Strawcabbage/c_shell)", "type `help` to see what it can do.", ""]);
    }
    input.focus();
  }
  function close() {
    if (root.hidden) return;
    root.hidden = true;
    document.documentElement.classList.remove("tty-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = input.value; input.value = "";
    run(v);
    out.scrollTop = out.scrollHeight;
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Tab") { e.preventDefault(); complete(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (hIdx > 0) input.value = history[--hIdx]; }
    else if (e.key === "ArrowDown") { e.preventDefault(); hIdx = Math.min(history.length, hIdx + 1); input.value = history[hIdx] || ""; }
    else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); COMMANDS.clear(); }
  });
  root.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); close(); } });
  root.addEventListener("mousedown", function (e) { if (e.target === root) close(); });
  root.querySelector(".tty-x").addEventListener("click", close);
  root.querySelector(".tty-win").addEventListener("click", function (e) {
    if (e.target.tagName !== "A" && !window.getSelection().toString()) input.focus();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "/" && e.key !== "`") return;
    var t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault(); open();
  });
  document.querySelectorAll("[data-open-terminal]").forEach(function (b) { b.addEventListener("click", open); });
})();

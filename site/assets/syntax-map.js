/* syntax-map.js — a real justified permeability graph of this website.
   Nodes are the site's pages; edges are its actual hyperlinks.
   Depth, connectivity and mean depth are computed, not decorative. */

(function () {
  const host = document.getElementById("syntaxmap");
  const graph = window.__SITE_GRAPH__;
  if (!host || !graph) return;

  const { nodes, edges } = graph;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const adj = {};
  nodes.forEach((n) => (adj[n.id] = []));
  edges.forEach(([a, b]) => {
    adj[a].push(b);
    adj[b].push(a);
  });

  // BFS depths from any origin
  function depthsFrom(origin) {
    const d = { [origin]: 0 };
    const q = [origin];
    while (q.length) {
      const cur = q.shift();
      for (const nb of adj[cur])
        if (!(nb in d)) {
          d[nb] = d[cur] + 1;
          q.push(nb);
        }
    }
    return d;
  }

  // Justified from HOME (the carrier space)
  const depth = depthsFrom("home");
  const maxDepth = Math.max(...Object.values(depth));

  // Real syntax measures per node
  const measures = {};
  for (const n of nodes) {
    const d = depthsFrom(n.id);
    const td = nodes.reduce((s, m) => s + (d[m.id] || 0), 0);
    const md = td / (nodes.length - 1);
    const k = nodes.length;
    const ra = k > 2 ? (2 * (md - 1)) / (k - 2) : 0; // relative asymmetry
    measures[n.id] = {
      connectivity: adj[n.id].length,
      meanDepth: md,
      integration: ra > 0 ? 1 / ra : Infinity,
    };
  }

  // ---- layout: levels bottom-up ----
  const W = 640, H = 470, PADX = 46, TOP = 78, BOTTOM = 40;
  const levels = [];
  for (let d = 0; d <= maxDepth; d++)
    levels.push(nodes.filter((n) => depth[n.id] === d));
  const levelY = (d) =>
    H - BOTTOM - (d * (H - TOP - BOTTOM)) / Math.max(maxDepth, 1);
  const pos = {};
  levels.forEach((lvl, d) => {
    lvl.forEach((n, i) => {
      const x = PADX + ((i + 0.5) * (W - 2 * PADX)) / lvl.length;
      pos[n.id] = { x, y: levelY(d) };
    });
  });

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");

  // depth rules + labels (marginalia)
  for (let d = 0; d <= maxDepth; d++) {
    const y = levelY(d);
    const rule = document.createElementNS(NS, "line");
    rule.setAttribute("x1", 8); rule.setAttribute("x2", W - 8);
    rule.setAttribute("y1", y); rule.setAttribute("y2", y);
    rule.setAttribute("stroke", "currentColor");
    rule.setAttribute("stroke-dasharray", "1 5");
    rule.setAttribute("opacity", "0.25");
    svg.appendChild(rule);
    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", 8); t.setAttribute("y", y - 5);
    t.setAttribute("class", "sm-depth");
    t.textContent = "DEPTH " + d;
    svg.appendChild(t);
  }

  const edgeEls = [];
  edges.forEach(([a, b]) => {
    const l = document.createElementNS(NS, "line");
    l.setAttribute("x1", pos[a].x); l.setAttribute("y1", pos[a].y);
    l.setAttribute("x2", pos[b].x); l.setAttribute("y2", pos[b].y);
    l.setAttribute("class", "sm-edge");
    l.dataset.a = a; l.dataset.b = b;
    svg.appendChild(l);
    edgeEls.push(l);
  });

  const readout = document.getElementById("map-readout");
  const fmt = (x) => (x === Infinity ? "∞" : x.toFixed(2));

  nodes.forEach((n) => {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "sm-node");
    g.setAttribute("tabindex", "0");
    const { x, y } = pos[n.id];
    const s = 11;
    let shape;
    if (n.kind === "page" || n.kind === "file") {
      shape = document.createElementNS(NS, "rect");
      shape.setAttribute("x", x - s / 2); shape.setAttribute("y", y - s / 2);
      shape.setAttribute("width", s); shape.setAttribute("height", s);
      if (n.kind === "file") shape.setAttribute("transform", `rotate(45 ${x} ${y})`);
    } else {
      shape = document.createElementNS(NS, "circle");
      shape.setAttribute("cx", x); shape.setAttribute("cy", y);
      shape.setAttribute("r", s / 2);
    }
    g.appendChild(shape);

    const label = document.createElementNS(NS, "text");
    const topLevel = depth[n.id] === maxDepth;
    if (topLevel) {
      label.setAttribute("x", x + 4);
      label.setAttribute("y", y - 12);
      label.setAttribute("transform", `rotate(-42 ${x} ${y - 12})`);
    } else {
      label.setAttribute("x", x + 10);
      label.setAttribute("y", y + (n.id === "home" ? 22 : 4));
      if (n.id === "home") label.setAttribute("x", x - 16);
    }
    label.textContent = n.label;
    g.appendChild(label);

    function hot(on) {
      g.classList.toggle("hot", on);
      edgeEls.forEach((l) =>
        l.classList.toggle("hot", on && (l.dataset.a === n.id || l.dataset.b === n.id))
      );
      if (readout) {
        const m = measures[n.id];
        readout.textContent = on
          ? `${n.label} — depth ${depth[n.id]} · connectivity ${m.connectivity} · mean depth ${fmt(m.meanDepth)} · integration ${fmt(m.integration)}`
          : "";
      }
    }
    g.addEventListener("mouseenter", () => hot(true));
    g.addEventListener("mouseleave", () => hot(false));
    g.addEventListener("focus", () => hot(true));
    g.addEventListener("blur", () => hot(false));
    g.addEventListener("click", () => (window.location.href = n.href));
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter") window.location.href = n.href;
    });
    svg.appendChild(g);
  });

  // draw-in: edges grow from home outward (skipped for reduced motion)
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    edgeEls.forEach((l) => {
      const len = Math.hypot(l.x2.baseVal.value - l.x1.baseVal.value, l.y2.baseVal.value - l.y1.baseVal.value);
      l.style.strokeDasharray = len;
      l.style.strokeDashoffset = len;
      const d = Math.min(depth[l.dataset.a], depth[l.dataset.b]);
      l.style.transition = `stroke-dashoffset .7s ease ${(d * 0.35).toFixed(2)}s`;
    });
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        edgeEls.forEach((l) => (l.style.strokeDashoffset = 0))
      )
    );
  }

  host.appendChild(svg);
})();

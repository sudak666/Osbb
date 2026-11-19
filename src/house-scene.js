// Згенеровано з src/house-scene.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
const SVG_NS = "http://www.w3.org/2000/svg";
const HOUSE_CYCLE_MS = 6e3;
const HOUSE_COMPLETE_MS = 4700;
const S = 8;
const FH = 0.42;
const iso = (x, y, z) => [(x - y) * 0.866 * S, (x + y) * 0.5 * S - z * S];
const fmt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
const points = (...pts) => pts.map((p) => fmt(iso(p[0], p[1], p[2]))).join(" ");
const at = (seconds) => Math.min(1, Math.max(0, seconds * 1e3 / HOUSE_CYCLE_MS));
const fadeIn = (from, to) => [
  { offset: 0, opacity: 0 },
  { offset: at(from), opacity: 0 },
  { offset: at(to), opacity: 1 },
  { offset: 1, opacity: 1 }
];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function polylineLength(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return total;
}
function pointAlong(pts, fraction) {
  let remaining = Math.max(0, Math.min(1, fraction)) * polylineLength(pts);
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const segment = Math.hypot(bx - ax, by - ay);
    if (remaining <= segment || i === pts.length - 1) {
      const k = segment ? Math.min(1, remaining / segment) : 0;
      return [ax + (bx - ax) * k, ay + (by - ay) * k];
    }
    remaining -= segment;
  }
  return pts[pts.length - 1];
}
function shadeHex(hex, k) {
  const n = Number.parseInt(hex.slice(1), 16);
  const target = k > 0 ? 255 : 0;
  const amount = Math.min(1, Math.abs(k) / 100);
  const channel = (shift) => {
    const value = n >> shift & 255;
    return Math.round(value + (target - value) * amount).toString(16).padStart(2, "0");
  };
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}
function seededRandom(seed) {
  let state = seed;
  return () => (state = state * 16807 % 2147483647) / 2147483647;
}
const arc = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, k) => {
  const a = a0 + (a1 - a0) * k / n;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
});
const SECTIONS = [
  { fp: [[-2.6, 0], [0, 0], [0, 5.6], [-2.6, 5.6]], floors: 24, turret: [-1.9, 0.7] },
  { fp: [[0, 0], [3.2, 0], [3.2, 2.5], [0, 2.5]], floors: 23 },
  { fp: [[3.2, -0.15], [6.4, -0.15], [6.4, 2.35], [3.2, 2.35]], floors: 22 },
  { fp: [[6.4, 0], [9.6, 0], [9.6, 2.5], [6.4, 2.5]], floors: 23 },
  { fp: [[9.6, 0], [12.8, 0], ...arc(11.6, 1.3, 1.2, 0, Math.PI / 2, 6), [9.6, 2.5]], floors: 24 }
];
function wallsOf(fp) {
  const cx = fp.reduce((s, p) => s + p[0], 0) / fp.length;
  const cy = fp.reduce((s, p) => s + p[1], 0) / fp.length;
  return fp.map((A, i) => {
    const B = fp[(i + 1) % fp.length];
    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const L = Math.hypot(dx, dy);
    let nx = dy / L;
    let ny = -dx / L;
    if ((cx - A[0]) * nx + (cy - A[1]) * ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    return { A, B, nx, ny, L, visible: nx + ny > 0.05 };
  });
}
const CAR_COLORS = ["#e05a47", "#3d7bd9", "#f2c14e", "#e8e8e8", "#4a4f57", "#2fa36b", "#9b59b6", "#e8e8e8", "#3d7bd9"];
function buildHouseScene(doc, svg, idPrefix) {
  const rnd = seededRandom(11);
  const tracks = [];
  const track = (node, keyframes) => {
    tracks.push({ node, keyframes });
  };
  const el = (tag, attrs, parent) => {
    const node = doc.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    parent.append(node);
    return node;
  };
  const poly = (pts, cls, parent) => el("polygon", { points: points(...pts), class: cls }, parent);
  const paint = (node, fill) => {
    node.setAttribute("fill", fill);
    return node;
  };
  const shaded = (pts, sideCls, frontCls, nx, parent) => {
    poly(pts, sideCls, parent);
    const frontShare = 1 - Math.max(0, nx) ** 2;
    if (frontShare > 0.01) poly(pts, frontCls, parent).setAttribute("opacity", frontShare.toFixed(2));
  };
  const box = (x0, y0, x1, y1, z0, z1, parent, cls) => [
    poly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], cls[0], parent),
    poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], cls[1], parent),
    poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], cls[2], parent)
  ];
  const drawLine = (pts, from, to, parent) => {
    const screen = pts.map((p) => iso(p[0], p[1], p[2]));
    const length = polylineLength(screen);
    const line = el("polyline", { points: screen.map(fmt).join(" "), class: "hs-edge", "stroke-dasharray": length.toFixed(1) }, parent);
    track(line, [
      { offset: 0, strokeDashoffset: String(length) },
      { offset: at(from), strokeDashoffset: String(length), easing: "cubic-bezier(.65,0,.35,1)" },
      { offset: at(to), strokeDashoffset: "0" },
      { offset: 1, strokeDashoffset: "0" }
    ]);
  };
  const defs = el("defs", {}, svg);
  const shineGradient = el("linearGradient", { id: `${idPrefix}-shine`, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
  for (const [offset, opacity] of [[0, 0], [0.5, 0.5], [1, 0]]) el("stop", { offset, class: "hs-shine-stop", "stop-opacity": opacity }, shineGradient);
  const bodyClip = el("clipPath", { id: `${idPrefix}-body` }, defs);
  const root = el("g", {}, svg);
  track(root, [{ offset: 0, opacity: 1 }, { offset: at(5.35), opacity: 1 }, { offset: at(5.85), opacity: 0 }, { offset: 1, opacity: 0 }]);
  const ground = el("g", {}, root);
  track(ground, fadeIn(0, 0.6));
  poly([[-7.5, -3.5, 0], [19, -3.5, 0], [19, 11, 0], [-7.5, 11, 0]], "hs-ground", ground);
  const pond = [];
  for (let k = 0; k < 28; k++) {
    const a = k / 28 * Math.PI * 2;
    pond.push([16.6 + Math.cos(a) * 1.8 + Math.sin(a * 2) * 0.3, -1.2 + Math.sin(a) * 1.5, 0]);
  }
  poly(pond, "hs-pond", ground);
  poly([[-6.7, -3.5, 0], [-4.8, -3.5, 0], [-4.8, 11, 0], [-6.7, 11, 0]], "hs-road", ground);
  el("polyline", { points: points([-5.75, -3.5, 0], [-5.75, 11, 0]), class: "hs-road-line" }, ground);
  poly([[-4.8, -3.5, 0], [-4.1, -3.5, 0], [-4.1, 11, 0], [-4.8, 11, 0]], "hs-walk", ground);
  poly([[0.2, 2.6, 0], [13.6, 2.6, 0], [13.6, 8.3, 0], [0.2, 8.3, 0]], "hs-pave", ground);
  poly([[-4.1, 5.9, 0], [0.2, 5.9, 0], [0.2, 8.3, 0], [-4.1, 8.3, 0]], "hs-pave", ground);
  poly([[1, 3.2, 0], [3.9, 3.2, 0], [3.9, 5.5, 0], [1, 5.5, 0]], "hs-court-edge", ground);
  poly([[1.25, 3.45, 0], [3.65, 3.45, 0], [3.65, 5.25, 0], [1.25, 5.25, 0]], "hs-court", ground);
  el("polygon", { points: points([1.45, 3.65, 0], [3.45, 3.65, 0], [3.45, 5.05, 0], [1.45, 5.05, 0]), class: "hs-court-line" }, ground);
  el("polyline", { points: points([2.45, 3.65, 0], [2.45, 5.05, 0]), class: "hs-court-line" }, ground);
  poly([[4.4, 3.2, 0], [7.6, 3.2, 0], [7.6, 5.5, 0], [4.4, 5.5, 0]], "hs-sand", ground);
  for (const [x, y, color] of [[5, 3.8, "#d9503c"], [6.1, 4.5, "#f2c14e"], [6.9, 3.7, "#3d7bd9"], [5.4, 4.9, "#2fa36b"]]) {
    const [side, front, top] = box(x, y, x + 0.35, y + 0.35, 0, 0.45, ground, ["", "", ""]);
    paint(side, shadeHex(color, -22));
    paint(front, shadeHex(color, -10));
    paint(top, color);
  }
  const backLayer = el("g", {}, root);
  const houseLayer = el("g", {}, root);
  const frontLayer = el("g", {}, root);
  const isFront = (x, y) => y > 5.9 || x > 0.3 && y > 2.7 || x > 13;
  const tree = (x, y, parent) => {
    const g = el("g", { class: "hs-tree" }, parent);
    const base = iso(x, y, 0);
    const trunkTop = iso(x, y, 1);
    const crown = iso(x, y, 1.7);
    const r = (0.7 + rnd() * 0.3) * S;
    el("ellipse", { cx: base[0] + 2, cy: base[1] + 1, rx: r * 0.9, ry: r * 0.4, class: "hs-tshadow" }, g);
    el("line", { x1: base[0], y1: base[1], x2: trunkTop[0], y2: trunkTop[1], class: "hs-trunk" }, g);
    el("circle", { cx: crown[0], cy: crown[1], r, class: "hs-crown-dark" }, g);
    el("circle", { cx: crown[0] - r * 0.22, cy: crown[1] - r * 0.22, r: r * 0.72, class: "hs-crown" }, g);
    const d = 0.2 + (x + 7) / 26 * 0.9;
    track(g, [
      { offset: 0, transform: "scale(0)", opacity: 0 },
      { offset: at(d), transform: "scale(0)", opacity: 0 },
      { offset: at(d + 0.35), transform: "scale(1.08)", opacity: 1 },
      { offset: at(d + 0.5), transform: "scale(1)", opacity: 1 },
      { offset: 1, transform: "scale(1)", opacity: 1 }
    ]);
  };
  const car = (x, y, color, parent) => {
    const g = el("g", {}, parent);
    const x1 = x + 0.56;
    const y1 = y + 1.08;
    const zb = 0.1;
    const zt = 0.3;
    const zr = 0.52;
    for (const [wx, wy] of [[x1, y + 0.26], [x1, y1 - 0.26], [x + 0.1, y1]]) {
      const c = iso(wx, wy, 0.1);
      el("circle", { cx: c[0].toFixed(1), cy: c[1].toFixed(1), r: 1.15, class: "hs-wheel" }, g);
    }
    const [side, front, top] = box(x, y, x1, y1, zb, zt, g, ["", "", ""]);
    paint(side, shadeHex(color, -26));
    paint(front, shadeHex(color, -12));
    paint(top, color);
    const [c0x, c0y, c1x, c1y] = [x + 0.06, y + 0.2, x1 - 0.06, y1 - 0.38];
    poly([[c1x, c0y, zt], [c1x, c1y, zt], [c1x, c1y, zr], [c1x, c0y, zr]], "hs-car-glass", g);
    poly([[c0x, c1y, zt], [c1x, c1y, zt], [c1x, c1y, zr], [c0x, c1y, zr]], "hs-car-glass-front", g);
    paint(poly([[c0x, c0y, zr], [c1x, c0y, zr], [c1x, c1y, zr], [c0x, c1y, zr]], "", g), shadeHex(color, 18));
    for (const [hx, hy] of [[x + 0.12, y1], [x1 - 0.12, y1]]) {
      const c = iso(hx, hy, 0.22);
      el("circle", { cx: c[0].toFixed(1), cy: c[1].toFixed(1), r: 0.75, class: "hs-carlight" }, g);
    }
    return g;
  };
  const lamp = (x, y, k, parent) => {
    const g = el("g", {}, parent);
    const b = iso(x, y, 0);
    const t = iso(x, y, 2.1);
    el("line", { x1: b[0], y1: b[1], x2: t[0], y2: t[1], class: "hs-pole" }, g);
    const glow = el("g", {}, g);
    el("circle", { cx: t[0], cy: t[1], r: 6, class: "hs-lamp-halo" }, glow);
    el("circle", { cx: t[0], cy: t[1], r: 1.8, class: "hs-lamp" }, glow);
    track(g, fadeIn(0.5 + k * 0.06, 0.9 + k * 0.06));
    track(glow, fadeIn(2.3 + k * 0.12, 2.6 + k * 0.12));
  };
  const items = [];
  const trees = [];
  for (let x = -3.6; x <= 13; x += 1.7) trees.push([x + rnd() * 0.5, -2.6 + rnd() * 0.7]);
  for (let y = 0.2; y <= 5; y += 1.6) trees.push([-3.5 + rnd() * 0.3, y + rnd() * 0.4]);
  for (let y = 1.6; y <= 10.2; y += 2.4) trees.push([14.6 + rnd() * 0.6, y + rnd() * 0.4]);
  trees.push([17.8, 2.4], [18.2, 5.6], [17.6, 8.6]);
  for (let x = -3.4; x <= 13; x += 4.1) trees.push([x + rnd() * 0.4, 9.9 + rnd() * 0.5]);
  trees.push([9.4, 3.8], [12.2, 4.4]);
  for (const [x, y] of trees) items.push({ x, y, draw: (p) => tree(x, y, p) });
  [-2, 1.2, 4.4, 7.6, 10.8].forEach((y, k) => items.push({ x: -4.3, y, draw: (p) => lamp(-4.3, y, k, p) }));
  [0.9, 1.9, 2.9, 4.9, 5.9, 7.9, 8.9, 10.9, 11.9].forEach((x, k) => items.push({
    x,
    y: 6.6,
    draw: (p) => track(car(x, 6.6, CAR_COLORS[k], p), fadeIn(0.9 + k * 0.07, 1.3 + k * 0.07))
  }));
  const byDepth = (a, b) => a.x + a.y - (b.x + b.y);
  items.filter((it) => !isFront(it.x, it.y)).sort(byDepth).forEach((it) => it.draw(backLayer));
  const driver = el("g", { opacity: 0 }, backLayer);
  car(-6.3, 6, "#f4f4f4", driver);
  for (const [hx, hy] of [[-6.18, 7.08], [-5.86, 7.08]]) {
    const c = iso(hx, hy, 0.22);
    el("circle", { cx: c[0].toFixed(1), cy: c[1].toFixed(1), r: 2.6, class: "hs-lamp-halo" }, driver);
  }
  const drive = (dy, opacity, offset) => {
    const [px, py] = iso(0, dy, 0);
    return { offset, opacity, transform: `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)` };
  };
  track(driver, [drive(-10, 0, 0), drive(-10, 0, at(1.8)), drive(-9.4, 1, at(2)), drive(4.4, 1, at(5)), drive(5, 0, at(5.2)), drive(5, 0, 1)]);
  const roofChain = [];
  SECTIONS.forEach((sec, i) => {
    const H = sec.floors * FH;
    const walls = wallsOf(sec.fp);
    const g = el("g", {}, houseLayer);
    const body = el("g", {}, g);
    track(body, fadeIn(1.1 + i * 0.12, 1.8 + i * 0.12));
    const lit = el("g", {}, g);
    const floorsLit = Array.from({ length: sec.floors }, (_, f) => f === 0 ? null : el("g", {}, lit));
    const visible = walls.filter((w) => w.visible).sort((a, b) => a.A[0] + a.A[1] + a.B[0] + a.B[1] - (b.A[0] + b.A[1] + b.B[0] + b.B[1]));
    for (const { A, B, nx, L } of visible) {
      const quad = (t02, t1, z0, z1) => {
        const a = lerp(A, B, t02);
        const b = lerp(A, B, t1);
        return [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]];
      };
      shaded(quad(0, 1, 0, H), "hs-side", "hs-front", nx, body);
      poly(quad(0, 1, 0, H), "", bodyClip);
      shaded(quad(0, 1, 0, 5 * FH), "hs-terra-side", "hs-terra", nx, body);
      const windowCls = nx > 0.5 ? "hs-win-side" : "hs-win";
      const addWindow = (t02, t1, f) => {
        const za = f * FH + 0.1;
        const q = quad(t02, t1, za, za + 0.24);
        poly(q, windowCls, body);
        poly(q, "hs-lit", floorsLit[f]);
      };
      if (L < 0.8) {
        for (let f = 1; f < sec.floors; f++) addWindow(0.2, 0.8, f);
        continue;
      }
      const strip = L >= 2.2;
      if (strip) poly(quad(0.5 - 0.17 / L, 0.5 + 0.17 / L, FH * 5, H - 0.15), "hs-stripe", body);
      const columns = Math.floor(L / 0.62);
      for (let k = 0; k < columns; k++) {
        const t = (k + 0.5) / columns;
        if (strip && Math.abs(t - 0.5) * L < 0.32) continue;
        for (let f = 1; f < sec.floors; f++) addWindow(t - 0.19 / L, t + 0.19 / L, f);
      }
    }
    const roofPoly = sec.fp.map((p) => [p[0], p[1], H]);
    poly(roofPoly, "hs-top", body);
    poly(roofPoly, "", bodyClip);
    floorsLit.forEach((group, f) => {
      if (!group) return;
      const d = 2 + f * 0.05 + rnd() * 0.4 + i * 0.03;
      track(group, fadeIn(d, d + 0.22));
    });
    const t0 = 0.2 + i * 0.28;
    drawLine([...roofPoly, roofPoly[0]], t0, t0 + 0.9, g);
    const start = walls.findIndex((w, k) => w.visible && !walls[(k - 1 + walls.length) % walls.length].visible);
    const chain = [];
    for (let k = 0; k < walls.length; k++) {
      const w = walls[(start + k) % walls.length];
      if (!w.visible) break;
      chain.push(w);
    }
    const base = [chain[0].A, ...chain.map((w) => w.B)];
    drawLine(base.map((p) => [p[0], p[1], 0]), t0 + 0.2, t0 + 1, g);
    const corners = [chain[0].A, chain[chain.length - 1].B];
    for (let k = 1; k < chain.length; k++) {
      if (chain[k - 1].nx * chain[k].nx + chain[k - 1].ny * chain[k].ny < 0.85) corners.push(chain[k].A);
    }
    for (const p of corners) drawLine([[p[0], p[1], 0], [p[0], p[1], H]], t0 + 0.3, t0 + 0.9, g);
    roofChain.push(...base.map((p) => [p[0], p[1], H]));
    const roof = el("g", {}, g);
    track(roof, fadeIn(1.3 + i * 0.12, 1.9 + i * 0.12));
    const cx = sec.fp.reduce((s, p) => s + p[0], 0) / sec.fp.length;
    const cy = sec.fp.reduce((s, p) => s + p[1], 0) / sec.fp.length;
    box(cx - 0.5, cy - 0.45, cx + 0.5, cy + 0.45, H, H + 0.7, roof, ["hs-side", "hs-front", "hs-top"]);
    el("polygon", {
      points: points([cx - 0.5, cy + 0.45, H], [cx + 0.5, cy + 0.45, H], [cx + 0.5, cy - 0.45, H], [cx + 0.5, cy - 0.45, H + 0.7], [cx - 0.5, cy - 0.45, H + 0.7], [cx - 0.5, cy + 0.45, H + 0.7]),
      class: "hs-roof-edge"
    }, roof);
    if (sec.turret) {
      const [tx, ty] = sec.turret;
      const c0 = iso(tx, ty, H);
      const c1 = iso(tx, ty, H + 1.3);
      const rx = 0.62 * S;
      const ry = rx * 0.5;
      const drum = `M${c0[0] - rx},${c0[1]} L${c1[0] - rx},${c1[1]} A${rx},${ry} 0 0 0 ${c1[0] + rx},${c1[1]} L${c0[0] + rx},${c0[1]} A${rx},${ry} 0 0 1 ${c0[0] - rx},${c0[1]} Z`;
      el("path", { d: drum, class: "hs-side" }, roof);
      el("path", { d: drum, class: "hs-roof-edge" }, roof);
      const ring = iso(tx, ty, H + 0.75);
      el("path", { d: `M${ring[0] - rx},${ring[1]} A${rx},${ry} 0 0 0 ${ring[0] + rx},${ring[1]}`, class: "hs-roof-edge" }, roof);
      el("ellipse", { cx: c1[0], cy: c1[1], rx, ry, class: "hs-top" }, roof);
      el("ellipse", { cx: c1[0], cy: c1[1], rx, ry, class: "hs-roof-edge" }, roof);
      const spire = iso(tx, ty, H + 3.2);
      el("line", { x1: c1[0], y1: c1[1], x2: spire[0], y2: spire[1], class: "hs-spire" }, roof);
    }
  });
  items.filter((it) => isFront(it.x, it.y)).sort(byDepth).forEach((it) => it.draw(frontLayer));
  const shineGroup = el("g", { "clip-path": `url(#${idPrefix}-body)` }, root);
  const shine = el("rect", { x: -160, y: -130, width: 50, height: 220, fill: `url(#${idPrefix}-shine)`, opacity: 0 }, shineGroup);
  const sweep = (x, opacity, offset) => ({ offset, opacity, transform: `translateX(${x}px) skewX(-20deg)` });
  track(shine, [sweep(0, 1, 0), sweep(0, 1, at(3.9)), sweep(330, 1, at(4.6)), sweep(330, 0, at(4.65)), sweep(330, 0, 1)]);
  const roofScreen = roofChain.map((p) => iso(p[0], p[1], p[2]));
  const total = polylineLength(roofScreen);
  const pen = el("g", { opacity: 0 }, root);
  el("circle", { r: 6, class: "hs-pen-halo" }, pen);
  el("circle", { r: 2.4, class: "hs-pen" }, pen);
  let travelled = 0;
  const penFrames = roofScreen.map((p, k) => {
    if (k > 0) travelled += Math.hypot(p[0] - roofScreen[k - 1][0], p[1] - roofScreen[k - 1][1]);
    return { offset: at(0.2 + 2 * travelled / total), opacity: 1, transform: `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px)` };
  });
  const first = penFrames[0].transform;
  const last = penFrames[penFrames.length - 1].transform;
  track(pen, [{ offset: 0, opacity: 0, transform: first }, { offset: at(0.15), opacity: 0, transform: first }, ...penFrames, { offset: at(2.4), opacity: 0, transform: last }, { offset: 1, opacity: 0, transform: last }]);
  const frame = [[-7.5, -3.5, 0], [19, -3.5, 0], [19, 11, 0], [-7.5, 11, 0], [-1.9, 0.7, 24 * FH + 3.2]].map((p) => iso(p[0], p[1], p[2]));
  const xs = frame.map((p) => p[0]);
  const ys = frame.map((p) => p[1]);
  const minX = Math.min(...xs) - 6;
  const minY = Math.min(...ys) - 8;
  const viewBox = `${minX.toFixed(1)} ${minY.toFixed(1)} ${(Math.max(...xs) + 6 - minX).toFixed(1)} ${(Math.max(...ys) + 6 - minY).toFixed(1)}`;
  return { tracks, viewBox };
}
export {
  HOUSE_COMPLETE_MS,
  HOUSE_CYCLE_MS,
  buildHouseScene,
  pointAlong,
  polylineLength,
  shadeHex
};

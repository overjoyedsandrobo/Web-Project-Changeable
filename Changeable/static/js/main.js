const canvas = document.getElementById("generation-canvas");
const ctx = canvas.getContext("2d");

const colsInput = document.getElementById("cols");
const rowsInput = document.getElementById("rows");
const ruleMaxInput = document.getElementById("ruleMax");
const clearBtn = document.getElementById("clearBtn");

const helpBtn = document.getElementById("helpBtn");
const helpModal = document.getElementById("helpModal");
const helpClose = document.getElementById("helpClose");
const helpBackdrop = document.getElementById("helpBackdrop");

const legendEl = document.getElementById("legend");

const generateBtn = document.getElementById("generateBtn");
const stepsInput = document.getElementById("steps");
const seedModeEl = document.getElementById("seedMode");
const showGridEl = document.getElementById("showGrid");
const seedInput = document.getElementById("seed");
const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const designData = document.getElementById("designData");
const randomizeSeedEl = document.getElementById("randomizeSeed");
const mirrorXBtn = document.getElementById("mirrorXBtn");
const mirrorYBtn = document.getElementById("mirrorYBtn");
const rotateBtn = document.getElementById("rotateBtn");
const exportPngBtn = document.getElementById("exportPngBtn");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");

const previewModal = document.getElementById("previewModal");
const previewBackdrop = document.getElementById("previewBackdrop");
const previewClose = document.getElementById("previewClose");
const previewCanvas = document.getElementById("previewCanvas");
const previewRegenerateBtn = document.getElementById("previewRegenerateBtn");
const previewExportPngBtn = document.getElementById("previewExportPngBtn");
const previewMeta = document.getElementById("previewMeta");

const pctx = previewCanvas.getContext("2d");


const undoStack = [];
const redoStack = [];
const HISTORY_LIMIT = 100;

let cols = parseInt(colsInput.value, 10);
let rows = parseInt(rowsInput.value, 10);
let ruleMax = parseInt(ruleMaxInput.value, 10);

let grid = [];
let hoverCell = null;
let isPainting = false;
let activeRule = 1; // default paint rule
let paintEraseMode = false;



// --- Canvas sizing (rectangular-friendly) ---
function resizeCanvas() {
  const container = document.getElementById("canvas-container");
  const maxWidth = container.clientWidth * 0.95;
  const maxHeight = container.clientHeight * 0.95;

  // Use a pleasant wide aspect ratio for the workspace
  const aspect = 16 / 10;

  let width = maxWidth;
  let height = width / aspect;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspect;
  }

  canvas.width = Math.floor(width);
  canvas.height = Math.floor(height);

  draw();
}

window.addEventListener("resize", resizeCanvas);

// --- Grid state ---
function createGrid(r, c) {
  const g = new Array(r);
  for (let y = 0; y < r; y++) {
    g[y] = new Array(c).fill(0);
  }
  return g;
}

function clampInt(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function applySettings() {
  cols = clampInt(colsInput.value, 4, 64);
  rows = clampInt(rowsInput.value, 4, 64);
  ruleMax = clampInt(ruleMaxInput.value, 2, 12);

  colsInput.value = cols;
  rowsInput.value = rows;
  ruleMaxInput.value = ruleMax;

  grid = createGrid(rows, cols);

  hoverCell = null;

  draw();
  renderLegend(); 
}

// --- Rendering ---
function ruleToFill(rule) {
  // 0 stays black; others map to grayscale steps
  if (rule === 0) return "#000000";
  const t = rule / (ruleMax - 1); // 0..1
  const v = Math.floor(40 + t * 160); // 40..200
  return `rgb(${v},${v},${v})`;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  // draw painted rules
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const rule = grid[y][x];
      if (rule !== 0) {
        ctx.fillStyle = ruleToFill(rule);
        ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
      }
    }
  }

  // grid lines + hover
  const showGrid = showGridEl ? showGridEl.checked : true;
  if (showGrid) {
    ctx.strokeStyle = "#1f1f1f";
    ctx.lineWidth = 1;

    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x * cellW) + 0.5, 0);
      ctx.lineTo(Math.round(x * cellW) + 0.5, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y * cellH) + 0.5);
      ctx.lineTo(canvas.width, Math.round(y * cellH) + 0.5);
      ctx.stroke();
    }

    if (hoverCell) {
      const { x, y } = hoverCell;
      ctx.strokeStyle = "#3a3a3a";
      ctx.lineWidth = 2;
      ctx.strokeRect(x * cellW + 1, y * cellH + 1, cellW - 2, cellH - 2);
    }
  }
}

function generatePreview() {
  console.log("TODO: preview generator");
}


function renderLegend() {
  legendEl.innerHTML = "";

  for (let r = 0; r < ruleMax; r++) {
    const item = document.createElement("div");
    item.className = "legend-item" + (r === activeRule ? " selected" : "");
    item.dataset.rule = String(r);

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = ruleToFill(r);

    const label = document.createElement("span");
    label.className = "legend-label";
    label.textContent = r === 0 ? "0 Empty (erase)" : `${r}`;

    item.appendChild(swatch);
    item.appendChild(label);

    item.addEventListener("click", () => {
      activeRule = r;
      renderLegend(); // refresh highlight
    });

    legendEl.appendChild(item);
  }
}

function setCell(x, y, value) {
  grid[y][x] = value;
}

function paintCell(x, y, erase) {
  setCell(x, y, erase ? 0 : activeRule);
}


// --- Mouse to cell ---
function getCellFromEvent(evt) {
  const rect = canvas.getBoundingClientRect();
  const mx = evt.clientX - rect.left;
  const my = evt.clientY - rect.top;

  const x = Math.floor((mx / rect.width) * cols);
  const y = Math.floor((my / rect.height) * rows);

  if (x < 0 || x >= cols || y < 0 || y >= rows) return null;
  return { x, y };
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function exportDesign() {
  return JSON.stringify({
    cols,
    rows,
    ruleMax,
    seed: clampInt(seedInput.value, 0, 999999999),
    grid,
  });
}

function importDesign(text) {
  const obj = JSON.parse(text);

  cols = clampInt(obj.cols, 4, 64);
  rows = clampInt(obj.rows, 4, 64);
  ruleMax = clampInt(obj.ruleMax, 2, 12);

  colsInput.value = cols;
  rowsInput.value = rows;
  ruleMaxInput.value = ruleMax;

  seedInput.value = clampInt(obj.seed ?? 0, 0, 999999999);

  grid = obj.grid;
  hoverCell = null;

  renderLegend();
  resizeCanvas();
  draw();
}
function mirrorX() {
  pushHistory();
  const newGrid = cloneGrid(grid);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      newGrid[y][cols - 1 - x] = grid[y][x];
    }
  }

  grid = newGrid;
  draw();
}
function mirrorY() {
  pushHistory();
  const newGrid = cloneGrid(grid);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      newGrid[rows - 1 - y][x] = grid[y][x];
    }
  }

  grid = newGrid;
  draw();
}
function rotate90() {
  pushHistory();
  const newRows = cols;
  const newCols = rows;

  const newGrid = Array.from({ length: newRows }, () => Array(newCols).fill(0));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // (x, y) -> (y, newCols - 1 - x) for clockwise rotation
      newGrid[x][newCols - 1 - y] = grid[y][x];
    }
  }

  rows = newRows;
  cols = newCols;

  rowsInput.value = rows;
  colsInput.value = cols;

  grid = newGrid;
  hoverCell = null;

  resizeCanvas();
  draw();
}

function exportPNG() {

  // Export the current canvas as-is
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `changeable_${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function snapshotState() {
  return {
    rows,
    cols,
    ruleMax,
    grid: cloneGrid(grid),
  };
}

function applyState(state) {
  rows = state.rows;
  cols = state.cols;
  ruleMax = state.ruleMax;
  grid = cloneGrid(state.grid);

  rowsInput.value = rows;
  colsInput.value = cols;
  ruleMaxInput.value = ruleMax;

  hoverCell = null;

  renderLegend();
  resizeCanvas();
  draw();
}



function pushHistory() {
  undoStack.push(snapshotState());
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0; // clear redo on new action
  updateHistoryButtons();
}

function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(snapshotState());
  const prev = undoStack.pop();
  applyState(prev);
  updateHistoryButtons();
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(snapshotState());
  const next = redoStack.pop();
  applyState(next);
  updateHistoryButtons();
}

function updateHistoryButtons() {
  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

let lastPreviewSeed = 0;

function openPreview() {
  previewModal.classList.remove("hidden");
}

function closePreview() {
  previewModal.classList.add("hidden");
}

function getSeedForPreview() {
  let seed;
  if (randomizeSeedEl && randomizeSeedEl.checked) {
    seed = (Math.random() * 1e9) >>> 0;
    seedInput.value = seed;
  } else {
    seed = clampInt(seedInput.value, 0, 999999999);
    seedInput.value = seed;
  }
  return seed >>> 0;
}

function resizePreviewCanvas() {
  const c = previewCanvas; // <canvas id="previewCanvas">
  const rect = c.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  c.width = Math.floor(rect.width * dpr);
  c.height = Math.floor(rect.height * dpr);

  pctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
}


// This is now your Generate button handler
function generatePreview() {
  openPreview();
  // wait a tick so canvas has layout size
  requestAnimationFrame(() => {
    resizePreviewCanvas();
    lastPreviewSeed = getSeedForPreview();
    renderAbstractPainting(lastPreviewSeed);
  });
}
function lerp(a, b, t) { return a + (b - a) * t; }

function smoothstep(t) { return t * t * (3 - 2 * t); }

// Sample the rule grid smoothly at normalized coords u,v in [0,1]
function sampleRuleField(u, v) {
  const gx = u * (cols - 1);
  const gy = v * (rows - 1);

  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const x1 = Math.min(cols - 1, x0 + 1);
  const y1 = Math.min(rows - 1, y0 + 1);

  const tx = smoothstep(gx - x0);
  const ty = smoothstep(gy - y0);

  const a = grid[y0][x0];
  const b = grid[y0][x1];
  const c = grid[y1][x0];
  const d = grid[y1][x1];

  const ab = lerp(a, b, tx);
  const cd = lerp(c, d, tx);
  return lerp(ab, cd, ty); // 0..ruleMax-1-ish
}

// Cheap deterministic “noise” based on seed (no big libraries)
function hash2D(ix, iy, seed) {
  // All integer math in 32-bit space (no BigInt)
  let x = ix | 0;
  let y = iy | 0;
  let s = seed | 0;

  // Mix coordinates + seed
  let n = (x * 374761393) ^ (y * 668265263) ^ (s * 1442695041);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  n = (n ^ (n >>> 16)) >>> 0;

  return n / 4294967296; // [0,1)
}

// Smooth value noise
function valueNoise(u, v, seed) {
  const x = u * 8;   // scale controls “turbulence”
  const y = v * 8;

  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = x0 + 1, y1 = y0 + 1;

  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);

  const a = hash2D(x0, y0, seed);
  const b = hash2D(x1, y0, seed);
  const c = hash2D(x0, y1, seed);
  const d = hash2D(x1, y1, seed);

  const ab = lerp(a, b, tx);
  const cd = lerp(c, d, tx);
  return lerp(ab, cd, ty); // 0..1
}

function renderAbstractPainting(seed) {
  const shade = makeStyleShader(seed);

  // 8 “looks” within the same family
  const variant = ((seed >>> 0) % 8);

  // rng for grain + accents (decoupled from shader seed slightly)
  const rng = mulberry32(((seed ^ 0x9e3779b9) >>> 0) ^ (variant * 0x85ebca6b));

  const rect = previewCanvas.getBoundingClientRect();
  const cssW = Math.max(1, Math.floor(rect.width));
  const cssH = Math.max(1, Math.floor(rect.height));

  // Internal render resolution (cap for speed)
  const maxW = 1400;
  const down = Math.min(1, maxW / cssW);
  const W = Math.max(1, Math.floor(cssW * down));
  const H = Math.max(1, Math.floor(cssH * down));

  // Offscreen pixel buffer
  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  const octx = off.getContext("2d", { willReadFrequently: true });

  const img = octx.createImageData(W, H);
  const data = img.data;

  // Variant knobs (subtle differences)
  const V = getVariantParams(variant);

  let i = 0;
  let avgLum = 0;

  for (let y = 0; y < H; y++) {
    const v = (y / (H - 1)) * 2 - 1;

    for (let x = 0; x < W; x++) {
      const u = (x / (W - 1)) * 2 - 1;

      let r, g, b, k;
      try {
        [r, g, b, k] = shade(u, v);
      } catch {
        r = g = b = 0.5; k = 0.5;
      }

      // SAFETY: NaN/Inf guard + clamp
      if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b) || !Number.isFinite(k)) {
        r = g = b = 0.5; k = 0.5;
      }
      r = clamp01(r); g = clamp01(g); b = clamp01(b); k = clamp01(k);

      // Variant-driven vignette (different “space” feeling)
      const rr = u * u + v * v;
      const vig = 1.0 - V.vignette * rr * (0.35 + 0.65 * k);

      // Grain (variant strength)
      const grain = (rng() - 0.5) * V.grain;

      // Very mild tone curve (variant gamma)
      r = Math.pow(clamp01(r * vig + grain), V.gamma);
      g = Math.pow(clamp01(g * vig + grain), V.gamma);
      b = Math.pow(clamp01(b * vig + grain), V.gamma);

      // Optional tiny “color grade” (warm/cool/green shift)
      const gr = V.grade;
      r = clamp01(r + gr.r);
      g = clamp01(g + gr.g);
      b = clamp01(b + gr.b);

      // Track brightness to avoid “black seed”
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      avgLum += lum;

      data[i++] = (r * 255) | 0;
      data[i++] = (g * 255) | 0;
      data[i++] = (b * 255) | 0;
      data[i++] = 255;
    }
  }

  avgLum /= (W * H);

  // If too dark, lift it (prevents empty/black results)
  if (avgLum < 0.035) {
    liftImageData(img.data, 1.7);
  }

  octx.putImageData(img, 0, 0);

  // Draw into preview (pctx is already setTransform(dpr,...))
  pctx.clearRect(0, 0, cssW, cssH);
  pctx.imageSmoothingEnabled = true;
  pctx.drawImage(off, 0, 0, cssW, cssH);

  // Post look pass (keeps background feel but adds variety)
  applyPostLook(pctx, rng, cssW, cssH, variant);

  // Accents (same idea, but variant biases modes + strength)
  renderAccents(pctx, shade, rng, cssW, cssH, variant);

  pctx.globalAlpha = 1;

  if (previewMeta) previewMeta.textContent = `Seed: ${seed} • Style: expr-tree • v${variant}`;
}

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function liftImageData(data, gain) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] * gain);
    data[i + 1] = Math.min(255, data[i + 1] * gain);
    data[i + 2] = Math.min(255, data[i + 2] * gain);
  }
}

function getVariantParams(v) {
  // All subtle: still “background”, but with different mood/contrast
  const params = [
    { vignette: 0.38, grain: 0.06, gamma: 1.05, grade: { r: 0.00, g: 0.00, b: 0.00 } }, // neutral
    { vignette: 0.30, grain: 0.05, gamma: 0.95, grade: { r: 0.06, g: 0.01, b: -0.02 } }, // warm
    { vignette: 0.44, grain: 0.045, gamma: 1.10, grade: { r: -0.02, g: 0.02, b: 0.06 } }, // cool
    { vignette: 0.22, grain: 0.07, gamma: 1.00, grade: { r: 0.02, g: 0.03, b: 0.00 } }, // airy
    { vignette: 0.55, grain: 0.035, gamma: 1.15, grade: { r: -0.01, g: -0.01, b: 0.00 } }, // deep
    { vignette: 0.34, grain: 0.08, gamma: 0.92, grade: { r: 0.03, g: 0.00, b: 0.03 } }, // dreamy
    { vignette: 0.42, grain: 0.05, gamma: 1.00, grade: { r: 0.00, g: 0.04, b: -0.01 } }, // greenish
    { vignette: 0.26, grain: 0.055, gamma: 1.08, grade: { r: 0.00, g: 0.00, b: 0.00 } }, // crisp
  ];
  return params[v] || params[0];
}

function applyPostLook(ctx, rng, W, H, variant) {
  ctx.save();

  // subtle film/paper texture
  const specks = Math.floor((W * H) / (1400 + rng() * 1000));
  ctx.globalAlpha = 0.04 + rng() * 0.03;
  ctx.fillStyle = "rgba(255,255,255,1)";
  for (let i = 0; i < specks; i++) {
    const x = rng() * W, y = rng() * H;
    ctx.fillRect(x, y, 1 + rng() * 2, 1 + rng() * 2);
  }

  // occasional soft blur “bloom” but not always
  if (variant === 3 || variant === 5) {
    ctx.globalAlpha = 0.10;
    for (let k = 0; k < 2; k++) {
      const dx = (rng() - 0.5) * 10;
      const dy = (rng() - 0.5) * 10;
      ctx.drawImage(ctx.canvas, dx, dy, W, H);
    }
  }

  // faint scanline / weave for one variant
  if (variant === 4) {
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = "rgba(0,0,0,1)";
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  }

  ctx.restore();
}

function pickMode(rng, variant) {
  // Bias per variant so “shape language” changes
  // modes: 0 ribbon, 1 shard, 2 hatch, 3 ring, 4 plate
  const t = rng();

  if (variant === 0) return t < 0.40 ? 4 : t < 0.65 ? 3 : t < 0.80 ? 0 : t < 0.92 ? 2 : 1;
  if (variant === 1) return t < 0.50 ? 0 : t < 0.72 ? 4 : t < 0.88 ? 3 : 2;
  if (variant === 2) return t < 0.45 ? 3 : t < 0.75 ? 2 : t < 0.90 ? 4 : 0;
  if (variant === 3) return t < 0.55 ? 4 : t < 0.78 ? 2 : t < 0.92 ? 0 : 3;
  if (variant === 4) return t < 0.45 ? 2 : t < 0.70 ? 1 : t < 0.88 ? 3 : 4;
  if (variant === 5) return t < 0.60 ? 4 : t < 0.80 ? 0 : t < 0.92 ? 3 : 2;
  if (variant === 6) return t < 0.55 ? 3 : t < 0.78 ? 4 : t < 0.92 ? 2 : 0;
  return t < 0.50 ? 4 : t < 0.72 ? 3 : t < 0.88 ? 2 : 0;
}

function renderAccents(pctx, shade, rng, cssW, cssH, variant) {
  // Fewer + softer accents (background feel), but different per variant
  const base = 2 + Math.floor(rng() * 6);
  const accents = base + (variant === 4 ? 2 : 0);

  pctx.globalAlpha = (0.06 + rng() * 0.10) * (variant === 5 ? 0.7 : 1.0);

  for (let a = 0; a < accents; a++) {
    const x = rng() * cssW;
    const y = rng() * cssH;

    const uu = (x / cssW) * 2 - 1;
    const vv = (y / cssH) * 2 - 1;
    let [rr, gg, bb] = shade(uu, vv);

    if (!Number.isFinite(rr) || !Number.isFinite(gg) || !Number.isFinite(bb)) {
      rr = gg = bb = 0.6;
    }
    rr = clamp01(rr); gg = clamp01(gg); bb = clamp01(bb);

    pctx.strokeStyle = `rgb(${(rr * 255) | 0}, ${(gg * 255) | 0}, ${(bb * 255) | 0})`;
    pctx.fillStyle = pctx.strokeStyle;

    const mode = pickMode(rng, variant);

    pctx.save();
    pctx.translate(x, y);
    pctx.rotate((rng() - 0.5) * Math.PI * 2);

    if (mode === 0) {
      // ribbon stroke
      pctx.lineWidth = 2 + rng() * (variant === 1 ? 14 : 9);
      pctx.beginPath();
      pctx.moveTo(-220, 0);
      for (let t = 0; t < 8; t++) {
        pctx.quadraticCurveTo(-160 + t * 62, (rng() - 0.5) * 140, -110 + t * 62, (rng() - 0.5) * 140);
      }
      pctx.stroke();

    } else if (mode === 1) {
      // shard polygon (rarer except variant 4)
      const n = 3 + Math.floor(rng() * 6);
      pctx.beginPath();
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * Math.PI * 2;
        const rad = 30 + rng() * (variant === 4 ? 260 : 160);
        pctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      }
      pctx.closePath();
      pctx.globalAlpha *= 0.75;
      pctx.fill();
      pctx.globalAlpha /= 0.75;

    } else if (mode === 2) {
      // hatch block
      const w = 120 + rng() * 520;
      const h = 60 + rng() * 280;
      pctx.globalAlpha *= 0.45;
      pctx.fillRect(-w / 2, -h / 2, w, h);
      pctx.globalAlpha *= 2.2;
      pctx.lineWidth = 1;
      for (let t = -w / 2; t < w / 2; t += 7 + rng() * 12) {
        pctx.beginPath();
        pctx.moveTo(t, -h / 2);
        pctx.lineTo(t + (rng() - 0.5) * 50, h / 2);
        pctx.stroke();
      }

    } else if (mode === 3) {
      // ring arc
      pctx.lineWidth = 2 + rng() * 7;
      pctx.beginPath();
      pctx.arc(0, 0, 50 + rng() * 260, 0, Math.PI * (0.7 + rng() * 1.3));
      pctx.stroke();

    } else {
      // soft plate (most common)
      const w = 180 + rng() * 680;
      const h = 120 + rng() * 480;
      const grad = pctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h));
      grad.addColorStop(0, `rgba(${(rr * 255) | 0}, ${(gg * 255) | 0}, ${(bb * 255) | 0}, 0.35)`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      pctx.fillStyle = grad;
      pctx.fillRect(-w / 2, -h / 2, w, h);
    }

    pctx.restore();
  }

  pctx.globalAlpha = 1;
}




// 1) Seed -> RNG
function xorshift32(seed) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}

// 2) Build an expression tree from the seed
function buildNode(rng, depth) {
  if (depth <= 0) {
    const t = rng();
    if (t < 0.33) return { type: "x" };
    if (t < 0.66) return { type: "y" };
    return { type: "const", v: rng() * 2 - 1 };
  }

  const pick = rng();

  if (pick < 0.15)
    return { type: "sin", a: buildNode(rng, depth - 1), f: 1 + rng() * 6 };

  if (pick < 0.28)
    return { type: "abs", a: buildNode(rng, depth - 1) };

  if (pick < 0.42)
    return {
      type: "mix",
      a: buildNode(rng, depth - 1),
      b: buildNode(rng, depth - 1),
      t: buildNode(rng, depth - 1),
    };

  if (pick < 0.56)
    return {
      type: "warp",
      a: buildNode(rng, depth - 1),
      wx: buildNode(rng, depth - 1),
      wy: buildNode(rng, depth - 1),
      amp: 0.15 + rng() * 1.6,
    };

  if (pick < 0.68)
    return {
      type: "ridged",
      a: buildNode(rng, depth - 1),
    };

  if (pick < 0.80)
    return {
      type: "cell",
      s: (rng() * 1e9) >>> 0,
      scale: 1.5 + rng() * 10,
    };

  if (pick < 0.90)
    return {
      type: "rotate",
      src: buildNode(rng, depth - 1),
      a: rng() * Math.PI * 2,
    };

  return {
    type: "noise",
    s: (rng() * 1e9) >>> 0,
    scale: 0.5 + rng() * 6,
  };
}


function evalNode(node, x, y) {
  switch (node.type) {
    case "x": return x;
    case "y": return y;
    case "const": return node.v;

    case "sin":
      return Math.sin(evalNode(node.a, x, y) * node.f);

    case "abs":
      return Math.abs(evalNode(node.a, x, y));

    case "mix": {
      const a = evalNode(node.a, x, y);
      const b = evalNode(node.b, x, y);
      const t = 0.5 + 0.5 * evalNode(node.t, x, y);
      return a * (1 - t) + b * t;
    }

    case "warp": {
      const wx = evalNode(node.wx, x, y) * node.amp;
      const wy = evalNode(node.wy, x, y) * node.amp;
      return evalNode(node.a, x + wx, y + wy);
    }

    case "noise": {
      const n = valueNoise(x * node.scale, y * node.scale, node.s);
      return n * 2 - 1;
    }

    /* ---------- NEW ---------- */

    case "ridged": {
      const v = evalNode(node.a, x, y);
      return 1 - Math.abs(v); // sharp ridges
    }

    case "cell": {
      const nx = Math.floor(x * node.scale);
      const ny = Math.floor(y * node.scale);
      const n = hash2D(nx, ny, node.s);
      return n * 2 - 1;
    }

    case "rotate": {
      const c = Math.cos(node.a);
      const s = Math.sin(node.a);
      const xr = c * x - s * y;
      const yr = s * x + c * y;
      return evalNode(node.src, xr, yr);
    }
  }
}


// 3) Seed -> style program (3 different trees = different “language”)
function makeStyleShader(seed) {
  const rng = xorshift32(seed);
  const depth = 3 + Math.floor(rng() * 4);

  const rTree = buildNode(rng, depth);
  const gTree = buildNode(rng, depth);
  const bTree = buildNode(rng, depth);
  const maskTree = buildNode(rng, depth);

  const gamma = 0.7 + rng() * 1.8;
  const contrast = 0.8 + rng() * 2.2;

  // NEW: global coordinate skew per style
  const skewX = (rng() - 0.5) * 0.6;
  const skewY = (rng() - 0.5) * 0.6;
  const scale = 0.7 + rng() * 0.8;

  return function shade(u, v) {
    // style-dependent coordinate transform
    const x = (u + v * skewX) * scale;
    const y = (v + u * skewY) * scale;

    let r = evalNode(rTree, x, y);
    let g = evalNode(gTree, x, y);
    let b = evalNode(bTree, x, y);
    let m = evalNode(maskTree, x, y);

    r = Math.tanh(r * contrast);
    g = Math.tanh(g * contrast);
    b = Math.tanh(b * contrast);

    const k = 0.5 + 0.5 * Math.tanh(m);

    r = Math.pow(0.5 + 0.5 * (r * (0.7 + 0.6 * k)), gamma);
    g = Math.pow(0.5 + 0.5 * (g * (0.7 + 0.6 * (1 - k))), gamma);
    b = Math.pow(0.5 + 0.5 * (b * (0.7 + 0.6 * (0.5 + 0.5 * k))), gamma);

    return [r, g, b, k];
  };
}





previewClose.addEventListener("click", closePreview);
previewBackdrop.addEventListener("click", closePreview);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !previewModal.classList.contains("hidden")) closePreview();
});

previewRegenerateBtn.addEventListener("click", () => {
  // Always generate a new seed for "New variation"
  lastPreviewSeed = (Math.random() * 1e9) >>> 0;
  seedInput.value = lastPreviewSeed;
  resizePreviewCanvas();
  renderAbstractPainting(lastPreviewSeed);
});

previewExportPngBtn.addEventListener("click", () => {
  const url = previewCanvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `changeable_preview_${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);

window.addEventListener("keydown", (e) => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const mod = isMac ? e.metaKey : e.ctrlKey;

  if (!mod) return;

  // Ctrl/Cmd+Z = undo
  if (e.key.toLowerCase() === "z" && !e.shiftKey) {
    e.preventDefault();
    undo();
  }

  // Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z = redo
  if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) {
    e.preventDefault();
    redo();
  }
});



function openHelp() {
  helpModal.classList.remove("hidden");
}

function closeHelp() {
  helpModal.classList.add("hidden");
}
function cloneGrid(g) {
  return g.map(row => row.slice());
}

clearBtn.addEventListener("click", () => {
  pushHistory();
  grid = createGrid(rows, cols);
  hoverCell = null;
  draw();
});

// --- Events: hover / click / drag paint ---
canvas.addEventListener("mousemove", (e) => {
  hoverCell = getCellFromEvent(e);

  if (isPainting && hoverCell) {
    paintCell(hoverCell.x, hoverCell.y, paintEraseMode);
  }

  draw();
});

canvas.addEventListener("mouseleave", () => {
  hoverCell = null;
  isPainting = false;
  draw();
});

canvas.addEventListener("mousedown", (e) => {
  const cell = getCellFromEvent(e);
  if (!cell) return;
  pushHistory();

  // Left click = paint, Shift+Left = erase
  // Right click = erase
  const isRightClick = e.button === 2;
  paintEraseMode = isRightClick || e.shiftKey;

  isPainting = true;
  paintCell(cell.x, cell.y, paintEraseMode);
  draw();
});

window.addEventListener("mouseup", () => {
  isPainting = false;
});


saveBtn.addEventListener("click", () => {
  designData.value = exportDesign();
});

loadBtn.addEventListener("click", () => {
  try {
    importDesign(designData.value);
  } catch (e) {
    alert("Invalid design data.");
  }
});

mirrorXBtn.addEventListener("click", mirrorX);
mirrorYBtn.addEventListener("click", mirrorY);
rotateBtn.addEventListener("click", rotate90);

exportPngBtn.addEventListener("click", exportPNG);



helpBtn.addEventListener("click", openHelp);
helpClose.addEventListener("click", closeHelp);
helpBackdrop.addEventListener("click", closeHelp);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !helpModal.classList.contains("hidden")) {
    closeHelp();
  }
});

window.addEventListener("resize", () => {
  if (!previewModal.classList.contains("hidden")) {
    resizePreviewCanvas();
    renderAbstractPainting(lastPreviewSeed);
  }
});


canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// Inputs
colsInput.addEventListener("change", applySettings);
rowsInput.addEventListener("change", applySettings);
ruleMaxInput.addEventListener("change", applySettings);
showGridEl.addEventListener("change", draw);

// Init
grid = createGrid(rows, cols);
renderLegend();
resizeCanvas();
generateBtn.addEventListener("click", generatePreview);
updateHistoryButtons();


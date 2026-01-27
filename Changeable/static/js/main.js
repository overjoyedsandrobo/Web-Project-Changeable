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

  const pctx = c.getContext("2d");
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
  const rng = mulberry32(seed);

  // Canvas size in CSS pixels (because we used setTransform)
  const rect = previewCanvas.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;

  // Clear
  pctx.clearRect(0, 0, W, H);
  pctx.fillStyle = "#050505";
  pctx.fillRect(0, 0, W, H);

  // A small curated palette (you can add “Palette” later)
  const palette = [
    "#e6e6e6", "#cfcfcf",
    "#b84a3a", "#3a6ea5",
    "#d4b483", "#7a3e9d"
  ];

  // --- Layer 1: big soft blobs (composition) ---
  const blobCount = 18;
  for (let i = 0; i < blobCount; i++) {
    const u = rng();
    const v = rng();

    const rule = sampleRuleField(u, v) / Math.max(1, (ruleMax - 1)); // 0..1
    const n = valueNoise(u, v, seed);

    const x = u * W;
    const y = v * H;

    // size influenced by rule + noise
    const r = (0.06 + 0.22 * n + 0.18 * rule) * Math.min(W, H);

    pctx.globalAlpha = 0.06 + 0.12 * rng();
    pctx.fillStyle = palette[(i + Math.floor(rule * palette.length)) % palette.length];

    pctx.beginPath();
    pctx.arc(x, y, r, 0, Math.PI * 2);
    pctx.fill();
  }

  // --- Layer 2: flow-field strokes (the “painting”) ---
  const strokeCount = 9000;
  const stepsPerStroke = 18;

  // how strongly rules influence direction
  const ruleStrength = 1.0;
  // how turbulent noise is
  const noiseStrength = 1.6;

  pctx.globalAlpha = 0.07;
  pctx.lineWidth = 1;

  for (let s = 0; s < strokeCount; s++) {
    let u = rng();
    let v = rng();

    // choose color based on local rule
    const baseRule = sampleRuleField(u, v);
    const colorIndex = Math.floor((baseRule / Math.max(1, ruleMax - 1)) * (palette.length - 1));
    pctx.strokeStyle = palette[Math.max(0, Math.min(palette.length - 1, colorIndex))];

    let x = u * W;
    let y = v * H;

    pctx.beginPath();
    pctx.moveTo(x, y);

    for (let k = 0; k < stepsPerStroke; k++) {
      const uu = x / W;
      const vv = y / H;

      // Rule -> base angle (0..2π)
      const rVal = sampleRuleField(uu, vv);
      const rNorm = rVal / Math.max(1, (ruleMax - 1));
      const ruleAngle = rNorm * Math.PI * 2;

      // Noise -> turbulence angle
      const n = valueNoise(uu, vv, (seed ^ 0x9e3779b9) >>> 0);
      const noiseAngle = n * Math.PI * 2;

      // Mix
      const angle = ruleStrength * ruleAngle + noiseStrength * noiseAngle;

      // Step size (slightly variable)
      const step = 0.8 + 1.8 * rng();
      x += Math.cos(angle) * step;
      y += Math.sin(angle) * step;

      pctx.lineTo(x, y);

      // Stop if out of bounds
      if (x < 0 || x > W || y < 0 || y > H) break;
    }

    pctx.stroke();
  }

  // --- Layer 3: a few sharp accents (cubist-ish) ---
  pctx.globalAlpha = 0.12;
  for (let i = 0; i < 28; i++) {
    const u = rng(), v = rng();
    const x = u * W, y = v * H;

    const rule = sampleRuleField(u, v) / Math.max(1, (ruleMax - 1));
    const w = (20 + 160 * rng()) * (0.4 + rule);
    const h = (20 + 160 * rng()) * (0.4 + (1 - rule));

    pctx.fillStyle = palette[Math.floor(rng() * palette.length)];
    pctx.save();
    pctx.translate(x, y);
    pctx.rotate((rng() - 0.5) * 1.0);
    pctx.fillRect(-w / 2, -h / 2, w, h);
    pctx.restore();
  }

  // Reset alpha
  pctx.globalAlpha = 1;

  if (previewMeta) {
    previewMeta.textContent = `Seed: ${seed} • Grid: ${cols}×${rows} • Rules: ${ruleMax}`;
  }
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


const canvas = document.getElementById("generation-canvas");
const ctx = canvas.getContext("2d");

const colsInput = document.getElementById("cols");
const rowsInput = document.getElementById("rows");
const ruleMaxInput = document.getElementById("ruleMax");
const clearBtn = document.getElementById("clearBtn");

const legendEl = document.getElementById("legend");

const generateBtn = document.getElementById("generateBtn");
const stepsInput = document.getElementById("steps");
const seedModeEl = document.getElementById("seedMode");
const seedCountInput = document.getElementById("seedCount");
const showGridEl = document.getElementById("showGrid");
const seedInput = document.getElementById("seed");
const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const designData = document.getElementById("designData");


let generatedLines = [];


let cols = parseInt(colsInput.value, 10);
let rows = parseInt(rowsInput.value, 10);
let ruleMax = parseInt(ruleMaxInput.value, 10);

let grid = [];
let hoverCell = null;
let isPainting = false;

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
  generatedLines = [];

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
  // Background
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  // Read toggle (default to true if checkbox doesn't exist yet)
  const showGrid = showGridEl ? showGridEl.checked : true;

  // Fill cells based on rule value (keep this ALWAYS so you can see rules)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const rule = grid[y][x];
      if (rule !== 0) {
        ctx.fillStyle = ruleToFill(rule);
        ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
      }
    }
  }

  // Grid lines + hover highlight ONLY if showGrid is enabled
  if (showGrid) {
    // Grid lines (subtle)
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

    // Hover highlight
    if (hoverCell) {
      const { x, y } = hoverCell;
      ctx.strokeStyle = "#3a3a3a";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        x * cellW + 1,
        y * cellH + 1,
        cellW - 2,
        cellH - 2
      );
    }
  }

  // Draw generated structure (ALWAYS draw this if it exists)
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 2;

  for (const [x1, y1, x2, y2] of generatedLines) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function renderLegend() {
  legendEl.innerHTML = "";

  for (let r = 0; r < ruleMax; r++) {
    const item = document.createElement("div");

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = ruleToFill(r);

    const label = document.createElement("span");
    label.textContent = r === 0 ? `${r} Empty` : `${r}`;

    item.appendChild(swatch);
    item.appendChild(label);
    legendEl.appendChild(item);
  }
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

function cycleCell(x, y) {
  grid[y][x] = (grid[y][x] + 1) % ruleMax;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function dirFromRule(rule, prevDir) {
  // Directions: 0=up,1=right,2=down,3=left
  if (rule === 1) return 0;
  if (rule === 2) return 1;
  if (rule === 3) return 2;
  if (rule === 4) return 3;
  return prevDir; // rule 0 or others: keep direction
}

function stepFromDir(dir) {
  if (dir === 0) return { dx: 0, dy: -1 };
  if (dir === 1) return { dx: 1, dy: 0 };
  if (dir === 2) return { dx: 0, dy: 1 };
  return { dx: -1, dy: 0 };
}

function inBounds(x, y) {
  return x >= 0 && x < cols && y >= 0 && y < rows;
}

function pickSeeds(rng) {
if (typeof rng !== "function") {
  console.warn("pickSeeds called without rng; using non-deterministic fallback");
  rng = mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0);
}

  const mode = seedModeEl.value;

  // Always have a safe fallback seed (no recursion)
  const fallback = [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2), dir: 1 }];

  if (mode === "center") {
    return fallback;
  }

  if (mode === "random") {
    const count = clampInt(seedCountInput.value, 1, 200);
    seedCountInput.value = count;

    const seeds = [];
    for (let i = 0; i < count; i++) {
      seeds.push({
        x: seededRandInt(rng, 0, cols - 1),
        y: seededRandInt(rng, 0, rows - 1),
        dir: seededRandInt(rng, 0, 3),
      });
    }
    return seeds;
  }

  // default: all non-zero cells
  const seeds = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] !== 0) seeds.push({ x, y, dir: 1 });
    }
  }

  // If user hasn't painted anything, return fallback (no recursion)
  return seeds.length > 0 ? seeds : fallback;
}

function generateStructure() {
  generatedLines = [];

  const steps = clampInt(stepsInput.value, 1, 1000);
  stepsInput.value = steps;

  const seed = clampInt(seedInput.value, 0, 999999999);
  seedInput.value = seed;

  const rng = mulberry32(seed);

  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  // Walkers live in grid space, but we draw in canvas space.
  let walkers = pickSeeds(rng).map(s => ({ ...s }));

  // Limit explosion if user uses branch heavily
  const MAX_WALKERS = 600;

  for (let i = 0; i < steps; i++) {
    if (walkers.length === 0) break;

    const nextWalkers = [];

    for (const w of walkers) {
      if (!inBounds(w.x, w.y)) continue;

      const rule = grid[w.y][w.x];

      // Apply direction rule
      w.dir = dirFromRule(rule, w.dir);

      // Branch rule: split into two directions
      if (rule === 5 && nextWalkers.length < MAX_WALKERS) {
        const left = (w.dir + 3) % 4;
        const right = (w.dir + 1) % 4;
        nextWalkers.push({ x: w.x, y: w.y, dir: left });
        nextWalkers.push({ x: w.x, y: w.y, dir: right });
      }

      const { dx, dy } = stepFromDir(w.dir);
      const nx = w.x + dx;
      const ny = w.y + dy;

      if (!inBounds(nx, ny)) continue;

      // Convert to canvas coords (cell centers)
      const x1 = w.x * cellW + cellW / 2;
      const y1 = w.y * cellH + cellH / 2;
      const x2 = nx * cellW + cellW / 2;
      const y2 = ny * cellH + cellH / 2;

      generatedLines.push([x1, y1, x2, y2]);

      // Move forward
      nextWalkers.push({ x: nx, y: ny, dir: w.dir });

      if (nextWalkers.length >= MAX_WALKERS) break;
    }

    walkers = nextWalkers;
  }

  draw();
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

function seededRandInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function exportDesign() {
  return JSON.stringify({
    cols,
    rows,
    ruleMax,
    seed: clampInt(seedInput.value, 0, 999999999),
    steps: clampInt(stepsInput.value, 1, 64),
    seedMode: seedModeEl.value,
    seedCount: clampInt(seedCountInput.value, 1, 200),
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
  stepsInput.value = clampInt(obj.steps ?? 16, 1, 64);
  seedModeEl.value = obj.seedMode ?? "nonzero";
  seedCountInput.value = clampInt(obj.seedCount ?? 25, 1, 200);

  grid = obj.grid;
  generatedLines = [];
  hoverCell = null;

  renderLegend();
  resizeCanvas();
  draw();
}

// --- Events: hover / click / drag paint ---
canvas.addEventListener("mousemove", (e) => {
  hoverCell = getCellFromEvent(e);

  if (isPainting && hoverCell) {
    cycleCell(hoverCell.x, hoverCell.y);
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
  isPainting = true;
  cycleCell(cell.x, cell.y);
  draw();
});

window.addEventListener("mouseup", () => {
  isPainting = false;
});

clearBtn.addEventListener("click", () => {
  grid = createGrid(rows, cols);
  generatedLines = [];
  draw();
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

// Inputs
colsInput.addEventListener("change", applySettings);
rowsInput.addEventListener("change", applySettings);
ruleMaxInput.addEventListener("change", applySettings);
showGridEl.addEventListener("change", draw);

// Init
grid = createGrid(rows, cols);
renderLegend();
resizeCanvas();
generateBtn.addEventListener("click", generateStructure);

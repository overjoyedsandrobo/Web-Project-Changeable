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
const seedCountInput = document.getElementById("seedCount");
const showGridEl = document.getElementById("showGrid");
const seedInput = document.getElementById("seed");
const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const designData = document.getElementById("designData");
const randomizeSeedEl = document.getElementById("randomizeSeed");
const mirrorXBtn = document.getElementById("mirrorXBtn");
const mirrorYBtn = document.getElementById("mirrorYBtn");
const rotateBtn = document.getElementById("rotateBtn");
const exportSvgBtn = document.getElementById("exportSvgBtn");
const exportPngBtn = document.getElementById("exportPngBtn");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");

const undoStack = [];
const redoStack = [];
const HISTORY_LIMIT = 100;
const modeEl = document.getElementById("mode");
const branchInput = document.getElementById("branch");
const driftInput = document.getElementById("drift");
const viewModeEl = document.getElementById("viewMode");
const thresholdInput = document.getElementById("threshold");
const baseShapeEl = document.getElementById("baseShape");
const rimInput = document.getElementById("rim");

let baseMask = [];     // where material exists
let holeMask = [];     // where holes are


let density = [];   // rows x cols counts
let mask = [];      // rows x cols boolean (true = hole)

let generatedLines = [];


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

  const viewMode = viewModeEl ? viewModeEl.value : "both";

  // Read toggle (default to true if checkbox doesn't exist yet)
  const showGrid = showGridEl ? showGridEl.checked : true;

  // Fill cells based on rule value (keep this ALWAYS so you can see rules)
  if (viewMode !== "mask") {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const rule = grid[y][x];
        if (rule !== 0) {
          ctx.fillStyle = ruleToFill(rule);
          ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
        }
      }
    }
  }
  if ((viewMode === "mask" || viewMode === "both") && baseMask && baseMask.length) {
    // Background (outside panel)
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Panel material cells
    ctx.fillStyle = "#0a0a0a";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (baseMask[y][x]) {
          ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
        }
      }
    }

    // Holes (cutouts)
    ctx.fillStyle = "#e5e7eb";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (holeMask && holeMask[y][x]) {
          ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
        }
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

  if (viewMode === "lines" || viewMode === "both") {
    for (const [x1, y1, x2, y2] of generatedLines) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
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

  const steps = clampInt(stepsInput.value, 1, 64);
  stepsInput.value = steps;

  // Randomize seed toggle behavior
  let seed;
  if (randomizeSeedEl && randomizeSeedEl.checked) {
    seed = (Math.random() * 1e9) >>> 0;
    seedInput.value = seed;
  } else {
    seed = clampInt(seedInput.value, 0, 999999999);
    seedInput.value = seed;
  }

  const rng = mulberry32(seed);

  // ✅ Reset density + mask every generate
  density = create2D(rows, cols, 0);
  mask = create2D(rows, cols, false);

  baseMask = buildBaseMask();
  holeMask = create2D(rows, cols, false);


  const mode = modeEl ? modeEl.value : "paths";

  if (mode === "circuit") {
    generateCircuit(rng, steps);
  } else if (mode === "organic") {
    generateOrganic(rng, steps);
  } else {
    generatePaths(rng, steps);
  }

  // ✅ Build mask from density using threshold
  const t = clampInt(thresholdInput.value, 1, 50);
  thresholdInput.value = t;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const t = clampInt(thresholdInput.value, 1, 50);
      thresholdInput.value = t;

      const rim = clampInt(rimInput.value, 0, 6);
      rimInput.value = rim;

      const rimMask = applyRim(baseMask, rim);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          // Only allow holes inside the base shape and NOT on the rim
          const inside = baseMask[y][x];
          const isRim = rimMask[y][x];

          holeMask[y][x] = inside && !isRim && (density[y][x] >= t);
        }
      }
    }
  }

  draw();
}

function generatePaths(rng, steps) {
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  let walkers = pickSeeds(rng).map(s => ({ ...s }));
  const MAX_WALKERS = 600;

  for (let i = 0; i < steps; i++) {
    if (walkers.length === 0) break;

    const nextWalkers = [];

    for (const w of walkers) {
      if (!inBounds(w.x, w.y)) continue;

      const rule = grid[w.y][w.x];

      w.dir = dirFromRule(rule, w.dir);

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

      const x1 = w.x * cellW + cellW / 2;
      const y1 = w.y * cellH + cellH / 2;
      const x2 = nx * cellW + cellW / 2;
      const y2 = ny * cellH + cellH / 2;

      generatedLines.push([x1, y1, x2, y2]);
      density[w.y][w.x] += 1;
      density[ny][nx] += 1;

      nextWalkers.push({ x: nx, y: ny, dir: w.dir });

      if (nextWalkers.length >= MAX_WALKERS) break;
    }

    walkers = nextWalkers;
  }
}

function generateCircuit(rng, steps) {
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  let walkers = pickSeeds(rng).map(s => ({ ...s }));
  const MAX_WALKERS = 400;

  for (let i = 0; i < steps; i++) {
    if (walkers.length === 0) break;

    const nextWalkers = [];

    for (const w of walkers) {
      if (!inBounds(w.x, w.y)) continue;

      const rule = grid[w.y][w.x];

      // Force direction if rule 1..4
      w.dir = dirFromRule(rule, w.dir);

      // Rule 5 = "turn" (not branch). Choose left or right by rng.
      if (rule === 5) {
        const turnRight = rng() < 0.5;
        w.dir = turnRight ? (w.dir + 1) % 4 : (w.dir + 3) % 4;
      }

      const { dx, dy } = stepFromDir(w.dir);
      const nx = w.x + dx;
      const ny = w.y + dy;

      if (!inBounds(nx, ny)) continue;

      const x1 = w.x * cellW + cellW / 2;
      const y1 = w.y * cellH + cellH / 2;
      const x2 = nx * cellW + cellW / 2;
      const y2 = ny * cellH + cellH / 2;

      generatedLines.push([x1, y1, x2, y2]);
      density[w.y][w.x] += 1;
      density[ny][nx] += 1;

      nextWalkers.push({ x: nx, y: ny, dir: w.dir });

      if (nextWalkers.length >= MAX_WALKERS) break;
    }

    walkers = nextWalkers;
  }
}

function generateOrganic(rng, steps) {
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  const branchPct = clampInt(branchInput.value, 0, 100);
  branchInput.value = branchPct;

  const driftPct = clampInt(driftInput.value, 0, 100);
  driftInput.value = driftPct;

  let walkers = pickSeeds(rng).map(s => ({ ...s }));
  const MAX_WALKERS = 700;

  for (let i = 0; i < steps; i++) {
    if (walkers.length === 0) break;

    const nextWalkers = [];

    for (const w of walkers) {
      if (!inBounds(w.x, w.y)) continue;

      const rule = grid[w.y][w.x];

      // Rule-directed steering when non-zero
      if (rule !== 0) w.dir = dirFromRule(rule, w.dir);

      // Drift: random small turn sometimes
      if (rng() * 100 < driftPct) {
        w.dir = (rng() < 0.5) ? (w.dir + 1) % 4 : (w.dir + 3) % 4;
      }

      // Branching: strongest when rule is 5, but can also branch a bit on any non-zero
      const shouldBranch =
        (rule === 5 && rng() * 100 < branchPct) ||
        (rule !== 0 && rule !== 5 && rng() * 100 < (branchPct * 0.25));

      if (shouldBranch && nextWalkers.length < MAX_WALKERS) {
        const left = (w.dir + 3) % 4;
        const right = (w.dir + 1) % 4;
        nextWalkers.push({ x: w.x, y: w.y, dir: left });
        nextWalkers.push({ x: w.x, y: w.y, dir: right });
      }

      const { dx, dy } = stepFromDir(w.dir);
      const nx = w.x + dx;
      const ny = w.y + dy;

      if (!inBounds(nx, ny)) continue;

      const x1 = w.x * cellW + cellW / 2;
      const y1 = w.y * cellH + cellH / 2;
      const x2 = nx * cellW + cellW / 2;
      const y2 = ny * cellH + cellH / 2;

      generatedLines.push([x1, y1, x2, y2]);
      density[w.y][w.x] += 1;
      density[ny][nx] += 1;

      nextWalkers.push({ x: nx, y: ny, dir: w.dir });

      if (nextWalkers.length >= MAX_WALKERS) break;
    }

    walkers = nextWalkers;
  }
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
function mirrorX() {
  pushHistory();
  const newGrid = cloneGrid(grid);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      newGrid[y][cols - 1 - x] = grid[y][x];
    }
  }

  grid = newGrid;
  generatedLines = [];
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
  generatedLines = [];
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
  generatedLines = [];
  hoverCell = null;

  resizeCanvas();
  draw();
}
function exportSVG() {
  if (!generatedLines || generatedLines.length === 0) {
    alert("Nothing to export. Click Generate first.");
    return;
  }

  const w = canvas.width;
  const h = canvas.height;

  // Metadata comment (nice for reproducibility)
  const meta = {
    cols,
    rows,
    ruleMax,
    seed: Number(seedInput.value),
    steps: Number(stepsInput.value),
    randomizeSeed: !!(randomizeSeedEl && randomizeSeedEl.checked),
    seedMode: seedModeEl?.value,
    seedCount: seedCountInput ? Number(seedCountInput.value) : undefined,
  };

  const stroke = "#e5e7eb";
  const strokeWidth = 2;

  let paths = "";
  for (const [x1, y1, x2, y2] of generatedLines) {
    paths += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" />\n`;
  }

  const svg =
`<?xml version="1.0" encoding="UTF-8"?>
<!-- Changeable export: ${JSON.stringify(meta)} -->
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="black" />
  <g fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round">
${paths.trimEnd()}
  </g>
</svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `changeable_${Date.now()}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}
function exportPNG() {
  if (!generatedLines || generatedLines.length === 0) {
    alert("Nothing to export. Click Generate first.");
    return;
  }

  // Export the current canvas as-is
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `changeable_${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
function cloneGrid(g) {
  return g.map(row => row.slice());
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

  generatedLines = [];
  hoverCell = null;

  renderLegend();
  resizeCanvas();
  draw();
}
function buildBaseMask() {
  const shape = baseShapeEl ? baseShapeEl.value : "none";
  const bm = create2D(rows, cols, true);

  if (shape === "none") return bm;

  if (shape === "pill") {
    // Rounded rectangle / pill silhouette
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    const rx = cols * 0.32;
    const ry = rows * 0.38;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        bm[y][x] = (dx * dx + dy * dy) <= 1.0;
      }
    }
    return bm;
  }

  // Default: vase (lamp-like)
  if (shape === "vase") {
    const cx = (cols - 1) / 2;

    for (let y = 0; y < rows; y++) {
      const t = y / (rows - 1); // 0 top -> 1 bottom

      // Vase profile: narrow neck, wide belly, then base flare
      const neck = 0.10;                 // narrow near top
      const belly = 0.34 * Math.sin(Math.PI * t); // widest mid
      const base = 0.18 * (t * t);       // flare near bottom

      const halfWidth = (cols * (neck + belly + base)) + 1.0; // in cells

      for (let x = 0; x < cols; x++) {
        bm[y][x] = Math.abs(x - cx) <= halfWidth;
      }
    }
    return bm;
  }

  return bm;
}

function applyRim(mask, rim) {
  if (rim <= 0) return mask;
  const out = create2D(rows, cols, false);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!mask[y][x]) continue;

      // if near edge of base mask, keep solid (rim)
      let nearEdge = false;
      for (let dy = -rim; dy <= rim && !nearEdge; dy++) {
        for (let dx = -rim; dx <= rim; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || ny >= rows || nx < 0 || nx >= cols || !mask[ny][nx]) {
            nearEdge = true;
            break;
          }
        }
      }
      out[y][x] = nearEdge;
    }
  }
  return out; // true means "rim cell"
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
function create2D(r, c, fill) {
  return Array.from({ length: r }, () => Array(c).fill(fill));
}


viewModeEl.addEventListener("change", draw);

thresholdInput.addEventListener("change", () => {
  // recompute mask from density without regenerating
  const t = clampInt(thresholdInput.value, 1, 50);
  thresholdInput.value = t;

  if (!density || density.length === 0) return;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      mask[y][x] = density[y][x] >= t;
    }
  }
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

clearBtn.addEventListener("click", () => {
  pushHistory();
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

mirrorXBtn.addEventListener("click", mirrorX);
mirrorYBtn.addEventListener("click", mirrorY);
rotateBtn.addEventListener("click", rotate90);

exportSvgBtn.addEventListener("click", exportSVG);
exportPngBtn.addEventListener("click", exportPNG);



helpBtn.addEventListener("click", openHelp);
helpClose.addEventListener("click", closeHelp);
helpBackdrop.addEventListener("click", closeHelp);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !helpModal.classList.contains("hidden")) {
    closeHelp();
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
generateBtn.addEventListener("click", generateStructure);
updateHistoryButtons();


const canvas = document.getElementById("generation-canvas");
const ctx = canvas.getContext("2d");

const colsInput = document.getElementById("cols");
const rowsInput = document.getElementById("rows");
const ruleMaxInput = document.getElementById("ruleMax");
const clearBtn = document.getElementById("clearBtn");

const legendEl = document.getElementById("legend");

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

  // Fill cells based on rule value
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const rule = grid[y][x];
      if (rule !== 0) {
        ctx.fillStyle = ruleToFill(rule);
        ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
      }
    }
  }

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
  draw();
});

// Inputs
colsInput.addEventListener("change", applySettings);
rowsInput.addEventListener("change", applySettings);
ruleMaxInput.addEventListener("change", applySettings);

// Init
grid = createGrid(rows, cols);
renderLegend();
resizeCanvas();
